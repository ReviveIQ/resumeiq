/**
 * ResumeIQ Nurture Email Sequence
 *
 * Segment A — resumeCount >= 1 (used free, hasn't upgraded)
 *   Day 1  — score improvement (or score invite if no scores yet)
 *   Day 3  — educational: why strong candidates still don't get callbacks
 *   Day 7  — upgrade nudge: one question
 *   Day 14 — final: last one from me
 *   Day 30 — check-in: hoping you already found it
 *
 * Segment B — resumeCount = 0 (registered, never transformed)
 *   Day 1  — free transform waiting
 *   Day 3  — educational: most resumes fail before anyone reads them
 *   Day 7  — final nudge: honest question
 *   Day 30 — check-in: hoping you already found it
 *
 * Cron: runs daily at 9am EST
 * Dedup: tracks sent emails in riq_nurture_sent table
 */

import { getDb } from "./authService";

const FROM = "Bryan <bryan@reviveiqi.com>";
const SITE = "https://resumeiq.reviveiqi.com";
const RESEND_API = "https://api.resend.com/emails";

// ── Email styles shared across all templates ──────────────────────────────────
const GEM_SVG = `<svg width="32" height="32" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#60a5fa"/><stop offset="100%" stop-color="#2563eb"/></linearGradient>
    <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#93c5fd"/><stop offset="100%" stop-color="#3b82f6"/></linearGradient>
    <linearGradient id="g3" x1="100%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#1d4ed8"/><stop offset="100%" stop-color="#1e3a5f"/></linearGradient>
  </defs>
  <polygon points="36,4 68,36 36,68 4,36" fill="url(#g3)" opacity="0.35"/>
  <polygon points="36,4 20,20 36,36 52,20" fill="url(#g2)" opacity="0.9"/>
  <polygon points="36,4 52,20 68,36 36,36" fill="url(#g1)" opacity="0.65"/>
  <polygon points="4,36 20,20 36,36 20,52" fill="url(#g1)" opacity="0.5"/>
  <polygon points="68,36 52,20 36,36 52,52" fill="url(#g2)" opacity="0.75"/>
  <polygon points="36,68 20,52 36,36 52,52" fill="url(#g3)" opacity="0.95"/>
  <circle cx="36" cy="36" r="6" fill="white" opacity="0.95"/>
  <circle cx="36" cy="36" r="3" fill="#93c5fd"/>
</svg>`;

const HEADER = `
  <div style="background:#080f1e;padding:22px 32px;display:flex;align-items:center;gap:14px">
    ${GEM_SVG}
    <div>
      <p style="margin:0;font-size:16px;font-weight:700;color:white;letter-spacing:-0.02em;font-family:sans-serif">Resume<span style="color:#60a5fa">IQ</span></p>
      <p style="margin:0;font-size:11px;color:#64748b;font-family:sans-serif">by ReviveIQI</p>
    </div>
  </div>`;

const FOOTER = `
  <div style="padding:16px 32px;border-top:1px solid #e5e7eb;background:#f9fafb">
    <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;font-family:sans-serif">
      ResumeIQ by ReviveIQI &nbsp;·&nbsp; Fort Lauderdale, FL<br>
      You're receiving this because you created a ResumeIQ account.
      &nbsp;·&nbsp; <a href="${SITE}/unsubscribe?email={{EMAIL}}" style="color:#9ca3af">Unsubscribe</a>
    </p>
  </div>`;

const WRAP = (content: string, email: string) => `
  <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
    ${HEADER}
    <div style="padding:28px 32px">${content}</div>
    ${FOOTER.replace("{{EMAIL}}", encodeURIComponent(email))}
  </div>`;

const CTA = (text: string, url: string) =>
  `<div style="margin:24px 0">
    <a href="${url}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:8px;font-size:14px;font-weight:500;font-family:sans-serif">${text}</a>
  </div>`;

const P = (text: string) =>
  `<p style="margin:0 0 16px;font-size:15px;color:#111827;line-height:1.75;font-family:sans-serif">${text}</p>`;

