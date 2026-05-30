import type { Express, Request, Response } from "express";
import { createCheckoutSession, createPersonalityCheckoutSession, createBundleCheckoutSession, verifyPayment } from "./stripeService";
import { sendEmail, logEmailSend, alreadySent } from "./emailService";
import crypto from "crypto";
import JSZip from "jszip";
// docx imported dynamically inside generateDocx to avoid ESM/CJS interop issues
import {
  initDb, migrateDb, createUser, loginUser, getUserById, saveResume,
  getUserResumes, getResumeById, captureEmail as dbCaptureEmail,
  generateToken, verifyToken, upgradeToStarter, incrementResumeCount,
  unlockPersonality, saveWorkingWithMe,
} from "./authService";

const OPENAI_API = "https://api.openai.com/v1/chat/completions";

// ── DB-BACKED SESSION STORE ──────────────────────────────────────────────
// Sessions stored in TiDB so they survive server restarts and scale across instances

async function createSession(sessionId: string, parsedData: any, paid: boolean, freeUsed: boolean) {
  const { getDb } = await import("./authService");
  const conn = await getDb();
  if (!conn) {
    // Fallback to memory if DB unavailable
    memoryStore.set(sessionId, { parsedData, paid, createdAt: Date.now(), freeUsed });
    return;
  }
  try {
    await conn.execute(
      `INSERT INTO riq_sessions (sessionId, parsedData, paid, freeUsed, createdAt, expiresAt)
       VALUES (?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 2 HOUR))
       ON DUPLICATE KEY UPDATE parsedData=VALUES(parsedData), paid=VALUES(paid), freeUsed=VALUES(freeUsed), expiresAt=VALUES(expiresAt)`,
      [sessionId, JSON.stringify(parsedData), paid ? 1 : 0, freeUsed ? 1 : 0]
    );
  } finally { await conn.end(); }
}

async function getSession(sessionId: string): Promise<{ parsedData: any; paid: boolean; freeUsed: boolean } | null> {
  const { getDb } = await import("./authService");
  const conn = await getDb();
  if (!conn) return memoryStore.get(sessionId) || null;
  try {
    const [rows] = await conn.execute(
      `SELECT parsedData, paid, freeUsed FROM riq_sessions WHERE sessionId = ? AND expiresAt > NOW()`,
      [sessionId]
    ) as any;
    if (!rows[0]) return null;
    return { parsedData: JSON.parse(rows[0].parsedData), paid: !!rows[0].paid, freeUsed: !!rows[0].freeUsed };
  } finally { await conn.end(); }
}

async function updateSessionPaid(sessionId: string) {
  const { getDb } = await import("./authService");
  const conn = await getDb();
  if (!conn) { const s = memoryStore.get(sessionId); if (s) s.paid = true; return; }
  try {
    await conn.execute(`UPDATE riq_sessions SET paid = 1 WHERE sessionId = ?`, [sessionId]);
  } finally { await conn.end(); }
}

async function deleteSession(sessionId: string) {
  const { getDb } = await import("./authService");
  const conn = await getDb();
  if (!conn) { memoryStore.delete(sessionId); return; }
  try {
    await conn.execute(`DELETE FROM riq_sessions WHERE sessionId = ?`, [sessionId]);
  } finally { await conn.end(); }
}

// Memory fallback for when DB is unavailable
const memoryStore = new Map<string, { parsedData: any; paid: boolean; createdAt: number; freeUsed: boolean }>();

const freeUsedByIp = new Map<string, number>();

