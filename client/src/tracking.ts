// ResumeIQ analytics tracking
// Lightweight event tracker — extend to wire up Segment, PostHog, etc.

export function trackEvent(event: string, properties?: Record<string, any>) {
  try {
    if (typeof window === "undefined") return;
    if (import.meta.env.DEV) {
      console.log("[track]", event, properties);
    }
    // Extend here: window.analytics?.track(event, properties)
  } catch {
    // Never let tracking break the app
  }
}

export function captureEmail(email: string, source: string) {
  trackEvent("email_captured", { email, source });
}
