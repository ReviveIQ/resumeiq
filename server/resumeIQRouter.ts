import type { Express, Request, Response } from "express";
import { createCheckoutSession, createPersonalityCheckoutSession, createBundleCheckoutSession, createCareerLaunchSession, createMonthlySession, verifyPayment } from "./stripeService";
import { sendEmail, logEmailSend, alreadySent, notifyNewUser, notifyPurchase, notifyOwner } from "./emailService";
import crypto from "crypto";
import JSZip from "jszip";
// docx imported dynamically inside generateDocx to avoid ESM/CJS interop issues
import {
  initDb, migrateDb, createUser, loginUser, getUserById, saveResume,
  getUserResumes, getResumeById, captureEmail as dbCaptureEmail,
  generateToken, verifyToken, upgradeToStarter, upgradeToMonthly, incrementResumeCount,
  unlockPersonality, saveWorkingWithMe, getUserByEmail, setVerifyToken, verifyEmail,
  getLastGuestSession, mergeGuestSessionsToUser,
  getDb,
} from "./authService";

const OPENAI_API = "https://api.openai.com/v1/chat/completions";

// ── Email verification ────────────────────────────────────────────────────────
async function sendVerificationEmail(email: string, name: string, token: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const firstName = (name || "").split(" ")[0] || "there";
  const verifyUrl = `https://resumeiq.reviveiqi.com/api/resumeiq/auth/verify-email?token=${token}`;
  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <div style="background:#080f1e;padding:22px 32px;display:flex;align-items:center;gap:14px">
        <svg width="28" height="28" viewBox="0 0 72 72" fill="none"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#60a5fa"/><stop offset="100%" stop-color="#2563eb"/></linearGradient><linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#93c5fd"/><stop offset="100%" stop-color="#3b82f6"/></linearGradient><linearGradient id="g3" x1="100%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#1d4ed8"/><stop offset="100%" stop-color="#1e3a5f"/></linearGradient></defs><polygon points="36,4 68,36 36,68 4,36" fill="url(#g3)" opacity="0.35"/><polygon points="36,4 20,20 36,36 52,20" fill="url(#g2)" opacity="0.9"/><polygon points="36,4 52,20 68,36 36,36" fill="url(#g1)" opacity="0.65"/><polygon points="4,36 20,20 36,36 20,52" fill="url(#g1)" opacity="0.5"/><polygon points="68,36 52,20 36,36 52,52" fill="url(#g2)" opacity="0.75"/><polygon points="36,68 20,52 36,36 52,52" fill="url(#g3)" opacity="0.95"/><circle cx="36" cy="36" r="6" fill="white" opacity="0.95"/><circle cx="36" cy="36" r="3" fill="#93c5fd"/></svg>
        <div>
          <p style="margin:0;font-size:16px;font-weight:700;color:white;font-family:sans-serif">Resume<span style="color:#60a5fa">IQ</span></p>
          <p style="margin:0;font-size:11px;color:#64748b;font-family:sans-serif">by ReviveIQI</p>
        </div>
      </div>
      <div style="padding:32px">
        <p style="margin:0 0 16px;font-size:15px;color:#111827;font-family:sans-serif">Hey ${firstName},</p>
        <p style="margin:0 0 16px;font-size:15px;color:#111827;font-family:sans-serif;line-height:1.7">Thanks for creating your ResumeIQ account. One quick step — verify your email address so we know where to send your results.</p>
        <div style="margin:24px 0">
          <a href="${verifyUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:8px;font-size:14px;font-weight:500;font-family:sans-serif">Verify my email →</a>
        </div>
        <p style="margin:0 0 16px;font-size:13px;color:#6b7280;font-family:sans-serif;line-height:1.7">If you didn't create this account, you can safely ignore this email.</p>
        <p style="margin:0 0 4px;font-size:15px;color:#111827;font-family:sans-serif">Bryan</p>
        <p style="margin:0;font-size:12px;color:#9ca3af;font-family:sans-serif">Founder, ResumeIQ · ReviveIQI</p>
      </div>
      <div style="padding:16px 32px;border-top:1px solid #e5e7eb;background:#f9fafb">
        <p style="margin:0;font-size:12px;color:#9ca3af;font-family:sans-serif">ResumeIQ by ReviveIQI · Fort Lauderdale, FL</p>
      </div>
    </div>`;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Bryan <bryan@reviveiqi.com>", to: [email], subject: "Verify your ResumeIQ email", html }),
    });
    console.log(`[ResumeIQ] Verification email sent → ${email}`);
  } catch (err: any) {
    console.error(`[ResumeIQ] Verification email failed: ${err.message}`);
  }
}

// ── Cloudflare R2 upload ──────────────────────────────────────────────────────
async function uploadToR2(fileBase64: string, key: string, contentType: string): Promise<string | null> {
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const endpoint = process.env.AWS_S3_ENDPOINT; // https://<accountid>.r2.cloudflarestorage.com
  const bucket = process.env.AWS_S3_BUCKET || "mycareeriq";

  if (!accessKey || !secretKey || !endpoint) return null;

  try {
    const buffer = Buffer.from(fileBase64, "base64");
    const date = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, "").substring(0, 15) + "Z";
    const dateShort = date.substring(0, 8);
    const host = endpoint.replace("https://", "");

    const payloadHash = crypto.createHash("sha256").update(buffer).digest("hex");
    const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${date}\n`;
    const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
    const canonicalRequest = `PUT\n/${bucket}/${key}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
    const credentialScope = `${dateShort}/auto/s3/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${date}\n${credentialScope}\n${crypto.createHash("sha256").update(canonicalRequest).digest("hex")}`;

    const hmac = (k: Buffer, data: string) => crypto.createHmac("sha256", k).update(data).digest();
    const signingKey = hmac(hmac(hmac(hmac(Buffer.from(`AWS4${secretKey}`), dateShort), "auto"), "s3"), "aws4_request");
    const signature = hmac(signingKey, stringToSign).toString("hex");
    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const res = await fetch(`${endpoint}/${bucket}/${key}`, {
      method: "PUT",
      headers: { "Content-Type": contentType, "x-amz-date": date, "x-amz-content-sha256": payloadHash, Authorization: authorization },
      body: buffer,
    });

    if (!res.ok) { console.warn(`[R2] Upload failed: ${res.status}`); return null; }

    const publicUrl = process.env.R2_PUBLIC_URL;
    return `${publicUrl || `${endpoint}/${bucket}`}/${key}`;
  } catch (err: any) {
    console.warn(`[R2] Upload error: ${err.message}`);
    return null;
  }
}

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
       VALUES (?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY))
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

// ── Reparse from existing parsedData using improved prompt ───────────────────
async function parseResumeFromParsed(existingData: any): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const textSummary = [
    existingData.name, existingData.title, existingData.summary,
    ...(existingData.experience || []).flatMap((e: any) => [e.title, e.company, ...(e.bullets || [])]),
    ...(existingData.skills?.categories || []).flatMap((c: any) => c.skills || []),
  ].filter(Boolean).join(" ").slice(0, 8000);

  const narrative = await extractCareerNarrative(textSummary, apiKey);

  const systemP = `You are an elite resume writer. Improve the parsed resume data provided. Keep all facts accurate — never invent metrics, titles, or dates not in the source.

CAREER NARRATIVE: ${narrative}

BULLET RULES:
- Strong past-tense action verbs only (Led, Built, Reduced, Standardized, Supervised, Optimized, Implemented)
- NEVER: "Responsible for", "Developed a deep understanding of", "Fostered a culture of", "Demonstrated commitment to"
- Every bullet must answer: what you did + scope + outcome
- No soft-attribute bullets whatsoever

SUMMARY: Professional identity + tenure + domain. Never fabricate a target role title.

EDUCATION: If degree field contains concatenated school/location/year info, parse into separate fields.
Example: "BS Biology South Dakota State University Brookings South Dakota" →
  degree: "B.S. Biology", school: "South Dakota State University", location: "Brookings, SD", year: ""

SKILLS: Keep existing skills. Add likely industry-standard skills as "Industry Standard" category.
For food/cheese manufacturing add: HACCP, GMP, SQF, FSMA, Food Safety Compliance, SOP Development,
Batch Records, Lean Manufacturing, Quality Control, 5S, Sanitation Programs, Shift Supervision.

MISSING DATES: List any role with empty startDate in missingDates array.

Return ONLY valid JSON starting with {`;

  const schema = `{"name":"string","email":"string","phone":"string","location":"string","title":"string","industry":"food_beverage","summary":"2-3 sentence professional identity pitch — no fabricated target role","missingDates":["Role Title at Company for any role missing dates"],"experience":[{"title":"string","company":"string","location":"string","startDate":"MM/YYYY or empty","endDate":"MM/YYYY or Present or empty","description":"string","bullets":["Improved bullet — strong verb + scope + outcome"],"achievements":[]}],"skills":{"categories":[{"name":"Cheese Manufacturing","skills":["existing"]},{"name":"Industry Standard","skills":["HACCP","GMP","etc"]}]},"education":[{"degree":"B.S. Biology","school":"South Dakota State University","location":"Brookings, SD","year":""}],"certifications":[],"yearsOfExperience":20,"languages":[],"topMetrics":["best 3 achievements"]}`;

  const res = await fetch(OPENAI_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.2,
      max_tokens: 3000,
      messages: [
        { role: "system", content: systemP },
        { role: "user", content: `Existing parsed resume data:\n\n${JSON.stringify(existingData, null, 2)}\n\nImprove and return JSON schema:\n${schema}` }
      ]
    })
  });

  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
  const resp = await res.json() as any;
  return JSON.parse(stripJson(resp.choices?.[0]?.message?.content || "{}"));
}

async function extractCareerNarrative(resumeText: string, apiKey: string): Promise<string> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 500,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: `You are a career strategist. Read this resume and extract the career narrative in 4-6 sentences. Return ONLY the narrative — no preamble, no labels, no JSON.

Cover:
1. Professional identity — who is this person and what's their expertise?
2. Career theme — what's the through-line across their roles? (e.g. "consistently moved into roles with greater territory complexity and revenue responsibility")
3. Career progression — how have they grown? (SDR → AE → Manager, IC → Founder, etc.)
4. Transition context — any pivots, gaps, or industry changes? Frame them as intentional moves.
5. Top 2-3 accomplishments — their strongest proof points with context
6. Value proposition — what do they bring to their next role?

Be specific. Use actual companies and titles from the resume. Do not invent metrics.`,
          },
          {
            role: "user",
            content: `Extract the career narrative from this resume:\n\n${resumeText.slice(0, 8000)}`,
          }
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return "";
    const data = await res.json() as any;
    const narrative = (data.choices?.[0]?.message?.content || "").trim();
    console.log(`[ResumeIQ] Career narrative extracted: ${narrative.slice(0, 100)}...`);
    return narrative;
  } catch (err: any) {
    console.warn("[ResumeIQ] Narrative extraction failed:", err.message);
    return "";
  }
}

async function parseResume(fileBase64: string, fileName: string, targetRole?: string): Promise<any> {
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

  const targetRoleText = targetRole && targetRole.trim() ? targetRole.trim() : "Not provided — do not reference any target role.";

  const systemPrompt = `You are an elite resume writer and career strategist used by executives at Fortune 500 companies. You have ONE job: take a mediocre resume and make it exceptional — while keeping every fact 100% accurate.

YOUR PHILOSOPHY:
Most resumes are terrible not because the person has bad experience, but because they undersell it. "Responsible for managing accounts" and "Grew 28-account territory from $800K to $1.4M ARR" describe the same job. Your job is to find the version that gets callbacks.

CAREER NARRATIVE CONTEXT (extracted before this step):
{NARRATIVE_CONTEXT}

TARGET ROLE (provided by the candidate, may be empty):
{TARGET_ROLE_CONTEXT}

USE THE NARRATIVE TO:
- Write a summary that opens with the candidate's professional identity and career theme — not just their last job
- Frame each role so the bullets ladder up to the overall narrative
- Surface the progression arc (SDR → AE → Manager → VP) explicitly in the summary
- Address any career transitions factually and confidently — pivots are strengths, not gaps
- Make the first bullet of each role the one that best connects to the narrative theme

USE THE TARGET ROLE (when provided, otherwise ignore this section entirely):
- This is the ONE case where you ARE allowed to reference a target role in the summary — because the candidate explicitly told you what they want, you are not fabricating it
- Close the summary with a line connecting their background to this target role (e.g. "...positions them well for a [Target Role] focused on [relevant theme]")
- Weight word choice in bullets and skills toward terminology a hiring manager for THIS role would scan for — without changing any facts, numbers, companies, or dates
- Prioritize skills in the categorized list that are most relevant to this target role, while still including all skills found in the source resume
- If TARGET_ROLE_CONTEXT is empty or says "Not provided", follow the existing rule: never fabricate or reference any target role

WHAT YOU DO:
1. EXTRACT every fact, company, date, title, and metric EXACTLY as written
2. ELEVATE every bullet using the "So what?" test — if a bullet doesn't answer "so what did that achieve?", you rewrite it until it does
3. INFER context — use industry knowledge to make bullets specific and credible WITHOUT inventing numbers
4. SURFACE buried wins — find achievements hidden in descriptions, dates, or throwaway lines
5. STRENGTHEN the summary — write it like a pitch for the whole person, not a description of their last role

BULLET TRANSFORMATION RULES:
- Every bullet MUST start with a past-tense action verb (Led, Built, Grew, Reduced, Closed, Launched, Improved, Standardized, Supervised — NOT "Responsible for", "Helped with", "Assisted in", "Participated in", "Developed a deep understanding of")
- TENSE CONSISTENCY: All bullets within a single role must use the same tense. Completed past roles → all past tense. Current/ongoing role → past tense for completed achievements (the normal case), present tense ONLY if describing a literally ongoing recurring duty — and if so, ALL bullets in that role must match, never mix past and present tense within the same role.
- If the resume contains a number for this bullet — use it EXACTLY. Never round, inflate, or change it.
- If the resume does NOT contain a number — do NOT invent one. Elevate language and framing instead.
- Every bullet MUST answer: What did you do? What was the scope? What was the outcome or impact?
- NEVER write a bullet that describes a personal quality or soft attribute — "developed a deep understanding", "fostered a culture of", "demonstrated commitment to" are NOT bullets. Convert them to specific actions.
- For manufacturing, operations, food/beverage, and industrial roles: extract or infer scope from batch size, production volume, plant capacity, team size, shift coverage, compliance metrics, downtime, yield, or cost — even if not explicitly stated as metrics
- The scope can be specific without being numeric: "multi-site operations", "union workforce", "24/7 production environment", "multi-million dollar capital projects" — but ONLY if context is clear from the resume

WHAT YOU MUST NEVER DO:
- Invent companies, titles, dates, certifications, or metrics that don't exist in the source
- Add a specific number ($4.2M, 35 accounts, 94%) that isn't in the resume
- Change a "Conversational" language level to "Fluent"
- Add a job the person never had
- If a role has ZERO bullets in the original, return [] — do not invent responsibilities
- NEVER reference a target job title, target company, or target role in the summary unless it is explicitly stated in the resume. Do not write "making him a valuable asset for a [X] role" if that role is not in the resume.

TYPO AND SPELLING CORRECTIONS (fix these automatically — they are always wrong):
- HIPPA → HIPAA (always a misspelling — the correct acronym is HIPAA)
- WASP → OWASP (security context — the correct name is OWASP)
- Practioner → Practitioner
- Managment → Management
- Developement → Development
- Administation → Administration
- Enginering → Engineering
- Fix any other obvious single-character typos in company names, certification names, or skills
- DO NOT change the candidate's email address even if it appears to be a typo — flag it in emailTypoWarning instead

EMAIL VALIDATION:
- Check if the email field appears to have a typo in the PROVIDER DOMAIN ONLY
- Only flag these known provider misspellings: gamil→gmail, yahooo→yahoo, hotmal→hotmail, outllook→outlook, gmaill→gmail, yaho→yahoo, gmial→gmail
- NEVER flag custom domains like sternsoftware.com, reviveiqi.com, company.com — these are legitimate business emails
- If you detect a likely provider typo, set "emailTypoWarning" to the likely correct email
- If the email looks correct OR uses a custom domain, set "emailTypoWarning" to null

THE SUMMARY RULES:
- Open with who this person IS professionally — their identity, not their last title
- Lead with their most impressive credential, tenure, or achievement
- Name their strongest metric if one exists in the resume
- 2-3 sentences maximum, every word earns its place
- NEVER fabricate a target role or company
- CLOSING LINE RULE — the final sentence must do ONE of these three things, in priority order:
  1. If targetRole is provided: connect their background to that specific role
  2. If a clear career theme or specialization is evident: name it specifically (e.g. "specializing in distributed systems and AI-enabled platform delivery at enterprise scale")
  3. If neither: end with the single most impressive, specific outcome from their career — never use filler phrases like "brings X years of expertise", "proven track record", "valuable asset", "passionate about", or "positions them well for their next role" — these are generic and waste the closing line
- The closing line should say something specific about this person that could not apply to anyone else in their field

EDUCATION PARSING RULES:
- If the education field appears to contain concatenated information (degree + school + location + year all in one string), parse them into separate fields
- Example: "BS Biology South Dakota State University Brookings South Dakota 2002" → degree: "B.S. Biology", school: "South Dakota State University", location: "Brookings, SD", year: "2002"
- Extract graduation year from anywhere in the education string — 4-digit years like 1995, 2002, 2018 are always graduation years
- If location appears in the education string, extract it into the location field

AWARDS AND HONORS RULE:
- If the source resume contains awards, honors, or recognitions embedded inline inside an experience block (e.g. a trophy emoji line like "🏆 Regional Sales Manager of the Year" sitting between bullets), put them in that role's "achievements" array — NOT in the "bullets" array
- Do NOT leave decorative emoji or icon-prefixed lines embedded inside the bullets array — ATS parsers can misread them as bullets or corrupt nearby text
- Strip the emoji/icon itself — store just the clean award text (e.g. "Regional Sales Manager of the Year") in "achievements"
- CRITICAL — NO DUPLICATION: once an award is placed in "achievements", it must NOT also appear as a bullet, rewritten or otherwise, anywhere in that role's "bullets" array. An award is either an achievement entry OR a bullet — never both. Do not write a bullet like "Recognized as Rookie of the Year 2019" if "Rookie of the Year 2019" is already in achievements — that is a duplicate.
- This keeps awards visually and structurally separated from the bullets in the final document instead of cluttering the experience narrative

SKILLS EXTRACTION RULES:
- Extract ALL skills explicitly mentioned anywhere in the resume
- ALSO infer industry-standard skills based on job titles, company type, and role descriptions — these are skills the candidate almost certainly has but didn't list
- For manufacturing/food processing roles: infer HACCP, GMP, SQF, FSMA, food safety audits, SOPs, batch records, quality control, lean manufacturing if the role context supports it
- For sales roles: infer CRM, Salesforce, pipeline management, forecasting if not listed
- For engineering roles: infer relevant tools and methodologies from project descriptions
- Label inferred skills in a separate category called "Industry Standard" so the user can verify
- Always include a "Technical Skills", "Leadership", and "Industry Standard" category at minimum
- Return at least 8-12 total skills for any professional with 5+ years of experience
- DEDUPLICATION RULE: If the source resume lists skills in multiple overlapping formats (e.g. a flat comma-separated keyword string AND a separate categorized table covering mostly the same terms), CONSOLIDATE into ONE clean categorized list. Never output the same skill twice across categories, and never preserve a redundant flat list alongside a categorized one.

INDUSTRY DETECTION:
- Detect the candidate's industry from job titles, company names, and descriptions
- Return it in the "industry" field: one of "manufacturing", "food_beverage", "sales", "technology", "healthcare", "finance", "marketing", "operations", "engineering", "education", "nonprofit", "government", "consulting", "other"
- This field is used to show relevant skill suggestions to the candidate after transformation

MISSING DATES RULE:
- If ANY role is missing a startDate or endDate, add that role's title and company to a "missingDates" array in the response
- Example: "missingDates": ["Process Improvement Supervisor at Valley Queen Cheese"]
- This triggers the interview flow to ask for those dates specifically

BULLET CURATION RULE — CRITICAL:
- For each role, READ ALL content including sub-sections, sub-headers, and nested bullet groups before selecting bullets
- Many resumes organize one role into sub-sections (e.g. "Performance Highlights", "Systems & Process", "Leadership"). Read ALL of them before deciding which bullets to include
- Then SELECT the 4-6 strongest bullets across all sub-sections based on:
  1. Specificity of metric — exact numbers ($1M AUD, 94%, 800+ work orders) beat vague claims
  2. Scale of impact — larger scope wins (13 locations, 55+ stakeholders, $15M portfolio)
  3. Uniqueness — bullets that only THIS person could have written, not generic role descriptions
  4. Outcome clarity — what changed as a result? Revenue, time, cost, scale, compliance?
- IMPORTANT: If a bullet contains the same metric or achievement that appears in topMetrics, that bullet MUST be included in the experience section for that role. Never put a metric in topMetrics that doesn't also appear in the role bullets.
- Do NOT just take the first 3-4 bullets and stop. The best bullet might be in the 4th sub-section.
- Do NOT include all bullets just because they exist. A 20-bullet role should become 4-6 curated highlights.
- For entry-level candidates with fewer total bullets: keep all bullets if the role has 3 or fewer, curate to 4 max if 4+
- ELEVATE the selected bullets — stronger verb, tighter language — but never change the facts or numbers

PROJECTS SECTION:
- If the resume has a Projects section, extract ALL projects into the "projects" array
- For each project: name, technologies used (tech field), and the 2-3 strongest bullets
- Student projects, side projects, freelance work, and academic projects all count
- Include metrics if present (accuracy, scale, users, performance improvement)
- Do NOT skip this section — it is often the strongest part of an entry-level resume

PERSONAL WEBSITE:
- Extract any personal website, portfolio URL, or professional URL from the resume header or contact section
- Examples: "marketingwithcrystal.com", "portfolio.dev/name", "github.com/username"
- Do NOT confuse with LinkedIn — store separately in the "website" field
- If no website is present, return empty string

ADDITIONAL / FREELANCE / CONSULTING SECTIONS:
- If the resume has ANY of these sections, extract into the "leadership" array: "Additional", "Other Experience", "Freelance", "Consulting", "Projects Skills", "Project Skills", "Community", "Volunteer", "Extracurricular", "Activities", "Hobbies", "Interests"
- "Projects Skills" sections (like Jennifer Clark's) often contain strong metrics written as narrative — extract the key achievements as bullets
- Freelance consulting work, board positions, and side projects listed here should all be captured
- For narrative skills sections: convert the narrative into 2-3 strong bullet points extracting the best metrics
- Example: "Projects Skills" with "Managed 500+ transactions/month with 99% accuracy" → bullet: "Processed 500+ transactions monthly with 99% accuracy rate"

PUBLICATIONS:
- If the resume has a Publications, Books, Articles, or similar section, extract into the "publications" array
- Include full title, publisher, and year if mentioned
- Example: "OS/2 Warp Presentation Manager for Power Programmers published by Wiley" → one entry

EDUCATION MINOR AND HONORS:
- If a degree mentions a minor, concentration, honors, or GPA, capture it in the gpa field
- Example: "Bachelor of Science + Minor in Computer Science" → gpa: "Minor in Computer Science"

TOP METRICS AND EXPERIENCE BULLETS:
- topMetrics should reflect the 3 strongest quantified achievements across the ENTIRE resume
- These same achievements MUST also appear as bullets in the relevant experience role
- Do not put a metric in topMetrics if it is not also represented in the experience bullets
- The curation pass selects the best 4-6 bullets — make sure topMetrics achievements are always included
- Examples: "3.8/4.0", "7.77/10", "88.20%", "First Class Honours", "Distinction"
- If multiple formats appear (CGPA + percentage), use the format that appears first
- If no grade information is present, return empty string for gpa field
- Also extract Minor or Concentration fields: add to the degree name (e.g. "Bachelor of Science in Business Administration, Minor in Computer Science")

PUBLICATIONS:
- If the resume has a Publications, Books, Articles, or Research section, extract all entries into the "publications" array
- Include: title, publisher, and year if present
- Example: "OS/2 Warp Presentation Manager for Power Programmers published by Wiley" → "OS/2 Warp Presentation Manager for Power Programmers — Wiley"

CRITICAL EXTRACTION RULES:
- Extract the person's FULL legal name including middle name if present
- For partial dates with only a year (e.g. "2019"), return "2019" for startDate and "" for endDate
- Preserve language fluency levels EXACTLY as written — never upgrade
- Extract EVERY language listed with its exact fluency level
- Search the ENTIRE document for a Languages section`;

  const jsonSchema = `{
  "name": "Extract the actual person's full name from the resume",
  "email": "actual email address from resume — do NOT correct typos here, flag them in emailTypoWarning",
  "emailTypoWarning": "null OR the likely correct email if a provider typo is detected (e.g. 'sapkota@gmail.com' if original was 'sapkota@gamil.com')",
  "phone": "actual phone number from resume",
  "location": "actual city and state from resume",
  "linkedin": "actual linkedin URL if present, else empty string",
  "website": "personal website, portfolio, or professional URL if present, else empty string",
  "title": "their most recent actual job title",
  "industry": "one of: manufacturing, food_beverage, sales, technology, healthcare, finance, marketing, operations, engineering, education, nonprofit, government, consulting, other",
  "summary": "2-3 sentence pitch. Opens with professional identity. Includes strongest credential or achievement. Closes with a specific, non-generic statement — never use 'brings X years of expertise', 'proven track record', 'valuable asset', or 'positions them well'. Close with something specific only this candidate could claim.",
  "missingDates": ["Role Title at Company Name for any role where startDate or endDate could not be found"],
  "experience": [
    {
      "title": "their actual job title",
      "company": "the actual company name",
      "location": "actual city, state",
      "startDate": "MM/YYYY from resume — empty string if not found",
      "endDate": "MM/YYYY or Present — empty string if not found",
      "description": "one sentence: what this company does, market, and stage",
      "bullets": [
        "4-6 curated, elevated bullets — selected from ALL sub-sections of this role for maximum impact. Strong past-tense verb + specific scope + quantified outcome. Never generic."
      ],
      "achievements": ["any awards, recognitions, President's Club, or notable wins mentioned"]
    }
  ],
  "projects": [
    {
      "name": "project name exactly as written",
      "tech": "technologies or tools used (e.g. Python, SQL, Power BI)",
      "bullets": ["what was built, what data/scale, what outcome or metric — extract ALL project bullets"]
    }
  ],
  "leadership": [
    {
      "title": "role or position title",
      "organization": "club, university, organization name",
      "startDate": "MM/YYYY or year if available",
      "endDate": "MM/YYYY or year or Present",
      "bullets": ["what they did, scope, outcome — extract ALL bullets"]
    }
  ],
  "skills": {
    "categories": [
      { "name": "category name", "skills": ["skill1", "skill2"] }
    ]
  },
  "education": [
    {
      "degree": "actual degree name only — not school or location",
      "school": "actual school name only",
      "location": "city, state of school",
      "year": "4-digit graduation year",
      "gpa": "GPA, CGPA, or percentage score exactly as written — e.g. '3.8/4.0' or '7.77/10' or '88.20%' — empty string if not present"
    }
  ],
  "certifications": ["full certification text exactly as written including expiry dates"],
  "publications": ["book title, article, or publication exactly as written — include publisher if mentioned"],
  "publications": ["book, article, or paper titles exactly as written — include publisher if mentioned"],
  "seniorityLevel": "entry or mid or senior or executive",
  "yearsOfExperience": 0,
  "languages": [
    { "language": "actual language name", "level": "exact fluency level as written — never upgrade" }
  ],
  "topMetrics": [
    "single best quantified achievement with context",
    "second strongest achievement",
    "third strongest achievement"
  ]
}
Return ONLY the JSON object. Start with { and end with }.`;

  console.log(`[ResumeIQ] Text length: ${textContent.length}. First 200: ${textContent.slice(0, 200)}`);

  // DOCX path: use extracted text
  if (textContent && textContent.length > 200) {
    const narrative = await extractCareerNarrative(textContent, apiKey);
    const promptWithNarrative = systemPrompt.replace(
      "{NARRATIVE_CONTEXT}",
      narrative || "Not enough information to extract narrative — treat each role independently and write the strongest possible summary from what's available."
    ).replace("{TARGET_ROLE_CONTEXT}", targetRoleText);

    const res = await fetch(OPENAI_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: promptWithNarrative },
          { role: "user", content: `Parse this resume:\n\n${textContent}\n\nReturn JSON:\n${jsonSchema}` }
        ],
        max_tokens: 4000,
        temperature: 0.2,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
    const data = await res.json() as any;
    return JSON.parse(stripJson(data.choices?.[0]?.message?.content || "{}"));
  }

  // PDF path: extract text with pdf-parse then send to GPT-4o as text
  if (isPdf) {
    console.log(`[ResumeIQ] PDF detected — extracting text with pdf-parse`);
    let pdfText = "";
    try {
      const pdfParse = await import("pdf-parse");
      const buffer = Buffer.from(fileBase64, "base64");
      const parsed = await pdfParse.default(buffer);
      pdfText = parsed.text.replace(/\s+/g, " ").trim().slice(0, 15000);
      console.log(`[ResumeIQ] PDF text extracted: ${pdfText.length} chars`);
    } catch (pdfErr: any) {
      console.warn(`[ResumeIQ] pdf-parse failed: ${pdfErr.message} — falling back to vision`);
    }

    if (pdfText.length > 200) {
      // Good extraction — send as text
      const narrative = await extractCareerNarrative(pdfText, apiKey);
      const promptWithNarrative = systemPrompt.replace(
        "{NARRATIVE_CONTEXT}",
        narrative || "Not enough information to extract narrative — treat each role independently."
      ).replace("{TARGET_ROLE_CONTEXT}", targetRoleText);
      const res = await fetch(OPENAI_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: promptWithNarrative },
            { role: "user", content: `Parse this resume:\n\n${pdfText}\n\nReturn JSON:\n${jsonSchema}` },
          ],
          max_tokens: 4000,
          temperature: 0.2,
        }),
      });
      if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
      const data = await res.json() as any;
      return JSON.parse(stripJson(data.choices?.[0]?.message?.content || "{}"));
    }

    // Fallback: send as base64 image pages via GPT-4o vision
    console.log(`[ResumeIQ] PDF text extraction insufficient — using vision fallback`);
    const res = await fetch(OPENAI_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt.replace("{NARRATIVE_CONTEXT}", "Extract from the visual resume below.").replace("{TARGET_ROLE_CONTEXT}", targetRoleText) },
          {
            role: "user",
            content: [
              { type: "text", text: `This is a resume PDF encoded as base64. Extract all text content and parse it into this JSON structure:\n${jsonSchema}` },
              { type: "image_url", image_url: { url: `data:application/pdf;base64,${fileBase64}` } },
            ],
          },
        ],
        max_tokens: 4000,
        temperature: 0.2,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI PDF vision error: ${res.status}`);
    const data = await res.json() as any;
    return JSON.parse(stripJson(data.choices?.[0]?.message?.content || "{}"));
  }

  throw new Error("Could not extract text from this file. Please try a different format.");
}

