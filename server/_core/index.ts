import "dotenv/config";
import express from "express";
import { createServer } from "http";
import path from "path";
import { registerResumeIQRoutes } from "../resumeIQRouter";

const ALLOWED_ORIGINS = [
  "https://resumeiq.reviveiqi.com",
  "https://resumeiq-production-d97e.up.railway.app",
  "https://claude.ai",
  "https://www.claude.ai",
  "http://localhost:5173",
  "http://localhost:3000",
];

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.set("trust proxy", 1);

  app.use((req, res, next) => {
    const origin = req.headers.origin as string | undefined;
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") { res.sendStatus(204); return; }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerResumeIQRoutes(app);

  if (process.env.NODE_ENV === "production") {
    const distPath = path.resolve(process.cwd(), "dist/public");
    app.use(express.static(distPath));

    // Clean URL routes for SEO pages
    app.get("/ats-checker", (_req, res) => {
      res.sendFile(path.join(distPath, "ats-checker.html"));
    });

    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const port = parseInt(process.env.PORT || "3000");
  server.listen(port, "0.0.0.0", () => {
    console.log(`[ResumeIQ] Running on port ${port}`);
  });

  // ── Nurture email cron — 9:00 AM EST (14:00 UTC) ─────────────────────────
  try {
    const cron = await import("node-cron");
    cron.default.schedule("0 14 * * *", async () => {
      console.log("[Nurture] Starting daily nurture cron");
      try {
        const { runNurtureCron } = await import("../nurtureEmail");
        await runNurtureCron();
      } catch (err) {
        console.error("[Nurture] Cron failed:", err);
      }
    }, { timezone: "UTC" });
    console.log("[ResumeIQ] Nurture email cron scheduled at 9:00 AM EST");
  } catch (err: any) {
    console.warn("[ResumeIQ] node-cron not available:", err.message);
  }
}

startServer().catch(console.error);

// ── Process-level error alerting ─────────────────────────────────────────────
async function sendCrashAlert(type: string, err: any) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const msg = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? (err.stack || "").slice(0, 800) : "";
  const time = new Date().toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" });
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "ResumeIQ Alerts <alerts@resumeiq.reviveiqi.com>",
        to: ["bryan@reviveiqi.com"],
        subject: `🚨 ResumeIQ ${type} — ${msg.slice(0, 60)}`,
        html: `<div style="font-family:sans-serif;max-width:560px;padding:24px">
          <h2 style="color:#ef4444;margin:0 0 16px">🚨 ResumeIQ ${type}</h2>
          <table style="border-collapse:collapse;width:100%">
            <tr><td style="padding:8px 12px;background:#fef2f2;border:1px solid #fecaca;font-size:13px;color:#64748b;width:80px">Time</td><td style="padding:8px 12px;border:1px solid #fecaca;font-size:14px">${time} ET</td></tr>
            <tr><td style="padding:8px 12px;background:#fef2f2;border:1px solid #fecaca;font-size:13px;color:#64748b">Error</td><td style="padding:8px 12px;border:1px solid #fecaca;font-size:14px;font-weight:600;color:#dc2626">${msg}</td></tr>
            ${stack ? `<tr><td style="padding:8px 12px;background:#fef2f2;border:1px solid #fecaca;font-size:13px;color:#64748b">Stack</td><td style="padding:8px 12px;border:1px solid #fecaca;font-size:12px;font-family:monospace;white-space:pre-wrap">${stack}</td></tr>` : ""}
          </table>
          <p style="font-size:12px;color:#94a3b8;margin-top:16px">Check Railway logs: resumeiq-production</p>
        </div>`,
      }),
    });
  } catch { /* never throw in crash handler */ }
}

process.on("uncaughtException", async (err) => {
  console.error("[ResumeIQ] uncaughtException:", err);
  await sendCrashAlert("uncaughtException", err);
  process.exit(1);
});

process.on("unhandledRejection", async (reason) => {
  console.error("[ResumeIQ] unhandledRejection:", reason);
  await sendCrashAlert("unhandledRejection", reason);
});

process.on("SIGTERM", async () => {
  console.log("[ResumeIQ] SIGTERM received — shutting down gracefully");
  // Railway sends SIGTERM before killing — no need to alert, this is intentional
  process.exit(0);
});
