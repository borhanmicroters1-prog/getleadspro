"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, UserProfile } from "@/utils/auth";
import { api } from "@/utils/api";
interface EmailAccountItem {
  id: string;
  provider: "gmail" | "brevo" | "webmail";
  from_email: string;
  from_name: string;
  daily_limit: number;
  emails_sent_today: number;
  is_active: boolean;
  warmup_enabled: boolean;
  warmup_status: "idle" | "warming" | "paused";
  warmup_health_score: number;
}

export default function EmailAccountsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<EmailAccountItem[]>([]);
  const [isGmailConnecting, setIsGmailConnecting] = useState(false);
  const [isBrevoConnecting, setIsBrevoConnecting] = useState(false);
  const [error, setError] = useState("");

  // DNS Modal State
  const [selectedDnsAccount, setSelectedDnsAccount] = useState<{ id: string; email: string } | null>(null);
  const [dnsResults, setDnsResults] = useState<any>(null);
  const [loadingDns, setLoadingDns] = useState(false);
  const [isDnsModalOpen, setIsDnsModalOpen] = useState(false);

  const handleCheckDNS = async (accountId: string, email: string) => {
    setSelectedDnsAccount({ id: accountId, email });
    setDnsResults(null);
    setLoadingDns(true);
    setIsDnsModalOpen(true);
    try {
      const data = await api.get(`/api/email-accounts/${accountId}/verify-dns`);
      setDnsResults(data);
    } catch (err: any) {
      console.error("Error verifying DNS:", err);
      alert("Failed to fetch DNS records: " + err.message);
      setIsDnsModalOpen(false);
    } finally {
      setLoadingDns(false);
    }
  };

  // Webmail form state
  const [webmailName, setWebmailName] = useState("");
  const [webmailEmail, setWebmailEmail] = useState("");
  const [webmailSmtpHost, setWebmailSmtpHost] = useState("");
  const [webmailSmtpPort, setWebmailSmtpPort] = useState(587);
  const [webmailImapHost, setWebmailImapHost] = useState("");
  const [webmailImapPort, setWebmailImapPort] = useState(993);
  const [webmailPassword, setWebmailPassword] = useState("");
  const [webmailLimit, setWebmailLimit] = useState(50);
  const [isWebmailConnecting, setIsWebmailConnecting] = useState(false);
  const [gmailName, setGmailName] = useState("");
  const [gmailEmail, setGmailEmail] = useState("");
  const [gmailAppPassword, setGmailAppPassword] = useState("");
  const [gmailLimit, setGmailLimit] = useState(50);
  const [gmailConnectMethod, setGmailConnectMethod] = useState<"oauth" | "app_password">("app_password");

  // Brevo form state
  const [brevoName, setBrevoName] = useState("");
  const [brevoEmail, setBrevoEmail] = useState("");
  const [brevoApiKey, setBrevoApiKey] = useState("");
  const [brevoLimit, setBrevoLimit] = useState(300);

  useEffect(() => {
    const currentUser = auth.getCurrentUser();
    if (!currentUser) {
      router.push("/login");
    } else {
      setUser(currentUser);
      setLoading(false);
    }
  }, [router]);

  const fetchAccounts = async () => {
    try {
      const data = await api.get("/api/email-accounts");
      setAccounts(data || []);
      setError("");
    } catch (err: any) {
      console.error("Error fetching email accounts:", err);
      setError("Failed to fetch");
    }
  };

  useEffect(() => {
    if (user) {
      fetchAccounts();
    }
  }, [user]);


  const handleConnectGmailSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gmailName || !gmailEmail || !gmailAppPassword) {
      setError("Please fill in all Gmail App Password connection fields.");
      return;
    }

    setIsGmailConnecting(true);
    setError("");
    try {
      await api.post("/api/email-accounts/gmail/connect", {
        app_password: gmailAppPassword,
        from_email: gmailEmail,
        from_name: gmailName,
        daily_limit: Number(gmailLimit)
      });
      // Clear Gmail form fields
      setGmailName("");
      setGmailEmail("");
      setGmailAppPassword("");
      setGmailLimit(50);
      fetchAccounts();
    } catch (err: any) {
      setError(err.message || "Failed to connect Gmail SMTP account.");
    } finally {
      setIsGmailConnecting(false);
    }
  };

  const handleConnectBrevo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brevoName || !brevoEmail || !brevoApiKey) {
      setError("Please fill in all Brevo connection fields.");
      return;
    }

    setIsBrevoConnecting(true);
    setError("");
    try {
      await api.post("/api/email-accounts/brevo/connect", {
        api_key: brevoApiKey,
        from_email: brevoEmail,
        from_name: brevoName,
        daily_limit: Number(brevoLimit)
      });
      // Clear Brevo form fields
      setBrevoName("");
      setBrevoEmail("");
      setBrevoApiKey("");
      setBrevoLimit(300);
      fetchAccounts();
    } catch (err: any) {
      setError(err.message || "Failed to connect Brevo account.");
    } finally {
      setIsBrevoConnecting(false);
    }
  };

  const handleConnectWebmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webmailName || !webmailEmail || !webmailSmtpHost || !webmailPassword || !webmailImapHost) {
      setError("Please fill in all required Webmail fields.");
      return;
    }

    setIsWebmailConnecting(true);
    setError("");
    try {
      await api.post("/api/email-accounts/webmail/connect", {
        from_name: webmailName,
        from_email: webmailEmail,
        smtp_host: webmailSmtpHost,
        smtp_port: Number(webmailSmtpPort),
        imap_host: webmailImapHost,
        imap_port: Number(webmailImapPort),
        password: webmailPassword,
        daily_limit: Number(webmailLimit)
      });
      // Clear Webmail form fields
      setWebmailName("");
      setWebmailEmail("");
      setWebmailSmtpHost("");
      setWebmailSmtpPort(587);
      setWebmailImapHost("");
      setWebmailImapPort(993);
      setWebmailPassword("");
      setWebmailLimit(50);
      fetchAccounts();
    } catch (err: any) {
      setError(err.message || "Failed to connect Webmail account.");
    } finally {
      setIsWebmailConnecting(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm("Are you sure you want to disconnect this mailbox?")) return;
    setError("");
    try {
      await api.delete(`/api/email-accounts/${id}`);
      fetchAccounts();
    } catch (err: any) {
      setError(err.message || "Failed to delete account.");
    }
  };

  const totalDailyLimit = accounts.reduce((acc, curr) => acc + curr.daily_limit, 0);

  if (loading || !user) {
    return (
      <div style={loadingContainerStyle}>
        <div style={spinnerStyle} />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    
        <main className="content-pane animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          {/* Stats Summary Cards */}
          <div style={statsSummaryGridStyle}>
            <div className="glass-panel" style={summaryCardStyle}>
              <span style={summaryLabelStyle}>Connected Mailboxes</span>
              <span style={summaryValueStyle}>{accounts.length}</span>
            </div>
            <div className="glass-panel" style={summaryCardStyle}>
              <span style={summaryLabelStyle}>Combined Daily Quota</span>
              <span style={summaryValueStyle}>{totalDailyLimit} emails/day</span>
            </div>
          </div>

          {error && (
            <div style={errorBannerStyle}>
              ⚠️ {error}
            </div>
          )}

          {/* Connection Forms Row */}
          <div style={formsRowGridStyle}>
            {/* Gmail Connection Card */}
            <div className="glass-panel" style={connectionCardStyle}>
              <div style={cardHeaderStyle}>
                <div style={gmailLogoStyle}>G</div>
                <h3 style={cardTitleStyle}>Connect Gmail Account</h3>
              </div>


                <form onSubmit={handleConnectGmailSmtp} style={brevoFormStyle}>
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>Sender Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. John Doe" 
                      value={gmailName}
                      onChange={(e) => setGmailName(e.target.value)}
                      className="input-field"
                      required
                      disabled={isGmailConnecting}
                    />
                  </div>
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>Gmail Address</label>
                    <input 
                      type="email" 
                      placeholder="e.g. yourname@gmail.com" 
                      value={gmailEmail}
                      onChange={(e) => setGmailEmail(e.target.value)}
                      className="input-field"
                      required
                      disabled={isGmailConnecting}
                    />
                  </div>
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>App Password</label>
                    <input 
                      type="password" 
                      placeholder="e.g. abcd efgh ijkl mnop" 
                      value={gmailAppPassword}
                      onChange={(e) => setGmailAppPassword(e.target.value)}
                      className="input-field"
                      required
                      disabled={isGmailConnecting}
                    />
                    <small style={{ fontSize: "11px", color: "hsl(var(--text-muted))", marginTop: "2px" }}>
                      Generate in{" "}
                      <a 
                        href="https://myaccount.google.com/apppasswords" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        style={{ color: "hsl(var(--accent))", textDecoration: "underline" }}
                      >
                        Google Account &gt; Security &gt; 2-Step Verification &gt; App Passwords
                      </a>.
                    </small>
                  </div>
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>Daily Limit</label>
                    <input 
                      type="number" 
                      min="10" 
                      max="500" 
                      value={gmailLimit}
                      onChange={(e) => setGmailLimit(Number(e.target.value))}
                      className="input-field"
                      disabled={isGmailConnecting}
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={isGmailConnecting}
                    style={{ marginTop: "0.5rem" }}
                  >
                    {isGmailConnecting ? "Connecting SMTP..." : "Connect Gmail SMTP"}
                  </button>
                </form>
            </div>

            {/* Brevo Connection Card */}
            <div className="glass-panel" style={connectionCardStyle}>
              <div style={cardHeaderStyle}>
                <div style={brevoLogoStyle}>B</div>
                <h3 style={cardTitleStyle}>Connect Brevo (SMTP)</h3>
              </div>
              <form onSubmit={handleConnectBrevo} style={brevoFormStyle}>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Sender Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. John Doe" 
                    value={brevoName}
                    onChange={(e) => setBrevoName(e.target.value)}
                    className="input-field"
                    required
                    disabled={isBrevoConnecting}
                  />
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Sender Email</label>
                  <input 
                    type="email" 
                    placeholder="e.g. john@yourdomain.com" 
                    value={brevoEmail}
                    onChange={(e) => setBrevoEmail(e.target.value)}
                    className="input-field"
                    required
                    disabled={isBrevoConnecting}
                  />
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Brevo API Key</label>
                  <input 
                    type="password" 
                    placeholder="xkeysib-..." 
                    value={brevoApiKey}
                    onChange={(e) => setBrevoApiKey(e.target.value)}
                    className="input-field"
                    required
                    disabled={isBrevoConnecting}
                  />
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Daily Limit</label>
                  <input 
                    type="number" 
                    min="50" 
                    max="10000" 
                    value={brevoLimit}
                    onChange={(e) => setBrevoLimit(Number(e.target.value))}
                    className="input-field"
                    disabled={isBrevoConnecting}
                  />
                </div>
                <button 
                  type="submit" 
                  className="btn btn-secondary"
                  disabled={isBrevoConnecting}
                  style={{ marginTop: "0.5rem" }}
                >
                  {isBrevoConnecting ? "Connecting SMTP..." : "Connect Brevo"}
                </button>
              </form>
            </div>

            {/* Custom SMTP/IMAP Webmail Connection Card */}
            <div className="glass-panel" style={connectionCardStyle}>
              <div style={cardHeaderStyle}>
                <div style={webmailLogoStyle}>W</div>
                <h3 style={cardTitleStyle}>Connect Custom SMTP/IMAP</h3>
              </div>
              <form onSubmit={handleConnectWebmail} style={brevoFormStyle}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>Sender Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. John" 
                      value={webmailName}
                      onChange={(e) => setWebmailName(e.target.value)}
                      className="input-field"
                      required
                      disabled={isWebmailConnecting}
                    />
                  </div>
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>Sender Email</label>
                    <input 
                      type="email" 
                      placeholder="john@yourdomain.com" 
                      value={webmailEmail}
                      onChange={(e) => setWebmailEmail(e.target.value)}
                      className="input-field"
                      required
                      disabled={isWebmailConnecting}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0.75rem" }}>
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>SMTP Host</label>
                    <input 
                      type="text" 
                      placeholder="smtp.yourdomain.com" 
                      value={webmailSmtpHost}
                      onChange={(e) => setWebmailSmtpHost(e.target.value)}
                      className="input-field"
                      required
                      disabled={isWebmailConnecting}
                    />
                  </div>
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>SMTP Port</label>
                    <input 
                      type="number" 
                      value={webmailSmtpPort}
                      onChange={(e) => setWebmailSmtpPort(Number(e.target.value))}
                      className="input-field"
                      required
                      disabled={isWebmailConnecting}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0.75rem" }}>
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>IMAP Host</label>
                    <input 
                      type="text" 
                      placeholder="imap.yourdomain.com" 
                      value={webmailImapHost}
                      onChange={(e) => setWebmailImapHost(e.target.value)}
                      className="input-field"
                      required
                      disabled={isWebmailConnecting}
                    />
                  </div>
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>IMAP Port</label>
                    <input 
                      type="number" 
                      value={webmailImapPort}
                      onChange={(e) => setWebmailImapPort(Number(e.target.value))}
                      className="input-field"
                      required
                      disabled={isWebmailConnecting}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>Password</label>
                    <input 
                      type="password" 
                      placeholder="Email Password" 
                      value={webmailPassword}
                      onChange={(e) => setWebmailPassword(e.target.value)}
                      className="input-field"
                      required
                      disabled={isWebmailConnecting}
                    />
                  </div>
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>Daily Limit</label>
                    <input 
                      type="number" 
                      min="10" 
                      max="10000" 
                      value={webmailLimit}
                      onChange={(e) => setWebmailLimit(Number(e.target.value))}
                      className="input-field"
                      disabled={isWebmailConnecting}
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={isWebmailConnecting}
                  style={{ marginTop: "0.25rem", background: "linear-gradient(135deg, rgb(6, 182, 212), rgb(14, 116, 144))", color: "#fff", border: "none" }}
                >
                  {isWebmailConnecting ? "Connecting SMTP..." : "Connect Custom SMTP/IMAP"}
                </button>
              </form>
            </div>
          </div>

          {/* Connected Mailboxes List */}
          <div className="glass-panel" style={accountsListPanelStyle}>
            <h3 style={{ ...panelTitleStyle, marginBottom: "1.5rem" }}>Connected Mailboxes ({accounts.length})</h3>
            
            {accounts.length > 0 ? (
              <div style={listContainerStyle}>
                {accounts.map((acc) => (
                  <div key={acc.id} style={accountItemStyle} className="glass-panel">
                    <div style={accountMainDetailsStyle}>
                      <div style={providerBadgeStyle(acc.provider)}>
                        {acc.provider.toUpperCase()}
                      </div>
                      <div style={accountNameEmailStyle}>
                        <span style={accountEmailTextStyle}>{acc.from_email}</span>
                        <span style={accountNameTextStyle}>Sender: {acc.from_name}</span>
                      </div>
                    </div>

                    <div style={accountQuotaProgressStyle}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "hsl(var(--text-secondary))", marginBottom: "0.25rem" }}>
                        <span>Sent Today</span>
                        <span><strong>{acc.emails_sent_today}</strong> / {acc.daily_limit}</span>
                      </div>
                      <div style={progressBarBgStyle}>
                        <div style={{
                          ...progressBarFillStyle,
                          width: `${Math.min(100, (acc.emails_sent_today / acc.daily_limit) * 100)}%`
                        }} />
                      </div>
                    </div>

                    <div style={accountActionsStyle}>
                      {acc.warmup_enabled && acc.warmup_status === "warming" ? (
                        <span className="badge" style={{ fontSize: "10px", backgroundColor: "rgba(16, 185, 129, 0.1)", color: "rgb(52, 211, 153)", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                          🔥 Warming ({acc.warmup_health_score}%)
                        </span>
                      ) : acc.warmup_enabled && acc.warmup_status === "paused" ? (
                        <span className="badge badge-warning" style={{ fontSize: "10px" }}>
                          ⏸️ Paused
                        </span>
                      ) : null}
                      <span className="badge badge-success" style={{ fontSize: "10px" }}>Active</span>
                      <button 
                        onClick={() => handleCheckDNS(acc.id, acc.from_email)} 
                        className="btn btn-secondary"
                        style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.25rem", height: "30px", background: "rgba(6, 182, 212, 0.1)", color: "rgb(34, 211, 238)", border: "1px solid rgba(6, 182, 212, 0.2)" }}
                      >
                        🔒 Verify DNS
                      </button>
                      <button 
                        onClick={() => router.push(`/email-accounts/${acc.id}/warm-up`)} 
                        className="btn btn-secondary"
                        style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.25rem", height: "30px" }}
                      >
                        🔥 Warm-up
                      </button>
                      <button 
                        onClick={() => handleDeleteAccount(acc.id)} 
                        style={deleteButtonStyle}
                        title="Disconnect Mailbox"
                      >
                        🗑️ Disconnect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={emptyStateStyle}>
                No email sending mailboxes connected yet. Connect your Gmail or Brevo SMTP account above to launch cold email outreach campaigns.
              </div>
            )}
          </div>

          {/* DNS Settings Verification Modal */}
          {isDnsModalOpen && selectedDnsAccount && (
            <div style={modalOverlayStyle}>
              <div className="glass-panel" style={modalContentStyle}>
                <div style={modalHeaderStyle}>
                  <h3 style={{ fontSize: "1.2rem", color: "#ffffff", margin: 0, fontWeight: 700 }}>
                    🔒 DNS Deliverability Setup: <span style={{ color: "rgb(34, 211, 238)", fontWeight: 600 }}>{selectedDnsAccount.email}</span>
                  </h3>
                  <button 
                    onClick={() => setIsDnsModalOpen(false)} 
                    style={closeButtonStyle}
                  >
                    ✕
                  </button>
                </div>

                {loadingDns ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem", gap: "1rem" }}>
                    <div style={spinnerStyle} />
                    <span style={{ color: "rgba(255, 255, 255, 0.7)", fontSize: "0.95rem" }}>Querying DNS records...</span>
                  </div>
                ) : dnsResults ? (
                  <div style={modalBodyStyle}>
                    
                    {/* Overall Score */}
                    <div style={dnsScoreContainerStyle}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.85rem", color: "rgba(255, 255, 255, 0.7)", fontWeight: 500 }}>Deliverability DNS Health Score</span>
                        <span style={{ fontSize: "1.3rem", fontWeight: 800, color: dnsResults.overall_score === 100 ? "rgb(52, 211, 153)" : dnsResults.overall_score >= 60 ? "rgb(245, 158, 11)" : "rgb(239, 68, 68)" }}>
                          {dnsResults.overall_score}%
                        </span>
                      </div>
                      <div style={dnsScoreProgressBgStyle}>
                        <div style={{
                          ...dnsScoreProgressFillStyle,
                          width: `${dnsResults.overall_score}%`,
                          backgroundColor: dnsResults.overall_score === 100 ? "rgb(52, 211, 153)" : dnsResults.overall_score >= 60 ? "rgb(245, 158, 11)" : "rgb(239, 68, 68)"
                        }} />
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginTop: "1rem" }}>
                      {/* SPF Section */}
                      <div style={dnsRecordRowStyle}>
                        <div style={dnsRecordHeaderStyle}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <strong style={{ fontSize: "0.95rem", color: "#ffffff" }}>SPF Record</strong>
                            {dnsResults.spf.status === "pass" ? (
                              <span style={dnsPassBadgeStyle}>✓ Active</span>
                            ) : (
                              <span style={dnsFailBadgeStyle}>✗ Missing</span>
                            )}
                          </div>
                        </div>
                        <p style={dnsRecordInfoStyle}>{dnsResults.spf.info}</p>
                        {dnsResults.spf.record ? (
                          <div style={dnsRecordValueStyle}>
                            <code>{dnsResults.spf.record}</code>
                          </div>
                        ) : (
                          <div style={dnsRecordValueMissingStyle}>No SPF TXT record detected in DNS.</div>
                        )}
                      </div>

                      {/* DKIM Section */}
                      <div style={dnsRecordRowStyle}>
                        <div style={dnsRecordHeaderStyle}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <strong style={{ fontSize: "0.95rem", color: "#ffffff" }}>DKIM Record</strong>
                            {dnsResults.dkim.status === "pass" ? (
                              <span style={dnsPassBadgeStyle}>✓ Active ({dnsResults.dkim.selector})</span>
                            ) : (
                              <span style={dnsFailBadgeStyle}>✗ Missing</span>
                            )}
                          </div>
                        </div>
                        <p style={dnsRecordInfoStyle}>{dnsResults.dkim.info}</p>
                        {dnsResults.dkim.record ? (
                          <div style={dnsRecordValueStyle}>
                            <code>{dnsResults.dkim.record}</code>
                          </div>
                        ) : (
                          <div style={dnsRecordValueMissingStyle}>No DKIM TXT record detected under common selectors.</div>
                        )}
                      </div>

                      {/* DMARC Section */}
                      <div style={dnsRecordRowStyle}>
                        <div style={dnsRecordHeaderStyle}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <strong style={{ fontSize: "0.95rem", color: "#ffffff" }}>DMARC Record</strong>
                            {dnsResults.dmarc.status === "pass" ? (
                              <span style={dnsPassBadgeStyle}>✓ Active</span>
                            ) : (
                              <span style={dnsFailBadgeStyle}>✗ Missing</span>
                            )}
                          </div>
                        </div>
                        <p style={dnsRecordInfoStyle}>{dnsResults.dmarc.info}</p>
                        {dnsResults.dmarc.record ? (
                          <div style={dnsRecordValueStyle}>
                            <code>{dnsResults.dmarc.record}</code>
                          </div>
                        ) : (
                          <div style={dnsRecordValueMissingStyle}>No DMARC TXT record detected at _dmarc.{dnsResults.domain}.</div>
                        )}
                      </div>
                    </div>

                    {/* Recommendations Setup Guide */}
                    {dnsResults.recommendations.length > 0 ? (
                      <div style={dnsRecommendationsBoxStyle}>
                        <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem", color: "rgb(245, 158, 11)", fontWeight: 700 }}>
                          ⚠️ Required DNS Setup Steps ({dnsResults.recommendations.length})
                        </h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", paddingLeft: "0.5rem" }}>
                          {dnsResults.recommendations.map((rec: string, idx: number) => (
                            <div key={idx} style={{ fontSize: "11px", color: "#ffffff", lineHeight: "1.4" }}>
                              <strong>{idx + 1}.</strong> {rec}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={dnsSuccessBoxStyle}>
                        🎉 <strong>Perfect Setup!</strong> All deliverability records (SPF, DKIM, and DMARC) are fully active and validated. Your emails have maximum placement score.
                      </div>
                    )}

                  </div>
                ) : (
                  <div style={{ padding: "2rem", textAlign: "center", color: "rgba(255, 255, 255, 0.5)" }}>
                    No results found.
                  </div>
                )}
              </div>
            </div>
          )}

        </main>
  );
}

// Inline Styles
const loadingContainerStyle: React.CSSProperties = {
  minHeight: "100vh",
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "1.5rem",
};

const spinnerStyle: React.CSSProperties = {
  width: "40px",
  height: "40px",
  border: "3px solid hsl(var(--border-color))",
  borderTopColor: "hsl(var(--accent))",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
};

const statsSummaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "1.5rem",
};

const summaryCardStyle: React.CSSProperties = {
  padding: "1.5rem 2rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const summaryLabelStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "hsl(var(--text-secondary))",
  fontWeight: 500,
};

const summaryValueStyle: React.CSSProperties = {
  fontSize: "1.5rem",
  color: "hsl(var(--text-primary))",
  fontWeight: 700,
  fontFamily: "var(--font-family-heading)",
};

const errorBannerStyle: React.CSSProperties = {
  padding: "0.75rem 1.5rem",
  backgroundColor: "hsl(var(--danger) / 10%)",
  border: "1px solid hsl(var(--danger) / 20%)",
  color: "hsl(var(--danger))",
  borderRadius: "12px",
  fontSize: "0.9rem",
};

const formsRowGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "2rem",
};

const connectionCardStyle: React.CSSProperties = {
  padding: "2rem",
  display: "flex",
  flexDirection: "column",
  gap: "1.5rem",
};

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "1rem",
};