async function applyScoreFlags(parsedData: any, scoreFlags: any): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return parsedData;

  // Always run enhancement — identify weak dimensions for targeted fixes,
  // but run the full narrative enhancement pass regardless of score
  const weakDimensions = scoreFlags ? Object.entries(scoreFlags)
    .filter(([, dim]: [string, any]) => dim.score < 7)
    .map(([key, dim]: [string, any]) => ({
      dimension: key,
      score: (dim as any).score,
      flag: (dim as any).flag,
    })) : [];

  const flagInstructions = weakDimensions.length > 0
    ? weakDimensions.map(d => `- ${d.dimension} (score ${d.score}/10): ${d.flag}`).join("\n")
    : "- All dimensions scored well — focus on elevating bullet language, narrative cohesion, and ensuring every bullet leads with impact";

  console.log(`[ResumeIQ] Running enhancement pass (${weakDimensions.length} weak dimensions)`);

  const experienceSummary = (parsedData.experience || []).map((e: any) => ({
    title: e.title,
    company: e.company,
    bullets: e.bullets || [],
  }));

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 2000,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: `You are a resume editor. You will receive a parsed resume and a list of specific improvement instructions from an ATS scorer. Apply ONLY the listed fixes — do not change anything not mentioned. Return ONLY the updated experience array as valid JSON. No preamble, no markdown.

CRITICAL RULES:
- Never invent metrics, companies, titles, or dates not in the original
- Only rewrite bullets specifically flagged as weak
- If a flag says to add action verbs, do so without adding fabricated numbers
- Return the array in exactly the same structure received`,
          },
          {
            role: "user",
            content: `Apply these specific fixes to the experience bullets:

FIXES REQUIRED:
${flagInstructions}

CURRENT EXPERIENCE:
${JSON.stringify(experienceSummary, null, 2)}

Return the updated experience array as JSON. Keep all fields (title, company, bullets) — only rewrite the bullets that need fixing per the instructions above.`,
          }
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      console.warn("[ResumeIQ] Score flag enhancement failed:", await res.text());
      return parsedData;
    }

    const data = await res.json() as any;
    const raw = (data.choices?.[0]?.message?.content || "")
      .replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim();

    const updatedExperience = JSON.parse(raw);

    if (Array.isArray(updatedExperience)) {
      // Merge updated bullets back into parsedData, preserving all other fields
      const merged = { ...parsedData };
      merged.experience = parsedData.experience.map((orig: any, i: number) => ({
        ...orig,
        bullets: updatedExperience[i]?.bullets || orig.bullets,
      }));
      console.log("[ResumeIQ] Score flag enhancement applied successfully");
      return merged;
    }
  } catch (err: any) {
    console.warn("[ResumeIQ] Score flag enhancement error:", err.message);
  }

  return parsedData;
}

