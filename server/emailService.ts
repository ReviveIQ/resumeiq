/**
 * ResumeIQ Email Service
 * Powered by Resend — wire RESEND_API_KEY in Railway env vars
 * Three automated flows:
 *   1. welcome          — fires on account creation
 *   2. abandoned_1h     — uploaded resume, no checkout after 1h
 *   3. reengagement_24h — uploaded, never downloaded after 24h
 *   4. post_conversion  — resume downloaded, upsell to Job Pipeline
 */

const SITE    = "https://resumeiq.reviveiqi.com";
const PIPELINE = "https://mycareeriq.reviveiqi.com";
const FROM    = "Bryan @ ResumeIQ <bryan@resumeiq.reviveiqi.com>";

// ── Send via Resend ────────────────────────────────────────────────────────
export async function sendEmail(to: string, flowType: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[Email] RESEND_API_KEY not set — skipping email send");
    return;
  }

  const templateFn = EMAIL_TEMPLATES[flowType];
  if (!templateFn) throw new Error(`Unknown email flow: ${flowType}`);
  const payload = templateFn(to);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[Email] Resend error (${flowType} → ${to}):`, err);
      return;
    }
    const data = await res.json() as any;
    console.log(`[Email] ${flowType} → ${to} (${data.id})`);
  } catch (err: any) {
    console.error("[Email] Send failed:", err.message);
  }
}

// ── Log email send to TiDB ─────────────────────────────────────────────────
export async function logEmailSend(conn: any, email: string, flowType: string): Promise<void> {
  try {
    await conn.execute(
      `INSERT INTO riq_email_sends (email, flowType) VALUES (?, ?)`,
      [email, flowType]
    );
  } catch { /* non-fatal */ }
}

// ── Check if email already sent this flow ──────────────────────────────────
export async function alreadySent(conn: any, email: string, flowType: string): Promise<boolean> {
  try {
    const [rows] = await conn.execute(
      `SELECT id FROM riq_email_sends WHERE email = ? AND flowType = ? LIMIT 1`,
      [email, flowType]
    ) as any;
    return rows.length > 0;
  } catch { return false; }
}

// ── Email Templates ────────────────────────────────────────────────────────
const EMAIL_TEMPLATES: Record<string, (email: string) => object> = {

  welcome: (email) => ({
    from: FROM, to: [email],
    subject: "Your ResumeIQ account is ready",
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
      <h2 style="font-size:22px;font-weight:600;margin-bottom:8px">Welcome to ResumeIQ.</h2>
      <p style="color:#555;line-height:1.6">You can now re-download your resume anytime from your account history — no need to upload again.</p>
      <a href="${SITE}/app?utm_source=email&utm_medium=welcome&utm_campaign=onboarding"
         style="display:inline-block;margin:24px 0;padding:12px 28px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:500">
        Go to my account →
      </a>
      <p style="color:#555;line-height:1.6;font-size:14px">Also worth knowing — once your resume is sharp, you can feed it directly into our <a href="${PIPELINE}" style="color:#2563eb">Job Search Pipeline</a> to start applying to roles immediately.</p>
      <p style="font-size:13px;color:#888;margin-top:32px">— Bryan, ResumeIQ founder</p>
    </div>`,
  }),

  abandoned_1h: (email) => ({
    from: FROM, to: [email],
    subject: "Your resume is still waiting",
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
      <h2 style="font-size:22px;font-weight:600;margin-bottom:8px">You were close.</h2>
      <p style="color:#555;line-height:1.6">You uploaded your resume but didn't finish the upgrade. Most resumes fail ATS filters before a human ever sees them — yours could be next.</p>
      <a href="${SITE}/app?utm_source=email&utm_medium=abandoned&utm_campaign=1h_recovery"
         style="display:inline-block;margin:24px 0;padding:12px 28px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:8px;font-weight:500">
        Finish my resume upgrade →
      </a>
      <p style="font-size:13px;color:#888;margin-top:32px">— Bryan, ResumeIQ founder</p>
    </div>`,
  }),

  reengagement_24h: (email) => ({
    from: FROM, to: [email],
    subject: "Most resumes fail for the same 3 reasons",
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
      <h2 style="font-size:22px;font-weight:600;margin-bottom:8px">3 reasons your resume isn't landing interviews</h2>
      <ol style="color:#333;line-height:2;padding-left:20px">
        <li>No measurable impact — "managed accounts" vs "managed 42 accounts, $3.1M ARR"</li>
        <li>Formatting that breaks ATS parsing (tables, columns, graphics)</li>
        <li>Vague job descriptions that don't match recruiter keywords</li>
      </ol>
      <a href="${SITE}/app?utm_source=email&utm_medium=reengagement&utm_campaign=24h"
         style="display:inline-block;margin:24px 0;padding:12px 28px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:8px;font-weight:500">
        Fix my resume now →
      </a>
      <p style="font-size:13px;color:#888;margin-top:32px">— Bryan, ResumeIQ</p>
    </div>`,
  }),

  post_conversion: (email) => ({
    from: FROM, to: [email],
    subject: "Your resume is ATS-optimized ✓ — ready to apply?",
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
      <h2 style="font-size:22px;font-weight:600;margin-bottom:8px">You are ready to apply.</h2>
      <ul style="color:#333;line-height:2;padding-left:20px">
        <li>Impact metrics added to every bullet</li>
        <li>Formatting restructured for clean ATS parsing</li>
        <li>Keywords aligned to job description patterns</li>
      </ul>
      <p style="color:#555;line-height:1.6;margin-top:16px">Next step — put your resume to work. The <strong>Job Search Pipeline</strong> lets you track applications, generate cover letters, and manage outreach all in one place.</p>
      <a href="${PIPELINE}?utm_source=email&utm_medium=post_conversion&utm_campaign=pipeline_upsell"
         style="display:inline-block;margin:16px 0 8px;padding:12px 28px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:500">
        Start my job search →
      </a>
      <br/>
      <a href="${SITE}/app?utm_source=email&utm_medium=post_conversion&utm_campaign=linkedin_share"
         style="display:inline-block;margin:8px 0;padding:10px 24px;background:#0077b5;color:#fff;text-decoration:none;border-radius:8px;font-weight:500;font-size:14px">
        Share on LinkedIn
      </a>
      <p style="font-size:13px;color:#888;margin-top:32px">— Bryan, ResumeIQ</p>
    </div>`,
  }),

};
