import { useState, useEffect, useRef, useCallback } from "react";

// ─── Constants & Mock Data ───────────────────────────────────────────────────

const SAMPLE_POLICIES = [
  {
    id: "tariff-china",
    label: "25% Tariff on Chinese Imports",
    description:
      "Proposed 25% across-the-board tariff on all goods imported from China, affecting electronics, machinery, consumer goods, and raw materials.",
    category: "Trade",
    status: "Proposed",
    congress: "119th Congress",
    billRef: "H.R. 2847",
  },
  {
    id: "ai-regulation",
    label: "AI Accountability Act",
    description:
      "Federal legislation requiring algorithmic impact assessments, mandatory disclosure of AI use in high-stakes decisions, and creation of an AI oversight office within the FTC.",
    category: "Technology",
    status: "In Committee",
    congress: "119th Congress",
    billRef: "S. 1031",
  },
  {
    id: "rent-stabilization",
    label: "National Rent Stabilization Act",
    description:
      "Federal cap on annual rent increases at 5% for buildings with 10+ units, with penalties for non-compliance and a tenant right of action in federal court.",
    category: "Housing",
    status: "Introduced",
    congress: "119th Congress",
    billRef: "H.R. 4412",
  },
];

const LEGAL_ANALYSES = {
  "tariff-china": {
    constitutionalRisk: 35,
    riskLabel: "Moderate",
    litigationLikelihood: "Medium",
    precedent: {
      name: "Section 301 Tariffs (2018)",
      outcome:
        "Upheld under trade authority, but faced WTO challenges and retaliatory tariffs. Multiple lawsuits filed in Court of International Trade.",
      case: "HMTX Industries v. United States (2020)",
    },
    affectedStatutes: [
      { code: "19 U.S.C. § 2411", name: "Trade Act of 1974, Section 301", impact: "Expanded" },
      { code: "19 U.S.C. § 1307", name: "Tariff Act of 1930", impact: "Amended" },
      { code: "50 U.S.C. § 1701", name: "IEEPA", impact: "Cross-referenced" },
    ],
    vulnerabilities: [
      "Commerce Clause — potential challenge if tariff disproportionately burdens specific states",
      "Due Process — affected importers may argue insufficient notice period",
      "Delegation Doctrine — broad executive tariff authority increasingly contested",
    ],
    regulatoryChain: [
      { level: "Federal", actor: "USTR", action: "Publishes Federal Register notice, opens comment period" },
      { level: "Federal", actor: "CBP", action: "Issues implementation guidance for ports of entry" },
      { level: "State", actor: "State Commerce Depts", action: "Advisory alerts to affected businesses" },
      { level: "Local", actor: "Port Authorities", action: "Updated processing and fee schedules" },
    ],
  },
  "ai-regulation": {
    constitutionalRisk: 25,
    riskLabel: "Low-Moderate",
    litigationLikelihood: "High",
    precedent: {
      name: "EU AI Act (2024)",
      outcome:
        "First comprehensive AI regulation globally. US approach differs by focusing on sector-specific disclosure rather than risk-tiering.",
      case: "No direct US precedent — novel regulatory territory",
    },
    affectedStatutes: [
      { code: "15 U.S.C. § 45", name: "FTC Act, Section 5 (Unfair Practices)", impact: "Expanded" },
      { code: "47 U.S.C. § 230", name: "Communications Decency Act, Section 230", impact: "Narrowed" },
      { code: "42 U.S.C. § 2000e", name: "Title VII (Employment Discrimination)", impact: "Cross-referenced" },
    ],
    vulnerabilities: [
      "First Amendment — mandatory disclosure requirements may face compelled speech challenges",
      "Vagueness Doctrine — 'high-stakes AI decision' lacks precise definition",
      "Preemption — conflicts with emerging state AI laws (CO, CA, IL)",
    ],
    regulatoryChain: [
      { level: "Federal", actor: "FTC", action: "Establishes AI Oversight Office, begins rulemaking" },
      { level: "Federal", actor: "NIST", action: "Develops algorithmic impact assessment standards" },
      { level: "State", actor: "State AGs", action: "Coordinate enforcement under concurrent authority" },
      { level: "Local", actor: "City Agencies", action: "Update procurement rules for AI vendors" },
    ],
  },
  "rent-stabilization": {
    constitutionalRisk: 65,
    riskLabel: "High",
    litigationLikelihood: "Very High",
    precedent: {
      name: "NYC Rent Stabilization Law (1969) + Oregon SB 608 (2019)",
      outcome:
        "State-level rent control repeatedly upheld but never imposed federally. Supreme Court signals skepticism in recent takings jurisprudence.",
      case: "Cedar Point Nursery v. Hassid (2021) — expanded physical takings doctrine",
    },
    affectedStatutes: [
      { code: "42 U.S.C. § 1437f", name: "Section 8 Housing Act", impact: "Amended" },
      { code: "26 U.S.C. § 42", name: "Low-Income Housing Tax Credit", impact: "Cross-referenced" },
      { code: "Fair Housing Act", name: "42 U.S.C. §§ 3601-3619", impact: "Expanded" },
    ],
    vulnerabilities: [
      "Takings Clause — 5% cap likely triggers regulatory takings challenge under Penn Central",
      "Commerce Clause — federal authority to regulate local rental markets is contested",
      "Tenth Amendment — traditional state police power over landlord-tenant relations",
      "Due Process — property owners may argue cap is confiscatory without rational basis",
    ],
    regulatoryChain: [
      { level: "Federal", actor: "HUD", action: "Issues compliance guidelines and enforcement rules" },
      { level: "Federal", actor: "DOJ", action: "Establishes tenant right-of-action procedures" },
      { level: "State", actor: "State Legislatures", action: "Reconcile with existing rent control/decontrol laws" },
      { level: "Local", actor: "Housing Courts", action: "Updated rent adjustment procedures and docket management" },
    ],
  },
};