async function generateDocx(parsedData: any, scoreFlags?: any): Promise<Buffer> {
  if (scoreFlags) {
    const flags = Object.entries(scoreFlags)
      .filter(([, dim]: [string, any]) => dim.score < 7)
      .map(([key, dim]: [string, any]) => `${key}(${(dim as any).score}/10): ${(dim as any).flag}`)
      .join(" | ");
    if (flags) console.log(`[ResumeIQ] Score flags present: ${flags}`);
  }
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
            text: [parsedData.location, parsedData.phone, parsedData.email, parsedData.linkedin, parsedData.website]
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
              ...(edu.gpa ? [new TextRun({ text: `   |   GPA: ${edu.gpa}`, font: "Calibri", size: 18, color: GRAY })] : []),
            ]
          })),
        ] : []),

        // ── PROJECTS ───────────────────────────────────────────────────────
        ...(parsedData.projects?.length ? [
          sectionHeader("Projects"),
          ...(parsedData.projects || []).flatMap((proj: any) => [
            new Paragraph({
              spacing: { before: 120, after: 20 },
              children: [
                new TextRun({ text: proj.name || "", font: "Calibri", size: 20, bold: true, color: NAVY }),
                ...(proj.tech ? [new TextRun({ text: `  |  ${proj.tech}`, font: "Calibri", size: 18, italics: true, color: GRAY })] : []),
              ]
            }),
            ...(proj.bullets || []).map((b: string) => bul(b)),
          ]),
        ] : []),

        // ── LEADERSHIP & EXTRACURRICULAR ──────────────────────────────────
        ...(parsedData.leadership?.length ? [
          sectionHeader("Leadership Experience"),
          ...(parsedData.leadership || []).flatMap((role: any) => [
            new Paragraph({
              spacing: { before: 140, after: 20 },
              children: [
                new TextRun({ text: role.title || "", font: "Calibri", size: 20, bold: true, color: NAVY }),
                new TextRun({ text: `  |  ${role.organization || ""}`, font: "Calibri", size: 18, color: ACCENT }),
                ...(role.startDate || role.endDate ? [new TextRun({ text: `   ${role.startDate || ""}${role.startDate && role.endDate ? " – " : ""}${role.endDate || ""}`, font: "Calibri", size: 18, italics: true, color: GRAY })] : []),
              ]
            }),
            ...(role.bullets || []).map((b: string) => bul(b)),
          ]),
        ] : []),

        // ── PUBLICATIONS ───────────────────────────────────────────────────
        ...(parsedData.publications?.length ? [
          sectionHeader("Publications"),
          ...(parsedData.publications || []).map((pub: string) => bul(pub)),
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

// ── In-memory rate limiter ─────────────────────────────────────────────────
// Prevents abuse of the transform endpoint before auth check
// 10 requests per IP per hour — resets on rolling window
const transformRateLimit = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, maxPerHour = 10): boolean {
  const now = Date.now();
  const entry = transformRateLimit.get(ip);
  if (!entry || now > entry.resetAt) {
    transformRateLimit.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true; // allowed
  }
  if (entry.count >= maxPerHour) return false; // blocked
  entry.count++;
  return true;
}

// Clean up old entries every hour
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of transformRateLimit.entries()) {
    if (now > entry.resetAt) transformRateLimit.delete(ip);
  }
}, 60 * 60 * 1000);

