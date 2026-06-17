"use client";

import { useEffect, useState } from "react";
import { api } from "@/utils/api";

interface WarmupAccount {
  account_id: string;
  user_email: string;
  from_email: string;
  provider: string;
  health_score: number;
  emails_sent_today: number;
  daily_limit: number;
  warmup_started_at: string | null;
}

interface SeedAccount {
  id: string;
  user_id: string;
  provider: string;
  from_email: string;
  from_name: string;
  daily_limit: number;
  emails_sent_today: number;
  is_active: boolean;
  is_system_seed: boolean;
  warmup_enabled: boolean;
  warmup_status: string;
  warmup_health_score: number;
  created_at: string | null;
}

export default function AdminWarmupPoolPage() {
  const [activeTab, setActiveTab] = useState<"pool" | "seeds">("pool");
  
  // Warmup Pool States
  const [pool, setPool] = useState<WarmupAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Seed Accounts States
  const [seeds, setSeeds] = useState<SeedAccount[]>([]);
  const [seedsLoading, setSeedsLoading] = useState(false);
  const [seedsError, setSeedsError] = useState("");

  // Seed Form States
  const [provider, setProvider] = useState<"gmail" | "outlook" | "webmail">("gmail");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [appPasswordOrApiKey, setAppPasswordOrApiKey] = useState("");
  const [dailyLimit, setDailyLimit] = useState<string>("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("993");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const loadWarmupPool = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api.get("/api/admin/warmup-pool");
      setPool(data);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to load active warmup pool.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const loadSeedAccounts = async () => {
    try {
      setSeedsLoading(true);
      setSeedsError("");
      const data = await api.get("/api/admin/warmup/seeds");
      setSeeds(data);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to load system seed accounts.";
      setSeedsError(errMsg);
    } finally {
      setSeedsLoading(false);
    }
  };

  useEffect(() => {
    // Defer execution to avoid synchronous state updates during rendering / effect loop
    const timer = setTimeout(() => {
      if (activeTab === "pool") {
        loadWarmupPool();
      } else {
        loadSeedAccounts();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [activeTab]);

  const handleAddSeed = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError("");
    setFormSuccess("");

    if (!fromName.trim() || !fromEmail.trim() || !appPasswordOrApiKey.trim()) {
      setFormError("Please fill in all required fields.");
      setFormSubmitting(false);
      return;
    }

    if (provider === "webmail") {
      if (!smtpHost.trim() || !smtpPort.trim() || !imapHost.trim() || !imapPort.trim()) {
        setFormError("Please fill in all SMTP and IMAP host/port details.");
        setFormSubmitting(false);
        return;
      }
    }

    try {
      if (provider === "gmail") {
        await api.post("/api/admin/warmup/seed/gmail", {
          from_name: fromName.trim(),
          from_email: fromEmail.trim().toLowerCase(),
          app_password: appPasswordOrApiKey.trim(),
          daily_limit: dailyLimit ? parseInt(dailyLimit.toString(), 10) : 50
        });
      } else if (provider === "outlook") {
        await api.post("/api/admin/warmup/seed/outlook", {
          from_name: fromName.trim(),
          from_email: fromEmail.trim().toLowerCase(),
          app_password: appPasswordOrApiKey.trim(),
          daily_limit: dailyLimit ? parseInt(dailyLimit.toString(), 10) : 50
        });
      } else if (provider === "webmail") {
        await api.post("/api/admin/warmup/seed/webmail", {
          from_name: fromName.trim(),
          from_email: fromEmail.trim().toLowerCase(),
          smtp_host: smtpHost.trim(),
          smtp_port: parseInt(smtpPort.trim(), 10),
          imap_host: imapHost.trim(),
          imap_port: parseInt(imapPort.trim(), 10),
          password: appPasswordOrApiKey.trim(),
          daily_limit: dailyLimit ? parseInt(dailyLimit.toString(), 10) : 50
        });
      }

      setFormSuccess(`Successfully connected system seed ${provider.toUpperCase()} account.`);
      setFromName("");
      setFromEmail("");
      setAppPasswordOrApiKey("");
      setDailyLimit("");
      setSmtpHost("");
      setSmtpPort("587");
      setImapHost("");
      setImapPort("993");
      loadSeedAccounts();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to connect seed account.";
      setFormError(errMsg);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteSeed = async (accountId: string, email: string) => {
    if (!window.confirm(`Are you sure you want to disconnect and delete the seed account ${email}?`)) {
      return;
    }
    try {
      await api.delete(`/api/admin/warmup/seed/${accountId}`);
      loadSeedAccounts();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to disconnect seed account.";
      alert(errMsg);
    }
  };

  const getHealthBadgeClass = (score: number) => {
    if (score >= 90) return "badge-success";
    if (score >= 70) return "badge-warning";
    return "badge-danger";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-fade-in">
      
      {/* Header with Navigation & Action */}
      <div style={headerRowStyle}>
        <div>
          <h3 style={sectionTitleStyle}>🔥 Automatic Warm-up Dashboard</h3>
          <p style={sectionSubStyle}>Monitor general warmup pool accounts and configure system-level seed accounts</p>
        </div>
        <button 
          onClick={activeTab === "pool" ? loadWarmupPool : loadSeedAccounts} 
          className="btn btn-secondary" 
          disabled={activeTab === "pool" ? loading : seedsLoading}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Tabs Layout */}
      <div style={tabsContainerStyle}>
        <button 
          onClick={() => setActiveTab("pool")} 
          style={tabStyle(activeTab === "pool")}
        >
          Active Pool ({pool.length})
        </button>
        <button 
          onClick={() => setActiveTab("seeds")} 
          style={tabStyle(activeTab === "seeds")}
        >
          System Seeds ({seeds.length})
        </button>
      </div>

      {/* Tab Content 1: Active Pool */}
      {activeTab === "pool" && (
        <>
          {error && <div style={errorBannerStyle}>⚠️ {error}</div>}

          <div className="glass-panel" style={tableContainerStyle}>
            {loading ? (
              <div style={loadingWrapperStyle}>
                <div style={spinnerStyle} />
                <span>Scanning warm-up pool...</span>
              </div>
            ) : pool.length === 0 ? (
              <div style={noDataStyle}>No connected mailboxes are currently in warm-up mode.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={thRowStyle}>
                      <th style={thStyle}>Owner User</th>
                      <th style={thStyle}>From Email Address</th>
                      <th style={thStyle}>Provider</th>
                      <th style={thStyle}>Health Score</th>
                      <th style={thStyle}>Sent Today</th>
                      <th style={thStyle}>Started At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pool.map((acc) => (
                      <tr key={acc.account_id} style={trStyle}>
                        <td style={tdStyle}>{acc.user_email}</td>
                        <td style={tdStyle}>
                          <span style={{ fontWeight: 600, color: "hsl(var(--text-primary))" }}>{acc.from_email}</span>
                        </td>
                        <td style={tdStyle}>
                          <span className="badge badge-primary" style={{ textTransform: "capitalize" }}>
                            {acc.provider}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span className={`badge ${getHealthBadgeClass(acc.health_score)}`}>
                            {acc.health_score}% Health
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ color: "hsl(var(--text-primary))", fontWeight: 500 }}>
                            {acc.emails_sent_today} / {acc.daily_limit}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {acc.warmup_started_at ? new Date(acc.warmup_started_at).toLocaleDateString() : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Tab Content 2: System Seeds */}
      {activeTab === "seeds" && (
        <div style={twoColGridStyle}>
          {/* Add System Seed Form */}
          <div className="glass-panel" style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.25rem", height: "fit-content" }}>
            <div>
              <h4 style={{ fontSize: "1.05rem", fontWeight: 600, color: "hsl(var(--text-primary))", marginBottom: "0.25rem" }}>
                Connect Seed Mailbox
              </h4>
              <p style={{ fontSize: "0.8rem", color: "hsl(var(--text-muted))" }}>
                Add admin-managed seed accounts to the global warmup pool
              </p>
            </div>

            {formError && <div style={errorBannerStyle}>⚠️ {formError}</div>}
            {formSuccess && <div style={successBannerStyle}>✅ {formSuccess}</div>}

            <form onSubmit={handleAddSeed} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={formGroupStyle}>
                <label style={labelStyle}>Provider</label>
                <select 
                  className="input-field"
                  value={provider} 
                  onChange={(e) => {
                    setProvider(e.target.value as "gmail" | "outlook" | "webmail");
                    setFormError("");
                    setFormSuccess("");
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <option value="gmail">Gmail</option>
                  <option value="outlook">Outlook</option>
                  <option value="webmail">Custom Webmail</option>
                </select>
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>From Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Outreach Team"
                  className="input-field"
                  value={fromName} 
                  onChange={(e) => setFromName(e.target.value)}
                  required
                />
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>From Email</label>
                <input 
                  type="email" 
                  placeholder="e.g. seed@yourdomain.com"
                  className="input-field"
                  value={fromEmail} 
                  onChange={(e) => setFromEmail(e.target.value)}
                  required
                />
              </div>

              {provider === "webmail" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div style={formGroupStyle}>
                      <label style={labelStyle}>SMTP Host</label>
                      <input 
                        type="text" 
                        placeholder="smtp.example.com"
                        className="input-field"
                        value={smtpHost} 
                        onChange={(e) => setSmtpHost(e.target.value)}
                        required
                      />
                    </div>
                    <div style={formGroupStyle}>
                      <label style={labelStyle}>SMTP Port</label>
                      <input 
                        type="number" 
                        placeholder="587"
                        className="input-field"
                        value={smtpPort} 
                        onChange={(e) => setSmtpPort(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div style={formGroupStyle}>
                      <label style={labelStyle}>IMAP Host</label>
                      <input 
                        type="text" 
                        placeholder="imap.example.com"
                        className="input-field"
                        value={imapHost} 
                        onChange={(e) => setImapHost(e.target.value)}
                        required
                      />
                    </div>
                    <div style={formGroupStyle}>
                      <label style={labelStyle}>IMAP Port</label>
                      <input 
                        type="number" 
                        placeholder="993"
                        className="input-field"
                        value={imapPort} 
                        onChange={(e) => setImapPort(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              <div style={formGroupStyle}>
                <label style={labelStyle}>
                  {provider === "gmail" ? "Gmail App Password" : provider === "outlook" ? "Outlook App Password" : "Password"}
                </label>
                <input 
                  type="password" 
                  placeholder={
                    provider === "gmail" 
                      ? "16-character app password" 
                      : provider === "outlook" 
                      ? "Outlook App Password" 
                      : "Password"
                  }
                  className="input-field"
                  value={appPasswordOrApiKey} 
                  onChange={(e) => setAppPasswordOrApiKey(e.target.value)}
                  required
                />
                <span style={{ fontSize: "0.75rem", color: "hsl(var(--text-muted))", marginTop: "0.25rem" }}>
                  {provider === "gmail" 
                    ? "Generate via Google Account > Security > 2-Step Verification > App passwords"
                    : provider === "outlook"
                    ? "Generate via Microsoft Account Security > App Passwords"
                    : "Enter Webmail SMTP/IMAP login password"}
                </span>
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>Daily Volume Limit (Optional)</label>
                <input 
                  type="number" 
                  placeholder="Default: 50"
                  className="input-field"
                  value={dailyLimit} 
                  onChange={(e) => setDailyLimit(e.target.value)}
                  min={1}
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: "100%", marginTop: "0.5rem" }}
                disabled={formSubmitting}
              >
                {formSubmitting ? "Connecting Account..." : "🔌 Connect Seed Account"}
              </button>
            </form>
          </div>

          {/* Seeds List */}
          <div className="glass-panel" style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <h4 style={{ fontSize: "1.05rem", fontWeight: 600, color: "hsl(var(--text-primary))", marginBottom: "0.25rem" }}>
                Active Seed Accounts ({seeds.length})
              </h4>
              <p style={{ fontSize: "0.8rem", color: "hsl(var(--text-muted))" }}>
                Currently participating in global reputation warming
              </p>
            </div>

            {seedsError && <div style={errorBannerStyle}>⚠️ {seedsError}</div>}

            {seedsLoading ? (
              <div style={loadingWrapperStyle}>
                <div style={spinnerStyle} />
                <span>Loading seeds list...</span>
              </div>
            ) : seeds.length === 0 ? (
              <div style={noDataStyle}>No system seed accounts configured. Add one on the left.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={thRowStyle}>
                      <th style={thStyle}>Email & Sender</th>
                      <th style={thStyle}>Provider</th>
                      <th style={thStyle}>Warmup</th>
                      <th style={thStyle}>Limit</th>
                      <th style={thStyle}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seeds.map((acc) => (
                      <tr key={acc.id} style={trStyle}>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontWeight: 600, color: "hsl(var(--text-primary))" }}>{acc.from_email}</span>
                            <span style={{ fontSize: "0.75rem", color: "hsl(var(--text-muted))" }}>{acc.from_name}</span>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <span className="badge badge-primary" style={{ textTransform: "capitalize" }}>
                            {acc.provider}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            <span className={`badge ${getHealthBadgeClass(acc.warmup_health_score)}`} style={{ width: "fit-content" }}>
                              {acc.warmup_health_score}%
                            </span>
                            <span style={{ fontSize: "0.7rem", color: "hsl(var(--success))", fontWeight: 600 }}>
                              {acc.warmup_status.toUpperCase()}
                            </span>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontWeight: 500 }}>{acc.daily_limit}</span>
                        </td>
                        <td style={tdStyle}>
                          <button 
                            onClick={() => handleDeleteSeed(acc.id, acc.from_email)}
                            className="btn"
                            style={deleteBtnStyle}
                            title="Disconnect Seed"
                          >
                            🗑️ Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

// Inline Styles
const headerRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "1rem",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "1.25rem",
  color: "hsl(var(--text-primary))",
};

const sectionSubStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "hsl(var(--text-muted))",
};

const errorBannerStyle: React.CSSProperties = {
  padding: "0.75rem 1.25rem",
  backgroundColor: "hsl(var(--danger) / 10%)",
  border: "1px solid hsl(var(--danger) / 20%)",
  color: "hsl(var(--danger))",
  borderRadius: "12px",
  fontSize: "0.85rem",
};

const successBannerStyle: React.CSSProperties = {
  padding: "0.75rem 1.25rem",
  backgroundColor: "hsl(var(--success) / 10%)",
  border: "1px solid hsl(var(--success) / 20%)",
  color: "hsl(var(--success))",
  borderRadius: "12px",
  fontSize: "0.85rem",
};

const tableContainerStyle: React.CSSProperties = {
  padding: "1.5rem 2rem",
};

const loadingWrapperStyle: React.CSSProperties = {
  padding: "4rem",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "1rem",
  color: "hsl(var(--text-secondary))",
};

const spinnerStyle: React.CSSProperties = {
  width: "30px",
  height: "30px",
  border: "2.5px solid hsl(var(--border-color))",
  borderTopColor: "hsl(var(--accent))",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
};

const noDataStyle: React.CSSProperties = {
  padding: "3rem",
  textAlign: "center",
  color: "hsl(var(--text-muted))",
  fontSize: "0.95rem",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "0.875rem",
};

const thRowStyle: React.CSSProperties = {
  borderBottom: "2.5px solid hsl(var(--border-color))",
};

const thStyle: React.CSSProperties = {
  padding: "0.75rem 1rem",
  textAlign: "left",
  fontWeight: 600,
  color: "hsl(var(--text-muted))",
  textTransform: "uppercase",
  fontSize: "0.75rem",
  letterSpacing: "0.05em",
};

const trStyle: React.CSSProperties = {
  borderBottom: "1px solid hsl(var(--border-color))",
  transition: "background-color 0.2s ease",
};

const tdStyle: React.CSSProperties = {
  padding: "1rem",
  color: "hsl(var(--text-secondary))",
  verticalAlign: "middle",
};

// Tabs Container Styles
const tabsContainerStyle: React.CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  borderBottom: "1px solid hsl(var(--border-color))",
  paddingBottom: "0.5rem",
  marginBottom: "0.5rem",
};

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: "0.55rem 1.25rem",
  cursor: "pointer",
  borderRadius: "10px",
  fontWeight: 600,
  fontSize: "0.875rem",
  transition: "all 0.2s ease",
  backgroundColor: active ? "hsl(var(--accent) / 12%)" : "transparent",
  color: active ? "hsl(var(--accent))" : "hsl(var(--text-muted))",
  border: active ? "1px solid hsl(var(--accent) / 30%)" : "1px solid transparent",
  outline: "none",
});

const twoColGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
  gap: "1.5rem",
};

const formGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  fontWeight: 500,
  color: "hsl(var(--text-secondary))",
};

const deleteBtnStyle: React.CSSProperties = {
  padding: "0.4rem 0.8rem",
  fontSize: "0.8rem",
  backgroundColor: "hsl(var(--danger) / 10%)",
  border: "1px solid hsl(var(--danger) / 30%)",
  color: "hsl(var(--danger))",
  cursor: "pointer",
  transition: "all 0.2s ease",
};