const gmailLogoStyle: React.CSSProperties = {
  width: "36px",
  height: "36px",
  backgroundColor: "rgba(234, 67, 53, 0.12)",
  border: "1px solid rgba(234, 67, 53, 0.3)",
  color: "rgb(234, 67, 53)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold",
  fontSize: "1.25rem",
  borderRadius: "8px",
};

const brevoLogoStyle: React.CSSProperties = {
  width: "36px",
  height: "36px",
  backgroundColor: "rgba(0, 146, 255, 0.12)",
  border: "1px solid rgba(0, 146, 255, 0.3)",
  color: "rgb(0, 146, 255)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold",
  fontSize: "1.25rem",
  borderRadius: "8px",
};

const webmailLogoStyle: React.CSSProperties = {
  width: "36px",
  height: "36px",
  backgroundColor: "rgba(16, 185, 129, 0.12)",
  border: "1px solid rgba(16, 185, 129, 0.3)",
  color: "rgb(52, 211, 153)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold",
  fontSize: "1.25rem",
  borderRadius: "8px",
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: "1.15rem",
  color: "hsl(var(--text-primary))",
};

const cardDescriptionStyle: React.CSSProperties = {
  fontSize: "0.9rem",
  color: "hsl(var(--text-secondary))",
  lineHeight: "1.5",
};

const brevoFormStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const inputGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  color: "hsl(var(--text-secondary))",
  fontWeight: 500,
};

const accountsListPanelStyle: React.CSSProperties = {
  padding: "2rem",
};

const panelTitleStyle: React.CSSProperties = {
  fontSize: "1.15rem",
  color: "hsl(var(--text-primary))",
};

const listContainerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const accountItemStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "1.25rem 2rem",
  flexWrap: "wrap",
  gap: "1.5rem",
};

const accountMainDetailsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "1.25rem",
  flex: 1,
  minWidth: "220px",
};

const providerBadgeStyle = (provider: "gmail" | "brevo" | "webmail"): React.CSSProperties => {
  const isGmail = provider === "gmail";
  const isBrevo = provider === "brevo";
  return {
    fontSize: "9px",
    fontWeight: 700,
    padding: "0.25rem 0.6rem",
    borderRadius: "4px",
    borderWidth: "1px",
    borderStyle: "solid",
    letterSpacing: "0.05em",
    backgroundColor: isGmail 
      ? "rgba(234, 67, 53, 0.1)" 
      : isBrevo 
        ? "rgba(0, 146, 255, 0.1)" 
        : "rgba(16, 185, 129, 0.1)",
    borderColor: isGmail 
      ? "rgba(234, 67, 53, 0.3)" 
      : isBrevo 
        ? "rgba(0, 146, 255, 0.3)" 
        : "rgba(16, 185, 129, 0.3)",
    color: isGmail 
      ? "rgb(234, 67, 53)" 
      : isBrevo 
        ? "rgb(0, 146, 255)" 
        : "rgb(52, 211, 153)"
  };
};

const accountNameEmailStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.15rem",
};

const accountEmailTextStyle: React.CSSProperties = {
  fontSize: "0.95rem",
  fontWeight: 600,
  color: "hsl(var(--text-primary))",
};

const accountNameTextStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  color: "hsl(var(--text-muted))",
};

const accountQuotaProgressStyle: React.CSSProperties = {
  width: "200px",
};

const progressBarBgStyle: React.CSSProperties = {
  width: "100%",
  height: "6px",
  backgroundColor: "hsl(var(--bg-tertiary))",
  borderRadius: "3px",
  overflow: "hidden",
};

const progressBarFillStyle: React.CSSProperties = {
  height: "100%",
  backgroundColor: "hsl(var(--accent))",
  backgroundImage: "linear-gradient(90deg, hsl(var(--accent)), hsl(var(--accent-secondary)))",
  borderRadius: "3px",
};

const accountActionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "1.25rem",
};

const deleteButtonStyle: React.CSSProperties = {
  backgroundColor: "transparent",
  border: "none",
  color: "hsl(var(--danger))",
  cursor: "pointer",
  fontSize: "0.85rem",
  fontWeight: 500,
  opacity: 0.8,
  transition: "opacity 0.2s ease",
};

const emptyStateStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "3rem 2rem",
  color: "hsl(var(--text-muted))",
  fontSize: "0.95rem",
  lineHeight: "1.5",
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.75)",
  backdropFilter: "blur(8px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalContentStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "600px",
  maxHeight: "85vh",
  overflowY: "auto",
  padding: "2rem",
  display: "flex",
  flexDirection: "column",
  gap: "1.5rem",
  backgroundColor: "rgba(20, 20, 25, 0.85)",
  border: "1px solid var(--glass-border)",
  borderRadius: "16px",
  boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderBottom: "1px solid var(--glass-border)",
  paddingBottom: "1rem",
};

const modalBodyStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const closeButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "rgba(255, 255, 255, 0.6)",
  fontSize: "1.25rem",
  cursor: "pointer",
  padding: "0.25rem",
};

const dnsScoreContainerStyle: React.CSSProperties = {
  padding: "1.25rem",
  background: "rgba(255, 255, 255, 0.03)",
  border: "1px solid var(--glass-border)",
  borderRadius: "12px",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const dnsScoreProgressBgStyle: React.CSSProperties = {
  width: "100%",
  height: "6px",
  backgroundColor: "rgba(255, 255, 255, 0.08)",
  borderRadius: "3px",
  overflow: "hidden",
};

const dnsScoreProgressFillStyle: React.CSSProperties = {
  height: "100%",
  borderRadius: "3px",
  transition: "width 0.4s ease",
};

const dnsRecordRowStyle: React.CSSProperties = {
  padding: "1.25rem",
  background: "rgba(255, 255, 255, 0.02)",
  border: "1px solid var(--glass-border)",
  borderRadius: "12px",
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
};

const dnsRecordHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const dnsPassBadgeStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: "bold",
  color: "rgb(52, 211, 153)",
  backgroundColor: "rgba(16, 185, 129, 0.12)",
  padding: "0.25rem 0.5rem",
  borderRadius: "4px",
  border: "1px solid rgba(16, 185, 129, 0.2)",
};

const dnsFailBadgeStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: "bold",
  color: "rgb(239, 68, 68)",
  backgroundColor: "rgba(239, 68, 68, 0.12)",
  padding: "0.25rem 0.5rem",
  borderRadius: "4px",
  border: "1px solid rgba(239, 68, 68, 0.2)",
};

const dnsRecordInfoStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "rgba(255, 255, 255, 0.7)",
  margin: 0,
  lineHeight: "1.4",
};

const dnsRecordValueStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  background: "rgba(0, 0, 0, 0.2)",
  borderRadius: "6px",
  fontSize: "11px",
  wordBreak: "break-all",
  border: "1px solid rgba(255, 255, 255, 0.05)",
  color: "rgb(34, 211, 238)",
};

const dnsRecordValueMissingStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  background: "rgba(0, 0, 0, 0.15)",
  borderRadius: "6px",
  fontSize: "11px",
  color: "rgba(239, 68, 68, 0.9)",
  fontStyle: "italic",
};

const dnsRecommendationsBoxStyle: React.CSSProperties = {
  padding: "1.25rem",
  backgroundColor: "rgba(245, 158, 11, 0.08)",
  border: "1px solid rgba(245, 158, 11, 0.25)",
  borderRadius: "12px",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const dnsSuccessBoxStyle: React.CSSProperties = {
  padding: "1.25rem",
  backgroundColor: "rgba(16, 185, 129, 0.08)",
  border: "1px solid rgba(16, 185, 129, 0.2)",
  borderRadius: "12px",
  fontSize: "13px",
  color: "rgb(52, 211, 153)",
  lineHeight: "1.5",
};
