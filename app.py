import json
import os
from datetime import datetime, timedelta

import anthropic
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, render_template, request, session, url_for
from flask_sqlalchemy import SQLAlchemy

load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret')

# Use PostgreSQL on Render (DATABASE_URL env var), fallback to local SQLite
db_url = os.environ.get('DATABASE_URL', 'sqlite:///deadlines.db')
# Render gives postgres:// — convert to postgresql+psycopg:// for psycopg3
if db_url.startswith('postgres://'):
    db_url = db_url.replace('postgres://', 'postgresql+psycopg://', 1)
elif db_url.startswith('postgresql://'):
    db_url = db_url.replace('postgresql://', 'postgresql+psycopg://', 1)
app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)



# ── Models ────────────────────────────────────────────────────────────────────

class User(db.Model):
    id         = db.Column(db.Integer, primary_key=True)
    email      = db.Column(db.String(255), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    assignments = db.relationship('Assignment', backref='user', lazy=True, cascade='all, delete-orphan')
    events      = db.relationship('Event', backref='user', lazy=True, cascade='all, delete-orphan')


class Assignment(db.Model):
    id              = db.Column(db.Integer, primary_key=True)
    user_id         = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title           = db.Column(db.String(500), nullable=False)
    course          = db.Column(db.String(255), default='')
    due_date        = db.Column(db.DateTime)
    description     = db.Column(db.Text, default='')
    points          = db.Column(db.String(50), default='')
    submission_type = db.Column(db.String(100), default='')
    is_done         = db.Column(db.Boolean, default=False)
    pinned          = db.Column(db.Boolean, default=False)
    sort_order      = db.Column(db.Integer, nullable=True)
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)
    alerts = db.relationship('Alert', backref='assignment', lazy=True, cascade='all, delete-orphan')


class Alert(db.Model):
    id           = db.Column(db.Integer, primary_key=True)
    assignment_id = db.Column(db.Integer, db.ForeignKey('assignment.id'), nullable=False)
    alert_time   = db.Column(db.DateTime, nullable=False)
    alert_type   = db.Column(db.String(20))  # '2days' or '5hours'
    sent         = db.Column(db.Boolean, default=False)


class Event(db.Model):
    id           = db.Column(db.Integer, primary_key=True)
    user_id      = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title        = db.Column(db.String(500), nullable=False)
    location     = db.Column(db.String(255), default='')
    event_date   = db.Column(db.String(255), default='')  # human-readable, e.g. "Monday, Apr 21"
    event_time   = db.Column(db.String(100), default='')  # e.g. "3:00 PM"
    sort_date    = db.Column(db.DateTime, nullable=True)   # for chronological ordering
    details      = db.Column(db.Text, default='')
    pinned       = db.Column(db.Boolean, default=False)
    sort_order   = db.Column(db.Integer, nullable=True)
    is_done      = db.Column(db.Boolean, default=False)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)


# ── Create tables + migrate missing columns on startup ────────────────────────
with app.app_context():
    db.create_all()
    # Add new columns if they don't exist yet (safe to run multiple times)
    with db.engine.connect() as conn:
        for table, col, coldef in [
            ('assignment', 'pinned',     'BOOLEAN DEFAULT FALSE'),
            ('assignment', 'sort_order', 'INTEGER'),
            ('event',      'pinned',     'BOOLEAN DEFAULT FALSE'),
            ('event',      'sort_order', 'INTEGER'),
            ('event',      'is_done',    'BOOLEAN DEFAULT FALSE'),
        ]:
            try:
                conn.execute(db.text(f'ALTER TABLE "{table}" ADD COLUMN {col} {coldef}'))
                conn.commit()
            except Exception:
                conn.rollback()  # column already exists — ignore

# ── Scheduler (placeholder — email disabled) ──────────────────────────────────

def check_alerts():
    pass  # Email alerts removed — to be re-enabled after deployment


