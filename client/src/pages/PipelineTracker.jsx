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
    const d = new Date(now); d.setDate(d.getDate() - (days - 1 - i));
    const uploads = Math.round(rng() * 12 + 3);
    const paid = Math.round(uploads * (0.25 + rng() * 0.2));
    const pageViews = Math.round(uploads * (3 + rng() * 4));
    const checkoutStarts = Math.round(uploads * (0.4 + rng() * 0.2));
    return { date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), uploads, paid, pageViews, checkoutStarts, revenue: parseFloat((paid * 9.99).toFixed(2)) };
  });
}
function genFallbackResumes(n) {
  const rng = seededRng(77);
  const NAMES = ["Alex M.","Jordan T.","Sam R.","Casey L.","Morgan B.","Drew P.","Riley K.","Quinn S.","Avery N.","Taylor H.","Blake W.","Skyler J."];
  const TIERS = ["free","paid","unlimited"]; const STATUSES = ["generated","generated","generated","pending","failed"];
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const daysAgo = Math.floor(rng() * 30); const d = new Date(now); d.setDate(d.getDate() - daysAgo);
    const tier = TIERS[Math.floor(rng() * 3)]; const status = STATUSES[Math.floor(rng() * STATUSES.length)];
    return { name: NAMES[i % NAMES.length], date: d, tier, status, revenue: tier === "free" ? 0 : tier === "paid" ? 9.99 : 29 };
  }).sort((a, b) => b.date - a.date);
}
function genFallbackEvents() {
  return [
    { eventType: "page_view", count: 842, uniqueSessions: 312 },
    { eventType: "resume_uploaded", count: 156, uniqueSessions: 148 },
    { eventType: "checkout_started", count: 89, uniqueSessions: 87 },
    { eventType: "resume_generated", count: 71, uniqueSessions: 71 },
    { eventType: "account_created_done_screen", count: 34, uniqueSessions: 34 },
  ];
}
function genFallbackAttribution() {
  return [
    { source: "linkedin.com", medium: "organic", campaign: "", visits: 142 },
    { source: "google.com", medium: "organic", campaign: "", visits: 98 },
    { source: "direct", medium: "organic", campaign: "", visits: 87 },
    { source: "twitter.com", medium: "organic", campaign: "", visits: 43 },
    { source: "google.com", medium: "cpc", campaign: "brand", visits: 28 },
  ];
}

