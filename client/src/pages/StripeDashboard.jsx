import { useState, useEffect } from "react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const API_BASE = "https://resumeiq-production-d97e.up.railway.app";

function seededRng(seed) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

function genFallbackStripe(days) {
  const rng = seededRng(99);
  const now = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (days - 1 - i));
    const sessions = Math.round(rng() * 8 + 2);
    const paid = Math.round(sessions * (0.55 + rng() * 0.25));
    const failed = Math.round(sessions * rng() * 0.12);
    const abandoned = Math.max(0, sessions - paid - failed);
    return {
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      sessions, paid, failed, abandoned,
      revenue: parseFloat((paid * 9.99).toFixed(2)),
    };
  });
}

function genFallbackTransactions(n) {
  const rng = seededRng(55);
  const NAMES = ["Alex M.","Jordan T.","Sam R.","Casey L.","Morgan B.","Drew P.","Riley K.","Quinn S.","Avery N.","Taylor H.","Blake W.","Skyler J.","Jamie F.","Parker L.","Reese D."];
  const STATUSES = ["paid","paid","paid","paid","failed","abandoned"];
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const minsAgo = Math.floor(rng() * 60 * 48);
    const d = new Date(now.getTime() - minsAgo * 60000);
    const status = STATUSES[Math.floor(rng() * STATUSES.length)];
    return {
      id: "cs_" + i,
      name: NAMES[i % NAMES.length],
      date: d, status,
      amount: status === "paid" ? 9.99 : 0,
      last4: status === "paid" ? String(Math.floor(rng() * 9000 + 1000)) : null,
    };
  }).sort((a, b) => b.date - a.date);
}

function mapApiToStripeDaily(apiDaily) {
  return (apiDaily || []).map(row => ({
    date: new Date(row.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    sessions: parseInt(row.uploads || 0),
    paid: parseInt(row.paid || 0),
    failed: 0,
    abandoned: Math.max(0, parseInt(row.uploads || 0) - parseInt(row.paid || 0)),
    revenue: parseFloat(row.revenue || 0),
  }));
}

function timeAgo(date) {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return Math.floor(hrs / 24) + "d ago";
}

function MetricCard({ label, value, sub, highlight }) {
  return (
    <div style={{ background: highlight ? "#f0fdf4" : "#f8f9fa", border: "1px solid " + (highlight ? "#bbf7d0" : "#e5e7eb"), borderRadius: 10, padding: "14px 16px" }}>
      <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 5px" }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 600, margin: 0, color: highlight ? "#15803d" : "#111827" }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: "#9ca3af", margin: "4px 0 0" }}>{sub}</p>}
    </div>
  );
}

function StatusBadge({ status }) {
  const m = {
    paid: { bg: "#dcfce7", color: "#166534" },
    failed: { bg: "#fee2e2", color: "#991b1b" },
    abandoned: { bg: "#fef9c3", color: "#854d0e" },
  };
  const s = m[status] || m.abandoned;
  return <span style={{ background: s.bg, color: s.color, fontSize: 11, padding: "2px 8px", borderRadius: 6, fontWeight: 500 }}>{status}</span>;
}

function Spinner() {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#9ca3af", fontSize: 13 }}>Loading...</div>;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
      <p style={{ fontWeight: 600, margin: "0 0 6px", color: "#111827" }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ margin: "2px 0", color: p.color }}>
          {p.name}: {p.name === "Revenue" ? "$" + p.value.toFixed(2) : p.value}
        </p>
      ))}
    </div>
  );
}