# ── AI parser ─────────────────────────────────────────────────────────────────

PARSE_PROMPT_ASSIGNMENTS = """Extract every task, deadline, payment, or action item from the content.

IMPORTANT: Never return an empty array. Even if no explicit deadline is given, infer a short title from the content and return it with an empty due_date so the user can set it manually.

Examples of things to capture even without a date:
- Tuition/bill payment reminders → title like "SSOL Tuition Payment"
- Registration tasks → "Course Registration"
- Form submissions, appointments, anything requiring action

Return ONLY a JSON array, no markdown:
[
  {
    "title": "string (short, clear title — infer if needed)",
    "course": "string or empty",
    "due_date": "YYYY-MM-DDTHH:MM:SS if found, or empty string if not",
    "description": "1 sentence summarising what needs to be done",
    "points": "string or empty",
    "submission_type": "string or empty"
  }
]"""

PARSE_PROMPT_EVENTS = """Extract every event from the content. Be very lenient — a title plus any hint of a date or time is enough to capture it as an event.

IMPORTANT: Never return an empty array. If you can identify any event-like thing (talk, meeting, session, info event), return it even if the date is missing — leave event_date and event_time blank so the user can fill them in.

IMAGE/FLYER READING — read ALL text including decorative or stylized fonts.

LOCATION ABBREVIATIONS — always apply:
- "Jerome L. Greene Hall", "Jerome Greene Hall", "Greene Hall", "JG" → "JG [room]"
- "William June Warren", "William Warren", "Warren Hall", "Big Warren", "WJW", "BW" → "BW [room]"
- If no physical location, use "Online" or leave blank.

DETAILS — 1 short sentence max (speaker name, topic, food). Blank if nothing useful.

Return ONLY a JSON array, no markdown:
[
  {
    "title": "string",
    "location": "string or blank",
    "event_date": "string (e.g. Tuesday, Apr 14) or blank",
    "event_time": "string (e.g. 12:00 PM) or blank",
    "sort_date": "YYYY-MM-DDTHH:MM:SS or blank",
    "details": "1 sentence or blank"
  }
]"""


def parse_content(text: str = None, image_b64: str = None, mime: str = None, mode: str = 'assignments') -> dict:
    client = anthropic.Anthropic(api_key=os.environ.get('ANTHROPIC_API_KEY'))
    prompt = PARSE_PROMPT_EVENTS if mode == 'events' else PARSE_PROMPT_ASSIGNMENTS

    if image_b64:
        content = [
            {"type": "image", "source": {"type": "base64", "media_type": mime, "data": image_b64}},
            {"type": "text", "text": prompt}
        ]
    else:
        content = f"{prompt}\n\nContent:\n{text}"

    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        messages=[{"role": "user", "content": content}]
    )
    raw = msg.content[0].text.strip()
    print(f"[parse] raw response: {raw[:300]}")

    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        # AI returned prose instead of JSON — extract title from content and return a stub
        title = (text or "")[:80].strip().split("\n")[0] or "Untitled item"
        stub = {"title": title, "course": "", "due_date": "", "description": "Set deadline manually.", "points": "", "submission_type": ""}
        result = [stub]

    if not isinstance(result, list):
        result = []
    if mode == 'events':
        return {"assignments": [], "events": result}
    return {"assignments": result, "events": []}


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('index.html')


@app.route('/join', methods=['POST'])
def join():
    email = request.form.get('email', '').strip().lower()
    if not email or '@' not in email:
        return render_template('index.html', error='Enter a valid email.')
    user = User.query.filter_by(email=email).first()
    if not user:
        user = User(email=email)
        db.session.add(user)
        db.session.commit()
    session['user_id'] = user.id
    return redirect(url_for('dashboard'))