const ECONOMIC_DATA = {
  "tariff-china": {
    indicators: [
      {
        name: "Consumer Price Index",
        code: "CPI",
        direction: "up",
        magnitude: "+1.2–2.4%",
        confidence: 85,
        historicalData: [248, 250, 252, 255, 259, 264, 270, 275, 279, 282, 288, 295],
        labels: ["Q1'18", "Q2'18", "Q3'18", "Q4'18", "Q1'19", "Q2'19", "Q3'19", "Q4'19", "Q1'20", "Q2'20", "Q3'20", "Q4'20"],
        eventIndex: 3,
      },
      {
        name: "Manufacturing PMI",
        code: "PMI",
        direction: "down",
        magnitude: "–3.5 pts",
        confidence: 78,
        historicalData: [59, 58, 56, 54, 52, 51, 49, 48, 47, 46, 48, 50],
        labels: ["Q1'18", "Q2'18", "Q3'18", "Q4'18", "Q1'19", "Q2'19", "Q3'19", "Q4'19", "Q1'20", "Q2'20", "Q3'20", "Q4'20"],
        eventIndex: 3,
      },
      {
        name: "S&P 500",
        code: "SPX",
        direction: "down",
        magnitude: "–5–12% short-term",
        confidence: 70,
        historicalData: [2680, 2718, 2913, 2507, 2834, 2942, 2980, 3140, 2585, 3100, 3363, 3756],
        labels: ["Q1'18", "Q2'18", "Q3'18", "Q4'18", "Q1'19", "Q2'19", "Q3'19", "Q4'19", "Q1'20", "Q2'20", "Q3'20", "Q4'20"],
        eventIndex: 3,
      },
      {
        name: "Trade Deficit (Goods)",
        code: "TRADE",
        direction: "up",
        magnitude: "+$40–80B",
        confidence: 72,
        historicalData: [-795, -810, -825, -878, -854, -862, -855, -853, -860, -680, -820, -900],
        labels: ["Q1'18", "Q2'18", "Q3'18", "Q4'18", "Q1'19", "Q2'19", "Q3'19", "Q4'19", "Q1'20", "Q2'20", "Q3'20", "Q4'20"],
        eventIndex: 3,
      },
    ],
    causalChain: [
      "25% tariff imposed",
      "Import costs surge",
      "Producer prices rise",
      "Consumer prices follow",
      "Purchasing power declines",
      "Retail spending slows",
    ],
  },
  "ai-regulation": {
    indicators: [
      {
        name: "Tech Sector Market Cap",
        code: "TECH",
        direction: "down",
        magnitude: "–3–8% near-term",
        confidence: 65,
        historicalData: [100, 105, 112, 108, 115, 122, 128, 135, 130, 140, 155, 162],
        labels: ["Q1'23", "Q2'23", "Q3'23", "Q4'23", "Q1'24", "Q2'24", "Q3'24", "Q4'24", "Q1'25", "Q2'25", "Q3'25", "Q4'25"],
        eventIndex: 5,
      },
      {
        name: "AI Startup Funding",
        code: "AIFUND",
        direction: "down",
        magnitude: "–15–25%",
        confidence: 60,
        historicalData: [28, 32, 38, 42, 52, 48, 45, 40, 38, 42, 45, 48],
        labels: ["Q1'23", "Q2'23", "Q3'23", "Q4'23", "Q1'24", "Q2'24", "Q3'24", "Q4'24", "Q1'25", "Q2'25", "Q3'25", "Q4'25"],
        eventIndex: 5,
      },
      {
        name: "Compliance Cost Index",
        code: "COMPLY",
        direction: "up",
        magnitude: "+$2.5–8B annually",
        confidence: 80,
        historicalData: [10, 10, 11, 11, 12, 15, 18, 22, 25, 28, 30, 32],
        labels: ["Q1'23", "Q2'23", "Q3'23", "Q4'23", "Q1'24", "Q2'24", "Q3'24", "Q4'24", "Q1'25", "Q2'25", "Q3'25", "Q4'25"],
        eventIndex: 5,
      },
      {
        name: "GDP Growth Rate",
        code: "GDP",
        direction: "neutral",
        magnitude: "–0.1–0.3%",
        confidence: 45,
        historicalData: [2.2, 2.1, 2.9, 3.2, 1.4, 2.8, 3.0, 2.4, 2.2, 2.5, 2.7, 2.6],
        labels: ["Q1'23", "Q2'23", "Q3'23", "Q4'23", "Q1'24", "Q2'24", "Q3'24", "Q4'24", "Q1'25", "Q2'25", "Q3'25", "Q4'25"],
        eventIndex: 5,
      },
    ],
    causalChain: [
      "AI disclosure mandated",
      "Compliance costs rise",
      "Smaller firms exit or pivot",
      "Market consolidation",
      "Innovation pace shifts",
      "Consumer trust improves",
    ],
  },
  "rent-stabilization": {
    indicators: [
      {
        name: "Housing Starts",
        code: "HOUST",
        direction: "down",
        magnitude: "–12–20%",
        confidence: 82,
        historicalData: [1250, 1280, 1310, 1290, 1270, 1240, 1180, 1120, 1080, 1060, 1070, 1090],
        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        eventIndex: 4,
      },
      {
        name: "Median Rent (National)",
        code: "RENT",
        direction: "down",
        magnitude: "–2–5% (capped markets)",
        confidence: 75,
        historicalData: [1850, 1870, 1890, 1910, 1930, 1920, 1910, 1905, 1900, 1895, 1900, 1910],
        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        eventIndex: 4,
      },
      {
        name: "REIT Index",
        code: "REIT",
        direction: "down",
        magnitude: "–8–15%",
        confidence: 78,
        historicalData: [380, 385, 392, 388, 375, 358, 342, 330, 325, 328, 335, 340],
        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        eventIndex: 4,
      },
      {
        name: "Rental Vacancy Rate",
        code: "VAC",
        direction: "down",
        magnitude: "–1.5–3%",
        confidence: 70,
        historicalData: [6.8, 6.7, 6.6, 6.5, 6.3, 6.0, 5.6, 5.3, 5.0, 4.8, 4.7, 4.6],
        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        eventIndex: 4,
      },
    ],
    causalChain: [
      "5% rent cap enacted",
      "Investor returns decline",
      "New construction slows",
      "Housing supply tightens",
      "Vacancy rates drop",
      "Black market / informal leases rise",
    ],
  },
};

