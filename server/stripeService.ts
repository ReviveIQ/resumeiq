/**
 * ResumeIQ Stripe Integration
 * Handles payment sessions for resume transformations
 *
 * Live mode is always active. Stripe key determines live vs test:
 *   sk_live_... = live payments
 *   sk_test_... = test payments (dev only)
 */

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;

const STRIPE_PRICE       = 1499;  // $14.99 — starter (3 transformations)
const STRIPE_MONTHLY     = 1999;  // $19.99 — 30 days unlimited (monthly)
const STRIPE_PERSONALITY = 799;   // $7.99 Working With Me add-on
const STRIPE_BUNDLE      = 1999;  // $19.99 resume + Working With Me
const STRIPE_CAREER      = 7999;  // $79.99 Career Launch (resume + WM + 60 days MyCareerIQ)
const STRIPE_MYCAREERIQ  = 4999;  // $49.99 MyCareerIQ standalone (30 days)
const STRIPE_MYCAREERIQ_ANNUAL = 29900; // $299/year MyCareerIQ annual
const CURRENCY = "usd";

// Log Stripe key mode on startup
const keyPrefix = STRIPE_SECRET?.slice(0, 7);
if (keyPrefix === "sk_live") {
  console.log("[Stripe] ✅ LIVE MODE — real payments enabled");
} else if (keyPrefix === "sk_test") {
  console.log("[Stripe] ⚠️  TEST KEY detected — no real charges will occur");
} else {
  console.log("[Stripe] ❌ No Stripe key configured");
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
  sessionId: string,
  utmData: Record<string, string> = {}
): Promise<{ url: string; sessionId: string }> {
  const session = await stripePost({
    "payment_method_types[0]": "card",
    "line_items[0][price_data][currency]": CURRENCY,
    "line_items[0][price_data][product_data][name]": "ResumeIQ Starter",
    "line_items[0][price_data][product_data][description]": "3 resume transformations — ATS-optimized Word documents, re-downloadable anytime",
    "line_items[0][price_data][unit_amount]": String(STRIPE_PRICE),
    "line_items[0][quantity]": "1",
    mode: "payment",
    success_url: `${successUrl}session_id={CHECKOUT_SESSION_ID}&resumeiq_session=${sessionId}`,
    cancel_url: cancelUrl,
    "metadata[resumeiq_session]": sessionId,
    "metadata[type]": "resume",
    ...(utmData.utm_source ? { "metadata[utm_source]": utmData.utm_source } : {}),
    ...(utmData.utm_medium ? { "metadata[utm_medium]": utmData.utm_medium } : {}),
    ...(utmData.utm_campaign ? { "metadata[utm_campaign]": utmData.utm_campaign } : {}),
    ...(utmData.utm_content ? { "metadata[utm_content]": utmData.utm_content } : {}),
    ...(utmData.referrer ? { "metadata[referrer]": utmData.referrer } : {}),
    ...(utmData.landing_url ? { "metadata[landing_url]": utmData.landing_url } : {}),
  });
  return { url: session.url, sessionId: session.id };
}

export async function createPersonalityCheckoutSession(
  successUrl: string,
  cancelUrl: string,
  resumeiqSession: string,
  utmData: Record<string, string> = {}
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
    ...(utmData.utm_source ? { "metadata[utm_source]": utmData.utm_source } : {}),
    ...(utmData.utm_medium ? { "metadata[utm_medium]": utmData.utm_medium } : {}),
    ...(utmData.utm_campaign ? { "metadata[utm_campaign]": utmData.utm_campaign } : {}),
    ...(utmData.utm_content ? { "metadata[utm_content]": utmData.utm_content } : {}),
    ...(utmData.referrer ? { "metadata[referrer]": utmData.referrer } : {}),
    ...(utmData.landing_url ? { "metadata[landing_url]": utmData.landing_url } : {}),
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
    ...(utmData.utm_source ? { "metadata[utm_source]": utmData.utm_source } : {}),
    ...(utmData.utm_medium ? { "metadata[utm_medium]": utmData.utm_medium } : {}),
    ...(utmData.utm_campaign ? { "metadata[utm_campaign]": utmData.utm_campaign } : {}),
    ...(utmData.utm_content ? { "metadata[utm_content]": utmData.utm_content } : {}),
    ...(utmData.referrer ? { "metadata[referrer]": utmData.referrer } : {}),
    ...(utmData.landing_url ? { "metadata[landing_url]": utmData.landing_url } : {}),
  });
  return { url: session.url, sessionId: session.id };
}

