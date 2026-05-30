/**
 * ResumeIQ Frontend Tracking
 * Fires events and attribution data to /api/events and /api/attribution
 * on the same server — no external dependencies, no phantom subdomains.
 */

// ─── Session ID ──────────────────────────────────────────────────────────────
function getSessionId(): string {
  try {
    let sid = sessionStorage.getItem("riq_session");
    if (!sid) {
      sid = "riq_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
      sessionStorage.setItem("riq_session", sid);
    }
    return sid;
  } catch { return "riq_unknown"; }
}

// ─── UTM Attribution ─────────────────────────────────────────────────────────
export async function captureAttribution(): Promise<void> {
  try {
    const params = new URLSearchParams(window.location.search);
    const referrerHost = document.referrer
      ? new URL(document.referrer).hostname.replace("www.", "")
      : "direct";
    const source   = params.get("utm_source")   || referrerHost;
    const medium   = params.get("utm_medium")   || "organic";
    const campaign = params.get("utm_campaign") || "";
    const content  = params.get("utm_content")  || "";

    // Only fire if there's something useful to record
    if (source === "direct" && !campaign) return;

    await fetch("/api/resumeiq/attribution", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: getSessionId(),
        source, medium, campaign, content,
        landingUrl: window.location.href,
        referrer: document.referrer,
      }),
    });
  } catch { /* never block UX */ }
}

// ─── Event Tracker ───────────────────────────────────────────────────────────
export async function trackEvent(eventType: string, metadata: Record<string, any> = {}): Promise<void> {
  try {
    if (import.meta.env.DEV) {
      console.log("[track]", eventType, metadata);
    }
    await fetch("/api/resumeiq/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: getSessionId(),
        eventType,
        metadata,
        path: window.location.pathname,
      }),
    });
  } catch { /* never block UX */ }
}

// ─── Email Capture ───────────────────────────────────────────────────────────
export async function captureEmail(email: string, capturePoint = "upload_gate"): Promise<void> {
  try {
    await fetch("/api/resumeiq/capture-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, capturePoint, sessionId: getSessionId() }),
    });
  } catch { /* never block UX */ }
}

export { getSessionId };