function mapApiToDaily(apiDaily, apiDailyEvents) {
  const eventsMap = {};
  (apiDailyEvents || []).forEach(r => { eventsMap[r.date] = r; });
  let cum = 0;
  return (apiDaily || []).map(row => {
    cum += parseFloat(row.revenue || 0);
    const date = new Date(row.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const ev = eventsMap[row.date] || {};
    return {
      date,
      uploads: parseInt(row.uploads || 0),
      paid: parseInt(row.paid || 0),
      revenue: parseFloat(row.revenue || 0),
      cumRevenue: parseFloat(cum.toFixed(2)),
      pageViews: parseInt(ev.pageViews || 0),
      checkoutStarts: parseInt(ev.checkoutStarts || 0),
      uniqueVisitors: parseInt(ev.uniqueVisitors || 0),
      accountsCreated: parseInt(ev.accountsCreated || 0),
    };
  });
}
function mapApiToResumes(apiResumes) {
  return (apiResumes || []).map(r => ({
    name: r.candidateName || "Unknown", date: new Date(r.createdAt),
    tier: r.paid ? "paid" : "free", status: r.paid ? "generated" : "pending", revenue: r.paid ? 9.99 : 0,
  }));
}
function withCumRevenue(data) {
  let running = 0;
  return data.map(r => { running += r.revenue; return { ...r, cumRevenue: parseFloat(running.toFixed(2)) }; });
}

function MetricCard({ label, value, sub }) {
  return (
    <div style={{ background: "#f8f9fa", borderRadius: 8, padding: "14px 16px" }}>
      <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 6px" }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 600, margin: 0, color: "#111827" }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: "#9ca3af", margin: "3px 0 0" }}>{sub}</p>}
    </div>
  );
}
function TierBadge({ tier }) {
  const s = { free: { background: "#dbeafe", color: "#1e40af" }, paid: { background: "#dcfce7", color: "#166534" }, unlimited: { background: "#ede9fe", color: "#5b21b6" } };
  return <span style={{ ...(s[tier] || s.free), fontSize: 11, padding: "2px 8px", borderRadius: 6, fontWeight: 500 }}>{tier}</span>;
}
function StatusDot({ status }) {
  const color = status === "generated" ? "#16a34a" : status === "pending" ? "#d97706" : "#dc2626";
  return <span style={{ color, fontWeight: 500, fontSize: 13 }}>{status}</span>;
}
function Spinner() {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#9ca3af", fontSize: 13 }}>Loading...</div>;
}
function Card({ title, children, style }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 20px", ...style }}>
      {title && <p style={{ fontSize: 12, fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px" }}>{title}</p>}
      {children}
    </div>
  );
}

export default function ResumeIQTracker() {
  const [range, setRange] = useState("7d");
  const [tab, setTab] = useState("overview");
  const [apiData, setApiData] = useState(null);
  const [resumeList, setResumeList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveMode, setLiveMode] = useState(true);

  useEffect(() => {
    if (!liveMode) { setLoading(false); return; }
    setLoading(true); setError(null);
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
  const rawDaily = liveMode && apiData ? mapApiToDaily(apiData.daily, apiData.dailyEvents) : genFallbackDaily(days);
  const chartData = withCumRevenue(rawDaily);
  const resumeRows = liveMode && resumeList ? mapApiToResumes(resumeList) : genFallbackResumes(12);
  const events = liveMode && apiData ? (apiData.events || []) : genFallbackEvents();
  const attribution = liveMode && apiData ? (apiData.attribution || []) : genFallbackAttribution();
  const totalVisitors = liveMode && apiData ? parseInt(apiData.totalVisitors || 0) : 1247;

  const uploads = chartData.reduce((a, r) => a + r.uploads, 0);
  const paid = chartData.reduce((a, r) => a + r.paid, 0);
  const revenue = chartData.reduce((a, r) => a + r.revenue, 0);
  const pageViews = chartData.reduce((a, r) => a + r.pageViews, 0);
  const checkoutStarts = chartData.reduce((a, r) => a + r.checkoutStarts, 0);
  const cr = uploads > 0 ? ((paid / uploads) * 100).toFixed(1) : "0.0";
  const funnelMax = pageViews || 1;

  const TABS = [["overview","Overview"],["events","Events"],["attribution","Attribution"],["resumes","Resumes"]];

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 860, margin: "0 auto", padding: "24px 16px", color: "#111827" }}>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>ResumeIQ pipeline</p>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>Uploads, events, attribution, revenue</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => { setLiveMode(!liveMode); setApiData(null); setResumeList(null); }} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, border: "1px solid " + (liveMode ? "#bbf7d0" : "#e5e7eb"), background: liveMode ? "#f0fdf4" : "#f9fafb", color: liveMode ? "#15803d" : "#9ca3af", cursor: "pointer", fontWeight: 500 }}>{liveMode ? "live" : "demo"}</button>
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
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{ fontSize: 13, padding: "8px 16px", border: "none", background: "transparent", borderBottom: tab === k ? "2px solid #2563eb" : "2px solid transparent", color: tab === k ? "#2563eb" : "#6b7280", fontWeight: tab === k ? 600 : 400, cursor: "pointer", marginBottom: -1 }}>{label}</button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <div>

          {tab === "overview" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
                <MetricCard label="Page views" value={pageViews.toLocaleString()} sub={"Unique visitors: " + totalVisitors.toLocaleString()} />
                <MetricCard label="Uploads" value={uploads.toLocaleString()} sub={"Checkout starts: " + checkoutStarts.toLocaleString()} />
                <MetricCard label="Conversion rate" value={cr + "%"} sub={paid + " paid of " + uploads + " uploads"} />
                <MetricCard label="Revenue" value={"$" + revenue.toLocaleString("en-US", { minimumFractionDigits: 2 })} sub={liveMode && apiData ? "All-time: $" + parseFloat(apiData.totals?.totalRevenue || 0).toFixed(2) : null} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, marginBottom: 20 }}>
                <Card title="Traffic and conversions">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={chartData} barGap={2} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
                      <Bar dataKey="pageViews" name="Page views" fill="#bfdbfe" radius={[3,3,0,0]} maxBarSize={16} />
                      <Bar dataKey="uploads" name="Uploads" fill="#378ADD" radius={[3,3,0,0]} maxBarSize={16} />
                      <Bar dataKey="paid" name="Paid" fill="#16a34a" radius={[3,3,0,0]} maxBarSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 12, color: "#6b7280" }}>
                    {[["#bfdbfe","Views"],["#378ADD","Uploads"],["#16a34a","Paid"]].map(([c,l]) => (
                      <span key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: c, display: "inline-block" }} />{l}</span>
                    ))}
                  </div>
                </Card>

                <Card title="Conversion funnel">
                  {[
                    { label: "Page views", count: pageViews, color: "#bfdbfe" },
                    { label: "Uploads", count: uploads, color: "#378ADD" },
                    { label: "Checkout starts", count: checkoutStarts, color: "#f59e0b" },
                    { label: "Paid", count: paid, color: "#16a34a" },
                  ].map((step, i) => (
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
                </Card>
              </div>

              <Card title="Cumulative revenue" style={{ marginBottom: 20 }}>
                <ResponsiveContainer width="100%" height={130}>
                  <LineChart data={chartData} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} tickFormatter={v => "$" + v.toFixed(0)} />
                    <Tooltip formatter={v => ["$" + v.toFixed(2), "Revenue"]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
                    <Line type="monotone" dataKey="cumRevenue" stroke="#16a34a" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>
          )}

          {tab === "events" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
                {events.slice(0, 4).map((e, i) => (
                  <MetricCard key={i} label={e.eventType.replace(/_/g, " ")} value={parseInt(e.count).toLocaleString()} sub={parseInt(e.uniqueSessions).toLocaleString() + " unique sessions"} />
                ))}
              </div>

              <Card title="Daily events" style={{ marginBottom: 20 }}>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} barGap={2} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
                    <Bar dataKey="pageViews" name="Page views" fill="#bfdbfe" stackId="a" maxBarSize={24} />
                    <Bar dataKey="uploads" name="Uploads" fill="#378ADD" stackId="a" maxBarSize={24} />
                    <Bar dataKey="checkoutStarts" name="Checkout starts" fill="#f59e0b" stackId="a" maxBarSize={24} />
                    <Bar dataKey="paid" name="Paid" fill="#16a34a" stackId="a" radius={[3,3,0,0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card title="All events">
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {["Event","Count","Unique Sessions","% of Views"].map(h => (
                        <th key={h} style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af", textAlign: h === "Count" || h === "Unique Sessions" || h === "% of Views" ? "right" : "left", padding: "4px 8px", borderBottom: "1px solid #f3f4f6", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((e, i) => {
                      const totalViews = events.find(x => x.eventType === "page_view")?.count || 1;
                      return (
                        <tr key={i}>
                          <td style={{ padding: "9px 8px", fontFamily: "monospace", fontSize: 12, color: "#374151" }}>{e.eventType}</td>
                          <td style={{ padding: "9px 8px", textAlign: "right", fontWeight: 500 }}>{parseInt(e.count).toLocaleString()}</td>
                          <td style={{ padding: "9px 8px", textAlign: "right", color: "#6b7280" }}>{parseInt(e.uniqueSessions).toLocaleString()}</td>
                          <td style={{ padding: "9px 8px", textAlign: "right", color: "#6b7280" }}>{((parseInt(e.count) / parseInt(totalViews)) * 100).toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            </div>
          )}

          {tab === "attribution" && (
            <div>
              <Card title="Traffic sources" style={{ marginBottom: 20 }}>
                {attribution.map((a, i) => {
                  const maxVisits = attribution[0]?.visits || 1;
                  return (
                    <div key={i} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontWeight: 500 }}>{a.source}</span>
                          <span style={{ fontSize: 11, background: "#f3f4f6", color: "#6b7280", padding: "1px 6px", borderRadius: 4 }}>{a.medium}</span>
                          {a.campaign && <span style={{ fontSize: 11, background: "#ede9fe", color: "#5b21b6", padding: "1px 6px", borderRadius: 4 }}>{a.campaign}</span>}
                        </span>
                        <span style={{ fontWeight: 500 }}>{parseInt(a.visits).toLocaleString()}</span>
                      </div>
                      <div style={{ background: "#f3f4f6", borderRadius: 3, height: 6 }}>
                        <div style={{ width: Math.round((parseInt(a.visits) / parseInt(maxVisits)) * 100) + "%", background: "#378ADD", height: 6, borderRadius: 3 }} />
                      </div>
                    </div>
                  );
                })}
                {attribution.length === 0 && <p style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", margin: "20px 0" }}>No attribution data yet — UTM params will appear here once visitors arrive via tracked links.</p>}
              </Card>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <Card title="Source breakdown">
                  {Object.entries(attribution.reduce((acc, a) => { acc[a.source] = (acc[a.source] || 0) + parseInt(a.visits); return acc; }, {}))
                    .sort(([,a],[,b]) => b - a)
                    .map(([source, visits], i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "1px solid #f9fafb" }}>
                        <span style={{ color: "#374151" }}>{source}</span>
                        <span style={{ fontWeight: 500 }}>{visits.toLocaleString()}</span>
                      </div>
                    ))}
                </Card>
                <Card title="Medium breakdown">
                  {Object.entries(attribution.reduce((acc, a) => { acc[a.medium] = (acc[a.medium] || 0) + parseInt(a.visits); return acc; }, {}))
                    .sort(([,a],[,b]) => b - a)
                    .map(([medium, visits], i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "1px solid #f9fafb" }}>
                        <span style={{ color: "#374151" }}>{medium}</span>
                        <span style={{ fontWeight: 500 }}>{visits.toLocaleString()}</span>
                      </div>
                    ))}
                </Card>
              </div>
            </div>
          )}

          {tab === "resumes" && (
            <Card title="Recent resumes">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["User","Date","Tier","Status","Revenue"].map(h => (
                      <th key={h} style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af", textAlign: h === "Revenue" ? "right" : "left", padding: "4px 8px", borderBottom: "1px solid #f3f4f6", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resumeRows.slice(0, 12).map((r, i) => (
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
            </Card>
          )}

          <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", marginTop: 16 }}>
            {liveMode ? "Live - " + API_BASE : "Demo mode - click live to connect"}
          </p>
        </div>
      )}
    </div>
  );
}