const SIGN = `<p style="margin:0 0 4px;font-size:15px;color:#111827;font-family:sans-serif">Rooting for you,</p>
<p style="margin:0;font-size:15px;font-weight:700;color:#111827;font-family:sans-serif">Bryan</p>`;

// ── Templates ─────────────────────────────────────────────────────────────────

function emailA1WithScores(firstName: string, email: string, preScore: number, postScore: number): { subject: string; html: string } {
  const improvement = postScore - preScore;
  const scoreStrip = `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;display:flex;align-items:center;gap:20px;margin-bottom:24px">
      <div style="text-align:center">
        <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;font-family:sans-serif">Before</p>
        <p style="margin:0;font-size:26px;font-weight:700;color:#dc2626;line-height:1.2;font-family:sans-serif">${preScore}<span style="font-size:13px;font-weight:400">/10</span></p>
      </div>
      <div style="font-size:18px;color:#9ca3af">→</div>
      <div style="text-align:center">
        <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;font-family:sans-serif">After</p>
        <p style="margin:0;font-size:26px;font-weight:700;color:#16a34a;line-height:1.2;font-family:sans-serif">${postScore}<span style="font-size:13px;font-weight:400">/10</span></p>
      </div>
      <div style="flex:1;border-left:1px solid #bbf7d0;padding-left:16px">
        <p style="margin:0;font-size:13px;color:#15803d;font-weight:600;font-family:sans-serif">+${improvement} point improvement</p>
        <p style="margin:0;font-size:12px;color:#6b7280;margin-top:2px;font-family:sans-serif">Bullet quality, keywords, and ATS format</p>
      </div>
    </div>`;

  return {
    subject: "Your resume improved. Here's what that means.",
    html: WRAP(`
      ${P(`Hey ${firstName},`)}
      ${scoreStrip}
      ${P(`Your resume scored <strong style="color:#dc2626">${preScore}/10</strong> before we transformed it. After — <strong style="color:#16a34a">${postScore}/10</strong>.`)}
      ${P("That gap is the difference between getting filtered out and getting the call.")}
      ${P(`The most common fix we make: bullets that describe a job instead of proving one. <span style="color:#6b7280">"Managed accounts"</span> tells a recruiter nothing. <span style="color:#15803d">"Managed 28 enterprise accounts across a 4-state territory, delivering 118% of quota"</span> stops the scroll.`)}
      ${P("Your resume does that now. The question is whether the roles you're applying to know it.")}
      ${P("If you need another transform — for a different role, a new position, or just a fresher version — you're one upgrade away.")}
      ${CTA("Transform another resume →", `${SITE}?utm_source=email&utm_medium=nurture&utm_campaign=a1_score`)}
      ${SIGN}
    `, email),
  };
}

function emailA1NoScores(firstName: string, email: string): { subject: string; html: string } {
  return {
    subject: "Want to see how your resume actually scores?",
    html: WRAP(`
      ${P(`Hey ${firstName},`)}
      ${P("You've already transformed your resume with ResumeIQ. But did you know we now score every resume before and after transformation?")}
      ${P("4 dimensions: ATS format, bullet quality, keyword alignment, and completeness. Scored 1–10 each. You see exactly where your resume was weak and how much it improved.")}
      ${P("Run your resume through again and see your score. Takes 60 seconds. If you want to tune it further — the Starter pack gives you 3 more transforms.")}
      ${CTA("See my resume score →", `${SITE}?utm_source=email&utm_medium=nurture&utm_campaign=a1_noscore`)}
      ${SIGN}
    `, email),
  };
}

function emailA3(firstName: string, email: string): { subject: string; html: string } {
  return {
    subject: "Why strong candidates still don't get callbacks",
    html: WRAP(`
      ${P(`Hey ${firstName},`)}
      ${P("Here's something that doesn't get said enough: the job market isn't as broken as your LinkedIn feed suggests.")}
      ${P("What's broken is the filter layer between you and the hiring manager. 79% of resumes never make it past ATS. Not because the candidate isn't qualified — because the resume wasn't written for the system reading it first.")}
      ${P("You've already cleared that hurdle. Your resume is ATS-ready.")}
      ${P("The next hurdle is volume. Most job searches stall not because of the resume but because of the pipeline — not enough companies, not enough outreach, not enough follow-through.")}
      ${P("If you're sending applications and not hearing back, the resume probably isn't the problem anymore.")}
      ${P("Worth thinking about.")}
      <p style="margin:0;font-size:15px;color:#111827;font-family:sans-serif">— Bryan</p>
    `, email),
  };
}

