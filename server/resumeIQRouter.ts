/**
 * ResumeIQ Backend Router
 * Handles resume parsing, DOCX generation, and Stripe payments
 */
import type { Express, Request, Response } from "express";
import { createCheckoutSession, verifyPayment } from "./stripeService";
import crypto from "crypto";

const OPENAI_API = "https://api.openai.com/v1/chat/completions";

// In-memory session store for parsed resume data
// Key: sessionId, Value: { parsedData, paid, createdAt }
const sessionStore = new Map<string, {
  parsedData: any;
  paid: boolean;
  createdAt: number;
  freeUsed: boolean;
}>();

// Clean up sessions older than 2 hours
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of sessionStore.entries()) {
    if (now - val.createdAt > 2 * 60 * 60 * 1000) sessionStore.delete(key);
  }
}, 30 * 60 * 1000);

// Track free resumes by IP (simple rate limiting)
const freeUsedByIp = new Map<string, number>();

function getClientIp(req: Request): string {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
}

function stripJsonFences(raw: string): string {
  let text = raw.trim();
  if (text.startsWith("```")) text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  return text.trim();
}

async function parseResume(fileBase64: string): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const buffer = Buffer.from(fileBase64, "base64");
  const textContent = buffer.toString("utf-8")
    .replace(/[^\x20-\x7E\n\r\t]/g, " ")
    .replace(/\s+/g, " ").trim().slice(0, 10000);

  const res = await fetch(OPENAI_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an expert resume parser. Extract ALL content thoroughly. ALWAYS return valid JSON — never apologize, never explain." },
        { role: "user", content: `Parse this resume and return JSON:
{
  "name": "Full Name",
  "email": "email",
  "phone": "phone",
  "location": "City, State",
  "linkedin": "linkedin URL or empty",
  "title": "Most recent/target job title",
  "summary": "Write a polished 2-3 sentence professional summary",
  "experience": [
    {
      "title": "Job Title",
      "company": "Company",
      "location": "City, State",
      "startDate": "MM/YYYY",
      "endDate": "MM/YYYY or Present",
      "description": "One sentence company context",
      "bullets": ["Strong action-verb bullet with metrics", "bullet 2", "bullet 3", "bullet 4"],
      "achievements": ["award if any"]
    }
  ],
  "skills": {
    "categories": [{ "name": "Category", "skills": ["skill1", "skill2"] }]
  },
  "education": [{ "degree": "Degree", "school": "School", "location": "City, State", "year": "YYYY" }],
  "certifications": [],
  "seniorityLevel": "entry|mid|senior|executive",
  "yearsOfExperience": 0,
  "topMetrics": ["achievement 1", "achievement 2", "achievement 3"]
}

CRITICAL: Return ONLY valid JSON. Start with { end with }. No markdown.

Resume: ${textContent}` }
      ],
      max_tokens: 4000, temperature: 0.1,
    }),
  });

  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
  const data = await res.json() as any;
  return JSON.parse(stripJsonFences(data.choices?.[0]?.message?.content || "{}"));
}

async function generateDocx(parsedData: any): Promise<Buffer> {
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, BorderStyle, WidthType, ShadingType, LevelFormat, TabStopType
  } = require("docx");

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
        new TextRun({ text: "\t", font: "Arial" }),
        new TextRun({ text: dates, size: 20, font: "Arial", color: GRAY, italics: true }),
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

  const experienceSection: any[] = [];
  for (const exp of (parsedData.experience || [])) {
    experienceSection.push(...jobHdr(
      exp.title || "", exp.company || "", exp.location || "",
      `${exp.startDate || ""} – ${exp.endDate || "Present"}`
    ));
    if (exp.description) {
      experienceSection.push(new Paragraph({
        spacing: { before: 40, after: 60 },
        children: [new TextRun({ text: exp.description, size: 19, font: "Arial", color: GRAY, italics: true })]
      }));
    }
    for (const bullet of (exp.bullets || []).slice(0, 5)) experienceSection.push(bul(bullet));
    for (const ach of (exp.achievements || [])) {
      if (ach) experienceSection.push(new Paragraph({
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: `🏆 ${ach}`, bold: true, size: 19, font: "Arial", color: LIGHT_BLUE })]
      }));
    }
  }

  const skillsRows = (parsedData.skills?.categories || []).map((cat: any) =>
    new TableRow({
      children: [
        new TableCell({
          width: { size: 2500, type: WidthType.DXA },
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
          shading: { fill: "EBF3FB", type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: cat.name, bold: true, size: 18, font: "Arial", color: BLUE })] })]
        }),
        new TableCell({
          width: { size: 6860, type: WidthType.DXA },
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: (cat.skills || []).join(" · "), size: 18, font: "Arial", color: DARK })] })]
        }),
      ]
    })
  );

  const doc = new Document({
    numbering: {
      config: [{ reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "▪", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }] }]
    },
    styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 864, right: 1080, bottom: 864, left: 1080 } } },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 60 }, children: [new TextRun({ text: (parsedData.name || "").toUpperCase(), bold: true, size: 52, font: "Arial", color: BLUE })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 80 }, children: [new TextRun({ text: parsedData.title || "", size: 22, font: "Arial", color: GRAY, italics: true })] }),
        new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { before: 0, after: 200 },
          children: [new TextRun({ text: [parsedData.location, parsedData.phone, parsedData.email, parsedData.linkedin].filter(Boolean).join("  |  "), size: 19, font: "Arial", color: GRAY })]
        }),
        sec("Professional Summary"),
        new Paragraph({ spacing: { before: 100, after: 80 }, children: [new TextRun({ text: parsedData.summary || "", size: 20, font: "Arial", color: DARK })] }),
        ...(parsedData.topMetrics?.length ? [sec("Career Highlights"), ...parsedData.topMetrics.slice(0, 3).map((m: string) => bul(m))] : []),
        sec("Professional Experience"),
        ...experienceSection,
        ...(skillsRows.length ? [sec("Core Competencies"), new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [2500, 6860], rows: skillsRows })] : []),
        sec("Education"),
        ...(parsedData.education || []).map((edu: any) => new Paragraph({
          spacing: { before: 80, after: 40 },
          children: [
            new TextRun({ text: edu.degree || "", bold: true, size: 20, font: "Arial", color: DARK }),
            new TextRun({ text: "  —  ", size: 20, font: "Arial", color: GRAY }),
            new TextRun({ text: `${edu.school || ""}, ${edu.location || ""}`, size: 20, font: "Arial", color: LIGHT_BLUE }),
            ...(edu.year ? [new TextRun({ text: `  ${edu.year}`, size: 19, font: "Arial", color: GRAY, italics: true })] : []),
          ]
        })),
        ...(parsedData.certifications?.length ? [sec("Certifications"), ...parsedData.certifications.map((c: string) => bul(c))] : []),
      ]
    }]
  });

  return await Packer.toBuffer(doc);
}

