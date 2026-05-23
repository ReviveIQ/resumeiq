import { useState, useRef } from "react";
import { Upload, FileText, Download, Sparkles, CheckCircle, ArrowRight, Loader2 } from "lucide-react";

const STEPS = ["Upload", "Analyzing", "Preview", "Download"];

export default function ResumeIQ() {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any>(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.name.match(/\.(pdf|docx|doc)$/i)) {
      setError("Please upload a PDF or Word document");
      return;
    }
    setFile(f);
    setError("");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setStep(1);
    setError("");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/resumeiq/transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fileBase64: base64, fileName: file.name }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setParsedData(data);
      setStep(2);
    } catch (err: any) {
      setError(err.message || "Failed to analyze resume");
      setStep(0);
    }
  };

  const handleDownload = async () => {
    if (!parsedData) return;
    setDownloading(true);
    try {
      const res = await fetch("/api/resumeiq/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ parsedData }),
      });
      if (!res.ok) throw new Error("Failed to generate resume");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${parsedData.name?.replace(/\s+/g, "_") || "Resume"}_ResumeIQ.docx`;
      a.click();
      URL.revokeObjectURL(url);
      setStep(3);
    } catch (err: any) {
      setError(err.message || "Failed to generate");
    } finally {
      setDownloading(false);
    }
  };

  const reset = () => { setStep(0); setFile(null); setParsedData(null); setError(""); };

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0f172a,#1e3a5f,#0f172a)",fontFamily:"Arial,sans-serif"}}>
      {/* Header */}
      <div style={{borderBottom:"1px solid rgba(255,255,255,0.1)",padding:"16px 24px"}}>
        <div style={{maxWidth:"900px",margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
            <div style={{width:"36px",height:"36px",background:"#3b82f6",borderRadius:"8px",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Sparkles size={20} color="white" />
            </div>
            <span style={{color:"white",fontWeight:"bold",fontSize:"22px"}}>ResumeIQ</span>
            <span style={{color:"#60a5fa",fontSize:"13px"}}>by ReviveIQ</span>
          </div>
          <span style={{color:"#94a3b8",fontSize:"13px"}}>Transform any resume into a polished, ATS-ready document</span>
        </div>
      </div>

      <div style={{maxWidth:"900px",margin:"0 auto",padding:"40px 24px"}}>
        {/* Progress */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",marginBottom:"48px"}}>
          {STEPS.map((s, i) => (
            <div key={s} style={{display:"flex",alignItems:"center",gap:"8px"}}>
              <div style={{
                display:"flex",alignItems:"center",gap:"6px",
                padding:"8px 16px",borderRadius:"999px",fontSize:"13px",fontWeight:"600",
                background: i === step ? "#2563eb" : i < step ? "#16a34a" : "rgba(255,255,255,0.1)",
                color: i <= step ? "white" : "#94a3b8",
              }}>
                {i < step ? <CheckCircle size={14}/> : <span style={{width:"18px",height:"18px",borderRadius:"50%",border:"1.5px solid currentColor",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px"}}>{i+1}</span>}
                {s}
              </div>
              {i < STEPS.length-1 && <ArrowRight size={14} color="#475569"/>}
            </div>
          ))}
        </div>

        {/* Step 0: Upload */}
        {step === 0 && (
          <div style={{maxWidth:"640px",margin:"0 auto"}}>
            <div style={{textAlign:"center",marginBottom:"32px"}}>
              <h1 style={{color:"white",fontSize:"32px",fontWeight:"bold",marginBottom:"12px"}}>Upload Your Resume</h1>
              <p style={{color:"#94a3b8",fontSize:"15px"}}>Upload any resume — formatted well or poorly. We'll transform it into a sharp, ATS-optimized document in seconds.</p>
            </div>

            <div
              onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border:`2px dashed ${file ? "#3b82f6" : "rgba(255,255,255,0.2)"}`,
                borderRadius:"16px", padding:"48px", textAlign:"center", cursor:"pointer",
                background: file ? "rgba(59,130,246,0.1)" : "transparent",
                transition:"all 0.2s",
              }}
            >
              <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc" style={{display:"none"}}
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              {file ? (
                <div>
                  <FileText size={48} color="#60a5fa" style={{margin:"0 auto 12px"}}/>
                  <p style={{color:"white",fontWeight:"600",fontSize:"17px",marginBottom:"4px"}}>{file.name}</p>
                  <p style={{color:"#94a3b8",fontSize:"13px"}}>{(file.size/1024).toFixed(0)} KB — Ready to transform</p>
                </div>
              ) : (
                <div>
                  <Upload size={48} color="#64748b" style={{margin:"0 auto 12px"}}/>
                  <p style={{color:"white",fontWeight:"600",fontSize:"16px",marginBottom:"4px"}}>Drop your resume here or click to browse</p>
                  <p style={{color:"#64748b",fontSize:"13px"}}>Supports PDF, DOCX, and DOC</p>
                </div>
              )}
            </div>

            {error && <p style={{color:"#f87171",textAlign:"center",marginTop:"12px",fontSize:"14px"}}>{error}</p>}

            {file && (
              <button onClick={handleAnalyze} style={{
                marginTop:"20px",width:"100%",background:"#2563eb",color:"white",
                border:"none",borderRadius:"12px",padding:"16px",fontSize:"17px",
                fontWeight:"600",cursor:"pointer",display:"flex",alignItems:"center",
                justifyContent:"center",gap:"8px",
              }}>
                <Sparkles size={20}/> Transform My Resume
              </button>
            )}

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"16px",marginTop:"32px"}}>
              {[
                {icon:"✦",title:"ATS Optimized",desc:"Structured for applicant tracking systems"},
                {icon:"◈",title:"Bullet Enhancement",desc:"AI rewrites each bullet for maximum impact"},
                {icon:"▣",title:"Visual Design",desc:"Professional branded template output"},
              ].map(item => (
                <div key={item.title} style={{background:"rgba(255,255,255,0.05)",borderRadius:"12px",padding:"16px",textAlign:"center"}}>
                  <div style={{color:"#60a5fa",fontSize:"24px",marginBottom:"8px"}}>{item.icon}</div>
                  <p style={{color:"white",fontWeight:"600",fontSize:"13px",marginBottom:"4px"}}>{item.title}</p>
                  <p style={{color:"#64748b",fontSize:"12px"}}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Analyzing */}
        {step === 1 && (
          <div style={{maxWidth:"480px",margin:"0 auto",textAlign:"center",padding:"80px 0"}}>
            <Loader2 size={64} color="#60a5fa" style={{margin:"0 auto 24px",animation:"spin 1s linear infinite"}}/>
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
            <h2 style={{color:"white",fontSize:"26px",fontWeight:"bold",marginBottom:"12px"}}>Analyzing Your Resume</h2>
            <p style={{color:"#94a3b8",marginBottom:"32px"}}>Our AI is extracting your experience, skills, and achievements...</p>
            <div style={{textAlign:"left",maxWidth:"320px",margin:"0 auto",display:"flex",flexDirection:"column",gap:"12px"}}>
              {["Parsing work history & dates","Identifying quantified achievements","Enhancing bullet points with AI","Optimizing structure for ATS"].map(item => (
                <div key={item} style={{display:"flex",alignItems:"center",gap:"10px",color:"#94a3b8",fontSize:"14px"}}>
                  <Loader2 size={14} color="#60a5fa" style={{animation:"spin 1s linear infinite",flexShrink:0}}/>{item}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 2 && parsedData && (
          <div style={{maxWidth:"720px",margin:"0 auto"}}>
            <div style={{textAlign:"center",marginBottom:"32px"}}>
              <CheckCircle size={48} color="#4ade80" style={{margin:"0 auto 12px"}}/>
              <h2 style={{color:"white",fontSize:"26px",fontWeight:"bold",marginBottom:"8px"}}>Analysis Complete</h2>
              <p style={{color:"#94a3b8"}}>Review the extracted data, then download your transformed resume</p>
            </div>

            <div style={{display:"grid",gap:"16px",marginBottom:"24px"}}>
              {/* Identity */}
              <div style={{background:"rgba(255,255,255,0.05)",borderRadius:"12px",padding:"20px"}}>
                <h3 style={{color:"#60a5fa",fontWeight:"600",fontSize:"12px",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"12px"}}>Candidate Profile</h3>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",fontSize:"14px"}}>
                  {[
                    ["Name", parsedData.name],
                    ["Title", parsedData.title],
                    ["Location", parsedData.location],
                    ["Experience", `${parsedData.yearsOfExperience} years · ${parsedData.seniorityLevel}`],
                  ].map(([label, val]) => (
                    <div key={label}><span style={{color:"#64748b"}}>{label}: </span><span style={{color:"white"}}>{val}</span></div>
                  ))}
                </div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px"}}>
                {/* Metrics */}
                <div style={{background:"rgba(255,255,255,0.05)",borderRadius:"12px",padding:"20px"}}>
                  <h3 style={{color:"#60a5fa",fontWeight:"600",fontSize:"12px",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"12px"}}>Key Achievements</h3>
                  <ul style={{listStyle:"none",padding:0,margin:0,display:"flex",flexDirection:"column",gap:"8px"}}>
                    {(parsedData.topMetrics || []).slice(0,4).map((m: string, i: number) => (
                      <li key={i} style={{color:"#cbd5e1",fontSize:"13px",display:"flex",gap:"8px"}}>
                        <span style={{color:"#3b82f6",flexShrink:0}}>▪</span>{m}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Experience */}
                <div style={{background:"rgba(255,255,255,0.05)",borderRadius:"12px",padding:"20px"}}>
                  <h3 style={{color:"#60a5fa",fontWeight:"600",fontSize:"12px",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"12px"}}>Work History</h3>
                  <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                    {(parsedData.experience || []).map((exp: any, i: number) => (
                      <div key={i} style={{fontSize:"13px"}}>
                        <span style={{color:"white",fontWeight:"600"}}>{exp.title}</span>
                        <span style={{color:"#64748b"}}> · </span>
                        <span style={{color:"#94a3b8"}}>{exp.company}</span>
                        <div style={{color:"#475569",fontSize:"11px"}}>{exp.startDate}–{exp.endDate}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {error && <p style={{color:"#f87171",textAlign:"center",marginBottom:"12px",fontSize:"14px"}}>{error}</p>}

            <div style={{display:"flex",gap:"12px"}}>
              <button onClick={reset} style={{flex:1,background:"rgba(255,255,255,0.1)",color:"white",border:"none",borderRadius:"12px",padding:"16px",fontSize:"15px",fontWeight:"600",cursor:"pointer"}}>
                Upload Different Resume
              </button>
              <button onClick={handleDownload} disabled={downloading} style={{flex:2,background:"#2563eb",color:"white",border:"none",borderRadius:"12px",padding:"16px",fontSize:"17px",fontWeight:"600",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:"8px"}}>
                {downloading ? <><Loader2 size={20} style={{animation:"spin 1s linear infinite"}}/>Generating...</> : <><Download size={20}/>Download Transformed Resume</>}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Done */}
        {step === 3 && (
          <div style={{maxWidth:"560px",margin:"0 auto",textAlign:"center",padding:"60px 0"}}>
            <div style={{width:"80px",height:"80px",background:"rgba(74,222,128,0.15)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 24px"}}>
              <CheckCircle size={40} color="#4ade80"/>
            </div>
            <h2 style={{color:"white",fontSize:"30px",fontWeight:"bold",marginBottom:"12px"}}>Your Resume is Ready!</h2>
            <p style={{color:"#94a3b8",fontSize:"15px",marginBottom:"32px"}}>Your transformed, ATS-optimized resume has been downloaded. Open it in Microsoft Word or Google Docs to finalize.</p>
            <button onClick={reset} style={{background:"#2563eb",color:"white",border:"none",borderRadius:"12px",padding:"14px 32px",fontSize:"16px",fontWeight:"600",cursor:"pointer"}}>
              Transform Another Resume
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
