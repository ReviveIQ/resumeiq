# ResumeIQ

> Transform any resume (PDF or DOCX) into a polished, ATS-optimized Word document using GPT-4o.

**Product #1 in the [ReviveIQI](https://reviveiqi.com) suite.**

---

## Live

| | |
|---|---|
| **Production** | `resumeiq-production-d97e.up.railway.app` |
| **GitHub** | `github.com/ReviveIQ/resumeiq` (main = production) |
| **Deploys** | Auto-deploy on push to `main` via Railway |

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind |
| Backend | Node.js + Express |
| Database | TiDB Cloud (MySQL-compatible) via `mysql2` |
| Deployment | Railway (Docker) + GitHub auto-deploy |
| AI | OpenAI GPT-4o |
| Payments | Stripe Checkout |
| DOCX Generation | `docx` npm package v8+ |
| Server runner | `tsx` (TypeScript directly, no bundling) |

---

## File Structure

```
resumeiq/
├── client/
│   └── src/
│       ├── App.tsx                         ← routing (wouter)
│       └── pages/
│           ├── ResumeIQ.tsx                ← main app (~980 lines)
│           ├── PipelineTracker.jsx         ← admin: uploads/conversions/revenue
│           └── StripeDashboard.jsx         ← admin: Stripe payment sessions
├── server/
│   ├── _core/
│   │   └── index.ts                        ← Express entry + CORS config
│   ├── resumeIQRouter.ts                   ← all API routes + DOCX generation
│   └── authService.ts                      ← DB, auth, user/resume CRUD
├── shared/
│   └── const.ts
├── client/public/
│   └── logo-gem.jpg
├── Dockerfile
├── package.json
└── railway.json                            ← start command lives here
```

---

## Environment Variables

All set in Railway. **Never commit these.**

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | GPT-4o resume parsing + generation |
| `STRIPE_SECRET_KEY` | Stripe server-side (`sk_test_...`) |
| `STRIPE_PUBLISHABLE_KEY` | Stripe client-side (`pk_test_...`) |
| `RESUMEIQ_DATABASE_URL` | TiDB Cloud connection string |
| `JWT_SECRET` | Token signing |
| `ADMIN_EMAILS` | Comma-separated emails with admin dashboard access |
| `NODE_ENV` | `production` on Railway |
| `PORT` | Set by Railway automatically |

---

## API Routes

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/resumeiq/auth/register` | — | Create account |
| POST | `/api/resumeiq/auth/login` | — | Login |
| GET | `/api/resumeiq/auth/me` | JWT | Get current user |
| POST | `/api/resumeiq/transform` | — | Parse resume → create session |
| GET | `/api/resumeiq/session/:id` | — | Get session data |
| POST | `/api/resumeiq/checkout` | — | Create Stripe checkout session |
| POST | `/api/resumeiq/verify-payment` | — | Verify Stripe payment |
| POST | `/api/resumeiq/generate` | — | Generate DOCX + save to DB |
| POST | `/api/resumeiq/capture-email` | — | Guest email capture |
| GET | `/api/resumeiq/history` | JWT | User resume history |
| GET | `/api/resumeiq/resume/:id/download` | JWT | Re-download saved resume |
| POST | `/api/resumeiq/personality` | — | Generate Working With Me section |
| GET | `/api/resumeiq/analytics` | Admin JWT | Pipeline + Stripe analytics |

---

## Admin Dashboards

Accessible at `/admin/pipeline` and `/admin/stripe` when logged in with an `ADMIN_EMAILS` account.

- **Pipeline tracker** — uploads, conversions, revenue, funnel
- **Stripe dashboard** — sessions, paid/failed/abandoned, daily revenue

Both pull live data from `/api/resumeiq/analytics`.

---

## Database Tables

Auto-created by `initDb()` on server startup.

```sql
riq_users          -- accounts (email, password hash, plan, resumeCount)
riq_resumes        -- resume history (userId, parsedData, docxBase64)
riq_sessions       -- payment sessions (sessionId, parsedData, paid, expiresAt)
riq_email_captures -- guest email capture for free tier
```

Sessions are stored in **TiDB** (not memory) — safe to redeploy anytime.

---

## User Flow

```
upload → analyzing → [interview if bad parse] → preview → [Stripe checkout] → done
```

**Free tier:** 1 resume per user (tracked via `resumeCount`). Guests tracked via cookie + IP.

---

## DOCX Style

- Font: Calibri throughout
- Palette: `#0A1628` (navy) · `#1B4F9B` · `#2E75B6` · `#64748B`
- Bullets: `▸` in accent blue
- Skills: borderless table with light blue category shading

---

## Payments

Stripe Checkout (sandbox). Test card: `4242 4242 4242 4242` / `12/28` / `123` / `12345`

Pricing:
- `$9.99` one-time per resume
- `$29/month` unlimited

---

## Personality Assessment Feature

Optional after preview — user uploads DISC, PI, MBTI, TKI, or 360 PDFs.  
GPT synthesizes into a **Working With Me** section appended to the DOCX.  
Output fields: Communication Style, Decision Making, Collaboration, Under Pressure, What Brings Out My Best.

---

## Workflow Rules

1. No dev branch — push directly to `main`
2. Always revoke GitHub tokens immediately after use
3. Token scope needed: `repo` only
4. Never ask Bryan for API keys already in Railway
5. `railway.json` controls the start command — not Dockerfile CMD
6. Sessions are TiDB-backed — safe to redeploy anytime

---

## Brand

**ReviveIQI** — *Where Revenue Intelligence Meets Real Execution*

Colors: `#080f1e` · `#0f172a` · `#1e3a5f` (navy) + `#2563eb` · `#3b82f6` · `#60a5fa` · `#93c5fd` (blue)  
Fonts: Syne 800 (headings) + DM Sans 300–500 (body)

---

*ResumeIQ is Product #1 of the ReviveIQI ecosystem. See the full roadmap in `ResumeIQ_Project_Handoff.md`.*
