/**
 * ResumeIQ Stripe Integration
 * Handles payment sessions for resume transformations
 */

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const STRIPE_PRICE = 999; // $9.99 in cents
const CURRENCY = "usd";

export async function createCheckoutSession(
  successUrl: string,
  cancelUrl: string,
  sessionId: string
): Promise<{ url: string; sessionId: string }> {
  if (!STRIPE_SECRET) throw new Error("STRIPE_SECRET_KEY not configured");

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      "payment_method_types[0]": "card",
      "line_items[0][price_data][currency]": CURRENCY,
      "line_items[0][price_data][product_data][name]": "ResumeIQ Resume Transformation",
      "line_items[0][price_data][product_data][description]": "Professional ATS-optimized resume transformation powered by AI",
      "line_items[0][price_data][unit_amount]": String(STRIPE_PRICE),
      "line_items[0][quantity]": "1",
      mode: "payment",
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}&resumeiq_session=${sessionId}`,
      cancel_url: cancelUrl,
      "metadata[resumeiq_session]": sessionId,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Stripe error: ${err}`);
  }

  const session = await res.json() as any;
  return { url: session.url, sessionId: session.id };
}

export async function verifyPayment(stripeSessionId: string): Promise<boolean> {
  if (!STRIPE_SECRET) return false;

  try {
    const res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${stripeSessionId}`,
      {
        headers: { Authorization: `Bearer ${STRIPE_SECRET}` },
      }
    );

    if (!res.ok) return false;
    const session = await res.json() as any;
    return session.payment_status === "paid";
  } catch {
    return false;
  }
}
