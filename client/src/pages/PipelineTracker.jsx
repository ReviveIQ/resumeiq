import { useState, useEffect } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const API_BASE = "https://resumeiq-production-d97e.up.railway.app";

function seededRng(seed) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

function genFallbackDaily(days) {
  const rng = seededRng(42);
  const now = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (days - 1 - i));
    const uploads = Math.round(rng() * 12 + 3);
    const paid = Math.round(uploads * (0.25 + rng() * 0.2));
    return {
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      uploads,
      paid,
      revenue: parseFloat((paid * 9.99).toFixed(2)),
    };
  });
}

function genFallbackResumes(n) {
  const rng = seededRng(77);
  const NAMES = ["Alex M.","Jordan T.","Sam R.","Casey L.","Morgan B.","Drew P.","Riley K.","Quinn S.","Avery N.","Taylor H.","Blake W.","Skyler J."];
  const TIERS = ["free","paid","unlimited"];
  const STATUSES = ["generated","generated","generated","pending","failed"];
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const daysAgo = Math.floor(rng() * 30);
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    const tier = TIERS[Math.floor(rng() * 3)];
    const status = STATUSES[Math.floor(rng() * STATUSES.length)];
    return { name: NAMES[i % NAMES.length], date: d, tier, status, revenue: tier === "free" ? 0 : tier === "paid" ? 9.99 : 29 };
  }).sort((a, b) => b.date - a.date);
}

