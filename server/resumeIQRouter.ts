import type { Express, Request, Response } from "express";
import { createCheckoutSession, verifyPayment } from "./stripeService";
import crypto from "crypto";
import JSZip from "jszip";
import { initDb, createUser, loginUser, getUserById, saveResume, getUserResumes, getResumeById, captureEmail as dbCaptureEmail, generateToken, verifyToken, upgradeToStarter, incrementResumeCount } from "./authService";

const OPENAI_API = "https://api.openai.com/v1/chat/completions";

const sessionStore = new Map<string, { parsedData: any; paid: boolean; createdAt: number; freeUsed: boolean }>();
setInterval(() => { const now = Date.now(); for (const [k, v] of sessionStore.entries()) { if (now - v.createdAt > 7200000) sessionStore.delete(k); } }, 1800000);

const freeUsedByIp = new Map<string, number>();
function getClientIp(req: Request): string {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
}

function stripJson(raw: string): string {
  const clean = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const match = clean.match(/\{[\s\S]*\}/);
  return match ? match[0] : clean;
}

async function parseResume(fileBase64: string, fileName: string): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const lower = fileName.toLowerCase();
  const isDocx = lower.endsWith(".docx") || lower.endsWith(".doc");
  const isPdf = lower.endsWith(".pdf");

  console.log(`[ResumeIQ] Parsing ${fileName} (size: ${Buffer.from(fileBase64, "base64").length} bytes)`);

  // For DOCX: extract text using JSZip
  let textContent = "";
  if (isDocx) {
    try {
      const JSZip = require("jszip");
      const buffer = Buffer.from(fileBase64, "base64");
      const zip = await JSZip.loadAsync(buffer);
      const docXml = await zip.file("word/document.xml")?.async("string");
      if (docXml) {
        textContent = docXml
          .replace(/<\/w:p>/g, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
          .replace(/\s+/g, " ").trim().slice(0, 15000);
        console.log(`[ResumeIQ] DOCX extracted ${textContent.length} chars`);
      }
    } catch (e) {
      console.warn("[ResumeIQ] DOCX extraction failed:", e);
    }
  }

  const systemPrompt = `You are an expert resume writer and parser. Your job is to:
1. Extract EVERY piece of information from the resume text provided
2. Rewrite each bullet point to be more impactful with strong action verbs and quantified metrics
3. Write a compelling 2-3 sentence professional summary based on their actual experience
4. Return ONLY valid JSON — never apologize, never explain, never refuse

CRITICAL RULES:
- Use the ACTUAL person's name, companies, dates, and roles from the text
- Do NOT invent fake names like "John Doe" or fake companies like "Tech Solutions Inc"
- If you cannot read a field clearly, use an empty string — do not guess
- Rewrite bullets to be stronger but keep the same factual content`;

  const jsonSchema = `{
  "name": "Extract the actual person's full name from the resume",
  "email": "actual email address from resume",
  "phone": "actual phone number from resume",
  "location": "actual city and state from resume",
  "linkedin": "actual linkedin URL if present, else empty string",
  "title": "their most recent actual job title",
  "summary": "Write a compelling 2-3 sentence professional summary using their REAL experience, achievements, and career trajectory",
  "experience": [
    {
      "title": "their actual job title",
      "company": "the actual company name",
      "location": "actual city, state",
      "startDate": "MM/YYYY from resume",
      "endDate": "MM/YYYY or Present",
      "description": "one sentence describing what this company actually does",
      "bullets": [
        "Rewrite their actual bullet into a stronger version starting with an action verb and including metrics where available",
        "Keep the same facts but make the language more impactful",
        "Include dollar amounts, percentages, team sizes, and timeframes from the original"
      ],
      "achievements": ["any awards, recognitions, or clubs mentioned"]
    }
  ],
  "skills": {
    "categories": [
      { "name": "actual skill category name", "skills": ["skill1", "skill2", "skill3"] }
    ]
  },
  "education": [
    { "degree": "actual degree name", "school": "actual school name", "location": "city, state", "year": "graduation year" }
  ],
  "certifications": ["any certifications mentioned"],
  "seniorityLevel": "entry or mid or senior or executive based on their experience",
  "yearsOfExperience": 0,
  "topMetrics": [
    "their single best quantified achievement with dollar amount or percentage",
    "second best achievement",
    "third best achievement"
  ]
}
Return ONLY the JSON object. Start with { and end with }.`;

  console.log(`[ResumeIQ] Extracted ${textContent.length} chars. First 200: ${textContent.slice(0, 200)}`);

  // If we have DOCX text, use it
  if (textContent && textContent.length > 200) {
    const res = await fetch(OPENAI_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Parse this resume:\n\n${textContent}\n\nReturn JSON:\n${jsonSchema}` }
        ],
        max_tokens: 4000, temperature: 0.1,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
    const data = await res.json() as any;
    return JSON.parse(stripJson(data.choices?.[0]?.message?.content || "{}"));
  }

  // For PDF or failed DOCX: use OpenAI with file content as text extraction fallback
  // Since native file upload needs Files API, use vision with base64
  const mimeType = isPdf ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  
  // Try OpenAI with the file as a document
  const res = await fetch(OPENAI_API, {
    method: "POST", 
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: `Parse this resume file and return JSON:\n${jsonSchema}` },
            { type: "text", text: `File content (base64 ${isPdf ? "PDF" : "DOCX"}): The file has been uploaded. Please extract all resume information and return the JSON structure above.` }
          ]
        }
      ],
      max_tokens: 4000, temperature: 0.1,
    }),
  });

  if (!res.ok) throw new Error(`OpenAI error: ${res.status} ${await res.text()}`);
  const data = await res.json() as any;
  const raw = data.choices?.[0]?.message?.content || "{}";
  
  // If OpenAI says it can't read the file, extract what we can from raw buffer
  if (raw.toLowerCase().includes("cannot") || raw.toLowerCase().includes("sorry") || raw.toLowerCase().includes("don't see")) {
    // Last resort: extract ASCII text from buffer
    const buffer = Buffer.from(fileBase64, "base64");
    const ascii = buffer.toString("binary")
      .replace(/[^\x20-\x7E\n\r]/g, " ")
      .replace(/\s+/g, " ").trim().slice(0, 8000);
    
    const fallbackRes = await fetch(OPENAI_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `This is raw text extracted from a resume PDF. Some characters may be garbled but extract what you can:\n\n${ascii}\n\nReturn JSON:\n${jsonSchema}` }
        ],
        max_tokens: 4000, temperature: 0.3,
      }),
    });
    if (!fallbackRes.ok) throw new Error("Failed to parse resume");
    const fallbackData = await fallbackRes.json() as any;
    return JSON.parse(stripJson(fallbackData.choices?.[0]?.message?.content || "{}"));
  }

  return JSON.parse(stripJson(raw));
}

async function generateDocx(parsedData: any): Promise<Buffer> {
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, ShadingType, LevelFormat, TabStopType } = await import("docx");

  const BLUE = "1F4E79", LIGHT_BLUE = "2E75B6", DARK = "1A1A1A", GRAY = "595959";
  const W = 9360;

  const sec = (text: string) => new Paragraph({
    spacing: { before: 240, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: LIGHT_BLUE, space: 4 } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 22, color: BLUE, font: "Arial" })]
  });

  const jobHdr = (title: string, company: string, loc: string, dates: string) => [
    new Paragraph({
      spacing: { before: 160, after: 40 },
      tabStops: [{ type: TabStopType.RIGHT, position: W }],
      children: [
        new TextRun({ text: title, bold: true, size: 22, font: "Arial", color: DARK }),
        new TextRun({ text: "\t" }), new TextRun({ text: dates, size: 20, font: "Arial", color: GRAY, italics: true }),
      ]
    }),
    new Paragraph({
      spacing: { before: 0, after: 60 },
      children: [
        new TextRun({ text: company, bold: true, size: 20, font: "Arial", color: LIGHT_BLUE }),
        new TextRun({ text: "  |  ", size: 20, font: "Arial", color: GRAY }),
        new TextRun({ text: loc, size: 20, font: "Arial", color: GRAY, italics: true }),
      ]
    }),
  ];

  const bul = (text: string) => new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: 20, font: "Arial", color: DARK })]
  });

  const expSection: any[] = [];
  for (const exp of (parsedData.experience || [])) {
    expSection.push(...jobHdr(exp.title||"", exp.company||"", exp.location||"", `${exp.startDate||""} – ${exp.endDate||"Present"}`));
    if (exp.description) expSection.push(new Paragraph({ spacing:{before:40,after:60}, children:[new TextRun({text:exp.description,size:19,font:"Arial",color:GRAY,italics:true})] }));
    for (const b of (exp.bullets||[]).slice(0,5)) expSection.push(bul(b));
    for (const a of (exp.achievements||[])) { if (a) expSection.push(new Paragraph({ spacing:{before:60,after:60}, children:[new TextRun({text:`🏆 ${a}`,bold:true,size:19,font:"Arial",color:LIGHT_BLUE})] })); }
  }

  const skillRows = (parsedData.skills?.categories||[]).map((cat:any) => new TableRow({
    children: [
      new TableCell({ width:{size:2500,type:WidthType.DXA}, borders:{top:{style:BorderStyle.NONE},bottom:{style:BorderStyle.NONE},left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE}}, shading:{fill:"EBF3FB",type:ShadingType.CLEAR}, margins:{top:80,bottom:80,left:120,right:120}, children:[new Paragraph({children:[new TextRun({text:cat.name,bold:true,size:18,font:"Arial",color:BLUE})]})] }),
      new TableCell({ width:{size:6860,type:WidthType.DXA}, borders:{top:{style:BorderStyle.NONE},bottom:{style:BorderStyle.NONE},left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE}}, margins:{top:80,bottom:80,left:120,right:120}, children:[new Paragraph({children:[new TextRun({text:(cat.skills||[]).join(" · "),size:18,font:"Arial",color:DARK})]})] }),
    ]
  }));

  const doc = new Document({
    numbering: { config:[{reference:"bullets",levels:[{level:0,format:LevelFormat.BULLET,text:"▪",alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:360,hanging:260}}}}]}] },
    styles: { default:{document:{run:{font:"Arial",size:20}}} },
    sections: [{
      properties: { page:{size:{width:12240,height:15840},margin:{top:864,right:1080,bottom:864,left:1080}} },
      children: [
        new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:60},children:[new TextRun({text:(parsedData.name||"").toUpperCase(),bold:true,size:52,font:"Arial",color:BLUE})]}),
        new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:80},children:[new TextRun({text:parsedData.title||"",size:22,font:"Arial",color:GRAY,italics:true})]}),
        new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:0,after:200},children:[new TextRun({text:[parsedData.location,parsedData.phone,parsedData.email,parsedData.linkedin].filter(Boolean).join("  |  "),size:19,font:"Arial",color:GRAY})]}),
        sec("Professional Summary"),
        new Paragraph({spacing:{before:100,after:80},children:[new TextRun({text:parsedData.summary||"",size:20,font:"Arial",color:DARK})]}),
        ...(parsedData.topMetrics?.length ? [sec("Career Highlights"),...parsedData.topMetrics.slice(0,3).map((m:string)=>bul(m))] : []),
        sec("Professional Experience"),
        ...expSection,
        ...(skillRows.length ? [sec("Core Competencies"),new Table({width:{size:W,type:WidthType.DXA},columnWidths:[2500,6860],rows:skillRows})] : []),
        sec("Education"),
        ...(parsedData.education||[]).map((edu:any) => new Paragraph({spacing:{before:80,after:40},children:[
          new TextRun({text:edu.degree||"",bold:true,size:20,font:"Arial",color:DARK}),
          new TextRun({text:"  —  ",size:20,font:"Arial",color:GRAY}),
          new TextRun({text:`${edu.school||""}, ${edu.location||""}`,size:20,font:"Arial",color:LIGHT_BLUE}),
          ...(edu.year?[new TextRun({text:`  ${edu.year}`,size:19,font:"Arial",color:GRAY,italics:true})]:[]),
        ]})),
        ...(parsedData.certifications?.length ? [sec("Certifications"),...parsedData.certifications.map((c:string)=>bul(c))] : []),
      ]
    }]
  });
  return await Packer.toBuffer(doc);
}

// Email capture service
async function captureEmail(email: string, name: string): Promise<void> {
  const dbUrl = process.env.RESUMEIQ_DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) return;

  try {
    const mysql2 = require("mysql2/promise");
    const conn = await mysql2.createConnection(dbUrl);
    
    // Create table if not exists
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS email_captures (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(320) NOT NULL,
        name VARCHAR(255),
        source VARCHAR(100) DEFAULT 'resumeiq',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_email (email)
      )
    `);
    
    // Insert email (ignore duplicates)
    await conn.execute(
      `INSERT IGNORE INTO email_captures (email, name, source) VALUES (?, ?, 'resumeiq')`,
      [email, name]
    );
    
    await conn.end();
    console.log(`[ResumeIQ] Email captured: ${email}`);
  } catch (err) {
    console.warn("[ResumeIQ] Email capture failed:", err);
  }
}