// ─── Utility Components ──────────────────────────────────────────────────────

const COLORS = {
  bg: "#0a0e17",
  card: "#111827",
  cardBorder: "#1e293b",
  accent: "#c084fc",
  accentDim: "rgba(192, 132, 252, 0.15)",
  accentGlow: "rgba(192, 132, 252, 0.3)",
  red: "#f87171",
  redDim: "rgba(248, 113, 113, 0.15)",
  amber: "#fbbf24",
  amberDim: "rgba(251, 191, 36, 0.15)",
  green: "#34d399",
  greenDim: "rgba(52, 211, 153, 0.15)",
  blue: "#60a5fa",
  blueDim: "rgba(96, 165, 250, 0.15)",
  text: "#f1f5f9",
  textMuted: "#94a3b8",
  textDim: "#64748b",
};

function MiniChart({ data, labels, eventIndex, color = COLORS.accent, height = 100 }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 280;
  const h = height;
  const pad = 20;
  const points = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * (w - 2 * pad),
    y: pad + (1 - (v - min) / range) * (h - 2 * pad),
  }));
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = line + ` L ${points[points.length - 1].x} ${h - pad} L ${points[0].x} ${h - pad} Z`;
  const evtX = eventIndex != null ? points[eventIndex]?.x : null;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height }}>
      {evtX != null && (
        <>
          <line x1={evtX} y1={pad - 5} x2={evtX} y2={h - pad + 5} stroke={COLORS.amber} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.7" />
          <text x={evtX} y={pad - 8} textAnchor="middle" fill={COLORS.amber} fontSize="8" fontFamily="inherit">
            Policy
          </text>
        </>
      )}
      <defs>
        <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#grad-${color.replace("#", "")})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={i === eventIndex ? COLORS.amber : color} stroke={COLORS.bg} strokeWidth="1" />
      ))}
      <text x={pad} y={h - 4} fill={COLORS.textDim} fontSize="7" fontFamily="inherit">
        {labels[0]}
      </text>
      <text x={w - pad} y={h - 4} fill={COLORS.textDim} fontSize="7" fontFamily="inherit" textAnchor="end">
        {labels[labels.length - 1]}
      </text>
    </svg>
  );
}

