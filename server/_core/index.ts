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
}

startServer().catch(console.error);
