import mysql2 from "mysql2/promise";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "resumeiq-secret-change-in-prod";

export function hashPassword(password: string): string {
  return crypto.createHmac("sha256", JWT_SECRET).update(password).digest("hex");
}

export function generateToken(userId: number, email: string): string {
  const payload = { userId, email, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64");
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(data).digest("hex");
  return `${data}.${sig}`;
}

export function verifyToken(token: string): { userId: number; email: string } | null {
  try {
    const [data, sig] = token.split(".");
    const expected = crypto.createHmac("sha256", JWT_SECRET).update(data).digest("hex");
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(data, "base64").toString());
    if (payload.exp < Date.now()) return null;
    return { userId: payload.userId, email: payload.email };
  } catch {
    return null;
  }
}

export async function getDb() {
  const dbUrl = process.env.RESUMEIQ_DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) return null;
  // TiDB Cloud requires SSL — explicitly set it
  return mysql2.createConnection({
    uri: dbUrl,
    ssl: { rejectUnauthorized: true },
  });
}

export async function initDb() {
  const conn = await getDb();
  if (!conn) { console.warn("[ResumeIQ] No database URL configured — skipping DB init"); return; }
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS riq_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(320) NOT NULL UNIQUE,
        passwordHash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        plan ENUM('free','starter','monthly','agency') DEFAULT 'free',
        resumeCount INT DEFAULT 0,
        personalityUnlocked TINYINT DEFAULT 0,
        workingWithMeData JSON,
        planExpiresAt TIMESTAMP NULL DEFAULT NULL,
        emailVerified TINYINT DEFAULT 0,
        verifyToken VARCHAR(64) NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Add planExpiresAt if upgrading existing DB
    await conn.execute(`ALTER TABLE riq_users ADD COLUMN planExpiresAt TIMESTAMP NULL DEFAULT NULL`).catch(() => {});
    await conn.execute(`ALTER TABLE riq_sessions ADD COLUMN IF NOT EXISTS contactEmail VARCHAR(320) NULL`).catch(() => {});
    await conn.execute(`ALTER TABLE riq_sessions ADD COLUMN IF NOT EXISTS contactName VARCHAR(255) NULL`).catch(() => {});
    await conn.execute(`ALTER TABLE riq_sessions ADD COLUMN IF NOT EXISTS checkoutAt TIMESTAMP NULL`).catch(() => {});
    await conn.execute(`ALTER TABLE riq_sessions ADD COLUMN IF NOT EXISTS checkoutRecoverySent TINYINT DEFAULT 0`).catch(() => {});
    await conn.execute(`ALTER TABLE riq_sessions ADD COLUMN IF NOT EXISTS guestId VARCHAR(64) NULL`).catch(() => {});
    await conn.execute(`ALTER TABLE riq_users ADD COLUMN IF NOT EXISTS verifyToken VARCHAR(64) NULL`).catch(() => {});
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS riq_resumes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        originalFileName VARCHAR(255),
        candidateName VARCHAR(255),
        parsedData JSON,
        docxBase64 MEDIUMTEXT,
        stripeSessionId VARCHAR(255),
        paid TINYINT DEFAULT 0,
        preScore INT NULL,
        postScore INT NULL,
        scoreDimensions LONGTEXT NULL,
        originalFileUrl VARCHAR(500) NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_userId (userId)
      )
    `);
    // Add columns to existing tables if they don't exist
    const alterStatements = [
      "ALTER TABLE riq_resumes ADD COLUMN IF NOT EXISTS preScore INT NULL",
      "ALTER TABLE riq_resumes ADD COLUMN IF NOT EXISTS postScore INT NULL",
      "ALTER TABLE riq_resumes ADD COLUMN IF NOT EXISTS scoreDimensions LONGTEXT NULL",
      "ALTER TABLE riq_resumes ADD COLUMN IF NOT EXISTS originalFileUrl VARCHAR(500) NULL",
    ];
    for (const sql of alterStatements) {
      try { await conn.execute(sql); } catch { /* column may already exist */ }
    }
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS riq_sessions (
        sessionId VARCHAR(64) PRIMARY KEY,
        parsedData MEDIUMTEXT NOT NULL,
        paid TINYINT DEFAULT 0,
        freeUsed TINYINT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expiresAt TIMESTAMP NOT NULL,
        INDEX idx_expiresAt (expiresAt)
      )
    `);
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS riq_email_captures (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(320) NOT NULL,
        name VARCHAR(255),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_email (email)
      )
    `);
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS riq_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sessionId VARCHAR(64),
        eventType VARCHAR(64) NOT NULL,
        metadata JSON,
        path VARCHAR(512),
        ip VARCHAR(64),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_eventType (eventType),
        INDEX idx_sessionId (sessionId),
        INDEX idx_createdAt (createdAt)
      )
    `);
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS riq_attribution (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sessionId VARCHAR(64) UNIQUE,
        source VARCHAR(128),
        medium VARCHAR(128),
        campaign VARCHAR(255),
        content VARCHAR(255),
        landingUrl VARCHAR(1024),
        referrer VARCHAR(1024),
        ip VARCHAR(64),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_source (source),
        INDEX idx_campaign (campaign)
      )
    `);
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS riq_email_sends (
        id        INT AUTO_INCREMENT PRIMARY KEY,
        email     VARCHAR(320) NOT NULL,
        flowType  VARCHAR(64) NOT NULL,
        sentAt    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email_flow (email, flowType)
      )
    `);
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS riq_email_subscribers (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        email        VARCHAR(320) NOT NULL UNIQUE,
        sessionId    VARCHAR(128),
        source       VARCHAR(64),
        capturePoint VARCHAR(64),
        subscribed   TINYINT DEFAULT 1,
        createdAt    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS riq_testimonials (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        userId      INT NULL,
        name        VARCHAR(100),
        title       VARCHAR(150),
        rating      INT NOT NULL DEFAULT 5,
        quote       TEXT NOT NULL,
        preScore    INT NULL,
        postScore   INT NULL,
        approved    TINYINT DEFAULT 0,
        createdAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_approved (approved)
      )
    `);
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS riq_nurture_sent (
        id       INT AUTO_INCREMENT PRIMARY KEY,
        userId   INT NOT NULL,
        emailKey VARCHAR(64) NOT NULL,
        sentAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_email (userId, emailKey),
        INDEX idx_userId (userId)
      )
    `);
    console.log("[ResumeIQ] Database initialized ✓");
  } catch (err) {
    console.warn("[ResumeIQ] DB init warning:", err);
  } finally {
    await conn.end();
  }
}