function RiskGauge({ value, label }) {
  const angle = -90 + (value / 100) * 180;
  const color = value > 60 ? COLORS.red : value > 35 ? COLORS.amber : COLORS.green;
  const r = 50;
  const cx = 60;
  const cy = 60;

  function arcPath(startAngle, endAngle) {
    const s = ((startAngle - 90) * Math.PI) / 180;
    const e = ((endAngle - 90) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(s);
    const y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e);
    const y2 = cy + r * Math.sin(e);
    const large = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  }

  return (
    <div style={{ textAlign: "center" }}>
      <svg viewBox="0 0 120 75" style={{ width: 160, height: 100 }}>
        <path d={arcPath(-90, 90)} fill="none" stroke={COLORS.cardBorder} strokeWidth="8" strokeLinecap="round" />
        <path d={arcPath(-90, angle)} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" />
        <text x={cx} y={cy + 2} textAnchor="middle" fill={COLORS.text} fontSize="18" fontWeight="700" fontFamily="inherit">
          {value}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill={COLORS.textDim} fontSize="8" fontFamily="inherit">
          / 100
        </text>
      </svg>
      <div style={{ color, fontSize: 13, fontWeight: 600, marginTop: -4 }}>{label}</div>
    </div>
  );
}

function Badge({ children, color = COLORS.accent, bg }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        color,
        background: bg || `${color}22`,
        letterSpacing: "0.02em",
      }}
    >
      {children}
    </span>
  );
}

function DirectionArrow({ direction }) {
  const color = direction === "up" ? COLORS.red : direction === "down" ? COLORS.green : COLORS.textMuted;
  const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "→";
  return <span style={{ color, fontSize: 18, fontWeight: 700 }}>{arrow}</span>;
}

// ─── Main App ────────────────────────────────────────────────────────────────