// ── DETAILED ATS SCORER (shared by /score and /ats-check) ────────────────────
// Point-based rubric with topIssues, achievements visibility, and a
// pre-computed skills-duplication signal (not left for the model to spot on its own).
function detectSkillsDuplication(skills: any): boolean {
  const categories = skills?.categories || [];
  if (categories.length < 2) return false;
  const allSkillLists = categories.map((c: any) => (c.skills || []).map((s: string) => s.toLowerCase().trim()));
  // Check pairwise overlap between categories — if any two categories share 50%+ of their skills, flag as duplicated
  for (let i = 0; i < allSkillLists.length; i++) {
    for (let j = i + 1; j < allSkillLists.length; j++) {
      const a = allSkillLists[i], b = allSkillLists[j];
      if (a.length === 0 || b.length === 0) continue;
      const overlap = a.filter((s: string) => b.includes(s)).length;
      const overlapRatio = overlap / Math.min(a.length, b.length);
      if (overlapRatio >= 0.5) return true;
    }
  }
  return false;
}

async function scoreResumeDetailed(parsedData: any): Promise<any> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) return null;

  const skillsDuplicated = detectSkillsDuplication(parsedData.skills);
  const allAchievements = (parsedData.experience || []).flatMap((e: any) => e.achievements || []);

  // Send full resume data — truncating causes inaccurate scoring
  const resumeSummary = JSON.stringify({
    name: parsedData.name,
    title: parsedData.title,
    email: parsedData.email,
    phone: parsedData.phone,
    linkedin: parsedData.linkedin,
    summary: parsedData.summary,
    summaryWordCount: (parsedData.summary || "").split(/\s+/).filter(Boolean).length,
    experience: (parsedData.experience || []).map((e: any) => ({
      title: e.title,
      company: e.company,
      startDate: e.startDate,
      endDate: e.endDate,
      bullets: e.bullets || [],
      bulletCount: (e.bullets || []).length,
      achievements: e.achievements || [],
    })),
    skills: parsedData.skills,
    skillsDuplicatedAcrossCategories: skillsDuplicated,
    totalAchievementsFound: allAchievements.length,
    education: (parsedData.education || []).map((e: any) => ({
      degree: e.degree, school: e.school, year: e.year,
    })),
    certifications: parsedData.certifications,
    languages: parsedData.languages,
  });

  try {
    const scoreRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiApiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 800,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `You are a strict ATS resume auditor scoring an ORIGINAL, UNIMPROVED resume. Be harsh and specific. Most resumes score 4-7. A 9 or 10 is extremely rare on an original resume.

CRITICAL RULE: Every reason and topIssue MUST be based on specific evidence from THIS resume. Never give generic advice.

IMPORTANT — pre-computed signals provided for you (use these directly, do not re-derive):
- "skillsDuplicatedAcrossCategories": true means the skills section repeats the same skills across multiple category groups — this IS a real issue, deduct for it in completeness even if you can't see the original flat-list format.
- "totalAchievementsFound": if this is > 0, the resume contains separately-tracked awards/honors (e.g. "President's Club", "Rookie of the Year") — these were already correctly extracted out of the bullets. Do NOT penalize atsFormat for embedded awards if totalAchievementsFound > 0 AND achievements arrays are populated — that means it's already clean. If totalAchievementsFound is 0 but you still see award-like phrases inside any bullet text itself (e.g. a bullet that says "Won President's Club" or contains a trophy emoji), THAT is the inline-embedding problem — penalize atsFormat for it specifically and mention it by name in the flag.

Schema:
{
  "overall": number (1-10, average of 4 dimensions),
  "dimensions": {
    "atsFormat": { "score": number, "reason": string, "flag": string },
    "bulletQuality": { "score": number, "reason": string, "flag": string },
    "keywords": { "score": number, "reason": string, "flag": string },
    "completeness": { "score": number, "reason": string, "flag": string }
  },
  "topIssues": [string, string, string]
}

STRICT SCORING RULES:

atsFormat (1-10):
- Start at 7. Deduct for each issue found:
  -2: evidence of two-column layout, tables, or text boxes in the structure
  -2: non-standard section names (e.g. "Projects Skills", "Core Competencies" instead of "Skills")
  -1: contact info not clearly at top
  -1: missing any standard section (Summary, Experience, Skills, Education)
  -1: inconsistent date formatting
  -2: any bullet text contains an award, honor, or trophy emoji embedded inline (only applies if totalAchievementsFound is 0 — see note above)
- Score 8+ only if: single column confirmed, all standard headings, clean structure throughout, no embedded decorative content in bullets

bulletQuality (1-10):
- Start at 5. Adjust based on evidence:
  +2: ALL bullets start with strong action verbs (Led, Built, Reduced, Drove, Closed, etc.)
  +1: majority of bullets have specific metrics (%, $, headcount, time saved)
  +1: clear outcome stated in most bullets
  -2: any bullets starting with "Responsible for", "Helped", "Assisted", "Participated"
  -1: bullets written as narrative prose instead of action-outcome format
  -1: fewer than 3 bullets per role
  -1: no metrics in any bullet across entire resume
  -1: inconsistent verb tense within a single role (e.g. one present-tense bullet like "Advise..." mixed into a role where every other bullet is past-tense like "Founded...", "Built...")
- Most original resumes score 4-6 here

keywords (1-10):
- Start at 5. Adjust:
  +2: strong industry-specific terminology throughout
  +1: tool names and methodologies named specifically
  +1: role-specific vocabulary matches what ATS systems scan for
  -2: generic language with no industry terms
  -1: skills listed as narrative prose instead of scannable list
- Score based on what IS there

completeness (1-10):
- Check: name, email, phone, LinkedIn URL, summary ≥40 words (use summaryWordCount), all roles have startDate and endDate, skills section present
- Start at 10. Deduct 1 point per missing field.
- Deduct 1 point if "skillsDuplicatedAcrossCategories" is true — mention this specifically in the flag (e.g. "Skills are listed twice across overlapping categories").
- Education graduation year: NOT part of completeness score.
- summaryWordCount is provided — never say summary is too short if summaryWordCount ≥ 40

topIssues: List the 3 most impactful improvements this resume needs. Be specific — cite actual bullets, actual missing sections, actual weak language found in the resume. Never generic. If skillsDuplicatedAcrossCategories is true, that should be one of the 3 topIssues.`
          },
          {
            role: "user",
            content: `Score this resume:\n${resumeSummary}`,
          }
        ]
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!scoreRes.ok) throw new Error("Scoring failed");
    const scoreData = await scoreRes.json() as any;
    const raw = (scoreData.choices?.[0]?.message?.content || "").trim()
      .replace(/^```json?\s*/i, "").replace(/```\s*$/i, "");
    return JSON.parse(raw);
  } catch (err: any) {
    console.error("[ResumeIQ] scoreResumeDetailed error:", err.message);
    return null;
  }
}

