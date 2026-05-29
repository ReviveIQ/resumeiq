import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

const BAD_RESUMES = [
  {
    name: "Marcus T. Williams",
    title: "Marketing Professional",
    flaw: "Wall of text — no structure",
    flawDetail: "ATS can't parse it. Recruiters won't read it.",
    color: "#ef4444",
    content: `OBJECTIVE: I am a highly motivated and results-driven marketing professional with extensive experience in the field of marketing and communications. I have worked in various capacities across multiple industries and have developed a strong skill set that includes both traditional and digital marketing strategies. I am seeking a challenging position where I can utilize my skills and contribute to the growth of a dynamic organization.

WORK EXPERIENCE: From 2018 to present I have been working at Brightline Media Group as a Senior Marketing Coordinator where I am responsible for managing social media accounts, creating content, coordinating with vendors, assisting with email campaigns, attending meetings, preparing reports, working with the design team, and other duties as assigned. Before that from 2015 to 2018 I worked at Greenfield Solutions as a Marketing Assistant where I helped with various marketing tasks including copywriting, event planning, and administrative support. Prior to that I worked at a small startup.

SKILLS: Microsoft Office, Social Media, Email Marketing, Adobe Photoshop, Communication, Teamwork, Leadership, Problem Solving, Time Management, Creative Thinking, Attention to Detail, Fast Learner, Hardworking, Dedicated`,
  },
  {
    name: "Jennifer A. Kowalski",
    title: "Project Manager",
    flaw: "Generic duties, zero metrics",
    flawDetail: "Says nothing. Every PM 'managed projects and stakeholders.'",
    color: "#f97316",
    content: `JENNIFER A. KOWALSKI ★ Project Manager ★ jennifer.k@email.com ★ (555) 219-4471

💼 EXPERIENCE 💼

▶ PROJECT MANAGER | Nexus Consulting Group | 2019–Present
• Responsible for managing projects from start to finish
• Worked with stakeholders to ensure project goals were met
• Coordinated with cross-functional teams on deliverables
• Created and maintained project documentation
• Ran weekly status meetings with team members
• Helped resolve issues that came up during projects
• Made sure projects stayed on schedule

▶ JUNIOR PROJECT MANAGER | DataBridge Inc | 2016–2019
• Assisted senior PM with day-to-day project tasks
• Updated project trackers and spreadsheets
• Attended client calls and took notes
• Supported team in meeting deadlines

🎓 EDUCATION 🎓
Bachelor of Science in Business Administration
State University | Class of 2016`,
  },
  {
    name: "Devon R. Patel",
    title: "Software Engineer",
    flaw: "4 fonts, random formatting",
    flawDetail: "Screams 'I made this in Word 2003.' ATS parse failure.",
    color: "#a855f7",
    content: `Devon R. Patel
SOFTWARE ENGINEER
devon.patel@gmail.com | LinkedIn: linkedin.com/in/devonpatel

ABOUT ME
  I am a software engineer who is passionate about coding and building software. I enjoy working on challenging problems and am always eager to learn new technologies. I work well in team environments and independently.

Work History
Backend Developer – CloudSync Technologies (2020 to present)
Built APIs. Worked on databases. Fixed bugs. Helped with deployments. Participated in code reviews. Wrote some documentation. Worked with AWS sometimes.

    Web Developer Intern   TechStart Labs   Summer 2019
        - built websites
               - helped senior developers
         - learned a lot

TECHNICAL SKILLS:
Python, JavaScript, also know some Java, SQL (MySQL, also Postgres), REST APIs, git, AWS (a little), Docker maybe, React (currently learning), HTML/CSS, some DevOps`,
  },
  {
    name: "Sandra L. Thompson",
    title: "Sales Executive",
    flaw: "Responsibilities not achievements",
    flawDetail: "Never answers: 'So what?' Hiring managers need numbers.",
    color: "#3b82f6",
    content: `SANDRA L. THOMPSON
Sales Executive | Fort Lauderdale, FL
sandra.thompson@email.com | 555.847.2291

PROFESSIONAL SUMMARY
Experienced sales executive with a strong background in B2B sales and account management. Skilled in building relationships with clients and driving revenue growth. Proven ability to work in fast-paced environments and meet targets.

PROFESSIONAL EXPERIENCE

Senior Account Executive | Vertex Solutions Group | Jan 2018 – Present
- Responsible for managing a portfolio of enterprise accounts
- In charge of prospecting new business opportunities within assigned territory
- Tasked with presenting product demos to potential clients
- Required to meet monthly and quarterly sales quotas
- Duties included preparing proposals and contracts
- Handled customer complaints and escalations
- Worked closely with implementation and support teams

Account Manager | PrimeLink Services | 2015 – 2017
- Managed existing customer relationships
- Was responsible for upselling additional products
- Maintained records in Salesforce CRM
- Participated in weekly sales team meetings`,
  },
  {
    name: "Robert C. Nguyen",
    title: "Finance Analyst",
    flaw: "2-column layout — ATS invisible",
    flawDetail: "Columns confuse ATS parsers. Half your resume disappears.",
    color: "#14b8a6",
    content: `┌─────────────────────────┬──────────────────────────────────┐
│  ROBERT C. NGUYEN       │  EXPERIENCE                      │
│  Finance Analyst        │                                  │
│                         │  Financial Analyst               │
│  📧 rob.nguyen@mail.com │  Meridian Capital Partners       │
│  📞 (555) 301-7823      │  2019 – Present                  │
│                         │  Prepared financial models       │
│  SKILLS                 │  Assisted with reporting         │
│  ─────────────────      │  Worked in Excel daily           │
│  • Excel (Advanced)     │                                  │
│  • Financial Modeling   │  Junior Analyst                  │
│  • SQL                  │  Atlas Financial Group           │
│  • PowerPoint           │  2017 – 2019                     │
│  • Bloomberg Terminal   │  Supported senior analysts       │
│                         │  Created weekly reports          │
│  EDUCATION              │  Maintained data spreadsheets    │
│  ─────────────────      │                                  │
│  BS Finance             │  CERTIFICATIONS                  │
│  University of Miami    │  CFA Level 1 Candidate           │
│  GPA: 3.4               │  Bloomberg Market Concepts       │
└─────────────────────────┴──────────────────────────────────┘`,
  },
];