function getClientIp(req: Request): string {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    || req.ip || "unknown";
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

  let textContent = "";
  if (isDocx) {
    try {
      const buffer = Buffer.from(fileBase64, "base64");
      const zip = await JSZip.loadAsync(buffer);
      const docXml = await zip.file("word/document.xml")?.async("string");
      if (docXml) {
        textContent = docXml
          .replace(/<\/w:p>/g, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/&amp;/g, "&").replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">").replace(/&quot;/g, '"')
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
- Extract the person's FULL legal name including middle name if present (e.g. "Bryan Michael Greer" not "Bryan Greer")
- Use the ACTUAL person's name, companies, dates, and roles from the text
- Do NOT invent fake names like "John Doe" or fake companies like "Tech Solutions Inc"
- If you cannot read a field clearly, use an empty string — do not guess
- For partial dates with only a year (e.g. "2019"), return "2019" for startDate and "" (empty string) for endDate — do NOT repeat the year, do NOT add months, do NOT add "Present"
- Preserve language fluency levels EXACTLY as written — do NOT upgrade "Conversational" to "Fluent"
- CRITICAL: Search the ENTIRE document for a Languages section. If found, extract EVERY language listed with its exact fluency level into the languages array. Example output: [{"language":"English","level":"Native"},{"language":"Spanish","level":"Conversational"},{"language":"Portuguese","level":"Beginner — reading only"}]. Never leave this array empty if a Languages section exists in the document.
- Rewrite bullets to be stronger but keep the same factual content
- If a role has NO bullets in the original text, return an empty bullets array [] — do NOT invent responsibilities
- If a role only has a description line but no bullet points, bullets must be []`;

  const jsonSchema = `{
  "name": "Extract the actual person's full name from the resume",
  "email": "actual email address from resume",
  "phone": "actual phone number from resume",
  "location": "actual city and state from resume",
  "linkedin": "actual linkedin URL if present, else empty string",
  "title": "their most recent actual job title",
  "summary": "Write a compelling 2-3 sentence professional summary using their REAL experience",
  "experience": [
    {
      "title": "their actual job title",
      "company": "the actual company name",
      "location": "actual city, state",
      "startDate": "MM/YYYY from resume",
      "endDate": "MM/YYYY or Present",
      "description": "one sentence describing what this company actually does",
      "bullets": [
        "Rewrite their actual bullet into a stronger version starting with an action verb and including metrics where available"
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
  "certifications": ["include full certification text exactly as written, including expiry dates e.g. 'AWS Solutions Architect – Associate | Expires 2026'"],
  "seniorityLevel": "entry or mid or senior or executive based on their experience",
  "yearsOfExperience": 0,
  "languages": [
    { "language": "actual language name", "level": "exact fluency level as written — never upgrade" }
  ],
  "topMetrics": [
    "their single best quantified achievement with dollar amount or percentage",
    "second best achievement",
    "third best achievement"
  ]
}
Return ONLY the JSON object. Start with { and end with }.`;

  console.log(`[ResumeIQ] Text length: ${textContent.length}. First 200: ${textContent.slice(0, 200)}`);

  // DOCX path: use extracted text
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
        max_tokens: 4000,
        temperature: 0.1,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
    const data = await res.json() as any;
    return JSON.parse(stripJson(data.choices?.[0]?.message?.content || "{}"));
  }

  // PDF path: extract raw text from buffer and send to GPT
  const buffer = Buffer.from(fileBase64, "base64");
  let extractedText = "";

  if (isPdf) {
    // Extract readable ASCII from PDF binary
    extractedText = buffer.toString("binary")
      .replace(/[^\x20-\x7E\n\r]/g, " ")
      .replace(/\s+/g, " ").trim().slice(0, 12000);
  }

  if (extractedText.length > 200) {
    const res = await fetch(OPENAI_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Parse this resume (extracted from PDF, some characters may be garbled):\n\n${extractedText}\n\nReturn JSON:\n${jsonSchema}` }
        ],
        max_tokens: 4000,
        temperature: 0.2,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
    const data = await res.json() as any;
    return JSON.parse(stripJson(data.choices?.[0]?.message?.content || "{}"));
  }

  throw new Error("Could not extract text from this file. Please try a different format.");
}

async function generateDocx(parsedData: any): Promise<Buffer> {
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, BorderStyle, WidthType, ShadingType, LevelFormat,
    TabStopType, UnderlineType, PageBreak
  } = await import("docx");

  // ── PALETTE ──────────────────────────────────────────────────────────────
  const NAVY   = "0A1628";
  const BLUE   = "1B4F9B";
  const ACCENT = "2E75B6";
  const GRAY   = "64748B";
  const LGRAY  = "94A3B8";
  const WHITE  = "FFFFFF";
  const W      = 9360; // page content width in twips

  // ── HELPERS ──────────────────────────────────────────────────────────────
  const run = (text: string, opts: any = {}) => new TextRun({
    text, font: "Calibri", size: opts.size || 20,
    bold: opts.bold, italics: opts.italics, color: opts.color || "000000",
    underline: opts.underline,
  });

  const bul = (text: string) => new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 50, after: 50 },
    children: [run(text, { size: 19, color: "1E293B" })]
  });

  const spacer = (sz = 80) => new Paragraph({
    spacing: { before: 0, after: sz }, children: []
  });

  // ── SECTION HEADER ────────────────────────────────────────────────────────
  const sectionHeader = (text: string) => new Paragraph({
    spacing: { before: 220, after: 60 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 3 } },
    children: [
      new TextRun({
        text: text.toUpperCase(), font: "Calibri", size: 20,
        bold: true, color: NAVY,
        characterSpacing: 60,
      })
    ]
  });

  // ── ROLE HEADER ───────────────────────────────────────────────────────────
  const roleHeader = (title: string, company: string, loc: string, dates: string) => [
    new Paragraph({
      spacing: { before: 160, after: 30 },
      tabStops: [{ type: TabStopType.RIGHT, position: W }],
      children: [
        new TextRun({ text: title, font: "Calibri", size: 21, bold: true, color: NAVY }),
        new TextRun({ text: "\t" }),
        new TextRun({ text: dates, font: "Calibri", size: 19, italics: true, color: GRAY }),
      ]
    }),
    new Paragraph({
      spacing: { before: 0, after: 60 },
      children: [
        new TextRun({ text: company, font: "Calibri", size: 19, bold: true, color: ACCENT }),
        new TextRun({ text: "  ·  ", font: "Calibri", size: 19, color: LGRAY }),
        new TextRun({ text: loc, font: "Calibri", size: 18, italics: true, color: GRAY }),
      ]
    }),
  ];

  // ── EXPERIENCE ────────────────────────────────────────────────────────────
  const expSection: any[] = [];
  for (const exp of (parsedData.experience || [])) {
    expSection.push(...roleHeader(
      exp.title || "", exp.company || "", exp.location || "",
      `${exp.startDate || ""}${exp.endDate ? " – " + exp.endDate : ""}`
    ));
    if (exp.description) {
      expSection.push(new Paragraph({
        spacing: { before: 30, after: 60 },
        children: [new TextRun({ text: exp.description, font: "Calibri", size: 18, italics: true, color: GRAY })]
      }));
    }
    for (const b of (exp.bullets || []).slice(0, 5)) {
      if (b) expSection.push(bul(b));
    }
    for (const a of (exp.achievements || [])) {
      if (a) expSection.push(new Paragraph({
        spacing: { before: 60, after: 40 },
        children: [new TextRun({ text: `🏆  ${a}`, font: "Calibri", size: 19, bold: true, color: ACCENT })]
      }));
    }
  }

  // ── SKILLS TABLE ──────────────────────────────────────────────────────────
  const skillRows = (parsedData.skills?.categories || []).map((cat: any) =>
    new TableRow({
      children: [
        new TableCell({
          width: { size: 2200, type: WidthType.DXA },
          borders: {
            top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }
          },
          shading: { fill: "EFF6FF", type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 140, right: 100 },
          children: [new Paragraph({
            children: [new TextRun({ text: cat.name, font: "Calibri", size: 18, bold: true, color: BLUE })]
          })]
        }),
        new TableCell({
          width: { size: 7160, type: WidthType.DXA },
          borders: {
            top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }
          },
          margins: { top: 80, bottom: 80, left: 100, right: 100 },
          children: [new Paragraph({
            children: [new TextRun({
              text: (cat.skills || []).join("  ·  "),
              font: "Calibri", size: 18, color: "334155"
            })]
          })]
        }),
      ]
    })
  );

  // ── WORKING WITH ME (personality section) ────────────────────────────────
  const personalitySection: any[] = [];
  if (parsedData.workingWithMe) {
    personalitySection.push(sectionHeader("Working With Me"));
    const wm = parsedData.workingWithMe;
    const fields = [
      ["Communication Style", wm.communicationStyle],
      ["Decision Making", wm.decisionMaking],
      ["Collaboration", wm.collaboration],
      ["Under Pressure", wm.underPressure],
      ["What Brings Out My Best", wm.motivation],
    ];
    for (const [label, value] of fields) {
      if (value) {
        personalitySection.push(new Paragraph({
          spacing: { before: 100, after: 40 },
          children: [
            new TextRun({ text: label + ":  ", font: "Calibri", size: 19, bold: true, color: NAVY }),
            new TextRun({ text: value, font: "Calibri", size: 19, color: "1E293B" }),
          ]
        }));
      }
    }
  }

  // ── DOCUMENT ─────────────────────────────────────────────────────────────
  const doc = new Document({
    numbering: {
      config: [{
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "▸",
          alignment: AlignmentType.LEFT,
          style: {
            paragraph: { indent: { left: 400, hanging: 280 } },
            run: { color: ACCENT, size: 18 }
          }
        }]
      }]
    },
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 20, color: "1E293B" } }
      }
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 900, right: 1080, bottom: 900, left: 1080 }
        }
      },
      children: [
        // ── NAME BLOCK ─────────────────────────────────────────────────────
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 50 },
          children: [new TextRun({
            text: (parsedData.name || "").toUpperCase(),
            font: "Calibri", size: 64, bold: true, color: NAVY,
            characterSpacing: 80,
          })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 80 },
          children: [new TextRun({
            text: parsedData.title || "",
            font: "Calibri", size: 24, color: ACCENT, italics: true,
          })]
        }),
        // ── CONTACT LINE ───────────────────────────────────────────────────
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 0 },
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 16, color: NAVY, space: 8 },
            top: { style: BorderStyle.SINGLE, size: 16, color: NAVY, space: 8 },
          },
          children: [new TextRun({
            text: [parsedData.location, parsedData.phone, parsedData.email, parsedData.linkedin]
              .filter(Boolean).join("   |   "),
            font: "Calibri", size: 18, color: GRAY,
          })]
        }),
        spacer(120),

        // ── SUMMARY ────────────────────────────────────────────────────────
        sectionHeader("Professional Summary"),
        new Paragraph({
          spacing: { before: 100, after: 80 },
          children: [new TextRun({ text: parsedData.summary || "", font: "Calibri", size: 20, color: "1E293B" })]
        }),

        // ── CAREER HIGHLIGHTS ──────────────────────────────────────────────
        ...(parsedData.topMetrics?.length ? [
          sectionHeader("Career Highlights"),
          ...parsedData.topMetrics.slice(0, 3).map((m: string) => bul(m)),
          spacer(60),
        ] : []),

        // ── EXPERIENCE ─────────────────────────────────────────────────────
        sectionHeader("Professional Experience"),
        ...expSection,

        // ── SKILLS ─────────────────────────────────────────────────────────
        ...(skillRows.length ? [
          sectionHeader("Core Competencies"),
          new Table({
            width: { size: W, type: WidthType.DXA },
            columnWidths: [2200, 7160],
            rows: skillRows,
          }),
        ] : []),

        // ── EDUCATION ──────────────────────────────────────────────────────
        ...(parsedData.education?.length ? [
          sectionHeader("Education"),
          ...(parsedData.education || []).map((edu: any) => new Paragraph({
            spacing: { before: 80, after: 40 },
            children: [
              new TextRun({ text: edu.degree || "", font: "Calibri", size: 20, bold: true, color: NAVY }),
              new TextRun({ text: "  —  ", font: "Calibri", size: 20, color: LGRAY }),
              new TextRun({ text: `${edu.school || ""}${edu.location ? ", " + edu.location : ""}`, font: "Calibri", size: 20, color: ACCENT }),
              ...(edu.year ? [new TextRun({ text: `  ${edu.year}`, font: "Calibri", size: 18, italics: true, color: GRAY })] : []),
            ]
          })),
        ] : []),

        // ── CERTIFICATIONS ─────────────────────────────────────────────────
        ...(parsedData.certifications?.length ? [
          sectionHeader("Certifications"),
          ...parsedData.certifications.map((c: string) => bul(c)),
        ] : []),

        // ── LANGUAGES ──────────────────────────────────────────────────────
        ...(parsedData.languages?.length ? [
          sectionHeader("Languages"),
          ...parsedData.languages.map((l: any) => bul(typeof l === "string" ? l : `${l.language}${l.level ? " — " + l.level : ""}`)),
        ] : []),

        // ── WORKING WITH ME ─────────────────────────────────────────────────
        ...personalitySection,
      ]
    }]
  });

  return Packer.toBuffer(doc);
}


