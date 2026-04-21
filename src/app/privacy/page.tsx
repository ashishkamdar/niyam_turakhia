export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-sm text-gray-300">
      <h1 className="mb-6 text-2xl font-bold text-white">Privacy Policy</h1>
      <p className="mb-4 text-xs text-gray-500">Last updated: April 2026</p>

      <h2 className="mb-2 mt-6 text-lg font-semibold text-white">1. Overview</h2>
      <p>PrismX is a trade management system operated by AREA KPI Technology for Jinyi Gold HK. This policy explains how we handle data collected through the application and the WhatsApp Business API integration.</p>

      <h2 className="mb-2 mt-6 text-lg font-semibold text-white">2. Data We Collect</h2>
      <ul className="ml-4 list-disc space-y-1">
        <li>WhatsApp messages sent to our business number (trade lock codes, text, and images)</li>
        <li>Sender phone number and WhatsApp profile name</li>
        <li>Login sessions (IP address, device type, timestamps)</li>
        <li>Trade data entered through the application</li>
      </ul>

      <h2 className="mb-2 mt-6 text-lg font-semibold text-white">3. How We Use Data</h2>
      <ul className="ml-4 list-disc space-y-1">
        <li>Processing and recording precious metals trades</li>
        <li>Maker-checker review and approval workflows</li>
        <li>Dispatching approved trades to accounting systems (OroSoft, SBS)</li>
        <li>Generating reports, stock-in-hand calculations, and audit trails</li>
        <li>Session management and security (brute-force protection, login tracking)</li>
      </ul>

      <h2 className="mb-2 mt-6 text-lg font-semibold text-white">4. Data Storage</h2>
      <p>All data is stored on secure servers. WhatsApp messages and trade records are retained for business and regulatory purposes. Payment screenshots attached to trades are stored on the server filesystem.</p>

      <h2 className="mb-2 mt-6 text-lg font-semibold text-white">5. Data Sharing</h2>
      <p>We do not sell or share personal data with third parties. Trade data is transmitted to the business&apos;s own accounting systems (OroSoft Neo, SBS) as part of normal business operations. WhatsApp message data is processed via Meta&apos;s Cloud API in accordance with Meta&apos;s terms of service.</p>

      <h2 className="mb-2 mt-6 text-lg font-semibold text-white">6. Security</h2>
      <p>Access is protected by PIN-based authentication with role-based access control. Sessions are encrypted via HTTPS. Brute-force protection locks accounts after repeated failed login attempts. Backups support AES-256-GCM encryption.</p>

      <h2 className="mb-2 mt-6 text-lg font-semibold text-white">7. Contact</h2>
      <p>For questions about this privacy policy, contact:</p>
      <p className="mt-2">AREA KPI Technology<br />302 Saumitra, 295-A Bhimani Street Matunga, Mumbai - 400019, India<br />Email: connect@areakpi.com</p>
    </div>
  );
}