const HOW_IT_WORKS = [
  { step: "01", icon: "📄", title: "Upload your resume", body: "PDF or Word — any format, any mess. We've seen worse." },
  { step: "02", icon: "🤖", title: "AI parses & transforms", body: "GPT-4o extracts every detail and restructures it into a keyword-rich, ATS-optimized format." },
  { step: "03", icon: "✏️", title: "Review & edit", body: "Inspect every field before downloading. Add missing roles, sharpen bullets, adjust anything." },
  { step: "04", icon: "📥", title: "Download & own it", body: "Clean Word document — yours forever, re-downloadable from your account anytime." },
];

const PRICING = [
  {
    name: "Single Resume",
    price: "$9.99",
    description: "One-time, no subscription",
    features: [
      "Full ATS-optimized transformation",
      "Keyword alignment for job posts",
      "Editable Word document",
      "Saved to your account forever",
      "Re-download anytime",
    ],
    cta: "Transform My Resume",
    highlighted: false,
  },
  {
    name: "Resume + Working With Me",
    price: "$13.98",
    description: "Best value — one-time",
    features: [
      "Everything in Single Resume",
      "Personality assessment synthesis",
      "Professional 'Working With Me' section",
      "Auto-added to all future resumes",
      "Free re-synthesis forever",
    ],
    cta: "Get Both →",
    highlighted: true,
  },
  {
    name: "Personality Unlock",
    price: "$3.99",
    description: "Already have a resume? Add this.",
    features: [
      "Synthesize DISC, MBTI, PI, TKI, 360",
      "Jargon-free professional language",
      "5 workplace insight fields",
      "Lifetime unlock on your account",
      "Auto-appended to every future resume",
    ],
    cta: "Unlock Working With Me",
    highlighted: false,
  },
];

