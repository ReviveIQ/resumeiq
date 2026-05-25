import { useState, useRef, useEffect } from "react";
import {
  Upload, FileText, Download, Sparkles, CheckCircle, ArrowRight,
  Loader2, CreditCard, Gift, User, LogOut, Clock, Eye, EyeOff,
  Pencil, Check, X, Plus, Trash2, ChevronDown, ChevronUp
} from "lucide-react";

type View = "upload" | "analyzing" | "interview" | "preview" | "done" | "history" | "login" | "register";

const INTERVIEW_QUESTIONS: { field: string; question: string; placeholder: string; required: boolean; multiline?: boolean }[] = [
  { field: "name",      question: "What's your full name?",                                          placeholder: "Bryan Michael Greer",              required: true },
  { field: "title",     question: "What's your current or most recent job title?",                   placeholder: "Enterprise Account Executive",     required: true },
  { field: "email",     question: "What's your email address?",                                      placeholder: "you@email.com",                    required: true },
  { field: "phone",     question: "What's your phone number?",                                       placeholder: "(561) 555-0100",                   required: false },
  { field: "location",  question: "What city and state are you based in?",                           placeholder: "Fort Lauderdale, FL",              required: true },
  { field: "summary",   question: "In 2–3 sentences, describe your professional background.",        placeholder: "Experienced sales leader with 10+ years...", required: true, multiline: true },
  { field: "skills",    question: "List your top skills, tools, or technologies (comma separated).", placeholder: "Salesforce, HubSpot, Outreach, Excel...", required: false },
  { field: "education", question: "Where did you go to school and what did you study?",              placeholder: "B.S. Marketing — Florida Atlantic University", required: false },
];

function getMissingFields(data: any): string[] {
  const missing: string[] = [];
  if (!data.name || data.name.length < 3 || data.name === "Resume") missing.push("name");
  if (!data.title) missing.push("title");
  if (!data.email) missing.push("email");
  if (!data.phone) missing.push("phone");
  if (!data.location) missing.push("location");
  if (!data.summary || data.summary.length < 40) missing.push("summary");
  if (!data.skills?.categories?.length) missing.push("skills");
  if (!data.education?.length) missing.push("education");
  return missing;
}

