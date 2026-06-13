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
  { step: "02", icon: "✨", title: "AI parses & transforms", body: "GPT-4o extracts every detail and restructures it into a keyword-rich, ATS-optimized Word document." },
  { step: "03", icon: "✏️", title: "Make it yours", body: "Every section is editable — add bullets, sharpen impact, and optionally add a personality-based Working With Me section before you download." },
  { step: "04", icon: "🚀", title: "Download & start applying", body: "Clean Word document, yours forever. Re-download anytime — or feed it straight into the Job Search Pipeline to start applying immediately." },
];

const PRICING = [
  {
    name: "Starter",
    price: "$14.99",
    description: "One-time, no subscription",
    features: [
      "Full ATS-optimized transformation",
      "Keyword alignment for job posts",
      "Editable Word document",
      "Saved to your account forever",
      "Re-download anytime",
    ],
    note: null,
    cta: "Try It Free →",
    highlighted: false,
  },
  {
    name: "Resume + Working With Me",
    price: "$19.99",
    description: "Best value — one-time",
    features: [
      "Everything in Starter",
      "Upload your personality assessments (DISC, MBTI, PI, TKI, 360, or any)",
      "AI synthesizes them into a professional 'Working With Me' section",
      "Auto-added to all future resumes",
      "Free re-synthesis forever",
    ],
    note: "📋 Requires at least one personality assessment PDF or results you can paste in.",
    cta: "Get Bundle →",
    highlighted: true,
  },
  {
    name: "Working With Me Add-On",
    price: "$7.99",
    description: "Already have a resume? Add this.",
    features: [
      "Upload DISC, MBTI, PI, TKI, 360, or any assessment",
      "Jargon-free professional language — no test names mentioned",
      "5 workplace insight fields",
      "Lifetime unlock on your account",
      "Auto-appended to every future resume",
    ],
    note: "📋 Requires at least one personality assessment PDF or results you can paste in.",
    cta: "Unlock Working With Me",
    highlighted: false,
  },
  {
    name: "Monthly Unlimited",
    price: "$19.99",
    description: "Per month · unlimited transforms",
    features: [
      "Unlimited resume transformations for 30 days",
      "Targeting multiple roles or industries",
      "Every application gets a fresh, tailored resume",
      "Working With Me add-on available",
      "Cancel anytime — no auto-renew",
    ],
    note: null,
    cta: "Get Monthly →",
    highlighted: false,
  },
];

const FAQ_ITEMS = [
  {
    q: "Will this actually work for my resume?",
    a: "Yes — if you have real work experience, ResumeIQ will find it and frame it correctly. The tool doesn't invent experience. It takes what you have and rewrites it in the language that gets callbacks. The first transformation is completely free so you can see the result before paying anything.",
  },
  {
    q: "Will ResumeIQ invent or fabricate things I didn't do?",
    a: "No. ResumeIQ is explicitly trained never to invent companies, titles, dates, certifications, or metrics that don't appear in your original resume. It elevates what you have — stronger language, better framing, ATS-safe structure — but will never add a job you didn't have or a number that doesn't exist.",
  },
  {
    q: "What does it actually output?",
    a: "A clean, single-column Word document (.docx) in Calibri font — ATS-safe, no tables, no graphics, no columns. It includes a rewritten summary, elevated experience bullets, skills section, education, and an optional 'Working With Me' behavioral section. You see a before/after ATS score showing the improvement.",
  },
  {
    q: "How long does it take?",
    a: "About 60 seconds from upload to preview. Upload your resume, the AI transforms it, you review and edit any field, then download the Word document.",
  },
  {
    q: "What if I don't have impressive metrics or big numbers?",
    a: "You don't need them. Strong bullets can be specific without being numeric. Every job has proxy metrics — scope, volume, geography, team size, time saved, error rate reduced. ResumeIQ knows how to find and frame these. It never invents numbers that don't exist.",
  },
  {
    q: "How is this different from ChatGPT for resume writing?",
    a: "ChatGPT writes resumes from scratch. ResumeIQ transforms your existing resume — keeping every real fact accurate while elevating the language, fixing ATS structure, and surfacing wins you undersold. It also scores your resume before and after on 4 ATS dimensions and outputs a properly formatted Word document ready to upload to any job portal.",
  },
  {
    q: "Is my resume data private?",
    a: "Yes. Your resume is processed to generate your document and stored in your account history for re-download. Your data is never sold, shared with employers, or used to train AI models.",
  },
  {
    q: "What is the 'Working With Me' section?",
    a: "A professional behavioral summary that tells hiring managers how you work — your communication style, decision-making, how you perform under pressure, and what brings out your best. Synthesized from DISC, MBTI, Predictive Index, or TKI assessment results. It's the only resume section that answers the question every hiring manager has but never gets. No other resume tool offers it.",
  },
];

