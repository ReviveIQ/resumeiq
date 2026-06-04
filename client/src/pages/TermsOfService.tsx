export default function TermsOfService() {
  return (
    <div style={{ minHeight: "100vh", background: "#080f1e", padding: "48px 16px", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ maxWidth: "760px", margin: "0 auto", background: "#0f172a", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.08)", padding: "48px", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>

        <div style={{ marginBottom: "40px" }}>
          <h1 style={{ fontSize: "32px", fontWeight: 800, color: "white", margin: "0 0 8px 0", fontFamily: "'Montserrat', sans-serif" }}>
            Terms of Service
          </h1>
          <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
            ReviveIQI · ResumeIQ · Last updated: June 2026
          </p>
        </div>

        <div style={{ lineHeight: "1.8", color: "#94a3b8", fontSize: "15px" }}>

          <section style={{ marginBottom: "36px" }}>
            <h2 style={h2}>1. Agreement to Terms</h2>
            <p>
              By accessing or using ResumeIQ ("the Service"), operated by ReviveIQI ("we," "us," or "our"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. These Terms apply to all users, including visitors, registered users, and paying customers.
            </p>
          </section>

          <section style={{ marginBottom: "36px" }}>
            <h2 style={h2}>2. Description of Service</h2>
            <p style={{ marginBottom: "12px" }}>
              ResumeIQ is an AI-powered resume transformation tool. You upload a resume document, and we use artificial intelligence (OpenAI GPT-4o) to analyze, restructure, and improve it for ATS compatibility and recruiter readability. The output is a Word document (.docx) delivered for download.
            </p>
            <p>
              The Service also provides optional features including resume scoring, personality assessment synthesis ("Working With Me" sections), and integration with MyCareerIQ for job search pipeline management.
            </p>
          </section>

          <section style={{ marginBottom: "36px" }}>
            <h2 style={h2}>3. Accounts and Registration</h2>
            <ul style={ul}>
              <li>You must create an account to download transformed resumes. You may sign up with email/password or via LinkedIn OAuth.</li>
              <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
              <li>You must be at least 16 years old to use the Service.</li>
              <li>You agree to provide accurate, current information and keep it updated.</li>
              <li>We reserve the right to suspend or terminate accounts that violate these Terms.</li>
            </ul>
          </section>

          <section style={{ marginBottom: "36px" }}>
            <h2 style={h2}>4. Free Tier and Paid Services</h2>
            <ul style={ul}>
              <li><strong style={{ color: "#e2e8f0" }}>Free tier:</strong> Your first resume transformation is free. No credit card required.</li>
              <li><strong style={{ color: "#e2e8f0" }}>Paid services:</strong> Additional transformations and add-ons are charged as described on the pricing page at checkout. Prices are in USD.</li>
              <li><strong style={{ color: "#e2e8f0" }}>No auto-renewal:</strong> All purchases are one-time transactions. We do not automatically charge you for recurring purchases without your explicit consent.</li>
              <li><strong style={{ color: "#e2e8f0" }}>Refunds:</strong> If your transformation fails to deliver a usable document due to a technical error on our part, contact us within 7 days for a full refund. We do not offer refunds for completed, successfully delivered transformations where you are dissatisfied with the AI output — resume transformation is subjective and we encourage you to use the free tier to evaluate quality before purchasing.</li>
              <li><strong style={{ color: "#e2e8f0" }}>Payment processing:</strong> Payments are processed by Stripe. Your payment data is governed by Stripe's terms and never stored on our servers.</li>
            </ul>
          </section>

          <section style={{ marginBottom: "36px" }}>
            <h2 style={h2}>5. Your Content and Intellectual Property</h2>
            <ul style={ul}>
              <li><strong style={{ color: "#e2e8f0" }}>You own your resume.</strong> The resume you upload remains your property. The transformed output document also belongs to you. We claim no intellectual property rights over your resume content or the transformed output.</li>
              <li><strong style={{ color: "#e2e8f0" }}>License to process:</strong> By uploading your resume, you grant us a limited, non-exclusive license to process it through our AI systems for the sole purpose of generating your transformed output. This license terminates when you delete your account.</li>
              <li><strong style={{ color: "#e2e8f0" }}>No training use:</strong> We do not use your resume content to train AI models. We use OpenAI's API with enterprise terms that prohibit training on API inputs.</li>
              <li><strong style={{ color: "#e2e8f0" }}>Personality assessments:</strong> If you upload personality assessment documents (DISC, MBTI, PI, etc.), the same terms apply. The synthesized "Working With Me" output belongs to you.</li>
            </ul>
          </section>

          <section style={{ marginBottom: "36px" }}>
            <h2 style={h2}>6. AI-Generated Content Disclaimer</h2>
            <p style={{ marginBottom: "12px" }}>
              ResumeIQ uses artificial intelligence to transform resume content. You acknowledge and agree that:
            </p>
            <ul style={ul}>
              <li>AI-generated output may contain errors, inaccuracies, or content that does not accurately reflect your experience.</li>
              <li>You are solely responsible for reviewing the transformed resume before submitting it to any employer.</li>
              <li>We take significant steps to prevent AI hallucination (inventing facts not in your original resume), but we cannot guarantee this entirely. Always verify the output against your original document.</li>
              <li>Submitting a resume with inaccurate information to employers is your responsibility, not ours.</li>
              <li>The transformed resume is a starting point. We recommend editing it to ensure it accurately represents your experience.</li>
            </ul>
          </section>

          <section style={{ marginBottom: "36px" }}>
            <h2 style={h2}>7. Acceptable Use</h2>
            <p style={{ marginBottom: "12px" }}>You agree not to:</p>
            <ul style={ul}>
              <li>Upload documents containing malware, viruses, or malicious code</li>
              <li>Attempt to reverse-engineer, scrape, or extract our AI prompts or systems</li>
              <li>Use the Service to process resumes on behalf of others for commercial resale without our written permission</li>
              <li>Abuse the free tier through automated submissions or circumventing usage limits</li>
              <li>Use the Service for any unlawful purpose or in violation of any applicable law</li>
              <li>Impersonate another person or submit documents belonging to someone else without authorization</li>
            </ul>
          </section>

          <section style={{ marginBottom: "36px" }}>
            <h2 style={h2}>8. Privacy</h2>
            <p>
              Your use of the Service is governed by our <a href="/privacy" style={link}>Privacy Policy</a>, which is incorporated into these Terms by reference. By using the Service, you consent to the data practices described in the Privacy Policy.
            </p>
          </section>

          <section style={{ marginBottom: "36px" }}>
            <h2 style={h2}>9. Service Availability and Modifications</h2>
            <ul style={ul}>
              <li>We do not guarantee uninterrupted access to the Service. We may perform maintenance, updates, or experience downtime.</li>
              <li>We reserve the right to modify, suspend, or discontinue any feature of the Service at any time with reasonable notice where possible.</li>
              <li>We may update pricing with at least 30 days notice to existing users.</li>
            </ul>
          </section>

          <section style={{ marginBottom: "36px" }}>
            <h2 style={h2}>10. Limitation of Liability</h2>
            <p style={{ marginBottom: "12px" }}>
              To the fullest extent permitted by law:
            </p>
            <ul style={ul}>
              <li>The Service is provided "as is" and "as available" without warranties of any kind, express or implied.</li>
              <li>We are not liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service.</li>
              <li>Our total liability to you for any claim arising from these Terms or your use of the Service shall not exceed the amount you paid us in the 12 months preceding the claim.</li>
              <li>We are not responsible for employment outcomes — including whether using our Service results in job interviews, offers, or employment.</li>
            </ul>
          </section>

          <section style={{ marginBottom: "36px" }}>
            <h2 style={h2}>11. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless ReviveIQI, its officers, employees, and agents from any claims, losses, damages, or expenses (including reasonable legal fees) arising from your use of the Service, your violation of these Terms, or your violation of any third-party rights.
            </p>
          </section>

          <section style={{ marginBottom: "36px" }}>
            <h2 style={h2}>12. Governing Law and Disputes</h2>
            <p>
              These Terms are governed by the laws of the State of Florida, United States, without regard to conflict of law provisions. Any disputes shall be resolved in the courts of Broward County, Florida. If you are a consumer in the EU/UK, you retain any rights you have under applicable consumer protection laws.
            </p>
          </section>

          <section style={{ marginBottom: "36px" }}>
            <h2 style={h2}>13. Changes to Terms</h2>
            <p>
              We may update these Terms as the Service evolves. Material changes will be communicated via email or in-app notice at least 14 days before taking effect. Continued use after the effective date constitutes acceptance. If you disagree with changes, you may close your account before they take effect.
            </p>
          </section>

          <section>
            <h2 style={h2}>14. Contact</h2>
            <p>
              ReviveIQI · Fort Lauderdale, Florida<br />
              <a href="mailto:bryan@reviveiqi.com" style={link}>bryan@reviveiqi.com</a><br />
              Response time: within 5 business days
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}

const h2: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 700,
  color: "white",
  marginBottom: "12px",
  fontFamily: "'Montserrat', sans-serif",
};

const ul: React.CSSProperties = {
  paddingLeft: "20px",
  margin: "0 0 8px 0",
  lineHeight: "1.9",
};

const link: React.CSSProperties = {
  color: "#60a5fa",
  textDecoration: "underline",
};
