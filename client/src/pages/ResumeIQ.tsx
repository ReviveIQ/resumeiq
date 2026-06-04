import { useState, useRef, useEffect } from "react";
import {
  Upload, FileText, Download, Sparkles, CheckCircle, ArrowRight,
  Loader2, CreditCard, Gift, User, LogOut, Clock, Eye, EyeOff,
  Pencil, Check, X, Plus, Trash2, ChevronDown, ChevronUp
} from "lucide-react";

import { trackEvent, captureEmail as captureMarketingEmail } from "../tracking";

type View = "upload" | "analyzing" | "interview" | "preview" | "checkout" | "done" | "history" | "login" | "register";

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

const ASSESSMENT_TYPES = [
  { id: "disc",  label: "DISC",            hint: "Dominance, Influence, Steadiness, Compliance" },
  { id: "mbti",  label: "Myers-Briggs",    hint: "ISTJ, ENFP, etc." },
  { id: "pi",    label: "Predictive Index", hint: "Strategist, Maverick, etc." },
  { id: "tki",   label: "Thomas-Kilmann",  hint: "Conflict style profile" },
  { id: "360",   label: "360 Feedback",    hint: "Multi-rater assessment" },
  { id: "other", label: "Other",           hint: "Any other assessment" },
];

// ── Delete Account Button ─────────────────────────────────────────────────
function DeleteAccountButton({ onDeleted }: { onDeleted: () => void }) {
  const [step, setStep] = useState<"idle" | "confirm" | "deleting">("idle");

  const handleDelete = async () => {
    setStep("deleting");
    try {
      const token = localStorage.getItem("riq_token");
      const res = await fetch("/api/resumeiq/account", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        onDeleted();
      } else {
        alert("Deletion failed — please email bryan@reviveiqi.com");
        setStep("idle");
      }
    } catch {
      alert("Deletion failed — please email bryan@reviveiqi.com");
      setStep("idle");
    }
  };

  if (step === "confirm") return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
      <span style={{ color: "#f87171", fontSize: "12px" }}>Are you sure?</span>
      <button onClick={handleDelete} style={{ background: "#ef4444", color: "white", border: "none", borderRadius: "6px", padding: "7px 14px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
        Yes, delete everything
      </button>
      <button onClick={() => setStep("idle")} style={{ background: "transparent", color: "#64748b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "7px 14px", fontSize: "12px", cursor: "pointer" }}>
        Cancel
      </button>
    </div>
  );

  if (step === "deleting") return (
    <span style={{ color: "#64748b", fontSize: "12px" }}>Deleting…</span>
  );

  return (
    <button onClick={() => setStep("confirm")} style={{ background: "transparent", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "7px", padding: "8px 16px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
      Delete Account
    </button>
  );
}

export default function ResumeIQ() {
  const [view, setView] = useState<View>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any>(null);
  const [sessionId, setSessionId] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [email, setEmail] = useState("");
  const [emailCaptured, setEmailCaptured] = useState(false);
  const [guestPassword, setGuestPassword] = useState("");
  const [guestPasswordConfirm, setGuestPasswordConfirm] = useState("");
  const [guestAccountError, setGuestAccountError] = useState("");
  const [showPaidGuestModal, setShowPaidGuestModal] = useState(false);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [personalityStep, setPersonalityStep] = useState(false);
  const [includePersonality, setIncludePersonality] = useState(false);
  const [includeCareerLaunch, setIncludeCareerLaunch] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState("");
  const [assessmentInput, setAssessmentInput] = useState("");
  const [personalityLoading, setPersonalityLoading] = useState(false);
  const [workingWithMe, setWorkingWithMe] = useState<any>(null);
  const [workingWithMeTeaser, setWorkingWithMeTeaser] = useState<any>(null);
  const [teaserFields, setTeaserFields] = useState<string[]>([]);
  const [assessmentFiles, setAssessmentFiles] = useState<{ id: string; label: string; fileName: string; fileBase64: string; textInput: string }[]>([]);
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState(() => localStorage.getItem("riq_token") || "");

  // Handle LinkedIn OAuth redirect and cross-app SSO handoff
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkedinToken = params.get("linkedin_token");
    const authError = params.get("auth_error");
    const handoffToken = params.get("handoff");

    if (handoffToken) {
      // Cross-app SSO from MyCareerIQ — exchange for a riq_token
      window.history.replaceState({}, "", window.location.pathname);
      fetch("/api/resumeiq/auth/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: handoffToken }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.token) {
            localStorage.setItem("riq_token", data.token);
            localStorage.setItem("riq_from_mycareeriq", "1");
            setToken(data.token);
            setUser(data.user);
            setView("upload");
          }
        })
        .catch(() => setView("upload")); // Fail gracefully — still show app
    } else if (linkedinToken) {
      localStorage.setItem("riq_token", linkedinToken);
      setToken(linkedinToken);
      // Store LinkedIn profile data for pre-populating resume fields
      const linkedinName = params.get("linkedin_name") || "";
      const linkedinEmail = params.get("linkedin_email") || "";
      if (linkedinName) localStorage.setItem("riq_linkedin_name", linkedinName);
      if (linkedinEmail) localStorage.setItem("riq_linkedin_email", linkedinEmail);
      window.history.replaceState({}, "", window.location.pathname);
      if (file) {
        setTimeout(() => handleAnalyzeWithToken(linkedinToken), 200);
      }
    } else if (authError) {
      const msgs: Record<string, string> = {
        linkedin_denied: "LinkedIn sign-in was cancelled",
        state_mismatch: "Security check failed — please try again",
        token_failed: "LinkedIn authentication failed",
        no_email: "LinkedIn account has no email — use email/password instead",
        server_error: "Server error — please try again",
      };
      setError(msgs[authError] || "Authentication failed");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);
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
      const savedToken = localStorage.getItem("riq_token");
      const savedWWM = localStorage.getItem("riq_pending_wwm");

      if (savedSession && savedData) {
        const restored = JSON.parse(savedData);
        const restoredWWM = savedWWM ? JSON.parse(savedWWM) : null;
        setParsedData(restored);
        setSessionId(savedSession);
        setIsFree(false);

        fetch("/api/resumeiq/verify-payment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(savedToken ? { Authorization: `Bearer ${savedToken}` } : {}),
          },
          body: JSON.stringify({
            stripeSessionId,
            resumeiqSession: savedSession,
            workingWithMe: restoredWWM,
          }),
        }).then(r => r.json()).then(async d => {
          if (d.paid) {
            localStorage.removeItem("riq_pending_session");
            localStorage.removeItem("riq_pending_data");
            localStorage.removeItem("riq_pending_wwm");

            // Merge workingWithMe into data if this was a personality or bundle purchase
            const finalData = (d.type === "personality" || d.type === "bundle") && restoredWWM
              ? { ...restored, workingWithMe: restoredWWM }
              : restored;

            setDownloading(true);
            try {
              const genRes = await fetch("/api/resumeiq/generate", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(savedToken ? { Authorization: `Bearer ${savedToken}` } : {}),
                },
                body: JSON.stringify({ sessionId: savedSession, parsedData: finalData }),
              });
              if (genRes.ok) {
                const blob = await genRes.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = `${finalData?.name?.replace(/\s+/g, "_") || "Resume"}_ResumeIQ.docx`;
                a.click(); URL.revokeObjectURL(url);
                setView("done");
              } else {
                setView("preview");
              }
            } catch {
              setView("preview");
            } finally {
              setDownloading(false);
            }
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
      setIsFree(false);
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

  const handleAnalyzeWithToken = async (authToken: string) => {
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
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ fileBase64: base64, fileName: file.name }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      // Pre-populate missing fields from LinkedIn OAuth data if available
      const linkedinName = localStorage.getItem("riq_linkedin_name") || "";
      const linkedinEmail = localStorage.getItem("riq_linkedin_email") || "";
      if (linkedinName && !data.name) data.name = linkedinName;
      if (linkedinEmail && !data.email) data.email = linkedinEmail;
      // Prompt for LinkedIn URL if signed in via LinkedIn but no URL in resume
      if (linkedinName && !data.linkedin) {
        data.linkedin = ""; // Will show empty field with placeholder prompting them to add it
        data._linkedinSignedIn = true; // flag for UI hint
      }
      setParsedData(data); trackEvent('resume_uploaded', { fileName: file.name, sessionId: data.sessionId });
      setSessionId(data.sessionId); setIsFree(data.isFree);
      const missing = getMissingFields(data);
      if (missing.length > 0) {
        setInterviewFields(missing); setInterviewStep(0); setInterviewAnswer(""); setView("interview");
      } else {
        setView("preview");
      }
    } catch (err: any) { setError(err.message || "Failed to analyze"); setView("upload"); }
  };

  const handleAnalyze = async () => {
    if (!file) return;

    // Require account before transformation
    if (!user) {
      setView("register");
      return;
    }

    await handleAnalyzeWithToken(token);
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

  // ── Assessment helpers ───────────────────────────────────────────────────
  const addAssessmentSlot = (id: string, label: string) =>
    setAssessmentFiles(prev => [...prev, { id, label, fileName: "", fileBase64: "", textInput: "" }]);
  const removeAssessmentSlot = (id: string) =>
    setAssessmentFiles(prev => prev.filter(a => a.id !== id));
  const updateAssessmentFile = (id: string, fileName: string, fileBase64: string) =>
    setAssessmentFiles(prev => prev.map(a => a.id === id ? { ...a, fileName, fileBase64 } : a));
  const updateAssessmentText = (id: string, textInput: string) =>
    setAssessmentFiles(prev => prev.map(a => a.id === id ? { ...a, textInput } : a));

  const FIELD_LABELS: Record<string, string> = {
    communicationStyle: "Communication Style",
    decisionMaking: "Decision Making",
    collaboration: "Collaboration",
    underPressure: "Under Pressure",
    motivation: "What Brings Out My Best",
  };

  // ── Download ─────────────────────────────────────────────────────────────
  const handlePersonalityGenerate = async () => {
    setPersonalityLoading(true);
    setError("");
    try {
      const assessments = assessmentFiles
        .filter(a => a.fileBase64 || a.textInput)
        .map(a => ({ label: a.label, fileBase64: a.fileBase64 || undefined, fileName: a.fileName || undefined, text: a.textInput || undefined }));

      const res = await fetch("/api/resumeiq/personality", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ assessments, parsedResumeData: parsedData }),
      });
      const data = await res.json();
      if (data.workingWithMe) {
        setWorkingWithMeTeaser(data.workingWithMe);
        setTeaserFields(data.teaserFields || ["communicationStyle", "decisionMaking"]);
        setPersonalityStep(false);
        // personalityTeaser view will show
      } else {
        setError(data.error || "Failed to generate Working With Me section");
      }
    } catch (err: any) { setError(err.message); }
    finally { setPersonalityLoading(false); }
  };

  const handlePersonalityUnlock = async () => {
    // Determine checkout type based on whether resume is already paid
    const resumeAlreadyPaid = isFree || (sessionId && await (async () => {
      try {
        const s = await fetch(`/api/resumeiq/session/${sessionId}`);
        return false; // session exists = not yet generated/paid via personality flow
      } catch { return false; }
    })());

    const type = (!isFree) ? "bundle" : "personality";
    const res = await fetch("/api/resumeiq/personality-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeiqSession: sessionId, type }),
    });
    const data = await res.json();
    if (data.url) {
      localStorage.setItem("riq_pending_session", sessionId);
      localStorage.setItem("riq_pending_data", JSON.stringify(parsedData));
      localStorage.setItem("riq_pending_wwm", JSON.stringify(workingWithMeTeaser));
      window.location.href = data.url;
    }
  };

  const handleDownload = async () => { await handleDownloadWithData(parsedData); };

  const handleDownloadWithData = async (data: any) => {
    setDownloading(true);
    try {
      const res = await fetch("/api/resumeiq/generate", {
        method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ sessionId, parsedData: data }),
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
      setView("done"); trackEvent('resume_generated', { sessionId });
    } catch (err: any) { setError(err.message); }
    finally { setDownloading(false); }
  };

  // ── Concierge Checkout Handler ─────────────────────────────────────────────
  // Called from the checkout view when user confirms their selections
  const handleFinalCheckout = async () => {
    // Save state before redirect
    localStorage.setItem("resumeiq_pending_session", sessionId);
    localStorage.setItem("resumeiq_pending_data", JSON.stringify(parsedData));
    if (workingWithMeTeaser) {
      localStorage.setItem("resumeiq_pending_wwm", JSON.stringify(workingWithMeTeaser));
    }

    // Determine checkout type based on selections
    let checkoutType: string;
    if (includeCareerLaunch) {
      checkoutType = "career";
    } else if (includePersonality) {
      checkoutType = isFree ? "bundle" : "personality";
    } else {
      checkoutType = "resume";
    }

    try {
      let res: Response;
      if (checkoutType === "career") {
        res = await fetch("/api/resumeiq/career-checkout", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resumeiqSession: sessionId }),
        });
      } else if (checkoutType === "personality" || checkoutType === "bundle") {
        res = await fetch("/api/resumeiq/personality-checkout", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resumeiqSession: sessionId, type: checkoutType }),
        });
      } else {
        res = await fetch("/api/resumeiq/checkout", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
      }
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error("Checkout error:", err);
    }
  };

  const proceedToCheckout = async () => {
    const res = await fetch("/api/resumeiq/checkout", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    const data = await res.json();
    if (data.alreadyPaid) handleDownload();
    else if (data.url) trackEvent('checkout_started', { sessionId }); {
      // Save session state before Stripe redirect so we can restore it on return
      localStorage.setItem("riq_pending_session", sessionId);
      localStorage.setItem("riq_pending_data", JSON.stringify(parsedData));
      window.location.href = data.url;
    }
  };

  const handlePayAndDownload = async () => {
    // Go to concierge checkout view — user chooses options before paying
    setView("checkout");
  };

  const _handlePayAndDownloadLegacy = async () => {
    // If not logged in, collect account first so the resume saves after payment
    if (!user) {
      setEmail("");
      setGuestPassword("");
      setGuestPasswordConfirm("");
      setGuestAccountError("");
      setShowPaidGuestModal(true);
      return;
    }
    await proceedToCheckout();
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
      setUser(data.user);
      // If they had a file ready, proceed straight to analysis
      if (file) {
        setView("analyzing");
        // slight delay so token/user state settles before the fetch fires
        setTimeout(() => handleAnalyzeWithToken(data.token), 100);
      } else {
        setView("upload");
      }
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
  const reset = () => { setView("upload"); setFile(null); setParsedData(null); setSessionId(""); setError(""); setIsFree(false); setEmailCaptured(false); setEmail(""); setShowPaidGuestModal(false); setGuestPassword(""); setGuestPasswordConfirm(""); setGuestAccountError(""); setAssessmentFiles([]); setPersonalityStep(false); setWorkingWithMeTeaser(null); setTeaserFields([]); };

  return (
    <div style={S}>
      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        input,textarea{color-scheme:dark;}
        @media (max-width: 640px) {
          .riq-preview-grid { grid-template-columns: 1fr !important; }
          .riq-features-grid { grid-template-columns: 1fr 1fr !important; }
          .riq-upload-pad { padding: 28px 16px 48px !important; }
          .riq-header { padding: 0 12px !important; }
        }
      `}</style>
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", padding: "6px 24px" }}>
        <div style={{ maxWidth: "960px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }} onClick={reset}>
            <svg viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "56px", height: "56px", flexShrink: 0 }}>
              <defs>
                <linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#60a5fa"/>
                  <stop offset="100%" stopColor="#2563eb"/>
                </linearGradient>
                <linearGradient id="lg2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#93c5fd"/>
                  <stop offset="100%" stopColor="#3b82f6"/>
                </linearGradient>
                <linearGradient id="lg3" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#1d4ed8"/>
                  <stop offset="100%" stopColor="#1e3a5f"/>
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="blur"/>
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              <polygon points="36,4 68,36 36,68 4,36" fill="url(#lg3)" opacity="0.35"/>
              <polygon points="36,4 20,20 36,36 52,20" fill="url(#lg2)" opacity="0.9"/>
              <polygon points="36,4 52,20 68,36 36,36" fill="url(#lg1)" opacity="0.65"/>
              <polygon points="4,36 20,20 36,36 20,52" fill="url(#lg1)" opacity="0.5"/>
              <polygon points="68,36 52,20 36,36 52,52" fill="url(#lg2)" opacity="0.75"/>
              <polygon points="36,68 20,52 36,36 52,52" fill="url(#lg3)" opacity="0.95"/>
              <circle cx="36" cy="36" r="10" fill="none" stroke="rgba(147,197,253,0.3)" strokeWidth="1"/>
              <circle cx="36" cy="36" r="6" fill="white" opacity="0.95" filter="url(#glow)"/>
              <circle cx="36" cy="36" r="3" fill="#93c5fd"/>
            </svg>
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
          <div style={{
            position: "fixed", inset: 0,
            display: "flex",
            fontFamily: "'DM Sans', sans-serif",
            background: "#080f1e",
            zIndex: 50,
          }}>
            {/* ── Left panel — product story ─────────────────────── */}
            <div style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "64px 56px",
              borderRight: "1px solid rgba(255,255,255,0.06)",
              position: "relative",
              overflow: "hidden",
            }}>
              {/* Background glows */}
              <div style={{ position: "absolute", top: "-120px", left: "-80px", width: "500px", height: "500px", background: "radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", bottom: "-80px", right: "-40px", width: "400px", height: "400px", background: "radial-gradient(circle, rgba(96,165,250,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />

              {/* Brand */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "56px" }}>
                <svg viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "40px", height: "40px" }}>
                  <defs>
                    <linearGradient id="riq-lg1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#60a5fa"/><stop offset="100%" stopColor="#2563eb"/></linearGradient>
                    <linearGradient id="riq-lg2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#93c5fd"/><stop offset="100%" stopColor="#3b82f6"/></linearGradient>
                    <linearGradient id="riq-lg3" x1="100%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#1d4ed8"/><stop offset="100%" stopColor="#1e3a5f"/></linearGradient>
                    <filter id="riq-glow"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                  </defs>
                  <polygon points="36,4 68,36 36,68 4,36" fill="url(#riq-lg3)" opacity="0.35"/>
                  <polygon points="36,4 20,20 36,36 52,20" fill="url(#riq-lg2)" opacity="0.9"/>
                  <polygon points="36,4 52,20 68,36 36,36" fill="url(#riq-lg1)" opacity="0.65"/>
                  <polygon points="4,36 20,20 36,36 20,52" fill="url(#riq-lg1)" opacity="0.5"/>
                  <polygon points="68,36 52,20 36,36 52,52" fill="url(#riq-lg2)" opacity="0.75"/>
                  <polygon points="36,68 20,52 36,36 52,52" fill="url(#riq-lg3)" opacity="0.95"/>
                  <circle cx="36" cy="36" r="10" fill="none" stroke="rgba(147,197,253,0.3)" strokeWidth="1"/>
                  <circle cx="36" cy="36" r="6" fill="white" opacity="0.95" filter="url(#riq-glow)"/>
                  <circle cx="36" cy="36" r="3" fill="#93c5fd"/>
                </svg>
                <div>
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: "22px", letterSpacing: "-0.5px", color: "white" }}>
                    Resume<span style={{ color: "#60a5fa" }}>IQ</span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#475569", letterSpacing: "0.5px", marginTop: "1px" }}>
                    BY REVIVEIQ<span style={{ color: "#60a5fa" }}>I</span>
                  </div>
                </div>
              </div>

              {/* Headline */}
              <div style={{ marginBottom: "48px" }}>
                <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: "32px", lineHeight: "1.15", color: "white", letterSpacing: "-0.5px", margin: 0 }}>
                  Your resume,<br />
                  rewritten to<br />
                  <span style={{ color: "#60a5fa" }}>get callbacks.</span>
                </h2>
              </div>

              {/* Steps */}
              <div style={{ display: "flex", flexDirection: "column", gap: "28px", position: "relative" }}>
                <div style={{ position: "absolute", left: "18px", top: "28px", bottom: "28px", width: "1px", background: "linear-gradient(to bottom, rgba(37,99,235,0.5), rgba(96,165,250,0.2), rgba(37,99,235,0.1))" }} />
                {[
                  { n: "01", accent: "#60a5fa", title: "Upload any resume", body: "PDF or DOCX. We parse every role, bullet, and date — nothing gets lost." },
                  { n: "02", accent: "#3b82f6", title: "AI transformations every bullet", body: "GPT-4o adds measurable impact, fixes ATS formatting, and strengthens your summary — without hallucinating facts." },
                  { n: "03", accent: "#2563eb", title: "Download and apply", body: "Clean Word document, ATS-safe. Then take it straight into MyCareerIQ to build your job search pipeline." },
                ].map(step => (
                  <div key={step.n} style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "radial-gradient(circle, rgba(37,99,235,0.3), rgba(8,15,30,0.9))", border: `1px solid ${step.accent}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, zIndex: 1 }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: step.accent, fontFamily: "'Montserrat',sans-serif" }}>{step.n}</span>
                    </div>
                    <div style={{ paddingTop: "6px" }}>
                      <div style={{ fontSize: "15px", fontWeight: 600, color: "white", marginBottom: "4px", lineHeight: "1.3" }}>{step.title}</div>
                      <div style={{ fontSize: "13px", color: "#94a3b8", lineHeight: "1.6", fontWeight: 300 }}>{step.body}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div style={{ marginTop: "48px", paddingTop: "24px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <p style={{ fontSize: "12px", color: "#334155", margin: 0 }}>
                  After your resume?{" "}
                  <a href="https://mycareeriq.reviveiqi.com" target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", textDecoration: "none" }}>
                    Build your job pipeline in MyCareerIQ →
                  </a>
                </p>
              </div>
            </div>

            {/* ── Right panel — auth form ─────────────────────────── */}
            <div style={{ width: "420px", flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: "64px 40px" }}>
              {/* Back button */}
              <button
                onClick={() => setView("upload")}
                style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px", marginBottom: "32px", padding: 0, fontFamily: "'DM Sans', sans-serif" }}
              >
                ← Back
              </button>

              <div style={{ marginBottom: "32px" }}>
                <h1 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: "24px", color: "white", margin: "0 0 6px 0", letterSpacing: "-0.3px" }}>
                  {view === "login" ? "Welcome back" : "Create your free account"}
                </h1>
                <p style={{ fontSize: "14px", color: "#64748b", margin: 0, fontWeight: 300 }}>
                  {view === "login"
                    ? "Sign in to transform your resume"
                    : "Your resume transformation is ready — create an account to get it"}
                </p>
              </div>

              {/* LinkedIn */}
              <button
                onClick={() => { window.location.href = "/api/resumeiq/auth/linkedin"; }}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", background: "#0077B5", color: "white", border: "none", borderRadius: "8px", padding: "11px 16px", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
              >
                <svg viewBox="0 0 24 24" style={{ width: "18px", height: "18px", fill: "white", flexShrink: 0 }}>
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                Continue with LinkedIn
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "20px 0" }}>
                <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
                <span style={{ fontSize: "12px", color: "#475569" }}>or email</span>
                <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {view === "register" && (
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 500, color: "#94a3b8", display: "block", marginBottom: "6px" }}>Full Name</label>
                    <input type="text" value={authName} onChange={(e: any) => setAuthName(e.target.value)} placeholder="Bryan Greer"
                      style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "white", fontSize: "14px", outline: "none", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif" }} />
                  </div>
                )}
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 500, color: "#94a3b8", display: "block", marginBottom: "6px" }}>Email</label>
                  <input type="email" value={authEmail} onChange={(e: any) => setAuthEmail(e.target.value)} placeholder="you@email.com"
                    style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "white", fontSize: "14px", outline: "none", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif" }} />
                </div>
                <div style={{ position: "relative" }}>
                  <label style={{ fontSize: "12px", fontWeight: 500, color: "#94a3b8", display: "block", marginBottom: "6px" }}>Password</label>
                  <input type={showPassword ? "text" : "password"} value={authPassword} onChange={(e: any) => setAuthPassword(e.target.value)} placeholder="••••••••"
                    style={{ width: "100%", padding: "10px 36px 10px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "white", fontSize: "14px", outline: "none", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif" }} />
                  <button onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: "10px", top: "30px", background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                {error && <p style={{ color: "#f87171", fontSize: "12px", textAlign: "center", margin: 0 }}>{error}</p>}

                <button onClick={() => handleAuth(view as "login" | "register")} disabled={authLoading}
                  style={{ width: "100%", padding: "11px 16px", background: authLoading ? "#1e3a5f" : "linear-gradient(135deg, #2563eb, #1d4ed8)", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: authLoading ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: authLoading ? "none" : "0 4px 20px rgba(37,99,235,0.35)", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
                  {authLoading ? <Loader2 size={16} style={spin} /> : null}
                  {view === "login" ? "Sign In" : "Create Account"}
                </button>
              </div>

              <p style={{ fontSize: "13px", color: "#475569", textAlign: "center", marginTop: "24px" }}>
                {view === "login" ? "Don't have an account? " : "Already have an account? "}
                <button onClick={() => { setView(view === "login" ? "register" : "login"); setError(""); }}
                  style={{ background: "none", border: "none", color: "#60a5fa", cursor: "pointer", fontSize: "13px", fontWeight: 500, padding: 0 }}>
                  {view === "login" ? "Create one" : "Sign in"}
                </button>
              </p>

              <p style={{ fontSize: "11px", color: "#334155", textAlign: "center", marginTop: "32px", lineHeight: "1.6" }}>
                By continuing you agree to ReviveIQI's{" "}
                <a href="/privacy" style={{ color: "#475569", textDecoration: "underline" }}>Privacy Policy</a>
                <span style={{ color: "#334155", margin: "0 6px" }}>·</span>
                <a href="/terms" style={{ color: "#475569", textDecoration: "underline" }}>Terms of Service</a>
              </p>
            </div>
          </div>
        )}
        {view === "upload" && (
          <div style={{ maxWidth: "600px", margin: "0 auto" }}>
            {/* SSO arrival banner — shown when coming from MyCareerIQ */}
            {user && new URLSearchParams(window.location.search).get("handoff") === null && localStorage.getItem("riq_from_mycareeriq") === "1" && (
              <div style={{ background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.4)", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "18px" }}>✓</span>
                <div>
                  <p style={{ color: "#93c5fd", fontSize: "13px", fontWeight: 600, margin: 0 }}>You're signed in as {user.email}</p>
                  <p style={{ color: "#60a5fa", fontSize: "12px", margin: "2px 0 0 0" }}>Your first transformation is free — upload your resume below.</p>
                </div>
              </div>
            )}

            <div style={{ textAlign: "center", marginBottom: "28px" }}>
              <h1 style={{ color: "white", fontSize: "30px", fontWeight: "bold", marginBottom: "10px" }}>Transform Your Resume</h1>
              <p style={{ color: "#94a3b8", fontSize: "14px" }}>
                Upload any resume and get back a polished, ATS-optimized Word document.
              </p>
              {/* Always show free messaging prominently */}
              <div style={{ marginTop: "10px", display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: "20px", padding: "5px 14px" }}>
                <span style={{ color: "#4ade80", fontSize: "13px" }}>✦</span>
                <span style={{ color: "#4ade80", fontSize: "13px", fontWeight: 600 }}>First transformation is free</span>
              </div>
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
            <div className="riq-features-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginTop: "28px" }}>
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
              {isFree && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: "8px", padding: "8px 14px", marginTop: "10px" }}>
                  <span style={{ fontSize: "14px" }}>✏️</span>
                  <p style={{ color: "#4ade80", fontSize: "12px", margin: 0 }}>
                    <strong>Make it yours before you download.</strong> Edit any field, bullet, or section — your free resume is fully editable. Get it exactly right, then download.
                  </p>
                </div>
              )}
            </div>

            <div className="riq-preview-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              <div>
                <Section title="Personal Info">
                  <EditField label="Full Name" value={parsedData.name || ""} onSave={v => updateField("name", v)} />
                  <EditField label="Job Title" value={parsedData.title || ""} onSave={v => updateField("title", v)} />
                  <EditField label="Location" value={parsedData.location || ""} onSave={v => updateField("location", v)} />
                  <EditField label="Email" value={parsedData.email || ""} onSave={v => updateField("email", v)} />
                  <EditField label="Phone" value={parsedData.phone || ""} onSave={v => updateField("phone", v)} />
                  <EditField label="LinkedIn" value={parsedData.linkedin || ""} onSave={v => updateField("linkedin", v)} />
                  {parsedData._linkedinSignedIn && !parsedData.linkedin && (
                    <p style={{ fontSize: "11px", color: "#60a5fa", margin: "2px 0 6px 0" }}>
                      💡 You signed in with LinkedIn — paste your profile URL above (linkedin.com/in/yourname)
                    </p>
                  )}
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
              <div style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.25)", borderRadius: "12px", padding: "20px", marginBottom: "10px" }}>
                <p style={{ color: "#4ade80", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>🎉 Your first resume is free!</p>
                <p style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "14px" }}>Create a free account to download — your resume will be saved so you can re-download anytime.</p>
                <div style={{ display: "grid", gap: "8px" }}>
                  <input type="email" placeholder="Email address" value={email} onChange={(e: any) => { setEmail(e.target.value); setGuestAccountError(""); }}
                    style={{ padding: "9px 12px", borderRadius: "7px", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.08)", color: "white", fontSize: "13px", outline: "none" }} />
                  <input type="password" placeholder="Create a password (6+ characters)" value={guestPassword} onChange={(e: any) => { setGuestPassword(e.target.value); setGuestAccountError(""); }}
                    style={{ padding: "9px 12px", borderRadius: "7px", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.08)", color: "white", fontSize: "13px", outline: "none" }} />
                  <input type="password" placeholder="Confirm password" value={guestPasswordConfirm} onChange={(e: any) => { setGuestPasswordConfirm(e.target.value); setGuestAccountError(""); }}
                    style={{ padding: "9px 12px", borderRadius: "7px", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.08)", color: "white", fontSize: "13px", outline: "none" }} />
                  {guestAccountError && <p style={{ color: "#f87171", fontSize: "12px", margin: 0 }}>{guestAccountError}</p>}
                  <button onClick={async () => {
                    setGuestAccountError("");
                    if (!email || !email.includes("@")) { setGuestAccountError("Enter a valid email."); return; }
                    if (!guestPassword || guestPassword.length < 6) { setGuestAccountError("Password must be at least 6 characters."); return; }
                    if (guestPassword !== guestPasswordConfirm) { setGuestAccountError("Passwords don't match."); return; }
                    try {
                      const res = await fetch("/api/resumeiq/auth/register", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email, password: guestPassword }),
                      });
                      const data = await res.json();
                      if (!res.ok) {
                        if (res.status === 409) {
                          // Already registered — try login
                          const loginRes = await fetch("/api/resumeiq/auth/login", {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ email, password: guestPassword }),
                          });
                          const loginData = await loginRes.json();
                          if (!loginRes.ok) { setGuestAccountError("That email is already registered — check your password."); return; }
                          setToken(loginData.token); localStorage.setItem("riq_token", loginData.token); setUser(loginData.user);
                        } else { setGuestAccountError(data.error || "Could not create account."); return; }
                      } else {
                        setToken(data.token); localStorage.setItem("riq_token", data.token); setUser(data.user);
                      }
                      setEmailCaptured(true); captureMarketingEmail(email, 'upload_gate');
                      
                      handleDownload();
                    } catch { setGuestAccountError("Network error — please try again."); }
                  }} style={{ background: "#4ade80", color: "#0f172a", border: "none", borderRadius: "7px", padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontSize: "13px" }}>
                    Create Account &amp; Download Free Resume →
                  </button>
                  <p style={{ color: "#475569", fontSize: "11px", textAlign: "center", margin: 0 }}>
                    Already have an account?{" "}
                    <button onClick={() => setView("login")} style={{ color: "#60a5fa", background: "none", border: "none", cursor: "pointer", fontSize: "11px", padding: 0 }}>Sign in</button>
                  </p>
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
                  {downloading ? <><Loader2 size={18} style={spin} />Generating...</> : isFree ? <><Download size={18} />Download Free Resume</> : <><CreditCard size={18} />Review & Complete</>}
                </button>
              ) : null}
            </div>
            {!user && (
              <p style={{ color: "#64748b", fontSize: "12px", textAlign: "center", marginTop: "12px" }}>
                <button onClick={() => setView("register")} style={{ color: "#60a5fa", background: "none", border: "none", cursor: "pointer", fontSize: "12px" }}>Create a free account</button> to save your resumes and re-download anytime.
              </p>
            )}
            {/* Personality upsell */}
            <div style={{ marginTop: "16px", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: "10px", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
              <div>
                <p style={{ color: "white", fontSize: "13px", fontWeight: 600, margin: 0 }}>🧠 Add a "Working With Me" section</p>
                <p style={{ color: "#64748b", fontSize: "12px", margin: "3px 0 0" }}>Upload your DISC, MBTI, PI, or TKI results and we'll translate them into professional workplace language.</p>
              </div>
              <button onClick={() => setPersonalityStep(true)}
                style={{ background: "#2563eb", color: "white", border: "none", borderRadius: "8px", padding: "8px 14px", fontSize: "12px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                Add It →
              </button>
            </div>
          </div>
        )}
        {view === "checkout" && (
          <div style={{ maxWidth: "520px", margin: "0 auto", padding: "40px 20px" }}>
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: "32px" }}>
              <div style={{ fontSize: "28px", marginBottom: "8px" }}>✨</div>
              <h2 style={{ color: "white", fontSize: "24px", fontWeight: 700, marginBottom: "8px" }}>
                Your resume is ready.
              </h2>
              <p style={{ color: "#94a3b8", fontSize: "15px", lineHeight: "1.5" }}>
                We've transformed your resume into a keyword-rich, ATS-optimized document. 
                Review what's included below before completing your order.
              </p>
            </div>

            {/* What's included card */}
            <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "16px", padding: "28px", marginBottom: "20px" }}>
              <p style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "20px" }}>
                What we've prepared for you
              </p>

              {/* Resume — always included */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "20px", paddingBottom: "20px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(37,99,235,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "18px" }}>📄</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "white", fontWeight: 600, fontSize: "15px" }}>Resume Transformation</span>
                    <span style={{ color: "#60a5fa", fontWeight: 700, fontSize: "15px" }}>{isFree ? "Free" : "$14.99"}</span>
                  </div>
                  <p style={{ color: "#64748b", fontSize: "13px", marginTop: "4px" }}>
                    ATS-optimized Word document with measurable impact bullets. Re-downloadable from your account forever.
                  </p>
                </div>
              </div>

              {/* Working With Me — optional */}
              <div
                onClick={() => setIncludePersonality(!includePersonality)}
                style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "20px", paddingBottom: "20px", borderBottom: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", borderRadius: "10px", padding: "12px", background: includePersonality ? "rgba(37,99,235,0.1)" : "transparent", transition: "background 0.2s" }}
              >
                <div style={{ width: "20px", height: "20px", borderRadius: "5px", border: `2px solid ${includePersonality ? "#2563eb" : "#475569"}`, background: includePersonality ? "#2563eb" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "2px" }}>
                  {includePersonality && <span style={{ color: "white", fontSize: "12px" }}>✓</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "white", fontWeight: 600, fontSize: "15px" }}>Working With Me Section</span>
                    <span style={{ color: includePersonality ? "#60a5fa" : "#64748b", fontWeight: 700, fontSize: "15px" }}>+ $7.99</span>
                  </div>
                  <p style={{ color: "#64748b", fontSize: "13px", marginTop: "4px" }}>
                    A personality-based section synthesized from your assessments. Added to your resume and unlocked on all future downloads.
                  </p>
                  {!workingWithMeTeaser && (
                    <p style={{ color: "#f59e0b", fontSize: "12px", marginTop: "6px" }}>
                      ↑ Upload personality assessments in the preview to enable this
                    </p>
                  )}
                </div>
              </div>

              {/* Career Launch — optional */}
              <div
                onClick={() => { setIncludeCareerLaunch(!includeCareerLaunch); if (!includeCareerLaunch) setIncludePersonality(true); }}
                style={{ display: "flex", alignItems: "flex-start", gap: "14px", cursor: "pointer", borderRadius: "10px", padding: "12px", background: includeCareerLaunch ? "rgba(16,185,129,0.1)" : "transparent", transition: "background 0.2s" }}
              >
                <div style={{ width: "20px", height: "20px", borderRadius: "5px", border: `2px solid ${includeCareerLaunch ? "#10b981" : "#475569"}`, background: includeCareerLaunch ? "#10b981" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "2px" }}>
                  {includeCareerLaunch && <span style={{ color: "white", fontSize: "12px" }}>✓</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ color: "white", fontWeight: 600, fontSize: "15px" }}>Career Launch Bundle</span>
                      <span style={{ background: "rgba(16,185,129,0.2)", color: "#10b981", fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "20px", marginLeft: "8px" }}>BEST VALUE</span>
                    </div>
                    <span style={{ color: includeCareerLaunch ? "#10b981" : "#64748b", fontWeight: 700, fontSize: "15px" }}>$79.99 total</span>
                  </div>
                  <p style={{ color: "#64748b", fontSize: "13px", marginTop: "4px" }}>
                    Everything above + 30 days of MyCareerIQ — AI-powered job search pipeline to put your new resume to work immediately.
                  </p>
                </div>
              </div>
            </div>

            {/* Total */}
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "12px", padding: "16px 20px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#94a3b8", fontSize: "14px" }}>Total</span>
              <span style={{ color: "white", fontSize: "22px", fontWeight: 700 }}>
                {isFree
                  ? (includeCareerLaunch ? "$79.99" : includePersonality ? "$7.99" : "Free")
                  : (includeCareerLaunch ? "$79.99" : includePersonality ? "$19.99" : "$14.99")}
              </span>
            </div>

            {/* CTA */}
            <button
              onClick={handleFinalCheckout}
              style={{ width: "100%", background: includeCareerLaunch ? "#10b981" : "#2563eb", color: "white", border: "none", borderRadius: "12px", padding: "16px", fontSize: "16px", fontWeight: 700, cursor: "pointer", marginBottom: "12px" }}
            >
              {isFree && !includePersonality && !includeCareerLaunch
                ? "Download My Resume →"
                : `Complete My Order →`}
            </button>
            <button
              onClick={() => setView("preview")}
              style={{ width: "100%", background: "transparent", color: "#64748b", border: "none", padding: "10px", fontSize: "13px", cursor: "pointer" }}
            >
              ← Back to preview
            </button>
          </div>
        )}

        {view === "done" && (
          <div style={{ maxWidth: "480px", margin: "0 auto", padding: "48px 0" }}>
            {/* Success icon + headline */}
            <div style={{ textAlign: "center", marginBottom: "28px" }}>
              <div style={{ width: "72px", height: "72px", background: "rgba(74,222,128,0.15)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <CheckCircle size={36} color="#4ade80" />
              </div>
              <h2 style={{ color: "white", fontSize: "26px", fontWeight: "bold", marginBottom: "8px" }}>Your Resume is Ready!</h2>
              <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0 }}>
                {user
                  ? "Saved to your account — re-download anytime from My Resumes."
                  : "Your resume has been downloaded. Create a free account to save it and re-download anytime."}
              </p>
            </div>

            {/* Guest: show account creation prompt */}
            {!user && (
              <div style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.35)", borderRadius: "14px", padding: "24px", marginBottom: "16px" }}>
                <p style={{ color: "#93c5fd", fontSize: "13px", fontWeight: 700, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Save your resume for free</p>
                <p style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "18px" }}>
                  Create a free account to re-download this resume anytime, track your history, and get your next one at a discount.
                </p>
                <div style={{ display: "grid", gap: "9px" }}>
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e: any) => { setEmail(e.target.value); setGuestAccountError(""); }}
                    style={{ padding: "10px 13px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.07)", color: "white", fontSize: "13px", outline: "none" }}
                  />
                  <input
                    type="password"
                    placeholder="Create a password (6+ characters)"
                    value={guestPassword}
                    onChange={(e: any) => { setGuestPassword(e.target.value); setGuestAccountError(""); }}
                    style={{ padding: "10px 13px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.07)", color: "white", fontSize: "13px", outline: "none" }}
                  />
                  <input
                    type="password"
                    placeholder="Confirm password"
                    value={guestPasswordConfirm}
                    onChange={(e: any) => { setGuestPasswordConfirm(e.target.value); setGuestAccountError(""); }}
                    style={{ padding: "10px 13px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.07)", color: "white", fontSize: "13px", outline: "none" }}
                  />
                  {guestAccountError && <p style={{ color: "#f87171", fontSize: "12px", margin: 0 }}>{guestAccountError}</p>}
                  <button
                    onClick={async () => {
                      setGuestAccountError("");
                      if (!email || !email.includes("@")) { setGuestAccountError("Enter a valid email."); return; }
                      if (!guestPassword || guestPassword.length < 6) { setGuestAccountError("Password must be at least 6 characters."); return; }
                      if (guestPassword !== guestPasswordConfirm) { setGuestAccountError("Passwords don't match."); return; }
                      try {
                        const res = await fetch("/api/resumeiq/auth/register", {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ email, password: guestPassword, name: email.split("@")[0] }),
                        });
                        const data = await res.json();
                        if (!res.ok) {
                          if (res.status === 409) {
                            const loginRes = await fetch("/api/resumeiq/auth/login", {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ email, password: guestPassword }),
                            });
                            const loginData = await loginRes.json();
                            if (!loginRes.ok) { setGuestAccountError("That email is already registered — check your password."); return; }
                            setToken(loginData.token); localStorage.setItem("riq_token", loginData.token); setUser(loginData.user);
                          } else { setGuestAccountError(data.error || "Could not create account."); return; }
                        } else {
                          setToken(data.token); localStorage.setItem("riq_token", data.token); setUser(data.user);
                        }
                        setEmailCaptured(true);
                        captureMarketingEmail(email, "done_screen");
                        trackEvent("account_created_done_screen", { email });
                      } catch { setGuestAccountError("Network error — please try again."); }
                    }}
                    style={{ background: "#2563eb", color: "white", border: "none", borderRadius: "8px", padding: "11px 18px", fontWeight: 700, cursor: "pointer", fontSize: "14px" }}
                  >
                    Create Free Account →
                  </button>
                  <p style={{ color: "#475569", fontSize: "11px", textAlign: "center", margin: 0 }}>
                    Already have an account?{" "}
                    <button onClick={() => setView("login")} style={{ color: "#60a5fa", background: "none", border: "none", cursor: "pointer", fontSize: "11px", padding: 0 }}>Sign in</button>
                  </p>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button onClick={reset} style={{ background: user ? "#2563eb" : "rgba(255,255,255,0.08)", color: "white", border: "none", borderRadius: "10px", padding: "11px 24px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                Transform Another
              </button>
              {user && (
                <button onClick={() => { loadHistory(); setView("history"); }} style={{ background: "rgba(255,255,255,0.1)", color: "white", border: "none", borderRadius: "10px", padding: "11px 24px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
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

            {/* Account management */}
            <div style={{ marginTop: "48px", paddingTop: "32px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <p style={{ color: "#64748b", fontSize: "13px", fontWeight: 600, marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Account</p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: "10px", padding: "16px 20px" }}>
                <div>
                  <p style={{ color: "#fca5a5", fontSize: "14px", fontWeight: 600, margin: "0 0 4px" }}>Delete my account</p>
                  <p style={{ color: "#64748b", fontSize: "12px", margin: 0 }}>Permanently deletes your account and all resume data. Cannot be undone.</p>
                </div>
                <DeleteAccountButton onDeleted={() => { localStorage.removeItem("riq_token"); localStorage.removeItem("riq_linkedin_name"); localStorage.removeItem("riq_linkedin_email"); setToken(""); setUser(null); setView("upload"); }} />
              </div>
            </div>
          </div>
        )}


        {/* ── PERSONALITY STEP: Upload assessments ── */}
        {personalityStep && !workingWithMeTeaser && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", boxSizing: "border-box" }}>
            <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "28px", maxWidth: "580px", width: "100%", maxHeight: "88vh", overflowY: "auto" }}>
              <div style={{ textAlign: "center", marginBottom: "20px" }}>
                <div style={{ fontSize: "36px", marginBottom: "8px" }}>🧠</div>
                <h2 style={{ color: "white", fontSize: "20px", fontWeight: "bold", marginBottom: "6px" }}>Add "Working With Me"</h2>
                <p style={{ color: "#94a3b8", fontSize: "13px", lineHeight: "1.6" }}>Upload your assessments — we'll synthesize them into a professional section that shows how you work best.</p>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ color: "#64748b", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "8px" }}>Select assessments to include:</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {ASSESSMENT_TYPES.map((a: any) => {
                    const added = assessmentFiles.find((f: any) => f.id === a.id);
                    return (
                      <button key={a.id} onClick={() => added ? removeAssessmentSlot(a.id) : addAssessmentSlot(a.id, a.label)}
                        style={{ background: added ? "rgba(37,99,235,0.25)" : "rgba(255,255,255,0.05)", border: added ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "7px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ color: added ? "#4ade80" : "#64748b", fontSize: "14px", fontWeight: 700 }}>{added ? "✓" : "+"}</span>
                        <div style={{ textAlign: "left" }}>
                          <p style={{ color: "white", fontSize: "12px", fontWeight: 600, margin: 0 }}>{a.label}</p>
                          <p style={{ color: "#475569", fontSize: "10px", margin: 0 }}>{a.hint}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {assessmentFiles.map((a: any) => (
                <div key={a.id} style={{ marginBottom: "10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ color: "#60a5fa", fontSize: "13px", fontWeight: 600 }}>{a.label}</span>
                    <button onClick={() => removeAssessmentSlot(a.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: "18px", padding: "0 4px", lineHeight: 1 }}>×</button>
                  </div>
                  <div onClick={() => (document.getElementById(`upload-${a.id}`) as HTMLInputElement)?.click()}
                    style={{ border: a.fileName ? "1px solid rgba(74,222,128,0.3)" : "2px dashed rgba(255,255,255,0.1)", borderRadius: "7px", padding: "10px", textAlign: "center", cursor: "pointer", marginBottom: "7px" }}>
                    <input id={`upload-${a.id}`} type="file" accept=".pdf,.docx,.doc,.txt" style={{ display: "none" }}
                      onChange={async (e: any) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => updateAssessmentFile(a.id, file.name, (reader.result as string).split(",")[1]);
                        reader.readAsDataURL(file);
                      }} />
                    {a.fileName
                      ? <p style={{ color: "#4ade80", fontSize: "12px", margin: 0 }}>📄 {a.fileName} <span style={{ color: "#64748b" }}>(click to replace)</span></p>
                      : <p style={{ color: "#64748b", fontSize: "12px", margin: 0 }}>📎 Upload {a.label} PDF — click to browse</p>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }}/>
                    <span style={{ color: "#334155", fontSize: "10px" }}>or paste</span>
                    <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }}/>
                  </div>
                  <textarea rows={2} value={a.textInput} onChange={(e: any) => updateAssessmentText(a.id, e.target.value)}
                    placeholder={`Paste ${a.label} results...`}
                    style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", color: "white", fontSize: "12px", padding: "7px 10px", outline: "none", resize: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
                </div>
              ))}

              {assessmentFiles.length === 0 && (
                <div style={{ textAlign: "center", padding: "16px", color: "#334155", fontSize: "13px" }}>Select at least one assessment above to get started</div>
              )}

              {error && <p style={{ color: "#f87171", fontSize: "12px", marginBottom: "10px" }}>{error}</p>}

              <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                <button onClick={() => { setPersonalityStep(false); setAssessmentFiles([]); }}
                  style={{ flex: 1, background: "rgba(255,255,255,0.06)", color: "#94a3b8", border: "none", borderRadius: "9px", padding: "12px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                  Skip
                </button>
                <button onClick={handlePersonalityGenerate}
                  disabled={assessmentFiles.filter((a: any) => a.fileBase64 || a.textInput).length === 0 || personalityLoading}
                  style={{ flex: 2, background: assessmentFiles.filter((a: any) => a.fileBase64 || a.textInput).length > 0 ? "#2563eb" : "rgba(37,99,235,0.3)", color: "white", border: "none", borderRadius: "9px", padding: "12px", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
                  {personalityLoading
                    ? <><span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span> Synthesizing...</>
                    : <><span>✨</span> {assessmentFiles.length > 1 ? `Synthesize ${assessmentFiles.length} Assessments →` : "Synthesize →"}</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── PERSONALITY TEASER: Show 2 fields, blur 3, upsell ── */}
        {workingWithMeTeaser && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", boxSizing: "border-box" }}>
            <div style={{ background: "#0f172a", border: "1px solid rgba(59,130,246,0.3)", borderRadius: "16px", padding: "28px", maxWidth: "560px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ textAlign: "center", marginBottom: "20px" }}>
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>✨</div>
                <h2 style={{ color: "white", fontSize: "20px", fontWeight: "bold", marginBottom: "6px" }}>Your "Working With Me" is Ready</h2>
                <p style={{ color: "#94a3b8", fontSize: "13px" }}>Here's a preview of what gets added to your resume.</p>
              </div>

              {/* All 5 fields — teaser ones visible, others blurred */}
              <div style={{ display: "grid", gap: "10px", marginBottom: "20px" }}>
                {Object.entries(FIELD_LABELS).map(([key, label]) => {
                  const isVisible = teaserFields.includes(key);
                  return (
                    <div key={key} style={{ background: "rgba(255,255,255,0.04)", borderRadius: "10px", padding: "14px", border: `1px solid ${isVisible ? "rgba(59,130,246,0.3)" : "rgba(255,255,255,0.06)"}`, position: "relative" }}>
                      <p style={{ color: "#60a5fa", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>{label}</p>
                      <p style={{
                        color: "white", fontSize: "13px", lineHeight: "1.6", margin: 0,
                        filter: isVisible ? "none" : "blur(4px)",
                        userSelect: isVisible ? "auto" : "none",
                        opacity: isVisible ? 1 : 0.6,
                      }}>
                        {workingWithMeTeaser[key]}
                      </p>
                      {!isVisible && (
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "10px" }}>
                          <span style={{ background: "rgba(37,99,235,0.2)", border: "1px solid rgba(59,130,246,0.4)", borderRadius: "999px", padding: "4px 12px", color: "#60a5fa", fontSize: "11px", fontWeight: 600 }}>🔒 Unlock to reveal</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pricing */}
              <div style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: "10px", padding: "14px 16px", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ color: "white", fontSize: "13px", fontWeight: 600 }}>
                    {!isFree ? "Resume + Working With Me" : "Working With Me — Lifetime Unlock"}
                  </span>
                  <span style={{ color: "#4ade80", fontSize: "16px", fontWeight: 700 }}>
                    {!isFree ? "$13.98" : "$3.99"}
                  </span>
                </div>
                {!isFree && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b", fontSize: "12px" }}>Resume transformation</span>
                      <span style={{ color: "#94a3b8", fontSize: "12px" }}>$9.99</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b", fontSize: "12px" }}>Working With Me unlock</span>
                      <span style={{ color: "#94a3b8", fontSize: "12px" }}>$3.99</span>
                    </div>
                  </div>
                )}
                <p style={{ color: "#64748b", fontSize: "11px", marginTop: "8px", marginBottom: 0 }}>
                  🎁 Once unlocked, Working With Me is auto-added to all your future resumes — free forever.
                </p>
              </div>

              <button onClick={handlePersonalityUnlock}
                style={{ width: "100%", background: "#2563eb", color: "white", border: "none", borderRadius: "10px", padding: "14px", fontSize: "14px", fontWeight: 700, cursor: "pointer", marginBottom: "10px" }}>
                {!isFree ? "Pay $13.98 — Get Resume + Unlock Working With Me →" : "Pay $3.99 — Unlock Working With Me →"}
              </button>
              <button onClick={() => { setWorkingWithMeTeaser(null); setTeaserFields([]); setAssessmentFiles([]); }}
                style={{ width: "100%", background: "none", color: "#475569", border: "none", fontSize: "12px", cursor: "pointer", padding: "6px" }}>
                Skip for now
              </button>
            </div>
          </div>
        )}

        {/* ── PAID GUEST ACCOUNT CREATION MODAL ── */}
        {showPaidGuestModal && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", boxSizing: "border-box" }}>
            <div style={{ background: "#0f172a", border: "1px solid #1e3a5f", borderRadius: "16px", padding: "28px", maxWidth: "420px", width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                <div style={{ width: "32px", height: "32px", background: "rgba(37,99,235,0.2)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <User size={16} color="#60a5fa" />
                </div>
                <h2 style={{ color: "white", fontSize: "17px", fontWeight: 700, margin: 0 }}>Create your free account</h2>
              </div>
              <p style={{ color: "#64748b", fontSize: "12px", marginBottom: "20px" }}>Your resume will be saved so you can re-download it anytime from your account.</p>
              <div style={{ display: "grid", gap: "9px" }}>
                <input type="email" placeholder="Email address" value={email} onChange={(e: any) => { setEmail(e.target.value); setGuestAccountError(""); }}
                  style={{ padding: "10px 13px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.07)", color: "white", fontSize: "13px", outline: "none" }} />
                <input type="password" placeholder="Create a password (6+ characters)" value={guestPassword} onChange={(e: any) => { setGuestPassword(e.target.value); setGuestAccountError(""); }}
                  style={{ padding: "10px 13px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.07)", color: "white", fontSize: "13px", outline: "none" }} />
                <input type="password" placeholder="Confirm password" value={guestPasswordConfirm} onChange={(e: any) => { setGuestPasswordConfirm(e.target.value); setGuestAccountError(""); }}
                  style={{ padding: "10px 13px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.07)", color: "white", fontSize: "13px", outline: "none" }} />
                {guestAccountError && <p style={{ color: "#f87171", fontSize: "12px", margin: 0 }}>{guestAccountError}</p>}
                <button onClick={async () => {
                  setGuestAccountError("");
                  if (!email || !email.includes("@")) { setGuestAccountError("Enter a valid email."); return; }
                  if (!guestPassword || guestPassword.length < 6) { setGuestAccountError("Password must be at least 6 characters."); return; }
                  if (guestPassword !== guestPasswordConfirm) { setGuestAccountError("Passwords don't match."); return; }
                  try {
                    const res = await fetch("/api/resumeiq/auth/register", {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ email, password: guestPassword }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      if (res.status === 409) {
                        const loginRes = await fetch("/api/resumeiq/auth/login", {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ email, password: guestPassword }),
                        });
                        const loginData = await loginRes.json();
                        if (!loginRes.ok) { setGuestAccountError("That email is already registered — check your password."); return; }
                        setToken(loginData.token); localStorage.setItem("riq_token", loginData.token); setUser(loginData.user);
                      } else { setGuestAccountError(data.error || "Could not create account."); return; }
                    } else {
                      setToken(data.token); localStorage.setItem("riq_token", data.token); setUser(data.user);
                    }
                    setShowPaidGuestModal(false);
                    await proceedToCheckout();
                  } catch { setGuestAccountError("Network error — please try again."); }
                }} style={{ background: "#2563eb", color: "white", border: "none", borderRadius: "8px", padding: "12px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                  Create Account &amp; Continue to Payment →
                </button>
                <p style={{ color: "#475569", fontSize: "11px", textAlign: "center", margin: 0 }}>
                  Already have an account?{" "}
                  <button onClick={() => { setShowPaidGuestModal(false); setView("login"); }} style={{ color: "#60a5fa", background: "none", border: "none", cursor: "pointer", fontSize: "11px", padding: 0 }}>Sign in</button>
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