function emailA7(firstName: string, email: string): { subject: string; html: string } {
  return {
    subject: "One question",
    html: WRAP(`
      ${P(`Hey ${firstName},`)}
      ${P("How's the search going?")}
      ${P("If you're targeting multiple roles or industries, each application deserves a resume tuned to it. Same story, different emphasis. Same bullets, different keywords.")}
      ${P("That's what the Starter pack is for — 3 transforms, no expiry, use them when you need them.")}
      ${P("$9.99. Less than a job board posting.")}
      ${CTA("Get 3 more transforms →", `${SITE}?utm_source=email&utm_medium=nurture&utm_campaign=a7_upgrade`)}
      ${SIGN}
    `, email),
  };
}

function emailA14(firstName: string, email: string): { subject: string; html: string } {
  return {
    subject: "Last one from me",
    html: WRAP(`
      ${P(`Hey ${firstName},`)}
      ${P("I won't keep filling your inbox. But I did want to check in one more time.")}
      ${P("If you're still in the search — a lot changes in two weeks. New roles open. Hiring managers shift. The resume that was right for last month's applications might need a small tune for this month's.")}
      ${P("If you're ready for another pass, it's here when you need it.")}
      ${CTA("Transform another resume →", `${SITE}?utm_source=email&utm_medium=nurture&utm_campaign=a14_final`)}
      <p style="margin:0 0 4px;font-size:15px;color:#111827;font-family:sans-serif">Wishing you the best,</p>
      <p style="margin:0;font-size:15px;font-weight:700;color:#111827;font-family:sans-serif">Bryan</p>
    `, email),
  };
}

function emailA30(firstName: string, email: string): { subject: string; html: string } {
  return {
    subject: "Hoping you already found it",
    html: WRAP(`
      ${P(`Hey ${firstName},`)}
      ${P("It's been about a month since you transformed your resume with ResumeIQ.")}
      ${P("I genuinely hope you already found your next role and this email is irrelevant. That's the best possible outcome.")}
      ${P("If you're still searching — that's okay too. The right opportunity takes time, and the right resume makes sure you're ready when it shows up.")}
      ${P("Your account is still here. If you want to re-transform for a new role, tune for a different industry, or just freshen things up — it's one click away.")}
      ${P("Either way, I'm rooting for you.")}
      <p style="margin:0;font-size:15px;color:#111827;font-family:sans-serif">— Bryan</p>
    `, email),
  };
}

function emailB1(firstName: string, email: string): { subject: string; html: string } {
  return {
    subject: "Your free resume transform is still here",
    html: WRAP(`
      ${P(`Hey ${firstName},`)}
      ${P("You created your ResumeIQ account but haven't run your first transform yet.")}
      ${P("It takes about 60 seconds. Upload your resume, we score it on 4 dimensions, you see exactly what's holding it back — then we fix it. ATS-optimized Word document, ready to download.")}
      ${P("First one is completely free.")}
      ${CTA("Transform my resume →", `${SITE}?utm_source=email&utm_medium=nurture&utm_campaign=b1_free`)}
      ${SIGN}
    `, email),
  };
}

function emailB3(firstName: string, email: string): { subject: string; html: string } {
  return {
    subject: "Most resumes fail before anyone reads them",
    html: WRAP(`
      ${P(`Hey ${firstName},`)}
      ${P("79% of resumes get filtered out by ATS software before a human ever sees them. Not because the candidate isn't qualified — because the resume wasn't built for the system reading it first.")}
      ${P("The three most common problems:")}
      <ol style="color:#111827;line-height:1.9;padding-left:20px;margin:0 0 16px;font-size:15px;font-family:sans-serif">
        <li>Bullets that describe a job instead of proving one</li>
        <li>Formatting that breaks ATS parsing — tables, columns, graphics</li>
        <li>Keywords that don't match what recruiters actually search for</li>
      </ol>
      ${P("ResumeIQ catches all three and fixes them automatically. First transform is on us.")}
      ${CTA("Fix my resume →", `${SITE}?utm_source=email&utm_medium=nurture&utm_campaign=b3_education`)}
      ${SIGN}
    `, email),
  };
}

