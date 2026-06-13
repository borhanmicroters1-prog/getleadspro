"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, UserProfile } from "@/utils/auth";
import { api } from "@/utils/api";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

interface ScrapedLead {
  name: string;
  email: string;
  phone: string;
  website: string;
  rating: number;
}

export default function FacebookAdsScraper() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [country, setCountry] = useState("BD");
  const [maxResults, setMaxResults] = useState(50);
  const [extractEmails, setExtractEmails] = useState(true);
  const [isScraping, setIsScraping] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [results, setResults] = useState<ScrapedLead[]>([]);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const currentUser = auth.getCurrentUser();
    if (!currentUser) {
      router.push("/login");
    } else {
      setUser(currentUser);
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [pollInterval]);

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword) return;

    setIsScraping(true);
    setProgress(5);
    setStatusText("Initiating FB Ads Library search...");
    setResults([]);

    try {
      const response = await api.post("/api/leads/scrape/facebook-ads", {
        keyword,
        country,
        max_results: maxResults,
        extract_emails: extractEmails,
      });

      const taskId = response.task_id;
      if (!taskId) {
        throw new Error("No task ID received from server.");
      }

      const interval = setInterval(async () => {
        try {
          const statusData = await api.get(`/api/leads/scrape/status/${taskId}`);
          setProgress(statusData.progress || 0);
          setStatusText(statusData.message || "Scraping in progress...");

          if (statusData.status === "completed") {
            clearInterval(interval);
            setPollInterval(null);
            setIsScraping(false);

            // Fetch leads from backend
            const leadsData = await api.get("/api/leads", {
              source: "facebook_ads",
              limit: maxResults,
            });
            setResults(leadsData.leads || []);

            // Refresh user credits
            const updatedProfile = await api.get("/api/auth/me");
            localStorage.setItem("getleads_session", JSON.stringify(updatedProfile));
            setUser(updatedProfile);

            // Dispatch event to refresh credits in Navbar
            window.dispatchEvent(new Event("credits_updated"));
          } else if (statusData.status === "failed") {
            clearInterval(interval);
            setPollInterval(null);
            setIsScraping(false);
            setStatusText(`Error: ${statusData.message}`);
          }
        } catch (pollErr: any) {
          clearInterval(interval);
          setPollInterval(null);
          setIsScraping(false);
          setStatusText(`Error checking task status: ${pollErr.message}`);
        }
      }, 1000);

      setPollInterval(interval);

    } catch (err: any) {
      setIsScraping(false);
      setStatusText(`Scraping failed to start: ${err.message}`);
    }
  };

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
          
          {/* Form and info row */}
          <div style={gridStyle}>
            {/* Scraper Config Form */}
            <div className="glass-panel" style={panelStyle}>
              <h3 style={panelTitleStyle}>Scrape Facebook Advertisers</h3>
              <form onSubmit={handleScrape} style={formStyle}>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Keyword / Ad Category</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Agency, Ecom, Gym, Dental" 
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="input-field"
                    required
                    disabled={isScraping}
                  />
                </div>

                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Target Country</label>
                  <select 
                    value={country} 
                    onChange={(e) => setCountry(e.target.value)}
                    className="input-field"
                    style={{ cursor: "pointer" }}
                    disabled={isScraping}
                  >
                    <option value="BD">Bangladesh (BD)</option>
                    <option value="IN">India (IN)</option>
                    <option value="US">United States (US)</option>
                    <option value="GB">United Kingdom (GB)</option>
                    <option value="CA">Canada (CA)</option>
                    <option value="AU">Australia (AU)</option>
                  </select>
                </div>

                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Max Lead Count ({maxResults})</label>
                  <input 
                    type="range" 
                    min="10" 
                    max="200" 
                    step="10"
                    value={maxResults}
                    onChange={(e) => setMaxResults(Number(e.target.value))}
                    style={sliderStyle}
                    disabled={isScraping}
                  />
                </div>

                <div style={checkboxWrapperStyle}>
                  <input 
                    type="checkbox" 
                    id="extract"
                    checked={extractEmails}
                    onChange={(e) => setExtractEmails(e.target.checked)}
                    style={checkboxStyle}
                    disabled={isScraping}
                  />
                  <label htmlFor="extract" style={checkboxLabelStyle}>Scrape emails from advertiser websites</label>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ width: "100%", marginTop: "0.5rem" }}
                  disabled={isScraping || !keyword}
                >
                  {isScraping ? "Scraping..." : "Start Scraping Advertisers"}
                </button>
              </form>
            </div>

            {/* Credit info / instructions */}
            <div className="glass-panel" style={panelStyle}>
              <h3 style={panelTitleStyle}>Scraper Information</h3>
              <div style={infoContentStyle}>
                <p>Facebook Ads Scraper queries the Meta Ads Library archive database to find brands running active paid advertisements. These leads have high commercial intent since they are already spending money on marketing.</p>
                <div style={costPillStyle}>
                  <strong>Cost:</strong> 1 Credit per advertiser with valid email address.
                </div>
                <div style={limitsBoxStyle}>
                  <h4>Scraper Constraints:</h4>
                  <ul>
                    <li>Queries only ACTIVE advertisements</li>
                    <li>Extracts homepages to crawl public contact emails</li>
                    <li>Saves duplicate advertisers under your same profile</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Progress panel */}
          {isScraping && (
            <div className="glass-panel animate-fade-in" style={progressPanelStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <span style={statusTextStyle}>{statusText}</span>
                <span style={percentageTextStyle}>{progress}%</span>
              </div>
              <div style={progressBgStyle}>
                <div style={{ ...progressFillStyle, width: `${progress}%` }} />
              </div>
            </div>
          )}

          {/* Results table */}
          {results.length > 0 && (
            <div className="glass-panel animate-fade-in" style={panelStyle}>
              <h3 style={{ ...panelTitleStyle, marginBottom: "1rem" }}>Scraped Advertisers ({results.length})</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={tableHeaderRowStyle}>
                      <th style={thStyle}>Advertiser Name</th>
                      <th style={thStyle}>Email</th>
                      <th style={thStyle}>Website</th>
                      <th style={thStyle}>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, idx) => (
                      <tr key={idx} style={tableRowStyle}>
                        <td style={{ ...tdStyle, color: "hsl(var(--text-primary))", fontWeight: 500 }}>{r.name}</td>
                        <td style={tdStyle}>
                          {r.email ? (
                            <span className="badge badge-primary" style={{ textTransform: "none", fontSize: "0.8rem" }}>
                              {r.email}
                            </span>
                          ) : (
                            <span style={{ color: "hsl(var(--text-muted))" }}>No email found</span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          {r.website ? (
                            <a href={r.website} target="_blank" rel="noopener noreferrer" style={{ color: "hsl(var(--accent))" }}>
                              {r.website.replace("https://", "").replace("http://", "")}
                            </a>
                          ) : (
                            <span style={{ color: "hsl(var(--text-muted))" }}>-</span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <span className="badge badge-warning" style={{ fontSize: "10px" }}>
                            facebook ads
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

// Styles
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

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "2rem",
};

const panelStyle: React.CSSProperties = {
  padding: "2rem",
};

const panelTitleStyle: React.CSSProperties = {
  fontSize: "1.15rem",
  color: "hsl(var(--text-primary))",
  marginBottom: "1.5rem",
};

const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
};

const inputGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "hsl(var(--text-secondary))",
  fontWeight: 500,
};

const sliderStyle: React.CSSProperties = {
  width: "100%",
  accentColor: "hsl(var(--accent))",
  cursor: "pointer",
};

const checkboxWrapperStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
};

const checkboxStyle: React.CSSProperties = {
  accentColor: "hsl(var(--accent))",
  cursor: "pointer",
  width: "16px",
  height: "16px",
};

const checkboxLabelStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "hsl(var(--text-secondary))",
  cursor: "pointer",
};

const infoContentStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
  color: "hsl(var(--text-secondary))",
  fontSize: "0.95rem",
  lineHeight: "1.5",
};

const costPillStyle: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "hsl(var(--accent) / 0.1)",
  border: "1px solid hsl(var(--accent) / 0.2)",
  color: "hsl(var(--accent))",
  padding: "0.5rem 1rem",
  borderRadius: "8px",
  fontSize: "0.85rem",
};

