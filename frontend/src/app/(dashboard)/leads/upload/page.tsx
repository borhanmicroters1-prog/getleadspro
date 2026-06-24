"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, UserProfile } from "@/utils/auth";
import { api } from "@/utils/api";
interface UploadStats {
  filename: string;
  parsed_rows: number;
  inserted_leads: number;
  skipped_rows: number;
}

function CsvUploadContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignQueryId = searchParams.get("campaign_id") || "";
  
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<UploadStats | null>(null);
  const [projects, setProjects] = useState<string[]>([]);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [projectName, setProjectName] = useState("");
  const [autoVerify, setAutoVerify] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const currentUser = auth.getCurrentUser();
    if (!currentUser) {
      router.push("/login");
    } else {
      setUser(currentUser);
      setLoading(false);
      
      // Fetch user campaigns (for query param resolution)
      api.get("/api/campaigns")
        .then((data) => setCampaigns(data || []))
        .catch((err) => console.error("Error fetching campaigns:", err));

      // Fetch user projects
      api.get("/api/leads/projects")
        .then((data) => setProjects(data || []))
        .catch((err) => console.error("Error fetching projects:", err));
    }
  }, [router]);

  useEffect(() => {
    if (campaignQueryId && campaigns.length > 0) {
      const camp = campaigns.find((c) => c.id === campaignQueryId);
      if (camp) {
        setProjectName(camp.name);
      }
    }
  }, [campaignQueryId, campaigns]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith(".csv")) {
        setFile(droppedFile);
        setError("");
        setStats(null);
      } else {
        setError("Only CSV files are supported.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.name.endsWith(".csv")) {
        setFile(selectedFile);
        setError("");
        setStats(null);
      } else {
        setError("Only CSV files are supported.");
      }
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    if (!projectName.trim()) {
      setError("Group / Campaign Name is required.");
      return;
    }

    setIsUploading(true);
    setError("");
    setStats(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const queryParams = new URLSearchParams();
      if (projectName.trim()) {
        queryParams.append("project_name", projectName.trim());
      }
      queryParams.append("auto_verify", autoVerify.toString());
      const queryString = queryParams.toString();
      const url = queryString ? `/api/leads/upload?${queryString}` : `/api/leads/upload`;

      const result = await api.post(url, formData, { isMultipart: true });
      setStats({
        filename: result.filename,
        parsed_rows: result.parsed_rows,
        inserted_leads: result.inserted_leads,
        skipped_rows: result.skipped_rows,
      });
      setFile(null); // Clear selected file after success
      setProjectName(""); // Clear project input
      
      // Refresh user projects
      api.get("/api/leads/projects")
        .then((data) => setProjects(data || []))
        .catch((err) => console.error("Error fetching projects:", err));
    } catch (err: any) {
      setError(err.message || "Failed to upload file.");
    } finally {
      setIsUploading(false);
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
    
        <main className="content-pane animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          {/* Back Action Row */}
          <div style={backRowStyle}>
            <button onClick={() => router.push("/leads")} style={backBtnStyle}>
              ← Back to Leads
            </button>
          </div>

          <div style={gridStyle}>
            {/* Upload Zone */}
            <div className="glass-panel" style={panelStyle}>
              <h3 style={panelTitleStyle}>Import Leads from CSV</h3>
              
              <form 
                onSubmit={handleUpload}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                style={formStyle}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".csv"
                  style={{ display: "none" }}
                />

                <div 
                  style={{
                    ...dropzoneStyle,
                    borderColor: dragActive ? "hsl(var(--accent))" : "var(--glass-border)",
                    backgroundColor: dragActive ? "hsl(var(--accent) / 5%)" : "transparent"
                  }}
                  onClick={onButtonClick}
                >
                  <span style={uploadIconStyle}>📄</span>
                  {file ? (
                    <div style={fileDetailsStyle}>
                      <span style={fileNameStyle}>{file.name}</span>
                      <span style={fileSizeStyle}>({(file.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  ) : (
                    <div style={uploadTextsStyle}>
                      <p style={uploadMainTextStyle}>Drag and drop your CSV file here, or <span style={linkTextStyle}>browse</span></p>
                      <p style={uploadSubTextStyle}>Only .csv files up to 10MB are supported</p>
                    </div>
                  )}
                </div>

                {error && (
                  <div style={errorStyle}>
                    ⚠️ {error}
                  </div>
                )}

                {/* Group / Campaign Name Input */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <label htmlFor="project-name-input" style={{ fontSize: "0.85rem", color: "hsl(var(--text-secondary))", fontWeight: 500 }}>
                    Group / Campaign Name <span style={{ color: "hsl(var(--danger))" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <input 
                      id="project-name-input"
                      type="text"
                      list="project-suggestions"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="Enter a group/campaign name (e.g. Real Estate, Doctors)..."
                      className="input-field"
                      style={{ 
                        width: "100%", 
                        padding: "0.75rem 0.75rem 0.75rem 2.25rem", 
                        fontSize: "0.875rem",
                        borderRadius: "10px"
                      }}
                      required
                      disabled={isUploading}
                    />
                    <span style={{ 
                      position: "absolute", 
                      left: "0.75rem", 
                      top: "50%", 
                      transform: "translateY(-50%)", 
                      fontSize: "1rem", 
                      opacity: 0.7 
                    }}>
                      📁
                    </span>
                  </div>
                  <datalist id="project-suggestions">
                    {projects.map((proj) => (
                      <option key={proj} value={proj} />
                    ))}
                  </datalist>

                  {projectName.trim() && (
                    <div style={campaignBadgeStyle}>
                      📁 Grouping leads under group/campaign: <strong style={{ color: "hsl(var(--accent-cyan))", marginLeft: "4px" }}>{projectName.trim()}</strong>
                    </div>
                  )}

                  <small style={{ fontSize: "11px", color: "hsl(var(--text-muted))", marginTop: "2px" }}>
                    Uploaded leads will be tagged with this group name. You can filter by this group when setting up outreach campaigns.
                  </small>
                </div>

                {/* Auto Verify Toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem", marginBottom: "0.75rem" }}>
                  <input 
                    id="auto-verify-checkbox"
                    type="checkbox"
                    checked={autoVerify}
                    onChange={(e) => setAutoVerify(e.target.checked)}
                    style={{ cursor: "pointer", width: "18px", height: "18px" }}
                    disabled={isUploading}
                  />
                  <label htmlFor="auto-verify-checkbox" style={{ fontSize: "0.875rem", color: "hsl(var(--text-secondary))", cursor: "pointer", fontWeight: 500 }}>
                    Verify email list automatically after upload
                  </label>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ width: "100%", height: "48px" }}
                  disabled={isUploading || !file || !projectName.trim()}
                >
                  {isUploading ? "Uploading & Processing..." : "Upload & Parse CSV"}
                </button>
              </form>
            </div>

            {/* CSV Format Guidelines */}
            <div className="glass-panel" style={panelStyle}>
              <h3 style={panelTitleStyle}>CSV Formatting Guidelines</h3>
              <div style={guidelinesContainerStyle}>
                <p>For a successful import, please ensure your CSV file matches the formatting rules below:</p>
                
                <div style={ruleBoxStyle}>
                  <p style={{ fontWeight: 600, color: "hsl(var(--text-primary))", marginBottom: "0.25rem" }}>Required Column:</p>
                  <code style={codeStyle}>email</code>
                  <p style={{ fontSize: "0.8rem", color: "hsl(var(--text-muted))", marginTop: "0.25rem" }}>
                    Must contain a valid email address. Duplicate emails for the same account will be skipped automatically.
                  </p>
                </div>

                <div style={ruleBoxStyle}>
                  <p style={{ fontWeight: 600, color: "hsl(var(--text-primary))", marginBottom: "0.25rem" }}>Optional Columns:</p>
                  <div style={tagsListStyle}>
                    <code style={codeStyle}>name</code>
                    <code style={codeStyle}>first_name</code>
                    <code style={codeStyle}>last_name</code>
                    <code style={codeStyle}>title</code>
                    <code style={codeStyle}>company</code>
                    <code style={codeStyle}>phone</code>
                    <code style={codeStyle}>website</code>
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "hsl(var(--text-muted))", marginTop: "0.5rem", lineHeight: "1.6" }}>
                    These fields are used during campaign generation to personalize email templates. 
                    If <code style={codeStyle}>first_name</code> and <code style={codeStyle}>last_name</code> are supplied, they are combined automatically into <code style={codeStyle}>name</code>. 
                    You can use <code style={codeStyle}>title</code> for job roles (e.g. CEO) and substitute them using <code style={codeStyle}>{"{{first_name}}"}</code> or <code style={codeStyle}>{"{{title}}"}</code> in templates.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Upload Results Stats */}
          {stats && (
            <div className="glass-panel animate-fade-in" style={statsPanelStyle}>
              <h3 style={{ ...panelTitleStyle, marginBottom: "1rem" }}>Import Summary</h3>
              <div style={statsGridStyle}>
                <div style={statCardStyle}>
                  <span style={statLabelStyle}>File Processed</span>
                  <span style={statValueStyle} title={stats.filename}>
                    {stats.filename.length > 20 ? stats.filename.slice(0, 17) + "..." : stats.filename}
                  </span>
                </div>
                <div style={statCardStyle}>
                  <span style={statLabelStyle}>Total Rows Read</span>
                  <span style={{ ...statValueStyle, color: "hsl(var(--text-primary))" }}>{stats.parsed_rows}</span>
                </div>
                <div style={statCardStyle}>
                  <span style={statLabelStyle}>Imported Leads</span>
                  <span style={{ ...statValueStyle, color: "hsl(var(--success))" }}>{stats.inserted_leads}</span>
                </div>
                <div style={statCardStyle}>
                  <span style={statLabelStyle}>Skipped / Duplicates</span>
                  <span style={{ ...statValueStyle, color: stats.skipped_rows > 0 ? "hsl(var(--warning))" : "hsl(var(--text-muted))" }}>
                    {stats.skipped_rows}
                  </span>
                </div>
              </div>
              <div style={statsFooterStyle}>
                <button onClick={() => router.push("/leads")} className="btn btn-primary" style={{ padding: "0.6rem 1.5rem" }}>
                  View Imported Leads
                </button>
              </div>
            </div>
          )}

        </main>
  );
}

export default function CsvUploadPage() {
  return (
    <Suspense fallback={
      <div style={loadingContainerStyle}>
        <div style={spinnerStyle} />
        <span>Loading CSV Importer...</span>
      </div>
    }>
      <CsvUploadContent />
    </Suspense>
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

const backRowStyle: React.CSSProperties = {
  display: "flex",
};

const backBtnStyle: React.CSSProperties = {
  backgroundColor: "transparent",
  border: "none",
  color: "hsl(var(--text-secondary))",
  fontSize: "0.95rem",
  cursor: "pointer",
  fontWeight: 500,
  padding: 0,
  display: "flex",
  alignItems: "center",
  transition: "color 0.2s ease",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "2rem",
};

const panelStyle: React.CSSProperties = {
  padding: "2.5rem 2rem",
};

const panelTitleStyle: React.CSSProperties = {
  fontSize: "1.15rem",
  color: "hsl(var(--text-primary))",
  marginBottom: "1.5rem",
};

const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1.5rem",
};

const dropzoneStyle: React.CSSProperties = {
  height: "180px",
  borderWidth: "2px",
  borderStyle: "dashed",
  borderRadius: "14px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "1rem",
  cursor: "pointer",
  transition: "all 0.2s ease",
  padding: "1rem",
  textAlign: "center",
};

const uploadIconStyle: React.CSSProperties = {
  fontSize: "2.5rem",
};

const uploadTextsStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
};

const uploadMainTextStyle: React.CSSProperties = {
  fontSize: "0.9rem",
  fontWeight: 500,
  color: "hsl(var(--text-secondary))",
};

const linkTextStyle: React.CSSProperties = {
  color: "hsl(var(--accent))",
  fontWeight: 600,
};

const uploadSubTextStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "hsl(var(--text-muted))",
};

const fileDetailsStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
};

const fileNameStyle: React.CSSProperties = {
  fontSize: "0.95rem",
  fontWeight: 600,
  color: "hsl(var(--text-primary))",
  maxWidth: "280px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const fileSizeStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  color: "hsl(var(--text-muted))",
};

const errorStyle: React.CSSProperties = {
  backgroundColor: "hsl(var(--danger) / 10%)",
  border: "1px solid hsl(var(--danger) / 20%)",
  color: "hsl(var(--danger))",
  padding: "0.75rem 1rem",
  borderRadius: "10px",
  fontSize: "0.85rem",
};

const guidelinesContainerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
  fontSize: "0.925rem",
  color: "hsl(var(--text-secondary))",
  lineHeight: "1.5",
};