async function scoreResume(parsedData: any): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const resumeSummary = JSON.stringify({
      name: parsedData.name,
      title: parsedData.title,
      summary: parsedData.summary?.slice(0, 300),
      experience: (parsedData.experience || []).slice(0, 3).map((e: any) => ({
        title: e.title, company: e.company,
        bullets: (e.bullets || []).slice(0, 4),
      })),
      skills: parsedData.skills,
      education: parsedData.education,
      certifications: parsedData.certifications,
    });

    const postScoreSystem = `You are an ATS resume quality reviewer. Score the TRANSFORMED, OPTIMIZED resume. This resume has already been improved — reward improvements generously. Most transformed resumes should score 7-9.

ATS FORMAT (1-10): Is it single-column, standard headings, no tables or graphics, clean structure, with awards/honors in their own dedicated section rather than embedded inline with emojis or icons? Reward: proper section order, consistent formatting, ATS-safe layout, decorative content properly separated out.

BULLET QUALITY (1-10): Do bullets start with strong action verbs? Do they have specific metrics (%, $, headcount, time)? Is there a clear outcome in each bullet? Is verb tense consistent within each role? Reward: quantified impact, strong verbs, no filler language, consistent tense throughout.

KEYWORDS (1-10): Does it use industry-standard terminology and role-specific keywords? Reward: relevant technical skills, industry terms, role-appropriate language.

COMPLETENESS (1-10): Is everything present — summary, experience with dates, education, skills, certifications, contact info — without redundant duplication (e.g. skills listed once, cleanly, not repeated across a flat list and a separate table)? Reward: comprehensive profile with all key sections, no duplicated content.

Return JSON only. No preamble. No markdown.
{
  "overall": 1-10,
  "dimensions": {
    "atsFormat": { "score": 1-10, "flag": "one sentence highlight" },
    "bulletQuality": { "score": 1-10, "flag": "one sentence highlight" },
    "keywords": { "score": 1-10, "flag": "one sentence highlight" },
    "completeness": { "score": 1-10, "flag": "one sentence highlight" }
  }
}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini", max_tokens: 600, temperature: 0,
        messages: [
          { role: "system", content: postScoreSystem },
          { role: "user", content: `Score this resume:\n${resumeSummary}` }
        ],
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) {
      console.warn(`[ResumeIQ] scoreResume API error: ${res.status}`);
      return null;
    }
    const data = await res.json() as any;
    const raw = (data.choices?.[0]?.message?.content || "").trim().replace(/^```json?\s*/i, "").replace(/```\s*$/i, "");
    return JSON.parse(raw);
  } catch { return null; }
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
  // Analytics event capture — accepts and silently acknowledges tracking events
  app.post("/api/resumeiq/events", (req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // ── GUEST SESSION ───────────────────────────────────────────────────────────
  // Returns last active session data for a guestId — used to restore returning guests
  app.get("/api/resumeiq/guest-history", async (req: Request, res: Response) => {
    const { guestId } = req.query;
    if (!guestId || typeof guestId !== "string") { res.json({ session: null }); return; }
    try {
      const session = await getLastGuestSession(guestId);
      if (!session) { res.json({ session: null }); return; }
      // Return just enough to show the welcome-back banner — no full parsedData
      res.json({
        session: {
          sessionId: session.sessionId,
          name: session.parsedData?.name || null,
          title: session.parsedData?.title || null,
          preScore: session.parsedData?.preScore || null,
          paid: session.paid,
          createdAt: session.createdAt,
        }
      });
    } catch { res.json({ session: null }); }
  });

  app.post("/api/resumeiq/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body;
      if (!email || !password) { res.status(400).json({ error: "Email and password required" }); return; }
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) { res.status(400).json({ error: "Please enter a valid email address" }); return; }
      if (password.length < 6) { res.status(400).json({ error: "Password must be at least 6 characters" }); return; }
      const user = await createUser(email, password, name || "");
      const token = generateToken(user.id, user.email);

      // Generate and store verify token
      const verifyTok = crypto.randomBytes(32).toString("hex");
      await setVerifyToken(user.id, verifyTok);

      // Send verification email (non-blocking)
      sendVerificationEmail(user.email, user.name || "", verifyTok).catch(() => {});
      // Fire welcome email + owner notification (non-blocking)
      import("./nurtureEmail").then(({ sendWelcomeEmail }) => sendWelcomeEmail(user.email, user.name || "")).catch(() => {});
      notifyNewUser(user.email, user.name || "").catch(() => {});
      // Merge any guest sessions into the new account
      const guestIdToMerge = req.body.guestId;
      if (guestIdToMerge) {
        mergeGuestSessionsToUser(guestIdToMerge, user.id).catch(() => {});
      }
      res.json({ token, user: { id: user.id, email: user.email, name: user.name, emailVerified: false } });
    } catch (error: any) {
      if (error.message?.includes("Duplicate")) res.status(400).json({ error: "Email already registered" });
      else res.status(500).json({ error: error.message });
    }
  });

  // ── VERIFY EMAIL ──────────────────────────────────────────────────────────
  app.get("/api/resumeiq/auth/verify-email", async (req: Request, res: Response) => {
    const { token } = req.query;
    if (!token) { res.redirect("/app?verified=invalid"); return; }
    try {
      const user = await verifyEmail(String(token));
      if (!user) {
        res.redirect("/app?verified=invalid");
        return;
      }
      console.log(`[ResumeIQ] Email verified: ${user.email}`);
      res.redirect("/app?verified=success");
    } catch (err: any) {
      res.redirect("/app?verified=error");
    }
  });

  // Resend verification email
  app.post("/api/resumeiq/auth/resend-verification", async (req: Request, res: Response) => {
    try {
      const tokenUser = getTokenUser(req);
      if (!tokenUser) { res.status(401).json({ error: "Unauthorized" }); return; }
      const user = await getUserById(tokenUser.userId);
      if (!user) { res.status(404).json({ error: "User not found" }); return; }
      if (user.emailVerified) {
        res.json({ ok: true, message: "Already verified", alreadyVerified: true });
        return;
      }
      const verifyTok = crypto.randomBytes(32).toString("hex");
      await setVerifyToken(user.id, verifyTok);
      await sendVerificationEmail(user.email, user.name || "", verifyTok);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/resumeiq/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const user = await loginUser(email, password);
      if (!user) { res.status(401).json({ error: "Invalid email or password" }); return; }
      const token = generateToken(user.id, user.email);
      res.json({ token, user: { id: user.id, email: user.email, name: user.name, plan: user.plan, resumeCount: user.resumeCount || 0, emailVerified: user.emailVerified || false } });
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

teaserFields: always use ["communicationStyle", "motivation"] — these are the 2 revealed in the free preview`;

      console.log(`[ResumeIQ] Generating Working With Me from ${assessmentTexts.length} assessment(s)`);

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
          max_tokens: 800, temperature: 0.2,
        }),
      });

      if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
      const data = await response.json() as any;
      const raw = data.choices?.[0]?.message?.content || "{}";
      const clean = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
      const result = JSON.parse(clean);
      const { teaserFields, ...workingWithMe } = result;

      // Check if this user already has personality unlocked — if so, save immediately
      // Monthly and agency plan users always have personality unlocked
      const tokenUser = getTokenUser(req);
      if (tokenUser) {
        const dbUser = await getUserById(tokenUser.userId);
        const plan = dbUser?.plan || "free";
        const planExpiry = dbUser?.planExpiresAt ? new Date(dbUser.planExpiresAt) : null;
        const planActive = !planExpiry || planExpiry > new Date();
        const hasWWMAccess = dbUser?.personalityUnlocked ||
          ((plan === "monthly" || plan === "agency") && planActive) ||
          plan === "starter";
        if (hasWWMAccess) {
          await saveWorkingWithMe(tokenUser.userId, workingWithMe);
        }
      }

      console.log(`[ResumeIQ] Working With Me generated, teaser fields: ${teaserFields}`);
      res.json({ workingWithMe, teaserFields: teaserFields || ["communicationStyle", "motivation"] });
    } catch (error: any) {
      console.error("[ResumeIQ] Personality error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── MONTHLY CHECKOUT ─────────────────────────────────────────────────
  app.post("/api/resumeiq/monthly-checkout", async (req: Request, res: Response) => {
    try {
      const { resumeiqSession } = req.body;
      const origin = req.headers.origin as string || "https://resumeiq.reviveiqi.com";
      const successUrl = `${origin}/app?payment=success&`;
      const cancelUrl = `${origin}/app`;
      const utmData = req.body?.utmData || {};
      const result = await createMonthlySession(successUrl, cancelUrl, resumeiqSession, false, utmData);
      res.json({ url: result.url });
    } catch (error: any) {
      console.error("[ResumeIQ] Monthly checkout error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── PERSONALITY CHECKOUT ─────────────────────────────────────────────────
  // Career Launch Bundle checkout
  app.post("/api/resumeiq/career-checkout", async (req: Request, res: Response) => {
    try {
      const { resumeiqSession } = req.body;
      const origin = req.headers.origin as string || "https://resumeiq.reviveiqi.com";
      const successUrl = `${origin}/app?payment=success&`;
      const cancelUrl = `${origin}/app`;
      const result = await createCareerLaunchSession(successUrl, cancelUrl, resumeiqSession);
      res.json({ url: result.url });
    } catch (error: any) {
      console.error("[ResumeIQ] Career checkout error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/resumeiq/personality-checkout", async (req: Request, res: Response) => {
    try {
      const { resumeiqSession, type } = req.body; // type: "personality" | "bundle"
      const session = await getSession(resumeiqSession);
      if (!session) { console.error(`[ResumeIQ] Checkout failed — session not found: ${sessionId || "no sessionId"}`); res.status(404).json({ error: "Session not found or expired" }); return; }
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
  // ── TESTIMONIALS ──────────────────────────────────────────────────────────
  // Submit a testimonial (from done screen)
  app.post("/api/resumeiq/testimonial", async (req: Request, res: Response) => {
    try {
      const { rating, quote, name, title, preScore, postScore } = req.body;
      if (!quote || !rating) { res.status(400).json({ error: "Rating and quote required" }); return; }
      if (quote.trim().length < 10) { res.status(400).json({ error: "Quote too short" }); return; }

      const token = req.headers.authorization?.replace("Bearer ", "");
      let userId = null;
      if (token) {
        try { const u = verifyToken(token); userId = u?.userId || null; } catch {}
      }

      const conn = await getDb();
      if (!conn) { res.status(500).json({ error: "DB unavailable" }); return; }
      try {
        await conn.execute(
          `INSERT INTO riq_testimonials (userId, name, title, rating, quote, preScore, postScore, approved)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
          [userId, name || "ResumeIQ User", title || null, Math.min(5, Math.max(1, parseInt(rating))), quote.trim(), preScore || null, postScore || null]
        );
        // Notify Bryan
        notifyOwner(`⭐ New testimonial (${rating}★) — ${name}`, `<div style="font-family:sans-serif;padding:20px;color:#1a1a1a"><h3>${name} — ${rating}★</h3><p style="font-size:15px;font-style:italic">"${quote.trim()}"</p><p style="color:#64748b;font-size:13px">Pre-score: ${preScore} → Post-score: ${postScore}</p></div>`).catch(() => {});
        res.json({ ok: true });
      } finally { await conn.end(); }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Fetch approved testimonials (public)
  app.get("/api/resumeiq/testimonials", async (_req: Request, res: Response) => {
    try {
      const conn = await getDb();
      if (!conn) { res.json([]); return; }
      try {
        const [rows] = await conn.execute(
          `SELECT id, name, title, rating, quote, preScore, postScore, createdAt
           FROM riq_testimonials WHERE approved = 1 ORDER BY createdAt DESC LIMIT 20`
        ) as any;
        const data = Array.isArray(rows[0]) ? rows[0] : rows;
        res.json(data);
      } finally { await conn.end(); }
    } catch {
      res.json([]);
    }
  });

  // Approve/seed testimonials (owner only — simple secret check)
  app.post("/api/resumeiq/testimonials/approve", async (req: Request, res: Response) => {
    const { id, secret } = req.body;
    if (secret !== process.env.JWT_SECRET) { res.status(403).json({ error: "Forbidden" }); return; }
    const conn = await getDb();
    if (!conn) { res.status(500).json({ error: "DB unavailable" }); return; }
    try {
      await conn.execute("UPDATE riq_testimonials SET approved = 1 WHERE id = ?", [id]);
      res.json({ ok: true });
    } finally { await conn.end(); }
  });

  // ── ADMIN: Get presigned R2 download URL for original resume ─────────────
  app.get("/api/resumeiq/admin/original/:sessionId", async (req: Request, res: Response) => {
    const { secret, key: directKey } = req.query;
    if (secret !== process.env.JWT_SECRET) { res.status(403).json({ error: "Forbidden" }); return; }

    const { sessionId } = req.params;

    try {
      // Try session lookup first, fall back to direct key param
      let key = directKey as string | undefined;
      if (!key) {
        const session = await getSession(sessionId);
        key = session?._originalKey;
      }

      if (!key) { res.status(404).json({ error: "No original file found — session may have expired. Pass ?key=resumeiq/userId/sessionId/filename.pdf" }); return; }

      const accessKey = process.env.AWS_ACCESS_KEY_ID;
      const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
      const endpoint = process.env.AWS_S3_ENDPOINT;
      const bucket = process.env.AWS_S3_BUCKET || "mycareeriq";

      if (!accessKey || !secretKey || !endpoint) {
        res.status(500).json({ error: "R2 not configured" }); return;
      }

      // Generate presigned URL using SigV4 (R2 requires SigV4, not SigV2)
      const crypto = await import("crypto");
      const now = new Date();
      const dateStr = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").substring(0, 8);
      const dateTimeStr = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").substring(0, 15) + "Z";
      const region = "auto";
      const service = "s3";
      const encodedKey = (key as string).split("/").map(k => encodeURIComponent(k)).join("/");
      const host = endpoint.replace("https://", "");
      const credentialScope = `${dateStr}/${region}/${service}/aws4_request`;
      const credential = `${accessKey}/${credentialScope}`;
      const expiresSeconds = 900; // 15 minutes

      const queryParams = [
        `X-Amz-Algorithm=AWS4-HMAC-SHA256`,
        `X-Amz-Credential=${encodeURIComponent(credential)}`,
        `X-Amz-Date=${dateTimeStr}`,
        `X-Amz-Expires=${expiresSeconds}`,
        `X-Amz-SignedHeaders=host`,
      ].join("&");

      const canonicalRequest = [
        "GET",
        `/${bucket}/${encodedKey}`,
        queryParams,
        `host:${host}`,
        "",
        "host",
        "UNSIGNED-PAYLOAD",
      ].join("\n");

      const hmac = (k: Buffer | string, data: string) =>
        crypto.default.createHmac("sha256", k).update(data).digest();

      const stringToSign = [
        "AWS4-HMAC-SHA256",
        dateTimeStr,
        credentialScope,
        crypto.default.createHash("sha256").update(canonicalRequest).digest("hex"),
      ].join("\n");

      const signingKey = hmac(
        hmac(hmac(hmac(Buffer.from(`AWS4${secretKey}`), dateStr), region), service),
        "aws4_request"
      );
      const signature = hmac(signingKey, stringToSign).toString("hex");

      const url = `${endpoint}/${bucket}/${encodedKey}?${queryParams}&X-Amz-Signature=${signature}`;
      const fileName = (key as string).split("/").pop() || "resume.pdf";
      res.json({ url, fileName, key });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── TEMP DEBUG: reparse from existing parsedData ─────────────────────────
  // Remove after QC complete
  app.post("/api/resumeiq/debug-reparse", async (req: Request, res: Response) => {
    const { secret, parsedData: inputData } = req.body;
    if (secret !== process.env.JWT_SECRET) { res.status(403).json({ error: "Forbidden" }); return; }
    try {
      const improved = await parseResumeFromParsed(inputData);
      res.json(improved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

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

  // ── ATS CHECKER (no auth, free, rate-limited) ───────────────────────────────
  // Public endpoint — parses resume and returns ATS score + flags + topIssues.
  // No transformation, no session, no payment. Drives /ats-checker page.
  const atsCheckRateLimit = new Map<string, { count: number; resetAt: number }>();
  function checkAtsRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = atsCheckRateLimit.get(ip);
    if (entry && now < entry.resetAt) {
      if (entry.count >= 3) return false;
      entry.count++;
    } else {
      atsCheckRateLimit.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    }
    return true;
  }

  app.post("/api/resumeiq/ats-check", async (req: Request, res: Response) => {
    try {
      const ip = getClientIp(req);
      if (!checkAtsRateLimit(ip)) {
        res.status(429).json({ error: "You\'ve used your 3 free checks this hour. Try again later or transform your resume to see the full fix." });
        return;
      }

      const { fileBase64, fileName } = req.body;
      if (!fileBase64) { res.status(400).json({ error: "No file provided" }); return; }

      // Parse the resume to structured data
      const parsed = await parseResume(fileBase64, fileName || "resume.pdf");

      // Score it using the detailed rubric — same scorer used by the full app's /score route
      const scoreData = await scoreResumeDetailed(parsed);
      if (!scoreData) { res.status(500).json({ error: "Scoring failed" }); return; }

      // Return score + candidate name for personalisation, nothing else
      res.json({
        name: parsed.name || null,
        overall: scoreData.overall,
        dimensions: scoreData.dimensions,
        topIssues: scoreData.topIssues || [],
      });
    } catch (error: any) {
      console.error("[ResumeIQ] ATS check error:", error);
      res.status(500).json({ error: error.message || "Check failed" });
    }
  });

  // ── RESUME SCORE ────────────────────────────────────────────────────
  // Scores the parsed resume on 4 ATS dimensions before transformation.
  // Returns scores + specific flags that drive the GPT transformation.
  app.post("/api/resumeiq/score", async (req: Request, res: Response) => {
    try {
      const { parsedData } = req.body;
      if (!parsedData) { res.status(400).json({ error: "No parsed data" }); return; }

      const scores = await scoreResumeDetailed(parsedData);
      if (!scores) { res.status(500).json({ error: "Scoring failed" }); return; }
      res.json(scores);
    } catch (err: any) {
      console.error("[ResumeIQ] Score error:", err.message);
      res.status(500).json({ error: "Scoring failed" });
    }
  });

  // ── TRANSFORM (parse + session) ──────────────────────────────────
  app.post("/api/resumeiq/transform", async (req: Request, res: Response) => {
    try {
      const ip = getClientIp(req);
      if (!checkRateLimit(ip)) {
        res.status(429).json({ error: "Too many requests — please wait an hour before trying again." });
        return;
      }

      const { fileBase64, fileName, targetRole, guestId } = req.body;
      if (!fileBase64) { res.status(400).json({ error: "No file provided" }); return; }

      const parsed = await parseResume(fileBase64, fileName || "resume.pdf", targetRole);
      const sessionId = crypto.randomBytes(16).toString("hex");

      const tokenUser = getTokenUser(req);
      const cookies = req.headers.cookie || "";
      const hasCookie = cookies.includes("resumeiq_free_used=1");

      let isFree = false;
      let planType = "free"; // free | starter | monthly | agency

      // Analysis is always free — unlimited analyses for everyone
      // isFree = true means this session gets a free download (no payment needed at /generate)
      if (tokenUser) {
        const dbUser = await getUserById(tokenUser.userId);
        const resumeCount = dbUser?.resumeCount || 0;
        const plan = dbUser?.plan || "free";
        const planExpiry = dbUser?.planExpiresAt ? new Date(dbUser.planExpiresAt) : null;
        const planActive = !planExpiry || planExpiry > new Date();

        if ((plan === "monthly" || plan === "agency") && planActive) {
          isFree = true; // unlimited downloads
          planType = plan;
        } else if (plan === "starter") {
          isFree = resumeCount < 3; // starter: 3 free downloads
          planType = "starter";
        } else {
          isFree = resumeCount < 1; // free tier: 1 free download
          planType = "free";
        }
      } else {
        isFree = !req.headers.cookie?.includes("resumeiq_free_used=1") && (freeUsedByIp.get(ip) || 0) === 0;
        planType = "free";
      }

      await createSession(sessionId, { ...parsed, _originalKey: tokenUser ? `resumeiq/${tokenUser.userId}/${sessionId}/${fileName || "resume.pdf"}` : null }, isFree, isFree);
      // Store guestId on session for returning guest tracking
      if (guestId && !tokenUser) {
        const gConn = await (await import("./authService")).getDb();
        if (gConn) {
          gConn.execute("UPDATE riq_sessions SET guestId = ? WHERE sessionId = ?", [guestId, sessionId]).catch(() => {});
        }
      }

      // Save original file to R2 (non-blocking) — for QC and re-processing
      if (tokenUser && fileBase64) {
        const ext = (fileName || "resume.pdf").split(".").pop()?.toLowerCase() || "pdf";
        const contentType = ext === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        const r2Key = `resumeiq/${tokenUser.userId}/${sessionId}/original.${ext}`;
        uploadToR2(fileBase64, r2Key, contentType)
          .then(url => {
            if (url) console.log(`[R2] Original saved: ${r2Key}`);
            else console.log(`[R2] Upload skipped — R2 not configured`);
          })
          .catch(() => {});
        parsed._originalKey = r2Key;
      }

      console.log(`[ResumeIQ] Session created for ${parsed.name} (free: ${isFree})`);
      res.json({ ...parsed, sessionId, isFree, planType });
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
      if (!session) { console.error(`[ResumeIQ] Checkout failed — session not found: ${sessionId || "no sessionId"}`); res.status(404).json({ error: "Session not found or expired" }); return; }
      if (session.paid) { res.json({ alreadyPaid: true }); return; }

      // Stamp checkout time and contact info for abandoned checkout recovery
      const tokenUser = getTokenUser(req);
      if (tokenUser) {
        const dbUser = await getUserById(tokenUser.userId);
        const conn = await getDb();
        if (conn) {
          await conn.execute(
            `UPDATE riq_sessions SET checkoutAt = NOW(), contactEmail = ?, contactName = ? WHERE sessionId = ?`,
            [dbUser?.email || null, dbUser?.name || null, sessionId]
          ).catch(() => {});
          await conn.end();
        }
      } else if (session.parsedData?.email) {
        // Guest — use email from parsedData
        const conn = await getDb();
        if (conn) {
          await conn.execute(
            `UPDATE riq_sessions SET checkoutAt = NOW(), contactEmail = ?, contactName = ? WHERE sessionId = ?`,
            [session.parsedData.email, session.parsedData.name || null, sessionId]
          ).catch(() => {});
          await conn.end();
        }
      }

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
        if (tokenUser) {
          await upgradeToStarter(tokenUser.userId);
          notifyPurchase(tokenUser.email, "", "Starter — 3 transformations", "$14.99").catch(() => {});
        }

      } else if (type === "monthly") {
        const session = await getSession(resumeiqSession);
        if (session) await updateSessionPaid(resumeiqSession);
        if (tokenUser) {
          await upgradeToMonthly(tokenUser.userId, 30);
          notifyPurchase(tokenUser.email, "", "Monthly — 30 days unlimited", "$19.99").catch(() => {});
        }

      } else if (type === "personality") {
        const session = await getSession(resumeiqSession);
        if (session) await updateSessionPaid(resumeiqSession);
        if (tokenUser) {
          const pendingWWM = req.body.workingWithMe;
          if (pendingWWM) await unlockPersonality(tokenUser.userId, pendingWWM);
          else await unlockPersonality(tokenUser.userId, {});
          notifyPurchase(tokenUser.email, "", "Working With Me unlock", "$7.99").catch(() => {});
        }

      } else if (type === "career") {
        const session = await getSession(resumeiqSession);
        if (session) await updateSessionPaid(resumeiqSession);
        freeUsedByIp.set(ip, (freeUsedByIp.get(ip) || 0) + 1);
        if (tokenUser) {
          await upgradeToMonthly(tokenUser.userId, 60);
          const pendingWWM = req.body.workingWithMe;
          if (pendingWWM) await unlockPersonality(tokenUser.userId, pendingWWM);
          else await unlockPersonality(tokenUser.userId, {});
          notifyPurchase(tokenUser.email, "", "Career Launch Bundle — 60 days + WWM + MyCareerIQ", "$79.99").catch(() => {});
        }
      }

      res.json({ paid: true, type });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Webhook upgrade logic exported for use by index.ts webhook handler
  // (webhook route must be before express.json() to get raw body)


  // ── ENRICHMENT PASS — targeted enhancement with qualifying answers ──────────
  // Accepts user answers to qualifying questions and re-runs the summary +
  // targeted bullet enhancement without a full re-parse. Fast and cheap.
  app.post("/api/resumeiq/enrich", async (req: Request, res: Response) => {
    try {
      const { parsedData, enrichmentAnswers } = req.body;
      if (!parsedData) { res.status(400).json({ error: "No parsed data" }); return; }

      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) { res.status(500).json({ error: "OpenAI not configured" }); return; }

      const { targetRole, careerHighlight, transitionContext } = enrichmentAnswers || {};

      // Only re-run if there's actually something to enrich
      const hasEnrichment = (targetRole && targetRole.trim()) ||
                            (careerHighlight && careerHighlight.trim()) ||
                            (transitionContext && transitionContext.trim());

      if (!hasEnrichment) {
        res.json({ ...parsedData, enriched: false });
        return;
      }

      const enrichContext = [
        targetRole ? `Target role: ${targetRole}` : "",
        careerHighlight ? `Key achievement not on resume: ${careerHighlight}` : "",
        transitionContext ? `Career transition context: ${transitionContext}` : "",
      ].filter(Boolean).join("\n");

      const enrichRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiApiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 600,
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content: `You are an elite resume writer. Given a candidate's parsed resume and enrichment context provided directly by the candidate, improve ONLY the summary and (if relevant) the first bullet of the most recent role. Return JSON with ONLY these two fields: { "summary": "improved summary string", "highlightBullet": "improved first bullet or null" }. The summary must incorporate the enrichment context naturally. Never fabricate facts not in the resume or enrichment context. Return JSON only, no markdown.`
            },
            {
              role: "user",
              content: `Resume summary: ${parsedData.summary}
Most recent role first bullet: ${parsedData.experience?.[0]?.bullets?.[0] || "none"}
Candidate name: ${parsedData.name}

Enrichment context provided by candidate:
${enrichContext}

Return improved summary and first bullet JSON only.`
            }
          ]
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!enrichRes.ok) { res.json({ ...parsedData, enriched: false }); return; }

      const enrichData = await enrichRes.json() as any;
      const raw = (enrichData.choices?.[0]?.message?.content || "").trim()
        .replace(/^```json?\s*/i, "").replace(/```\s*$/i, "");

      try {
        const improved = JSON.parse(raw);
        const enrichedData = { ...parsedData };
        if (improved.summary) enrichedData.summary = improved.summary;
        if (improved.highlightBullet && enrichedData.experience?.[0]?.bullets?.length > 0) {
          enrichedData.experience[0].bullets[0] = improved.highlightBullet;
        }
        res.json({ ...enrichedData, enriched: true });
      } catch {
        res.json({ ...parsedData, enriched: false });
      }
    } catch (err: any) {
      console.error("[ResumeIQ] Enrich error:", err.message);
      res.json({ ...req.body.parsedData, enriched: false });
    }
  });

  // ── VALIDATION PASS — skeptical hiring manager review ───────────────────────
  // Reads the enriched output and returns specific, actionable flags.
  // Never blocks download — surfaced as inline suggestions on preview.
  app.post("/api/resumeiq/validate", async (req: Request, res: Response) => {
    try {
      const { parsedData } = req.body;
      if (!parsedData) { res.status(400).json({ error: "No parsed data" }); return; }

      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) { res.status(500).json({ flags: [] }); return; }

      const resumeSummary = {
        name: parsedData.name,
        summary: parsedData.summary,
        experience: (parsedData.experience || []).slice(0, 3).map((e: any) => ({
          title: e.title, company: e.company,
          firstBullet: e.bullets?.[0] || "",
          bulletCount: e.bullets?.length || 0,
        })),
        skills: parsedData.skills,
      };

      const validationRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiApiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 400,
          temperature: 0,
          messages: [
            {
              role: "system",
              content: `You are a skeptical hiring manager reviewing a resume. Find 1-3 specific, actionable issues that would make you hesitate. Be concrete — cite specific text from the resume, not generic advice. Each flag must be specific to THIS resume. Return JSON only: { "flags": [{ "type": "summary"|"bullet"|"skill"|"structure", "severity": "high"|"medium", "issue": "specific problem in 1 sentence", "suggestion": "specific fix in 1 sentence" }] }. Maximum 3 flags. If the resume is genuinely strong, return fewer or no flags.`
            },
            {
              role: "user",
              content: `Review this resume:\n${JSON.stringify(resumeSummary)}`
            }
          ]
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (!validationRes.ok) { res.json({ flags: [] }); return; }
      const validationData = await validationRes.json() as any;
      const raw = (validationData.choices?.[0]?.message?.content || "").trim()
        .replace(/^```json?\s*/i, "").replace(/```\s*$/i, "");

      try {
        const result = JSON.parse(raw);
        res.json({ flags: result.flags || [] });
      } catch {
        res.json({ flags: [] });
      }
    } catch (err: any) {
      console.error("[ResumeIQ] Validate error:", err.message);
      res.json({ flags: [] });
    }
  });

  app.post("/api/resumeiq/generate", async (req: Request, res: Response) => {
    try {
      const { sessionId, parsedData: clientData, scoreFlags } = req.body;

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
        const genPlan = dbUser?.plan || "free";
        const genPlanExpiry = dbUser?.planExpiresAt ? new Date(dbUser.planExpiresAt) : null;
        const genPlanActive = !genPlanExpiry || genPlanExpiry > new Date();
        const genHasWWM = dbUser?.personalityUnlocked ||
          ((genPlan === "monthly" || genPlan === "agency") && genPlanActive) ||
          genPlan === "starter";
        if (genHasWWM && dbUser?.workingWithMeData) {
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

      // Always run enhancement pass — improves narrative, fixes typos, elevates bullets
      const enhancedData = await applyScoreFlags(data, scoreFlags || null);

      const buffer = await generateDocx(enhancedData, scoreFlags);
      const docxBase64 = buffer.toString("base64");

      // ── Save to DB if logged in ───────────────────────────────────
      if (tokenUser) {
        try {
          // Extract pre-transform overall score from scoreFlags
          const preScore = scoreFlags
            ? Math.round(Object.values(scoreFlags).reduce((sum: number, d: any) => sum + (d.score || 0), 0) / Object.keys(scoreFlags).length)
            : null;

          const resumeId = await saveResume(
            tokenUser.userId,
            data.name ? `${data.name}_ResumeIQ.docx` : "ResumeIQ.docx",
            data.name || "Resume",
            data,
            docxBase64,
            session.paid,
            undefined,
            preScore || undefined,
            undefined,
            scoreFlags || undefined,
            data._originalKey || undefined,
          );
          await incrementResumeCount(tokenUser.userId);
          console.log(`[ResumeIQ] Saved resume ${resumeId} for user ${tokenUser.userId} (preScore: ${preScore})`);

          // Fire post-transform score in background and update record
          scoreResume(enhancedData).then(async (postScoreData: any) => {
            if (postScoreData?.overall) {
              try {
                const conn = await getDb();
                if (conn) {
                  await conn.execute(
                    `UPDATE riq_resumes SET postScore = ?, scoreDimensions = ? WHERE id = ?`,
                    [postScoreData.overall, JSON.stringify(postScoreData.dimensions || {}), resumeId]
                  );
                  await conn.end();
                  console.log(`[ResumeIQ] postScore saved: ${postScoreData.overall} for resume ${resumeId}`);
                }
              } catch (err: any) {
                console.error(`[ResumeIQ] postScore DB save failed for resume ${resumeId}:`, err.message);
              }
            } else {
              console.warn(`[ResumeIQ] scoreResume returned null/no overall for resume ${resumeId}`);
            }
          }).catch((err: any) => {
            console.error(`[ResumeIQ] scoreResume background job failed for resume ${resumeId}:`, err.message);
          });
        } catch (saveErr) {
          console.error("[ResumeIQ] Failed to save resume to DB:", saveErr);
        }
      }

      // Remove session after successful generation
      await deleteSession(sessionId);

      // Fire post-conversion email with DOCX attachment (non-blocking)
      if (tokenUser?.email) {
        const docxBase64ForEmail = buffer.toString("base64");
        const emailFileName = `${(data.name || "Resume").replace(/[^a-zA-Z0-9_-]/g, "_")}_ResumeIQ.docx`;
        alreadySent(null as any, tokenUser.email, "post_conversion")
          .then(async (sent) => {
            if (sent) return;
            const { getDb } = await import("./authService");
            const emailConn = await getDb();
            if (!emailConn) return;
            try {
              await logEmailSend(emailConn, tokenUser.email, "post_conversion");
              sendEmail(tokenUser.email, "post_conversion", {
                filename: emailFileName,
                content: docxBase64ForEmail,
              }).catch(() => {});
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
  // ── LATEST SCORE — polled from done screen to get postScore ───────────────
  app.get("/api/resumeiq/latest-score", async (req: Request, res: Response) => {
    const tokenUser = getTokenUser(req);
    if (!tokenUser) { res.status(401).json({ error: "Unauthorized" }); return; }
    try {
      const conn = await getDb();
      if (!conn) { res.json({ postScore: null }); return; }
      const [rows] = await conn.execute(
        `SELECT id, preScore, postScore, scoreDimensions FROM riq_resumes WHERE userId = ? ORDER BY createdAt DESC LIMIT 1`,
        [tokenUser.userId]
      ) as any;
      await conn.end();
      const data = Array.isArray(rows[0]) ? rows[0] : rows;
      const resume = data[0];
      if (!resume) { res.json({ postScore: null }); return; }
      
      let scoreDimensions = null;
      try {
        if (resume.scoreDimensions) {
          scoreDimensions = typeof resume.scoreDimensions === "string"
            ? JSON.parse(resume.scoreDimensions)
            : resume.scoreDimensions;
        }
      } catch { scoreDimensions = null; }

      res.json({
        resumeId: resume.id,
        preScore: resume.preScore || null,
        postScore: resume.postScore || null,
        scoreDimensions,
      });
    } catch (err: any) {
      console.error("[ResumeIQ] latest-score error:", err.message);
      res.json({ postScore: null }); // never 500 — just return null
    }
  });

  // ── DELETE RESUME ─────────────────────────────────────────────────────────
  app.delete("/api/resumeiq/resume/:id", async (req: Request, res: Response) => {
    const tokenUser = getTokenUser(req);
    if (!tokenUser) { res.status(401).json({ error: "Unauthorized" }); return; }
    try {
      const resumeId = parseInt(req.params.id);
      const conn = await getDb();
      if (!conn) { res.status(500).json({ error: "DB unavailable" }); return; }
      // Only delete if it belongs to this user
      const [result] = await conn.execute(
        "DELETE FROM riq_resumes WHERE id = ? AND userId = ?",
        [resumeId, tokenUser.userId]
      ) as any;
      await conn.end();
      if (result.affectedRows === 0) {
        res.status(404).json({ error: "Resume not found" }); return;
      }
      console.log(`[ResumeIQ] Resume ${resumeId} deleted by user ${tokenUser.userId}`);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
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
             SUM(CASE WHEN paid = 1 THEN 14.99 ELSE 0 END) AS revenue
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
             SUM(CASE WHEN paid = 1 THEN 14.99 ELSE 0 END) AS totalRevenue,
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

      // abandoned_checkout — every 15 minutes: fire 1 hour after checkout initiated, no payment
      cronLib.default.schedule("*/15 * * * *", async () => {
        const conn = await getDb();
        if (!conn) return;
        try {
          const [rows] = await conn.execute(`
            SELECT sessionId, contactEmail, contactName
            FROM riq_sessions
            WHERE checkoutAt IS NOT NULL
              AND checkoutAt < DATE_SUB(NOW(), INTERVAL 1 HOUR)
              AND paid = 0
              AND checkoutRecoverySent = 0
              AND contactEmail IS NOT NULL
              AND expiresAt > NOW()
            LIMIT 25
          `) as any;
          const data = Array.isArray(rows[0]) ? rows[0] : rows;
          for (const row of data) {
            await conn.execute(
              `UPDATE riq_sessions SET checkoutRecoverySent = 1 WHERE sessionId = ?`,
              [row.sessionId]
            );
            sendEmail(row.contactEmail, "abandoned_checkout").catch(() => {});
            console.log(`[Cron] abandoned_checkout → ${row.contactEmail}`);
          }
          if (data.length) console.log(`[Cron] abandoned_checkout: ${data.length} recovery emails sent`);
        } catch (err: any) {
          console.error("[Cron] abandoned_checkout error:", err.message);
        } finally { await conn.end(); }
      });
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
      const teaserFields = ["communicationStyle", "motivation"];

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
  // Career Launch Bundle checkout
  app.post("/api/resumeiq/career-checkout", async (req: Request, res: Response) => {
    try {
      const { resumeiqSession } = req.body;
      const origin = req.headers.origin as string || "https://resumeiq.reviveiqi.com";
      const successUrl = `${origin}/app?payment=success&`;
      const cancelUrl = `${origin}/app`;
      const result = await createCareerLaunchSession(successUrl, cancelUrl, resumeiqSession);
      res.json({ url: result.url });
    } catch (error: any) {
      console.error("[ResumeIQ] Career checkout error:", error);
      res.status(500).json({ error: error.message });
    }
  });

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


  // ── ResumeIQ → MyCareerIQ SSO handoff token generator ────────────────────
  // Called from done screen. Returns a short-lived token MyCareerIQ can use
  // to auto-login the user and pre-load their resume.
  app.post("/api/resumeiq/auth/mycareeriq-handoff", async (req: Request, res: Response) => {
    try {
      const tokenUser = getTokenUser(req);
      if (!tokenUser) { res.status(401).json({ error: "Unauthorized" }); return; }

      const user = await getUserById(tokenUser.userId);
      if (!user) { res.status(404).json({ error: "User not found" }); return; }

      // Get their most recent resume R2 key
      const resumes = await getUserResumes(tokenUser.userId);
      const latestResume = resumes?.[0];
      const resumeKey = latestResume?.originalFileUrl || null;
      const resumeDocxKey = latestResume ? `resumeiq/${tokenUser.userId}/${latestResume.id}/transformed.docx` : null;

      const secret = process.env.CROSS_APP_SECRET || process.env.JWT_SECRET || "cross-app-secret";
      const payload = JSON.stringify({
        email: user.email,
        name: user.name || "",
        resumeKey,
        resumeDocxKey,
        source: "resumeiq",
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minute window
      });
      const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
      const token = Buffer.from(JSON.stringify({ payload, sig })).toString("base64url");

      res.json({ token, email: user.email, name: user.name });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Cross-app SSO handoff ─────────────────────────────────────────────────
  // Accepts a short-lived token from MyCareerIQ, verifies it, finds or creates
  // the user in ResumeIQ's DB, and returns a riq_token for auto-login.
  // Frontend calls this on /app load when ?handoff= param is present.
  app.post("/api/resumeiq/auth/handoff", async (req: Request, res: Response) => {
    const { token: crossToken } = req.body;
    if (!crossToken) { res.status(400).json({ error: "Missing token" }); return; }

    try {
      const secret = process.env.CROSS_APP_SECRET || process.env.JWT_SECRET || "cross-app-secret";
      const decoded = JSON.parse(Buffer.from(crossToken, "base64url").toString("utf-8"));
      const { payload: payloadStr, sig } = decoded;

      // Verify signature
      const expectedSig = crypto.createHmac("sha256", secret).update(payloadStr).digest("hex");
      if (sig !== expectedSig) {
        console.warn("[CrossApp] Invalid signature on handoff token");
        res.status(401).json({ error: "Invalid token" });
        return;
      }

      const payload = JSON.parse(payloadStr);

      // Check expiry
      if (Date.now() > payload.expiresAt) {
        console.warn("[CrossApp] Expired handoff token");
        res.status(401).json({ error: "Token expired" });
        return;
      }

      const { email, name } = payload;
      if (!email) { res.status(400).json({ error: "No email in token" }); return; }

      // Find or create ResumeIQ user
      const authService = await import("./authService");
      const conn = await authService.getDb();
      if (!conn) { res.status(500).json({ error: "Database unavailable" }); return; }

      let user: any = null;
      try {
        const [rows] = await conn.execute(
          "SELECT id, email, name, plan, resumeCount FROM riq_users WHERE email = ?",
          [email]
        ) as any;
        user = rows[0] || null;
      } finally {
        await conn.end();
      }

      if (!user) {
        // Create account — no password needed (SSO user)
        const randomPassword = crypto.randomBytes(32).toString("hex");
        user = await authService.createUser(email, randomPassword, name || email.split("@")[0]);
        // LinkedIn-verified email — mark as verified immediately
        await authService.setVerifyToken(user.id, "");
        const conn = await authService.getDb();
        if (conn) { await conn.execute("UPDATE riq_users SET emailVerified = 1, verifyToken = NULL WHERE id = ?", [user.id]); await conn.end(); }
        console.log(`[CrossApp] Created ResumeIQ account for ${email} via SSO (auto-verified)`);
        import("./nurtureEmail").then(({ sendWelcomeEmail }) => sendWelcomeEmail(email, name || "")).catch(() => {});
        notifyNewUser(email, name || "").catch(() => {});
      } else {
        console.log(`[CrossApp] SSO login for existing user ${email}`);
      }

      if (!user) { res.status(500).json({ error: "Failed to create account" }); return; }

      const riqToken = authService.generateToken(user.id, user.email);
      // Fetch fresh user to get correct emailVerified state
      const freshUser = await authService.getUserById(user.id);
      res.json({
        token: riqToken,
        user: { id: user.id, email: user.email, name: user.name, plan: user.plan, resumeCount: user.resumeCount || 0, emailVerified: freshUser?.emailVerified || false },
        isNew: !rows?.[0],
      });
    } catch (err) {
      console.error("[CrossApp] Handoff failed:", err);
      res.status(500).json({ error: "Handoff failed" });
    }
  });

  // ── Account deletion ────────────────────────────────────────────────────────
  // GDPR/CCPA right to erasure — deletes user account and all associated data
  app.delete("/api/resumeiq/account", async (req: Request, res: Response) => {
    try {
      const tokenUser = getTokenUser(req);
      if (!tokenUser) { res.status(401).json({ error: "Not authenticated" }); return; }

      const conn = await getDbConnection();
      if (!conn) { res.status(500).json({ error: "Database unavailable" }); return; }

      try {
        // Delete all user data in order (FK constraints)
        await conn.execute("DELETE FROM riq_sessions WHERE userId = ?", [tokenUser.userId]);
        await conn.execute("DELETE FROM riq_resumes WHERE userId = ?", [tokenUser.userId]);
        await conn.execute("DELETE FROM riq_users WHERE id = ?", [tokenUser.userId]);
        console.log(`[ResumeIQ] Account deleted for userId ${tokenUser.userId}`);
      } finally {
        await conn.end();
      }

      res.json({ success: true, message: "Account and all associated data deleted." });
    } catch (err) {
      console.error("[ResumeIQ] Account deletion failed:", err);
      res.status(500).json({ error: "Deletion failed — contact bryan@reviveiqi.com" });
    }
  });

  // ── LinkedIn OAuth ─────────────────────────────────────────────────────────
  // GET /api/resumeiq/auth/linkedin — redirect to LinkedIn
  app.get("/api/resumeiq/auth/linkedin", (req: Request, res: Response) => {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    if (!clientId) {
      res.status(500).json({ error: "LinkedIn OAuth not configured" });
      return;
    }
    const redirectUri = "https://resumeiq.reviveiqi.com/api/auth/linkedin/callback";
    const scope = "openid profile email";
    const state = crypto.randomBytes(16).toString("hex");

    res.cookie("riq_linkedin_state", state, {
      httpOnly: true,
      secure: true,
      maxAge: 10 * 60 * 1000,
      sameSite: "lax",
    });

    const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("state", state);

    res.redirect(authUrl.toString());
  });

  // GET /api/resumeiq/auth/linkedin/callback — handle callback
  app.get("/api/auth/linkedin/callback", async (req: Request, res: Response) => {
    const { code, state, error } = req.query as Record<string, string>;
    const frontendUrl = "https://resumeiq.reviveiqi.com";

    if (error) {
      res.redirect(`${frontendUrl}/app?auth_error=linkedin_denied`);
      return;
    }

    // Validate state
    const cookieHeader = req.headers.cookie || "";
    const cookies: Record<string, string> = {};
    cookieHeader.split(";").forEach((c) => {
      const [k, ...v] = c.trim().split("=");
      if (k) cookies[k.trim()] = decodeURIComponent(v.join("="));
    });

    if (!state || cookies["riq_linkedin_state"] !== state) {
      res.redirect(`${frontendUrl}/app?auth_error=state_mismatch`);
      return;
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID!;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET!;
    const redirectUri = "https://resumeiq.reviveiqi.com/api/auth/linkedin/callback";

    try {
      // Exchange code for token
      const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }).toString(),
      });

      if (!tokenRes.ok) {
        res.redirect(`${frontendUrl}/app?auth_error=token_failed`);
        return;
      }

      const tokenData = await tokenRes.json() as any;
      const accessToken = tokenData.access_token;

      // Get profile
      const userRes = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!userRes.ok) {
        res.redirect(`${frontendUrl}/app?auth_error=profile_failed`);
        return;
      }

      const profile = await userRes.json() as any;
      const email = profile.email;
      const name = profile.name || `${profile.given_name || ""} ${profile.family_name || ""}`.trim();
      const picture = profile.picture || "";
      // LinkedIn sub is the unique user ID — construct a best-effort profile URL
      // Note: LinkedIn OpenID doesn't return vanity URL, only sub (numeric/alphanumeric ID)
      // We store name+email so the resume can be pre-populated on login

      if (!email) {
        res.redirect(`${frontendUrl}/app?auth_error=no_email`);
        return;
      }

      // Find or create user using actual authService API
      const authService = await import("./authService");
      const conn = await authService.getDb();
      if (!conn) {
        res.redirect(`${frontendUrl}/app?auth_error=server_error`);
        return;
      }

      let user: any = null;
      try {
        const [rows] = await conn.execute(
          "SELECT id, email, name, plan, resumeCount FROM riq_users WHERE email = ?",
          [email]
        ) as any;
        user = rows[0] || null;
      } finally {
        await conn.end();
      }

      if (!user) {
        const randomPassword = crypto.randomBytes(32).toString("hex");
        user = await authService.createUser(email, randomPassword, name || email.split("@")[0]);
        // LinkedIn-verified email — auto-verify immediately
        const verifyConn = await authService.getDb();
        if (verifyConn) {
          await verifyConn.execute("UPDATE riq_users SET emailVerified = 1, verifyToken = NULL WHERE id = ?", [user.id]);
          await verifyConn.end();
        }
        console.log(`[ResumeIQ LinkedIn] Created new user: ${email} (auto-verified)`);
        import("./nurtureEmail").then(({ sendWelcomeEmail }) => sendWelcomeEmail(email, name || "")).catch(() => {});
        notifyNewUser(email, name || "").catch(() => {});
      } else {
        // Existing user — ensure emailVerified if they came through LinkedIn
        if (!user.emailVerified) {
          const verifyConn = await authService.getDb();
          if (verifyConn) {
            await verifyConn.execute("UPDATE riq_users SET emailVerified = 1 WHERE id = ?", [user.id]);
            await verifyConn.end();
            user.emailVerified = true;
          }
        }
        console.log(`[ResumeIQ LinkedIn] Existing user: ${email}`);
      }

      if (!user) {
        res.redirect(`${frontendUrl}/app?auth_error=server_error`);
        return;
      }

      const token = authService.generateToken(user.id, user.email);
      res.clearCookie("riq_linkedin_state");
      const params = new URLSearchParams({
        linkedin_token: token,
        linkedin_name: name,
        linkedin_email: email,
        linkedin_verified: "1",
      });
      res.redirect(`${frontendUrl}/app?${params.toString()}`);
    } catch (err) {
      console.error("[ResumeIQ LinkedIn] Callback error:", err);
      res.redirect(`${frontendUrl}/app?auth_error=server_error`);
    }
  });


}



// ── Stripe webhook upgrade handler (called from index.ts before express.json) ─
export async function handleWebhookUpgrade(type: string, customerEmail: string): Promise<void> {
  if (!customerEmail) return;
  const { getUserByEmail, upgradeToStarter, upgradeToMonthly, unlockPersonality } = await import("./authService");
  const user = await getUserByEmail(customerEmail);
  if (!user) {
    console.warn(`[Webhook] No user found for email: ${customerEmail}`);
    return;
  }
  if (type === "resume") {
    await upgradeToStarter(user.id);
    console.log(`[Webhook] ✅ ${customerEmail} upgraded to starter`);
  } else if (type === "monthly") {
    await upgradeToMonthly(user.id, 30);
    console.log(`[Webhook] ✅ ${customerEmail} upgraded to monthly`);
  } else if (type === "career") {
    await upgradeToMonthly(user.id, 60);
    await unlockPersonality(user.id, {});
    console.log(`[Webhook] ✅ ${customerEmail} upgraded to career launch`);
  } else if (type === "personality") {
    await unlockPersonality(user.id, {});
    console.log(`[Webhook] ✅ ${customerEmail} personality unlocked`);
  }
}