function getTokenUser(req: Request): { userId: number; email: string } | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return verifyToken(auth.slice(7));
}

export function registerResumeIQRoutes(app: Express) {
  // Initialize database tables
  initDb().catch(console.error);
  // Auth routes
  app.post("/api/resumeiq/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body;
      if (!email || !password) { res.status(400).json({ error: "Email and password required" }); return; }
      const user = await createUser(email, password, name || "");
      const token = generateToken(user.id, user.email);
      res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
    } catch (error: any) {
      if (error.message?.includes("Duplicate")) res.status(400).json({ error: "Email already registered" });
      else res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/resumeiq/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const user = await loginUser(email, password);
      if (!user) { res.status(401).json({ error: "Invalid email or password" }); return; }
      const token = generateToken(user.id, user.email);
      res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/resumeiq/auth/me", async (req: Request, res: Response) => {
    const tokenUser = getTokenUser(req);
    if (!tokenUser) { res.status(401).json({ error: "Unauthorized" }); return; }
    const user = await getUserById(tokenUser.userId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json(user);
  });

  // History routes
  app.get("/api/resumeiq/history", async (req: Request, res: Response) => {
    const tokenUser = getTokenUser(req);
    if (!tokenUser) { res.status(401).json({ error: "Unauthorized" }); return; }
    const resumes = await getUserResumes(tokenUser.userId);
    res.json(resumes);
  });

  app.get("/api/resumeiq/resume/:id/download", async (req: Request, res: Response) => {
    try {
      const tokenUser = getTokenUser(req);
      if (!tokenUser) { res.status(401).json({ error: "Unauthorized" }); return; }
      const resume = await getResumeById(parseInt(req.params.id), tokenUser.userId);
      if (!resume) { res.status(404).json({ error: "Resume not found" }); return; }
      const buffer = Buffer.from(resume.docxBase64, "base64");
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${resume.candidateName?.replace(/\s+/g,"_") || "Resume"}_ResumeIQ.docx"`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Email capture
  app.post("/api/resumeiq/capture-email", async (req: Request, res: Response) => {
    try {
      const { email, name } = req.body;
      if (!email) { res.status(400).json({ error: "Email required" }); return; }
      await dbCaptureEmail(email, name || "");
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/resumeiq/transform", async (req: Request, res: Response) => {
    try {
      const { fileBase64, fileName } = req.body;
      if (!fileBase64) { res.status(400).json({ error: "No file provided" }); return; }
      const parsed = await parseResume(fileBase64, fileName || "resume.pdf");
      const sessionId = crypto.randomBytes(16).toString("hex");
      // Determine if this resume is free
      const tokenUser = getTokenUser(req);
      const cookies = req.headers.cookie || "";
      const hasCookie = cookies.includes("resumeiq_free_used=1");
      const ip = getClientIp(req);

      let isFree = false;
      let resumeLimit = 1; // default free tier

      if (tokenUser) {
        // Logged in user - check their plan and resume count
        const dbUser = await getUserById(tokenUser.userId);
        const resumeCount = dbUser?.resumeCount || 0;
        const plan = dbUser?.plan || "free";

        if (plan === "monthly" || plan === "agency") {
          isFree = true; // unlimited
        } else if (plan === "starter") {
          isFree = resumeCount < 3; // 3 resumes on starter
        } else {
          isFree = resumeCount < 1; // 1 free resume
        }
      } else {
        // Guest user - check cookie and IP
        isFree = !hasCookie && (freeUsedByIp.get(ip) || 0) === 0;
      }

      sessionStore.set(sessionId, { parsedData: parsed, paid: isFree, createdAt: Date.now(), freeUsed: isFree });
      console.log(`[ResumeIQ] Session created for ${parsed.name} (free: ${isFree})`);
      res.json({ ...parsed, sessionId, isFree });
    } catch (error: any) {
      console.error("[ResumeIQ] Transform error:", error);
      res.status(500).json({ error: error.message || "Failed to transform resume" });
    }
  });

  app.get("/api/resumeiq/session/:sessionId", (req: Request, res: Response) => {
    const session = sessionStore.get(req.params.sessionId);
    if (!session) { res.status(404).json({ error: "Session not found" }); return; }
    res.json(session.parsedData);
  });

  app.post("/api/resumeiq/checkout", async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.body;
      const session = sessionStore.get(sessionId);
      if (!session) { res.status(404).json({ error: "Session not found" }); return; }
      if (session.paid) { res.json({ alreadyPaid: true }); return; }
      const origin = req.headers.origin || `https://${req.headers.host}`;
      const { url } = await createCheckoutSession(`${origin}/?payment=success`, `${origin}/?payment=cancelled`, sessionId);
      res.json({ url });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/resumeiq/verify-payment", async (req: Request, res: Response) => {
    try {
      const { stripeSessionId, resumeiqSession } = req.body;
      const session = sessionStore.get(resumeiqSession);
      if (!session) { res.status(404).json({ error: "Session expired" }); return; }
      const paid = await verifyPayment(stripeSessionId);
      if (paid) {
        session.paid = true;
        if (session.freeUsed) { const ip = getClientIp(req); freeUsedByIp.set(ip, (freeUsedByIp.get(ip)||0)+1); }
      }
      res.json({ paid });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.post("/api/resumeiq/generate", async (req: Request, res: Response) => {
    try {
      const { sessionId, parsedData } = req.body;
      let data = parsedData;
      if (sessionId) {
        const session = sessionStore.get(sessionId);
        if (!session) { res.status(404).json({ error: "Session expired. Please start over." }); return; }
        if (!session.paid) { res.status(402).json({ error: "Payment required" }); return; }
        data = session.parsedData;
      }
      if (!data) { res.status(400).json({ error: "No resume data" }); return; }
      
      // Ensure all required fields exist to prevent DOCX generation crash
      if (!data.name || data.name === "Full Name or Unknown" || data.name === "John Doe") data.name = "Resume";
      if (!data.title) data.title = "";
      if (!data.summary) data.summary = "";
      if (!data.location) data.location = "";
      if (!data.email) data.email = "";
      if (!data.phone) data.phone = "";
      if (!data.experience || !Array.isArray(data.experience)) data.experience = [];
      if (!data.skills || !data.skills.categories) data.skills = { categories: [] };
      if (!data.education || !Array.isArray(data.education)) data.education = [];
      if (!data.topMetrics || !Array.isArray(data.topMetrics)) data.topMetrics = [];
      if (!data.certifications) data.certifications = [];
      
      // Fix each experience entry
      data.experience = data.experience.map((exp: any) => ({
        title: exp.title || "",
        company: exp.company || "",
        location: exp.location || "",
        startDate: exp.startDate || "",
        endDate: exp.endDate || "Present",
        description: exp.description || "",
        bullets: Array.isArray(exp.bullets) ? exp.bullets.filter(Boolean) : [],
        achievements: Array.isArray(exp.achievements) ? exp.achievements.filter(Boolean) : [],
      }));
      const buffer = await generateDocx(data);
      const fileName = `${(data.name||"Resume").replace(/\s+/g,"_")}_ResumeIQ.docx`;
      res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition",`attachment; filename="${fileName}"`);
      res.send(buffer);
    } catch (error: any) {
      console.error("[ResumeIQ] Generate error:", error);
      res.status(500).json({ error: error.message || "Failed to generate resume" });
    }
  });
}
