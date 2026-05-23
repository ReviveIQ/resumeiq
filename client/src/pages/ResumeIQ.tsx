import { useState, useRef, useEffect } from "react";
import { Upload, FileText, Download, Sparkles, CheckCircle, ArrowRight, Loader2, CreditCard, Gift, User, LogOut, Clock, ChevronRight, Eye, EyeOff } from "lucide-react";

type View = "upload" | "analyzing" | "preview" | "done" | "history" | "login" | "register";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load user if token exists
  useEffect(() => {
    if (token) {
      fetch("/api/resumeiq/auth/me", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(u => { if (u) setUser(u); else { setToken(""); localStorage.removeItem("riq_token"); } })
        .catch(() => {});
    }
  }, [token]);

  // Handle Stripe return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const stripeSessionId = params.get("session_id");
    const riqSession = params.get("resumeiq_session");
    if (payment === "success" && stripeSessionId && riqSession) {
      fetch("/api/resumeiq/verify-payment", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stripeSessionId, resumeiqSession: riqSession, token }),
      }).then(r => r.json()).then(d => {
        if (d.paid) { setSessionId(riqSession); setView("preview"); }
      });
      window.history.replaceState({}, "", "/");
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
      setView("preview");
    } catch (err: any) { setError(err.message || "Failed to analyze"); setView("upload"); }
  };

  const handleDownload = async (overrideSessionId?: string) => {
    setDownloading(true);
    try {
      const sid = overrideSessionId || sessionId;
      const res = await fetch("/api/resumeiq/generate", {
        method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ sessionId: sid, parsedData }),
      });
      if (res.status === 402) { setError("Payment required"); return; }
      if (!res.ok) throw new Error("Failed to generate");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${parsedData?.name?.replace(/\s+/g, "_") || "Resume"}_ResumeIQ.docx`;
      a.click(); URL.revokeObjectURL(url);
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
    else if (data.url) window.location.href = data.url;
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
    const res = await fetch(`/api/resumeiq/resume/${resumeId}/download`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) { setError("Failed to download"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "ResumeIQ.docx"; a.click();
    URL.revokeObjectURL(url);
  };

  const logout = () => { setToken(""); setUser(null); localStorage.removeItem("riq_token"); setView("upload"); };
  const reset = () => { setView("upload"); setFile(null); setParsedData(null); setSessionId(""); setError(""); setIsFree(false); setEmailCaptured(false); setEmail(""); };

  const S = { minHeight:"100vh",background:"linear-gradient(135deg,#0f172a,#1e3a5f,#0f172a)",fontFamily:"Arial,sans-serif" };
  const spin = { animation:"spin 1s linear infinite" };

  return (
    <div style={S}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{borderBottom:"1px solid rgba(255,255,255,0.1)",padding:"16px 24px"}}>
        <div style={{maxWidth:"900px",margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:"12px",cursor:"pointer"}} onClick={reset}>
            <div style={{width:"36px",height:"36px",background:"#3b82f6",borderRadius:"8px",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Sparkles size={20} color="white" />
            </div>
            <span style={{color:"white",fontWeight:"bold",fontSize:"22px"}}>ResumeIQ</span>
            <span style={{color:"#60a5fa",fontSize:"13px"}}>by ReviveIQ</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
            {user ? (
              <>
                <button onClick={() => { loadHistory(); setView("history"); }} style={{background:"transparent",color:"#94a3b8",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:"6px",fontSize:"13px"}}>
                  <Clock size={14} />My Resumes
                </button>
                <div style={{display:"flex",alignItems:"center",gap:"8px",background:"rgba(255,255,255,0.1)",borderRadius:"999px",padding:"6px 12px"}}>
                  <User size={14} color="#60a5fa" />
                  <span style={{color:"white",fontSize:"13px"}}>{user.name || user.email}</span>
                </div>
                <button onClick={logout} style={{background:"transparent",border:"none",cursor:"pointer",color:"#64748b"}}>
                  <LogOut size={16} />
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setView("login")} style={{background:"transparent",color:"#94a3b8",border:"none",cursor:"pointer",fontSize:"13px"}}>Sign In</button>
                <button onClick={() => setView("register")} style={{background:"#2563eb",color:"white",border:"none",borderRadius:"8px",padding:"8px 16px",fontSize:"13px",fontWeight:"600",cursor:"pointer"}}>Create Account</button>
                <div style={{display:"flex",alignItems:"center",gap:"8px",background:"rgba(74,222,128,0.1)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:"999px",padding:"6px 14px"}}>
                  <Gift size={14} color="#4ade80" />
                  <span style={{color:"#4ade80",fontSize:"13px",fontWeight:"600"}}>First resume FREE</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{maxWidth:"900px",margin:"0 auto",padding:"40px 24px"}}>

        {/* Login / Register */}
        {(view === "login" || view === "register") && (
          <div style={{maxWidth:"420px",margin:"0 auto"}}>
            <div style={{textAlign:"center",marginBottom:"32px"}}>
              <h1 style={{color:"white",fontSize:"28px",fontWeight:"bold",marginBottom:"8px"}}>
                {view === "login" ? "Welcome back" : "Create your account"}
              </h1>
              <p style={{color:"#94a3b8",fontSize:"15px"}}>
                {view === "login" ? "Sign in to access your resume history" : "Save and re-download all your resumes"}
              </p>
            </div>

            <div style={{background:"rgba(255,255,255,0.05)",borderRadius:"16px",padding:"32px",display:"flex",flexDirection:"column",gap:"16px"}}>
              {view === "register" && (
                <div>
                  <label style={{color:"#94a3b8",fontSize:"13px",marginBottom:"6px",display:"block"}}>Full Name</label>
                  <input type="text" value={authName} onChange={(e:any) => setAuthName(e.target.value)} placeholder="Bryan Greer"
                    style={{width:"100%",padding:"12px 14px",borderRadius:"8px",border:"1px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.08)",color:"white",fontSize:"14px",outline:"none",boxSizing:"border-box"}} />
                </div>
              )}
              <div>
                <label style={{color:"#94a3b8",fontSize:"13px",marginBottom:"6px",display:"block"}}>Email</label>
                <input type="email" value={authEmail} onChange={(e:any) => setAuthEmail(e.target.value)} placeholder="you@email.com"
                  style={{width:"100%",padding:"12px 14px",borderRadius:"8px",border:"1px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.08)",color:"white",fontSize:"14px",outline:"none",boxSizing:"border-box"}} />
              </div>
              <div style={{position:"relative"}}>
                <label style={{color:"#94a3b8",fontSize:"13px",marginBottom:"6px",display:"block"}}>Password</label>
                <input type={showPassword ? "text" : "password"} value={authPassword} onChange={(e:any) => setAuthPassword(e.target.value)} placeholder="••••••••"
                  style={{width:"100%",padding:"12px 40px 12px 14px",borderRadius:"8px",border:"1px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.08)",color:"white",fontSize:"14px",outline:"none",boxSizing:"border-box"}} />
                <button onClick={() => setShowPassword(!showPassword)} style={{position:"absolute",right:"12px",top:"34px",background:"none",border:"none",cursor:"pointer",color:"#64748b"}}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {error && <p style={{color:"#f87171",fontSize:"13px",textAlign:"center"}}>{error}</p>}

              <button onClick={() => handleAuth(view as "login"|"register")} disabled={authLoading}
                style={{background:"#2563eb",color:"white",border:"none",borderRadius:"10px",padding:"14px",fontSize:"16px",fontWeight:"600",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:"8px"}}>
                {authLoading ? <Loader2 size={18} style={spin}/> : null}
                {view === "login" ? "Sign In" : "Create Account"}
              </button>

              <p style={{color:"#64748b",fontSize:"13px",textAlign:"center"}}>
                {view === "login" ? "Don't have an account? " : "Already have an account? "}
                <button onClick={() => { setView(view === "login" ? "register" : "login"); setError(""); }}
                  style={{color:"#60a5fa",background:"none",border:"none",cursor:"pointer",fontSize:"13px",fontWeight:"600"}}>
                  {view === "login" ? "Create one" : "Sign in"}
                </button>
              </p>
            </div>
          </div>
        )}

        {/* History */}
        {view === "history" && (
          <div>
            <div style={{marginBottom:"24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <h1 style={{color:"white",fontSize:"26px",fontWeight:"bold",marginBottom:"4px"}}>My Resumes</h1>
                <p style={{color:"#94a3b8",fontSize:"14px"}}>All your transformed resumes — re-download anytime</p>
              </div>
              <button onClick={reset} style={{background:"#2563eb",color:"white",border:"none",borderRadius:"10px",padding:"10px 20px",fontSize:"14px",fontWeight:"600",cursor:"pointer"}}>
                + Transform New Resume
              </button>
            </div>

            {history.length === 0 ? (
              <div style={{textAlign:"center",padding:"60px 0"}}>
                <Clock size={48} color="#334155" style={{margin:"0 auto 16px"}}/>
                <p style={{color:"#94a3b8",fontSize:"16px"}}>No resumes yet</p>
                <p style={{color:"#64748b",fontSize:"14px",marginTop:"8px"}}>Transform your first resume to see it here</p>
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
                {history.map((r: any) => (
                  <div key={r.id} style={{background:"rgba(255,255,255,0.05)",borderRadius:"12px",padding:"20px",display:"flex",alignItems:"center",justifyContent:"space-between",border:"1px solid rgba(255,255,255,0.08)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"16px"}}>
                      <div style={{width:"44px",height:"44px",background:"rgba(59,130,246,0.15)",borderRadius:"10px",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <FileText size={22} color="#60a5fa" />
                      </div>
                      <div>
                        <p style={{color:"white",fontWeight:"600",fontSize:"15px",marginBottom:"4px"}}>{r.candidateName || "Resume"}</p>
                        <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
                          <p style={{color:"#64748b",fontSize:"12px"}}>{r.originalFileName}</p>
                          <p style={{color:"#64748b",fontSize:"12px"}}>·</p>
                          <p style={{color:"#64748b",fontSize:"12px"}}>{new Date(r.createdAt).toLocaleDateString()}</p>
                          <span style={{background: r.paid ? "rgba(74,222,128,0.15)" : "rgba(245,158,11,0.15)", color: r.paid ? "#4ade80" : "#fbbf24", fontSize:"11px",padding:"2px 8px",borderRadius:"999px",fontWeight:"600"}}>
                            {r.paid ? "✓ Paid" : "Free"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => handleRedownload(r.id)}
                      style={{background:"#2563eb",color:"white",border:"none",borderRadius:"8px",padding:"10px 18px",fontSize:"13px",fontWeight:"600",cursor:"pointer",display:"flex",alignItems:"center",gap:"6px"}}>
                      <Download size={14} /> Download
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Upload */}
        {view === "upload" && (
          <div style={{maxWidth:"640px",margin:"0 auto"}}>
            <div style={{textAlign:"center",marginBottom:"32px"}}>
              <h1 style={{color:"white",fontSize:"32px",fontWeight:"bold",marginBottom:"12px"}}>Transform Your Resume</h1>
              <p style={{color:"#94a3b8",fontSize:"15px"}}>
                Upload any resume and get back a polished, ATS-optimized Word document.
                {!user && <> <strong style={{color:"#4ade80"}}>Your first one is free.</strong></>}
              </p>
            </div>

            <div onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if(f) handleFile(f); }}
              onDragOver={(e) => e.preventDefault()} onClick={() => fileInputRef.current?.click()}
              style={{border:`2px dashed ${file ? "#3b82f6" : "rgba(255,255,255,0.2)"}`,borderRadius:"16px",padding:"48px",textAlign:"center",cursor:"pointer",background:file?"rgba(59,130,246,0.1)":"transparent",transition:"all 0.2s"}}>
              <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc" style={{display:"none"}} onChange={(e:any) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              {file ? (
                <div><FileText size={48} color="#60a5fa" style={{margin:"0 auto 12px"}}/><p style={{color:"white",fontWeight:"600",fontSize:"17px",marginBottom:"4px"}}>{file.name}</p><p style={{color:"#94a3b8",fontSize:"13px"}}>{(file.size/1024).toFixed(0)} KB — Ready</p></div>
              ) : (
                <div><Upload size={48} color="#64748b" style={{margin:"0 auto 12px"}}/><p style={{color:"white",fontWeight:"600",fontSize:"16px",marginBottom:"4px"}}>Drop your resume here or click to browse</p><p style={{color:"#64748b",fontSize:"13px"}}>PDF, DOCX, or DOC</p></div>
              )}
            </div>

            {error && <p style={{color:"#f87171",textAlign:"center",marginTop:"12px",fontSize:"14px"}}>{error}</p>}

            {file && (
              <button onClick={handleAnalyze} style={{marginTop:"20px",width:"100%",background:"#2563eb",color:"white",border:"none",borderRadius:"12px",padding:"16px",fontSize:"17px",fontWeight:"600",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:"8px"}}>
                <Sparkles size={20}/> Analyze My Resume
              </button>
            )}

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"16px",marginTop:"32px"}}>
              {[{icon:"✦",t:"ATS Optimized",d:"Passes all tracking systems"},{icon:"◈",t:"AI Enhanced",d:"Stronger bullets & metrics"},{icon:"▣",t:"Saved Forever",d:"Re-download anytime"}].map(i => (
                <div key={i.t} style={{background:"rgba(255,255,255,0.05)",borderRadius:"12px",padding:"16px",textAlign:"center"}}>
                  <div style={{color:"#60a5fa",fontSize:"24px",marginBottom:"8px"}}>{i.icon}</div>
                  <p style={{color:"white",fontWeight:"600",fontSize:"13px",marginBottom:"4px"}}>{i.t}</p>
                  <p style={{color:"#64748b",fontSize:"12px"}}>{i.d}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Analyzing */}
        {view === "analyzing" && (
          <div style={{maxWidth:"480px",margin:"0 auto",textAlign:"center",padding:"80px 0"}}>
            <Loader2 size={64} color="#60a5fa" style={{margin:"0 auto 24px",...spin}}/>
            <h2 style={{color:"white",fontSize:"26px",fontWeight:"bold",marginBottom:"12px"}}>Analyzing Your Resume</h2>
            <p style={{color:"#94a3b8"}}>AI is extracting your experience, skills, and achievements...</p>
          </div>
        )}

        {/* Preview */}
        {view === "preview" && parsedData && (
          <div style={{maxWidth:"720px",margin:"0 auto"}}>
            <div style={{textAlign:"center",marginBottom:"32px"}}>
              <CheckCircle size={48} color="#4ade80" style={{margin:"0 auto 12px"}}/>
              <h2 style={{color:"white",fontSize:"26px",fontWeight:"bold",marginBottom:"8px"}}>Analysis Complete</h2>
              <p style={{color:"#94a3b8"}}>Review the extracted data below</p>
            </div>

            <div style={{display:"grid",gap:"16px",marginBottom:"24px"}}>
              <div style={{background:"rgba(255,255,255,0.05)",borderRadius:"12px",padding:"20px"}}>
                <h3 style={{color:"#60a5fa",fontWeight:"600",fontSize:"12px",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"12px"}}>Candidate Profile</h3>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",fontSize:"14px"}}>
                  {[["Name",parsedData.name],["Title",parsedData.title],["Location",parsedData.location],["Experience",`${parsedData.yearsOfExperience} years · ${parsedData.seniorityLevel}`]].map(([l,v]) => (
                    <div key={l}><span style={{color:"#64748b"}}>{l}: </span><span style={{color:"white"}}>{v}</span></div>
                  ))}
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px"}}>
                <div style={{background:"rgba(255,255,255,0.05)",borderRadius:"12px",padding:"20px"}}>
                  <h3 style={{color:"#60a5fa",fontWeight:"600",fontSize:"12px",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"12px"}}>Key Achievements</h3>
                  <ul style={{listStyle:"none",padding:0,margin:0,display:"flex",flexDirection:"column",gap:"8px"}}>
                    {(parsedData.topMetrics||[]).slice(0,3).map((m:string,i:number) => (
                      <li key={i} style={{color:"#cbd5e1",fontSize:"13px",display:"flex",gap:"8px"}}><span style={{color:"#3b82f6",flexShrink:0}}>▪</span>{m}</li>
                    ))}
                  </ul>
                </div>
                <div style={{background:"rgba(255,255,255,0.05)",borderRadius:"12px",padding:"20px"}}>
                  <h3 style={{color:"#60a5fa",fontWeight:"600",fontSize:"12px",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"12px"}}>Work History</h3>
                  <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                    {(parsedData.experience||[]).map((exp:any,i:number) => (
                      <div key={i} style={{fontSize:"13px"}}><span style={{color:"white",fontWeight:"600"}}>{exp.title}</span><span style={{color:"#64748b"}}> · </span><span style={{color:"#94a3b8"}}>{exp.company}</span></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Email capture for non-logged-in free users */}
            {isFree && !user && !emailCaptured && (
              <div style={{background:"rgba(74,222,128,0.1)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:"12px",padding:"20px",marginBottom:"16px"}}>
                <p style={{color:"#4ade80",fontSize:"14px",fontWeight:"600",marginBottom:"12px"}}>🎉 Your first resume is free! Enter your email to download.</p>
                <div style={{display:"flex",gap:"8px"}}>
                  <input type="email" placeholder="your@email.com" value={email} onChange={(e:any) => setEmail(e.target.value)}
                    style={{flex:1,padding:"10px 14px",borderRadius:"8px",border:"1px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.1)",color:"white",fontSize:"14px",outline:"none"}} />
                  <button onClick={async () => {
                    if (!email) return;
                    await fetch("/api/resumeiq/capture-email", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ email, name: parsedData?.name }) });
                    document.cookie = "resumeiq_free_used=1; max-age=31536000; path=/";
                    setEmailCaptured(true);
                    handleDownload();
                  }} style={{background:"#4ade80",color:"#0f172a",border:"none",borderRadius:"8px",padding:"10px 20px",fontWeight:"700",cursor:"pointer",fontSize:"14px",whiteSpace:"nowrap"}}>
                    Get My Resume →
                  </button>
                </div>
              </div>
            )}

            {/* Logged in free */}
            {isFree && user && (
              <div style={{background:"rgba(74,222,128,0.1)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:"12px",padding:"16px",marginBottom:"16px",textAlign:"center"}}>
                <p style={{color:"#4ade80",fontSize:"14px",fontWeight:"600"}}>🎉 Free resume — download now and it'll be saved to your account!</p>
              </div>
            )}

            {/* Paid */}
            {!isFree && (
              <div style={{background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:"12px",padding:"16px",marginBottom:"16px",textAlign:"center"}}>
                <p style={{color:"#fbbf24",fontSize:"14px",fontWeight:"600"}}>Your free resume has been used. Download this one for <strong>$9.99</strong> — saved to your account forever.</p>
              </div>
            )}

            {error && <p style={{color:"#f87171",textAlign:"center",marginBottom:"12px",fontSize:"14px"}}>{error}</p>}

            <div style={{display:"flex",gap:"12px"}}>
              <button onClick={reset} style={{flex:1,background:"rgba(255,255,255,0.1)",color:"white",border:"none",borderRadius:"12px",padding:"16px",fontSize:"15px",fontWeight:"600",cursor:"pointer"}}>
                Upload Different
              </button>
              {(isFree && (user || emailCaptured)) || !isFree ? (
                <button onClick={isFree ? () => handleDownload() : handlePayAndDownload} disabled={downloading}
                  style={{flex:2,background:isFree?"#16a34a":"#2563eb",color:"white",border:"none",borderRadius:"12px",padding:"16px",fontSize:"17px",fontWeight:"600",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:"8px"}}>
                  {downloading ? <><Loader2 size={20} style={spin}/>Generating...</> : isFree ? <><Download size={20}/>Download Free Resume</> : <><CreditCard size={20}/>Pay $9.99 & Download</>}
                </button>
              ) : null}
            </div>

            {!user && (
              <p style={{color:"#64748b",fontSize:"13px",textAlign:"center",marginTop:"16px"}}>
                <button onClick={() => setView("register")} style={{color:"#60a5fa",background:"none",border:"none",cursor:"pointer",fontSize:"13px"}}>Create a free account</button> to save your resumes and re-download anytime.
              </p>
            )}
          </div>
        )}

        {/* Done */}
        {view === "done" && (
          <div style={{maxWidth:"560px",margin:"0 auto",textAlign:"center",padding:"60px 0"}}>
            <div style={{width:"80px",height:"80px",background:"rgba(74,222,128,0.15)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 24px"}}>
              <CheckCircle size={40} color="#4ade80"/>
            </div>
            <h2 style={{color:"white",fontSize:"30px",fontWeight:"bold",marginBottom:"12px"}}>Your Resume is Ready!</h2>
            <p style={{color:"#94a3b8",fontSize:"15px",marginBottom:"32px"}}>
              Your transformed resume has been downloaded.
              {user && " It's also saved to your account — re-download anytime from My Resumes."}
            </p>
            <div style={{display:"flex",gap:"12px",justifyContent:"center"}}>
              <button onClick={reset} style={{background:"#2563eb",color:"white",border:"none",borderRadius:"12px",padding:"14px 32px",fontSize:"16px",fontWeight:"600",cursor:"pointer"}}>
                Transform Another
              </button>
              {user && (
                <button onClick={() => { loadHistory(); setView("history"); }} style={{background:"rgba(255,255,255,0.1)",color:"white",border:"none",borderRadius:"12px",padding:"14px 32px",fontSize:"16px",fontWeight:"600",cursor:"pointer"}}>
                  My Resumes
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