function emailB7(firstName: string, email: string): { subject: string; html: string } {
  return {
    subject: "Honest question",
    html: WRAP(`
      ${P(`Hey ${firstName},`)}
      ${P("You signed up for ResumeIQ a week ago and haven't run your first transform.")}
      ${P("I'm not going to guess why — maybe you got busy, maybe you're not actively searching, maybe something felt unclear.")}
      ${P("If there's something in the way, reply to this email and tell me. I read every response.")}
      ${P("If you're ready — your free transform is waiting.")}
      ${CTA("Transform my resume →", `${SITE}?utm_source=email&utm_medium=nurture&utm_campaign=b7_final`)}
      ${SIGN}
    `, email),
  };
}

function emailB30(firstName: string, email: string): { subject: string; html: string } {
  return {
    subject: "Hoping you already found it",
    html: WRAP(`
      ${P(`Hey ${firstName},`)}
      ${P("It's been about a month since you created your ResumeIQ account.")}
      ${P("I hope the search is going well — or better yet, that it's already over and you landed exactly where you wanted to be.")}
      ${P("If you're still in it, your free resume transform is still here. No expiry, no pressure.")}
      <p style="margin:0;font-size:15px;color:#111827;font-family:sans-serif">— Bryan</p>
    `, email),
  };
}

// ── Send via Resend ───────────────────────────────────────────────────────────
async function sendNurtureEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        bcc: ["bryan.greer1@gmail.com"],
        subject,
        html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Track sent emails ─────────────────────────────────────────────────────────
async function hasAlreadySent(userId: number, emailKey: string): Promise<boolean> {
  const conn = await getDb();
  if (!conn) return true; // fail safe — don't double send
  try {
    const [rows] = await conn.execute(
      "SELECT id FROM riq_nurture_sent WHERE userId = ? AND emailKey = ?",
      [userId, emailKey]
    ) as any;
    return rows.length > 0;
  } finally {
    await conn.end();
  }
}

async function markSent(userId: number, emailKey: string): Promise<void> {
  const conn = await getDb();
  if (!conn) return;
  try {
    await conn.execute(
      "INSERT IGNORE INTO riq_nurture_sent (userId, emailKey, sentAt) VALUES (?, ?, NOW())",
      [userId, emailKey]
    );
  } finally {
    await conn.end();
  }
}