const limitsBoxStyle: React.CSSProperties = {
  padding: "1rem",
  borderRadius: "10px",
  backgroundColor: "hsl(var(--bg-secondary))",
  border: "1px solid hsl(var(--border-color))",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const progressPanelStyle: React.CSSProperties = {
  padding: "1.5rem",
};

const statusTextStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "hsl(var(--text-secondary))",
};

const percentageTextStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "hsl(var(--accent))",
  fontWeight: 600,
};

const progressBgStyle: React.CSSProperties = {
  width: "100%",
  height: "8px",
  backgroundColor: "hsl(var(--bg-tertiary))",
  borderRadius: "4px",
  overflow: "hidden",
};

const progressFillStyle: React.CSSProperties = {
  height: "100%",
  backgroundColor: "hsl(var(--accent))",
  backgroundImage: "linear-gradient(90deg, hsl(var(--accent)), hsl(var(--accent-secondary)))",
  borderRadius: "4px",
  transition: "width 0.4s ease",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  textAlign: "left",
};

const tableHeaderRowStyle: React.CSSProperties = {
  borderBottom: "1px solid hsl(var(--border-color))",
};

const thStyle: React.CSSProperties = {
  padding: "0.85rem 1rem",
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "hsl(var(--text-muted))",
  textTransform: "uppercase",
};

const tableRowStyle: React.CSSProperties = {
  borderBottom: "1px solid hsl(var(--border-color))",
};

const tdStyle: React.CSSProperties = {
  padding: "1rem",
  fontSize: "0.9rem",
  color: "hsl(var(--text-secondary))",
};
