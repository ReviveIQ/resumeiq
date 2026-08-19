# ResumeIQ

**Your resume tells them what you've done. The Working With Me section tells them who they're hiring.**

ResumeIQ is an AI-powered resume transformation tool that takes any resume — messy, outdated, or underselling — and produces a polished, ATS-optimized Word document built to pass automated screeners and land in front of humans. Part of the [ReviveIQI](https://reviveiqi.com) suite.

**Live at:** [resumeiq.reviveiqi.com](https://resumeiq.reviveiqi.com)  
**GitHub:** `github.com/ReviveIQ/resumeiq` (main = production)

---

## Pages

| Route | Description |
|---|---|
| `/` | Landing page (`landing.html`) — marketing, hero, how it works |
| `/app` | React SPA — full resume transformation flow |
| `/ats-checker` | Free ATS score tool — no auth, instant 4-dimension grade |
| `/privacy` | Privacy policy |
| `/terms` | Terms of service |

---

## What it does

- Parses PDF and DOCX resumes using GPT-4o
- Runs a career narrative pre-pass — extracts professional identity, career arc, and transition context before rewriting bullets
- Scores resumes on 4 ATS dimensions: Format, Bullet Quality, Keywords, Completeness (pre and post transformation)
- Pre-score grades the original harshly (target 4–7); post-score rewards the transformation (target 7–9) — visible before/after delta on the done screen
- Injects score flags into a targeted GPT enhancement pass — fixes weak bullets specifically
- Elevates every bullet using the "So what?" test — strong verbs, real scope, credible outcomes
- Enforces tense consistency within each role — no mixing past and present tense across bullets
- Extracts inline awards/honors (trophy emojis, icons embedded mid-bullet) into the role's dedicated achievements field — keeps decorative content out of ATS-parsed bullets
- Deduplicates skills — consolidates flat keyword lists and overlapping categorized tables into one clean section
- Captures non-standard sections: Publications, Projects, Hobbies, Activities, Volunteer work
- Email typo detection — flags known provider misspellings without flagging custom domains
- Never fabricates metrics, companies, dates, or titles
- Tailor to a Job Description (Starter/Monthly/Agency) — paste a JD, GPT-4o rephrases the summary and bullets and reprioritizes skills to match it, using only facts already on the resume; returns a match score, matched/missing keyword lists, and a before/after diff the user accepts before it's applied
- Generates a polished Word document (Calibri, ATS-safe, single column)
- Post-conversion email delivers the DOCX directly to the user's inbox
- Abandoned checkout recovery — emails users 1 hour after initiating checkout with no payment
- Optional: synthesizes DISC, MBTI, Predictive Index, TKI, or 360 feedback into a "Working With Me" section

## Free ATS Checker (`/ats-checker`)

Public tool — no auth, no account required. Rate limited to 3 checks/hour per IP.

- User uploads PDF or DOCX
- Backend parses resume via `parseResume()` → scores via `scoreResume(parsed, true)` (pre-score, harsh grading)
- Returns: overall score, 4 dimension scores + flags, top 3 issues
- CTA drives to `/app` for full transformation

Backend route: `POST /api/resumeiq/ats-check`

## Cross-product SSO → MyCareerIQ

After downloading, users can click **"Start my job search — 7 days free →"** on the done screen:

1. ResumeIQ generates a signed cross-app token (10-min expiry) via `POST /api/resumeiq/auth/mycareeriq-handoff`
2. Opens MyCareerIQ at `/sso?token=...`
3. MyCareerIQ creates or finds the account automatically — no re-registration
4. Starts a 7-day free trial
5. Resume transfers automatically into MyCareerIQ Settings

## Nurture email sequence

| Segment | Trigger | Emails |
|---|---|---|
| A | Transformed, didn't pay | A1 (scores), A3, A7, A14, A30 |
| B | Registered, never transformed | B1, B3, B7, B30 |
| C | High scorer (8+) | C3 (one thing missing) |

## Pricing

| Plan | Price | Included |
|---|---|---|
| Free | $0 | 1 transformation |
| Starter | $14.99 one-time | 3 transformations, Working With Me, Tailor to a Job |
| Resume + Working With Me | $19.99 | Resume + WWM add-on |
| Career Launch Bundle | $79.99 | Resume + WWM + MyCareerIQ 7-day trial |
| Monthly | subscription | Unlimited transformations, Working With Me, Tailor to a Job |

Stripe is **live** (real payments). Test card: `4242 4242 4242 4242` / `12/28` / `123` / `12345`

## Stack

React · TypeScript · Vite · Tailwind · Node.js · Express · TiDB Cloud · GPT-4o · GPT-4o-mini · Stripe (live) · Resend · Cloudflare R2 · Railway

## Fonts

**Montserrat 800** (headings, landing page, ATS checker) · **DM Sans 300–800** (body) · **Inter 300–500** (UI)

## Infrastructure

| Layer | Detail |
|---|---|
| Hosting | Railway — auto-deploys from `main` (~60–90s) |
| Database | TiDB Cloud · cluster: `pipeline-production` · database: `pipeline` · tables: `riq_*` |
| Auth | Custom JWT · stored as `riq_token` in localStorage · 30-day expiry |
| Start command | `node_modules/.bin/tsx server/_core/index.ts` (in `railway.json`) |

## Key files

| File | Purpose |
|---|---|
| `client/public/landing.html` | Marketing landing page (served at `/`) |
| `client/public/ats-checker.html` | Free ATS checker page (served at `/ats-checker`) |
| `client/src/pages/ResumeIQ.tsx` | Full React SPA (~4,000 lines) |
| `server/resumeIQRouter.ts` | All API routes, DOCX generation, scoring, SSO handoff, ATS check |
| `server/authService.ts` | DB init, migrations, user/resume CRUD |
| `server/emailService.ts` | Gmail SMTP (port 587 STARTTLS) transactional emails + DOCX attachment |
| `server/nurtureEmail.ts` | Nurture sequences A/B/C + abandoned checkout cron |
| `server/stripeService.ts` | Stripe checkout sessions (live keys) |

## API routes

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/resumeiq/ats-check` | None | Free ATS score — parse + pre-score, rate limited 3/hr/IP |
| POST | `/api/resumeiq/transform` | Optional | Parse resume → create TiDB session |
| POST | `/api/resumeiq/checkout` | Optional | Create Stripe checkout session |
| POST | `/api/resumeiq/verify-payment` | None | Verify Stripe payment |
| POST | `/api/resumeiq/generate` | Optional | Generate DOCX + save to DB |
| POST | `/api/resumeiq/auth/register` | None | Create account |
| POST | `/api/resumeiq/auth/login` | None | Login |
| GET | `/api/resumeiq/auth/me` | JWT | Get current user |
| POST | `/api/resumeiq/auth/mycareeriq-handoff` | JWT | Generate cross-app SSO token |
| GET | `/api/resumeiq/history` | JWT | Resume history |
| GET | `/api/resumeiq/resume/:id/download` | JWT | Re-download saved resume |
| POST | `/api/resumeiq/personality` | None | Generate Working With Me section |
| POST | `/api/resumeiq/tailor` | JWT | Tailor resume to a pasted job description — Starter/Monthly/Agency only |

## Workflow rules

1. Push directly to `main` — Railway auto-deploys (~60–90s). No dev branch.
2. Never use `useEffect` with state variables in `ResumeIQ.tsx` — causes Vite circular dependency crash. Use `setTimeout` loops or inline JSX checks instead.
3. Revoke GitHub tokens immediately after use (`repo` scope only)
4. Never ask Bryan for API keys already in Railway env
5. Sessions are TiDB-backed — safe to redeploy anytime
6. `STRIPE_TEST_MODE` env var has been removed — Stripe is live

## Hallucination test

`Bryan_Greer_HALLUCINATION_TEST_v2.docx` — 10 traps for parser validation. **Current score: 10/10 passing.**

---

*Part of the ReviveIQI suite · [reviveiqi.com](https://reviveiqi.com)*