// Inject FAQ schema into <head> for AEO
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": FAQ_ITEMS.map(item => ({
    "@type": "Question",
    "name": item.q,
    "acceptedAnswer": { "@type": "Answer", "text": item.a },
  })),
};

function FAQAccordion() {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    // Inject FAQ schema
    const existing = document.getElementById("faq-schema");
    if (!existing) {
      const script = document.createElement("script");
      script.id = "faq-schema";
      script.type = "application/ld+json";
      script.textContent = JSON.stringify(faqSchema);
      document.head.appendChild(script);
    }
    return () => { document.getElementById("faq-schema")?.remove(); };
  }, []);

  return (
    <div>
      {FAQ_ITEMS.map((item, i) => (
        <div key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => setOpen(open === i ? null : i)}
            style={{ width: "100%", background: "none", border: "none", textAlign: "left", padding: "20px 0", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", fontFamily: "inherit" }}>
            <span style={{ fontSize: "16px", fontWeight: 500, color: "white", lineHeight: 1.4, flex: 1 }}>{item.q}</span>
            <span style={{ color: "#60a5fa", fontSize: "20px", flexShrink: 0, transition: "transform 0.2s", transform: open === i ? "rotate(45deg)" : "none", marginTop: "2px" }}>+</span>
          </button>
          {open === i && (
            <div style={{ paddingBottom: "20px", fontSize: "15px", color: "#94a3b8", lineHeight: 1.75 }}>{item.a}</div>
          )}
        </div>
      ))}
      <div style={{ marginTop: "32px", textAlign: "center" }}>
        <a href="/faq" style={{ fontSize: "13px", color: "#60a5fa", textDecoration: "none" }}>View all 23 questions →</a>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [, navigate] = useLocation();
  const [activeResume, setActiveResume] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [testimonials, setTestimonials] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/resumeiq/testimonials")
      .then(r => r.json())
      .then(data => setTestimonials(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);
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
      <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />

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
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(6px); } }
        .resume-dot { width: 8px; height: 8px; border-radius: 50%; border: none; cursor: pointer; transition: all 0.2s; }
        .step-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 28px; transition: all 0.3s; }
        .step-card:hover { background: rgba(255,255,255,0.05); border-color: rgba(37,99,235,0.3); transform: translateY(-4px); }
        .pricing-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 32px; transition: all 0.3s; }
        .pricing-card.featured { background: rgba(37,99,235,0.1); border-color: rgba(37,99,235,0.4); }
        .pricing-card:hover { transform: translateY(-4px); }
        .check-item { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; font-size: 13px; color: #94a3b8; }
        .mesh { position: absolute; width: 600px; height: 600px; border-radius: 50%; filter: blur(120px); pointer-events: none; }

        /* ── Mobile responsive ── */
        @media (max-width: 640px) {
          nav { padding: 0 16px !important; }
          nav .nav-desktop-only { display: none !important; }
          .hero-section { padding: 80px 20px 60px !important; }
          .hero-section h1 { font-size: clamp(22px, 6vw, 32px) !important; }
          .hero-section p { font-size: 15px !important; }
          .hero-btns { flex-direction: column !important; align-items: stretch !important; gap: 10px !important; }
          .hero-btns button, .hero-btns a { width: 100% !important; justify-content: center !important; }
          .section-pad { padding: 60px 20px !important; }
          .step-card { padding: 20px !important; }
          .pricing-card { padding: 24px !important; }
          .grid-responsive { grid-template-columns: 1fr !important; }
          .grid-responsive-2 { grid-template-columns: 1fr 1fr !important; }
          .hide-mobile { display: none !important; }
          .cta-btn { padding: 14px 24px !important; font-size: 14px !important; }
          .cta-btn-outline { padding: 12px 20px !important; font-size: 13px !important; }
        }
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
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "18px", fontWeight: 800, color: "white" }}>
            Resume<span style={{ color: "#60a5fa" }}>IQ</span>
          </span>
          <span style={{ color: "#475569", fontSize: "11px", marginLeft: "2px" }}>by ReviveIQI</span>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button
            onClick={() => { window.location.href = "/api/resumeiq/auth/linkedin"; }}
            style={{ display: "flex", alignItems: "center", gap: "7px", background: "#0077B5", color: "white", border: "none", borderRadius: "7px", padding: "9px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
          >
            <svg viewBox="0 0 24 24" style={{ width: "14px", height: "14px", fill: "white", flexShrink: 0 }}>
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            Continue with LinkedIn
          </button>
          <button className="cta-btn-outline" onClick={() => navigate("/app")} style={{ padding: "9px 16px", fontSize: "13px" }}>Sign In</button>
          <button className="cta-btn" onClick={() => navigate("/app")} style={{ padding: "9px 16px", fontSize: "13px" }}>Get Started →</button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero-section" style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "120px 40px 80px", textAlign: "center", overflow: "hidden" }}>
        <div className="mesh" style={{ background: "rgba(37,99,235,0.15)", top: "-100px", left: "-100px" }} />
        <div className="mesh" style={{ background: "rgba(99,102,241,0.1)", bottom: "-100px", right: "-100px" }} />

        <div style={{ position: "relative", maxWidth: "800px" }}>
          <div className="fade-up" style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: "999px", padding: "6px 16px", marginBottom: "28px", fontSize: "12px", color: "#4ade80", fontWeight: 500, letterSpacing: "0.04em" }}>
            <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#4ade80", animation: "pulse 2s infinite" }} />
            YOUR FIRST RESUME IS FREE — NO CREDIT CARD REQUIRED
          </div>

          <h1 className="fade-up-1" style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "clamp(24px, 3.5vw, 40px)", fontWeight: 800, lineHeight: 1.1, marginBottom: "24px", letterSpacing: "-0.02em" }}>
            Your resume is a<br />
            <span style={{ background: "linear-gradient(135deg, #60a5fa, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>digital asset.</span>
            <br />Treat it like one.
          </h1>

          <p className="fade-up-2" style={{ fontSize: "18px", color: "#94a3b8", lineHeight: 1.7, maxWidth: "580px", margin: "0 auto 36px", fontWeight: 300 }}>
            Ambitious professionals keep a polished, ATS-optimized resume in their digital filing cabinet — language aligned with job posts, keywords that pass filters, format that recruiters actually read.
          </p>

          <div className="fade-up-3 hero-btns" style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => { window.location.href = "/api/resumeiq/auth/linkedin"; }}
              style={{ display: "flex", alignItems: "center", gap: "9px", background: "#0077B5", color: "white", border: "none", borderRadius: "9px", padding: "16px 32px", fontSize: "15px", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
            >
              <svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px", fill: "white", flexShrink: 0 }}>
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              Continue with LinkedIn
            </button>
            <button className="cta-btn" onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })} style={{ fontSize: "15px", padding: "16px 32px" }}>
              See How It Works ↓
            </button>
            <button className="cta-btn-outline" onClick={() => navigate("/app")} style={{ fontSize: "15px", padding: "16px 32px" }}>
              Try It Free →
            </button>
          </div>
          <p style={{ color: "#475569", fontSize: "12px", marginTop: "16px" }}>
            First resume free · from $14.99 · No credit card required
          </p>

          {/* ATS trust strip */}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "10px", marginTop: "28px" }}>
            {[
              { icon: "✓", text: "100% ATS-safe format", sub: "single column, no tables, no graphics" },
              { icon: "✓", text: "Zero hallucinated facts", sub: "only elevates what's on your resume" },
              { icon: "✓", text: "Before & after ATS score", sub: "see exactly what improved" },
            ].map(item => (
              <div key={item.text} style={{ display: "flex", alignItems: "flex-start", gap: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "10px 14px", textAlign: "left" }}>
                <span style={{ color: "#4ade80", fontWeight: 700, fontSize: "13px", flexShrink: 0, marginTop: "1px" }}>{item.icon}</span>
                <div>
                  <p style={{ color: "white", fontSize: "12px", fontWeight: 600, margin: 0 }}>{item.text}</p>
                  <p style={{ color: "#475569", fontSize: "11px", margin: "2px 0 0" }}>{item.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Working With Me teaser */}
          <div
            onClick={() => document.getElementById("wwm-section")?.scrollIntoView({ behavior: "smooth" })}
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginTop: "18px", cursor: "pointer", background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: "999px", padding: "7px 16px" }}
          >
            <span style={{ fontSize: "14px" }}>🧠</span>
            <span style={{ fontSize: "12px", color: "#c4b5fd", fontWeight: 500 }}>
              Also includes a "Working With Me" section — the behavioral profile no other resume tool offers
            </span>
            <span style={{ color: "#a78bfa", fontSize: "12px" }}>↓</span>
          </div>
          {/* Scroll nudge */}
          <div style={{ marginTop: "48px", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", opacity: 0.4 }}>
            <span style={{ color: "#94a3b8", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Scroll to explore</span>
            <svg width="16" height="24" viewBox="0 0 16 24" fill="none" style={{ animation: "bounce 1.8s infinite" }}>
              <rect x="1" y="1" width="14" height="22" rx="7" stroke="#94a3b8" strokeWidth="1.5"/>
              <rect x="6.5" y="5" width="3" height="5" rx="1.5" fill="#94a3b8">
                <animate attributeName="y" values="5;11;5" dur="1.8s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="1;0.3;1" dur="1.8s" repeatCount="indefinite"/>
              </rect>
            </svg>
          </div>
        </div>
      </section>

      {/* BAD RESUME EXAMPLES */}
      <section style={{ padding: "80px 40px", background: "rgba(0,0,0,0.3)" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "52px" }}>
            <p style={{ color: "#60a5fa", fontSize: "12px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>The problem</p>
            <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "clamp(20px, 2.5vw, 28px)", fontWeight: 800, marginBottom: "16px" }}>
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
                Try It Free →
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
            <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "clamp(20px, 2.5vw, 28px)", fontWeight: 800, marginBottom: "16px" }}>
              Upload. Review. Download.<br />Done in minutes.
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
            {HOW_IT_WORKS.map((step, i) => (
              <div key={i} className="step-card">
                <div style={{ fontSize: "28px", marginBottom: "12px" }}>{step.icon}</div>
                <div style={{ color: "#1d4ed8", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", marginBottom: "8px" }}>{step.step}</div>
                <h3 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "16px", fontWeight: 700, marginBottom: "8px" }}>{step.title}</h3>
                <p style={{ color: "#64748b", fontSize: "13px", lineHeight: 1.6, margin: 0 }}>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="wwm-section" style={{ padding: "80px 40px 100px", background: "rgba(0,0,0,0.2)" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "52px" }}>
            <p style={{ color: "#60a5fa", fontSize: "12px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>Pricing</p>
            <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "clamp(20px, 2.5vw, 28px)", fontWeight: 800, marginBottom: "12px" }}>
              Simple, transparent pricing.
            </h2>
            <p style={{ color: "#64748b", fontSize: "15px" }}>One-time options or monthly unlimited — no auto-renew, no tricks. First resume always free.</p>
            <p style={{ color: "#475569", fontSize: "13px", marginTop: "10px" }}>
              💡 The "Working With Me" add-on requires a personality assessment (DISC, Myers-Briggs, Predictive Index, TKI, 360 Feedback, or similar). Don't have one? The resume-only option is all you need.
            </p>
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
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "36px", fontWeight: 800 }}>{plan.price}</span>
                </div>
                <p style={{ color: "#475569", fontSize: "12px", marginBottom: "24px" }}>{plan.description}</p>
                <div style={{ marginBottom: "24px" }}>
                  {plan.features.map((f, j) => (
                    <div key={j} className="check-item">
                      <span style={{ color: "#4ade80", fontSize: "14px", flexShrink: 0 }}>✓</span>
                      <span>{f}</span>
                    </div>
                  ))}
                  {plan.note && (
                    <div style={{ marginTop: "12px", padding: "10px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", fontSize: "12px", color: "#64748b", lineHeight: 1.5 }}>
                      {plan.note}
                    </div>
                  )}
                </div>
                <button className={plan.highlighted ? "cta-btn" : "cta-btn-outline"} onClick={() => navigate("/app")} style={{ width: "100%", textAlign: "center" }}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ padding: "80px 40px", background: "rgba(0,0,0,0.2)" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <p style={{ fontSize: "11px", color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, textAlign: "center", marginBottom: "12px" }}>What people are saying</p>
          <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "clamp(20px, 2.5vw, 30px)", fontWeight: 800, textAlign: "center", marginBottom: "48px", lineHeight: 1.2 }}>
            The resume that communicates<br/><span style={{ color: "#60a5fa" }}>what you've actually built.</span>
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>

            {/* Founder testimonial — always shown */}
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "28px 24px" }}>
              <div style={{ display: "flex", gap: "3px", marginBottom: "16px" }}>
                {"★★★★★".split("").map((s,i) => <span key={i} style={{ color: "#fbbf24", fontSize: "16px" }}>{s}</span>)}
              </div>
              <p style={{ color: "#e2e8f0", fontSize: "14px", lineHeight: 1.75, marginBottom: "20px" }}>
                "I built ResumeIQ after watching my own resume fail to communicate 18 years of enterprise sales experience. When I ran it through, the bullets that felt obvious to me finally read the way they should have the whole time. The score went from 3 to 8. It was the resume I should have had all along."
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", background: "rgba(37,99,235,0.3)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: 700, color: "#60a5fa", flexShrink: 0 }}>B</div>
                <div>
                  <p style={{ color: "white", fontSize: "13px", fontWeight: 700, margin: 0 }}>Bryan Greer</p>
                  <p style={{ color: "#64748b", fontSize: "12px", margin: 0 }}>Founder, ReviveIQI · 18 years enterprise sales</p>
                </div>
              </div>
            </div>

            {/* Dynamic testimonials */}
            {testimonials.slice(0, 2).map((t: any) => (
              <div key={t.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "28px 24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                  <div style={{ display: "flex", gap: "3px" }}>
                    {Array.from({ length: t.rating }).map((_: any, i: number) => <span key={i} style={{ color: "#fbbf24", fontSize: "16px" }}>★</span>)}
                  </div>
                  {t.preScore && t.postScore && (
                    <span style={{ fontSize: "11px", color: "#34d399", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "99px", padding: "2px 10px", fontFamily: "DM Mono, monospace" }}>
                      {t.preScore} → {t.postScore}
                    </span>
                  )}
                </div>
                <p style={{ color: "#e2e8f0", fontSize: "14px", lineHeight: 1.75, marginBottom: "20px" }}>"{t.quote}"</p>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", background: "rgba(37,99,235,0.2)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: 700, color: "#60a5fa", flexShrink: 0 }}>
                    {(t.name || "U")[0].toUpperCase()}
                  </div>
                  <div>
                    <p style={{ color: "white", fontSize: "13px", fontWeight: 700, margin: 0, filter: "blur(4px)", userSelect: "none" }}>{t.name}</p>
                    {t.title && <p style={{ color: "#64748b", fontSize: "12px", margin: 0, filter: "blur(4px)", userSelect: "none" }}>{t.title}</p>}
                  </div>
                </div>
              </div>
            ))}

          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: "80px 40px", background: "rgba(0,0,0,0.3)" }}>
        <div style={{ maxWidth: "720px", margin: "0 auto" }}>
          <p style={{ fontSize: "11px", color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, textAlign: "center", marginBottom: "12px" }}>FAQ</p>
          <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "clamp(20px, 2.5vw, 30px)", fontWeight: 800, textAlign: "center", marginBottom: "48px", lineHeight: 1.2 }}>
            Questions worth answering<br/><span style={{ color: "#60a5fa" }}>before you upload.</span>
          </h2>
          <FAQAccordion />
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ padding: "100px 40px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div className="mesh" style={{ background: "rgba(37,99,235,0.12)", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }} />
        <div style={{ position: "relative", maxWidth: "600px", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "clamp(20px, 2.5vw, 32px)", fontWeight: 800, marginBottom: "20px", lineHeight: 1.1 }}>
            Your next opportunity<br />is reading your resume<br /><span style={{ color: "#60a5fa" }}>right now.</span>
          </h2>
          <p style={{ color: "#64748b", fontSize: "16px", marginBottom: "36px", lineHeight: 1.6 }}>
            Make sure what they see gets you in the room.
          </p>
          <button className="cta-btn" onClick={() => navigate("/app")} style={{ fontSize: "17px", padding: "20px 52px" }}>
            Try It Free →
          </button>
          <p style={{ color: "#1e3a5f", fontSize: "12px", marginTop: "16px" }}>First resume free · from $14.99 · No credit card required</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: "32px 40px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "15px", fontWeight: 800, color: "white" }}>
            Resume<span style={{ color: "#60a5fa" }}>IQ</span>
          </span>
          <span style={{ color: "#1e3a5f", fontSize: "11px" }}>by ReviveIQI</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
          <a href="/terms" style={{ color: "#475569", fontSize: "12px", textDecoration: "none" }}>Terms of Service</a>
          <a href="/privacy" style={{ color: "#475569", fontSize: "12px", textDecoration: "none" }}>Privacy Policy</a>
          <a href="mailto:bryan@reviveiqi.com" style={{ color: "#475569", fontSize: "12px", textDecoration: "none" }}>Contact</a>
        </div>
        <p style={{ color: "#1e3a5f", fontSize: "12px", margin: 0 }}>© 2026 ReviveIQI. Fort Lauderdale, FL.</p>
      </footer>
    </div>
  );
}
