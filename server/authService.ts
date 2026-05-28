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
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
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
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_userId (userId)
      )
    `);
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
    return { id: result.insertId, email, name };
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

export async function getUserById(id: number) {
  const conn = await getDb();
  if (!conn) return null;
  try {
    const [rows] = await conn.execute(
      "SELECT id, email, name, plan, resumeCount, personalityUnlocked, workingWithMeData, createdAt FROM riq_users WHERE id = ?", [id]
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
  stripeSessionId?: string
): Promise<number> {
  const conn = await getDb();
  if (!conn) throw new Error("Database not available");
  try {
    const [result] = await conn.execute(
      `INSERT INTO riq_resumes (userId, originalFileName, candidateName, parsedData, docxBase64, paid, stripeSessionId)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, fileName, candidateName, JSON.stringify(parsedData), docxBase64, paid ? 1 : 0, stripeSessionId || null]
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