export async function createCareerLaunchSession(
  successUrl: string,
  cancelUrl: string,
  resumeiqSession: string
): Promise<{ url: string; sessionId: string }> {
  const session = await stripePost({
    "payment_method_types[0]": "card",
    "line_items[0][price_data][currency]": CURRENCY,
    "line_items[0][price_data][product_data][name]": "Career Launch Bundle",
    "line_items[0][price_data][product_data][description]": "ATS-optimized resume + Working With Me section + 60 days MyCareerIQ job search pipeline — $14.99 + $7.99 + $49.99 value for $79.99",
    "line_items[0][price_data][unit_amount]": String(STRIPE_CAREER),
    "line_items[0][quantity]": "1",
    mode: "payment",
    success_url: `${successUrl}session_id={CHECKOUT_SESSION_ID}&resumeiq_session=${resumeiqSession}&type=career`,
    cancel_url: cancelUrl,
    "metadata[resumeiq_session]": resumeiqSession,
    "metadata[type]": "career",
    ...(utmData.utm_source ? { "metadata[utm_source]": utmData.utm_source } : {}),
    ...(utmData.utm_medium ? { "metadata[utm_medium]": utmData.utm_medium } : {}),
    ...(utmData.utm_campaign ? { "metadata[utm_campaign]": utmData.utm_campaign } : {}),
    ...(utmData.utm_content ? { "metadata[utm_content]": utmData.utm_content } : {}),
    ...(utmData.referrer ? { "metadata[referrer]": utmData.referrer } : {}),
    ...(utmData.landing_url ? { "metadata[landing_url]": utmData.landing_url } : {}),
  });
  return { url: session.url, sessionId: session.id };
}

export async function createMonthlySession(
  successUrl: string,
  cancelUrl: string,
  resumeiqSession: string
): Promise<{ url: string; sessionId: string }> {
  const session = await stripePost({
    "payment_method_types[0]": "card",
    "line_items[0][price_data][currency]": CURRENCY,
    "line_items[0][price_data][product_data][name]": "ResumeIQ Monthly — Unlimited",
    "line_items[0][price_data][product_data][description]": "Unlimited resume transformations for 30 days — re-downloadable anytime. No auto-renewal.",
    "line_items[0][price_data][unit_amount]": String(STRIPE_MONTHLY),
    "line_items[0][quantity]": "1",
    mode: "payment",
    success_url: `${successUrl}session_id={CHECKOUT_SESSION_ID}&resumeiq_session=${resumeiqSession}&type=monthly`,
    cancel_url: cancelUrl,
    "metadata[resumeiq_session]": resumeiqSession,
    "metadata[type]": "monthly",
    ...(utmData.utm_source ? { "metadata[utm_source]": utmData.utm_source } : {}),
    ...(utmData.utm_medium ? { "metadata[utm_medium]": utmData.utm_medium } : {}),
    ...(utmData.utm_campaign ? { "metadata[utm_campaign]": utmData.utm_campaign } : {}),
    ...(utmData.utm_content ? { "metadata[utm_content]": utmData.utm_content } : {}),
    ...(utmData.referrer ? { "metadata[referrer]": utmData.referrer } : {}),
    ...(utmData.landing_url ? { "metadata[landing_url]": utmData.landing_url } : {}),
  });
  return { url: session.url, sessionId: session.id };
}

export async function createMyCareerIQSession(
  successUrl: string,
  cancelUrl: string,
  resumeiqSession: string,
  annual = false
): Promise<{ url: string; sessionId: string }> {
  const amount = annual ? STRIPE_MYCAREERIQ_ANNUAL : STRIPE_MYCAREERIQ;
  const label = annual ? "MyCareerIQ — Annual Access" : "MyCareerIQ — 30 Day Access";
  const desc = annual
    ? "Full job search pipeline — 365 days access, $299/year (~$25/month)"
    : "Full job search pipeline — 30 days access, no auto-renewal";
  const session = await stripePost({
    "payment_method_types[0]": "card",
    "line_items[0][price_data][currency]": CURRENCY,
    "line_items[0][price_data][product_data][name]": label,
    "line_items[0][price_data][product_data][description]": desc,
    "line_items[0][price_data][unit_amount]": String(amount),
    "line_items[0][quantity]": "1",
    mode: "payment",
    success_url: `${successUrl}session_id={CHECKOUT_SESSION_ID}&resumeiq_session=${resumeiqSession}&type=mycareeriq`,
    cancel_url: cancelUrl,
    "metadata[resumeiq_session]": resumeiqSession,
    "metadata[type]": annual ? "mycareeriq_annual" : "mycareeriq",
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
  return STRIPE_SECRET?.startsWith("sk_live") ? "live" : "test";
}