export default function PolicyRipple() {
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [activeTab, setActiveTab] = useState("legal");
  const [analyzing, setAnalyzing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [customInput, setCustomInput] = useState("");

  const handleSelectPolicy = useCallback((policy) => {
    setSelectedPolicy(policy);
    setShowResults(false);
    setAnalyzing(true);
    setTimeout(() => {
      setAnalyzing(false);
      setShowResults(true);
      setActiveTab("legal");
    }, 2200);
  }, []);

  const legal = selectedPolicy ? LEGAL_ANALYSES[selectedPolicy.id] : null;
  const economic = selectedPolicy ? ECONOMIC_DATA[selectedPolicy.id] : null;

  const cardStyle = {
    background: COLORS.card,
    border: `1px solid ${COLORS.cardBorder}`,
    borderRadius: 14,
    padding: 24,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        color: COLORS.text,
        fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
        padding: "0 0 60px",
      }}
    >
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* ── Header ─────────────────────────────────── */}
      <header
        style={{
          padding: "40px 32px 32px",
          borderBottom: `1px solid ${COLORS.cardBorder}`,
          background: `linear-gradient(180deg, rgba(192,132,252,0.06) 0%, transparent 100%)`,
        }}
      >
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: `linear-gradient(135deg, ${COLORS.accent}, #818cf8)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
              }}
            >
              ◎
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
              Policy <span style={{ color: COLORS.accent }}>Ripple</span>
            </h1>
          </div>
          <p style={{ color: COLORS.textMuted, fontSize: 14, margin: 0, maxWidth: 520 }}>
            Trace how government policies cascade through legal frameworks and economic indicators. Powered by FRED, Congress.gov & AI analysis.
          </p>
        </div>
      </header>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 32px 0" }}>
        {/* ── Policy Selector ─────────────────────────── */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>
            Select a Policy to Analyze
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            {SAMPLE_POLICIES.map((p) => {
              const isActive = selectedPolicy?.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => handleSelectPolicy(p)}
                  style={{
                    ...cardStyle,
                    padding: 20,
                    cursor: "pointer",
                    textAlign: "left",
                    border: isActive ? `2px solid ${COLORS.accent}` : `1px solid ${COLORS.cardBorder}`,
                    boxShadow: isActive ? `0 0 20px ${COLORS.accentGlow}` : "none",
                    transition: "all 0.25s ease",
                    transform: isActive ? "translateY(-2px)" : "none",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                    <Badge color={p.category === "Trade" ? COLORS.red : p.category === "Technology" ? COLORS.blue : COLORS.green}>
                      {p.category}
                    </Badge>
                    <span style={{ fontSize: 11, color: COLORS.textDim, fontFamily: "'DM Mono', monospace" }}>{p.billRef}</span>
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, margin: "8px 0 6px", lineHeight: 1.3 }}>{p.label}</h3>
                  <p style={{ fontSize: 12, color: COLORS.textMuted, margin: 0, lineHeight: 1.5 }}>
                    {p.description.slice(0, 100)}…
                  </p>
                </button>
              );
            })}
          </div>

          {/* Custom input */}
          <div style={{ ...cardStyle, marginTop: 14, padding: 16, display: "flex", gap: 12, alignItems: "center" }}>
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Or describe a policy in plain English…"
              style={{
                flex: 1,
                background: "transparent",
                border: `1px solid ${COLORS.cardBorder}`,
                borderRadius: 8,
                padding: "10px 14px",
                color: COLORS.text,
                fontSize: 13,
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            <button
              style={{
                background: COLORS.accent,
                color: "#0a0e17",
                border: "none",
                borderRadius: 8,
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
              }}
            >
              Analyze →
            </button>
          </div>
        </section>

        {/* ── Loading State ─────────────────────────── */}
        {analyzing && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div
              style={{
                width: 48,
                height: 48,
                border: `3px solid ${COLORS.cardBorder}`,
                borderTopColor: COLORS.accent,
                borderRadius: "50%",
                margin: "0 auto 20px",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ color: COLORS.textMuted, fontSize: 14 }}>Analyzing policy impact across legal and economic dimensions…</p>
            <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 16 }}>
              {["Parsing bill text", "Cross-referencing statutes", "Pulling FRED data", "Mapping causal chains"].map((s, i) => (
                <span key={i} style={{ fontSize: 11, color: COLORS.textDim, fontFamily: "'DM Mono', monospace" }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Results ─────────────────────────────────── */}
        {showResults && legal && economic && (
          <div>
            {/* Policy Summary Bar */}
            <div
              style={{
                ...cardStyle,
                marginBottom: 24,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 16,
                background: `linear-gradient(135deg, ${COLORS.card}, ${COLORS.accentDim})`,
              }}
            >
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>{selectedPolicy.label}</h2>
                <p style={{ fontSize: 12, color: COLORS.textMuted, margin: 0 }}>
                  {selectedPolicy.congress} · {selectedPolicy.billRef} · Status: {selectedPolicy.status}
                </p>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <Badge color={COLORS.amber}>Litigation: {legal.litigationLikelihood}</Badge>
                <Badge color={legal.constitutionalRisk > 60 ? COLORS.red : legal.constitutionalRisk > 35 ? COLORS.amber : COLORS.green}>
                  Risk: {legal.riskLabel}
                </Badge>
              </div>
            </div>

            {/* Tab Navigation */}
            <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
              {[
                { key: "legal", label: "⚖  Legal Ripple" },
                { key: "economic", label: "📊  Economic Ripple" },
                { key: "chain", label: "🔗  Causal Chain" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    padding: "10px 22px",
                    borderRadius: 8,
                    border: "none",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    background: activeTab === tab.key ? COLORS.accent : COLORS.card,
                    color: activeTab === tab.key ? COLORS.bg : COLORS.textMuted,
                    transition: "all 0.2s",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── Legal Tab ─────────────────────────────── */}
            {activeTab === "legal" && (
              <div style={{ display: "grid", gap: 20 }}>
                {/* Top row: Risk gauge + Precedent */}
                <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20 }}>
                  <div style={{ ...cardStyle, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ fontSize: 11, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                      Constitutional Risk
                    </div>
                    <RiskGauge value={legal.constitutionalRisk} label={legal.riskLabel} />
                  </div>

                  <div style={cardStyle}>
                    <div style={{ fontSize: 11, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                      Historical Precedent
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 8px", color: COLORS.amber }}>{legal.precedent.name}</h3>
                    <p style={{ fontSize: 13, color: COLORS.textMuted, margin: "0 0 10px", lineHeight: 1.6 }}>{legal.precedent.outcome}</p>
                    <div style={{ fontSize: 12, color: COLORS.textDim, fontFamily: "'DM Mono', monospace" }}>📌 {legal.precedent.case}</div>
                  </div>
                </div>

                {/* Affected Statutes */}
                <div style={cardStyle}>
                  <div style={{ fontSize: 11, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>
                    Affected Statutes
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {legal.affectedStatutes.map((s, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "12px 16px",
                          background: COLORS.bg,
                          borderRadius: 10,
                          border: `1px solid ${COLORS.cardBorder}`,
                        }}
                      >
                        <div>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: COLORS.accent }}>{s.code}</span>
                          <span style={{ fontSize: 13, marginLeft: 12 }}>{s.name}</span>
                        </div>
                        <Badge
                          color={s.impact === "Expanded" ? COLORS.red : s.impact === "Amended" ? COLORS.amber : COLORS.blue}
                        >
                          {s.impact}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Vulnerabilities */}
                <div style={cardStyle}>
                  <div style={{ fontSize: 11, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>
                    Legal Vulnerabilities
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {legal.vulnerabilities.map((v, i) => (
                      <div
                        key={i}
                        style={{
                          padding: "12px 16px",
                          background: COLORS.redDim,
                          borderRadius: 10,
                          borderLeft: `3px solid ${COLORS.red}`,
                          fontSize: 13,
                          lineHeight: 1.6,
                          color: COLORS.text,
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{v.split("—")[0]}—</span>
                        <span style={{ color: COLORS.textMuted }}>{v.split("—").slice(1).join("—")}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Regulatory Chain */}
                <div style={cardStyle}>
                  <div style={{ fontSize: 11, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>
                    Regulatory Cascade
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {legal.regulatoryChain.map((r, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 16,
                          padding: "14px 16px",
                          background: COLORS.bg,
                          borderRadius: 10,
                          border: `1px solid ${COLORS.cardBorder}`,
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 56 }}>
                          <Badge
                            color={r.level === "Federal" ? COLORS.accent : r.level === "State" ? COLORS.blue : COLORS.green}
                          >
                            {r.level}
                          </Badge>
                        </div>
                        {i > 0 && (
                          <span style={{ color: COLORS.textDim, fontSize: 16 }}>→</span>
                        )}
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{r.actor}</div>
                          <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>{r.action}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Economic Tab ──────────────────────────── */}
            {activeTab === "economic" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {economic.indicators.map((ind, i) => {
                  const color = ind.direction === "up" ? COLORS.red : ind.direction === "down" ? COLORS.green : COLORS.blue;
                  return (
                    <div key={i} style={cardStyle}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 11, color: COLORS.textDim, fontFamily: "'DM Mono', monospace", marginBottom: 4 }}>
                            {ind.code} · FRED
                          </div>
                          <h4 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{ind.name}</h4>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <DirectionArrow direction={ind.direction} />
                          <div style={{ fontSize: 13, fontWeight: 600, color, marginTop: 2 }}>{ind.magnitude}</div>
                        </div>
                      </div>
                      <MiniChart
                        data={ind.historicalData}
                        labels={ind.labels}
                        eventIndex={ind.eventIndex}
                        color={color}
                        height={110}
                      />
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 11 }}>
                        <span style={{ color: COLORS.textDim }}>Based on historical precedent</span>
                        <span>
                          Confidence:{" "}
                          <span style={{ fontWeight: 600, color: ind.confidence > 75 ? COLORS.green : ind.confidence > 50 ? COLORS.amber : COLORS.red }}>
                            {ind.confidence}%
                          </span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Causal Chain Tab ──────────────────────── */}
            {activeTab === "chain" && (
              <div style={cardStyle}>
                <div style={{ fontSize: 11, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 24 }}>
                  Predicted Causal Chain
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 8, padding: "20px 0" }}>
                  {economic.causalChain.map((step, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div
                        style={{
                          padding: "14px 20px",
                          background: i === 0 ? COLORS.accentDim : COLORS.bg,
                          border: `1px solid ${i === 0 ? COLORS.accent : COLORS.cardBorder}`,
                          borderRadius: 12,
                          fontSize: 13,
                          fontWeight: i === 0 ? 700 : 500,
                          color: i === 0 ? COLORS.accent : COLORS.text,
                          textAlign: "center",
                          minWidth: 100,
                        }}
                      >
                        <div style={{ fontSize: 9, color: COLORS.textDim, marginBottom: 4 }}>Step {i + 1}</div>
                        {step}
                      </div>
                      {i < economic.causalChain.length - 1 && (
                        <span style={{ color: COLORS.accent, fontSize: 20, fontWeight: 700 }}>→</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Summary narrative */}
                <div
                  style={{
                    marginTop: 32,
                    padding: 20,
                    background: COLORS.accentDim,
                    borderRadius: 12,
                    borderLeft: `3px solid ${COLORS.accent}`,
                  }}
                >
                  <div style={{ fontSize: 11, color: COLORS.accent, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                    AI Analysis Summary
                  </div>
                  <p style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.7, margin: 0 }}>
                    {selectedPolicy.id === "tariff-china" &&
                      "Based on the 2018 Section 301 tariff precedent, a 25% across-the-board tariff on Chinese imports is likely to increase consumer prices by 1.2–2.4% within 6 months, with the manufacturing sector absorbing initial shocks through margin compression before passing costs downstream. Legally, the policy faces moderate constitutional risk — executive tariff authority is broad but increasingly contested under the delegation doctrine. Expect litigation in the Court of International Trade within 90 days of implementation."}
                    {selectedPolicy.id === "ai-regulation" &&
                      "The AI Accountability Act enters novel regulatory territory with no direct US precedent. While constitutionally sound in its consumer protection framing under the FTC Act, the mandatory disclosure requirements are likely to face First Amendment compelled-speech challenges. The primary economic impact will be on compliance costs, estimated at $2.5–8B annually across the tech sector, with disproportionate burden on startups and smaller firms. State preemption conflicts with CO SB 205 and CA's proposed AI framework will require judicial resolution."}
                    {selectedPolicy.id === "rent-stabilization" &&
                      "A federal rent cap faces the highest constitutional risk of any current proposal. The Supreme Court's expanded physical takings doctrine in Cedar Point Nursery (2021) signals skepticism toward regulatory takings of this magnitude. Economically, the precedent from Oregon's SB 608 and NYC's rent stabilization history suggests a 12–20% decline in housing starts within 18 months, tightening supply and paradoxically increasing rents in unregulated markets. The rental vacancy rate is projected to drop below 5% nationally, creating significant pressure in already tight urban markets."}
                  </p>
                </div>

                {/* Data sources */}
                <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {["FRED (St. Louis Fed)", "Congress.gov API", "Federal Register", "Claude AI Analysis"].map((s, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: 10,
                        color: COLORS.textDim,
                        padding: "4px 10px",
                        background: COLORS.bg,
                        borderRadius: 20,
                        border: `1px solid ${COLORS.cardBorder}`,
                        fontFamily: "'DM Mono', monospace",
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
