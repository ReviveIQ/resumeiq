import "dotenv/config";
import express from "express";
import { createServer } from "http";
import path from "path";
import { registerResumeIQRoutes } from "../resumeIQRouter";

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.set("trust proxy", 1);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Register ResumeIQ API routes
  registerResumeIQRoutes(app);

  // Serve static frontend
  if (process.env.NODE_ENV === "production") {
    const distPath = path.resolve(process.cwd(), "dist/public");
    app.use(express.static(distPath));
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
