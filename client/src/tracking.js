/**
 * ResumeIQ Frontend Tracking Snippet
 * Drop this into your site's main JS or as a <script> tag.
 * Captures UTM params, fires events, and handles email capture.
 *
 * Usage: import and call trackEvent() anywhere in your app.
 */

const MARKETING_API = 'https://api.resumeiq.reviveiqi.com'; // update to your API URL

// ─── Session ID ─────────────────────────────────────────────────────────────
function getSessionId() {
  let sid = sessionStorage.getItem('riq_session');
  if (!sid) {
    sid = 'riq_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    sessionStorage.setItem('riq_session', sid);
  }
  return sid;
}

// ─── UTM Attribution (call once on page load) ────────────────────────────────
async function captureAttribution() {
  const params = new URLSearchParams(window.location.search);
  const source   = params.get('utm_source')   || document.referrer ? new URL(document.referrer || location.href).hostname.replace('www.','') : 'direct';
  const medium   = params.get('utm_medium')   || 'organic';
  const campaign = params.get('utm_campaign') || '';
  const content  = params.get('utm_content')  || '';

  await fetch(`${MARKETING_API}/api/attribution`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId:  getSessionId(),
      source,
      medium,
      campaign,
      content,
      landingUrl: window.location.href,
      referrer:   document.referrer,
    }),
  }).catch(() => {}); // never block UX
}

// ─── Event Tracker ───────────────────────────────────────────────────────────
async function trackEvent(eventType, metadata = {}) {
  await fetch(`${MARKETING_API}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: getSessionId(),
      eventType,
      metadata,
    }),
  }).catch(() => {});
}

// ─── Email Capture ───────────────────────────────────────────────────────────
async function captureEmail(email, capturePoint = 'upload_gate') {
  await fetch(`${MARKETING_API}/api/email-capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      sessionId:    getSessionId(),
      capturePoint,
    }),
  }).catch(() => {});
}

// ─── Auto-fire on page load ──────────────────────────────────────────────────
captureAttribution();
trackEvent('page_view', { path: window.location.pathname });

// ─── Export for use in your app ──────────────────────────────────────────────
export { trackEvent, captureEmail, getSessionId };

// ─── Usage examples ──────────────────────────────────────────────────────────
/*
// When user uploads a resume:
trackEvent('resume_uploaded', { fileSize: file.size, fileName: file.name });

// When user provides email at upload gate:
captureEmail(userEmail, 'upload_gate');

// When user views the preview:
trackEvent('preview_viewed');

// When user clicks checkout:
trackEvent('checkout_started', { plan: 'basic' });

// After payment completes (also call the API to trigger confirmation email):
trackEvent('payment_completed', { plan: 'basic', amount: 9.99 });
fetch(`${MARKETING_API}/api/trigger-conversion-email`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: userEmail, sessionId: getSessionId() }),
});

// When resume is generated/downloaded:
trackEvent('resume_generated');
*/