export default function StripeDashboard() {
  const [range, setRange] = useState("7d");
  const [view, setView] = useState("overview");
  const [apiData, setApiData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveMode, setLiveMode] = useState(true);

  useEffect(() => {
    if (!liveMode) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    const token = typeof window !== "undefined" ? localStorage.getItem("riq_token") : null;
    const headers = token ? { Authorization: "Bearer " + token } : {};
    fetch(API_BASE + "/api/resumeiq/analytics?range=" + range, { headers })
      .then(r => { if (!r.ok) throw new Error(r.status.toString()); return r.json(); })
      .then(data => { setApiData(data); setLoading(false); })
      .catch(err => { setError(err.message); setLiveMode(false); setLoading(false); });
  }, [range, liveMode]);

  const days = range === "7d" ? 7 : 30;
  const dailyData = liveMode && apiData ? mapApiToStripeDaily(apiData.daily) : genFallbackStripe(days);
  const transactions = genFallbackTransactions(20);

  const totalSessions  = dailyData.reduce((a, r) => a + r.sessions, 0);
  const totalPaid      = dailyData.reduce((a, r) => a + r.paid, 0);
  const totalFailed    = dailyData.reduce((a, r) => a + r.failed, 0);
  const totalAbandoned = dailyData.reduce((a, r) => a + r.abandoned, 0);
  const totalRevenue   = dailyData.reduce((a, r) => a + r.revenue, 0);
  const convRate       = totalSessions > 0 ? ((totalPaid / totalSessions) * 100).toFixed(1) : "0.0";

  const allTimeRevenue = liveMode && apiData ? parseFloat(apiData.totals?.totalRevenue || 0) : null;
  const emailCaptures  = liveMode && apiData ? parseInt(apiData.emailCaptures || 0) : null;

  const pieData = [
    { name: "Paid", value: totalPaid, color: "#16a34a" },
    { name: "Abandoned", value: totalAbandoned, color: "#d97706" },
    { name: "Failed", value: totalFailed, color: "#dc2626" },
  ];

  const LEGEND_COLORS = [["#16a34a","Paid"],["#fbbf24","Abandoned"],["#f87171","Failed"]];

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 860, margin: "0 auto", padding: "24px 16px", color: "#111827" }}>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, background: "#635bff", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg viewBox="0 0 24 24" width={18} height={18} fill="white">
              <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>Stripe dashboard</p>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>ResumeIQ payment sessions</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={() => { setLiveMode(!liveMode); setApiData(null); }}
            style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, border: "1px solid " + (liveMode ? "#bbf7d0" : "#e5e7eb"), background: liveMode ? "#f0fdf4" : "#f9fafb", color: liveMode ? "#15803d" : "#9ca3af", cursor: "pointer", fontWeight: 500 }}
          >{liveMode ? "live" : "demo"}</button>
          {["7d","30d"].map(r => (
            <button key={r} onClick={() => setRange(r)} style={{ fontSize: 12, padding: "4px 14px", borderRadius: 8, border: "1px solid " + (range === r ? "#d1d5db" : "#e5e7eb"), background: range === r ? "#f3f4f6" : "transparent", fontWeight: range === r ? 600 : 400, color: range === r ? "#111827" : "#6b7280", cursor: "pointer" }}>{r}</button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#991b1b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Could not reach API ({error}) - showing demo data</span>
          <button onClick={() => { setError(null); setLiveMode(true); }} style={{ fontSize: 12, color: "#991b1b", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>retry</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #e5e7eb", marginBottom: 20 }}>
        {[["overview","Overview"],["transactions","Transactions"],["sessions","Sessions"]].map(([k, label]) => (
          <button key={k} onClick={() => setView(k)} style={{ fontSize: 13, padding: "8px 16px", border: "none", background: "transparent", borderBottom: view === k ? "2px solid #635bff" : "2px solid transparent", color: view === k ? "#635bff" : "#6b7280", fontWeight: view === k ? 600 : 400, cursor: "pointer", marginBottom: -1 }}>{label}</button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <div>
          {view === "overview" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
                <MetricCard label="Checkout sessions" value={totalSessions.toLocaleString()} />
                <MetricCard label="Paid" value={totalPaid.toLocaleString()} highlight={true} />
                <MetricCard label="Conversion rate" value={convRate + "%"} sub={totalFailed + " failed, " + totalAbandoned + " abandoned"} />
                <MetricCard label="Revenue" value={"$" + totalRevenue.toFixed(2)} highlight={true} />
              </div>

              {allTimeRevenue !== null && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
                  <MetricCard label="All-time revenue" value={"$" + allTimeRevenue.toFixed(2)} highlight={true} />
                  <MetricCard label="All-time paid resumes" value={parseInt(apiData.totals?.totalPaid || 0).toLocaleString()} />
                  <MetricCard label="Email captures" value={emailCaptures.toLocaleString()} />
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 16, marginBottom: 20 }}>
                <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 20px" }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px" }}>Sessions by outcome</p>
                  <ResponsiveContainer width="100%" height={190}>
                    <BarChart data={dailyData} barGap={2} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                      <Tooltip content={CustomTooltip} />
                      <Bar dataKey="paid" name="Paid" stackId="a" fill="#16a34a" maxBarSize={22} />
                      <Bar dataKey="abandoned" name="Abandoned" stackId="a" fill="#fbbf24" maxBarSize={22} />
                      <Bar dataKey="failed" name="Failed" stackId="a" fill="#f87171" radius={[3,3,0,0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 12, color: "#6b7280" }}>
                    {LEGEND_COLORS.map(([c, l]) => (
                      <span key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: c, display: "inline-block" }} />{l}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 20px" }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>Breakdown</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                        {pieData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  {pieData.map(p => (
                    <div key={p.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: p.color, display: "inline-block" }} />
                        <span style={{ color: "#6b7280" }}>{p.name}</span>
                      </span>
                      <span style={{ fontWeight: 500 }}>
                        {p.value}{" "}
                        <span style={{ color: "#9ca3af", fontWeight: 400, fontSize: 12 }}>
                          ({totalSessions > 0 ? ((p.value / totalSessions) * 100).toFixed(0) : 0}%)
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 20px" }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px" }}>Daily revenue</p>
                <ResponsiveContainer width="100%" height={130}>
                  <LineChart data={dailyData} margin={{ top: 0, right: 4, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} tickFormatter={v => "$" + v.toFixed(0)} />
                    <Tooltip content={CustomTooltip} />
                    <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#635bff" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {view === "transactions" && (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>Recent transactions</p>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>Demo data</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["Customer","Time","Status","Card","Amount"].map(h => (
                      <th key={h} style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af", textAlign: h === "Amount" ? "right" : "left", padding: "4px 8px", borderBottom: "1px solid #f3f4f6", letterSpacing: "0.04em", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t, i) => (
                    <tr key={i} style={{ borderBottom: i < transactions.length - 1 ? "1px solid #f9fafb" : "none" }}>
                      <td style={{ padding: "9px 8px", fontWeight: 500 }}>{t.name}</td>
                      <td style={{ padding: "9px 8px", color: "#9ca3af" }}>{timeAgo(t.date)}</td>
                      <td style={{ padding: "9px 8px" }}><StatusBadge status={t.status} /></td>
                      <td style={{ padding: "9px 8px", color: "#6b7280", fontFamily: "monospace", fontSize: 12 }}>{t.last4 ? "xxxx " + t.last4 : "-"}</td>
                      <td style={{ padding: "9px 8px", textAlign: "right", fontWeight: t.amount > 0 ? 500 : 400, color: t.amount > 0 ? "#15803d" : "#9ca3af" }}>
                        {t.amount > 0 ? "$" + t.amount.toFixed(2) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 12, textAlign: "center" }}>Full history available in your Stripe dashboard</p>
            </div>
          )}

          {view === "sessions" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
                <MetricCard label="Checkout started" value={totalSessions.toLocaleString()} />
                <MetricCard label="Completed payment" value={totalPaid.toLocaleString()} highlight={true} />
                <MetricCard label="Avg daily sessions" value={Math.round(totalSessions / Math.max(dailyData.length, 1)).toLocaleString()} />
              </div>

              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px" }}>Sessions vs completions</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dailyData} barGap={4} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                    <Tooltip content={CustomTooltip} />
                    <Bar dataKey="sessions" name="Sessions" fill="#e0e7ff" radius={[3,3,0,0]} maxBarSize={22} />
                    <Bar dataKey="paid" name="Paid" fill="#635bff" radius={[3,3,0,0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 12, color: "#6b7280" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: "#e0e7ff", display: "inline-block" }} />Sessions
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: "#635bff", display: "inline-block" }} />Paid
                  </span>
                </div>
              </div>

              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 20px" }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 14px" }}>Drop-off breakdown</p>
                {[
                  { stage: "Checkout opened", count: totalSessions, pct: 100 },
                  { stage: "Payment entered", count: Math.round(totalSessions * 0.82), pct: 82 },
                  { stage: "Payment submitted", count: totalPaid + totalFailed, pct: totalSessions > 0 ? Math.round(((totalPaid + totalFailed) / totalSessions) * 100) : 0 },
                  { stage: "Payment succeeded", count: totalPaid, pct: totalSessions > 0 ? Math.round((totalPaid / totalSessions) * 100) : 0 },
                ].map((row, i) => (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span style={{ color: "#374151" }}>{row.stage}</span>
                      <span style={{ fontWeight: 500 }}>
                        {row.count.toLocaleString()}{" "}
                        <span style={{ color: "#9ca3af", fontWeight: 400, fontSize: 12 }}>({row.pct}%)</span>
                      </span>
                    </div>
                    <div style={{ background: "#f3f4f6", borderRadius: 3, height: 7 }}>
                      <div style={{ width: row.pct + "%", background: i === 3 ? "#635bff" : "#93c5fd", height: 7, borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", marginTop: 16 }}>
            {liveMode ? "Live - " + API_BASE : "Demo mode - click live to connect"}
          </p>
        </div>
      )}
    </div>
  );
}