// ── Inline editable field ──────────────────────────────────────────────────
function EditField({ label, value, onSave, multiline = false }: { label: string; value: string; onSave: (v: string) => void; multiline?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => { onSave(draft); setEditing(false); };
  const cancel = () => { setDraft(value); setEditing(false); };

  const inputStyle: any = {
    width: "100%", background: "rgba(255,255,255,0.08)", border: "1px solid #3b82f6",
    borderRadius: "6px", color: "white", fontSize: "13px", padding: "6px 10px",
    outline: "none", fontFamily: "Arial,sans-serif", resize: multiline ? "vertical" : "none",
    boxSizing: "border-box" as const
  };

  return (
    <div style={{ marginBottom: "10px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "3px" }}>
        <span style={{ color: "#64748b", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
        {!editing && (
          <button onClick={() => { setDraft(value); setEditing(true); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: "2px", display: "flex", alignItems: "center", gap: "3px" }}>
            <Pencil size={11} /><span style={{ fontSize: "11px" }}>Edit</span>
          </button>
        )}
      </div>
      {editing ? (
        <div>
          {multiline
            ? <textarea rows={3} value={draft} onChange={e => setDraft(e.target.value)} style={inputStyle} />
            : <input value={draft} onChange={e => setDraft(e.target.value)} style={inputStyle} />
          }
          <div style={{ display: "flex", gap: "6px", marginTop: "5px" }}>
            <button onClick={commit} style={{ background: "#16a34a", border: "none", borderRadius: "5px", color: "white", fontSize: "11px", padding: "4px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: "3px" }}>
              <Check size={11} /> Save
            </button>
            <button onClick={cancel} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "5px", color: "#94a3b8", fontSize: "11px", padding: "4px 10px", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p style={{ color: value ? "white" : "#475569", fontSize: "13px", margin: 0, lineHeight: "1.5" }}>
          {value || <em style={{ color: "#475569" }}>Not provided</em>}
        </p>
      )}
    </div>
  );
}

// ── Collapsible section ────────────────────────────────────────────────────
function Section({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)", marginBottom: "10px", overflow: "hidden" }}>
      <button onClick={() => setOpen(!open)}
        style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: "#60a5fa", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{title}</span>
        {open ? <ChevronUp size={14} color="#64748b" /> : <ChevronDown size={14} color="#64748b" />}
      </button>
      {open && <div style={{ padding: "0 16px 14px" }}>{children}</div>}
    </div>
  );
}

// ── Experience entry editor ────────────────────────────────────────────────
function ExperienceEntry({ exp, idx, onChange, onDelete }: { exp: any; idx: number; onChange: (e: any) => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(idx === 0);
  const upd = (key: string, val: any) => onChange({ ...exp, [key]: val });

  const inputS: any = { width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "5px", color: "white", fontSize: "12px", padding: "5px 8px", outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", marginBottom: "8px", overflow: "hidden" }}>
      <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.03)", cursor: "pointer" }}
        onClick={() => setExpanded(!expanded)}>
        <div>
          <p style={{ color: "white", fontSize: "13px", fontWeight: 600, margin: 0 }}>{exp.title || "Untitled Role"}</p>
          <p style={{ color: "#64748b", fontSize: "11px", margin: 0 }}>{exp.company || "Company"} {exp.startDate ? `· ${exp.startDate} – ${exp.endDate || "Present"}` : ""}</p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button onClick={e => { e.stopPropagation(); onDelete(); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: "2px" }}>
            <Trash2 size={13} />
          </button>
          {expanded ? <ChevronUp size={14} color="#64748b" /> : <ChevronDown size={14} color="#64748b" />}
        </div>
      </div>
      {expanded && (
        <div style={{ padding: "12px", display: "grid", gap: "8px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <div><label style={{ color: "#64748b", fontSize: "11px", display: "block", marginBottom: "3px" }}>Job Title</label><input value={exp.title || ""} onChange={e => upd("title", e.target.value)} style={inputS} /></div>
            <div><label style={{ color: "#64748b", fontSize: "11px", display: "block", marginBottom: "3px" }}>Company</label><input value={exp.company || ""} onChange={e => upd("company", e.target.value)} style={inputS} /></div>
            <div><label style={{ color: "#64748b", fontSize: "11px", display: "block", marginBottom: "3px" }}>Start Date</label><input value={exp.startDate || ""} onChange={e => upd("startDate", e.target.value)} placeholder="MM/YYYY" style={inputS} /></div>
            <div><label style={{ color: "#64748b", fontSize: "11px", display: "block", marginBottom: "3px" }}>End Date</label><input value={exp.endDate || ""} onChange={e => upd("endDate", e.target.value)} placeholder="Present" style={inputS} /></div>
            <div style={{ gridColumn: "1 / -1" }}><label style={{ color: "#64748b", fontSize: "11px", display: "block", marginBottom: "3px" }}>Location</label><input value={exp.location || ""} onChange={e => upd("location", e.target.value)} style={inputS} /></div>
          </div>
          <div>
            <label style={{ color: "#64748b", fontSize: "11px", display: "block", marginBottom: "3px" }}>Company Description <span style={{ color: "#334155" }}>(1 sentence)</span></label>
            <input value={exp.description || ""} onChange={e => upd("description", e.target.value)} style={inputS} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "5px" }}>
              <label style={{ color: "#64748b", fontSize: "11px" }}>Bullets</label>
              <button onClick={() => upd("bullets", [...(exp.bullets || []), ""])}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#3b82f6", fontSize: "11px", display: "flex", alignItems: "center", gap: "3px" }}>
                <Plus size={11} /> Add bullet
              </button>
            </div>
            {(exp.bullets || []).map((b: string, bi: number) => (
              <div key={bi} style={{ display: "flex", gap: "5px", marginBottom: "5px" }}>
                <textarea value={b} onChange={e => { const nb = [...(exp.bullets||[])]; nb[bi] = e.target.value; upd("bullets", nb); }}
                  rows={2} style={{ ...inputS, flex: 1, resize: "vertical" }} />
                <button onClick={() => { const nb = (exp.bullets||[]).filter((_: any, i: number) => i !== bi); upd("bullets", nb); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", alignSelf: "flex-start", padding: "4px" }}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function ResumeIQ() {
  const [view, setView] = useState<View>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any>(null);
  const [sessionId, setSessionId] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [email, setEmail] = useState("");
  const [emailCaptured, setEmailCaptured] = useState(false);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState(() => localStorage.getItem("riq_token") || "");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  // Interview state
  const [interviewFields, setInterviewFields] = useState<string[]>([]);
  const [interviewStep, setInterviewStep] = useState(0);
  const [interviewAnswer, setInterviewAnswer] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const spin = { animation: "spin 1s linear infinite" };
  const S: any = { minHeight: "100vh", background: "linear-gradient(135deg,#0f172a,#1e3a5f,#0f172a)", fontFamily: "Arial,sans-serif" };

  useEffect(() => {
    if (token) {
      fetch("/api/resumeiq/auth/me", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(u => { if (u) setUser(u); else { setToken(""); localStorage.removeItem("riq_token"); } })
        .catch(() => {});
    }
  }, [token]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const stripeSessionId = params.get("session_id");

    if (payment === "success" && stripeSessionId) {
      // Restore session data saved before Stripe redirect
      const savedSession = localStorage.getItem("riq_pending_session");
      const savedData = localStorage.getItem("riq_pending_data");

      if (savedSession && savedData) {
        fetch("/api/resumeiq/verify-payment", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stripeSessionId, resumeiqSession: savedSession }),
        }).then(r => r.json()).then(d => {
          if (d.paid) {
            const restored = JSON.parse(savedData);
            setParsedData(restored);
            setSessionId(savedSession);
            setIsFree(true);
            // Clear saved state
            localStorage.removeItem("riq_pending_session");
            localStorage.removeItem("riq_pending_data");
            setView("preview");
          }
        });
      }
      window.history.replaceState({}, "", "/");
    }

    // Also check for pending session on load (in case user refreshed after payment)
    const pendingSession = localStorage.getItem("riq_pending_session");
    const pendingData = localStorage.getItem("riq_pending_data");
    if (pendingSession && pendingData && payment !== "success") {
      const restored = JSON.parse(pendingData);
      setParsedData(restored);
      setSessionId(pendingSession);
      setIsFree(true);
      setView("preview");
    }
  }, []);

  const loadHistory = async () => {
    if (!token) return;
    const res = await fetch("/api/resumeiq/history", { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setHistory(await res.json());
  };

  const handleFile = (f: File) => {
    if (!f.name.match(/\.(pdf|docx|doc)$/i)) { setError("Please upload a PDF or Word document"); return; }
    setFile(f); setError("");
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setView("analyzing"); setError("");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/resumeiq/transform", {
        method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ fileBase64: base64, fileName: file.name }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setParsedData(data); setSessionId(data.sessionId); setIsFree(data.isFree);

      // Check for missing fields — launch interview if needed
      const missing = getMissingFields(data);
      if (missing.length > 0) {
        setInterviewFields(missing);
        setInterviewStep(0);
        setInterviewAnswer("");
        setView("interview");
      } else {
        setView("preview");
      }
    } catch (err: any) { setError(err.message || "Failed to analyze"); setView("upload"); }
  };

  // ── Interview helpers ────────────────────────────────────────────────────
  const currentInterviewQ = INTERVIEW_QUESTIONS.find(q => q.field === interviewFields[interviewStep]);

  const handleInterviewNext = () => {
    if (!currentInterviewQ) return;
    const field = currentInterviewQ.field;
    const answer = interviewAnswer.trim();

    if (!answer && currentInterviewQ.required) return;

    const updated = { ...parsedData };
    if (field === "skills" && answer) {
      updated.skills = { categories: [{ name: "Skills", skills: answer.split(",").map(s => s.trim()).filter(Boolean) }] };
    } else if (field === "education" && answer) {
      updated.education = [{ degree: answer, school: "", location: "", year: "" }];
    } else if (field === "summary" && answer) {
      updated.summary = answer;
    } else if (answer) {
      updated[field] = answer;
    }
    setParsedData(updated);

    if (interviewStep + 1 < interviewFields.length) {
      setInterviewStep(interviewStep + 1);
      setInterviewAnswer("");
    } else {
      setView("preview");
    }
  };

  const handleInterviewSkip = () => {
    if (interviewStep + 1 < interviewFields.length) {
      setInterviewStep(interviewStep + 1);
      setInterviewAnswer("");
    } else {
      setView("preview");
    }
  };

  // ── Parsed data editors ──────────────────────────────────────────────────
  const updateField = (field: string, value: any) => setParsedData((p: any) => ({ ...p, [field]: value }));
  const updateExp = (idx: number, exp: any) => setParsedData((p: any) => {
    const exps = [...(p.experience || [])]; exps[idx] = exp; return { ...p, experience: exps };
  });
  const deleteExp = (idx: number) => setParsedData((p: any) => ({
    ...p, experience: (p.experience || []).filter((_: any, i: number) => i !== idx)
  }));
  const addExp = () => setParsedData((p: any) => ({
    ...p, experience: [{ title: "", company: "", location: "", startDate: "", endDate: "Present", description: "", bullets: [""], achievements: [] }, ...(p.experience || [])]
  }));

  // ── Download ─────────────────────────────────────────────────────────────
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/resumeiq/generate", {
        method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ sessionId, parsedData }),
      });
      if (res.status === 402) { setError("Payment required"); return; }
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed to generate"); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${parsedData?.name?.replace(/\s+/g, "_") || "Resume"}_ResumeIQ.docx`;
      a.click(); URL.revokeObjectURL(url);
      // Only set cookie after confirmed successful download
      document.cookie = "resumeiq_free_used=1; max-age=31536000; path=/";
      setView("done");
    } catch (err: any) { setError(err.message); }
    finally { setDownloading(false); }
  };

  const handlePayAndDownload = async () => {
    const res = await fetch("/api/resumeiq/checkout", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    const data = await res.json();
    if (data.alreadyPaid) handleDownload();
    else if (data.url) {
      // Save session state before Stripe redirect so we can restore it on return
      localStorage.setItem("riq_pending_session", sessionId);
      localStorage.setItem("riq_pending_data", JSON.stringify(parsedData));
      window.location.href = data.url;
    }
  };

  const handleAuth = async (mode: "login" | "register") => {
    setAuthLoading(true); setError("");
    try {
      const res = await fetch(`/api/resumeiq/auth/${mode}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword, name: authName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Auth failed");
      setToken(data.token); localStorage.setItem("riq_token", data.token);
      setUser(data.user); setView("upload");
    } catch (err: any) { setError(err.message); }
    finally { setAuthLoading(false); }
  };

  const handleRedownload = async (resumeId: number) => {
    const res = await fetch(`/api/resumeiq/resume/${resumeId}/download`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { setError("Failed to download"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "ResumeIQ.docx"; a.click();
    URL.revokeObjectURL(url);
  };

  const logout = () => { setToken(""); setUser(null); localStorage.removeItem("riq_token"); setView("upload"); };
  const reset = () => { setView("upload"); setFile(null); setParsedData(null); setSessionId(""); setError(""); setIsFree(false); setEmailCaptured(false); setEmail(""); };

  return (
    <div style={S}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} input,textarea{color-scheme:dark;}`}</style>
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", padding: "6px 24px" }}>
        <div style={{ maxWidth: "960px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }} onClick={reset}>
            <img src="/logo-gem.jpg" alt="ReviveIQI" style={{ height: "120px", width: "120px", objectFit: "contain", flexShrink: 0, mixBlendMode: "lighten" }} />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0px" }}>
                <span style={{ color: "white", fontWeight: 800, fontSize: "36px", letterSpacing: "-0.02em" }}>ResumeIQ</span>
                <span style={{ color: "#60a5fa", fontWeight: 800, fontSize: "36px" }}>I</span>
              </div>
              <span style={{ color: "#64748b", fontSize: "14px", letterSpacing: "0.06em", fontWeight: 400 }}>by ReviveIQI</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {user ? (
              <>
                <button onClick={() => { loadHistory(); setView("history"); }} style={{ background: "transparent", color: "#94a3b8", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", fontSize: "12px" }}>
                  <Clock size={13} />My Resumes
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: "7px", background: "rgba(255,255,255,0.1)", borderRadius: "999px", padding: "5px 11px" }}>
                  <User size={13} color="#60a5fa" />
                  <span style={{ color: "white", fontSize: "12px" }}>{user.name || user.email}</span>
                </div>
                <button onClick={logout} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b" }}><LogOut size={15} /></button>
              </>
            ) : (
              <>
                <button onClick={() => setView("login")} style={{ background: "transparent", color: "#94a3b8", border: "none", cursor: "pointer", fontSize: "12px" }}>Sign In</button>
                <button onClick={() => setView("register")} style={{ background: "#2563eb", color: "white", border: "none", borderRadius: "7px", padding: "7px 14px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>Create Account</button>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: "999px", padding: "5px 12px" }}>
                  <Gift size={13} color="#4ade80" />
                  <span style={{ color: "#4ade80", fontSize: "12px", fontWeight: 600 }}>First resume FREE</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "32px 24px" }}>
        {(view === "login" || view === "register") && (
          <div style={{ maxWidth: "400px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "28px" }}>
              <h1 style={{ color: "white", fontSize: "26px", fontWeight: "bold", marginBottom: "6px" }}>
                {view === "login" ? "Welcome back" : "Create your account"}
              </h1>
              <p style={{ color: "#94a3b8", fontSize: "14px" }}>
                {view === "login" ? "Sign in to access your resume history" : "Save and re-download all your resumes"}
              </p>
            </div>
            <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "14px", padding: "28px", display: "flex", flexDirection: "column", gap: "14px" }}>
              {view === "register" && (
                <div>
                  <label style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "5px", display: "block" }}>Full Name</label>
                  <input type="text" value={authName} onChange={(e: any) => setAuthName(e.target.value)} placeholder="Bryan Greer"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "7px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "white", fontSize: "13px", outline: "none", boxSizing: "border-box" }} />
                </div>
              )}
              <div>
                <label style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "5px", display: "block" }}>Email</label>
                <input type="email" value={authEmail} onChange={(e: any) => setAuthEmail(e.target.value)} placeholder="you@email.com"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "7px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "white", fontSize: "13px", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ position: "relative" }}>
                <label style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "5px", display: "block" }}>Password</label>
                <input type={showPassword ? "text" : "password"} value={authPassword} onChange={(e: any) => setAuthPassword(e.target.value)} placeholder="••••••••"
                  style={{ width: "100%", padding: "10px 36px 10px 12px", borderRadius: "7px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "white", fontSize: "13px", outline: "none", boxSizing: "border-box" }} />
                <button onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: "10px", top: "30px", background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {error && <p style={{ color: "#f87171", fontSize: "12px", textAlign: "center" }}>{error}</p>}
              <button onClick={() => handleAuth(view as "login" | "register")} disabled={authLoading}
                style={{ background: "#2563eb", color: "white", border: "none", borderRadius: "9px", padding: "12px", fontSize: "15px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
                {authLoading ? <Loader2 size={16} style={spin} /> : null}
                {view === "login" ? "Sign In" : "Create Account"}
              </button>
              <p style={{ color: "#64748b", fontSize: "12px", textAlign: "center" }}>
                {view === "login" ? "Don't have an account? " : "Already have an account? "}
                <button onClick={() => { setView(view === "login" ? "register" : "login"); setError(""); }}
                  style={{ color: "#60a5fa", background: "none", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>
                  {view === "login" ? "Create one" : "Sign in"}
                </button>
              </p>
            </div>
          </div>
        )}
        {view === "upload" && (
          <div style={{ maxWidth: "600px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "28px" }}>
              <h1 style={{ color: "white", fontSize: "30px", fontWeight: "bold", marginBottom: "10px" }}>Transform Your Resume</h1>
              <p style={{ color: "#94a3b8", fontSize: "14px" }}>
                Upload any resume and get back a polished, ATS-optimized Word document.
                {!user && <> <strong style={{ color: "#4ade80" }}>Your first one is free.</strong></>}
              </p>
            </div>
            <div onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onDragOver={e => e.preventDefault()} onClick={() => fileInputRef.current?.click()}
              style={{ border: `2px dashed ${file ? "#3b82f6" : "rgba(255,255,255,0.2)"}`, borderRadius: "14px", padding: "44px", textAlign: "center", cursor: "pointer", background: file ? "rgba(59,130,246,0.1)" : "transparent", transition: "all 0.2s" }}>
              <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc" style={{ display: "none" }} onChange={(e: any) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              {file ? (
                <div><FileText size={44} color="#60a5fa" style={{ margin: "0 auto 10px" }} /><p style={{ color: "white", fontWeight: 600, fontSize: "16px", marginBottom: "3px" }}>{file.name}</p><p style={{ color: "#94a3b8", fontSize: "12px" }}>{(file.size / 1024).toFixed(0)} KB — Ready</p></div>
              ) : (
                <div><Upload size={44} color="#64748b" style={{ margin: "0 auto 10px" }} /><p style={{ color: "white", fontWeight: 600, fontSize: "15px", marginBottom: "3px" }}>Drop your resume here or click to browse</p><p style={{ color: "#64748b", fontSize: "12px" }}>PDF, DOCX, or DOC</p></div>
              )}
            </div>
            {error && <p style={{ color: "#f87171", textAlign: "center", marginTop: "10px", fontSize: "13px" }}>{error}</p>}
            {file && (
              <button onClick={handleAnalyze} style={{ marginTop: "16px", width: "100%", background: "#2563eb", color: "white", border: "none", borderRadius: "11px", padding: "14px", fontSize: "16px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
                <Sparkles size={18} /> Analyze My Resume
              </button>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginTop: "28px" }}>
              {[{ icon: "✦", t: "ATS Optimized", d: "Passes all tracking systems" }, { icon: "◈", t: "AI Enhanced", d: "Stronger bullets & metrics" }, { icon: "▣", t: "Saved Forever", d: "Re-download anytime" }].map(i => (
                <div key={i.t} style={{ background: "rgba(255,255,255,0.05)", borderRadius: "10px", padding: "14px", textAlign: "center" }}>
                  <div style={{ color: "#60a5fa", fontSize: "22px", marginBottom: "6px" }}>{i.icon}</div>
                  <p style={{ color: "white", fontWeight: 600, fontSize: "12px", marginBottom: "3px" }}>{i.t}</p>
                  <p style={{ color: "#64748b", fontSize: "11px" }}>{i.d}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {view === "analyzing" && (
          <div style={{ maxWidth: "440px", margin: "0 auto", textAlign: "center", padding: "70px 0" }}>
            <Loader2 size={56} color="#60a5fa" style={{ margin: "0 auto 20px", ...spin }} />
            <h2 style={{ color: "white", fontSize: "24px", fontWeight: "bold", marginBottom: "10px" }}>Analyzing Your Resume</h2>
            <p style={{ color: "#94a3b8", fontSize: "14px" }}>AI is extracting your experience, skills, and achievements...</p>
          </div>
        )}
        {view === "interview" && currentInterviewQ && (
          <div style={{ maxWidth: "520px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "32px" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: "999px", padding: "6px 16px", marginBottom: "20px" }}>
                <span style={{ color: "#60a5fa", fontSize: "12px", fontWeight: 600 }}>Question {interviewStep + 1} of {interviewFields.length}</span>
              </div>
              <div style={{ display: "flex", gap: "4px", justifyContent: "center", marginBottom: "24px" }}>
                {interviewFields.map((_, i) => (
                  <div key={i} style={{ height: "3px", width: "32px", borderRadius: "2px", background: i <= interviewStep ? "#3b82f6" : "rgba(255,255,255,0.1)", transition: "background 0.3s" }} />
                ))}
              </div>
              <h2 style={{ color: "white", fontSize: "22px", fontWeight: "bold", marginBottom: "8px" }}>{currentInterviewQ.question}</h2>
              <p style={{ color: "#64748b", fontSize: "13px" }}>
                {currentInterviewQ.required ? "Required" : "Optional — press Skip if not applicable"}
              </p>
            </div>
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "14px", padding: "24px" }}>
              {currentInterviewQ.multiline ? (
                <textarea rows={4} value={interviewAnswer} onChange={e => setInterviewAnswer(e.target.value)}
                  placeholder={currentInterviewQ.placeholder}
                  style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "8px", color: "white", fontSize: "14px", padding: "12px 14px", outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "Arial,sans-serif" }} />
              ) : (
                <input type="text" value={interviewAnswer} onChange={e => setInterviewAnswer(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleInterviewNext()}
                  placeholder={currentInterviewQ.placeholder}
                  style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "8px", color: "white", fontSize: "14px", padding: "12px 14px", outline: "none", boxSizing: "border-box" }} />
              )}
              <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                {!currentInterviewQ.required && (
                  <button onClick={handleInterviewSkip}
                    style={{ flex: 1, background: "rgba(255,255,255,0.08)", color: "#94a3b8", border: "none", borderRadius: "9px", padding: "12px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                    Skip
                  </button>
                )}
                <button onClick={handleInterviewNext}
                  disabled={currentInterviewQ.required && !interviewAnswer.trim()}
                  style={{ flex: 2, background: interviewAnswer.trim() ? "#2563eb" : "rgba(37,99,235,0.4)", color: "white", border: "none", borderRadius: "9px", padding: "12px", fontSize: "14px", fontWeight: 600, cursor: interviewAnswer.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
                  {interviewStep + 1 === interviewFields.length ? "See My Resume →" : "Next →"}
                </button>
              </div>
            </div>
          </div>
        )}
        {view === "preview" && parsedData && (
          <div style={{ maxWidth: "860px", margin: "0 auto" }}>
            {!isFree && (
              <div style={{
                position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
                pointerEvents: "none", zIndex: 10, overflow: "hidden",
              }}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} style={{
                    position: "absolute",
                    top: `${10 + i * 18}%`,
                    left: `${-10 + (i % 2) * 20}%`,
                    transform: "rotate(-35deg)",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "rgba(96, 165, 250, 0.07)",
                    whiteSpace: "nowrap",
                    letterSpacing: "0.15em",
                    userSelect: "none",
                    fontFamily: "Arial, sans-serif",
                    width: "140%",
                    textAlign: "center",
                  }}>
                    REVIVEIQ · RESUMEIQ · REVIVEIQ · RESUMEIQ · REVIVEIQ · RESUMEIQ · REVIVEIQ
                  </div>
                ))}
              </div>
            )}
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <CheckCircle size={40} color="#4ade80" style={{ margin: "0 auto 10px" }} />
              <h2 style={{ color: "white", fontSize: "22px", fontWeight: "bold", marginBottom: "6px" }}>Analysis Complete</h2>
              <p style={{ color: "#94a3b8", fontSize: "13px" }}>Review and edit your information below — every section is editable before you download.</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              <div>
                <Section title="Personal Info">
                  <EditField label="Full Name" value={parsedData.name || ""} onSave={v => updateField("name", v)} />
                  <EditField label="Job Title" value={parsedData.title || ""} onSave={v => updateField("title", v)} />
                  <EditField label="Location" value={parsedData.location || ""} onSave={v => updateField("location", v)} />
                  <EditField label="Email" value={parsedData.email || ""} onSave={v => updateField("email", v)} />
                  <EditField label="Phone" value={parsedData.phone || ""} onSave={v => updateField("phone", v)} />
                  <EditField label="LinkedIn" value={parsedData.linkedin || ""} onSave={v => updateField("linkedin", v)} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "4px" }}>
                    <div><span style={{ color: "#64748b", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Experience</span><p style={{ color: "white", fontSize: "13px", margin: "3px 0 0" }}>{parsedData.yearsOfExperience} years</p></div>
                    <div><span style={{ color: "#64748b", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Level</span><p style={{ color: "white", fontSize: "13px", margin: "3px 0 0", textTransform: "capitalize" }}>{parsedData.seniorityLevel}</p></div>
                  </div>
                </Section>

                <Section title="Professional Summary">
                  <EditField label="Summary" value={parsedData.summary || ""} onSave={v => updateField("summary", v)} multiline />
                </Section>

                <Section title="Career Highlights" defaultOpen={false}>
                  {(parsedData.topMetrics || []).map((m: string, i: number) => (
                    <div key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginBottom: "8px" }}>
                      <span style={{ color: "#3b82f6", fontSize: "16px", lineHeight: "1.3", flexShrink: 0 }}>▪</span>
                      <input value={m} onChange={e => { const ms = [...(parsedData.topMetrics || [])]; ms[i] = e.target.value; updateField("topMetrics", ms); }}
                        style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "5px", color: "white", fontSize: "12px", padding: "5px 8px", outline: "none" }} />
                      <button onClick={() => updateField("topMetrics", (parsedData.topMetrics || []).filter((_: any, j: number) => j !== i))}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: "4px" }}><X size={12} /></button>
                    </div>
                  ))}
                  <button onClick={() => updateField("topMetrics", [...(parsedData.topMetrics || []), ""])}
                    style={{ background: "none", border: "1px dashed rgba(255,255,255,0.15)", borderRadius: "5px", color: "#64748b", fontSize: "11px", padding: "5px 10px", cursor: "pointer", width: "100%", marginTop: "4px" }}>
                    + Add highlight
                  </button>
                </Section>

                <Section title="Skills" defaultOpen={false}>
                  {(parsedData.skills?.categories || []).map((cat: any, ci: number) => (
                    <div key={ci} style={{ marginBottom: "10px" }}>
                      <input value={cat.name} onChange={e => {
                        const cats = [...(parsedData.skills?.categories || [])];
                        cats[ci] = { ...cat, name: e.target.value };
                        updateField("skills", { categories: cats });
                      }} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "5px", color: "#60a5fa", fontSize: "12px", fontWeight: 600, padding: "4px 8px", outline: "none", marginBottom: "5px", boxSizing: "border-box" }} />
                      <input value={(cat.skills || []).join(", ")} onChange={e => {
                        const cats = [...(parsedData.skills?.categories || [])];
                        cats[ci] = { ...cat, skills: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) };
                        updateField("skills", { categories: cats });
                      }} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "5px", color: "white", fontSize: "12px", padding: "4px 8px", outline: "none", boxSizing: "border-box" }} />
                    </div>
                  ))}
                </Section>

                <Section title="Education" defaultOpen={false}>
                  {(parsedData.education || []).map((edu: any, i: number) => (
                    <div key={i} style={{ marginBottom: "10px", display: "grid", gap: "5px" }}>
                      {[["Degree", "degree"], ["School", "school"], ["Location", "location"], ["Year", "year"]].map(([lbl, key]) => (
                        <div key={key}>
                          <label style={{ color: "#64748b", fontSize: "10px", display: "block", marginBottom: "2px" }}>{lbl}</label>
                          <input value={edu[key] || ""} onChange={e => {
                            const eds = [...(parsedData.education || [])]; eds[i] = { ...edu, [key]: e.target.value };
                            updateField("education", eds);
                          }} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "5px", color: "white", fontSize: "12px", padding: "4px 8px", outline: "none", boxSizing: "border-box" }} />
                        </div>
                      ))}
                    </div>
                  ))}
                </Section>

                <Section title="Certifications" defaultOpen={false}>
                  {(parsedData.certifications || []).map((c: string, i: number) => (
                    <div key={i} style={{ display: "flex", gap: "6px", marginBottom: "5px" }}>
                      <input value={c} onChange={e => { const cs = [...(parsedData.certifications || [])]; cs[i] = e.target.value; updateField("certifications", cs); }}
                        style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "5px", color: "white", fontSize: "12px", padding: "4px 8px", outline: "none" }} />
                      <button onClick={() => updateField("certifications", (parsedData.certifications || []).filter((_: any, j: number) => j !== i))}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}><X size={12} /></button>
                    </div>
                  ))}
                  <button onClick={() => updateField("certifications", [...(parsedData.certifications || []), ""])}
                    style={{ background: "none", border: "1px dashed rgba(255,255,255,0.15)", borderRadius: "5px", color: "#64748b", fontSize: "11px", padding: "5px 10px", cursor: "pointer", width: "100%", marginTop: "4px" }}>
                    + Add certification
                  </button>
                </Section>
              </div>
              <div>
                <Section title={`Experience (${(parsedData.experience || []).length} roles)`}>
                  <button onClick={addExp}
                    style={{ background: "none", border: "1px dashed rgba(59,130,246,0.4)", borderRadius: "7px", color: "#60a5fa", fontSize: "11px", padding: "7px 12px", cursor: "pointer", width: "100%", marginBottom: "10px", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}>
                    <Plus size={12} /> Add Role
                  </button>
                  {(parsedData.experience || []).map((exp: any, i: number) => (
                    <ExperienceEntry key={i} exp={exp} idx={i} onChange={e => updateExp(i, e)} onDelete={() => deleteExp(i)} />
                  ))}
                </Section>
              </div>
            </div>
            {isFree && !user && !emailCaptured && (
              <div style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: "10px", padding: "16px", marginBottom: "10px" }}>
                <p style={{ color: "#4ade80", fontSize: "13px", fontWeight: 600, marginBottom: "10px" }}>🎉 Your first resume is free! Enter your email to download.</p>
                <div style={{ display: "flex", gap: "7px" }}>
                  <input type="email" placeholder="your@email.com" value={email} onChange={(e: any) => setEmail(e.target.value)}
                    style={{ flex: 1, padding: "9px 12px", borderRadius: "7px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)", color: "white", fontSize: "13px", outline: "none" }} />
                  <button onClick={async () => {
                    if (!email) return;
                    await fetch("/api/resumeiq/capture-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, name: parsedData?.name }) });
                    setEmailCaptured(true); handleDownload();
                  }} style={{ background: "#4ade80", color: "#0f172a", border: "none", borderRadius: "7px", padding: "9px 18px", fontWeight: 700, cursor: "pointer", fontSize: "13px", whiteSpace: "nowrap" }}>
                    Get My Resume →
                  </button>
                </div>
              </div>
            )}
            {isFree && user && (
              <div style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: "10px", padding: "12px 16px", marginBottom: "10px", textAlign: "center" }}>
                <p style={{ color: "#4ade80", fontSize: "13px", fontWeight: 600 }}>🎉 Free resume — download now and it'll be saved to your account!</p>
              </div>
            )}
            {!isFree && (
              <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "10px", padding: "12px 16px", marginBottom: "10px", textAlign: "center" }}>
                <p style={{ color: "#fbbf24", fontSize: "13px", fontWeight: 600 }}>Your free resume has been used. For <strong>$9.99</strong> you get 3 total resumes — re-downloadable anytime.</p>
              </div>
            )}
            {error && <p style={{ color: "#f87171", textAlign: "center", marginBottom: "10px", fontSize: "13px" }}>{error}</p>}
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={reset} style={{ flex: 1, background: "rgba(255,255,255,0.08)", color: "white", border: "none", borderRadius: "10px", padding: "14px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                Upload Different
              </button>
              {(isFree && (user || emailCaptured)) || !isFree ? (
                <button onClick={isFree ? handleDownload : handlePayAndDownload} disabled={downloading}
                  style={{ flex: 2, background: isFree ? "#16a34a" : "#2563eb", color: "white", border: "none", borderRadius: "10px", padding: "14px", fontSize: "15px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
                  {downloading ? <><Loader2 size={18} style={spin} />Generating...</> : isFree ? <><Download size={18} />Download Free Resume</> : <><CreditCard size={18} />Pay $9.99 & Download</>}
                </button>
              ) : null}
            </div>
            {!user && (
              <p style={{ color: "#64748b", fontSize: "12px", textAlign: "center", marginTop: "12px" }}>
                <button onClick={() => setView("register")} style={{ color: "#60a5fa", background: "none", border: "none", cursor: "pointer", fontSize: "12px" }}>Create a free account</button> to save your resumes and re-download anytime.
              </p>
            )}
          </div>
        )}
        {view === "done" && (
          <div style={{ maxWidth: "520px", margin: "0 auto", textAlign: "center", padding: "60px 0" }}>
            <div style={{ width: "72px", height: "72px", background: "rgba(74,222,128,0.15)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <CheckCircle size={36} color="#4ade80" />
            </div>
            <h2 style={{ color: "white", fontSize: "28px", fontWeight: "bold", marginBottom: "10px" }}>Your Resume is Ready!</h2>
            <p style={{ color: "#94a3b8", fontSize: "14px", marginBottom: "28px" }}>
              Your transformed resume has been downloaded.
              {user && " It's also saved to your account — re-download anytime from My Resumes."}
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button onClick={reset} style={{ background: "#2563eb", color: "white", border: "none", borderRadius: "10px", padding: "12px 28px", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}>
                Transform Another
              </button>
              {user && (
                <button onClick={() => { loadHistory(); setView("history"); }} style={{ background: "rgba(255,255,255,0.1)", color: "white", border: "none", borderRadius: "10px", padding: "12px 28px", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}>
                  My Resumes
                </button>
              )}
            </div>
          </div>
        )}
        {view === "history" && (
          <div>
            <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h1 style={{ color: "white", fontSize: "24px", fontWeight: "bold", marginBottom: "3px" }}>My Resumes</h1>
                <p style={{ color: "#94a3b8", fontSize: "13px" }}>All your transformed resumes — re-download anytime</p>
              </div>
              <button onClick={reset} style={{ background: "#2563eb", color: "white", border: "none", borderRadius: "9px", padding: "9px 18px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                + Transform New
              </button>
            </div>
            {history.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <Clock size={44} color="#334155" style={{ margin: "0 auto 14px" }} />
                <p style={{ color: "#94a3b8", fontSize: "15px" }}>No resumes yet</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {history.map((r: any) => (
                  <div key={r.id} style={{ background: "rgba(255,255,255,0.05)", borderRadius: "10px", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                      <div style={{ width: "40px", height: "40px", background: "rgba(59,130,246,0.15)", borderRadius: "9px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <FileText size={20} color="#60a5fa" />
                      </div>
                      <div>
                        <p style={{ color: "white", fontWeight: 600, fontSize: "14px", marginBottom: "3px" }}>{r.candidateName || "Resume"}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <p style={{ color: "#64748b", fontSize: "11px" }}>{r.originalFileName}</p>
                          <p style={{ color: "#64748b", fontSize: "11px" }}>·</p>
                          <p style={{ color: "#64748b", fontSize: "11px" }}>{new Date(r.createdAt).toLocaleDateString()}</p>
                          <span style={{ background: r.paid ? "rgba(74,222,128,0.15)" : "rgba(245,158,11,0.15)", color: r.paid ? "#4ade80" : "#fbbf24", fontSize: "10px", padding: "2px 7px", borderRadius: "999px", fontWeight: 600 }}>
                            {r.paid ? "✓ Paid" : "Free"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => handleRedownload(r.id)}
                      style={{ background: "#2563eb", color: "white", border: "none", borderRadius: "7px", padding: "8px 16px", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                      <Download size={13} /> Download
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
