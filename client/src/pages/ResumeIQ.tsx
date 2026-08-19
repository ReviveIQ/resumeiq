import { useState, useRef, useEffect } from "react";
import {
  Upload, FileText, Download, Sparkles, CheckCircle, ArrowRight,
  Loader2, CreditCard, Gift, User, LogOut, Clock, Eye, EyeOff,
  Pencil, Check, X, Plus, Trash2, ChevronDown, ChevronUp
} from "lucide-react";

import { trackEvent, captureEmail as captureMarketingEmail } from "../tracking";

const INDUSTRY_SKILLS: Record<string, { cat: string; skills: string[] }[]> = {
  manufacturing: [
    { cat: "Quality & Compliance", skills: ["HACCP", "GMP", "SQF", "FSMA", "FDA Compliance", "ISO 9001", "Food Safety Audits", "OSHA"] },
    { cat: "Operations", skills: ["Lean Manufacturing", "Six Sigma", "Kaizen", "5S", "Root Cause Analysis", "SOP Development", "Batch Records"] },
    { cat: "Systems & Tools", skills: ["ERP Systems", "SAP", "Production Scheduling", "Yield Optimization", "Quality Control", "Preventive Maintenance"] },
  ],
  food_beverage: [
    { cat: "Food Safety", skills: ["HACCP", "GMP", "SQF Level 2", "FSMA", "PCQI Certified", "FDA Compliance", "Sanitation Programs"] },
    { cat: "Operations", skills: ["Production Planning", "Batch Manufacturing", "Process Improvement", "Cost Reduction", "Yield Analysis", "CIP Procedures"] },
    { cat: "Leadership", skills: ["Union Workforce Management", "Shift Supervision", "Employee Training", "Performance Management"] },
  ],
  sales: [
    { cat: "CRM & Tools", skills: ["Salesforce", "HubSpot", "Outreach", "Salesloft", "Gong", "ZoomInfo", "LinkedIn Sales Navigator"] },
    { cat: "Sales Skills", skills: ["Enterprise Sales", "Consultative Selling", "Pipeline Management", "Territory Planning", "Forecasting", "Contract Negotiation"] },
    { cat: "Business", skills: ["SaaS", "B2B Sales", "Channel Partnerships", "Account Management", "Renewals & Expansion", "Executive Presentations"] },
  ],
  technology: [
    { cat: "Cloud & Infrastructure", skills: ["AWS", "Azure", "GCP", "Docker", "Kubernetes", "CI/CD", "Terraform"] },
    { cat: "Development", skills: ["Python", "JavaScript", "TypeScript", "React", "Node.js", "SQL", "REST APIs", "Git"] },
    { cat: "Practices", skills: ["Agile", "Scrum", "Code Review", "Unit Testing", "System Design", "Microservices"] },
  ],
  healthcare: [
    { cat: "Clinical", skills: ["HIPAA Compliance", "EHR Systems", "Epic", "Cerner", "Patient Care", "Clinical Documentation"] },
    { cat: "Operations", skills: ["Care Coordination", "Quality Improvement", "Joint Commission Standards", "Revenue Cycle", "Utilization Review"] },
  ],
  operations: [
    { cat: "Process", skills: ["Process Improvement", "Lean", "Six Sigma", "Root Cause Analysis", "KPI Development", "SOP Creation", "Workflow Automation"] },
    { cat: "Systems", skills: ["ERP", "SAP", "NetSuite", "Salesforce Operations", "Data Analysis", "Excel", "Power BI", "Tableau"] },
    { cat: "Leadership", skills: ["Cross-functional Collaboration", "Vendor Management", "Budget Management", "Project Management", "Change Management"] },
  ],
  marketing: [
    { cat: "Digital", skills: ["Google Analytics", "SEO/SEM", "HubSpot", "Marketo", "Pardot", "Meta Ads", "Google Ads", "Email Marketing"] },
    { cat: "Content & Brand", skills: ["Content Strategy", "Copywriting", "Brand Development", "Social Media", "Campaign Management", "A/B Testing"] },
  ],
  finance: [
    { cat: "Financial", skills: ["Financial Modeling", "Excel", "FP&A", "Budgeting", "Forecasting", "Variance Analysis", "GAAP"] },
    { cat: "Tools", skills: ["QuickBooks", "SAP", "NetSuite", "Tableau", "Power BI", "Bloomberg", "SQL"] },
  ],
};

const INDUSTRY_LABELS: Record<string, string> = {
  manufacturing: "Manufacturing & Industrial",
  food_beverage: "Food & Beverage",
  sales: "Sales & Business Development",
  technology: "Technology & Engineering",
  healthcare: "Healthcare",
  operations: "Operations",
  marketing: "Marketing",
  finance: "Finance & Accounting",
};

type View = "upload" | "analyzing" | "enrichment" | "validating" | "scoring" | "interview" | "skill_suggestions" | "linkedin_confirm" | "verify_pending" | "preview" | "checkout" | "done" | "history" | "login" | "register";

