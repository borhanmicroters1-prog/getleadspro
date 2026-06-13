"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, UserProfile } from "@/utils/auth";
import { api } from "@/utils/api";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

interface EmailAccountItem {
  id: string;
  provider: "gmail" | "brevo";
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

  // Gmail form state
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
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar />
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

        </main>
      </div>
    </div>
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

const providerBadgeStyle = (provider: "gmail" | "brevo"): React.CSSProperties => {
  const isGmail = provider === "gmail";
  return {
    fontSize: "9px",
    fontWeight: 700,
    padding: "0.25rem 0.6rem",
    borderRadius: "4px",
    borderWidth: "1px",
    borderStyle: "solid",
    letterSpacing: "0.05em",
    backgroundColor: isGmail ? "rgba(234, 67, 53, 0.1)" : "rgba(0, 146, 255, 0.1)",
    borderColor: isGmail ? "rgba(234, 67, 53, 0.3)" : "rgba(0, 146, 255, 0.3)",
    color: isGmail ? "rgb(234, 67, 53)" : "rgb(0, 146, 255)"
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