function getTokenUser(req: Request): { userId: number; email: string } | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return verifyToken(auth.slice(7));
}

function sanitizeData(data: any): any {
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
  if (!data.languages || !Array.isArray(data.languages)) data.languages = [];
  data.experience = data.experience.map((exp: any) => ({
    title: exp.title || "",
    company: exp.company || "",
    location: exp.location || "",
    startDate: exp.startDate || "",
    endDate: exp.endDate && exp.endDate !== exp.startDate ? exp.endDate : exp.endDate === "" ? "" : "Present",
    description: exp.description || "",
    bullets: Array.isArray(exp.bullets) ? exp.bullets.filter(Boolean) : [],
    achievements: Array.isArray(exp.achievements) ? exp.achievements.filter(Boolean) : [],
  }));
  return data;
}

export function registerResumeIQRoutes(app: Express) {

  // ── ADMIN AUTH MIDDLEWARE ────────────────────────────────────────────────
  // Protects admin-only routes. Reads ADMIN_EMAILS env var (comma-separated).
  // Falls back to checking if the user's plan is 'agency'.
  function adminAuth(req: Request, res: Response, next: () => void) {
    const authHeader = req.headers["authorization"];
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Admin access required" });
      return;
    }
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (!payload) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }
    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);
    if (adminEmails.includes(payload.email.toLowerCase())) {
      next();
      return;
    }
    res.status(403).json({ error: "Forbidden — admin only" });
  }


  // Initialize DB tables on startup
  initDb().catch(console.error);
  migrateDb().catch(console.error);

  // ── AUTH ──────────────────────────────────────────────────────────
  app.post("/api/resumeiq/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body;
      if (!email || !password) { res.status(400).json({ error: "Email and password required" }); return; }
      const user = await createUser(email, password, name || "");
      const token = generateToken(user.id, user.email);
      // Fire welcome email (non-blocking)
      sendEmail(user.email, "welcome").catch(() => {});
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

  // ── HISTORY ──────────────────────────────────────────────────────
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
      res.setHeader("Content-Disposition", `attachment; filename="${(resume.candidateName || "Resume").replace(/\s+/g, "_")}_ResumeIQ.docx"`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });


  // ── PERSONALITY ASSESSMENT ───────────────────────────────────────────────
  app.post("/api/resumeiq/personality", async (req: Request, res: Response) => {
    try {
      const { assessments, parsedResumeData } = req.body;
      if (!assessments || !assessments.length) { res.status(400).json({ error: "No assessment data provided" }); return; }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) { res.status(500).json({ error: "OpenAI not configured" }); return; }

      // Extract text from each assessment
      const assessmentTexts: string[] = [];
      for (const assessment of assessments) {
        let text = "";
        if (assessment.fileBase64 && assessment.fileName) {
          const buffer = Buffer.from(assessment.fileBase64, "base64");
          if (assessment.fileName?.toLowerCase().endsWith(".docx")) {
            try {
              const JSZipModule = await import("jszip");
              const JSZip = JSZipModule.default || JSZipModule;
              const zip = await JSZip.loadAsync(buffer);
              const docXml = await zip.file("word/document.xml")?.async("string");
              if (docXml) {
                text = docXml.replace(/<\/w:p>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 8000);
              }
            } catch (e) { console.warn("DOCX parse failed:", e); }
          } else if (assessment.fileName?.toLowerCase().endsWith(".pdf")) {
            try {
              const pdfParse = await import("pdf-parse");
              const parsed = await (pdfParse.default || pdfParse)(buffer);
              text = parsed.text?.replace(/\s+/g, " ").trim().slice(0, 8000) || "";
            } catch (e) { console.warn("PDF parse failed:", e); text = ""; }
          } else {
            text = buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r]/g, " ").replace(/\s+/g, " ").trim().slice(0, 8000);
          }
        } else if (assessment.text) {
          text = assessment.text;
        }
        if (text) assessmentTexts.push(`=== ${assessment.label} ===\n${text}`);
      }

      if (assessmentTexts.length === 0) { res.status(400).json({ error: "Could not extract text from assessments" }); return; }

      const isMultiple = assessmentTexts.length > 1;
      const systemPrompt = `You are an expert workplace psychologist and elite resume writer who specializes in translating assessment data into vivid, specific, employer-relevant behavioral language.

MISSION: Turn raw assessment data into a "Working With Me" section that feels unmistakably personal — not generic. A hiring manager should read this and think "this person really knows themselves."

CRITICAL RULES — VIOLATIONS WILL FAIL:
- NEVER mention any assessment name or tool (no DISC, MBTI, Myers-Briggs, Predictive Index, PI, TKI, Thomas-Kilmann, 360, PeopleTek, Strategist, C-style, ISTJ, or any other label)
- NEVER use assessment jargon or scores
- Write in first person, active voice
- Each field: 2 sentences MAX — make every word earn its place
- Be SPECIFIC and BEHAVIORAL — name the actual pattern, not a vague trait
- BAD: "I am analytical and detail-oriented" — this describes half of all professionals
- GOOD: "I make decisions by stress-testing assumptions before committing — I'd rather ask one more hard question than course-correct later"
- BAD: "I work well under pressure"
- GOOD: "When stakes are highest I get quieter and more precise — I pull back from noise and focus on what the data actually says"
- Draw on CONCRETE BEHAVIORS from the assessments, not personality labels
- ${isMultiple ? "Find the CONSISTENT PATTERNS across ALL assessments — these are the most reliable and defensible insights" : "Base everything on the assessment data"}
- Capture what makes this specific person DISTINCT, not what makes them sound like a safe hire
- For teaserFields: choose the 2 most compelling, surprising, or differentiated fields for THIS person`;

      const userPrompt = `${isMultiple ? "MULTIPLE ASSESSMENTS TO SYNTHESIZE — find what is consistent across ALL of them:" : "ASSESSMENT DATA:"}

${assessmentTexts.join("\n\n")}

CAREER CONTEXT:
${JSON.stringify({
  name: parsedResumeData?.name,
  title: parsedResumeData?.title,
  summary: parsedResumeData?.summary?.slice(0, 300),
  yearsOfExperience: parsedResumeData?.yearsOfExperience,
})}

INSTRUCTIONS:
1. Read ALL assessment data carefully — note what patterns repeat across sources
2. Write each field as a BEHAVIORAL statement, not a trait label
3. Make it sound like this specific person wrote it themselves, not a generic template
4. communicationStyle — HOW they actually communicate, not just "clearly and concisely"
5. decisionMaking — their actual decision process and what drives it
6. collaboration — the real dynamic they create on a team, their actual role
7. underPressure — what specifically changes in their behavior when stakes are high
8. motivation — what genuinely energizes them, specific to who they are

Return ONLY valid JSON — no preamble, no explanation, no markdown:
{
  "communicationStyle": "2 sentences max",
  "decisionMaking": "2 sentences max",
  "collaboration": "2 sentences max",
  "underPressure": "2 sentences max",
  "motivation": "2 sentences max",
  "teaserFields": ["fieldKey1", "fieldKey2"]
}

teaserFields: exactly 2 keys from the 5 fields above. Pick the 2 that would make a hiring manager say "that's interesting — tell me more."`;

      console.log(`[ResumeIQ] Generating Working With Me from ${assessmentTexts.length} assessment(s)`);

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
          max_tokens: 800, temperature: 0.3,
        }),
      });

      if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
      const data = await response.json() as any;
      const raw = data.choices?.[0]?.message?.content || "{}";
      const clean = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
      const result = JSON.parse(clean);
      const { teaserFields, ...workingWithMe } = result;

      // Check if this user already has personality unlocked — if so, save immediately
      const tokenUser = getTokenUser(req);
      if (tokenUser) {
        const dbUser = await getUserById(tokenUser.userId);
        if (dbUser?.personalityUnlocked) {
          await saveWorkingWithMe(tokenUser.userId, workingWithMe);
        }
      }

      console.log(`[ResumeIQ] Working With Me generated, teaser fields: ${teaserFields}`);
      res.json({ workingWithMe, teaserFields: teaserFields || ["communicationStyle", "decisionMaking"] });
    } catch (error: any) {
      console.error("[ResumeIQ] Personality error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── PERSONALITY CHECKOUT ─────────────────────────────────────────────────
  app.post("/api/resumeiq/personality-checkout", async (req: Request, res: Response) => {
    try {
      const { resumeiqSession, type } = req.body; // type: "personality" | "bundle"
      const session = await getSession(resumeiqSession);
      if (!session) { res.status(404).json({ error: "Session not found or expired" }); return; }
      const origin = req.headers.origin || `https://${req.headers.host}`;
      const successUrl = `${origin}/?payment=success&`;
      const cancelUrl = `${origin}/?payment=cancelled`;

      let result;
      if (type === "bundle") {
        result = await createBundleCheckoutSession(successUrl, cancelUrl, resumeiqSession);
      } else {
        result = await createPersonalityCheckoutSession(successUrl, cancelUrl, resumeiqSession);
      }
      res.json({ url: result.url });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

    // ── EMAIL CAPTURE ────────────────────────────────────────────────
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

  // ── TRANSFORM (parse + session) ──────────────────────────────────
  app.post("/api/resumeiq/transform", async (req: Request, res: Response) => {
    try {
      const { fileBase64, fileName } = req.body;
      if (!fileBase64) { res.status(400).json({ error: "No file provided" }); return; }

      const parsed = await parseResume(fileBase64, fileName || "resume.pdf");
      const sessionId = crypto.randomBytes(16).toString("hex");

      const tokenUser = getTokenUser(req);
      const cookies = req.headers.cookie || "";
      const hasCookie = cookies.includes("resumeiq_free_used=1");
      const ip = getClientIp(req);

      let isFree = false;

      if (tokenUser) {
        const dbUser = await getUserById(tokenUser.userId);
        const resumeCount = dbUser?.resumeCount || 0;
        const plan = dbUser?.plan || "free";
        if (plan === "monthly" || plan === "agency") {
          isFree = true;
        } else if (plan === "starter") {
          isFree = resumeCount < 3;
        } else {
          isFree = resumeCount < 1;
        }
      } else {
        isFree = !hasCookie && (freeUsedByIp.get(ip) || 0) === 0;
      }

      await createSession(sessionId, parsed, isFree, isFree);
      console.log(`[ResumeIQ] Session created for ${parsed.name} (free: ${isFree})`);
      res.json({ ...parsed, sessionId, isFree });
    } catch (error: any) {
      console.error("[ResumeIQ] Transform error:", error);
      res.status(500).json({ error: error.message || "Failed to transform resume" });
    }
  });

  app.get("/api/resumeiq/session/:sessionId", async (req: Request, res: Response) => {
    const session = await getSession(req.params.sessionId);
    if (!session) { res.status(404).json({ error: "Session not found" }); return; }
    res.json(session.parsedData);
  });

  // ── CHECKOUT ─────────────────────────────────────────────────────
  app.post("/api/resumeiq/checkout", async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.body;
      const session = await getSession(sessionId);
      if (!session) { res.status(404).json({ error: "Session not found or expired" }); return; }
      if (session.paid) { res.json({ alreadyPaid: true }); return; }
      const origin = req.headers.origin || `https://${req.headers.host}`;
      const { url } = await createCheckoutSession(
        `${origin}/?payment=success&`,
        `${origin}/?payment=cancelled`,
        sessionId
      );
      res.json({ url });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/resumeiq/verify-payment", async (req: Request, res: Response) => {
    try {
      const { stripeSessionId, resumeiqSession } = req.body;
      const paid = await verifyPayment(stripeSessionId);
      if (!paid) { res.json({ paid: false }); return; }

      // Get the type from Stripe metadata
      const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${stripeSessionId}`, {
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
      });
      const stripeData = await stripeRes.json() as any;
      const type = stripeData.metadata?.type || "resume"; // resume | personality | bundle

      const ip = getClientIp(req);
      const tokenUser = getTokenUser(req);

      if (type === "resume") {
        const session = await getSession(resumeiqSession);
        if (session) await updateSessionPaid(resumeiqSession);
        freeUsedByIp.set(ip, (freeUsedByIp.get(ip) || 0) + 1);

      } else if (type === "personality") {
        // Personality-only: mark session as paid for generate, unlock on account
        const session = await getSession(resumeiqSession);
        if (session) await updateSessionPaid(resumeiqSession);
        if (tokenUser) {
          const pendingWWM = req.body.workingWithMe;
          if (pendingWWM) await unlockPersonality(tokenUser.userId, pendingWWM);
          else await unlockPersonality(tokenUser.userId, {});
        }

      } else if (type === "bundle") {
        // Bundle: mark session paid + unlock personality
        const session = await getSession(resumeiqSession);
        if (session) await updateSessionPaid(resumeiqSession);
        freeUsedByIp.set(ip, (freeUsedByIp.get(ip) || 0) + 1);
        if (tokenUser) {
          const pendingWWM = req.body.workingWithMe;
          if (pendingWWM) await unlockPersonality(tokenUser.userId, pendingWWM);
          else await unlockPersonality(tokenUser.userId, {});
        }
      }

      res.json({ paid: true, type });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ── GENERATE (DOCX) ──────────────────────────────────────────────
  app.post("/api/resumeiq/generate", async (req: Request, res: Response) => {
    try {
      const { sessionId, parsedData: clientData } = req.body;

      const session = await getSession(sessionId);
      if (!session) { res.status(404).json({ error: "Session expired. Please start over." }); return; }
      if (!session.paid) { res.status(402).json({ error: "Payment required" }); return; }

      // Use client-side edited data if provided (preserves preview edits + workingWithMe),
      // falling back to original session data
      let data = sanitizeData({ ...session.parsedData, ...(clientData || {}) });

      // Auto-append stored workingWithMe for users who have personality unlocked
      const tokenUser = getTokenUser(req);
      if (tokenUser && !data.workingWithMe) {
        const dbUser = await getUserById(tokenUser.userId);
        if (dbUser?.personalityUnlocked && dbUser?.workingWithMeData) {
          const stored = typeof dbUser.workingWithMeData === "string"
            ? JSON.parse(dbUser.workingWithMeData)
            : dbUser.workingWithMeData;
          data = { ...data, workingWithMe: stored };
        }
      }

      // Mark free IP usage now (at actual download time, not transform time)
      if (session.freeUsed) {
        const ip = getClientIp(req);
        freeUsedByIp.set(ip, (freeUsedByIp.get(ip) || 0) + 1);
      }

      const buffer = await generateDocx(data);
      const docxBase64 = buffer.toString("base64");

      // ── Save to DB if logged in ───────────────────────────────────
      if (tokenUser) {
        try {
          await saveResume(
            tokenUser.userId,
            data.name ? `${data.name}_ResumeIQ.docx` : "ResumeIQ.docx",
            data.name || "Resume",
            data,
            docxBase64,
            session.paid,
          );
          await incrementResumeCount(tokenUser.userId);
          console.log(`[ResumeIQ] Saved resume for user ${tokenUser.userId}`);
        } catch (saveErr) {
          // Don't fail the download if save fails — just log it
          console.error("[ResumeIQ] Failed to save resume to DB:", saveErr);
        }
      }

      // Remove session after successful generation
      await deleteSession(sessionId);

      // Fire post-conversion email (non-blocking)
      if (tokenUser?.email) {
        alreadySent(null as any, tokenUser.email, "post_conversion")
          .then(async (sent) => {
            if (sent) return;
            const { getDb } = await import("./authService");
            const emailConn = await getDb();
            if (!emailConn) return;
            try {
              await logEmailSend(emailConn, tokenUser.email, "post_conversion");
              sendEmail(tokenUser.email, "post_conversion").catch(() => {});
            } finally { await emailConn.end(); }
          }).catch(() => {});
      }

      const fileName = `${(data.name || "Resume").replace(/\s+/g, "_")}_ResumeIQ.docx`;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.send(buffer);
    } catch (error: any) {
      console.error("[ResumeIQ] Generate error:", error);
      res.status(500).json({ error: error.message || "Failed to generate resume" });
    }
  });
  // ── ANALYTICS ─────────────────────────────────────────────────────────────
  // GET /api/resumeiq/analytics?range=7d|30d|all
  // Returns daily upload/paid/revenue buckets + funnel totals + Stripe session stats
  app.get("/api/resumeiq/analytics", (req: Request, res: Response, next: any) => adminAuth(req, res, next), async (req: Request, res: Response) => {
    try {
      const range = (req.query.range as string) || "30d";
      const days = range === "7d" ? 7 : range === "30d" ? 30 : 365;

      const { getDb } = await import("./authService");
      const conn = await getDb();
      if (!conn) { res.status(503).json({ error: "Database unavailable" }); return; }

      try {
        // ── Daily uploads + paid + revenue ──────────────────────────────────
        const [dailyRows] = await conn.execute(
          `SELECT
             DATE(createdAt)            AS date,
             COUNT(*)                   AS uploads,
             SUM(paid)                  AS paid,
             SUM(CASE WHEN paid = 1 THEN 9.99 ELSE 0 END) AS revenue
           FROM riq_resumes
           WHERE createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
           GROUP BY DATE(createdAt)
           ORDER BY date ASC`,
          [days]
        ) as any;

        // ── Funnel: sessions created vs paid vs docx generated ───────────────
        const [funnelRows] = await conn.execute(
          `SELECT
             COUNT(*)                                       AS sessionsCreated,
             SUM(paid)                                      AS sessionsPaid,
             SUM(CASE WHEN freeUsed = 1 THEN 1 ELSE 0 END) AS sessionsFree
           FROM riq_sessions
           WHERE createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
          [days]
        ) as any;

        // ── Stripe: sessions by status (from riq_resumes as source of truth) ─
        const [stripeRows] = await conn.execute(
          `SELECT
             SUM(CASE WHEN paid = 1 AND stripeSessionId IS NOT NULL THEN 1 ELSE 0 END) AS stripePaid,
             SUM(CASE WHEN paid = 0 AND stripeSessionId IS NOT NULL THEN 1 ELSE 0 END) AS stripePending,
             SUM(CASE WHEN stripeSessionId IS NULL AND paid = 1 THEN 1 ELSE 0 END)     AS freeDownloads
           FROM riq_resumes
           WHERE createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
          [days]
        ) as any;

        // ── Tier breakdown ───────────────────────────────────────────────────
        const [tierRows] = await conn.execute(
          `SELECT plan, COUNT(*) AS count
           FROM riq_users
           GROUP BY plan`,
        ) as any;

        // ── Total revenue all-time ───────────────────────────────────────────
        const [revenueRow] = await conn.execute(
          `SELECT
             SUM(CASE WHEN paid = 1 THEN 9.99 ELSE 0 END) AS totalRevenue,
             COUNT(*) AS totalResumes,
             SUM(paid) AS totalPaid
           FROM riq_resumes`
        ) as any;

        // ── Email captures ───────────────────────────────────────────────────
        const [emailRow] = await conn.execute(
          `SELECT COUNT(*) AS emailCaptures FROM riq_email_captures`
        ) as any;

        // ── Top events breakdown ─────────────────────────────────────────────
        const [eventRows] = await conn.execute(
          `SELECT
             eventType,
             COUNT(*) AS count,
             COUNT(DISTINCT sessionId) AS uniqueSessions
           FROM riq_events
           WHERE createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
           GROUP BY eventType
           ORDER BY count DESC
           LIMIT 20`,
          [days]
        ) as any;

        // ── Daily event counts (page_view, checkout_started, resume_uploaded) ─
        const [dailyEventsRows] = await conn.execute(
          `SELECT
             DATE(createdAt) AS date,
             SUM(CASE WHEN eventType = 'page_view' THEN 1 ELSE 0 END)           AS pageViews,
             SUM(CASE WHEN eventType = 'resume_uploaded' THEN 1 ELSE 0 END)     AS resumeUploads,
             SUM(CASE WHEN eventType = 'checkout_started' THEN 1 ELSE 0 END)    AS checkoutStarts,
             SUM(CASE WHEN eventType = 'resume_generated' THEN 1 ELSE 0 END)    AS resumeGenerated,
             SUM(CASE WHEN eventType = 'account_created_done_screen' THEN 1 ELSE 0 END) AS accountsCreated,
             COUNT(DISTINCT sessionId) AS uniqueVisitors
           FROM riq_events
           WHERE createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
           GROUP BY DATE(createdAt)
           ORDER BY date ASC`,
          [days]
        ) as any;

        // ── Top UTM sources ───────────────────────────────────────────────────
        const [attributionRows] = await conn.execute(
          `SELECT
             source,
             medium,
             campaign,
             COUNT(*) AS visits
           FROM riq_attribution
           WHERE createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
           GROUP BY source, medium, campaign
           ORDER BY visits DESC
           LIMIT 10`,
          [days]
        ) as any;

        // ── Total unique visitors (all time) ─────────────────────────────────
        const [visitorsRow] = await conn.execute(
          `SELECT COUNT(DISTINCT sessionId) AS totalVisitors FROM riq_events`
        ) as any;

        res.json({
          daily: dailyRows,
          dailyEvents: dailyEventsRows,
          funnel: funnelRows[0] || {},
          stripe: stripeRows[0] || {},
          tiers: tierRows,
          totals: revenueRow[0] || {},
          emailCaptures: emailRow[0]?.emailCaptures || 0,
          events: eventRows,
          attribution: attributionRows,
          totalVisitors: visitorsRow[0]?.totalVisitors || 0,
        });
      } finally {
        await conn.end();
      }
    } catch (error: any) {
      console.error("[ResumeIQ] Analytics error:", error);
      res.status(500).json({ error: error.message });
    }
  });


  // ── EMAIL RECOVERY CRONS ─────────────────────────────────────────────────
  // Runs every 15 min: send abandoned_1h to users who uploaded but didn't checkout
  // Runs every hour: send reengagement_24h to users who uploaded but never downloaded
  (async () => {
    try {
      const cronLib = await import("node-cron");
      const { getDb } = await import("./authService");

      // abandoned_1h — every 15 minutes
      cronLib.default.schedule("*/15 * * * *", async () => {
        const conn = await getDb();
        if (!conn) return;
        try {
          const [rows] = await conn.execute(`
            SELECT DISTINCT ec.email, e.sessionId
            FROM riq_email_captures ec
            JOIN riq_events e ON e.sessionId = (
              SELECT sessionId FROM riq_events
              WHERE eventType = 'resume_uploaded'
                AND createdAt < DATE_SUB(NOW(), INTERVAL 1 HOUR)
                AND sessionId NOT IN (SELECT sessionId FROM riq_events WHERE eventType = 'checkout_started')
              LIMIT 1
            )
            WHERE ec.email NOT IN (SELECT email FROM riq_email_sends WHERE flowType = 'abandoned_1h')
            LIMIT 25
          `) as any;
          for (const row of rows) {
            await logEmailSend(conn, row.email, "abandoned_1h");
            sendEmail(row.email, "abandoned_1h").catch(() => {});
          }
          if (rows.length) console.log("[Cron] abandoned_1h:", rows.length, "emails");
        } catch { /* non-fatal */ } finally { await conn.end(); }
      });

      // reengagement_24h — every hour
      cronLib.default.schedule("0 * * * *", async () => {
        const conn = await getDb();
        if (!conn) return;
        try {
          const [rows] = await conn.execute(`
            SELECT DISTINCT ec.email
            FROM riq_email_captures ec
            JOIN riq_events e ON e.eventType = 'resume_uploaded'
              AND e.createdAt BETWEEN DATE_SUB(NOW(), INTERVAL 25 HOUR) AND DATE_SUB(NOW(), INTERVAL 23 HOUR)
            WHERE ec.email NOT IN (SELECT email FROM riq_email_sends WHERE flowType IN ('reengagement_24h','post_conversion'))
            LIMIT 25
          `) as any;
          for (const row of rows) {
            await logEmailSend(conn, row.email, "reengagement_24h");
            sendEmail(row.email, "reengagement_24h").catch(() => {});
          }
          if (rows.length) console.log("[Cron] reengagement_24h:", rows.length, "emails");
        } catch { /* non-fatal */ } finally { await conn.end(); }
      });

      console.log("[ResumeIQ] Email recovery crons started");
    } catch (err: any) {
      console.warn("[ResumeIQ] node-cron not available:", err.message);
    }
  })();


  // ── PERSONALITY ASSESSMENT → Working With Me ─────────────────────────────
  // POST /api/resumeiq/personality
  // Accepts array of assessments (PDF base64 or text input), synthesizes via GPT-4o
  // Returns workingWithMe object + teaserFields (first 2 shown free, rest require unlock)
  app.post("/api/resumeiq/personality", async (req: Request, res: Response) => {
    try {
      const { assessments, parsedResumeData } = req.body;

      if (!assessments || !Array.isArray(assessments) || assessments.length === 0) {
        res.status(400).json({ error: "At least one assessment is required" });
        return;
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) { res.status(500).json({ error: "OpenAI not configured" }); return; }

      const name = parsedResumeData?.name || "the candidate";
      const title = parsedResumeData?.title || "a professional role";

      // Build message content array for GPT-4o
      const contentParts: any[] = [
        {
          type: "text",
          text: `You are synthesizing ${assessments.length} personality assessment(s) for a professional named ${name} who works as ${title}.

Analyze ALL assessments provided and find the consistent themes across them to produce a professional "Working With Me" section for their resume.

CRITICAL RULES:
- NEVER mention the name of any assessment tool (no DISC, Myers-Briggs, MBTI, Predictive Index, PI, Thomas-Kilmann, TKI, 360, PeopleTek, or any other tool name)
- Write in first person ("I communicate...", "I work best...", "My approach...")
- Be specific and behavioral — avoid generic platitudes
- 2-3 sentences per field maximum
- Professional resume tone

Return ONLY a valid JSON object with exactly these 5 fields — no preamble, no explanation, no markdown fences:
{
  "communicationStyle": "...",
  "decisionMaking": "...",
  "collaboration": "...",
  "underPressure": "...",
  "whatBringsMeBest": "..."
}`
        }
      ];

      // Add each assessment — PDF as base64 document or as text
      for (const assessment of assessments) {
        if (assessment.fileBase64) {
          // Pass PDF as a document block — GPT-4o can read PDF content
          contentParts.push({
            type: "text",
            text: `\n--- Assessment: ${assessment.label} (${assessment.fileName || "PDF"}) ---`
          });
          contentParts.push({
            type: "image_url",
            image_url: {
              url: `data:application/pdf;base64,${assessment.fileBase64}`,
              detail: "high"
            }
          });
        }
        if (assessment.text) {
          contentParts.push({
            type: "text",
            text: `\n--- Assessment: ${assessment.label} ---\n${assessment.text}`
          });
        }
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4o",
          max_tokens: 1000,
          temperature: 0.35,
          messages: [{ role: "user", content: contentParts }]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("[ResumeIQ] OpenAI personality error:", errText);
        res.status(500).json({ error: "AI generation failed" });
        return;
      }

      const aiData = await response.json() as any;
      const raw = aiData.choices?.[0]?.message?.content || "";
      const clean = raw.replace(/```json|```/g, "").trim();

      let workingWithMe: Record<string, string>;
      try {
        workingWithMe = JSON.parse(clean);
      } catch {
        console.error("[ResumeIQ] Personality JSON parse failed:", clean.slice(0, 200));
        res.status(500).json({ error: "Failed to parse AI response — please try again" });
        return;
      }

      // Ensure all 5 fields are present
      const required = ["communicationStyle", "decisionMaking", "collaboration", "underPressure", "whatBringsMeBest"];
      for (const field of required) {
        if (!workingWithMe[field]) workingWithMe[field] = "See full profile for details.";
      }

      // communicationStyle and decisionMaking shown as teaser (free preview)
      // collaboration, underPressure, whatBringsMeBest require unlock
      const teaserFields = ["communicationStyle", "decisionMaking"];

      console.log(`[ResumeIQ] Personality generated for ${name} (${assessments.length} assessment(s))`);
      res.json({ workingWithMe, teaserFields });

    } catch (error: any) {
      console.error("[ResumeIQ] Personality route error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── PERSONALITY CHECKOUT ──────────────────────────────────────────────────
  // POST /api/resumeiq/personality-checkout
  // Creates a Stripe checkout for personality unlock or bundle (resume + personality)
  app.post("/api/resumeiq/personality-checkout", async (req: Request, res: Response) => {
    try {
      const { resumeiqSession, type } = req.body;
      const origin = req.headers.origin as string || "https://resumeiq.reviveiqi.com";
      const successUrl = `${origin}/app?`;
      const cancelUrl = `${origin}/app`;

      let stripeResult: { url: string; sessionId: string };

      if (type === "bundle") {
        stripeResult = await createBundleCheckoutSession(successUrl, cancelUrl, resumeiqSession);
      } else {
        stripeResult = await createPersonalityCheckoutSession(successUrl, cancelUrl, resumeiqSession);
      }

      res.json({ url: stripeResult.url });
    } catch (error: any) {
      console.error("[ResumeIQ] Personality checkout error:", error);
      res.status(500).json({ error: error.message });
    }
  });


}