// Add new columns to existing tables if they don't exist yet (safe to run on every startup)
export async function migrateDb() {
  const conn = await getDb();
  if (!conn) return;
  try {
    await conn.execute(`ALTER TABLE riq_users ADD COLUMN IF NOT EXISTS personalityUnlocked TINYINT DEFAULT 0`);
    await conn.execute(`ALTER TABLE riq_users ADD COLUMN IF NOT EXISTS workingWithMeData JSON`);
    console.log("[ResumeIQ] DB migration complete ✓");
  } catch (err) {
    console.warn("[ResumeIQ] DB migration warning:", err);
  } finally {
    await conn.end();
  }
}

export async function createUser(email: string, password: string, name: string) {
  const conn = await getDb();
  if (!conn) throw new Error("Database not available");
  try {
    const hash = hashPassword(password);
    const [result] = await conn.execute(
      "INSERT INTO riq_users (email, passwordHash, name) VALUES (?, ?, ?)",
      [email, hash, name]
    ) as any;
    const userId = result.insertId;
    const EARLY_ADOPTER_LIMIT = 25;
    let plan = "free";
    try {
      const [countRows] = await conn.execute(
        "SELECT COUNT(*) as total FROM riq_users WHERE plan = 'monthly' AND planExpiresAt IS NULL AND id != 930001"
      ) as any;
      const userNumber = Number(countRows[0]?.total || 0);
      if (userNumber < EARLY_ADOPTER_LIMIT) {
        await conn.execute(
          "UPDATE riq_users SET plan = 'monthly', planExpiresAt = NULL WHERE id = ?", [userId]
        );
        plan = "monthly";
        console.log(`[ResumeIQ] 🎉 Early adopter slot ${userNumber + 1} of ${EARLY_ADOPTER_LIMIT} claimed — ${email} upgraded to monthly permanently`);
      }
    } catch (e) { console.warn("[ResumeIQ] Early adopter check failed:", e); }
    return { id: userId, email, name, plan };
  } finally {
    await conn.end();
  }
}