export function registerResumeIQRoutes(app: Express) {

  // Step 1: Parse resume and create session
  app.post("/api/resumeiq/transform", async (req: Request, res: Response) => {
    try {
      const { fileBase64, fileName } = req.body;
      if (!fileBase64) { res.status(400).json({ error: "No file provided" }); return; }

      const parsed = await parseResume(fileBase64);

      // Create session
      const sessionId = crypto.randomBytes(16).toString("hex");
      const ip = getClientIp(req);
      const freeCount = freeUsedByIp.get(ip) || 0;
      const isFree = freeCount === 0;

      sessionStore.set(sessionId, {
        parsedData: parsed,
        paid: isFree, // First resume is free
        createdAt: Date.now(),
        freeUsed: isFree,
      });

      console.log(`[ResumeIQ] Session ${sessionId} created for ${parsed.name} (free: ${isFree})`);

      res.json({ ...parsed, sessionId, isFree });
    } catch (error: any) {
      console.error("[ResumeIQ] Transform error:", error);
      res.status(500).json({ error: error.message || "Failed to transform resume" });
    }
  });

  // Step 2a: Create Stripe checkout session
  app.post("/api/resumeiq/checkout", async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.body;
      const session = sessionStore.get(sessionId);

      if (!session) { res.status(404).json({ error: "Session not found or expired" }); return; }
      if (session.paid) { res.json({ alreadyPaid: true }); return; }

      const origin = req.headers.origin || `https://${req.headers.host}`;
      const { url } = await createCheckoutSession(
        `${origin}/?payment=success`,
        `${origin}/?payment=cancelled`,
        sessionId
      );

      res.json({ url });
    } catch (error: any) {
      console.error("[ResumeIQ] Checkout error:", error);
      res.status(500).json({ error: error.message || "Failed to create checkout" });
    }
  });

  // Step 2b: Verify payment and mark session as paid
  app.post("/api/resumeiq/verify-payment", async (req: Request, res: Response) => {
    try {
      const { stripeSessionId, resumeiqSession } = req.body;
      const session = sessionStore.get(resumeiqSession);

      if (!session) { res.status(404).json({ error: "Session expired" }); return; }

      const paid = await verifyPayment(stripeSessionId);
      if (paid) {
        session.paid = true;
        // Mark IP as having used free resume
        if (session.freeUsed) {
          const ip = getClientIp(req);
          freeUsedByIp.set(ip, (freeUsedByIp.get(ip) || 0) + 1);
        }
      }

      res.json({ paid });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get session data (for post-payment restore)
  app.get("/api/resumeiq/session/:sessionId", (req: Request, res: Response) => {
    const session = sessionStore.get(req.params.sessionId);
    if (!session) { res.status(404).json({ error: "Session not found" }); return; }
    res.json(session.parsedData);
  });

  // Step 3: Generate and download DOCX (requires paid session)
  app.post("/api/resumeiq/generate", async (req: Request, res: Response) => {
    try {
      const { sessionId, parsedData } = req.body;

      // Check if session exists and is paid
      let data = parsedData;
      if (sessionId) {
        const session = sessionStore.get(sessionId);
        if (!session) { res.status(404).json({ error: "Session expired. Please start over." }); return; }
        if (!session.paid) { res.status(402).json({ error: "Payment required" }); return; }
        data = session.parsedData;
      }

      if (!data) { res.status(400).json({ error: "No resume data" }); return; }

      const buffer = await generateDocx(data);
      const fileName = `${(data.name || "Resume").replace(/\s+/g, "_")}_ResumeIQ.docx`;

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.send(buffer);
    } catch (error: any) {
      console.error("[ResumeIQ] Generate error:", error);
      res.status(500).json({ error: error.message || "Failed to generate resume" });
    }
  });
}