@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('index'))
    user = User.query.get(session['user_id'])
    if user is None:
        session.clear()
        return redirect(url_for('index'))
    now = datetime.now()

    def split_sorted(items, date_attr):
        def key(x):
            d = getattr(x, date_attr)
            return (x.sort_order if x.sort_order is not None else 99999,
                    d if d else datetime.max)
        pinned   = sorted([x for x in items if x.pinned and not x.is_done], key=key)
        unpinned = sorted([x for x in items if not x.pinned and not x.is_done], key=key)
        return pinned, unpinned

    all_asgn = Assignment.query.filter_by(user_id=user.id).all()
    all_evt  = Event.query.filter_by(user_id=user.id).all()
    pinned_asgn, unpinned_asgn = split_sorted(all_asgn, 'due_date')
    pinned_evt,  unpinned_evt  = split_sorted(all_evt,  'sort_date')
    past_evt = sorted([e for e in all_evt if e.is_done],
                      key=lambda e: e.sort_date or datetime.min, reverse=True)

    # Calendar data (JSON for JS)
    cal_items = []
    for a in all_asgn:
        if a.due_date and not a.is_done:
            cal_items.append({'type':'assignment','title':a.title,
                'date':a.due_date.strftime('%Y-%m-%d'),
                'time':a.due_date.strftime('%I:%M %p').lstrip('0'),
                'course':a.course or ''})
    from dateutil import parser as dp
    cur_year = datetime.now().year
    for e in all_evt:
        if e.is_done:
            continue
        edate = None
        if e.event_date:
            # Always parse from text with explicit current year to avoid AI year errors
            for yr in [cur_year, cur_year + 1]:
                try:
                    edate = dp.parse(f"{e.event_date} {yr}", fuzzy=True).strftime('%Y-%m-%d')
                    break
                except Exception:
                    pass
        if not edate and e.sort_date:
            # Fallback: use sort_date but fix wrong year
            sd = e.sort_date.replace(year=cur_year) if e.sort_date.year < cur_year else e.sort_date
            edate = sd.strftime('%Y-%m-%d')
        if edate:
            cal_items.append({'type':'event','title':e.title,
                'date':edate, 'time':e.event_time or '', 'location':e.location or ''})

    return render_template('dashboard.html',
        user=user, now=now,
        pinned_asgn=pinned_asgn, unpinned_asgn=unpinned_asgn,
        pinned_evt=pinned_evt,   unpinned_evt=unpinned_evt,
        past_evt=past_evt, cal_items=cal_items)


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))


@app.route('/api/parse', methods=['POST'])
def api_parse():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    data = request.get_json(force=True)
    mode = data.get('mode', 'assignments')
    try:
        if data.get('type') == 'image':
            results = parse_content(image_b64=data['data'], mime=data['mediaType'], mode=mode)
        else:
            results = parse_content(text=data['content'], mode=mode)
    except json.JSONDecodeError:
        return jsonify({'error': 'Could not read content. Try pasting more detail.'}), 422
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    return jsonify(results)


@app.route('/api/save', methods=['POST'])
def api_save():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    user = User.query.get(session['user_id'])
    data = request.get_json(force=True)
    saved = []

    for a in data.get('assignments', []):
        try:
            due = datetime.fromisoformat(a['due_date'])
        except Exception:
            continue

        # Update if already exists (same title + course)
        existing = Assignment.query.filter_by(user_id=user.id, title=a['title'], course=a.get('course', '')).first()
        if existing:
            Alert.query.filter_by(assignment_id=existing.id).delete()
            existing.due_date = due
            existing.description = a.get('description', '')
            existing.points = a.get('points', '')
            existing.submission_type = a.get('submission_type', '')
            existing.is_done = False
            assignment = existing
        else:
            assignment = Assignment(
                user_id=user.id,
                title=a['title'],
                course=a.get('course', ''),
                due_date=due,
                description=a.get('description', ''),
                points=a.get('points', ''),
                submission_type=a.get('submission_type', ''),
            )
            db.session.add(assignment)

        db.session.flush()

        # Schedule alerts
        for delta, atype in [(timedelta(days=2), '2days'), (timedelta(hours=5), '5hours')]:
            t = due - delta
            if t > datetime.utcnow():
                db.session.add(Alert(assignment_id=assignment.id, alert_time=t, alert_type=atype))

        saved.append(a['title'])

    db.session.commit()

    return jsonify({'saved': saved})