// Segment C — high scorers (postScore >= 8), WWM pitch
function emailC3(firstName: string, email: string, postScore: number): { subject: string; html: string } {
  return {
    subject: `Your resume scored ${postScore}/10. Here's the one thing it's still missing.`,
    html: WRAP(`
      ${P(`Hey ${firstName},`)}
      ${P(`Your resume scored <strong style="color:#4ade80">${postScore}/10</strong> after transformation. That puts you in the top tier of applicants for almost any role you apply to.`)}
      ${P("Here's the honest reality:")}
      ${P("The candidates you're competing with have the same score. Same ATS-optimized format. Same strong bullets. Same credentials.")}
      ${P("The ones who get the offer answer a question yours still doesn't:")}
      <p style="margin:0 0 16px;font-size:17px;color:white;font-weight:700;font-family:sans-serif;line-height:1.6;font-style:italic">"How do you actually work?"</p>
      ${P("How do you communicate under pressure? How do you make decisions when the data is incomplete? What does a good working relationship look like with you?")}
      ${P('The "Working With Me" section answers all of it — synthesized from your DISC, MBTI, Predictive Index, or TKI assessment results. Written in professional behavioral language, not assessment jargon. Permanently attached to every resume you generate.')}
      ${P("No other resume tool offers this section. No other candidate in the pile has it.")}
      ${CTA('Add "Working With Me" — $7.99 →', `https://resumeiq.reviveiqi.com?utm_source=email&utm_medium=nurture&utm_campaign=c3_wwm_highscore`)}
      ${P("Upload your assessment results after logging in. Takes about 2 minutes.")}
      ${SIGN}
    `, email),
  };
}

// ── Main cron function ────────────────────────────────────────────────────────
export async function runNurtureCron(): Promise<void> {
  const conn = await getDb();
  if (!conn) {
    console.error("[Nurture] DB unavailable");
    return;
  }

  let users: any[] = [];
  try {
    const [rows] = await conn.execute(`
      SELECT 
        u.id, u.email, u.name, u.plan, u.resumeCount, u.createdAt,
        r.preScore, r.postScore
      FROM riq_users u
      LEFT JOIN riq_resumes r ON r.userId = u.id AND r.id = (
        SELECT id FROM riq_resumes WHERE userId = u.id ORDER BY createdAt DESC LIMIT 1
      )
      WHERE (u.plan = 'free' OR u.plan IS NULL)
        AND u.email IS NOT NULL
        AND u.email != ''
    `) as any;
    users = Array.isArray(rows[0]) ? rows[0] : rows;
  } finally {
    await conn.end();
  }

  console.log(`[Nurture] Processing ${users.length} free users`);

  for (const user of users) {
    const firstName = (user.name || "").split(" ")[0] || "there";
    const email = user.email;
    const resumeCount = user.resumeCount || 0;
    const daysSince = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    const hasScores = user.preScore != null && user.postScore != null;

    // Segment C — high scorers (postScore >= 8), WWM pitch on Day 3
    const isHighScorer = user.postScore != null && user.postScore >= 8;

    // Segment A — used free transform
    if (resumeCount >= 1) {
      // Day 3 high scorer WWM intercept
      if (isHighScorer && daysSince >= 3 && daysSince < 7) {
        const key = "c3";
        if (!(await hasAlreadySent(user.id, key))) {
          const tpl = emailC3(firstName, email, user.postScore);
          const ok = await sendNurtureEmail(email, tpl.subject, tpl.html);
          if (ok) { await markSent(user.id, key); console.log(`[Nurture] Sent ${key} → ${email}`); }
        }
      }
      if (daysSince >= 1 && daysSince < 3) {
        const key = "a1";
        if (!(await hasAlreadySent(user.id, key))) {
          const tpl = hasScores
            ? emailA1WithScores(firstName, email, user.preScore, user.postScore)
            : emailA1NoScores(firstName, email);
          const ok = await sendNurtureEmail(email, tpl.subject, tpl.html);
          if (ok) { await markSent(user.id, key); console.log(`[Nurture] Sent ${key} → ${email}`); }
        }
      } else if (daysSince >= 3 && daysSince < 7) {
        const key = "a3";
        if (!(await hasAlreadySent(user.id, key))) {
          const tpl = emailA3(firstName, email);
          const ok = await sendNurtureEmail(email, tpl.subject, tpl.html);
          if (ok) { await markSent(user.id, key); console.log(`[Nurture] Sent ${key} → ${email}`); }
        }
      } else if (daysSince >= 7 && daysSince < 14) {
        const key = "a7";
        if (!(await hasAlreadySent(user.id, key))) {
          const tpl = emailA7(firstName, email);
          const ok = await sendNurtureEmail(email, tpl.subject, tpl.html);
          if (ok) { await markSent(user.id, key); console.log(`[Nurture] Sent ${key} → ${email}`); }
        }
      } else if (daysSince >= 14 && daysSince < 30) {
        const key = "a14";
        if (!(await hasAlreadySent(user.id, key))) {
          const tpl = emailA14(firstName, email);
          const ok = await sendNurtureEmail(email, tpl.subject, tpl.html);
          if (ok) { await markSent(user.id, key); console.log(`[Nurture] Sent ${key} → ${email}`); }
        }
      } else if (daysSince >= 30 && daysSince < 35) {
        const key = "a30";
        if (!(await hasAlreadySent(user.id, key))) {
          const tpl = emailA30(firstName, email);
          const ok = await sendNurtureEmail(email, tpl.subject, tpl.html);
          if (ok) { await markSent(user.id, key); console.log(`[Nurture] Sent ${key} → ${email}`); }
        }
      }

    // Segment B — never transformed
    } else {
      if (daysSince >= 1 && daysSince < 3) {
        const key = "b1";
        if (!(await hasAlreadySent(user.id, key))) {
          const tpl = emailB1(firstName, email);
          const ok = await sendNurtureEmail(email, tpl.subject, tpl.html);
          if (ok) { await markSent(user.id, key); console.log(`[Nurture] Sent ${key} → ${email}`); }
        }
      } else if (daysSince >= 3 && daysSince < 7) {
        const key = "b3";
        if (!(await hasAlreadySent(user.id, key))) {
          const tpl = emailB3(firstName, email);
          const ok = await sendNurtureEmail(email, tpl.subject, tpl.html);
          if (ok) { await markSent(user.id, key); console.log(`[Nurture] Sent ${key} → ${email}`); }
        }
      } else if (daysSince >= 7 && daysSince < 30) {
        const key = "b7";
        if (!(await hasAlreadySent(user.id, key))) {
          const tpl = emailB7(firstName, email);
          const ok = await sendNurtureEmail(email, tpl.subject, tpl.html);
          if (ok) { await markSent(user.id, key); console.log(`[Nurture] Sent ${key} → ${email}`); }
        }
      } else if (daysSince >= 30 && daysSince < 35) {
        const key = "b30";
        if (!(await hasAlreadySent(user.id, key))) {
          const tpl = emailB30(firstName, email);
          const ok = await sendNurtureEmail(email, tpl.subject, tpl.html);
          if (ok) { await markSent(user.id, key); console.log(`[Nurture] Sent ${key} → ${email}`); }
        }
      }
    }
  }

  console.log("[Nurture] Cron complete");
}

// ── Welcome email — sent immediately on registration ──────────────────────────
export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const firstName = (name || "").split(" ")[0] || "there";
  const subject = "Welcome to ResumeIQ";
  const html = WRAP(`
    ${P(`Hey ${firstName},`)}
    ${P("Welcome to ResumeIQ. Really glad you're here.")}
    ${P("Here's what happens next:")}
    <ol style="color:#111827;line-height:1.9;padding-left:20px;margin:0 0 16px;font-size:15px;font-family:sans-serif">
      <li>Upload your resume — PDF or Word, either works</li>
      <li>We score it on 4 ATS dimensions before we touch it</li>
      <li>AI rewrites every bullet, fixes the format, and elevates the language</li>
      <li>You see your new score and download the Word document</li>
    </ol>
    ${P("The whole thing takes about 60 seconds.")}
    ${P("If anything looks off in the output — every field is editable before you download. And if you have questions, just reply to this email. I read every one.")}
    ${CTA("Transform my resume →", `https://resumeiq.reviveiqi.com?utm_source=email&utm_medium=welcome&utm_campaign=registration`)}
    <p style="margin:0 0 4px;font-size:15px;color:#111827;font-family:sans-serif">Good luck out there,</p>
    <p style="margin:0;font-size:15px;font-weight:700;color:#111827;font-family:sans-serif">Bryan</p>
    <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;font-family:sans-serif">Founder, ResumeIQ · ReviveIQI</p>
  `, email);

  try {
    await fetch(RESEND_API, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [email], bcc: ["bryan.greer1@gmail.com"], subject, html }),
    });
    console.log(`[Welcome] Sent → ${email}`);
  } catch (err) {
    console.error(`[Welcome] Failed → ${email}:`, err);
  }
}

// ── Startup catch-up — run cron if 9am window was missed today ────────────────
export async function runCronIfMissedToday(): Promise<void> {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();
  // Window: if it's between 13:05 UTC and 22:00 UTC, cron was already due today
  if (utcHour >= 13 && utcHour < 22) {
    console.log(`[Nurture] Server started after 9am EDT window — running catch-up now`);
    await runNurtureCron();
  } else {
    console.log(`[Nurture] Server started before or after today's window — cron will fire at next scheduled time`);
  }
}