function mapApiToDaily(apiDaily) {
  let cum = 0;
  return (apiDaily || []).map(row => {
    cum += parseFloat(row.revenue || 0);
    return {
      date: new Date(row.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      uploads: parseInt(row.uploads || 0),
      paid: parseInt(row.paid || 0),
      revenue: parseFloat(row.revenue || 0),
      cumRevenue: parseFloat(cum.toFixed(2)),
    };
  });
}

function mapApiToResumes(apiResumes) {
  return (apiResumes || []).map(r => ({
    name: r.candidateName || "Unknown",
    date: new Date(r.createdAt),
    tier: r.paid ? "paid" : "free",
    status: r.paid ? "generated" : "pending",
    revenue: r.paid ? 9.99 : 0,
  }));
}

function withCumRevenue(data) {
  let running = 0;
  return data.map(r => { running += r.revenue; return { ...r, cumRevenue: parseFloat(running.toFixed(2)) }; });
}

function MetricCard({ label, value }) {
  return (
    <div style={{ background: "#f8f9fa", borderRadius: 8, padding: "14px 16px" }}>
      <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 6px" }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 600, margin: 0, color: "#111827" }}>{value}</p>
    </div>
  );
}

function TierBadge({ tier }) {
  const s = {
    free: { background: "#dbeafe", color: "#1e40af" },
    paid: { background: "#dcfce7", color: "#166534" },
    unlimited: { background: "#ede9fe", color: "#5b21b6" },
  };
  return <span style={{ ...(s[tier] || s.free), fontSize: 11, padding: "2px 8px", borderRadius: 6, fontWeight: 500 }}>{tier}</span>;
}

function StatusDot({ status }) {
  const color = status === "generated" ? "#16a34a" : status === "pending" ? "#d97706" : "#dc2626";
  return <span style={{ color, fontWeight: 500, fontSize: 13 }}>{status}</span>;
}

function Spinner() {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#9ca3af", fontSize: 13 }}>Loading...</div>;
}

export default function ResumeIQTracker() {
  const [range, setRange] = useState("7d");
  const [apiData, setApiData] = useState(null);
  const [resumeList, setResumeList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveMode, setLiveMode] = useState(true);

  useEffect(() => {
    if (!liveMode) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    const token = typeof window !== "undefined" ? localStorage.getItem("riq_token") : null;
    const headers = token ? { Authorization: "Bearer " + token } : {};
    Promise.all([
      fetch(API_BASE + "/api/resumeiq/analytics?range=" + range, { headers }).then(r => { if (!r.ok) throw new Error("Analytics " + r.status); return r.json(); }),
      fetch(API_BASE + "/api/resumeiq/history", { headers }).then(r => { if (!r.ok) throw new Error("History " + r.status); return r.json(); }),
    ])
      .then(([analytics, history]) => { setApiData(analytics); setResumeList(history); setLoading(false); })
      .catch(err => { setError(err.message); setLiveMode(false); setLoading(false); });
  }, [range, liveMode]);

  const days = range === "7d" ? 7 : 30;
  const rawDaily = liveMode && apiData ? mapApiToDaily(apiData.daily) : genFallbackDaily(days);
  const chartData = withCumRevenue(rawDaily);
  const resumeRows = liveMode && resumeList ? mapApiToResumes(resumeList) : genFallbackResumes(12);

  const uploads = chartData.reduce((a, r) => a + r.uploads, 0);
  const paid = chartData.reduce((a, r) => a + r.paid, 0);
  const revenue = chartData.reduce((a, r) => a + r.revenue, 0);
  const cr = uploads > 0 ? ((paid / uploads) * 100).toFixed(1) : "0.0";
  const funnelMax = uploads || 1;

  const funnelSteps = [
    { label: "Uploaded", count: uploads, color: "#378ADD" },
    { label: "Reached preview", count: Math.round(uploads * 0.82), color: "#378ADD" },
    { label: "Checkout started", count: liveMode && apiData ? parseInt(apiData.funnel?.sessionsCreated || 0) : Math.round(uploads * 0.45), color: "#378ADD" },
    { label: "Paid", count: paid, color: "#16a34a" },
    { label: "Downloaded", count: Math.round(paid * 0.92), color: "#16a34a" },
  ];

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 820, margin: "0 auto", padding: "24px 16px", color: "#111827" }}>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>ResumeIQ pipeline</p>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>Uploads to conversions to revenue</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={() => { setLiveMode(!liveMode); setApiData(null); setResumeList(null); }}
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

      {loading ? <Spinner /> : (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
            <MetricCard label="Uploads" value={uploads.toLocaleString()} />
            <MetricCard label="Paid conversions" value={paid.toLocaleString()} />
            <MetricCard label="Conversion rate" value={cr + "%"} />
            <MetricCard label="Revenue" value={"$" + revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, marginBottom: 20 }}>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 20px" }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px" }}>Uploads and conversions</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} barGap={2} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
                  <Bar dataKey="uploads" name="Uploads" fill="#378ADD" radius={[3,3,0,0]} maxBarSize={20} />
                  <Bar dataKey="paid" name="Paid" fill="#16a34a" radius={[3,3,0,0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 12, color: "#6b7280" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: "#378ADD", display: "inline-block" }} />Uploads
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: "#16a34a", display: "inline-block" }} />Paid
                </span>
              </div>
            </div>

            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 20px" }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px" }}>Conversion funnel</p>
              {funnelSteps.map((step, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
                    <span>{step.label}</span>
                    <span style={{ fontWeight: 500, color: "#111827" }}>{step.count.toLocaleString()}</span>
                  </div>
                  <div style={{ background: "#f3f4f6", borderRadius: 3, height: 7 }}>
                    <div style={{ width: Math.round((step.count / funnelMax) * 100) + "%", background: step.color, height: 7, borderRadius: 3, transition: "width 0.4s ease" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px" }}>Cumulative revenue</p>
            <ResponsiveContainer width="100%" height={130}>
              <LineChart data={chartData} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} tickFormatter={v => "$" + v.toFixed(0)} />
                <Tooltip formatter={v => ["$" + v.toFixed(2), "Revenue"]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
                <Line type="monotone" dataKey="cumRevenue" stroke="#16a34a" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 20px" }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px" }}>Recent resumes</p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["User","Date","Tier","Status","Revenue"].map(h => (
                    <th key={h} style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af", textAlign: h === "Revenue" ? "right" : "left", padding: "4px 8px", borderBottom: "1px solid #f3f4f6", letterSpacing: "0.04em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resumeRows.slice(0, 8).map((r, i) => (
                  <tr key={i}>
                    <td style={{ padding: "9px 8px", fontWeight: 500 }}>{r.name}</td>
                    <td style={{ padding: "9px 8px", color: "#6b7280" }}>{r.date instanceof Date ? r.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : r.date}</td>
                    <td style={{ padding: "9px 8px" }}><TierBadge tier={r.tier} /></td>
                    <td style={{ padding: "9px 8px" }}><StatusDot status={r.status} /></td>
                    <td style={{ padding: "9px 8px", textAlign: "right" }}>{r.revenue > 0 ? "$" + r.revenue.toFixed(2) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", marginTop: 16 }}>
            {liveMode ? "Live - " + API_BASE : "Demo mode - click live to connect"}
          </p>
        </div>
      )}
    </div>
  );
}