@app.route('/api/add-one', methods=['POST'])
def api_add_one():
    """Manually add a single assignment or event."""
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    user = User.query.get(session['user_id'])
    data = request.get_json(force=True)
    kind = data.get('kind')  # 'assignment' or 'event'

    if kind == 'assignment':
        due = None
        try:
            if data.get('due_date'):
                due = datetime.fromisoformat(data['due_date'])
        except Exception:
            pass
        a = Assignment(
            user_id=user.id,
            title=data.get('title', '').strip(),
            course=data.get('course', ''),
            due_date=due,
            description=data.get('description', ''),
            points=data.get('points', ''),
            submission_type=data.get('submission_type', ''),
        )
        db.session.add(a)
        db.session.flush()
        if due:
            for delta, atype in [(timedelta(days=2), '2days'), (timedelta(hours=5), '5hours')]:
                t = due - delta
                if t > datetime.utcnow():
                    db.session.add(Alert(assignment_id=a.id, alert_time=t, alert_type=atype))
        db.session.commit()
        return jsonify({'ok': True})

    elif kind == 'event':
        sort_date = None
        try:
            if data.get('sort_date'):
                sort_date = datetime.fromisoformat(data['sort_date'])
        except Exception:
            pass
        e = Event(
            user_id=user.id,
            title=data.get('title', '').strip(),
            location=data.get('location', ''),
            event_date=data.get('event_date', ''),
            event_time=data.get('event_time', ''),
            sort_date=sort_date,
            details=data.get('details', ''),
        )
        db.session.add(e)
        db.session.commit()
        return jsonify({'ok': True})

    return jsonify({'error': 'Invalid kind'}), 400


@app.route('/api/edit-assignment/<int:aid>', methods=['POST'])
def api_edit_assignment(aid):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    a = Assignment.query.filter_by(id=aid, user_id=session['user_id']).first_or_404()
    data = request.get_json(force=True)
    a.title = data.get('title', a.title)
    a.course = data.get('course', a.course)
    a.description = data.get('description', a.description)
    a.points = data.get('points', a.points)
    a.submission_type = data.get('submission_type', a.submission_type)
    try:
        if data.get('due_date'):
            new_due = datetime.fromisoformat(data['due_date'])
            if new_due != a.due_date:
                a.due_date = new_due
                Alert.query.filter_by(assignment_id=a.id).delete()
                for delta, atype in [(timedelta(days=2), '2days'), (timedelta(hours=5), '5hours')]:
                    t = new_due - delta
                    if t > datetime.utcnow():
                        db.session.add(Alert(assignment_id=a.id, alert_time=t, alert_type=atype))
    except Exception:
        pass
    db.session.commit()
    return jsonify({'ok': True})


@app.route('/api/edit-event/<int:eid>', methods=['POST'])
def api_edit_event(eid):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    e = Event.query.filter_by(id=eid, user_id=session['user_id']).first_or_404()
    data = request.get_json(force=True)
    e.title      = data.get('title', e.title)
    e.location   = data.get('location', e.location)
    e.event_date = data.get('event_date', e.event_date)
    e.event_time = data.get('event_time', e.event_time)
    e.details    = data.get('details', e.details)
    try:
        if data.get('event_date') and data.get('event_time'):
            from dateutil import parser as dp
            e.sort_date = dp.parse(f"{data['event_date']} {data['event_time']}", fuzzy=True)
    except Exception:
        pass
    db.session.commit()
    return jsonify({'ok': True})


