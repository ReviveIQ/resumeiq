/**
 * ResumeIQ Stripe Integration
 * Handles payment sessions for resume transformations
 *
 * STRIPE_TEST_MODE env var:
 *   Set to "true" in Railway to force test keys even in production.
 *   Uses STRIPE_SECRET_KEY_TEST + STRIPE_PUBLISHABLE_KEY_TEST when active.
 *   Remove or set to "false" to go live with real payments.
 */

const isTestMode = process.env.STRIPE_TEST_MODE === "true";

// In test mode, fall back to test-specific keys if provided, otherwise use the main key
const STRIPE_SECRET = isTestMode
  ? (process.env.STRIPE_SECRET_KEY_TEST || process.env.STRIPE_SECRET_KEY)
  : process.env.STRIPE_SECRET_KEY;

const STRIPE_PRICE       = 999;   // $9.99 resume
const STRIPE_PERSONALITY = 399;   // $3.99 personality unlock
const STRIPE_BUNDLE      = 1398;  // $13.98 resume + personality
const CURRENCY = "usd";

// Log mode on startup
if (isTestMode) {
  console.log("[Stripe] ⚠️  TEST MODE active — no real charges will occur");
} else {
  console.log("[Stripe] ✅ LIVE MODE — real payments enabled");
}

async function stripePost(body: Record<string, string>): Promise<any> {
  if (!STRIPE_SECRET) throw new Error("STRIPE_SECRET_KEY not configured");
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${STRIPE_SECRET}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  if (!res.ok) throw new Error(`Stripe error: ${await res.text()}`);
  return res.json();
}

export async function createCheckoutSession(
  successUrl: string,
  cancelUrl: string,
  sessionId: string
): Promise<{ url: string; sessionId: string }> {
  const session = await stripePost({
    "payment_method_types[0]": "card",
    "line_items[0][price_data][currency]": CURRENCY,
    "line_items[0][price_data][product_data][name]": "ResumeIQ Resume Transformation",
    "line_items[0][price_data][product_data][description]": "Professional ATS-optimized resume — re-downloadable anytime",
    "line_items[0][price_data][unit_amount]": String(STRIPE_PRICE),
    "line_items[0][quantity]": "1",
    mode: "payment",
    success_url: `${successUrl}session_id={CHECKOUT_SESSION_ID}&resumeiq_session=${sessionId}`,
    cancel_url: cancelUrl,
    "metadata[resumeiq_session]": sessionId,
    "metadata[type]": "resume",
  });
  return { url: session.url, sessionId: session.id };
}

export async function createPersonalityCheckoutSession(
  successUrl: string,
  cancelUrl: string,
  resumeiqSession: string
): Promise<{ url: string; sessionId: string }> {
  const session = await stripePost({
    "payment_method_types[0]": "card",
    "line_items[0][price_data][currency]": CURRENCY,
    "line_items[0][price_data][product_data][name]": "ResumeIQ — Working With Me",
    "line_items[0][price_data][product_data][description]": "Personality synthesis added to your resume — unlocked forever on all future resumes",
    "line_items[0][price_data][unit_amount]": String(STRIPE_PERSONALITY),
    "line_items[0][quantity]": "1",
    mode: "payment",
    success_url: `${successUrl}session_id={CHECKOUT_SESSION_ID}&resumeiq_session=${resumeiqSession}&type=personality`,
    cancel_url: cancelUrl,
    "metadata[resumeiq_session]": resumeiqSession,
    "metadata[type]": "personality",
  });
  return { url: session.url, sessionId: session.id };
}

export async function createBundleCheckoutSession(
  successUrl: string,
  cancelUrl: string,
  resumeiqSession: string
): Promise<{ url: string; sessionId: string }> {
  const session = await stripePost({
    "payment_method_types[0]": "card",
    "line_items[0][price_data][currency]": CURRENCY,
    "line_items[0][price_data][product_data][name]": "ResumeIQ Resume + Working With Me",
    "line_items[0][price_data][product_data][description]": "ATS-optimized resume + personality synthesis — unlocked forever",
    "line_items[0][price_data][unit_amount]": String(STRIPE_BUNDLE),
    "line_items[0][quantity]": "1",
    mode: "payment",
    success_url: `${successUrl}session_id={CHECKOUT_SESSION_ID}&resumeiq_session=${resumeiqSession}&type=bundle`,
    cancel_url: cancelUrl,
    "metadata[resumeiq_session]": resumeiqSession,
    "metadata[type]": "bundle",
  });
  return { url: session.url, sessionId: session.id };
}

export async function verifyPayment(stripeSessionId: string): Promise<boolean> {
  if (!STRIPE_SECRET) return false;
  try {
    const res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${stripeSessionId}`,
      { headers: { Authorization: `Bearer ${STRIPE_SECRET}` } }
    );
    if (!res.ok) return false;
    const session = await res.json() as any;
    return session.payment_status === "paid";
  } catch {
    return false;
  }
}

export function getStripeMode(): "test" | "live" {
  return isTestMode ? "test" : "live";
}