export async function loginUser(email: string, password: string) {
  const conn = await getDb();
  if (!conn) throw new Error("Database not available");
  try {
    const [rows] = await conn.execute(
      "SELECT * FROM riq_users WHERE email = ?", [email]
    ) as any;
    const user = rows[0];
    if (!user) return null;
    if (user.passwordHash !== hashPassword(password)) return null;
    return user;
  } finally {
    await conn.end();
  }
}

export async function setVerifyToken(userId: number, token: string): Promise<void> {
  const conn = await getDb();
  if (!conn) return;
  try {
    await conn.execute("UPDATE riq_users SET verifyToken = ? WHERE id = ?", [token, userId]);
  } finally { await conn.end(); }
}

export async function verifyEmail(token: string): Promise<{ id: number; email: string; name: string } | null> {
  const conn = await getDb();
  if (!conn) return null;
  try {
    const [rows] = await conn.execute(
      "SELECT id, email, name FROM riq_users WHERE verifyToken = ? AND emailVerified = 0 LIMIT 1",
      [token]
    ) as any;
    const data = Array.isArray(rows[0]) ? rows[0] : rows;
    if (!data[0]) return null;
    await conn.execute(
      "UPDATE riq_users SET emailVerified = 1, verifyToken = NULL WHERE id = ?",
      [data[0].id]
    );
    return data[0];
  } finally { await conn.end(); }
}

export async function getUserByEmail(email: string) {
  const conn = await getDb();
  if (!conn) return null;
  try {
    const [rows] = await conn.execute(
      "SELECT id, email, name, plan, resumeCount, personalityUnlocked, workingWithMeData, planExpiresAt, emailVerified FROM riq_users WHERE email = ? LIMIT 1",
      [email]
    ) as any;
    const data = Array.isArray(rows[0]) ? rows[0] : rows;
    return data[0] || null;
  } finally {
    await conn.end();
  }
}

export async function getUserById(id: number) {
  const conn = await getDb();
  if (!conn) return null;
  try {
    const [rows] = await conn.execute(
      "SELECT id, email, name, plan, resumeCount, personalityUnlocked, workingWithMeData, planExpiresAt, emailVerified, createdAt FROM riq_users WHERE id = ?", [id]
    ) as any;
    return rows[0] || null;
  } finally {
    await conn.end();
  }
}

export async function unlockPersonality(userId: number, workingWithMe: any) {
  const conn = await getDb();
  if (!conn) return;
  try {
    await conn.execute(
      "UPDATE riq_users SET personalityUnlocked = 1, workingWithMeData = ? WHERE id = ?",
      [JSON.stringify(workingWithMe), userId]
    );
  } finally {
    await conn.end();
  }
}

export async function saveWorkingWithMe(userId: number, workingWithMe: any) {
  const conn = await getDb();
  if (!conn) return;
  try {
    await conn.execute(
      "UPDATE riq_users SET workingWithMeData = ? WHERE id = ?",
      [JSON.stringify(workingWithMe), userId]
    );
  } finally {
    await conn.end();
  }
}

