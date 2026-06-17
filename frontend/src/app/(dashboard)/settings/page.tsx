"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, UserProfile } from "@/utils/auth";
import { api } from "@/utils/api";
export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [customTrackingDomain, setCustomTrackingDomain] = useState("");

  // UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [telegramTestResult, setTelegramTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  useEffect(() => {
    const currentUser = auth.getCurrentUser();
    if (!currentUser) {
      router.push("/login");
    } else {
      setUser(currentUser);
      setName(currentUser.name || "");
      setAvatar(currentUser.avatar || "");
      setLoading(false);
    }
  }, [router]);

  // Fetch full details from database to populate Telegram credentials
  const loadUserSettings = async () => {
    try {
      const data = await api.get("/api/auth/me");
      setName(data.name || "");
      setAvatar(data.avatar || "");
      setTelegramToken(data.telegram_bot_token || "");
      setTelegramChatId(data.telegram_chat_id || "");
      setCustomTrackingDomain(data.custom_tracking_domain || "");
    } catch (err: any) {
      setError(err.message || "Failed to load profile details.");
    }
  };

  useEffect(() => {
    if (user) {
      loadUserSettings();
    }
  }, [user]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccess("");
    setTelegramTestResult(null);

    try {
      const updatedUser = await api.put("/api/auth/me", {
        name,
        avatar,
        telegram_bot_token: telegramToken,
        telegram_chat_id: telegramChatId,
        custom_tracking_domain: customTrackingDomain,
      });

      // Update auth store with updated profile details
      auth.updateCurrentUserProfile(updatedUser);

      setSuccess("Profile settings saved successfully.");
      // Trigger a light reload of state
      loadUserSettings();
    } catch (err: any) {
      setError(err.message || "Failed to save settings.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestTelegram = async () => {
    setIsTestingTelegram(true);
    setTelegramTestResult(null);
    setError("");

    try {
      const result = await api.post("/api/auth/telegram-test", {});
      setTelegramTestResult({ success: true, message: result.message || "Ping sent successfully!" });
    } catch (err: any) {
      setTelegramTestResult({ 
        success: false, 
        message: err.message || "Connection failed. Please verify Bot Token, Chat ID, and bot chat initialization." 
      });
    } finally {
      setIsTestingTelegram(false);
    }
  };

  if (loading || !user) {
    return (
      <div style={loadingContainerStyle}>
        <div style={spinnerStyle} />
        <span>Loading Settings...</span>
      </div>
    );
  }

  return (
    
        <main className="content-pane animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          {/* Header */}
          <div style={headerActionRowStyle}>
            <div style={headerTextWrapperStyle}>
              <h2 style={sectionTitleStyle}>Settings</h2>
              <p style={sectionSubStyle}>Manage profile details and real-time integrations</p>
            </div>
          </div>

          {error && <div style={errorBannerStyle}>⚠️ {error}</div>}
          {success && <div style={successBannerStyle}>✓ {success}</div>}

          <form onSubmit={handleSaveSettings} style={formGridStyle}>
            
            {/* Left Column: Profile Config */}
            <div className="glass-panel" style={panelStyle}>
              <h3 style={panelTitleStyle}>👤 User Profile</h3>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginTop: "1rem" }}>
                
                {/* Avatar Preview */}
                <div style={avatarPreviewWrapperStyle}>
                  <img 
                    src={avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${name || 'default'}`} 
                    alt="Avatar Preview" 
                    style={avatarStyle} 
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Avatar Avatar</span>
                    <span style={{ fontSize: "11px", color: "hsl(var(--text-muted))" }}>Seed key or direct URL for your SVG profile</span>
                  </div>
                </div>

                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Full Name</label>
                  <input 
                    type="text" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    className="input-field" 
                    required 
                  />
                </div>

                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Avatar Seed or URL</label>
                  <input 
                    type="text" 
                    value={avatar} 
                    onChange={(e) => setAvatar(e.target.value)} 
                    placeholder="e.g. Borhan or https://api.dicebear.com/..." 
                    className="input-field" 
                  />
                </div>

                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Email Address (Read-only)</label>
                  <input 
                    type="email" 
                    value={user.email} 
                    className="input-field" 
                    style={{ backgroundColor: "hsl(var(--bg-primary) / 40%)", color: "hsl(var(--text-muted))", cursor: "not-allowed" }} 
                    disabled 
                  />
                </div>

                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Custom Tracking Domain (CNAME)</label>
                  <input 
                    type="text" 
                    value={customTrackingDomain} 
                    onChange={(e) => setCustomTrackingDomain(e.target.value)} 
                    placeholder="e.g. track.yourcompany.com" 
                    className="input-field" 
                  />
                  <span style={{ fontSize: "11px", color: "hsl(var(--text-muted))", marginTop: "-0.25rem" }}>
                    Point a CNAME record from this subdomain to your backend API domain to brand your open-tracking and unsubscribe links.
                  </span>
                </div>

                <div style={readOnlyRowStyle}>
                  <div>
                    <span style={readOnlyLabelStyle}>Account Plan</span>
                    <span className="badge badge-success" style={{ marginTop: "0.25rem" }}>{user.plan} Plan</span>
                  </div>
                  <div>
                    <span style={readOnlyLabelStyle}>Scraping Credits</span>
                    <span style={{ fontSize: "1rem", fontWeight: 700, color: "hsl(var(--text-primary))", display: "block", marginTop: "0.25rem" }}>
                      🪙 {user.credits}
                    </span>
                  </div>
                </div>

              </div>
            </div>

            {/* Right Column: Telegram Notification Configuration */}
            <div className="glass-panel" style={panelStyle}>
              <h3 style={panelTitleStyle}>🤖 Telegram Bot Integration</h3>
              <p style={{ fontSize: "0.85rem", color: "hsl(var(--text-secondary))", lineHeight: 1.5, marginBottom: "1.25rem" }}>
                Receive instant alerts whenever a prospect replies to your email campaign and get a daily outreach summary report sent directly to your Telegram chat.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Telegram Bot Token</label>
                  <input 
                    type="text" 
                    value={telegramToken} 
                    onChange={(e) => setTelegramToken(e.target.value)} 
                    placeholder="e.g. 1234567890:ABCdefGhIJKlmNoPQRsT..." 
                    className="input-field" 
                  />
                </div>

                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Telegram Chat ID</label>
                  <input 
                    type="text" 
                    value={telegramChatId} 
                    onChange={(e) => setTelegramChatId(e.target.value)} 
                    placeholder="e.g. 987654321" 
                    className="input-field" 
                  />
                </div>

                {/* Instructions Accordion Panel */}
                <div style={instructionsBoxStyle}>
                  <span style={{ fontWeight: 600, fontSize: "0.8rem", color: "hsl(var(--accent-cyan))", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    How to Set Up Your Bot:
                  </span>
                  <ol style={olStyle}>
                    <li>Open Telegram and search for <b>@BotFather</b>. Send the message <code>/newbot</code>.</li>
                    <li>Follow the prompts to name your bot and get the <b>HTTP API Token</b>. Copy it here.</li>
                    <li>Search for your newly created bot username on Telegram and click <b>Start</b>.</li>
                    <li>Search for <b>@userinfobot</b> on Telegram, send any message, and copy your <b>ID</b> (Chat ID). Paste it above.</li>
                  </ol>
                </div>

                {/* Telegram Connection Testing Controls */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <button 
                    type="button" 
                    onClick={handleTestTelegram} 
                    disabled={isTestingTelegram || !telegramToken || !telegramChatId} 
                    className="btn btn-secondary"
                    style={{ width: "100%", fontSize: "0.85rem" }}
                  >
                    {isTestingTelegram ? "Testing Connection..." : "⚡ Test Telegram Connection"}
                  </button>

                  {telegramTestResult && (
                    <div style={{
                      ...testResultBoxStyle,
                      color: telegramTestResult.success ? "hsl(var(--success))" : "hsl(var(--danger))",
                      backgroundColor: telegramTestResult.success ? "hsl(var(--success) / 8%)" : "hsl(var(--danger) / 8%)",
                      borderColor: telegramTestResult.success ? "hsl(var(--success) / 20%)" : "hsl(var(--danger) / 20%)",
                    }} className="animate-fade-in">
                      {telegramTestResult.success ? "✓ " : "⚠️ "} {telegramTestResult.message}
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Bottom Actions Row */}
            <div style={actionsRowStyle}>
              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="btn btn-primary"
                style={{ minWidth: "160px" }}
              >
                {isSubmitting ? "Saving..." : "💾 Save Settings"}
              </button>
            </div>

          </form>

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

const headerActionRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const headerTextWrapperStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "1.5rem",
  color: "hsl(var(--text-primary))",
};

const sectionSubStyle: React.CSSProperties = {
  color: "hsl(var(--text-secondary))",
  fontSize: "0.9rem",
};

const errorBannerStyle: React.CSSProperties = {
  padding: "0.75rem 1.5rem",
  backgroundColor: "hsl(var(--danger) / 10%)",
  border: "1px solid hsl(var(--danger) / 20%)",
  color: "hsl(var(--danger))",
  borderRadius: "12px",
  fontSize: "0.9rem",
};

const successBannerStyle: React.CSSProperties = {
  padding: "0.75rem 1.5rem",
  backgroundColor: "hsl(var(--success) / 10%)",
  border: "1px solid hsl(var(--success) / 20%)",
  color: "hsl(var(--success))",
  borderRadius: "12px",
  fontSize: "0.9rem",
};

const formGridStyle: React.CSSProperties = {
  display: "flex",
  gap: "1.5rem",
  flexWrap: "wrap",
};

const panelStyle: React.CSSProperties = {
  padding: "2rem",
  flex: 1,
  minWidth: "320px",
};

const panelTitleStyle: React.CSSProperties = {
  fontSize: "1.15rem",
  color: "hsl(var(--text-primary))",
  marginBottom: "1rem",
};

const avatarPreviewWrapperStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "1rem",
  paddingBottom: "1rem",
  borderBottom: "1px solid hsl(var(--border-color))",
};

const avatarStyle: React.CSSProperties = {
  width: "60px",
  height: "60px",
  borderRadius: "50%",
  backgroundColor: "hsl(var(--bg-tertiary))",
  border: "2px solid hsl(var(--accent) / 40%)",
};

const inputGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "hsl(var(--text-muted))",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const readOnlyRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "2rem",
  padding: "1rem",
  background: "var(--card-bg-alt)",
  border: "1px solid var(--glass-border)",
  borderRadius: "10px",
};

const readOnlyLabelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "hsl(var(--text-muted))",
  fontWeight: 500,
  display: "block",
};

const instructionsBoxStyle: React.CSSProperties = {
  padding: "1rem 1.25rem",
  backgroundColor: "hsl(var(--bg-primary) / 60%)",
  border: "1px solid hsl(var(--border-color))",
  borderRadius: "10px",
};

const olStyle: React.CSSProperties = {
  paddingLeft: "1.2rem",
  marginTop: "0.5rem",
  fontSize: "0.8rem",
  color: "hsl(var(--text-secondary))",
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
};

const testResultBoxStyle: React.CSSProperties = {
  padding: "0.6rem 1rem",
  borderRadius: "8px",
  fontSize: "0.8rem",
  border: "1px solid transparent",
  lineHeight: "1.4",
};

const actionsRowStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  justifyContent: "flex-end",
  marginTop: "0.5rem",
};