const INTERVIEW_QUESTIONS: { field: string; question: string; placeholder: string; required: boolean; multiline?: boolean }[] = [
  { field: "name",               question: "What's your full name?",                                          placeholder: "Bryan Michael Greer",              required: true },
  { field: "title",              question: "What's your current or most recent job title?",                   placeholder: "Enterprise Account Executive",     required: true },
  { field: "email",              question: "What's your email address?",                                      placeholder: "you@email.com",                    required: true },
  { field: "phone",              question: "What's your phone number?",                                       placeholder: "(561) 555-0100",                   required: false },
  { field: "location",           question: "What city and state are you based in?",                           placeholder: "Fort Lauderdale, FL",              required: true },
  { field: "summary",            question: "In 2–3 sentences, describe your professional background.",        placeholder: "Experienced sales leader with 10+ years...", required: true, multiline: true },
  { field: "skills",             question: "List your top skills, tools, or technologies (comma separated).", placeholder: "Salesforce, HubSpot, Outreach, Excel...", required: false },
  { field: "education",          question: "Where did you go to school and what did you study?",              placeholder: "B.S. Marketing — Florida Atlantic University", required: false },
  { field: "experience",         question: "We couldn't find any work experience. Add your most recent role — company name, title, and 1–2 things you accomplished.",  placeholder: "Senior AE at Acme Corp — Closed $2M in new business, managed 30-account portfolio", required: true, multiline: true },
  { field: "experience_dates",   question: "We noticed some roles are missing dates. Add start and end years for your positions so employers can see your timeline.",    placeholder: "e.g. Current role: Jan 2022 – Present, Previous: Mar 2019 – Dec 2021", required: false, multiline: true },
  { field: "date_gaps",          question: "We noticed a gap in your timeline. Is this a date typo, a career break, or work you'd like to include?", placeholder: "e.g. Double Play Media ended Jan 2015 not Jan 2014, or I took time off for family", required: false, multiline: true },
  { field: "experience_bullets", question: "Your experience section looks thin. For your most recent 2 roles, what were your biggest accomplishments or responsibilities?", placeholder: "e.g. Led a team of 8 reps, exceeded quota 3 years running, grew territory 40%", required: false, multiline: true },
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

  // Experience quality checks
  const exp = data.experience || [];
  if (exp.length === 0) {
    missing.push("experience");
  } else {
    // Use GPT-returned missingDates array OR fall back to manual check
    const hasMissingDates = (data.missingDates && data.missingDates.length > 0) ||
      exp.filter((e: any) => !e.startDate || e.startDate === "MM/YYYY" || e.startDate === "").length >= Math.ceil(exp.length / 2);
    if (hasMissingDates) missing.push("experience_dates");
    if (data.dateGaps && data.dateGaps.length > 0) missing.push("date_gaps");

    // Check if most roles have no bullets
    const noBullets = exp.filter((e: any) => !e.bullets || e.bullets.length === 0).length;
    if (noBullets >= Math.ceil(exp.length / 2)) missing.push("experience_bullets");
  }

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
  const [resumeScore, setResumeScore] = useState<any>(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [preTransformScore, setPreTransformScore] = useState<any>(null);
  const [showPersonalityOnUpload, setShowPersonalityOnUpload] = useState(false);
  const [uploadAssessments, setUploadAssessments] = useState<{ id: string; label: string; fileName: string; fileBase64: string; textInput: string }[]>([]);
  const [targetRole, setTargetRole] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any>(null);
  const [sessionId, setSessionId] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [planType, setPlanType] = useState<"free"|"starter"|"monthly"|"agency">("free");
  const [selectedPlan, setSelectedPlan] = useState<"starter" | "monthly">("monthly");
  const [email, setEmail] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [emailCaptured, setEmailCaptured] = useState(false);
  const [guestPassword, setGuestPassword] = useState("");
  const [guestPasswordConfirm, setGuestPasswordConfirm] = useState("");
  const [guestAccountError, setGuestAccountError] = useState("");
  const [showPaidGuestModal, setShowPaidGuestModal] = useState(false);
  const [error, setError] = useState("");
  const [notification, setNotification] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [testimonialRating, setTestimonialRating] = useState(0);
  const [testimonialQuote, setTestimonialQuote] = useState("");
  const [testimonialName, setTestimonialName] = useState("");
  const [testimonialSubmitted, setTestimonialSubmitted] = useState(false);
  const [suggestedSkills, setSuggestedSkills] = useState<string[]>([]);
  const [linkedinProfile, setLinkedinProfile] = useState<any>(null);
  const [confirmEdits, setConfirmEdits] = useState<Record<string, string>>({});
  const [verifyBanner, setVerifyBanner] = useState<"success"|"pending"|null>(null);
  const [resendSent, setResendSent] = useState(false);
  const [emailTypoWarning, setEmailTypoWarning] = useState<string|null>(null);
  const [pendingFileName, setPendingFileName] = useState<string|null>(null);

  // Poll for email verification when on verify_pending screen
  // Detects when user verifies in another tab
  useEffect(() => {
    if (view !== "verify_pending") return;
    const interval = setInterval(async () => {
      const t = localStorage.getItem("riq_token");
      if (!t) return;
      try {
        const res = await fetch("/api/resumeiq/auth/me", { headers: { Authorization: `Bearer ${t}` } });
        const data = await res.json();
        if (data?.emailVerified) {
          clearInterval(interval);
          setUser(data);
          setVerifyBanner("success");
          if (file) {
            setView("analyzing");
            handleAnalyzeWithToken(t);
          } else {
            setView("upload");
          }
        }
      } catch { /* silent */ }
    }, 3000); // poll every 3 seconds
    return () => clearInterval(interval);
  }, [view]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Handle ?resume=true — from nurture email, land directly on their saved resume
    if (params.get("resume") === "true") {
      window.history.replaceState({}, "", "/app");
      const t = localStorage.getItem("riq_token");
      if (t) {
        fetch("/api/resumeiq/history", { headers: { Authorization: `Bearer ${t}` } })
          .then(r => r.json())
          .then(resumes => {
            if (Array.isArray(resumes) && resumes.length > 0) {
              const latest = resumes[0];
              if (latest.parsedData) {
                setParsedData(typeof latest.parsedData === "string" ? JSON.parse(latest.parsedData) : latest.parsedData);
                setView("preview");
              } else {
                setView("history");
              }
            } else {
              setView("upload");
            }
          }).catch(() => setView("upload"));
      } else {
        setView("login");
      }
      return;
    }

    if (params.get("verified") === "success") {
      setVerifyBanner("success");
      window.history.replaceState({}, "", "/app");
      const t = localStorage.getItem("riq_token");
      if (t) fetch("/api/resumeiq/auth/me", { headers: { Authorization: `Bearer ${t}` } })
        .then(r => r.json())
        .then(d => {
          if (d.id) {
            setUser(d);
            if (d?.plan === "monthly" || d?.plan === "agency" || d?.plan === "starter") setPlanType(d.plan);
            setView(prev => {
              if (prev === "verify_pending") {
                const currentFile = file;
                if (currentFile) {
                  setTimeout(() => {
                    setView("analyzing");
                    handleAnalyzeWithToken(t);
                  }, 500);
                  return "verify_pending";
                }
                return "upload";
              }
              return prev;
            });
          }
        }).catch(() => {});
    }

    // Restore pending file name from before LinkedIn OAuth redirect
    const pendingFileName = sessionStorage.getItem("riq_pending_file");
    if (pendingFileName) {
      sessionStorage.removeItem("riq_pending_file");
      setPendingFileName(pendingFileName);
    }

    // Restore full file from sessionStorage if user had a file before register/verify flow
    const savedFileName = sessionStorage.getItem("riq_pending_file_name");
    const savedFileB64 = sessionStorage.getItem("riq_pending_file_b64");
    if (savedFileName && savedFileB64) {
      try {
        const byteString = atob(savedFileB64);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        const mimeType = savedFileName.endsWith(".pdf") ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        const restoredFile = new File([ab], savedFileName, { type: mimeType });
        setFile(restoredFile);
        // Don't remove yet — keep until analysis actually starts
      } catch { /* non-critical */ }
    }
  }, []);
  const [testimonials, setTestimonials] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/resumeiq/testimonials")
      .then(r => r.json())
      .then(data => setTestimonials(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);
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
  const [tailorStep, setTailorStep] = useState(false);
  const [jobDescriptionInput, setJobDescriptionInput] = useState("");
  const [tailorLoading, setTailorLoading] = useState(false);
  const [tailorResult, setTailorResult] = useState<any>(null);
  const [tailorError, setTailorError] = useState("");
  const [tailorUpgradeRequired, setTailorUpgradeRequired] = useState(false);
  const [tailorApplied, setTailorApplied] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState(() => localStorage.getItem("riq_token") || "");

  // Handle LinkedIn OAuth redirect and cross-app SSO handoff
  useEffect(() => {
    // Persist UTM params to sessionStorage so they survive navigation to Stripe and back
    const params = new URLSearchParams(window.location.search);
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(k => {
      if (params.get(k)) sessionStorage.setItem(k, params.get(k)!);
    });
    // Capture referrer on first load — don't overwrite with internal navigation
    if (document.referrer && !sessionStorage.getItem("referrer")) {
      try {
        const ref = new URL(document.referrer);
        sessionStorage.setItem("referrer", ref.hostname); // e.g. "linkedin.com", "google.com"
      } catch {}
    }
    // Capture landing page on first visit
    if (!sessionStorage.getItem("landing_url")) {
      sessionStorage.setItem("landing_url", window.location.pathname);
    }

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
      if (data.user?.plan === "monthly" || data.user?.plan === "agency" || data.user?.plan === "starter") setPlanType(data.user.plan);
            setView("upload");
          }
        })
        .catch(() => setView("upload")); // Fail gracefully — still show app
    } else if (linkedinToken) {
      localStorage.setItem("riq_token", linkedinToken);
      setToken(linkedinToken);
      const linkedinName = params.get("linkedin_name") || "";
      const linkedinEmail = params.get("linkedin_email") || "";
      const linkedinVerified = params.get("linkedin_verified") === "1";
      if (linkedinName) localStorage.setItem("riq_linkedin_name", linkedinName);
      if (linkedinEmail) localStorage.setItem("riq_linkedin_email", linkedinEmail);
      window.history.replaceState({}, "", window.location.pathname);
      // Fetch fresh user so emailVerified state is correct
      fetch("/api/resumeiq/auth/me", { headers: { Authorization: `Bearer ${linkedinToken}` } })
        .then(r => r.json())
        .then(data => {
          if (data.id) setUser({ ...data, emailVerified: linkedinVerified || data.emailVerified });
        }).catch(() => {});
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
  const [enrichmentAnswers, setEnrichmentAnswers] = useState<{ targetRole: string; careerHighlight: string; transitionContext: string }>({ targetRole: "", careerHighlight: "", transitionContext: "" });
  const [validationFlags, setValidationFlags] = useState<{ type: string; severity: string; issue: string; suggestion: string }[]>([]);
  const [analysisStep, setAnalysisStep] = useState(0); // 0=parsing, 1=enriching, 2=validating
  const [analysisCount, setAnalysisCount] = useState(() => parseInt(localStorage.getItem("riq_analysis_count") || "0"));

  const fileInputRef = useRef<HTMLInputElement>(null);
  const spin = { animation: "spin 1s linear infinite" };
  const S: any = { minHeight: "100vh", background: "linear-gradient(135deg,#0f172a,#1e3a5f,#0f172a)", fontFamily: "Arial,sans-serif" };

  useEffect(() => {
    if (token) {
      fetch("/api/resumeiq/auth/me", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(u => { if (u) { setUser(u); if (u?.plan === "monthly" || u?.plan === "agency" || u?.plan === "starter") setPlanType(u.plan); } else { setToken(""); localStorage.removeItem("riq_token"); } })
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
    sessionStorage.removeItem("riq_pending_file_name");
    sessionStorage.removeItem("riq_pending_file_b64");
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
        body: JSON.stringify({ fileBase64: base64, fileName: file.name, targetRole: targetRole.trim() || undefined, guestEmail: guestEmail || undefined }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      // Pre-populate missing fields from LinkedIn OAuth data if available
      const linkedinName = localStorage.getItem("riq_linkedin_name") || "";
      const linkedinEmail = localStorage.getItem("riq_linkedin_email") || "";
      if (linkedinName && !data.name) data.name = linkedinName;
      if (linkedinEmail && !data.email) data.email = linkedinEmail;
      if (linkedinName && !data.linkedin) {
        data.linkedin = "";
        data._linkedinSignedIn = true;
      }
      setParsedData(data);
      if (data.emailTypoWarning) setEmailTypoWarning(data.emailTypoWarning);
      trackEvent('resume_uploaded', { fileName: file.name, sessionId: data.sessionId });
      setSessionId(data.sessionId);
      setIsFree(data.isFree);
      if (data.planType) setPlanType(data.planType);

      const missing = getMissingFields(data);
      const industry = data.industry || "other";
      const hasIndustrySuggestions = !!INDUSTRY_SKILLS[industry];

      // Increment analysis count for display purposes
      const newCount = analysisCount + 1;
      setAnalysisCount(newCount);
      localStorage.setItem("riq_analysis_count", String(newCount));

      // Check if signed in via LinkedIn — if so, show enrichment confirm screen
      const isLinkedinUser = !!localStorage.getItem("riq_linkedin_name");
      const linkedInEnrichableFields = ["experience_dates", "skills", "education", "certifications"];
      const hasEnrichableFields = missing.some(f => linkedInEnrichableFields.includes(f));

      if (missing.length > 0 && isLinkedinUser && hasEnrichableFields) {
        setLinkedinProfile({
          name: localStorage.getItem("riq_linkedin_name") || "",
          email: localStorage.getItem("riq_linkedin_email") || "",
        });
        setConfirmEdits({});
        setInterviewFields(missing.filter(f => !linkedInEnrichableFields.includes(f)));
        setView("linkedin_confirm");
      } else if (missing.length > 0) {
        setInterviewFields(missing); setInterviewStep(0); setInterviewAnswer(""); setView("interview");
      } else {
        // Always go to enrichment first — qualifying questions for everyone
        setEnrichmentAnswers({ targetRole: targetRole || "", careerHighlight: "", transitionContext: "" });
        setView("enrichment");
        return; // enrichment view handles the rest of the flow
      }

      if (false && hasIndustrySuggestions) { // preserved for skill_suggestions flow via enrichment
        setView("skill_suggestions");
        // Score in background
        setScoreLoading(true);
        fetch("/api/resumeiq/score", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {}) },
          body: JSON.stringify({ parsedData: data }),
        }).then(r => r.ok ? r.json() : null)
          .then(scores => { if (scores) setResumeScore(scores); })
          .catch(() => {})
          .finally(() => setScoreLoading(false));
      } else {
        // Show scoring view immediately — score loads in background
        setView("scoring");
        setScoreLoading(true);

        // Timeout fallback — if scoring takes >15s, show preview anyway
        const scoreTimeout = setTimeout(() => {
          setScoreLoading(false);
          setResumeScore({ overall: 5, dimensions: {}, topIssues: [] });
        }, 15000);

        fetch("/api/resumeiq/score", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {}) },
          body: JSON.stringify({ parsedData: data }),
        }).then(r => r.ok ? r.json() : null)
          .then(scores => { clearTimeout(scoreTimeout); setResumeScore(scores || { overall: 5, dimensions: {}, topIssues: [] }); setScoreLoading(false); })
          .catch(() => { clearTimeout(scoreTimeout); setResumeScore({ overall: 5, dimensions: {}, topIssues: [] }); setScoreLoading(false); });

        // If personality assessments were uploaded on the upload screen,
        // await the WWM generation BEFORE entering enrichment so it's ready
        const readyAssessments = uploadAssessments.filter(a => a.fileBase64 || a.textInput);
        if (readyAssessments.length > 0) {
          try {
            const wwmRes = await fetch("/api/resumeiq/personality", {
              method: "POST",
              headers: { "Content-Type": "application/json", ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {}) },
              body: JSON.stringify({ assessments: readyAssessments, parsedResumeData: data }),
              signal: AbortSignal.timeout(50000),
            });
            if (wwmRes.ok) {
              const wwmResult = await wwmRes.json();
              if (wwmResult?.workingWithMe) {
                setWorkingWithMeTeaser(wwmResult.workingWithMe);
                setTeaserFields(wwmResult.teaserFields || ["communicationStyle", "motivation"]);
                setIncludePersonality(true);
              }
            }
          } catch (e) {
            console.warn("[ResumeIQ] WWM generation timed out or failed — continuing without it", e);
            /* non-blocking — flow continues to enrichment regardless */
          }
        }
      }
    } catch (err: any) { setError(err.message || "Failed to analyze"); setView("upload"); }
  };

  // ── Enrichment + Validation flow ──────────────────────────────────────────
  const handleEnrichmentComplete = async (skip = false) => {
    setView("validating");
    setAnalysisStep(1);

    let enrichedData = parsedData;

    // Pass 2: Enrichment — only if user provided answers
    if (!skip) {
      try {
        const enrichRes = await fetch("/api/resumeiq/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parsedData, enrichmentAnswers }),
        });
        if (enrichRes.ok) {
          enrichedData = await enrichRes.json();
          setParsedData(enrichedData);
        }
      } catch { /* non-blocking — fall through to validation */ }
    }

    // Pass 3: Validation
    setAnalysisStep(2);
    try {
      const validateRes = await fetch("/api/resumeiq/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parsedData: enrichedData }),
      });
      if (validateRes.ok) {
        const { flags } = await validateRes.json();
        setValidationFlags(flags || []);
      }
    } catch { /* non-blocking */ }

    // Score in background
    const industry = enrichedData.industry || "other";
    const hasIndustrySuggestions = !!INDUSTRY_SKILLS[industry];
    if (hasIndustrySuggestions) {
      setView("skill_suggestions");
    } else {
      setView("scoring");
      setScoreLoading(true);
      const scoreTimeout = setTimeout(() => {
        setScoreLoading(false);
        if (!resumeScore) setResumeScore({ overall: 5, dimensions: {}, topIssues: [] });
      }, 12000);
      fetch("/api/resumeiq/score", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "Authorization": `Bearer ${token}` } : {}) },
        body: JSON.stringify({ parsedData: enrichedData }),
      }).then(r => r.ok ? r.json() : null)
        .then(scores => { clearTimeout(scoreTimeout); setResumeScore(scores || { overall: 5, dimensions: {}, topIssues: [] }); setScoreLoading(false); })
        .catch(() => { clearTimeout(scoreTimeout); setResumeScore({ overall: 5, dimensions: {}, topIssues: [] }); setScoreLoading(false); });
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;

    // Require account before transformation
    if (!user) {
      // Save file to sessionStorage so it survives email verification flow
      if (file) {
        try {
          const reader = new FileReader();
          reader.onload = () => {
            const b64 = (reader.result as string).split(",")[1];
            sessionStorage.setItem("riq_pending_file_name", file.name);
            sessionStorage.setItem("riq_pending_file_b64", b64);
          };
          reader.readAsDataURL(file);
        } catch { /* non-critical */ }
      }
      setView("register");
      return;
    }

    // Require email verification before transformation
    if (!user.emailVerified) {
      setView("verify_pending");
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
      updated.skills = { categories: [{ name: "Skills", skills: answer.split(",").map((s: string) => s.trim()).filter(Boolean) }] };
    } else if (field === "education" && answer) {
      updated.education = [{ degree: answer, school: "", location: "", year: "" }];
    } else if (field === "summary" && answer) {
      updated.summary = answer;
    } else if (field === "experience" && answer) {
      // Store the raw answer as a note for GPT to use during transformation
      updated._experienceNote = answer;
      if (!updated.experience?.length) {
        updated.experience = [{ title: "Recent Role", company: "", startDate: "", endDate: "Present", bullets: [answer], description: "" }];
      }
    } else if (field === "experience_dates" && answer) {
      updated._experienceDatesNote = answer;
    } else if (field === "experience_bullets" && answer) {
      // Append the user-provided accomplishments to the first role's bullets
      if (updated.experience?.length > 0) {
        const bullets = answer.split(/[,\n]/).map((b: string) => b.trim()).filter(Boolean);
        updated.experience[0].bullets = [...(updated.experience[0].bullets || []), ...bullets];
      }
      updated._experienceBulletsNote = answer;
    } else if (answer) {
      updated[field] = answer;
    }
    setParsedData(updated);

    if (interviewStep + 1 < interviewFields.length) {
      setInterviewStep(interviewStep + 1);
      setInterviewAnswer("");
    } else {
      // Check for industry skill suggestions
      const industry = updated.industry || parsedData.industry || "other";
      if (INDUSTRY_SKILLS[industry]) {
        setView("skill_suggestions");
      } else {
        setView("scoring");
      }
      setScoreLoading(true);
      const scoreTimeoutNext = setTimeout(() => {
        setScoreLoading(false);
        if (!resumeScore) setResumeScore({ overall: 5, dimensions: {}, topIssues: [] });
      }, 12000);
      fetch("/api/resumeiq/score", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "Authorization": `Bearer ${token}` } : {}) },
        body: JSON.stringify({ parsedData: updated }),
      }).then(r => r.ok ? r.json() : null)
        .then(scores => { clearTimeout(scoreTimeoutNext); if (scores) setResumeScore(scores); })
        .catch(() => { clearTimeout(scoreTimeoutNext); })
        .finally(() => setScoreLoading(false));
    }
  };

  const handleInterviewSkip = () => {
    if (interviewStep + 1 < interviewFields.length) {
      setInterviewStep(interviewStep + 1);
      setInterviewAnswer("");
    } else {
      setView("scoring");
      setScoreLoading(true);
      const scoreTimeoutSkip = setTimeout(() => {
        setScoreLoading(false);
        if (!resumeScore) setResumeScore({ overall: 5, dimensions: {}, topIssues: [] });
      }, 12000);
      fetch("/api/resumeiq/score", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "Authorization": `Bearer ${token}` } : {}) },
        body: JSON.stringify({ parsedData: parsedData }),
      }).then(r => r.ok ? r.json() : null)
        .then(scores => { clearTimeout(scoreTimeoutSkip); if (scores) setResumeScore(scores); })
        .catch(() => { clearTimeout(scoreTimeoutSkip); })
        .finally(() => setScoreLoading(false));
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
  const addAssessmentSlot = (id: string, label: string) => {
    // For "other" type, allow multiple by generating a unique ID each time
    const uniqueId = id === "other" ? `other-${Date.now()}` : id;
    // For named types, don't add duplicates
    if (id !== "other" && assessmentFiles.some(a => a.id === id)) return;
    setAssessmentFiles(prev => [...prev, { id: uniqueId, label, fileName: "", fileBase64: "", textInput: "" }]);
  };
  const removeAssessmentSlot = (id: string) =>
    setAssessmentFiles(prev => prev.filter(a => a.id !== id));
  const updateAssessmentLabel = (id: string, label: string) =>
    setAssessmentFiles(prev => prev.map(a => a.id === id ? { ...a, label } : a));
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
        setTeaserFields(data.teaserFields || ["communicationStyle", "motivation"]);
        setPersonalityStep(false);
        // personalityTeaser view will show
      } else {
        setError(data.error || "Failed to generate Working With Me section");
      }
    } catch (err: any) { setError(err.message); }
    finally { setPersonalityLoading(false); }
  };

  const handlePersonalityUnlock = async () => {
    // Check if user has a paid plan — if so, skip Stripe entirely
    const effectivePlan = (user as any)?.plan || planType || localStorage.getItem("riq_plan") || "free";
    const hasPaidPlan = effectivePlan === "monthly" || effectivePlan === "agency" || effectivePlan === "starter" || (user as any)?.personalityUnlocked == 1;

    if (hasPaidPlan) {
      // Paid plan — close modal immediately, then download
      setPersonalityStep(false);
      setIncludePersonality(true);
      const dataWithWWM = { ...parsedData, workingWithMe: workingWithMeTeaser };
      setParsedData(dataWithWWM);
      await handleDownloadWithData(dataWithWWM);
      return;
    }

    // Free user — go through Stripe
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

  // ── Tailor to a Job Description ─────────────────────────────────────────
  const handleTailorGenerate = async () => {
    if (jobDescriptionInput.trim().length < 20) {
      setTailorError("Paste a bit more of the job description — at least a few sentences.");
      return;
    }
    setTailorLoading(true);
    setTailorError("");
    setTailorUpgradeRequired(false);
    try {
      const res = await fetch("/api/resumeiq/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ parsedData, jobDescription: jobDescriptionInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.upgradeRequired) setTailorUpgradeRequired(true);
        setTailorError(data.error || "Tailoring failed — try again.");
        return;
      }
      setTailorResult(data);
      setTailorApplied(false);
    } catch (err: any) {
      setTailorError(err.message || "Tailoring failed — try again.");
    } finally {
      setTailorLoading(false);
    }
  };

  const handleApplyTailoring = () => {
    if (!tailorResult?.diff) return;
    setParsedData((prev: any) => {
      const next = { ...prev };
      if (tailorResult.diff.summary) next.summary = tailorResult.diff.summary.after;
      if (tailorResult.diff.experience?.length) {
        const exp = [...(next.experience || [])];
        tailorResult.diff.experience.forEach((e: any) => {
          if (exp[e.index]) exp[e.index] = { ...exp[e.index], bullets: e.after };
        });
        next.experience = exp;
      }
      if (tailorResult.diff.skillsOrder?.length && next.skills?.categories) {
        const order: string[] = tailorResult.diff.skillsOrder;
        const cats = [...next.skills.categories].sort((a: any, b: any) => {
          const ai = order.indexOf(a.name); const bi = order.indexOf(b.name);
          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });
        next.skills = { ...next.skills, categories: cats };
      }
      return next;
    });
    setTailorApplied(true);
    setTailorStep(false);
  };

  const handleResetTailoring = () => {
    setTailorResult(null);
    setTailorApplied(false);
    setJobDescriptionInput("");
    setTailorError("");
  };

  const handleDownload = async () => { await handleDownloadWithData(parsedData); };

  const handleDownloadWithData = async (data: any) => {
    setDownloading(true);
    // Capture the pre-transform score before generating
    if (resumeScore) setPreTransformScore(resumeScore);
    try {
      const res = await fetch("/api/resumeiq/generate", {
        method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ sessionId, parsedData: data, scoreFlags: resumeScore?.dimensions }),
      });
      if (res.status === 402) { setError("Payment required"); return; }
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed to generate"); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${parsedData?.name?.replace(/\s+/g, "_") || "Resume"}_ResumeIQ.docx`;
      a.click(); URL.revokeObjectURL(url);
      document.cookie = "resumeiq_free_used=1; max-age=31536000; path=/";
      setView("done"); trackEvent('resume_generated', { sessionId });

      // Poll for postScore from background job — plain setTimeout, no stale closure issues
      if (token) {
        const authToken = token;
        const preScoreValue = resumeScore?.overall ?? null;
        let attempts = 0;
        const pollPostScore = () => {
          attempts++;
          if (attempts > 20) return;
          fetch("/api/resumeiq/latest-score", {
            headers: { Authorization: `Bearer ${authToken}` }
          }).then(r => r.ok ? r.json() : null)
            .then(d => {
              if (d?.postScore && d.postScore !== preScoreValue) {
                // postScore arrived and differs from preScore — update display
                setResumeScore({ overall: d.postScore, dimensions: d.scoreDimensions || {} });
              } else if (!d?.postScore || d.postScore === preScoreValue) {
                // Not ready yet — keep polling
                setTimeout(pollPostScore, 3000);
              }
            }).catch(() => setTimeout(pollPostScore, 3000));
        };
        setTimeout(pollPostScore, 5000);
      }

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

    // Paid plan users bypass Stripe entirely
    const epCheckout = (user as any)?.plan || planType || localStorage.getItem("riq_plan") || "free";
    const isPaidCheckout = epCheckout === "monthly" || epCheckout === "agency" || epCheckout === "starter";
    if (isPaidCheckout) {
      await handleDownloadWithData(parsedData);
      return;
    }

    // Determine checkout type based on selections
    let checkoutType: string;
    if (includeCareerLaunch) {
      checkoutType = "career";
    } else if (isFree && includePersonality) {
      checkoutType = "personality"; // free user adding WWM only
    } else if (!isFree && includePersonality) {
      checkoutType = selectedPlan === "monthly" ? "monthly_bundle" : "starter_bundle";
    } else if (!isFree) {
      checkoutType = selectedPlan === "monthly" ? "monthly" : "starter";
    } else {
      checkoutType = "free"; // shouldn't reach but safety net
    }

    try {
      // Capture UTM params from URL or sessionStorage (persist across page navigation)
      const urlParams = new URLSearchParams(window.location.search);
      const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
      const utmData: Record<string, string> = {};
      utmKeys.forEach(k => {
        const val = urlParams.get(k) || sessionStorage.getItem(k) || "";
        if (val) utmData[k] = val;
      });
      // Add referrer and landing page
      const referrer = sessionStorage.getItem("referrer") || "";
      const landingUrl = sessionStorage.getItem("landing_url") || "";
      if (referrer) utmData["referrer"] = referrer;
      if (landingUrl) utmData["landing_url"] = landingUrl;
      // If no utm_source but has referrer, infer source
      if (!utmData["utm_source"] && referrer) {
        if (referrer.includes("linkedin")) utmData["utm_source"] = "linkedin_organic";
        else if (referrer.includes("google")) utmData["utm_source"] = "google_organic";
        else if (referrer.includes("twitter") || referrer.includes("x.com")) utmData["utm_source"] = "twitter_organic";
        else utmData["utm_source"] = referrer;
      }

      let res: Response;
      if (checkoutType === "career") {
        res = await fetch("/api/resumeiq/career-checkout", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resumeiqSession: sessionId, utmData }),
        });
      } else if (checkoutType === "personality") {
        res = await fetch("/api/resumeiq/personality-checkout", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resumeiqSession: sessionId, type: "personality", utmData }),
        });
      } else if (checkoutType === "monthly" || checkoutType === "monthly_bundle") {
        res = await fetch("/api/resumeiq/monthly-checkout", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resumeiqSession: sessionId, includePersonality: checkoutType === "monthly_bundle", utmData }),
        });
      } else {
        // starter or starter_bundle
        res = await fetch("/api/resumeiq/checkout", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, includePersonality: checkoutType === "starter_bundle", utmData }),
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
    // Paid plan users skip checkout entirely — download directly
    const ep = (user as any)?.plan || planType || localStorage.getItem("riq_plan") || "free";
    const isPaid = ep === "monthly" || ep === "agency" || ep === "starter";
    if (isPaid) {
      await handleDownloadWithData(parsedData);
      return;
    }
    // Free users go to concierge checkout view
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
    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((authEmail || "").trim())) {
      setError("Please enter a valid email address");
      setAuthLoading(false);
      return;
    }
    if (mode === "register" && (!authPassword || authPassword.length < 6)) {
      setError("Password must be at least 6 characters");
      setAuthLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/resumeiq/auth/${mode}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword, name: authName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Auth failed");
      setToken(data.token); localStorage.setItem("riq_token", data.token);
      setUser(data.user);
      if (mode === "register") {
        // New registrations must verify email before transforming
        // File stays in state — will auto-trigger after verification
        setView("verify_pending");
      } else {
        // Login — check if already verified
        if (data.user?.emailVerified) {
          if (file) {
            setView("analyzing");
            setTimeout(() => handleAnalyzeWithToken(data.token), 100);
          } else {
            setView("upload");
          }
        } else {
          // Logged in but not verified — show pending screen
          setView("verify_pending");
        }
      }
    } catch (err: any) { setError(err.message); }
    finally { setAuthLoading(false); }
  };

  const handleReEdit = async (resumeId: number) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/resumeiq/resume/${resumeId}/data`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) { setError("Could not load resume data."); return; }
      const { parsedData: saved } = await res.json();
      if (!saved) { setError("Resume data not found."); return; }
      setParsedData(saved);
      setSessionId("reedit-" + resumeId);
      setIsFree(false);
      setResumeScore(null);
      setWorkingWithMeTeaser(saved.workingWithMe || null);
      setIncludePersonality(!!saved.workingWithMe);
      setView("preview");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Failed to load resume for editing.");
    }
  };

  const handleDeleteResume = async (resumeId: number, candidateName: string) => {
    if (!window.confirm(`Delete "${candidateName || "this resume"}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/resumeiq/resume/${resumeId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setHistory(prev => prev.filter((r: any) => r.id !== resumeId));
      }
    } catch { /* silent */ }
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
  const reset = () => { setView("upload"); setFile(null); setParsedData(null); setSessionId(""); setError(""); setIsFree(false); setEmailCaptured(false); setEmail(""); setShowPaidGuestModal(false); setGuestPassword(""); setGuestPasswordConfirm(""); setGuestAccountError(""); setAssessmentFiles([]); setPersonalityStep(false); setWorkingWithMeTeaser(null); setTeaserFields([]); setResumeScore(null); setPreTransformScore(null); };

  return (
    <div style={S}>
      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        input,textarea{color-scheme:dark;}
        @media (max-width: 640px) {
          .riq-preview-grid { grid-template-columns: 1fr !important; }
          .riq-features-grid { grid-template-columns: 1fr 1fr !important; }
          .riq-upload-pad { padding: 28px 16px 48px !important; }
          .riq-header { padding: 0 12px !important; }
        }
      `}</style>

      {/* Email verified success banner — only show on non-upload views */}
      {verifyBanner === "success" && view !== "upload" && (
        <div style={{ background: "rgba(16,185,129,0.12)", borderBottom: "1px solid rgba(16,185,129,0.25)", padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ color: "#34d399", fontSize: "13px", fontWeight: 600, margin: 0 }}>✓ Email verified — your account is fully set up.</p>
          <button onClick={() => setVerifyBanner(null)} style={{ background: "none", border: "none", color: "#34d399", cursor: "pointer", fontSize: "16px" }}>×</button>
        </div>
      )}

      {/* Unverified email banner — shown to logged-in users who haven't verified */}
      {user && !user.emailVerified && verifyBanner !== "success" && (
        <div style={{ background: "rgba(251,191,36,0.08)", borderBottom: "1px solid rgba(251,191,36,0.2)", padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
          <p style={{ color: "#fbbf24", fontSize: "13px", margin: 0 }}>
            📧 Check your inbox — verify your email to make sure you receive your results.
          </p>
          <button
            onClick={async () => {
              if (resendSent) return;
              const t = localStorage.getItem("riq_token");
              await fetch("/api/resumeiq/auth/resend-verification", { method: "POST", headers: { Authorization: `Bearer ${t}` } });
              setResendSent(true);
            }}
            style={{ background: "none", border: "1px solid rgba(251,191,36,0.4)", borderRadius: "6px", color: "#fbbf24", fontSize: "12px", fontWeight: 600, cursor: resendSent ? "default" : "pointer", padding: "4px 12px" }}
          >
            {resendSent ? "Email sent ✓" : "Resend verification"}
          </button>
        </div>
      )}

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
            <a href="/faq" style={{ background: "transparent", color: "#64748b", border: "none", cursor: "pointer", fontSize: "12px", textDecoration: "none" }}>FAQ</a>
            {user ? (
              <>
                <button onClick={() => { loadHistory(); setView("history"); }} style={{ background: "transparent", color: "#94a3b8", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", fontSize: "12px" }}>
                  <Clock size={13} />My Resumes
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: "7px", background: "rgba(255,255,255,0.1)", borderRadius: "999px", padding: "5px 11px" }}>
                  <User size={13} color="#60a5fa" />
                  <span style={{ color: "white", fontSize: "12px" }}>{user.name || user.email}</span>
                </div>
                {(() => {
                  const plan = planType || (user as any)?.plan || "free";
                  const badges: Record<string, { label: string; bg: string; color: string; border: string }> = {
                    monthly: { label: "✦ Pro", bg: "linear-gradient(135deg, rgba(0,200,150,0.2), rgba(37,99,235,0.2))", color: "#4ade80", border: "1px solid rgba(74,222,128,0.35)" },
                    agency:  { label: "✦ Agency", bg: "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(79,70,229,0.2))", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.35)" },
                    starter: { label: "Starter", bg: "rgba(37,99,235,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.3)" },
                    free:    { label: "Free", bg: "rgba(255,255,255,0.06)", color: "#64748b", border: "1px solid rgba(255,255,255,0.1)" },
                  };
                  const b = badges[plan] || badges.free;
                  return (
                    <div style={{ background: b.bg, border: b.border, borderRadius: "999px", padding: "4px 10px", display: "flex", alignItems: "center" }}>
                      <span style={{ color: b.color, fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em" }}>{b.label}</span>
                    </div>
                  );
                })()}
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

              {/* LinkedIn — primary CTA */}
              {view === "register" && (
                <div style={{ background: "rgba(0,119,181,0.08)", border: "1px solid rgba(0,119,181,0.25)", borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
                  <p style={{ fontSize: "12px", color: "#60a5fa", fontWeight: 600, margin: "0 0 8px" }}>✦ Recommended — faster and more accurate</p>
                  <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 12px", lineHeight: 1.6 }}>
                    LinkedIn fills in missing dates, skills, certifications, and education automatically — so your resume transformation is more complete without extra questions.
                  </p>
                  <button
                    onClick={() => {
                      if (file) sessionStorage.setItem("riq_pending_file", file.name);
                      window.location.href = "/api/resumeiq/auth/linkedin";
                    }}
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", background: "#0077B5", color: "white", border: "none", borderRadius: "8px", padding: "13px 16px", fontSize: "15px", fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 4px 16px rgba(0,119,181,0.3)" }}
                  >
                    <svg viewBox="0 0 24 24" style={{ width: "20px", height: "20px", fill: "white", flexShrink: 0 }}>
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    Continue with LinkedIn
                  </button>
                </div>
              )}

              {view === "login" && (
                <button
                  onClick={() => {
                      if (file) sessionStorage.setItem("riq_pending_file", file.name);
                      window.location.href = "/api/resumeiq/auth/linkedin";
                    }}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", background: "#0077B5", color: "white", border: "none", borderRadius: "8px", padding: "11px 16px", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginBottom: "16px" }}
                >
                  <svg viewBox="0 0 24 24" style={{ width: "18px", height: "18px", fill: "white", flexShrink: 0 }}>
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  Continue with LinkedIn
                </button>
              )}

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

                {notification && <p style={{ color: "#4ade80", fontSize: "13px", textAlign: "center", marginTop: "8px" }}>{notification}</p>}
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
            {/* File lost after LinkedIn OAuth — nudge to re-upload */}
            {pendingFileName && !file && (
              <div style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: "12px", padding: "14px 18px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "20px" }}>📄</span>
                <div>
                  <p style={{ color: "#fbbf24", fontSize: "13px", fontWeight: 600, margin: 0 }}>Almost there — just re-upload your resume</p>
                  <p style={{ color: "#94a3b8", fontSize: "12px", margin: "2px 0 0" }}>
                    Your account is ready. We couldn't hold onto <strong style={{ color: "white" }}>{pendingFileName}</strong> during sign-in — drop it below to continue.
                  </p>
                </div>
              </div>
            )}

            {/* SSO arrival banner — shown when coming from MyCareerIQ */}
            {user && new URLSearchParams(window.location.search).get("handoff") === null && localStorage.getItem("riq_from_mycareeriq") === "1" && (
              <div style={{ background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.4)", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "18px" }}>✓</span>
                <div>
                  <p style={{ color: "#93c5fd", fontSize: "13px", fontWeight: 600, margin: 0 }}>You're signed in as {user.email}</p>
                  <p style={{ color: "#60a5fa", fontSize: "12px", margin: "2px 0 0 0" }}>{(planType === "monthly" || planType === "agency" || (user as any)?.plan === "monthly" || (user as any)?.plan === "agency") ? "Unlimited transformations — included in your plan." : (planType === "starter" || (user as any)?.plan === "starter") ? "Up to 3 transformations included in your plan." : "Your first transformation is free — upload your resume below."}</p>
                </div>
              </div>
            )}

            <div style={{ textAlign: "center", marginBottom: "28px" }}>
              {verifyBanner === "success" ? (
                <>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "99px", padding: "6px 16px", marginBottom: "16px" }}>
                    <span style={{ color: "#34d399", fontSize: "14px" }}>✓</span>
                    <span style={{ color: "#34d399", fontSize: "13px", fontWeight: 600 }}>Email verified — you're all set</span>
                  </div>
                  <h1 style={{ color: "white", fontSize: "30px", fontWeight: "bold", marginBottom: "10px" }}>
                    Your free transformation<br/>is waiting.
                  </h1>
                  <p style={{ color: "#94a3b8", fontSize: "14px", marginBottom: "10px" }}>
                    Drop your resume below and we'll turn it into a polished, ATS-optimized Word document — scored before and after so you can see exactly what improved.
                  </p>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: "20px", padding: "5px 14px" }}>
                    <span style={{ color: "#4ade80", fontSize: "13px" }}>✦</span>
                    <span style={{ color: "#4ade80", fontSize: "13px", fontWeight: 600 }}>No credit card needed — completely free</span>
                  </div>
                </>
              ) : (
                <>
                  <h1 style={{ color: "white", fontSize: "30px", fontWeight: "bold", marginBottom: "10px" }}>
                    Your resume is about to get<br />
                    <span style={{ color: "#60a5fa" }}>a lot more callbacks.</span>
                  </h1>
                  <p style={{ color: "#94a3b8", fontSize: "14px", lineHeight: 1.6 }}>
                    Drop your resume below. We'll rewrite every bullet with measurable impact, optimize for ATS, and deliver a polished Word document — scored before and after so you see exactly what improved.
                  </p>
                  <div style={{ marginTop: "10px", display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: "20px", padding: "5px 14px" }}>
                    <span style={{ color: "#4ade80", fontSize: "13px" }}>✦</span>
                    <span style={{ color: "#4ade80", fontSize: "13px", fontWeight: 600 }}>
                      {((user as any)?.plan === "monthly" || (user as any)?.plan === "agency" || planType === "monthly" || planType === "agency") 
                        ? "Unlimited transformations — included in your plan" 
                        : ((user as any)?.plan === "starter" || planType === "starter")
                          ? `${Math.max(0, 3 - (user?.resumeCount || 0))} transformation${Math.max(0, 3 - (user?.resumeCount || 0)) === 1 ? "" : "s"} remaining — included in your plan`
                          : "First transformation is free"}
                    </span>
                  </div>
                </>
              )}
            </div>
            <div onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onDragOver={e => e.preventDefault()} onClick={() => fileInputRef.current?.click()}
              style={{ border: `2px dashed ${file ? "#3b82f6" : "rgba(255,255,255,0.2)"}`, borderRadius: "14px", padding: "44px", textAlign: "center", cursor: "pointer", background: file ? "rgba(59,130,246,0.1)" : "transparent", transition: "all 0.2s" }}>
              <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc" style={{ display: "none" }} onChange={(e: any) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              {file ? (
                <div><FileText size={44} color="#60a5fa" style={{ margin: "0 auto 10px" }} /><p style={{ color: "white", fontWeight: 600, fontSize: "16px", marginBottom: "3px" }}>{file.name}</p><p style={{ color: "#94a3b8", fontSize: "12px" }}>{(file.size / 1024).toFixed(0)} KB — Ready</p></div>
              ) : (
                <div><Upload size={44} color="#64748b" style={{ margin: "0 auto 10px" }} /><p style={{ color: "white", fontWeight: 600, fontSize: "15px", marginBottom: "3px" }}>Drop your resume here or click to browse</p><p style={{ color: "#64748b", fontSize: "12px" }}>PDF, DOCX, or DOC</p><p style={{ color: "#60a5fa", fontSize: "11px", marginTop: "6px" }}>💡 Word (.docx) gives the best results — PDF parsing can miss dates and formatting</p></div>
              )}
            </div>
            {error && <p style={{ color: "#f87171", textAlign: "center", marginTop: "10px", fontSize: "13px" }}>{error}</p>}

            {/* Target role — optional, helps tailor language and keywords */}
            {file && (
              <div style={{ marginTop: "16px" }}>
                <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                  What role or position are you looking for? <span style={{ color: "#64748b", fontWeight: 400 }}>(Optional — helps us tailor your language)</span>
                </label>
                <input
                  type="text"
                  value={targetRole}
                  onChange={e => setTargetRole(e.target.value)}
                  placeholder="e.g. Senior Account Executive, Enterprise SaaS"
                  style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", color: "white", fontSize: "14px", padding: "12px 14px", outline: "none", boxSizing: "border-box" }}
                />
              </div>
            )}

            {/* Personality assessments — optional, above the fold */}
            {file && (
              <div style={{ marginTop: "16px" }}>
                <div
                  onClick={() => setShowPersonalityOnUpload(!showPersonalityOnUpload)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: showPersonalityOnUpload ? "rgba(124,58,237,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${showPersonalityOnUpload ? "rgba(124,58,237,0.35)" : "rgba(255,255,255,0.1)"}`, borderRadius: showPersonalityOnUpload ? "12px 12px 0 0" : "12px", padding: "12px 16px", cursor: "pointer", transition: "all 0.2s" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "18px" }}>🧠</span>
                    <div>
                      <p style={{ color: "white", fontSize: "13px", fontWeight: 600, margin: 0 }}>
                        Add personality assessments <span style={{ color: "#a78bfa", fontSize: "11px", fontWeight: 500, marginLeft: "6px" }}>Optional</span>
                      </p>
                      <p style={{ color: "#64748b", fontSize: "12px", margin: "2px 0 0" }}>
                        DISC · MBTI · Predictive Index · TKI · 360 Feedback
                      </p>
                    </div>
                  </div>
                  <span style={{ color: "#64748b", fontSize: "18px", transition: "transform 0.2s", transform: showPersonalityOnUpload ? "rotate(180deg)" : "none" }}>⌄</span>
                </div>

                {showPersonalityOnUpload && (
                  <div style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.2)", borderTop: "none", borderRadius: "0 0 12px 12px", padding: "16px" }}>
                    <p style={{ color: "#c4b5fd", fontSize: "13px", marginBottom: "14px", lineHeight: 1.6 }}>
                      Most resumes tell hiring managers <em>what</em> you did. A <strong style={{ color: "white" }}>"Working With Me"</strong> section tells them <em>how</em> you work — how you communicate, make decisions, handle pressure, and collaborate. It's the question every hiring manager has but never gets answered until the interview. Candidates who answer it on paper get the call first.
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "14px" }}>
                      {ASSESSMENT_TYPES.map(a => {
                        const isSelected = uploadAssessments.some(u => u.id === a.id);
                        return (
                          <button key={a.id} onClick={() => {
                            if (isSelected) {
                              setUploadAssessments(uploadAssessments.filter(u => u.id !== a.id));
                            } else {
                              const uid = a.id === "other" ? `other-${Date.now()}` : a.id;
                              if (a.id !== "other" && uploadAssessments.some((u: any) => u.id === a.id)) return;
                              setUploadAssessments([...uploadAssessments, { id: uid, label: a.label, fileName: "", fileBase64: "", textInput: "" }]);
                            }
                          }}
                            style={{ background: isSelected ? "rgba(124,58,237,0.3)" : "rgba(255,255,255,0.06)", border: `1px solid ${isSelected ? "rgba(124,58,237,0.6)" : "rgba(255,255,255,0.12)"}`, borderRadius: "8px", padding: "6px 12px", color: isSelected ? "#c4b5fd" : "#94a3b8", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                            {isSelected ? "✓ " : ""}{a.label}
                          </button>
                        );
                      })}
                    </div>
                    {uploadAssessments.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {uploadAssessments.map((ua, idx) => (
                          <div key={ua.id} style={{ background: "rgba(255,255,255,0.05)", borderRadius: "8px", padding: "10px 12px" }}>
                            <p style={{ color: "#a78bfa", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>{ua.label}</p>
                            {ua.fileName ? (
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <span style={{ color: "#4ade80", fontSize: "12px" }}>✓ {ua.fileName}</span>
                                <button onClick={() => {
                                  const updated = [...uploadAssessments];
                                  updated[idx] = { ...ua, fileName: "", fileBase64: "" };
                                  setUploadAssessments(updated);
                                }} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "12px" }}>Remove</button>
                              </div>
                            ) : (
                              <div style={{ display: "flex", gap: "8px" }}>
                                <label style={{ flex: 1, background: "rgba(124,58,237,0.2)", border: "1px dashed rgba(124,58,237,0.4)", borderRadius: "6px", padding: "8px", textAlign: "center", cursor: "pointer", color: "#a78bfa", fontSize: "12px" }}>
                                  <input type="file" accept=".pdf,.docx,.doc,.txt" style={{ display: "none" }}
                                    onChange={async (e: any) => {
                                      const f = e.target.files?.[0];
                                      if (!f) return;
                                      const b64 = await new Promise<string>((resolve, reject) => {
                                        const reader = new FileReader();
                                        reader.onload = () => resolve((reader.result as string).split(",")[1]);
                                        reader.onerror = reject;
                                        reader.readAsDataURL(f);
                                      });
                                      const updated = [...uploadAssessments];
                                      updated[idx] = { ...ua, fileName: f.name, fileBase64: b64 };
                                      setUploadAssessments(updated);
                                    }} />
                                  Upload PDF / DOCX
                                </label>
                                <input
                                  type="text"
                                  value={ua.textInput}
                                  onChange={e => {
                                    const updated = [...uploadAssessments];
                                    updated[idx] = { ...ua, textInput: e.target.value };
                                    setUploadAssessments(updated);
                                  }}
                                  placeholder="Or paste results here..."
                                  style={{ flex: 2, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", color: "white", fontSize: "12px", padding: "8px 10px", outline: "none" }}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {uploadAssessments.length === 0 && (
                      <p style={{ color: "#475569", fontSize: "12px", textAlign: "center", fontStyle: "italic" }}>
                        Select the assessments you have above to upload them
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

              {!user && (
                <input
                  type="email"
                  placeholder="Enter your email to save and re-download"
                  value={guestEmail}
                  onChange={e => setGuestEmail(e.target.value)}
                  style={{ marginTop: "12px", marginBottom: "8px", width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", padding: "12px 16px", color: "white", fontSize: "14px", outline: "none", boxSizing: "border-box" }}
                />
              )}

            {file && (
              <button onClick={handleAnalyze} style={{ marginTop: "16px", width: "100%", background: "#2563eb", color: "white", border: "none", borderRadius: "11px", padding: "14px", fontSize: "16px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
                <Sparkles size={18} /> {uploadAssessments.some(u => u.fileName || u.textInput) ? "Analyze Resume + Personality →" : "Analyze My Resume →"}
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

            {/* Founder testimonial — always shown */}
            <div style={{ marginTop: "36px" }}>
              <p style={{ fontSize: "11px", color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, textAlign: "center", marginBottom: "16px" }}>What people are saying</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

                {/* Founder card — always shown */}
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "18px 20px" }}>
                  <div style={{ display: "flex", gap: "3px", marginBottom: "10px" }}>
                    {"★★★★★".split("").map((s,i) => <span key={i} style={{ color: "#fbbf24", fontSize: "14px" }}>{s}</span>)}
                  </div>
                  <p style={{ color: "#e2e8f0", fontSize: "13px", lineHeight: 1.7, marginBottom: "12px" }}>
                    "I built ResumeIQ after watching my own resume fail to communicate 18 years of enterprise sales experience. When I ran it through, the bullets that felt obvious to me finally read the way they should have the whole time. The score went from 3 to 8. The language became specific and defensible. It was the resume I should have had the whole time."
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "32px", height: "32px", background: "rgba(37,99,235,0.3)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, color: "#60a5fa" }}>B</div>
                    <div>
                      <p style={{ color: "white", fontSize: "12px", fontWeight: 600, margin: 0 }}>Bryan Greer</p>
                      <p style={{ color: "#64748b", fontSize: "11px", margin: 0 }}>Founder, ReviveIQI · 18 years enterprise sales</p>
                    </div>
                  </div>
                </div>

                {/* Dynamic testimonials from DB */}
                {testimonials.slice(0, 3).map((t: any) => (
                  <div key={t.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "18px 20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                      <div style={{ display: "flex", gap: "3px" }}>
                        {Array.from({ length: t.rating }).map((_,i) => <span key={i} style={{ color: "#fbbf24", fontSize: "14px" }}>★</span>)}
                      </div>
                      {t.preScore && t.postScore && (
                        <span style={{ fontSize: "11px", color: "#34d399", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "99px", padding: "2px 8px", fontFamily: "DM Mono, monospace" }}>
                          {t.preScore} → {t.postScore}
                        </span>
                      )}
                    </div>
                    <p style={{ color: "#e2e8f0", fontSize: "13px", lineHeight: 1.7, marginBottom: "12px" }}>"{t.quote}"</p>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: "32px", height: "32px", background: "rgba(37,99,235,0.2)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, color: "#60a5fa" }}>
                        {(t.name || "U")[0].toUpperCase()}
                      </div>
                      <div>
                        <p style={{ color: "white", fontSize: "12px", fontWeight: 600, margin: 0, filter: "blur(4px)", userSelect: "none" }}>{t.name}</p>
                        {t.title && <p style={{ color: "#64748b", fontSize: "11px", margin: 0, filter: "blur(4px)", userSelect: "none" }}>{t.title}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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

        {/* ── SCORE VIEW ─────────────────────────────────────────────── */}
        {/* ── LINKEDIN CONFIRM ── */}
        {view === "linkedin_confirm" && (() => {
          const missing = getMissingFields(parsedData);
          const exp = parsedData.experience || [];
          const hasNoDates = exp.some((e: any) => !e.startDate);
          const hasNoSkills = !parsedData.skills?.categories?.length;
          const hasNoEducation = !parsedData.education?.length;

          const proceedToNext = () => {
            // Apply any confirmed edits to parsedData
            const updated = { ...parsedData };
            if (confirmEdits.location) updated.location = confirmEdits.location;
            if (confirmEdits.title) updated.title = confirmEdits.title;
            setParsedData(updated);

            // If there are still non-LinkedIn fields missing, show interview
            const remainingFields = interviewFields.filter(f => f.length > 0);
            const industry = updated.industry || "other";
            if (remainingFields.length > 0) {
              setInterviewStep(0); setInterviewAnswer(""); setView("interview");
            } else if (INDUSTRY_SKILLS[industry]) {
              setView("skill_suggestions");
            } else {
              setView("scoring");
            }
          };

          return (
            <div style={{ maxWidth: "560px", margin: "0 auto" }}>
              <div style={{ textAlign: "center", marginBottom: "28px" }}>
                <div style={{ fontSize: "28px", marginBottom: "12px" }}>🔗</div>
                <h2 style={{ color: "white", fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>We found a few gaps</h2>
                <p style={{ color: "#64748b", fontSize: "14px", lineHeight: 1.6 }}>
                  Your resume was missing some structured details. Here's what we pulled from your LinkedIn profile to fill them in — confirm or edit before we transform.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

                {/* LinkedIn identity confirmation */}
                {linkedinProfile?.name && (
                  <div style={{ background: "rgba(0,119,181,0.08)", border: "1px solid rgba(0,119,181,0.2)", borderRadius: "12px", padding: "16px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                      <svg viewBox="0 0 24 24" style={{ width: "14px", height: "14px", fill: "#0077B5", flexShrink: 0 }}>
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                      <span style={{ fontSize: "11px", color: "#60a5fa", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>From LinkedIn</span>
                    </div>
                    <p style={{ color: "white", fontSize: "14px", fontWeight: 600, margin: 0 }}>{linkedinProfile.name}</p>
                    <p style={{ color: "#64748b", fontSize: "12px", margin: "2px 0 0" }}>{linkedinProfile.email}</p>
                  </div>
                )}

                {/* Missing dates notice */}
                {hasNoDates && (
                  <div style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: "12px", padding: "16px 20px" }}>
                    <p style={{ color: "#fbbf24", fontSize: "13px", fontWeight: 600, margin: "0 0 6px" }}>📅 Employment dates missing</p>
                    <p style={{ color: "#94a3b8", fontSize: "13px", margin: "0 0 12px", lineHeight: 1.6 }}>
                      We couldn't find start dates for {exp.filter((e: any) => !e.startDate).length} of your roles. Once LinkedIn's enhanced profile access is approved, we'll pull these automatically. For now, add them below:
                    </p>
                    <textarea rows={3} placeholder={exp.filter((e: any) => !e.startDate).map((e: any) => `${e.title} at ${e.company}: [Start date] – ${e.endDate || "Present"}`).join("\n")}
                      onChange={e => setConfirmEdits(prev => ({ ...prev, dates: e.target.value }))}
                      style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "white", fontSize: "13px", padding: "10px 12px", outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "DM Mono, monospace" }} />
                  </div>
                )}

                {/* Skills confirmation */}
                {hasNoSkills && (
                  <div style={{ background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.15)", borderRadius: "12px", padding: "16px 20px" }}>
                    <p style={{ color: "#60a5fa", fontSize: "13px", fontWeight: 600, margin: "0 0 6px" }}>🛠 Skills not found on resume</p>
                    <p style={{ color: "#94a3b8", fontSize: "13px", margin: "0 0 12px", lineHeight: 1.6 }}>We'll suggest industry-relevant skills in the next step based on your role. You can add or remove any of them.</p>
                    <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: "8px", padding: "8px 12px" }}>
                      <p style={{ color: "#34d399", fontSize: "12px", margin: 0 }}>✓ Industry skill suggestions coming up next</p>
                    </div>
                  </div>
                )}

                {/* Education confirmation */}
                {hasNoEducation && (
                  <div style={{ background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.15)", borderRadius: "12px", padding: "16px 20px" }}>
                    <p style={{ color: "#60a5fa", fontSize: "13px", fontWeight: 600, margin: "0 0 10px" }}>🎓 Education not found — add it here</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <input placeholder="Degree & major (e.g. B.S. Marketing)" onChange={e => setConfirmEdits(prev => ({ ...prev, degree: e.target.value }))}
                        style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "white", fontSize: "13px", padding: "9px 12px", outline: "none", boxSizing: "border-box" }} />
                      <input placeholder="School name" onChange={e => setConfirmEdits(prev => ({ ...prev, school: e.target.value }))}
                        style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "white", fontSize: "13px", padding: "9px 12px", outline: "none", boxSizing: "border-box" }} />
                      <input placeholder="Graduation year" onChange={e => setConfirmEdits(prev => ({ ...prev, gradYear: e.target.value }))}
                        style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "white", fontSize: "13px", padding: "9px 12px", outline: "none", boxSizing: "border-box" }} />
                    </div>
                  </div>
                )}

                {/* All looks good notice */}
                {!hasNoDates && !hasNoSkills && !hasNoEducation && (
                  <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "12px", padding: "16px 20px", textAlign: "center" }}>
                    <p style={{ color: "#34d399", fontSize: "14px", fontWeight: 600, margin: "0 0 4px" }}>✓ Everything looks complete</p>
                    <p style={{ color: "#64748b", fontSize: "13px", margin: 0 }}>Your resume has all the structured data we need. Ready to transform.</p>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                <button onClick={proceedToNext}
                  style={{ flex: 1, background: "#2563eb", color: "white", border: "none", borderRadius: "9px", padding: "13px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                  Looks good — transform my resume →
                </button>
              </div>

              <p style={{ fontSize: "11px", color: "#475569", textAlign: "center", marginTop: "12px" }}>
                Once LinkedIn's enhanced profile access is approved, missing dates and certifications will be filled automatically.
              </p>
            </div>
          );
        })()}

        {/* ── SKILL SUGGESTIONS ── */}
        {view === "skill_suggestions" && (() => {
          const industry = parsedData.industry || "other";
          const suggestions = INDUSTRY_SKILLS[industry] || [];
          const existingSkills = (parsedData.skills?.categories || []).flatMap((c: any) => c.skills || []).map((s: string) => s.toLowerCase());
          const industryLabel = INDUSTRY_LABELS[industry] || "your industry";

          const toggleSkill = (skill: string) => {
            setSuggestedSkills(prev =>
              prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
            );
          };

          const handleAddSkills = () => {
            let dataToScore = parsedData;
            if (suggestedSkills.length > 0) {
              const updated = { ...parsedData };
              const existing = updated.skills?.categories || [];
              const suggestionCategory = { name: "Industry Standard", skills: suggestedSkills };
              updated.skills = { categories: [...existing.filter((c: any) => c.name !== "Industry Standard"), suggestionCategory] };
              setParsedData(updated);
              dataToScore = updated;
            }
            setResumeScore(null);
            setView("scoring");
            setScoreLoading(true);
            const scoreTimeout = setTimeout(() => {
              setScoreLoading(false);
              setResumeScore({ overall: 5, dimensions: {}, topIssues: [] });
            }, 15000);
            fetch("/api/resumeiq/score", {
              method: "POST",
              headers: { "Content-Type": "application/json", ...(token ? { "Authorization": `Bearer ${token}` } : {}) },
              body: JSON.stringify({ parsedData: dataToScore }),
            }).then(r => r.ok ? r.json() : null)
              .then(scores => { clearTimeout(scoreTimeout); setResumeScore(scores || { overall: 5, dimensions: {}, topIssues: [] }); setScoreLoading(false); })
              .catch(() => { clearTimeout(scoreTimeout); setResumeScore({ overall: 5, dimensions: {}, topIssues: [] }); setScoreLoading(false); });
          };

          return (
            <div style={{ maxWidth: "560px", margin: "0 auto" }}>
              <div style={{ textAlign: "center", marginBottom: "28px" }}>
                <div style={{ fontSize: "28px", marginBottom: "12px" }}>🎯</div>
                <h2 style={{ color: "white", fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>One more thing</h2>
                <p style={{ color: "#64748b", fontSize: "14px", lineHeight: 1.6 }}>
                  Based on your {industryLabel} background, you likely have these skills — but they weren't on your resume. Tap any that apply.
                </p>
              </div>

              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "24px" }}>
                {suggestions.map(cat => {
                  const newSkills = cat.skills.filter(s => !existingSkills.includes(s.toLowerCase()));
                  if (!newSkills.length) return null;
                  return (
                    <div key={cat.cat} style={{ marginBottom: "20px" }}>
                      <p style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>{cat.cat}</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {newSkills.map(skill => {
                          const selected = suggestedSkills.includes(skill);
                          return (
                            <button key={skill} onClick={() => toggleSkill(skill)} style={{
                              padding: "7px 14px", borderRadius: "99px", fontSize: "13px", fontWeight: 500, cursor: "pointer",
                              border: selected ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.12)",
                              background: selected ? "rgba(37,99,235,0.2)" : "rgba(255,255,255,0.05)",
                              color: selected ? "#60a5fa" : "#94a3b8", transition: "all 0.15s",
                            }}>{selected ? "✓ " : ""}{skill}</button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {suggestedSkills.length > 0 && (
                  <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px" }}>
                    <p style={{ color: "#34d399", fontSize: "12px", margin: 0 }}>
                      {suggestedSkills.length} skill{suggestedSkills.length !== 1 ? "s" : ""} will be added to your resume
                    </p>
                  </div>
                )}

                <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                  <button onClick={() => {
                    setResumeScore(null);
                    setView("scoring");
                    setScoreLoading(true);
                    const t = setTimeout(() => { setScoreLoading(false); setResumeScore({ overall: 5, dimensions: {}, topIssues: [] }); }, 15000);
                    fetch("/api/resumeiq/score", {
                      method: "POST",
                      headers: { "Content-Type": "application/json", ...(token ? { "Authorization": `Bearer ${token}` } : {}) },
                      body: JSON.stringify({ parsedData }),
                    }).then(r => r.ok ? r.json() : null)
                      .then(s => { clearTimeout(t); setResumeScore(s || { overall: 5, dimensions: {}, topIssues: [] }); setScoreLoading(false); })
                      .catch(() => { clearTimeout(t); setResumeScore({ overall: 5, dimensions: {}, topIssues: [] }); setScoreLoading(false); });
                  }}
                    style={{ flex: 1, background: "rgba(255,255,255,0.06)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "9px", padding: "12px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                    Skip
                  </button>
                  <button onClick={handleAddSkills}
                    style={{ flex: 2, background: "#2563eb", color: "white", border: "none", borderRadius: "9px", padding: "12px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                    {suggestedSkills.length > 0 ? `Add ${suggestedSkills.length} skill${suggestedSkills.length !== 1 ? "s" : ""} →` : "Continue →"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── SCORING ── */}
        {view === "scoring" && (
          <div style={{ maxWidth: "560px", margin: "0 auto", padding: "48px 16px" }}>
            {scoreLoading || !resumeScore ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <Loader2 size={40} color="#60a5fa" style={{ margin: "0 auto 16px", ...spin }} />
                <p style={{ color: "#94a3b8", fontSize: "14px" }}>Scoring your resume...</p>
              </div>
            ) : (
              <>
                {/* Overall score */}
                <div style={{ textAlign: "center", marginBottom: "32px" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "88px", height: "88px", borderRadius: "50%", background: resumeScore.overall >= 7 ? "rgba(74,222,128,0.15)" : resumeScore.overall >= 5 ? "rgba(251,191,36,0.15)" : "rgba(239,68,68,0.15)", border: `2px solid ${resumeScore.overall >= 7 ? "#4ade80" : resumeScore.overall >= 5 ? "#fbbf24" : "#ef4444"}`, marginBottom: "16px" }}>
                    <span style={{ fontSize: "32px", fontWeight: 800, color: resumeScore.overall >= 7 ? "#4ade80" : resumeScore.overall >= 5 ? "#fbbf24" : "#ef4444", fontFamily: "Montserrat, sans-serif" }}>{resumeScore.overall}</span>
                  </div>
                  <h2 style={{ color: "white", fontSize: "22px", fontWeight: 800, marginBottom: "8px", fontFamily: "Montserrat, sans-serif" }}>
                    Your ATS Score: {resumeScore.overall}/10
                  </h2>
                  <p style={{ color: "#94a3b8", fontSize: "14px" }}>
                    {resumeScore.overall >= 7 ? "Good foundation — transformation will make it excellent." : resumeScore.overall >= 5 ? "Room to improve — transformation will significantly boost your callbacks." : "Needs work — the more context you add in the preview, the stronger your transformation will be."}
                  </p>
                  {resumeScore.overall <= 5 && (
                    <div style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: "10px", padding: "14px 16px", marginTop: "16px", textAlign: "left" }}>
                      <p style={{ color: "#fbbf24", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>💡 Get a better result</p>
                      <p style={{ color: "#fde68a", fontSize: "12px", margin: 0, lineHeight: 1.6 }}>
                        In the preview, check each role for missing dates, add accomplishments to thin roles, and fill in any blank fields. The more complete your resume, the stronger the transformation.
                      </p>
                    </div>
                  )}
                </div>

                {/* 4 dimension bars */}
                <div style={{ background: "#0f172a", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.08)", padding: "24px", marginBottom: "20px" }}>
                  {Object.entries(resumeScore.dimensions || {}).map(([key, dim]: [string, any]) => {
                    const labels: Record<string, string> = { atsFormat: "ATS Format", bulletQuality: "Bullet Quality", keywords: "Keywords", completeness: "Completeness" };
                    const color = dim.score >= 7 ? "#4ade80" : dim.score >= 5 ? "#fbbf24" : "#ef4444";
                    return (
                      <div key={key} style={{ marginBottom: "18px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                          <span style={{ color: "white", fontSize: "13px", fontWeight: 600 }}>{labels[key] || key}</span>
                          <span style={{ color, fontSize: "13px", fontWeight: 700 }}>{dim.score}/10</span>
                        </div>
                        <div style={{ height: "5px", background: "rgba(255,255,255,0.08)", borderRadius: "999px", overflow: "hidden", marginBottom: "6px" }}>
                          <div style={{ height: "100%", width: `${dim.score * 10}%`, background: color, borderRadius: "999px", transition: "width 1s ease" }} />
                        </div>
                        <p style={{ color: "#64748b", fontSize: "12px", margin: 0 }}>{dim.reason}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Top issues or strengths */}
                {resumeScore.topIssues?.length > 0 && (() => {
                  const isStrengths = resumeScore.overall >= 8 &&
                    !resumeScore.topIssues.some((t: string) =>
                      /missing|no bullets|add \d|should be|needs|weak|missing/i.test(t)
                    );
                  return (
                    <div style={{ background: isStrengths ? "rgba(74,222,128,0.06)" : "rgba(239,68,68,0.06)", border: `1px solid ${isStrengths ? "rgba(74,222,128,0.15)" : "rgba(239,68,68,0.15)"}`, borderRadius: "10px", padding: "16px", marginBottom: "24px" }}>
                      <p style={{ color: isStrengths ? "#4ade80" : "#f87171", fontSize: "12px", fontWeight: 700, marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {isStrengths ? "Strengths identified" : "What's holding you back"}
                      </p>
                      {resumeScore.topIssues.map((issue: string, i: number) => (
                        <div key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginBottom: "6px" }}>
                          <span style={{ color: isStrengths ? "#4ade80" : "#ef4444", fontSize: "12px", flexShrink: 0, marginTop: "1px" }}>{isStrengths ? "✓" : "✗"}</span>
                          <span style={{ color: isStrengths ? "#bbf7d0" : "#fca5a5", fontSize: "13px" }}>{issue}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* CTA — different for high scorers */}
                {resumeScore.overall >= 8 ? (
                  <>
                    {/* High score WWM intercept */}
                    <div style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.12), rgba(37,99,235,0.08))", border: "1px solid rgba(124,58,237,0.3)", borderRadius: "14px", padding: "24px", marginBottom: "16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                        <span style={{ fontSize: "24px" }}>🧠</span>
                        <div>
                          <p style={{ color: "white", fontSize: "15px", fontWeight: 700, margin: 0 }}>Your resume is already strong.</p>
                          <p style={{ color: "#a78bfa", fontSize: "12px", margin: "2px 0 0" }}>Here's what separates the candidates who get the offer.</p>
                        </div>
                      </div>
                      <p style={{ color: "#c4b5fd", fontSize: "13px", lineHeight: 1.75, marginBottom: "16px" }}>
                        The candidates you're competing with have the same credentials, same bullet format, same ATS score. The ones who get the offer answer a question yours doesn't — <strong style={{ color: "white" }}>how do you actually work?</strong>
                      </p>
                      <p style={{ color: "#c4b5fd", fontSize: "13px", lineHeight: 1.75, marginBottom: "20px" }}>
                        A "Working With Me" section — synthesized from your DISC, MBTI, or Predictive Index results — tells hiring managers your communication style, decision-making approach, how you perform under pressure, and what brings out your best work. In plain language. Before the interview.
                      </p>
                      <p style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "16px" }}>
                        No other resume tool offers this section. No other candidate in the pile has it.
                      </p>
                      <button
                        onClick={() => {
                          if (workingWithMeTeaser) {
                            // Already generated — go straight to preview where it's visible
                            setView("preview");
                            setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 300);
                          } else {
                            // Not yet generated — open the personality upload modal
                            setPersonalityStep(true);
                          }
                        }}
                        style={{ width: "100%", background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "white", border: "none", borderRadius: "10px", padding: "14px", fontSize: "15px", fontWeight: 700, cursor: "pointer", marginBottom: "10px", boxShadow: "0 4px 20px rgba(124,58,237,0.3)" }}
                      >
                        {workingWithMeTeaser ? "View My Working With Me Section →" : (((user as any)?.plan || planType || localStorage.getItem("riq_plan") || "free") === "monthly" || ((user as any)?.plan || planType || localStorage.getItem("riq_plan") || "free") === "agency" || ((user as any)?.plan || planType || localStorage.getItem("riq_plan") || "free") === "starter") ? "Add Working With Me — Included in Plan →" : "Add \"Working With Me\" — $7.99 →"}
                      </button>
                      <button
                        onClick={() => setView("preview")}
                        style={{ width: "100%", background: "linear-gradient(135deg,#2563eb,#1d4ed8)", color: "white", border: "none", borderRadius: "10px", padding: "14px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}
                      >
                        See my transformed resume first →
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setView("preview")}
                      style={{ width: "100%", background: "linear-gradient(135deg,#2563eb,#1d4ed8)", color: "white", border: "none", borderRadius: "10px", padding: "16px", fontSize: "15px", fontWeight: 700, cursor: "pointer", fontFamily: "DM Sans, sans-serif", marginBottom: "10px" }}
                    >
                      Transform My Resume → Fix These Issues
                    </button>

                    {/* Working With Me nudge — lower scores */}
                    <div style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: "10px", padding: "14px 16px", marginBottom: "10px", textAlign: "left" }}>
                      <p style={{ color: "#a78bfa", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>🧠 Stand out beyond the bullets</p>
                      <p style={{ color: "#c4b5fd", fontSize: "12px", margin: 0, lineHeight: 1.6 }}>
                        Every resume in the pile shows work history. A <strong style={{ color: "white" }}>"Working With Me"</strong> section shows self-awareness — how you communicate, decide, and perform under pressure. Hiring managers remember it because no one else has it. Upload your DISC, MBTI, or Predictive Index results after transformation to add it.
                      </p>
                    </div>

                    <button
                      onClick={() => setView("preview")}
                      style={{ width: "100%", background: "transparent", color: "#64748b", border: "none", fontSize: "13px", cursor: "pointer", padding: "8px" }}
                    >
                      Skip — review resume first
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}
        {/* ── VERIFY PENDING ── */}
        {view === "verify_pending" && (() => {
          // If user is already verified, don't show this screen
          if (user?.emailVerified) {
            setTimeout(() => {
              if (file) { setView("analyzing"); handleAnalyzeWithToken(token); }
              else setView("upload");
            }, 100);
            return (
              <div style={{ maxWidth: "480px", margin: "0 auto", textAlign: "center" }}>
                <div style={{ fontSize: "52px", marginBottom: "20px" }}>✅</div>
                <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: "24px", color: "white", marginBottom: "12px" }}>Email verified</h2>
                <p style={{ color: "#94a3b8", fontSize: "15px" }}>Taking you to your resume{file ? " transformation" : ""}...</p>
              </div>
            );
          }

          return (
          <div style={{ maxWidth: "480px", margin: "0 auto", textAlign: "center" }}>
            <div style={{ fontSize: "52px", marginBottom: "20px" }}>📧</div>
            <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: "24px", color: "white", marginBottom: "12px" }}>
              Check your inbox
            </h2>
            <p style={{ color: "#94a3b8", fontSize: "15px", lineHeight: 1.7, marginBottom: "8px" }}>
              We sent a verification link to <strong style={{ color: "white" }}>{user?.email}</strong>.
            </p>
            <p style={{ color: "#94a3b8", fontSize: "15px", lineHeight: 1.7, marginBottom: "32px" }}>
              Click the link in the email to verify your account {file ? "and we'll start transforming your resume automatically." : "and continue."}
            </p>

            {file && (
              <div style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)", borderRadius: "12px", padding: "14px 18px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "20px" }}>📄</span>
                <div style={{ textAlign: "left" }}>
                  <p style={{ color: "white", fontSize: "13px", fontWeight: 600, margin: 0 }}>{file.name}</p>
                  <p style={{ color: "#64748b", fontSize: "12px", margin: "2px 0 0" }}>Ready to transform once verified</p>
                </div>
                <div style={{ marginLeft: "auto", width: "10px", height: "10px", background: "#2563eb", borderRadius: "50%", boxShadow: "0 0 8px #2563eb", animation: "pulse 2s infinite" }} />
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                onClick={async () => {
                  if (resendSent) return;
                  const t = localStorage.getItem("riq_token");
                  const res = await fetch("/api/resumeiq/auth/resend-verification", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${t}` }
                  });
                  const data = await res.json();
                  if (data.alreadyVerified) {
                    // They're already verified — refresh user and proceed
                    if (t) fetch("/api/resumeiq/auth/me", { headers: { Authorization: `Bearer ${t}` } })
                      .then(r => r.json()).then(d => { if (d.id) { setUser(d); setVerifyBanner("success"); if (file) { setView("analyzing"); handleAnalyzeWithToken(t); } else setView("upload"); } }).catch(() => {});
                  } else {
                    setResendSent(true);
                  }
                }}
                style={{ background: resendSent ? "rgba(255,255,255,0.04)" : "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)", borderRadius: "9px", padding: "12px", color: resendSent ? "#64748b" : "#60a5fa", fontSize: "14px", fontWeight: 600, cursor: resendSent ? "default" : "pointer" }}
              >
                {resendSent ? "Verification email sent ✓" : "Resend verification email"}
              </button>
              <button onClick={() => { setView("upload"); setFile(null); }}
                style={{ background: "transparent", border: "none", color: "#475569", fontSize: "13px", cursor: "pointer", padding: "8px" }}>
                Use a different email instead
              </button>
            </div>

            <p style={{ color: "#334155", fontSize: "12px", marginTop: "24px", lineHeight: 1.6 }}>
              Can't find it? Check your spam folder. The email comes from bryan@reviveiqi.com.
            </p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "20px" }}>
              <div style={{ width: "6px", height: "6px", background: "#2563eb", borderRadius: "50%", animation: "pulse 1.5s infinite" }} />
              <p style={{ color: "#334155", fontSize: "11px", margin: 0 }}>Watching for verification — this page will update automatically</p>
            </div>
          </div>
          );
        })()}

        {/* ── INTERVIEW ── */}
        {/* ── ENRICHMENT VIEW ──────────────────────────────────────────────── */}
        {view === "enrichment" && (
          <div style={{ maxWidth: 560, margin: "0 auto", padding: "40px 24px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 32 }}>
              {["Pass 1: Parsed ✓", "Pass 2: Enrich", "Pass 3: Validate"].map((label, i) => (
                <div key={i} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ height: 4, borderRadius: 99, background: i === 0 ? "#2563eb" : "rgba(255,255,255,0.12)", marginBottom: 6 }} />
                  <div style={{ fontSize: 11, color: i === 0 ? "#93c5fd" : "rgba(148,163,184,0.6)", fontWeight: i === 0 ? 600 : 400 }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)", borderRadius: 14, padding: "16px 20px", marginBottom: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "#60a5fa", marginBottom: 4 }}>Pass 1 complete ✓</div>
              <div style={{ fontSize: 14, color: "rgba(248,250,252,0.85)" }}>Your resume has been parsed and analyzed. Answer a few optional questions to tailor your output — or skip straight to validation.</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 20 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 8 }}>What role are you targeting? <span style={{ color: "#64748b", fontWeight: 400 }}>(optional)</span></label>
                <input type="text" value={enrichmentAnswers.targetRole} onChange={e => setEnrichmentAnswers(prev => ({ ...prev, targetRole: e.target.value }))}
                  placeholder="e.g. Senior Account Executive, Enterprise SaaS"
                  style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "white", fontSize: 14, padding: "12px 14px", outline: "none", boxSizing: "border-box" as const }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 8 }}>Any major win not captured in your resume? <span style={{ color: "#64748b", fontWeight: 400 }}>(optional)</span></label>
                <textarea value={enrichmentAnswers.careerHighlight} onChange={e => setEnrichmentAnswers(prev => ({ ...prev, careerHighlight: e.target.value }))}
                  placeholder="e.g. Led a digital transformation that saved $2M — before I started documenting my work"
                  rows={3} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "white", fontSize: 14, padding: "12px 14px", outline: "none", boxSizing: "border-box" as const, resize: "vertical" as const }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 8 }}>Any career gaps or transitions to address? <span style={{ color: "#64748b", fontWeight: 400 }}>(optional)</span></label>
                <input type="text" value={enrichmentAnswers.transitionContext} onChange={e => setEnrichmentAnswers(prev => ({ ...prev, transitionContext: e.target.value }))}
                  placeholder="e.g. 6-month gap — family caregiving; pivoting from finance to tech"
                  style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "white", fontSize: 14, padding: "12px 14px", outline: "none", boxSizing: "border-box" as const }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
              <button onClick={() => handleEnrichmentComplete(true)}
                style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "#94a3b8", fontSize: 14, fontWeight: 500, padding: "13px", cursor: "pointer" }}>
                Skip → validate now
              </button>
              <button onClick={() => handleEnrichmentComplete(false)}
                style={{ flex: 2, background: "#2563eb", border: "none", borderRadius: 10, color: "white", fontSize: 15, fontWeight: 700, padding: "13px", cursor: "pointer" }}>
                ✦ Enrich My Resume →
              </button>
            </div>
          </div>
        )}

        {/* ── VALIDATING VIEW ────────────────────────────────────────────────── */}
        {view === "validating" && (
          <div style={{ maxWidth: 480, margin: "60px auto", padding: "0 24px", textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 40 }}>
              {["Pass 1: Parsed ✓", analysisStep >= 1 ? "Pass 2: Enriching..." : "Pass 2: Enrich", analysisStep >= 2 ? "Pass 3: Validating..." : "Pass 3: Validate"].map((label, i) => (
                <div key={i} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ height: 4, borderRadius: 99, background: i <= analysisStep ? "#2563eb" : "rgba(255,255,255,0.12)", marginBottom: 6, transition: "background 0.4s" }} />
                  <div style={{ fontSize: 11, color: i <= analysisStep ? "#93c5fd" : "rgba(148,163,184,0.6)", fontWeight: i <= analysisStep ? 600 : 400 }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ width: 48, height: 48, border: "3px solid rgba(37,99,235,0.2)", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 20px" }} />
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
              {analysisStep === 1 ? "Enriching your profile..." : "Running final validation..."}
            </div>
            <div style={{ fontSize: 14, color: "#94a3b8" }}>
              {analysisStep === 1 ? "Incorporating your context into the summary and key bullets" : "Reviewing output as a hiring manager would"}
            </div>
          </div>
        )}

        {view === "interview" && currentInterviewQ && (
          <div style={{ maxWidth: "560px", margin: "0 auto" }}>

            {/* Why we ask — first question only */}
            {interviewStep === 0 && (
              <div style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.25)", borderRadius: "12px", padding: "16px 20px", marginBottom: "28px" }}>
                <p style={{ color: "#60a5fa", fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>💡 A few quick questions</p>
                <p style={{ color: "#93c5fd", fontSize: "13px", margin: 0, lineHeight: 1.6 }}>
                  We couldn't find everything we need in your resume. Answer these and we'll build the strongest version possible. Most take under 10 seconds.
                </p>
              </div>
            )}

            {/* Progress */}
            <div style={{ textAlign: "center", marginBottom: "28px" }}>
              <div style={{ display: "flex", gap: "4px", justifyContent: "center", marginBottom: "12px" }}>
                {interviewFields.map((_, i) => (
                  <div key={i} style={{ height: "3px", width: "32px", borderRadius: "2px", background: i <= interviewStep ? "#3b82f6" : "rgba(255,255,255,0.1)", transition: "background 0.3s" }} />
                ))}
              </div>
              <span style={{ color: "#60a5fa", fontSize: "12px", fontWeight: 600 }}>
                {interviewStep + 1} of {interviewFields.length}
              </span>
            </div>

            {/* Question card */}
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "28px 24px" }}>
              <h2 style={{ color: "white", fontSize: "20px", fontWeight: 700, marginBottom: "6px", lineHeight: 1.3 }}>
                {currentInterviewQ.question}
              </h2>
              <p style={{ color: "#64748b", fontSize: "13px", marginBottom: "20px" }}>
                {currentInterviewQ.required ? "Required" : "Optional — tap Skip if not applicable"}
              </p>

              {/* ── SKILLS — chip selector ── */}
              {currentInterviewQ.field === "skills" && (() => {
                const SKILL_CHIPS = [
                  { cat: "CRM & Sales Tools", items: ["Salesforce","HubSpot","Outreach","Salesloft","Gong","Clari","ZoomInfo","Apollo","LinkedIn Sales Nav","Groove"] },
                  { cat: "Software & Productivity", items: ["Excel","PowerPoint","Google Sheets","Slack","Notion","Asana","Jira","Tableau","Power BI","Zoom"] },
                  { cat: "Marketing & Growth", items: ["Marketo","Pardot","Google Analytics","SEMrush","Mailchimp","Klaviyo","Meta Ads","Google Ads","HubSpot Marketing","Drift"] },
                  { cat: "Tech & Engineering", items: ["Python","JavaScript","SQL","React","Node.js","AWS","GCP","Azure","Docker","Git"] },
                  { cat: "Soft Skills", items: ["Team Leadership","Cross-functional collaboration","Strategic planning","Executive communication","Change management","Coaching & mentoring"] },
                ];
                const selected = interviewAnswer ? interviewAnswer.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
                const toggle = (skill: string) => {
                  const current = interviewAnswer ? interviewAnswer.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
                  const next = current.includes(skill) ? current.filter((s: string) => s !== skill) : [...current, skill];
                  setInterviewAnswer(next.join(", "));
                };
                return (
                  <div>
                    {SKILL_CHIPS.map(cat => (
                      <div key={cat.cat} style={{ marginBottom: "14px" }}>
                        <p style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>{cat.cat}</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {cat.items.map(skill => {
                            const isSelected = selected.includes(skill);
                            return (
                              <button key={skill} onClick={() => toggle(skill)} style={{
                                padding: "6px 12px", borderRadius: "99px", fontSize: "12px", fontWeight: 500, cursor: "pointer",
                                border: isSelected ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.12)",
                                background: isSelected ? "rgba(37,99,235,0.2)" : "rgba(255,255,255,0.05)",
                                color: isSelected ? "#60a5fa" : "#94a3b8", transition: "all 0.15s",
                              }}>{isSelected ? "✓ " : ""}{skill}</button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <div style={{ marginTop: "12px" }}>
                      <input type="text" placeholder="Add your own (comma separated)..."
                        style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "white", fontSize: "13px", padding: "10px 12px", outline: "none", boxSizing: "border-box" }}
                        onBlur={e => {
                          const custom = e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean);
                          if (custom.length) {
                            const current = interviewAnswer ? interviewAnswer.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
                            const merged = Array.from(new Set([...current, ...custom]));
                            setInterviewAnswer(merged.join(", "));
                            e.target.value = "";
                          }
                        }}
                      />
                    </div>
                    {selected.length > 0 && (
                      <p style={{ marginTop: "10px", fontSize: "12px", color: "#64748b" }}>
                        {selected.length} skill{selected.length !== 1 ? "s" : ""} selected
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* ── TITLE — quick pick chips + custom ── */}
              {currentInterviewQ.field === "title" && (() => {
                const TITLES = [
                  "Account Executive", "Senior Account Executive", "Enterprise AE",
                  "Sales Manager", "Director of Sales", "VP of Sales",
                  "Customer Success Manager", "Sales Development Rep",
                  "Software Engineer", "Senior Software Engineer", "Product Manager",
                  "Marketing Manager", "Operations Manager", "Account Manager",
                ];
                return (
                  <div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
                      {TITLES.map(title => (
                        <button key={title} onClick={() => setInterviewAnswer(title)} style={{
                          padding: "8px 14px", borderRadius: "99px", fontSize: "13px", fontWeight: 500, cursor: "pointer",
                          border: interviewAnswer === title ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.12)",
                          background: interviewAnswer === title ? "rgba(37,99,235,0.2)" : "rgba(255,255,255,0.05)",
                          color: interviewAnswer === title ? "#60a5fa" : "#94a3b8", transition: "all 0.15s",
                        }}>{interviewAnswer === title ? "✓ " : ""}{title}</button>
                      ))}
                    </div>
                    <input type="text" value={interviewAnswer} onChange={e => setInterviewAnswer(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleInterviewNext()}
                      placeholder="Or type your title..."
                      style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "white", fontSize: "14px", padding: "12px 14px", outline: "none", boxSizing: "border-box" }} />
                  </div>
                );
              })()}

              {/* ── EDUCATION — structured 3-field form ── */}
              {currentInterviewQ.field === "education" && (() => {
                const parts = interviewAnswer.split(" | ");
                const school = parts[0] || "";
                const degree = parts[1] || "";
                const year = parts[2] || "";
                const update = (s: string, d: string, y: string) => setInterviewAnswer([s, d, y].filter(Boolean).join(" | "));
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <input type="text" defaultValue={school} placeholder="School name (e.g. Florida Atlantic University)"
                      onBlur={e => update(e.target.value, degree, year)}
                      style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "white", fontSize: "14px", padding: "12px 14px", outline: "none", boxSizing: "border-box" }} />
                    <input type="text" defaultValue={degree} placeholder="Degree & major (e.g. B.S. Marketing)"
                      onBlur={e => update(school, e.target.value, year)}
                      style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "white", fontSize: "14px", padding: "12px 14px", outline: "none", boxSizing: "border-box" }} />
                    <input type="text" defaultValue={year} placeholder="Graduation year (e.g. 2015)"
                      onBlur={e => update(school, degree, e.target.value)}
                      style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "white", fontSize: "14px", padding: "12px 14px", outline: "none", boxSizing: "border-box" }} />
                  </div>
                );
              })()}

              {/* ── EXPERIENCE BULLETS — guided bullet builder ── */}
              {(currentInterviewQ.field === "experience_bullets" || currentInterviewQ.field === "experience") && (() => {
                const [action, setAction] = useState("");
                const [result, setResult] = useState("");
                useEffect(() => {
                  if (action && result) setInterviewAnswer(`${action} — ${result}`);
                  else if (action) setInterviewAnswer(action);
                }, [action, result]);
                return (
                  <div>
                    <div style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)", borderRadius: "10px", padding: "12px 14px", marginBottom: "16px" }}>
                      <p style={{ color: "#fbbf24", fontSize: "12px", fontWeight: 600, marginBottom: "3px" }}>🎯 Strong bullets = strong callbacks</p>
                      <p style={{ color: "#fde68a", fontSize: "12px", margin: 0, lineHeight: 1.5 }}>Tell us what you did and what happened as a result. We'll turn it into a polished bullet.</p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div>
                        <label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>What did you do?</label>
                        <input type="text" value={action} onChange={e => setAction(e.target.value)}
                          placeholder="e.g. Led a team of 8 sales reps across 3 states"
                          style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "white", fontSize: "14px", padding: "12px 14px", outline: "none", boxSizing: "border-box" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>What was the result or impact?</label>
                        <input type="text" value={result} onChange={e => setResult(e.target.value)}
                          placeholder="e.g. Exceeded quota 3 years running, grew territory 40%"
                          style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "white", fontSize: "14px", padding: "12px 14px", outline: "none", boxSizing: "border-box" }} />
                      </div>
                      {action && result && (
                        <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "8px", padding: "10px 14px" }}>
                          <p style={{ fontSize: "11px", color: "#34d399", fontWeight: 600, marginBottom: "4px" }}>Preview</p>
                          <p style={{ fontSize: "13px", color: "#e2e8f0", margin: 0 }}>▸ {action} — {result}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ── EXPERIENCE DATES — structured date helper ── */}
              {currentInterviewQ.field === "experience_dates" && (
                <div>
                  <div style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)", borderRadius: "10px", padding: "12px 14px", marginBottom: "16px" }}>
                    <p style={{ color: "#fbbf24", fontSize: "12px", fontWeight: 600, marginBottom: "3px" }}>📅 Why dates matter</p>
                    <p style={{ color: "#fde68a", fontSize: "12px", margin: 0, lineHeight: 1.5 }}>ATS systems calculate tenure and spot gaps. Missing dates can trigger automatic rejection before anyone reads your resume.</p>
                  </div>
                  <textarea rows={4} value={interviewAnswer} onChange={e => setInterviewAnswer(e.target.value)}
                    placeholder={"Current role: Jan 2022 – Present\nPrevious role: Mar 2019 – Dec 2021\nRole before that: Jun 2016 – Feb 2019"}
                    style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "white", fontSize: "14px", padding: "12px 14px", outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "DM Mono, monospace" }} />
                </div>
              )}

              {/* ── SUMMARY — guided prompts ── */}
              {currentInterviewQ.field === "summary" && (() => {
                const STARTERS = [
                  "Results-driven sales professional with",
                  "Customer success leader with",
                  "Experienced software engineer with",
                  "Marketing strategist with",
                  "Operations professional with",
                  "Finance and accounting professional with",
                ];
                return (
                  <div>
                    <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "10px" }}>Pick a starter or write your own:</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
                      {STARTERS.map(s => (
                        <button key={s} onClick={() => setInterviewAnswer(prev => s + (prev.replace(/^.*?with\s*/i, "") || " "))} style={{
                          padding: "6px 12px", borderRadius: "99px", fontSize: "12px", cursor: "pointer",
                          border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#94a3b8",
                        }}>{s.slice(0, 28)}…</button>
                      ))}
                    </div>
                    <textarea rows={4} value={interviewAnswer} onChange={e => setInterviewAnswer(e.target.value)}
                      placeholder="e.g. Results-driven sales professional with 10+ years building enterprise pipelines and consistently exceeding quota across SaaS markets."
                      style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "white", fontSize: "14px", padding: "12px 14px", outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
                    <p style={{ fontSize: "11px", color: "#64748b", marginTop: "6px" }}>
                      {interviewAnswer.length < 40 ? `${40 - interviewAnswer.length} more characters recommended` : "✓ Looks good"}
                    </p>
                  </div>
                );
              })()}

              {/* ── DEFAULT — simple text/textarea ── */}
              {!["skills","title","education","experience_bullets","experience","experience_dates","date_gaps","summary"].includes(currentInterviewQ.field) && (
                currentInterviewQ.multiline ? (
                  <textarea rows={4} value={interviewAnswer} onChange={e => setInterviewAnswer(e.target.value)}
                    placeholder={currentInterviewQ.placeholder}
                    style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "white", fontSize: "14px", padding: "12px 14px", outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
                ) : (
                  <input type="text" value={interviewAnswer} onChange={e => setInterviewAnswer(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleInterviewNext()}
                    placeholder={currentInterviewQ.placeholder}
                    style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "white", fontSize: "14px", padding: "12px 14px", outline: "none", boxSizing: "border-box" }} />
                )
              )}

              {/* Action buttons */}
              <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                {!currentInterviewQ.required && (
                  <button onClick={handleInterviewSkip}
                    style={{ flex: 1, background: "rgba(255,255,255,0.06)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "9px", padding: "12px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                    Skip
                  </button>
                )}
                <button onClick={handleInterviewNext}
                  disabled={currentInterviewQ.required && !interviewAnswer.trim()}
                  style={{ flex: 2, background: interviewAnswer.trim() ? "#2563eb" : "rgba(37,99,235,0.3)", color: "white", border: "none", borderRadius: "9px", padding: "12px", fontSize: "14px", fontWeight: 600, cursor: interviewAnswer.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", transition: "background 0.2s" }}>
                  {interviewStep + 1 === interviewFields.length ? "Build My Resume →" : "Next →"}
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

            {/* Personality upsell — top of preview */}
            <div style={{ marginBottom: "20px", background: workingWithMeTeaser ? "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(37,99,235,0.1))" : "linear-gradient(135deg, rgba(37,99,235,0.12), rgba(124,58,237,0.08))", border: `1px solid ${workingWithMeTeaser ? "rgba(124,58,237,0.4)" : "rgba(99,102,241,0.3)"}`, borderRadius: "12px", padding: "18px 20px" }}>
              {workingWithMeTeaser ? (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                    <span style={{ fontSize: "18px" }}>✅</span>
                    <span style={{ color: "white", fontSize: "14px", fontWeight: 700 }}>Your "Working With Me" section is ready</span>
                  </div>
                  <p style={{ color: "#c4b5fd", fontSize: "13px", marginBottom: "10px", lineHeight: 1.6 }}>
                    We've translated your assessment results into professional behavioral language — how you communicate, make decisions, collaborate, and perform under pressure. This is the section hiring managers don't expect and can't forget.
                  </p>
                  <div style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: "8px", padding: "10px 14px", marginBottom: "12px" }}>
                    {!(((user as any)?.plan || planType || localStorage.getItem("riq_plan") || "free") === "monthly" || ((user as any)?.plan || planType || localStorage.getItem("riq_plan") || "free") === "agency" || ((user as any)?.plan || planType || localStorage.getItem("riq_plan") || "free") === "starter") && (
                    <p style={{ color: "#fbbf24", fontSize: "12px", margin: 0, fontWeight: 600 }}>
                      ⚠️ Not included in the free download — add it for $7.99 to include it in your resume.
                    </p>
                    )}
                  </div>
                  <button onClick={() => setPersonalityStep(true)}
                    style={{ width: "100%", background: "linear-gradient(135deg, #4f46e5, #2563eb)", color: "white", border: "none", borderRadius: "9px", padding: "11px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>
                    {(((user as any)?.plan || planType || localStorage.getItem("riq_plan") || "free") === "monthly" || ((user as any)?.plan || planType || localStorage.getItem("riq_plan") || "free") === "agency" || ((user as any)?.plan || planType || localStorage.getItem("riq_plan") || "free") === "starter") ? "Add Working With Me — Included in Plan →" : "Add Working With Me — $7.99 →"}
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <span style={{ fontSize: "18px" }}>🧠</span>
                      <span style={{ color: "white", fontSize: "14px", fontWeight: 700 }}>Stand out beyond your credentials</span>
                    </div>
                    <p style={{ color: "#94a3b8", fontSize: "13px", margin: "0 0 6px", lineHeight: 1.6 }}>
                      Every candidate has accomplishments. <strong style={{ color: "#c7d2fe" }}>Few can articulate how they think, decide, and collaborate.</strong> Upload your DISC, MBTI, Predictive Index, or TKI and we'll translate your personality data into a professional "Working With Me" section — the section hiring managers actually remember.
                    </p>
                    <p style={{ color: "#818cf8", fontSize: "12px", margin: 0 }}>
                      Unlocked forever · Auto-added to every future resume
                    </p>
                  </div>
                  <button onClick={() => setPersonalityStep(true)}
                    style={{ background: "linear-gradient(135deg, #4f46e5, #2563eb)", color: "white", border: "none", borderRadius: "9px", padding: "10px 18px", fontSize: "13px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                    Add It →
                  </button>
                </div>
              )}
            </div>

            {/* Tailor to a Job — upsell / result card */}
            <div style={{ marginBottom: "20px", background: tailorResult ? "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(37,99,235,0.1))" : "linear-gradient(135deg, rgba(37,99,235,0.12), rgba(16,185,129,0.08))", border: `1px solid ${tailorResult ? "rgba(16,185,129,0.4)" : "rgba(99,102,241,0.3)"}`, borderRadius: "12px", padding: "18px 20px" }}>
              {tailorResult ? (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", gap: "10px", flexWrap: "wrap" as const }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "18px" }}>🎯</span>
                      <span style={{ color: "white", fontSize: "14px", fontWeight: 700 }}>Tailored to your target job</span>
                    </div>
                    {tailorResult.matchScore != null && (
                      <span style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.4)", color: "#4ade80", fontSize: "12px", fontWeight: 700, borderRadius: "999px", padding: "4px 12px" }}>
                        {tailorResult.matchScore}% match
                      </span>
                    )}
                  </div>
                  <p style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "12px", lineHeight: 1.6 }}>
                    {tailorApplied
                      ? "Your summary, bullets, and skill order have been updated to match this job — nothing was invented, only reprioritized."
                      : "We found some rewrites that use only what's already true on your resume. Review them before applying."}
                  </p>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={() => setTailorStep(true)}
                      style={{ flex: 1, background: "linear-gradient(135deg, #059669, #2563eb)", color: "white", border: "none", borderRadius: "9px", padding: "11px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>
                      {tailorApplied ? "View Details →" : "Review Tailored Changes →"}
                    </button>
                    <button onClick={handleResetTailoring}
                      style={{ background: "rgba(255,255,255,0.06)", color: "#94a3b8", border: "none", borderRadius: "9px", padding: "11px 14px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                      Tailor to a different job
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <span style={{ fontSize: "18px" }}>🎯</span>
                      <span style={{ color: "white", fontSize: "14px", fontWeight: 700 }}>Tailor this resume to a specific job</span>
                    </div>
                    <p style={{ color: "#94a3b8", fontSize: "13px", margin: "0 0 6px", lineHeight: 1.6 }}>
                      Paste a job description and we'll rephrase your summary and bullets to speak its language — <strong style={{ color: "#93c5fd" }}>using only what's already true on your resume.</strong> Nothing invented, nothing fabricated.
                    </p>
                    <p style={{ color: "#818cf8", fontSize: "12px", margin: 0 }}>
                      {(() => { const ep = (user as any)?.plan || planType || localStorage.getItem("riq_plan") || "free"; return (ep === "monthly" || ep === "agency" || ep === "starter") ? "Included in your plan" : "Starter & Monthly plans"; })()}
                    </p>
                  </div>
                  <button onClick={() => setTailorStep(true)}
                    style={{ background: "linear-gradient(135deg, #059669, #2563eb)", color: "white", border: "none", borderRadius: "9px", padding: "10px 18px", fontSize: "13px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                    Tailor It →
                  </button>
                </div>
              )}
            </div>

            <div className="riq-preview-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              <div>
                <Section title="Personal Info">
                  <EditField label="Full Name" value={parsedData.name || ""} onSave={v => updateField("name", v)} />
                  <EditField label="Job Title" value={parsedData.title || ""} onSave={v => updateField("title", v)} />
                  <EditField label="Location" value={parsedData.location || ""} onSave={v => updateField("location", v)} />
                  <EditField label="Email" value={parsedData.email || ""} onSave={v => { updateField("email", v); setEmailTypoWarning(null); }} />
                  {/* Validation flags from Pass 3 */}
            {validationFlags.length > 0 && (
              <div style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "#eab308", marginBottom: 12 }}>⚡ Validation pass flagged {validationFlags.length} item{validationFlags.length !== 1 ? "s" : ""}</div>
                {validationFlags.map((flag, i) => (
                  <div key={i} style={{ marginBottom: i < validationFlags.length - 1 ? 12 : 0, paddingBottom: i < validationFlags.length - 1 ? 12 : 0, borderBottom: i < validationFlags.length - 1 ? "1px solid rgba(234,179,8,0.15)" : "none" }}>
                    <div style={{ fontSize: 13, color: "rgba(248,250,252,0.9)", marginBottom: 3 }}>{flag.issue}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>→ {flag.suggestion}</div>
                  </div>
                ))}
              </div>
            )}

            {emailTypoWarning && (
                    <div style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: "8px", padding: "10px 12px", marginTop: "4px" }}>
                      <p style={{ color: "#fbbf24", fontSize: "12px", fontWeight: 600, margin: "0 0 4px" }}>⚠️ Possible email typo detected</p>
                      <p style={{ color: "#94a3b8", fontSize: "12px", margin: "0 0 8px" }}>
                        Your resume has <strong style={{ color: "white" }}>{parsedData.email}</strong> — did you mean <strong style={{ color: "#34d399" }}>{emailTypoWarning}</strong>?
                      </p>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={() => { updateField("email", emailTypoWarning!); setEmailTypoWarning(null); }}
                          style={{ fontSize: "12px", padding: "5px 12px", background: "rgba(16,185,129,0.15)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}>
                          Yes, fix it
                        </button>
                        <button onClick={() => setEmailTypoWarning(null)}
                          style={{ fontSize: "12px", padding: "5px 12px", background: "transparent", color: "#64748b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", cursor: "pointer" }}>
                          No, keep original
                        </button>
                      </div>
                    </div>
                  )}
                  <EditField label="Phone" value={parsedData.phone || ""} onSave={v => updateField("phone", v)} />
                  <EditField label="LinkedIn" value={parsedData.linkedin || ""} onSave={v => updateField("linkedin", v)} />
                  <EditField label="Website" value={parsedData.website || ""} onSave={v => updateField("website", v)} />
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
                    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setGuestAccountError("Please enter a valid email address."); return; }
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
              <div style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: "10px", padding: "14px 16px", marginBottom: "10px" }}>
                <p style={{ color: "#4ade80", fontSize: "13px", fontWeight: 600, marginBottom: workingWithMeTeaser ? "6px" : "0" }}>{(planType === "monthly" || planType === "agency" || (user as any)?.plan === "monthly" || (user as any)?.plan === "agency") ? "✦ Unlimited transformations included in your plan." : (planType === "starter" || (user as any)?.plan === "starter") ? "✦ Up to 3 transformations included in your plan." : "🎉 Your first transformation is free — saved to your account forever."}</p>
                {workingWithMeTeaser && !(((user as any)?.plan || planType || localStorage.getItem("riq_plan") || "free") === "monthly" || ((user as any)?.plan || planType || localStorage.getItem("riq_plan") || "free") === "agency" || ((user as any)?.plan || planType || localStorage.getItem("riq_plan") || "free") === "starter") && (
                  <p style={{ color: "#fbbf24", fontSize: "12px", margin: 0 }}>
                    ⚠️ <strong>Working With Me is not included</strong> in the free download — add it for $7.99 below to include it in your resume.
                  </p>
                )}
              </div>
            )}
            {!isFree && !((() => { const ep = (user as any)?.plan || planType || localStorage.getItem("riq_plan") || "free"; return ep === "monthly" || ep === "agency" || ep === "starter"; })()) && (
              <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "10px", padding: "12px 16px", marginBottom: "10px", textAlign: "center" }}>
                <p style={{ color: "#fbbf24", fontSize: "13px", fontWeight: 600 }}>
                  You've used your free transformation. Choose a plan below — one-time purchase, no subscription required.
                </p>
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
                  {downloading ? <><Loader2 size={18} style={spin} />Generating...</> : (() => {
                    const ep = (user as any)?.plan || planType || localStorage.getItem("riq_plan") || "free";
                    const isPaidPlan = ep === "monthly" || ep === "agency" || ep === "starter";
                    if (isPaidPlan) return <><Download size={18} />Download Resume</>;
                    if (isFree) return <><Download size={18} />Download Free Resume</>;
                    return <><CreditCard size={18} />Review & Complete</>;
                  })()}
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
                Choose your plan
              </p>

              {/* Plan selector — only shown for paid users */}
              {!isFree && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "20px", paddingBottom: "20px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  {/* Starter */}
                  <div onClick={() => setSelectedPlan("starter")}
                    style={{ border: `2px solid ${selectedPlan === "starter" ? "#2563eb" : "rgba(255,255,255,0.1)"}`, borderRadius: "12px", padding: "16px", cursor: "pointer", background: selectedPlan === "starter" ? "rgba(37,99,235,0.1)" : "transparent", transition: "all 0.2s" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span style={{ color: "white", fontWeight: 700, fontSize: "14px" }}>Starter</span>
                      <span style={{ color: selectedPlan === "starter" ? "#60a5fa" : "#94a3b8", fontWeight: 700, fontSize: "15px" }}>$14.99</span>
                    </div>
                    <p style={{ color: "#64748b", fontSize: "12px", margin: 0, lineHeight: 1.5 }}>3 transformations — use them anytime, no expiry</p>
                  </div>
                  {/* Monthly */}
                  <div onClick={() => setSelectedPlan("monthly")}
                    style={{ border: `2px solid ${selectedPlan === "monthly" ? "#2563eb" : "rgba(255,255,255,0.1)"}`, borderRadius: "12px", padding: "16px", cursor: "pointer", background: selectedPlan === "monthly" ? "rgba(37,99,235,0.1)" : "transparent", position: "relative", transition: "all 0.2s" }}>
                    <div style={{ position: "absolute", top: "-9px", right: "10px", background: "#2563eb", color: "white", fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px" }}>MOST POPULAR</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span style={{ color: "white", fontWeight: 700, fontSize: "14px" }}>Monthly</span>
                      <span style={{ color: selectedPlan === "monthly" ? "#60a5fa" : "#94a3b8", fontWeight: 700, fontSize: "15px" }}>$19.99<span style={{ fontSize: "11px", fontWeight: 400, color: "#64748b" }}>/mo</span></span>
                    </div>
                    <p style={{ color: "#64748b", fontSize: "12px", margin: 0, lineHeight: 1.5 }}>Unlimited transformations for 30 days</p>
                  </div>
                </div>
              )}

              {/* Free plan indicator */}
              {isFree && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "20px", paddingBottom: "20px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(74,222,128,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "18px" }}>📄</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "white", fontWeight: 600, fontSize: "15px" }}>Resume Transformation</span>
                      <span style={{ color: "#4ade80", fontWeight: 700, fontSize: "15px" }}>Free</span>
                    </div>
                    <p style={{ color: "#64748b", fontSize: "13px", marginTop: "4px" }}>ATS-optimized Word document — yours forever, re-downloadable anytime.</p>
                  </div>
                </div>
              )}

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
                  <p style={{ color: "#94a3b8", fontSize: "13px", marginTop: "4px", lineHeight: 1.5 }}>
                    Every resume in the pile shows work history. This shows <em>how you work</em> — your communication style, decision-making, and how you perform under pressure. Synthesized from your DISC, MBTI, PI, or TKI results into professional language. Hiring managers don't expect it. That's why they remember it. Unlocked permanently on your account.
                  </p>
                  {!workingWithMeTeaser ? (
                    <p style={{ color: "#f59e0b", fontSize: "12px", marginTop: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                      <span>↑</span> Upload your personality assessments in the preview to generate this
                    </p>
                  ) : (
                    <p style={{ color: "#4ade80", fontSize: "12px", marginTop: "6px" }}>
                      ✓ Your Working With Me section is ready — check the box to include it
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
                    Everything above + 60 days of MyCareerIQ — AI-powered job search pipeline to put your new resume to work immediately.
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
                  : includeCareerLaunch ? "$79.99"
                  : includePersonality
                    ? (selectedPlan === "starter" ? "$17.98" : "$22.98")
                    : (selectedPlan === "starter" ? "$14.99" : "$14.99")}
              </span>
            </div>

            {/* CTA */}
            <button
              onClick={handleFinalCheckout}
              style={{ width: "100%", background: includeCareerLaunch ? "#10b981" : "#2563eb", color: "white", border: "none", borderRadius: "12px", padding: "16px", fontSize: "16px", fontWeight: 700, cursor: "pointer", marginBottom: "12px" }}
            >
              {(() => {
                const ep = (user as any)?.plan || planType || localStorage.getItem("riq_plan") || "free";
                const isPaid = ep === "monthly" || ep === "agency" || ep === "starter";
                if (isPaid) return "Download My Resume →";
                if (isFree && !includePersonality && !includeCareerLaunch) return "Download My Resume →";
                return "Complete My Order →";
              })()}
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

            {/* Before / After score */}
            {preTransformScore && (
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "20px 24px", marginBottom: "20px" }}>
                <p style={{ fontSize: "11px", fontFamily: "DM Mono, monospace", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "16px" }}>ATS Score Improvement</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "12px", alignItems: "center" }}>
                  {/* Before */}
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "6px" }}>Before</div>
                    <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(100,116,139,0.15)", border: "2px solid rgba(100,116,139,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 6px" }}>
                      <span style={{ fontSize: "22px", fontWeight: 800, color: "#94a3b8", fontFamily: "Montserrat, sans-serif" }}>{preTransformScore.overall}</span>
                    </div>
                    <div style={{ fontSize: "11px", color: "#475569" }}>/10</div>
                  </div>
                  {/* Arrow + delta */}
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "20px", marginBottom: "4px" }}>→</div>
                    {resumeScore && resumeScore.overall > preTransformScore.overall && (
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#4ade80" }}>
                        +{resumeScore.overall - preTransformScore.overall}
                      </div>
                    )}
                  </div>
                  {/* After */}
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "6px" }}>After</div>
                    <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: resumeScore ? "rgba(74,222,128,0.15)" : "rgba(100,116,139,0.1)", border: `2px solid ${resumeScore ? "#4ade80" : "rgba(100,116,139,0.2)"}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 6px" }}>
                      <span style={{ fontSize: "22px", fontWeight: 800, color: resumeScore ? "#4ade80" : "#64748b", fontFamily: "Montserrat, sans-serif" }}>
                        {resumeScore ? resumeScore.overall : "…"}
                      </span>
                    </div>
                    <div style={{ fontSize: "11px", color: "#475569" }}>/10</div>
                  </div>
                </div>
                {/* Dimension bars */}
                {resumeScore && (
                  <div style={{ marginTop: "16px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    {Object.entries({ atsFormat: "ATS Format", bulletQuality: "Bullets", keywords: "Keywords", completeness: "Completeness" }).map(([key, label]) => {
                      const before = preTransformScore.dimensions?.[key]?.score || 0;
                      const after = resumeScore.dimensions?.[key]?.score || 0;
                      const delta = after - before;
                      return (
                        <div key={key}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                            <span style={{ fontSize: "11px", color: "#64748b" }}>{label}</span>
                            <span style={{ fontSize: "11px", color: delta > 0 ? "#4ade80" : delta < 0 ? "#f87171" : "#64748b", fontWeight: 600 }}>
                              {delta > 0 ? `+${delta}` : delta < 0 ? delta : "—"}
                            </span>
                          </div>
                          <div style={{ height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "99px", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${after * 10}%`, background: "#4ade80", borderRadius: "99px", transition: "width 1s ease" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {!resumeScore && (
                  <p style={{ fontSize: "12px", color: "#475569", textAlign: "center", marginTop: "12px" }}>Calculating post-transform score…</p>
                )}
              </div>
            )}
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
                      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setGuestAccountError("Please enter a valid email address."); return; }
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

            {/* MyCareerIQ upsell */}
            <div style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(139,92,246,0.08) 100%)", border: "1px solid rgba(37,99,235,0.25)", borderRadius: "14px", padding: "22px 24px", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                <div style={{ width: "40px", height: "40px", background: "rgba(37,99,235,0.2)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: "20px" }}>🎯</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <p style={{ color: "#93c5fd", fontSize: "12px", fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Next step</p>
                    <span style={{ background: "rgba(16,185,129,0.15)", color: "#34d399", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "99px", fontSize: "10px", fontWeight: 700, padding: "2px 8px", letterSpacing: "0.04em" }}>7 DAYS FREE</span>
                  </div>
                  <p style={{ color: "white", fontSize: "15px", fontWeight: 700, marginBottom: "6px", lineHeight: 1.4 }}>
                    Start your job search — your resume is already loaded
                  </p>
                  <p style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "16px", lineHeight: 1.5 }}>
                    MyCareerIQ builds your pipeline — research companies, generate cover letters, track applications, and manage outreach. Your transformed resume transfers automatically. 7 days free, no credit card required.
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <button
                      onClick={async () => {
                        if (!user) {
                          window.open(`https://mycareeriq.reviveiqi.com/register?utm_source=resumeiq&utm_medium=done_screen${parsedData?.title ? `&role=${encodeURIComponent(parsedData.title)}` : ""}`, "_blank");
                          return;
                        }
                        try {
                          const t = localStorage.getItem("riq_token");
                          const res = await fetch("/api/resumeiq/auth/mycareeriq-handoff", {
                            method: "POST",
                            headers: { Authorization: `Bearer ${t}` },
                          });
                          const data = await res.json();
                          if (data.token) {
                            window.open(`https://mycareeriq.reviveiqi.com/sso?token=${encodeURIComponent(data.token)}&utm_source=resumeiq&utm_medium=done_screen`, "_blank");
                          }
                        } catch {
                          window.open("https://mycareeriq.reviveiqi.com/register?utm_source=resumeiq&utm_medium=done_screen", "_blank");
                        }
                      }}
                      style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#2563eb", color: "white", borderRadius: "9px", padding: "10px 20px", fontSize: "13px", fontWeight: 700, border: "none", cursor: "pointer" }}
                    >
                      Start my job search — 7 days free →
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Working With Me upsell — high scorers who don't have it */}
            {resumeScore && resumeScore.overall >= 8 && !user?.personalityUnlocked && (
              <div style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.12), rgba(109,40,217,0.08))", border: "1px solid rgba(124,58,237,0.3)", borderRadius: "14px", padding: "22px 24px", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <span style={{ fontSize: "22px" }}>🧠</span>
                  <div>
                    <p style={{ color: "#a78bfa", fontSize: "11px", fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>One more edge</p>
                    <p style={{ color: "white", fontSize: "15px", fontWeight: 700, margin: "2px 0 0" }}>Your resume scored {resumeScore.overall}/10.</p>
                  </div>
                </div>
                <p style={{ color: "#c4b5fd", fontSize: "13px", lineHeight: 1.75, marginBottom: "16px" }}>
                  The candidates you're competing with have the same score. The ones who get the offer answer a question yours still doesn't — <strong style={{ color: "white" }}>how do you actually work?</strong> A "Working With Me" section synthesized from your personality assessments tells hiring managers before the interview. No other candidate has it.
                </p>
                <button
                  onClick={() => setPersonalityStep(true)}
                  style={{ width: "100%", background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "white", border: "none", borderRadius: "10px", padding: "13px", fontSize: "14px", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(124,58,237,0.3)" }}
                >
                  Add "Working With Me" — $7.99 →
                </button>
              </div>
            )}

            {/* Action buttons */}
            {/* Testimonial capture */}
            {!testimonialSubmitted ? (
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "22px 24px", marginBottom: "16px" }}>
                <p style={{ color: "#e2e8f0", fontSize: "14px", fontWeight: 700, marginBottom: "4px" }}>How did it go?</p>
                <p style={{ color: "#64748b", fontSize: "12px", marginBottom: "16px" }}>Your feedback helps other job seekers find ResumeIQ.</p>
                <div style={{ display: "flex", gap: "6px", marginBottom: "14px" }}>
                  {[1,2,3,4,5].map(star => (
                    <button key={star} onClick={() => setTestimonialRating(star)}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: "28px", padding: "2px", opacity: star <= testimonialRating ? 1 : 0.25, transition: "opacity 0.15s" }}>★</button>
                  ))}
                </div>
                {testimonialRating >= 4 && (
                  <>
                    <textarea rows={3} value={testimonialQuote} onChange={e => setTestimonialQuote(e.target.value)}
                      placeholder="What changed? What did you notice? (Optional but really helpful)"
                      style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "white", fontSize: "13px", padding: "10px 12px", outline: "none", resize: "vertical", boxSizing: "border-box", marginBottom: "10px", fontFamily: "inherit" }} />
                    <input type="text" value={testimonialName} onChange={e => setTestimonialName(e.target.value)}
                      placeholder="Your name and title (e.g. Sarah M., Senior AE) — optional"
                      style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "white", fontSize: "13px", padding: "10px 12px", outline: "none", boxSizing: "border-box", marginBottom: "12px" }} />
                    <button onClick={async () => {
                      const nameParts = testimonialName.split(",");
                      await fetch("/api/resumeiq/testimonial", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", ...(localStorage.getItem("riq_token") ? { Authorization: `Bearer ${localStorage.getItem("riq_token")}` } : {}) },
                        body: JSON.stringify({ rating: testimonialRating, quote: testimonialQuote || `${testimonialRating} stars`, name: nameParts[0]?.trim() || (user?.name || "ResumeIQ User"), title: nameParts[1]?.trim() || null, preScore: preTransformScore?.overall || null, postScore: resumeScore?.overall || null }),
                      });
                      setTestimonialSubmitted(true);
                    }} style={{ background: "#2563eb", color: "white", border: "none", borderRadius: "8px", padding: "10px 20px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                      Submit feedback →
                    </button>
                  </>
                )}
                {testimonialRating > 0 && testimonialRating < 4 && (
                  <div>
                    <textarea rows={2} value={testimonialQuote} onChange={e => setTestimonialQuote(e.target.value)}
                      placeholder="What could we improve? (Optional)"
                      style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "white", fontSize: "13px", padding: "10px 12px", outline: "none", resize: "none", boxSizing: "border-box", marginBottom: "10px", fontFamily: "inherit" }} />
                    <button onClick={async () => {
                      await fetch("/api/resumeiq/testimonial", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating: testimonialRating, quote: testimonialQuote || `${testimonialRating} stars`, name: "Anonymous" }) });
                      setTestimonialSubmitted(true);
                    }} style={{ background: "rgba(255,255,255,0.08)", color: "#94a3b8", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", cursor: "pointer" }}>Submit</button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "14px", padding: "18px 24px", marginBottom: "16px", textAlign: "center" }}>
                <p style={{ color: "#34d399", fontSize: "14px", fontWeight: 700, margin: "0 0 4px" }}>Thanks for the feedback ✓</p>
                <p style={{ color: "#64748b", fontSize: "12px", margin: 0 }}>It means a lot — and helps other job seekers find this tool.</p>
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
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button onClick={() => handleReEdit(r.id)}
                        style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)", borderRadius: "7px", padding: "8px 14px", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                        ✏️ Re-edit
                      </button>
                      <button onClick={() => handleRedownload(r.id)}
                        style={{ background: "#2563eb", color: "white", border: "none", borderRadius: "7px", padding: "8px 16px", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                        <Download size={13} /> Download
                      </button>
                      <button onClick={() => handleDeleteResume(r.id, r.candidateName)}
                        title="Delete resume"
                        style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "7px", padding: "8px 10px", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center" }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
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
        {personalityStep && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", boxSizing: "border-box" }}>
            <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "28px", maxWidth: "580px", width: "100%", maxHeight: "88vh", overflowY: "auto" }}>
              <div style={{ textAlign: "center", marginBottom: "20px" }}>
                <div style={{ fontSize: "36px", marginBottom: "8px" }}>🧠</div>
                <h2 style={{ color: "white", fontSize: "20px", fontWeight: "bold", marginBottom: "6px" }}>Add "Working With Me"</h2>
                  <p style={{ color: "#94a3b8", fontSize: "14px", marginBottom: "4px" }}>
                    Every candidate has a resume. This is the section that shows who you actually are to work with.
                  </p>
                  <p style={{ color: "#64748b", fontSize: "13px", lineHeight: 1.6 }}>
                    Upload one or more personality assessments — DISC, MBTI, Predictive Index, TKI, 360 Feedback, or any other. We synthesize them into 5 behavioral dimensions written in professional language. No assessment jargon. No test scores. Just a clear, compelling picture of how you think, decide, and collaborate.
                  </p>
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
                  <button onClick={() => addAssessmentSlot("other", "Other")}
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.15)", borderRadius: "8px", padding: "7px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ color: "#64748b", fontSize: "14px", fontWeight: 700 }}>+</span>
                    <div style={{ textAlign: "left" }}>
                      <p style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600, margin: 0 }}>Unlisted assessment</p>
                      <p style={{ color: "#475569", fontSize: "10px", margin: 0 }}>Enneagram, Hogan, StrengthsFinder, etc.</p>
                    </div>
                  </button>
                </div>
              </div>

              {assessmentFiles.map((a: any) => (
                <div key={a.id} style={{ marginBottom: "10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    {a.id.startsWith("other-") ? (
                      <input
                        type="text"
                        value={a.label === "Other" ? "" : a.label}
                        onChange={(e: any) => updateAssessmentLabel(a.id, e.target.value || "Other")}
                        placeholder="Name this assessment (e.g. Enneagram, Hogan...)"
                        style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "7px", color: "white", fontSize: "13px", fontWeight: 600, padding: "5px 10px", outline: "none", marginRight: "8px" }}
                      />
                    ) : (
                      <span style={{ color: "#60a5fa", fontSize: "13px", fontWeight: 600 }}>{a.label}</span>
                    )}
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

        {/* ── TAILOR TO JOB STEP: paste JD, review diff ── */}
        {tailorStep && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", boxSizing: "border-box" }}>
            <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "28px", maxWidth: "640px", width: "100%", maxHeight: "88vh", overflowY: "auto" }}>

              {!tailorResult ? (
                <>
                  <div style={{ textAlign: "center", marginBottom: "20px" }}>
                    <div style={{ fontSize: "36px", marginBottom: "8px" }}>🎯</div>
                    <h2 style={{ color: "white", fontSize: "20px", fontWeight: "bold", marginBottom: "6px" }}>Tailor to a Job Description</h2>
                    <p style={{ color: "#94a3b8", fontSize: "13px", lineHeight: 1.6 }}>
                      Paste the job description below. We'll rephrase your summary and bullets to speak its language — using only what's already true on your resume. Nothing invented.
                    </p>
                  </div>

                  {tailorUpgradeRequired ? (
                    <div style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: "10px", padding: "16px", marginBottom: "16px", textAlign: "center" as const }}>
                      <p style={{ color: "#fbbf24", fontSize: "13px", fontWeight: 600, margin: "0 0 6px" }}>⚠️ Starter & Monthly feature</p>
                      <p style={{ color: "#94a3b8", fontSize: "12px", margin: 0, lineHeight: 1.6 }}>
                        Tailoring to a job description is included with Starter and Monthly plans. Upgrade your account to unlock it.
                      </p>
                    </div>
                  ) : (
                    <>
                      <textarea
                        rows={8}
                        value={jobDescriptionInput}
                        onChange={(e: any) => setJobDescriptionInput(e.target.value)}
                        placeholder="Paste the full job description here..."
                        style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "white", fontSize: "13px", padding: "12px", outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", marginBottom: "12px" }}
                      />
                      {tailorError && <p style={{ color: "#f87171", fontSize: "12px", marginBottom: "10px" }}>{tailorError}</p>}
                    </>
                  )}

                  <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                    <button onClick={() => { setTailorStep(false); setTailorError(""); setTailorUpgradeRequired(false); }}
                      style={{ flex: 1, background: "rgba(255,255,255,0.06)", color: "#94a3b8", border: "none", borderRadius: "9px", padding: "12px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                      Cancel
                    </button>
                    {!tailorUpgradeRequired && (
                      <button onClick={handleTailorGenerate}
                        disabled={jobDescriptionInput.trim().length < 20 || tailorLoading}
                        style={{ flex: 2, background: jobDescriptionInput.trim().length >= 20 ? "linear-gradient(135deg, #059669, #2563eb)" : "rgba(37,99,235,0.3)", color: "white", border: "none", borderRadius: "9px", padding: "12px", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
                        {tailorLoading
                          ? <><span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span> Tailoring...</>
                          : <><span>🎯</span> Tailor My Resume →</>}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ textAlign: "center", marginBottom: "18px" }}>
                    <div style={{ fontSize: "32px", marginBottom: "8px" }}>🎯</div>
                    <h2 style={{ color: "white", fontSize: "20px", fontWeight: "bold", marginBottom: "6px" }}>Review Tailored Changes</h2>
                    {tailorResult.matchScore != null && (
                      <span style={{ display: "inline-block", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.4)", color: "#4ade80", fontSize: "13px", fontWeight: 700, borderRadius: "999px", padding: "5px 14px", marginTop: "6px" }}>
                        {tailorResult.matchScore}% match before tailoring
                      </span>
                    )}
                  </div>

                  {(tailorResult.matchedKeywords?.length > 0 || tailorResult.missingKeywords?.length > 0) && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "18px" }}>
                      {tailorResult.matchedKeywords?.length > 0 && (
                        <div style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: "8px", padding: "10px 12px" }}>
                          <p style={{ color: "#4ade80", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.05em", margin: "0 0 6px" }}>✓ Already covered</p>
                          <p style={{ color: "#94a3b8", fontSize: "12px", margin: 0, lineHeight: 1.6 }}>{tailorResult.matchedKeywords.join(", ")}</p>
                        </div>
                      )}
                      {tailorResult.missingKeywords?.length > 0 && (
                        <div style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: "8px", padding: "10px 12px" }}>
                          <p style={{ color: "#fbbf24", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.05em", margin: "0 0 6px" }}>Not on your resume</p>
                          <p style={{ color: "#94a3b8", fontSize: "12px", margin: 0, lineHeight: 1.6 }}>{tailorResult.missingKeywords.join(", ")}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {tailorResult.diff?.summary && (
                    <div style={{ marginBottom: "16px" }}>
                      <p style={{ color: "#64748b", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: "8px" }}>Summary</p>
                      <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: "8px", padding: "10px 12px", marginBottom: "6px" }}>
                        <p style={{ color: "#94a3b8", fontSize: "12px", margin: 0, lineHeight: 1.6, textDecoration: "line-through" as const, opacity: 0.7 }}>{tailorResult.diff.summary.before}</p>
                      </div>
                      <div style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: "8px", padding: "10px 12px" }}>
                        <p style={{ color: "white", fontSize: "12px", margin: 0, lineHeight: 1.6 }}>{tailorResult.diff.summary.after}</p>
                      </div>
                    </div>
                  )}

                  {tailorResult.diff?.experience?.map((e: any) => (
                    <div key={e.index} style={{ marginBottom: "16px" }}>
                      <p style={{ color: "#64748b", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: "8px" }}>
                        {e.title}{e.company ? ` · ${e.company}` : ""}
                      </p>
                      <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: "8px", padding: "10px 12px", marginBottom: "6px" }}>
                        {(e.before || []).map((b: string, i: number) => (
                          <p key={i} style={{ color: "#94a3b8", fontSize: "12px", margin: i === 0 ? 0 : "6px 0 0", lineHeight: 1.6, textDecoration: "line-through" as const, opacity: 0.7 }}>• {b}</p>
                        ))}
                      </div>
                      <div style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: "8px", padding: "10px 12px" }}>
                        {(e.after || []).map((b: string, i: number) => (
                          <p key={i} style={{ color: "white", fontSize: "12px", margin: i === 0 ? 0 : "6px 0 0", lineHeight: 1.6 }}>• {b}</p>
                        ))}
                      </div>
                    </div>
                  ))}

                  {tailorResult.diff?.skillsOrder?.length > 0 && (
                    <div style={{ marginBottom: "16px" }}>
                      <p style={{ color: "#64748b", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: "8px" }}>Skills reprioritized</p>
                      <p style={{ color: "#94a3b8", fontSize: "12px", margin: 0, lineHeight: 1.6 }}>{tailorResult.diff.skillsOrder.join(" → ")}</p>
                    </div>
                  )}

                  {!tailorResult.diff?.summary && !(tailorResult.diff?.experience?.length > 0) && (
                    <p style={{ color: "#94a3b8", fontSize: "13px", textAlign: "center" as const, padding: "16px" }}>
                      Your resume already speaks this job's language well — no changes suggested.
                    </p>
                  )}

                  <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                    <button onClick={() => setTailorStep(false)}
                      style={{ flex: 1, background: "rgba(255,255,255,0.06)", color: "#94a3b8", border: "none", borderRadius: "9px", padding: "12px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                      Close
                    </button>
                    {(tailorResult.diff?.summary || tailorResult.diff?.experience?.length > 0) && (
                      <button onClick={handleApplyTailoring}
                        style={{ flex: 2, background: "linear-gradient(135deg, #059669, #2563eb)", color: "white", border: "none", borderRadius: "9px", padding: "12px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                        ✓ Apply Tailored Changes →
                      </button>
                    )}
                  </div>
                </>
              )}
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
                  // Product decision: Communication Style + What Brings Out My Best always visible
                  const ALWAYS_VISIBLE = ["communicationStyle", "motivation"];
                  const effectivePlan = (user as any)?.plan || planType || localStorage.getItem("riq_plan") || "free";
                  const hasPaidPlan = effectivePlan === "monthly" || effectivePlan === "agency" || effectivePlan === "starter" || (user as any)?.personalityUnlocked == 1;
                  const isVisible = hasPaidPlan || ALWAYS_VISIBLE.includes(key);
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
              {(() => {
                const ep = (user as any)?.plan || planType || localStorage.getItem("riq_plan") || "free";
                const isPaid = ep === "monthly" || ep === "agency" || ep === "starter" || (user as any)?.personalityUnlocked == 1;
                return isPaid ? (
                  <div style={{ background: "rgba(0,200,150,0.08)", border: "1px solid rgba(0,200,150,0.25)", borderRadius: "10px", padding: "14px 16px", marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ color: "#4ade80", fontSize: "13px", fontWeight: 600 }}>Working With Me — Included in Your Plan</span>
                    <span style={{ color: "#4ade80", fontSize: "16px", fontWeight: 700 }}>✓ Free</span>
                  </div>
                ) : (
                  <div style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: "10px", padding: "14px 16px", marginBottom: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ color: "white", fontSize: "13px", fontWeight: 600 }}>{!isFree ? "Resume + Working With Me" : "Add Working With Me to your free resume"}</span>
                      <span style={{ color: "#4ade80", fontSize: "16px", fontWeight: 700 }}>{!isFree ? "$19.99" : "$7.99"}</span>
                    </div>
                    {!isFree && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "#64748b", fontSize: "12px" }}>Resume transformation</span>
                          <span style={{ color: "#94a3b8", fontSize: "12px" }}>$14.99</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "#64748b", fontSize: "12px" }}>Working With Me unlock</span>
                          <span style={{ color: "#94a3b8", fontSize: "12px" }}>$7.99</span>
                        </div>
                      </div>
                    )}
                    <p style={{ color: "#64748b", fontSize: "11px", marginTop: "8px", marginBottom: 0 }}>
                      🎁 Once unlocked, Working With Me is auto-added to all your future resumes — free forever.
                    </p>
                  </div>
                );
              })()}

              <button onClick={handlePersonalityUnlock}
                style={{ width: "100%", background: "#2563eb", color: "white", border: "none", borderRadius: "10px", padding: "14px", fontSize: "14px", fontWeight: 700, cursor: "pointer", marginBottom: "10px" }}>
                {((() => { const ep = (user as any)?.plan || planType || localStorage.getItem("riq_plan") || "free"; return ep === "monthly" || ep === "agency" || ep === "starter" || (user as any)?.personalityUnlocked == 1; })()) ? "✦ Add to My Resume — Included in Plan →" : !isFree ? "Pay $19.99 — Get Resume + Working With Me →" : "Pay $7.99 — Add Working With Me →"}
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
                  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setGuestAccountError("Please enter a valid email address."); return; }
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