@app.route('/api/done/<int:aid>', methods=['POST'])
def api_done(aid):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    a = Assignment.query.filter_by(id=aid, user_id=session['user_id']).first_or_404()
    a.is_done = not a.is_done
    db.session.commit()
    return jsonify({'ok': True, 'is_done': a.is_done})


@app.route('/api/delete/<int:aid>', methods=['DELETE'])
def api_delete(aid):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    a = Assignment.query.filter_by(id=aid, user_id=session['user_id']).first_or_404()
    db.session.delete(a)
    db.session.commit()
    return jsonify({'ok': True})


@app.route('/api/save-events', methods=['POST'])
def api_save_events():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    user = User.query.get(session['user_id'])
    data = request.get_json(force=True)
    saved = []
    for e in data.get('events', []):
        sort_date = None
        try:
            sort_date = datetime.fromisoformat(e['sort_date']) if e.get('sort_date') else None
        except Exception:
            pass
        event = Event(
            user_id=user.id,
            title=e.get('title', ''),
            location=e.get('location', ''),
            event_date=e.get('event_date', ''),
            event_time=e.get('event_time', ''),
            sort_date=sort_date,
            details=e.get('details', ''),
        )
        db.session.add(event)
        saved.append(e.get('title', ''))
    db.session.commit()
    return jsonify({'saved': saved})


@app.route('/api/pin/<int:aid>', methods=['POST'])
def api_pin(aid):
    if 'user_id' not in session: return jsonify({'error': 'Not logged in'}), 401
    a = Assignment.query.filter_by(id=aid, user_id=session['user_id']).first_or_404()
    a.pinned = not a.pinned
    a.sort_order = None
    db.session.commit()
    return jsonify({'pinned': a.pinned})


@app.route('/api/pin-event/<int:eid>', methods=['POST'])
def api_pin_event(eid):
    if 'user_id' not in session: return jsonify({'error': 'Not logged in'}), 401
    e = Event.query.filter_by(id=eid, user_id=session['user_id']).first_or_404()
    e.pinned = not e.pinned
    e.sort_order = None
    db.session.commit()
    return jsonify({'pinned': e.pinned})


@app.route('/api/reorder', methods=['POST'])
def api_reorder():
    if 'user_id' not in session: return jsonify({'error': 'Not logged in'}), 401
    data = request.get_json(force=True)
    for i, aid in enumerate(data.get('ids', [])):
        a = Assignment.query.filter_by(id=int(aid), user_id=session['user_id']).first()
        if a: a.sort_order = i
    db.session.commit()
    return jsonify({'ok': True})


@app.route('/api/reorder-events', methods=['POST'])
def api_reorder_events():
    if 'user_id' not in session: return jsonify({'error': 'Not logged in'}), 401
    data = request.get_json(force=True)
    for i, eid in enumerate(data.get('ids', [])):
        e = Event.query.filter_by(id=int(eid), user_id=session['user_id']).first()
        if e: e.sort_order = i
    db.session.commit()
    return jsonify({'ok': True})


@app.route('/api/done-event/<int:eid>', methods=['POST'])
def api_done_event(eid):
    if 'user_id' not in session: return jsonify({'error': 'Not logged in'}), 401
    e = Event.query.filter_by(id=eid, user_id=session['user_id']).first_or_404()
    e.is_done = not e.is_done
    db.session.commit()
    return jsonify({'ok': True, 'is_done': e.is_done})


@app.route('/api/delete-event/<int:eid>', methods=['DELETE'])
def api_delete_event(eid):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    e = Event.query.filter_by(id=eid, user_id=session['user_id']).first_or_404()
    db.session.delete(e)
    db.session.commit()
    return jsonify({'ok': True})


# ── Startup ───────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    scheduler = BackgroundScheduler()
    scheduler.add_job(check_alerts, 'interval', minutes=15)
    scheduler.start()
    print("Running at http://localhost:5000")
    app.run(debug=False, port=5001)
