export default function PrivacyPolicy() {
  return (
    <div style={{ minHeight: "100vh", background: "#080f1e", padding: "48px 16px", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ maxWidth: "760px", margin: "0 auto", background: "#0f172a", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.08)", padding: "48px", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>

        <div style={{ marginBottom: "40px" }}>
          <h1 style={{ fontSize: "32px", fontWeight: 800, color: "white", margin: "0 0 8px 0", fontFamily: "'Montserrat', sans-serif" }}>
            Privacy Policy
          </h1>
          <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
            ReviveIQI · ResumeIQ · Last updated: June 2026
          </p>
        </div>

        <div style={{ lineHeight: "1.8", color: "#94a3b8", fontSize: "15px" }}>

          <section style={{ marginBottom: "36px" }}>
            <h2 style={h2}>1. Who We Are</h2>
            <p>
              ResumeIQ is a resume transformation product operated by ReviveIQI, based in Fort Lauderdale, Florida.
              We use AI to rewrite resumes into ATS-optimized, polished Word documents ready for job applications.
              Contact us at <a href="mailto:bryan@reviveiqi.com" style={link}>bryan@reviveiqi.com</a>.
            </p>
          </section>

          <section style={{ marginBottom: "36px" }}>
            <h2 style={h2}>2. What We Collect</h2>
            <ul style={ul}>
              <li><strong style={{ color: "#e2e8f0" }}>Account information:</strong> Name, email address, and password (hashed) when you register. If you sign in with LinkedIn, we receive your name, email, and LinkedIn profile ID from LinkedIn's OpenID Connect service.</li>
              <li><strong style={{ color: "#e2e8f0" }}>Resume content:</strong> When you upload a resume, we process the document text to extract your career history, skills, and experience. This content is sent to OpenAI for transformation and stored in our database linked to your account so you can re-download your results.</li>
              <li><strong style={{ color: "#e2e8f0" }}>Personality assessment content:</strong> If you upload personality assessments (DISC, MBTI, PI, etc.), that content is sent to OpenAI to generate a "Working With Me" profile section. We do not store the raw assessment files.</li>
              <li><strong style={{ color: "#e2e8f0" }}>Payment information:</strong> Processed by Stripe. We do not store card numbers or payment credentials. We store your transaction record and Stripe session ID.</li>
              <li><strong style={{ color: "#e2e8f0" }}>Usage data:</strong> Pages visited, features used, and resume download events.</li>
            </ul>
          </section>

          <section style={{ marginBottom: "36px" }}>
            <h2 style={h2}>3. How We Use Your Information</h2>
            <ul style={ul}>
              <li>To transform your resume using AI and generate a downloadable Word document</li>
              <li>To generate optional "Working With Me" sections from personality assessments</li>
              <li>To store your transformed resumes so you can re-download them</li>
              <li>To process one-time payments via Stripe</li>
              <li>To send transactional emails (order confirmation, download links)</li>
              <li>To improve our product and diagnose technical issues</li>
            </ul>
          </section>

          <section style={{ marginBottom: "36px" }}>
            <h2 style={h2}>4. Third-Party Services We Use</h2>
            <ul style={ul}>
              <li><strong style={{ color: "#e2e8f0" }}>OpenAI:</strong> Your resume text and any uploaded assessment content is sent to OpenAI's GPT-4o API for transformation and analysis. OpenAI processes this per their <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer" style={link}>privacy policy</a>. We use API access — your data is not used to train OpenAI models.</li>
              <li><strong style={{ color: "#e2e8f0" }}>LinkedIn:</strong> If you sign in with LinkedIn, we receive your name, email, and profile identifier via LinkedIn's OpenID Connect service. This data is used solely to create and maintain your ResumeIQ account. LinkedIn's <a href="https://www.linkedin.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" style={link}>privacy policy</a> applies.</li>
              <li><strong style={{ color: "#e2e8f0" }}>Stripe:</strong> Payment processing for one-time resume purchases. Card data is handled entirely by Stripe and never stored on our servers.</li>
              <li><strong style={{ color: "#e2e8f0" }}>Resend:</strong> Transactional email delivery (order confirmations, download notifications).</li>
              <li><strong style={{ color: "#e2e8f0" }}>TiDB Cloud:</strong> All application data is stored in a TiDB Cloud database on AWS US-East-1.</li>
              <li><strong style={{ color: "#e2e8f0" }}>Railway:</strong> Our application runs on Railway's cloud infrastructure.</li>
            </ul>
          </section>

          <section style={{ marginBottom: "36px" }}>
            <h2 style={h2}>5. LinkedIn Data Use</h2>
            <p>
              When you authenticate with LinkedIn, we use the data provided solely to create and maintain your ResumeIQ account. We do not sell LinkedIn data, share it with advertisers, or use it for any purpose beyond operating your account. We comply with LinkedIn's API Terms of Service.
            </p>
          </section>

          <section style={{ marginBottom: "36px" }}>
            <h2 style={h2}>6. Resume Content & AI Processing</h2>
            <p>
              Your resume content is sent to OpenAI for transformation. We do not use your resume content for any purpose beyond generating your transformed document. We do not sell resume content or share it with third parties beyond OpenAI as described above. Transformed resumes are stored in our database linked to your account and are accessible only to you.
            </p>
          </section>

          <section style={{ marginBottom: "36px" }}>
            <h2 style={h2}>7. Data Retention</h2>
            <ul style={ul}>
              <li><strong style={{ color: "#e2e8f0" }}>Account data:</strong> Retained while your account is active. Deleted within 30 days of account deletion request.</li>
              <li><strong style={{ color: "#e2e8f0" }}>Transformed resumes:</strong> Retained indefinitely so you can re-download. Deleted on account deletion.</li>
              <li><strong style={{ color: "#e2e8f0" }}>Payment records:</strong> Retained for 7 years per financial record-keeping requirements.</li>
              <li><strong style={{ color: "#e2e8f0" }}>Usage logs:</strong> Retained for 90 days.</li>
            </ul>
            <p style={{ marginTop: "12px" }}>To request deletion, email <a href="mailto:bryan@reviveiqi.com" style={link}>bryan@reviveiqi.com</a>.</p>
          </section>

          <section style={{ marginBottom: "36px" }}>
            <h2 style={h2}>8. Your Rights</h2>
            <ul style={ul}>
              <li>Access a copy of your personal data and transformed resumes</li>
              <li>Correct inaccurate account information</li>
              <li>Request deletion of your account and all associated data</li>
              <li>Request data portability</li>
              <li>Withdraw consent for data processing at any time</li>
            </ul>
            <p style={{ marginTop: "12px" }}>
              California residents have additional rights under CCPA. EU/UK residents have rights under GDPR.
              Contact <a href="mailto:bryan@reviveiqi.com" style={link}>bryan@reviveiqi.com</a> to exercise any right.
            </p>
          </section>

          <section style={{ marginBottom: "36px" }}>
            <h2 style={h2}>9. Security</h2>
            <p>
              Passwords are hashed using bcrypt. Data in transit is encrypted via TLS. Database connections use SSL. Payment card data is never stored on our servers. Despite these measures, no system is 100% secure.
            </p>
          </section>

          <section style={{ marginBottom: "36px" }}>
            <h2 style={h2}>10. Cookies</h2>
            <p>
              We use session cookies for OAuth CSRF protection during LinkedIn sign-in. Authentication tokens are stored in your browser's localStorage. We do not use advertising cookies or third-party tracking.
            </p>
          </section>

          <section style={{ marginBottom: "36px" }}>
            <h2 style={h2}>11. Children's Privacy</h2>
            <p>
              ResumeIQ is not directed at children under 16. We do not knowingly collect personal information from anyone under 16.
            </p>
          </section>

          <section style={{ marginBottom: "36px" }}>
            <h2 style={h2}>12. Changes to This Policy</h2>
            <p>
              We may update this policy as our product evolves. Material changes will be communicated via email or an in-app notice.
            </p>
          </section>

          <section>
            <h2 style={h2}>13. Contact</h2>
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
