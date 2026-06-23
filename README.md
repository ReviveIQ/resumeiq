# ResumeIQ

**Your resume, transformed in 60 seconds.**

ResumeIQ is an AI-powered resume transformation tool that takes any resume — messy, outdated, or underselling — and produces a polished, ATS-optimized Word document built to pass automated screeners and land in front of humans. Part of the [ReviveIQI](https://reviveiqi.com) suite.

**Live at:** [resumeiq.reviveiqi.com](https://resumeiq.reviveiqi.com)

---

## What it does

- Parses PDF and DOCX resumes using GPT-4o
- Runs a career narrative pre-pass — extracts professional identity, career arc, and transition context before rewriting bullets
- Scores resumes on 4 ATS dimensions: Format, Bullet Quality, Keywords, Completeness
- Pre-score grades the original harshly (target 4–7); post-score rewards the transformation (target 7–9) — visible before/after delta on the done screen
- Injects score flags into a targeted GPT enhancement pass — fixes weak bullets specifically
- Elevates every bullet using the "So what?" test — strong verbs, real scope, credible outcomes
- Captures non-standard sections: Publications, Projects, Hobbies, Activities, Volunteer work
- Email typo detection — flags known provider misspellings (gamil, yahooo, hotmal) without flagging custom domains
- topMetrics achievements always appear in both the career highlights AND the relevant experience bullets
- Never fabricates metrics, companies, dates, or titles
- Generates a polished Word document (Calibri, ATS-safe, single column)
- Post-conversion email delivers the DOCX directly to the user's inbox
- Abandoned checkout recovery — emails users 1 hour after initiating checkout with no payment ("You were so close")
- Optional: synthesizes DISC, MBTI, Predictive Index, TKI, or 360 feedback into a "Working With Me" section

## Cross-product SSO → MyCareerIQ

After downloading, users can click **"Start my job search — 7 days free →"** on the done screen. For logged-in users:

1. ResumeIQ generates a signed cross-app token (10-min expiry) via `POST /api/resumeiq/auth/mycareeriq-handoff`
2. Opens MyCareerIQ at `/sso?token=...`
3. MyCareerIQ creates or finds the account automatically — no re-registration
4. Starts a 7-day free trial
5. Resume transfers automatically into MyCareerIQ Settings

## Nurture email sequence

| Segment | Trigger | Emails |
|---|---|---|
| A | Transformed, didn't pay | A1 (scores), A3, A7 ("Did you get what you needed?"), A14 ("Just checking in"), A30 |
| B | Registered, never transformed | B1, B3, B7 ("Everything go okay on your end?"), B30 |
| C | High scorer (8+) | C3 (one thing missing) |

## Pricing

| Plan | Price | What's included |
|---|---|---|
| Free | $0 | 1 transformation |
| Starter | $14.99 one-time | 3 transformations |
| Resume + Working With Me | $19.99 | Resume + WWM add-on |
| Career Launch Bundle | $79.99 | Full ResumeIQ + MyCareerIQ 7-day trial + WWM |

## Hallucination test

`Bryan_Greer_HALLUCINATION_TEST_v2.docx` — 10 traps for parser validation. **Current score: 10/10 passing.**

## Stack

React · TypeScript · Vite · Tailwind · Node.js · Express · TiDB Cloud · GPT-4o · GPT-4o-mini · Stripe · Resend · Cloudflare R2 · Railway

## Repo

`github.com/ReviveIQ/resumeiq` — main branch = production. Auto-deploys on push. No dev branch.

## Key files

| File | Purpose |
|---|---|
| `client/src/pages/ResumeIQ.tsx` | Entire frontend (~3,300 lines) |
| `server/resumeIQRouter.ts` | All API routes, DOCX generation, scoring, SSO handoff |
| `server/authService.ts` | DB init, migrations, user/resume CRUD |
| `server/emailService.ts` | Resend transactional emails + DOCX attachment |
| `server/nurtureEmail.ts` | Nurture sequences A/B/C + abandoned checkout cron |
| `server/stripeService.ts` | Stripe checkout sessions |

## Workflow rules

1. Push directly to `main` — Railway auto-deploys (~60s)
2. Never use `useEffect` with state variables in `ResumeIQ.tsx` — causes Vite circular dependency crash. Use `setTimeout` loops or inline JSX checks instead.
3. Revoke GitHub tokens immediately after use (`repo` scope only)
4. Never ask Bryan for API keys already in Railway env
5. Sessions are TiDB-backed — safe to redeploy anytime
6. Test Stripe: `4242 4242 4242 4242` / `12/28` / `123` / `12345`

---

*Part of the ReviveIQI suite · [reviveiqi.com](https://reviveiqi.com)*