export default function LandingPage() {
  const [, navigate] = useLocation();
  const [activeResume, setActiveResume] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    setIsVisible(true);
    intervalRef.current = setInterval(() => {
      setActiveResume(prev => (prev + 1) % BAD_RESUMES.length);
    }, 4000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const resume = BAD_RESUMES[activeResume];

  return (
    <div style={{ background: "#080f1e", minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", color: "white", overflowX: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />

      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        .fade-up { animation: fadeUp 0.7s ease forwards; }
        .fade-up-1 { animation: fadeUp 0.7s 0.1s ease both; }
        .fade-up-2 { animation: fadeUp 0.7s 0.25s ease both; }
        .fade-up-3 { animation: fadeUp 0.7s 0.4s ease both; }
        .fade-up-4 { animation: fadeUp 0.7s 0.55s ease both; }
        .cta-btn { background: linear-gradient(135deg, #2563eb, #1d4ed8); border: none; color: white; padding: 16px 36px; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-family: 'DM Sans', sans-serif; letter-spacing: 0.01em; }
        .cta-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(37,99,235,0.4); }
        .cta-btn-outline { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: white; padding: 14px 28px; border-radius: 10px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; font-family: 'DM Sans', sans-serif; }
        .cta-btn-outline:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.4); }
        .resume-dot { width: 8px; height: 8px; border-radius: 50%; border: none; cursor: pointer; transition: all 0.2s; }
        .step-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 28px; transition: all 0.3s; }
        .step-card:hover { background: rgba(255,255,255,0.05); border-color: rgba(37,99,235,0.3); transform: translateY(-4px); }
        .pricing-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 32px; transition: all 0.3s; }
        .pricing-card.featured { background: rgba(37,99,235,0.1); border-color: rgba(37,99,235,0.4); }
        .pricing-card:hover { transform: translateY(-4px); }
        .check-item { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; font-size: 13px; color: #94a3b8; }
        .mesh { position: absolute; width: 600px; height: 600px; border-radius: 50%; filter: blur(120px); pointer-events: none; }
      `}</style>

      {/* NAV */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, padding: "0 40px", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(20px)", background: "rgba(8,15,30,0.8)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <svg viewBox="0 0 72 72" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#60a5fa"/><stop offset="100%" stopColor="#2563eb"/></linearGradient>
              <linearGradient id="lg2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#93c5fd"/><stop offset="100%" stopColor="#3b82f6"/></linearGradient>
              <linearGradient id="lg3" x1="100%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#1d4ed8"/><stop offset="100%" stopColor="#1e3a5f"/></linearGradient>
            </defs>
            <polygon points="36,4 68,36 36,68 4,36" fill="url(#lg3)" opacity="0.35"/>
            <polygon points="36,4 20,20 36,36 52,20" fill="url(#lg2)" opacity="0.9"/>
            <polygon points="36,4 52,20 68,36 36,36" fill="url(#lg1)" opacity="0.65"/>
            <polygon points="4,36 20,20 36,36 20,52" fill="url(#lg1)" opacity="0.5"/>
            <polygon points="68,36 52,20 36,36 52,52" fill="url(#lg2)" opacity="0.75"/>
            <polygon points="36,68 20,52 36,36 52,52" fill="url(#lg3)" opacity="0.95"/>
            <circle cx="36" cy="36" r="6" fill="white" opacity="0.95"/>
            <circle cx="36" cy="36" r="3" fill="#93c5fd"/>
          </svg>
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "white" }}>
            Resume<span style={{ color: "#60a5fa" }}>IQ</span>
          </span>
          <span style={{ color: "#475569", fontSize: "11px", marginLeft: "2px" }}>by ReviveIQI</span>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button className="cta-btn-outline" onClick={() => navigate("/app")} style={{ padding: "10px 20px", fontSize: "13px" }}>Sign In</button>
          <button className="cta-btn" onClick={() => navigate("/app")} style={{ padding: "10px 20px", fontSize: "13px" }}>Get Started →</button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "120px 40px 80px", textAlign: "center", overflow: "hidden" }}>
        <div className="mesh" style={{ background: "rgba(37,99,235,0.15)", top: "-100px", left: "-100px" }} />
        <div className="mesh" style={{ background: "rgba(99,102,241,0.1)", bottom: "-100px", right: "-100px" }} />

        <div style={{ position: "relative", maxWidth: "800px" }}>
          <div className="fade-up" style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)", borderRadius: "999px", padding: "6px 16px", marginBottom: "28px", fontSize: "12px", color: "#93c5fd", fontWeight: 500, letterSpacing: "0.04em" }}>
            <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#4ade80", animation: "pulse 2s infinite" }} />
            ATS-OPTIMIZED · KEYWORD-RICH · READY TO DEPLOY
          </div>

          <h1 className="fade-up-1" style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(42px, 6vw, 72px)", fontWeight: 800, lineHeight: 1.08, marginBottom: "24px", letterSpacing: "-0.02em" }}>
            Your resume is a<br />
            <span style={{ background: "linear-gradient(135deg, #60a5fa, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>digital asset.</span>
            <br />Treat it like one.
          </h1>

          <p className="fade-up-2" style={{ fontSize: "18px", color: "#94a3b8", lineHeight: 1.7, maxWidth: "580px", margin: "0 auto 36px", fontWeight: 300 }}>
            Ambitious professionals keep a polished, ATS-optimized resume in their digital filing cabinet — language aligned with job posts, keywords that pass filters, format that recruiters actually read.
          </p>

          <div className="fade-up-3" style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap" }}>
            <button className="cta-btn" onClick={() => navigate("/app")} style={{ fontSize: "16px", padding: "18px 42px" }}>
              Transform My Resume →
            </button>
            <button className="cta-btn-outline" onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}>
              See how it works
            </button>
          </div>

          <p className="fade-up-4" style={{ color: "#334155", fontSize: "12px", marginTop: "20px" }}>
            $9.99 one-time · No subscription · Re-download anytime
          </p>
        </div>
      </section>

      {/* BAD RESUME EXAMPLES */}
      <section style={{ padding: "80px 40px", background: "rgba(0,0,0,0.3)" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "52px" }}>
            <p style={{ color: "#60a5fa", fontSize: "12px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>The problem</p>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, marginBottom: "16px" }}>
              Most resumes fail before<br />a human ever reads them.
            </h2>
            <p style={{ color: "#64748b", fontSize: "16px", maxWidth: "500px", margin: "0 auto" }}>
              ATS systems reject 75% of resumes automatically. Here's what's killing yours.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px", alignItems: "start" }}>
            {/* Left: preview */}
            <div style={{ position: "relative" }}>
              <div style={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.4)" }}>
                {/* Mock doc header */}
                <div style={{ background: "#0f172a", padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ef4444", opacity: 0.7 }} />
                  <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f59e0b", opacity: 0.7 }} />
                  <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#22c55e", opacity: 0.7 }} />
                  <span style={{ marginLeft: "8px", color: "#334155", fontSize: "11px" }}>{resume.name}_Resume.docx</span>
                </div>
                {/* Resume content */}
                <div key={activeResume} style={{ padding: "24px", fontFamily: "monospace", fontSize: "10px", lineHeight: "1.6", color: "#64748b", minHeight: "340px", animation: "slideIn 0.3s ease", overflowY: "hidden", maxHeight: "340px" }}>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{resume.content}</pre>
                </div>
                {/* Flaw badge */}
                <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(239,68,68,0.08)", display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: resume.color, flexShrink: 0 }} />
                  <div>
                    <span style={{ color: resume.color, fontSize: "11px", fontWeight: 600 }}>{resume.flaw}</span>
                    <span style={{ color: "#475569", fontSize: "11px" }}> — {resume.flawDetail}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: flaw list + dots */}
            <div style={{ paddingTop: "8px" }}>
              <p style={{ color: "#475569", fontSize: "13px", marginBottom: "24px", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Common resume killers</p>
              <div style={{ display: "grid", gap: "12px", marginBottom: "32px" }}>
                {BAD_RESUMES.map((r, i) => (
                  <button key={i} onClick={() => { setActiveResume(i); clearInterval(intervalRef.current); }}
                    style={{ background: activeResume === i ? "rgba(255,255,255,0.05)" : "transparent", border: activeResume === i ? `1px solid ${r.color}40` : "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "14px 16px", cursor: "pointer", textAlign: "left", transition: "all 0.2s", display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: activeResume === i ? r.color : "#334155", flexShrink: 0, transition: "all 0.2s" }} />
                    <div>
                      <p style={{ color: activeResume === i ? "white" : "#64748b", fontSize: "13px", fontWeight: 600, margin: 0, transition: "color 0.2s" }}>{r.flaw}</p>
                      <p style={{ color: "#334155", fontSize: "11px", margin: "2px 0 0" }}>{r.name} · {r.title}</p>
                    </div>
                  </button>
                ))}
              </div>
              <button className="cta-btn" onClick={() => navigate("/app")} style={{ width: "100%", textAlign: "center" }}>
                Fix My Resume — $9.99 →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" style={{ padding: "100px 40px" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "56px" }}>
            <p style={{ color: "#60a5fa", fontSize: "12px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>How it works</p>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, marginBottom: "16px" }}>
              Upload. Review. Download.<br />Done in minutes.
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
            {HOW_IT_WORKS.map((step, i) => (
              <div key={i} className="step-card">
                <div style={{ fontSize: "28px", marginBottom: "12px" }}>{step.icon}</div>
                <div style={{ color: "#1d4ed8", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", marginBottom: "8px" }}>{step.step}</div>
                <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 700, marginBottom: "8px" }}>{step.title}</h3>
                <p style={{ color: "#64748b", fontSize: "13px", lineHeight: 1.6, margin: 0 }}>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section style={{ padding: "80px 40px 100px", background: "rgba(0,0,0,0.2)" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "52px" }}>
            <p style={{ color: "#60a5fa", fontSize: "12px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>Pricing</p>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, marginBottom: "12px" }}>
              One-time. No subscription. Yours forever.
            </h2>
            <p style={{ color: "#64748b", fontSize: "15px" }}>Pay once. Re-download anytime from your account.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
            {PRICING.map((plan, i) => (
              <div key={i} className={`pricing-card${plan.highlighted ? " featured" : ""}`} style={{ position: "relative" }}>
                {plan.highlighted && (
                  <div style={{ position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)", background: "linear-gradient(135deg, #2563eb, #7c3aed)", borderRadius: "999px", padding: "4px 16px", fontSize: "11px", fontWeight: 600, color: "white", whiteSpace: "nowrap" }}>
                    BEST VALUE
                  </div>
                )}
                <p style={{ color: "#64748b", fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>{plan.name}</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "4px" }}>
                  <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "36px", fontWeight: 800 }}>{plan.price}</span>
                </div>
                <p style={{ color: "#475569", fontSize: "12px", marginBottom: "24px" }}>{plan.description}</p>
                <div style={{ marginBottom: "24px" }}>
                  {plan.features.map((f, j) => (
                    <div key={j} className="check-item">
                      <span style={{ color: "#4ade80", fontSize: "14px", flexShrink: 0 }}>✓</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
                <button className={plan.highlighted ? "cta-btn" : "cta-btn-outline"} onClick={() => navigate("/app")} style={{ width: "100%", textAlign: "center" }}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ padding: "100px 40px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div className="mesh" style={{ background: "rgba(37,99,235,0.12)", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }} />
        <div style={{ position: "relative", maxWidth: "600px", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 800, marginBottom: "20px", lineHeight: 1.1 }}>
            Your next opportunity<br />is reading your resume<br /><span style={{ color: "#60a5fa" }}>right now.</span>
          </h2>
          <p style={{ color: "#64748b", fontSize: "16px", marginBottom: "36px", lineHeight: 1.6 }}>
            Make sure what they see gets you in the room.
          </p>
          <button className="cta-btn" onClick={() => navigate("/app")} style={{ fontSize: "17px", padding: "20px 52px" }}>
            Transform My Resume — $9.99 →
          </button>
          <p style={{ color: "#1e3a5f", fontSize: "12px", marginTop: "16px" }}>No subscription · Re-download anytime · Takes 60 seconds</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: "32px 40px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "15px", fontWeight: 800, color: "white" }}>
            Resume<span style={{ color: "#60a5fa" }}>IQ</span>
          </span>
          <span style={{ color: "#1e3a5f", fontSize: "11px" }}>by ReviveIQI</span>
        </div>
        <p style={{ color: "#1e3a5f", fontSize: "12px", margin: 0 }}>© 2026 ReviveIQI. All rights reserved.</p>
      </footer>
    </div>
  );
}