const ruleBoxStyle: React.CSSProperties = {
  padding: "1rem",
  backgroundColor: "hsl(var(--bg-secondary))",
  border: "1px solid hsl(var(--border-color))",
  borderRadius: "10px",
};

const codeStyle: React.CSSProperties = {
  fontFamily: "monospace",
  backgroundColor: "hsl(var(--bg-tertiary))",
  border: "1px solid hsl(var(--border-color))",
  padding: "0.15rem 0.4rem",
  borderRadius: "4px",
  color: "hsl(var(--accent-cyan))",
  fontSize: "0.85rem",
};

const tagsListStyle: React.CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  flexWrap: "wrap",
};

const statsPanelStyle: React.CSSProperties = {
  padding: "2rem",
  background: "linear-gradient(135deg, hsl(var(--accent) / 6%), transparent)",
  borderColor: "hsl(var(--accent) / 15%)",
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "1.5rem",
};

const statCardStyle: React.CSSProperties = {
  padding: "1.25rem",
  backgroundColor: "hsl(var(--bg-secondary) / 40%)",
  border: "1px solid hsl(var(--border-color))",
  borderRadius: "12px",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const statLabelStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  color: "hsl(var(--text-secondary))",
  fontWeight: 500,
};

const statValueStyle: React.CSSProperties = {
  fontSize: "1.5rem",
  fontWeight: 700,
  fontFamily: "var(--font-family-heading)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const statsFooterStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  marginTop: "1.5rem",
};

const campaignBadgeStyle: React.CSSProperties = {
  backgroundColor: "hsl(var(--accent) / 8%)",
  border: "1px solid hsl(var(--accent) / 20%)",
  color: "hsl(var(--text-secondary))",
  padding: "0.85rem 1.25rem",
  borderRadius: "10px",
  fontSize: "0.9rem",
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  marginTop: "0.5rem",
};

const inlineFormStyle: React.CSSProperties = {
  marginTop: "0.75rem",
  padding: "1rem",
  backgroundColor: "hsl(var(--bg-secondary) / 30%)",
  border: "1px solid hsl(var(--border-color))",
  borderRadius: "10px",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};