export async function saveResume(
  userId: number,
  fileName: string,
  candidateName: string,
  parsedData: any,
  docxBase64: string,
  paid: boolean,
  stripeSessionId?: string,
  preScore?: number,
  postScore?: number,
  scoreDimensions?: any,
  originalFileUrl?: string
): Promise<number> {
  const conn = await getDb();
  if (!conn) throw new Error("Database not available");
  try {
    const [result] = await conn.execute(
      `INSERT INTO riq_resumes (userId, originalFileName, candidateName, parsedData, docxBase64, paid, stripeSessionId, preScore, postScore, scoreDimensions, originalFileUrl)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, fileName, candidateName, JSON.stringify(parsedData), docxBase64, paid ? 1 : 0, stripeSessionId || null, preScore || null, postScore || null, scoreDimensions ? JSON.stringify(scoreDimensions) : null, originalFileUrl || null]
    ) as any;
    return result.insertId;
  } finally {
    await conn.end();
  }
}

export async function getUserResumes(userId: number) {
  const conn = await getDb();
  if (!conn) return [];
  try {
    const [rows] = await conn.execute(
      `SELECT id, originalFileName, candidateName, paid, createdAt
       FROM riq_resumes WHERE userId = ? ORDER BY createdAt DESC`,
      [userId]
    ) as any;
    return rows;
  } finally {
    await conn.end();
  }
}

export async function getResumeById(id: number, userId: number) {
  const conn = await getDb();
  if (!conn) return null;
  try {
    const [rows] = await conn.execute(
      "SELECT * FROM riq_resumes WHERE id = ? AND userId = ?",
      [id, userId]
    ) as any;
    return rows[0] || null;
  } finally {
    await conn.end();
  }
}

export async function upgradeToStarter(userId: number) {
  const conn = await getDb();
  if (!conn) return;
  try {
    await conn.execute(
      "UPDATE riq_users SET plan = 'starter' WHERE id = ? AND plan = 'free'",
      [userId]
    );
  } finally {
    await conn.end();
  }
}

export async function upgradeToMonthly(userId: number, daysAccess: number = 30) {
  const conn = await getDb();
  if (!conn) return;
  try {
    const expiresAt = new Date(Date.now() + daysAccess * 24 * 60 * 60 * 1000);
    await conn.execute(
      "UPDATE riq_users SET plan = 'monthly', planExpiresAt = ? WHERE id = ?",
      [expiresAt, userId]
    );
    console.log(`[ResumeIQ] User ${userId} upgraded to monthly plan, expires ${expiresAt.toISOString()}`);
  } finally {
    await conn.end();
  }
}

export async function incrementResumeCount(userId: number) {
  const conn = await getDb();
  if (!conn) return;
  try {
    await conn.execute(
      "UPDATE riq_users SET resumeCount = resumeCount + 1 WHERE id = ?",
      [userId]
    );
  } finally {
    await conn.end();
  }
}

export async function getLastGuestSession(guestId: string): Promise<any | null> {
  const conn = await getDb();
  if (!conn) return null;
  try {
    const [rows] = await conn.execute(
      `SELECT sessionId, parsedData, paid, createdAt FROM riq_sessions
       WHERE guestId = ? AND expiresAt > NOW() ORDER BY createdAt DESC LIMIT 1`,
      [guestId]
    ) as any[];
    const data = Array.isArray(rows[0]) ? rows[0] : rows;
    if (!data[0]) return null;
    const parsed = typeof data[0].parsedData === "string" ? JSON.parse(data[0].parsedData) : data[0].parsedData;
    return { sessionId: data[0].sessionId, parsedData: parsed, paid: !!data[0].paid, createdAt: data[0].createdAt };
  } catch { return null; }
  finally { await conn.end(); }
}

export async function mergeGuestSessionsToUser(guestId: string, userId: number): Promise<void> {
  const conn = await getDb();
  if (!conn) return;
  try {
    const [rows] = await conn.execute(
      `SELECT sessionId, parsedData FROM riq_sessions WHERE guestId = ? AND paid = 1`,
      [guestId]
    ) as any[];
    const sessions = Array.isArray(rows[0]) ? rows[0] : rows;
    for (const s of sessions) {
      const parsed = typeof s.parsedData === "string" ? JSON.parse(s.parsedData) : s.parsedData;
      if (parsed?.name) {
        await conn.execute(
          `INSERT IGNORE INTO riq_resumes (userId, parsedData, createdAt) VALUES (?, ?, NOW())`,
          [userId, JSON.stringify(parsed)]
        );
        await conn.execute(`UPDATE riq_users SET resumeCount = resumeCount + 1 WHERE id = ?`, [userId]);
      }
    }
    await conn.execute(`UPDATE riq_sessions SET guestId = NULL WHERE guestId = ?`, [guestId]);
  } catch { /* non-critical */ }
  finally { await conn.end(); }
}

export async function captureEmail(email: string, name: string) {
  const conn = await getDb();
  if (!conn) return;
  try {
    await conn.execute(
      "INSERT IGNORE INTO riq_email_captures (email, name) VALUES (?, ?)",
      [email, name]
    );
  } catch { } finally {
    await conn.end();
  }
}
