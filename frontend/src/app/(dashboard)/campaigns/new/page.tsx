"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, UserProfile } from "@/utils/auth";
import { api } from "@/utils/api";
interface MailboxItem {
  id: string;
  provider: string;
  from_email: string;
  from_name: string;
}

interface LeadItem {
  id: string;
  name: string;
  email: string;
  company: string;
}

interface SpamResult {
  spam_score: number;
  is_spam: boolean;
  flagged_words: string[];
  warnings: string[];
  recommendation: string;
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available options
  const [mailboxes, setMailboxes] = useState<MailboxItem[]>([]);
  const [availableLeads, setAvailableLeads] = useState<LeadItem[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [loadingLeads, setLoadingLeads] = useState(false);

  // Wizard State
  // Step 1: Setup
  const [campaignName, setCampaignName] = useState("");
  const [selectedMailboxId, setSelectedMailboxId] = useState("");
  const [rotateMailboxes, setRotateMailboxes] = useState(true);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  // Step 2: Message Template
  const [subjectA, setSubjectA] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState("");
  
  // AI Personalizer overlay state
  const [aiProvider, setAiProvider] = useState("claude");
  const [aiInstruction, setAiInstruction] = useState("Keep it short, professional, and invite them to a 10-minute brainstorming session.");
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiPreviewSubj, setAiPreviewSubj] = useState("");
  const [aiPreviewBody, setAiPreviewBody] = useState("");

  // Spam checker state
  const [isSpamChecking, setIsSpamChecking] = useState(false);
  const [spamResult, setSpamResult] = useState<SpamResult | null>(null);

  // Step 3: A/B Testing
  const [enableABTest, setEnableABTest] = useState(false);
  const [subjectB, setSubjectB] = useState("");

  // Step 4: Follow-ups
  const [enableFollowUp1, setEnableFollowUp1] = useState(false);
  const [followUp1Days, setFollowUp1Days] = useState(3);
  const [followUp1Body, setFollowUp1Body] = useState("");

  const [enableFollowUp2, setEnableFollowUp2] = useState(false);
  const [followUp2Days, setFollowUp2Days] = useState(5);
  const [followUp2Body, setFollowUp2Body] = useState("");

  // Step 5: Schedule
  const [sendStartHour, setSendStartHour] = useState(9);
  const [sendEndHour, setSendEndHour] = useState(18);
  const [timezone, setTimezone] = useState("UTC");
  const [sendInterval, setSendInterval] = useState(2);

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
    if (user) {
      // Fetch connected mailboxes, projects & leads
      const loadOptions = async () => {
        try {
          const mData = await api.get("/api/email-accounts");
          setMailboxes(mData || []);
          if (mData && mData.length > 0) {
            setSelectedMailboxId(mData[0].id);
          }

          const pData = await api.get("/api/leads/projects");
          setProjects(pData || []);

          const lData = await api.get("/api/leads", { limit: 100 });
          setAvailableLeads(lData.leads || []);
        } catch (err) {
          console.error("Failed to load options:", err);
        }
      };
      loadOptions();
    }
  }, [user]);

  const handleProjectChange = async (projectVal: string) => {
    setSelectedProject(projectVal);
    setLoadingLeads(true);
    try {
      const params: any = { limit: 1000 };
      if (projectVal) {
        params.campaign = projectVal; // Backend expects 'campaign' query parameter for project/campaign name filtering
      }
      const lData = await api.get("/api/leads", params);
      const leadsList = lData.leads || [];
      setAvailableLeads(leadsList);
      // Auto-select all group leads by default
      setSelectedLeadIds(leadsList.map((l: any) => l.id));
    } catch (err) {
      console.error("Failed to load group leads:", err);
    } finally {
      setLoadingLeads(false);
    }
  };

  const toggleLeadSelection = (id: string) => {
    setSelectedLeadIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllLeads = () => {
    if (selectedLeadIds.length === availableLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(availableLeads.map(l => l.id));
    }
  };

  const handleAiGenerate = async () => {
    if (selectedLeadIds.length === 0) {
      alert("Please select at least one lead in Step 1 to generate AI personalization.");
      return;
    }
    setIsAiGenerating(true);
    setError("");
    try {
      // Call generate using the first selected lead as template details
      const result = await api.post("/api/emails/generate", {
        lead_id: selectedLeadIds[0],
        prompt_instruction: aiInstruction,
        provider: aiProvider
      });
      setAiPreviewSubj(result.subject || "");
      setAiPreviewBody(result.body || "");
    } catch (err: any) {
      setError(err.message || "AI Personalizer failed to generate draft.");
    } finally {
      setIsAiGenerating(false);
    }
  };

  const applyAiTemplate = () => {
    if (aiPreviewSubj && aiPreviewBody) {
      setSubjectA(aiPreviewSubj);
      setBodyTemplate(aiPreviewBody);
      setAiPreviewSubj("");
      setAiPreviewBody("");
      setSpamResult(null); // Clear old spam results
    }
  };

  const handleSpamCheck = async () => {
    if (!subjectA || !bodyTemplate) return;
    setIsSpamChecking(true);
    try {
      const result = await api.post("/api/emails/spam-check", {
        subject: subjectA,
        body: bodyTemplate
      });
      setSpamResult(result);
    } catch (err: any) {
      alert("Spam check failed: " + err.message);
    } finally {
      setIsSpamChecking(false);
    }
  };

  const handleSubmitCampaign = async (statusVal: "draft" | "active") => {
    if (!campaignName || selectedLeadIds.length === 0 || !subjectA || !bodyTemplate) {
      setError("Please complete all required fields (Name, Mailbox, Target Leads, and Template).");
      return;
    }

    setIsSubmitting(true);
    setError("");

    const payload = {
      name: campaignName,
      email_account_id: selectedMailboxId || null,
      rotate_mailboxes: rotateMailboxes,
      lead_ids: selectedLeadIds,
      subject_a: subjectA,
      subject_b: enableABTest ? subjectB : null,
      body_template: bodyTemplate,
      follow_up_1_days: enableFollowUp1 ? followUp1Days : null,
      follow_up_1_body: enableFollowUp1 ? followUp1Body : null,
      follow_up_2_days: enableFollowUp2 ? followUp2Days : null,
      follow_up_2_body: enableFollowUp2 ? followUp2Body : null,
      send_start_hour: sendStartHour,
      send_end_hour: sendEndHour,
      timezone,
      send_interval: sendInterval,
      status: statusVal
    };

    try {
      await api.post("/api/campaigns", payload);
      router.push("/campaigns");
    } catch (err: any) {
      setError(err.message || "Failed to create campaign.");
      setIsSubmitting(false);
    }
  };

  const nextStep = () => {
    if (step === 1 && (!campaignName || selectedLeadIds.length === 0)) {
      setError("Campaign name and at least one target lead are required.");
      return;
    }
    if (step === 2 && (!subjectA || !bodyTemplate)) {
      setError("Email subject and template body are required.");
      return;
    }
    setError("");
    setStep(prev => prev + 1);
  };

  const getEstimatedDuration = () => {
    const totalLeads = selectedLeadIds.length;
    if (totalLeads === 0) return "0 minutes (No leads selected)";
    
    const interval = Math.max(1, sendInterval);
    const totalMinutes = totalLeads * interval;
    
    const hoursPerDay = sendEndHour === sendStartHour
      ? 24
      : sendEndHour > sendStartHour
        ? sendEndHour - sendStartHour
        : 24 - sendStartHour + sendEndHour;
        
    const activeMinutesPerDay = hoursPerDay * 60;
    
    const days = Math.floor(totalMinutes / activeMinutesPerDay);
    const remainingActiveMinutes = totalMinutes % activeMinutesPerDay;
    const hours = Math.floor(remainingActiveMinutes / 60);
    const minutes = remainingActiveMinutes % 60;
    
    const parts = [];
    if (days > 0) parts.push(`${days} day${days > 1 ? "s" : ""}`);
    if (hours > 0) parts.push(`${hours} hour${hours > 1 ? "s" : ""}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? "s" : ""}`);
    
    return parts.join(", ");
  };

  const prevStep = () => {
    setError("");
    setStep(prev => prev - 1);
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
          
          {/* Header */}
          <div style={headerActionRowStyle}>
            <div style={headerTextWrapperStyle}>
              <h2 style={sectionTitleStyle}>Launch New Campaign</h2>
              <p style={sectionSubStyle}>Follow the steps to configure and launch outreach sequences</p>
            </div>
          </div>

          {/* Stepper Wizard Indicator */}
          <div style={stepperContainerStyle}>
            {[1, 2, 3, 4, 5].map((s) => (
              <div key={s} style={stepIndicatorWrapperStyle}>
                <div style={{
                  ...stepIndicatorStyle,
                  backgroundColor: step === s ? "hsl(var(--accent))" : step > s ? "hsl(var(--success))" : "hsl(var(--bg-tertiary))",
                  borderColor: step >= s ? "hsl(var(--accent) / 50%)" : "hsl(var(--border-color))",
                  color: "#fff"
                }}>
                  {step > s ? "✓" : s}
                </div>
                <span style={{
                  ...stepLabelStyle,
                  color: step === s ? "hsl(var(--text-primary))" : "hsl(var(--text-muted))"
                }}>
                  {s === 1 && "Setup"}
                  {s === 2 && "Template"}
                  {s === 3 && "A/B Testing"}
                  {s === 4 && "Follow-ups"}
                  {s === 5 && "Schedule"}
                </span>
                {s < 5 && <div style={{ ...stepConnectorLineStyle, backgroundColor: step > s ? "hsl(var(--success))" : "hsl(var(--border-color))" }} />}
              </div>
            ))}
          </div>

          {error && (
            <div style={errorBannerStyle}>
              ⚠️ {error}
            </div>
          )}

          {/* Step 1: Basic Info & Leads Selection */}
          {step === 1 && (
            <div className="glass-panel animate-fade-in" style={panelStyle}>
              <h3 style={panelTitleStyle}>Step 1: Campaign Setup</h3>
              <div style={formRowStyle}>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Campaign Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Restaurants In Dhaka Outreach" 
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Sending Mailbox</label>
                  {mailboxes.length > 0 ? (
                    <>
                      <select 
                        value={selectedMailboxId}
                        onChange={(e) => setSelectedMailboxId(e.target.value)}
                        className="input-field"
                        style={{ cursor: "pointer" }}
                      >
                        {mailboxes.map(mb => (
                          <option key={mb.id} value={mb.id}>
                            {mb.from_name} ({mb.from_email}) [{mb.provider.toUpperCase()}]
                          </option>
                        ))}
                      </select>
                      <div style={{ ...checkboxWrapperStyle, marginTop: "0.5rem" }}>
                        <input 
                          type="checkbox" 
                          id="rotateMailboxes" 
                          checked={rotateMailboxes} 
                          onChange={(e) => setRotateMailboxes(e.target.checked)} 
                          style={checkboxStyle}
                        />
                        <label htmlFor="rotateMailboxes" style={checkboxLabelStyle}>
                          Auto-rotate mailboxes when daily limit is reached
                        </label>
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: "13px", color: "hsl(var(--danger))", marginTop: "0.25rem" }}>
                      ⚠️ No mailboxes connected. Please connect one in the <span style={{ textDecoration: "underline", cursor: "pointer" }} onClick={() => router.push("/email-accounts")}>Email Setup</span> page.
                    </div>
                  )}
                </div>
              </div>

              {/* Leads Selection Panel */}
              <div style={{ marginTop: "2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <label style={labelStyle}>Select Group / Campaign Leads</label>
                  <select 
                    value={selectedProject}
                    onChange={(e) => handleProjectChange(e.target.value)}
                    className="input-field"
                    style={{ cursor: "pointer", width: "100%", maxWidth: "400px" }}
                  >
                    <option value="">-- All Leads (No Group Filter) --</option>
                    {projects.map(proj => (
                      <option key={proj} value={proj}>
                        📁 {proj}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
                  <label style={{ ...labelStyle, fontSize: "0.95rem", marginBottom: 0 }}>
                    Select Target Leads ({selectedLeadIds.length} selected)
                  </label>
                  <button onClick={handleSelectAllLeads} className="btn btn-secondary" style={{ padding: "0.4rem 0.8rem", fontSize: "0.75rem" }}>
                    {selectedLeadIds.length === availableLeads.length ? "Deselect All" : "Select All Available"}
                  </button>
                </div>
                
                {loadingLeads ? (
                  <div style={{ padding: "3rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
                    <div style={spinnerStyle} />
                    <span style={{ color: "hsl(var(--text-secondary))", fontSize: "0.9rem" }}>Loading group leads...</span>
                  </div>
                ) : availableLeads.length > 0 ? (
                  <div style={leadsSelectionContainerStyle} className="input-field">
                    {availableLeads.map(l => (
                      <div key={l.id} style={leadSelectorRowStyle} className="lead-selector-row" onClick={() => toggleLeadSelection(l.id)}>
                        <input 
                          type="checkbox" 
                          checked={selectedLeadIds.includes(l.id)} 
                          onChange={() => {}} // handled by row click
                          style={checkboxStyle}
                        />
                        <div style={leadDetailsStyle}>
                          <span style={leadNameTextStyle}>{l.name}</span>
                          <span style={leadEmailTextStyle}>{l.email} {l.company ? `| ${l.company}` : ""}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: "2rem", textAlign: "center", color: "hsl(var(--text-muted))", border: "1px dashed hsl(var(--border-color))", borderRadius: "10px" }}>
                    No leads found. Scrape or import leads first.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Email Template Setup & AI Personalizer & Spam Checker */}
          {step === 2 && (
            <div style={gridRowStyle}>
              {/* Template Editor */}
              <div className="glass-panel" style={{ ...panelStyle, flex: 1.3 }}>
                <h3 style={panelTitleStyle}>Step 2: Message Template</h3>
                <div style={formStyle}>
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>Subject Line</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Quick question for {{name}}" 
                      value={subjectA}
                      onChange={(e) => setSubjectA(e.target.value)}
                      className="input-field"
                      required
                    />
                  </div>
                  <div style={inputGroupStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <label style={labelStyle}>Email Body</label>
                      <span style={{ fontSize: "11px", color: "hsl(var(--text-muted))" }}>Variables: `{"{{name}}"}`, `{"{{company}}"}`, `{"{{website}}"}`</span>
                    </div>
                    <textarea 
                      placeholder="Hi {{name}}, I noticed your business {{company}}..." 
                      value={bodyTemplate}
                      onChange={(e) => setBodyTemplate(e.target.value)}
                      className="input-field"
                      style={{ height: "220px", resize: "none" }}
                      required
                    />
                  </div>

                  <div style={templateActionsRowStyle}>
                    <button 
                      onClick={handleSpamCheck} 
                      className="btn btn-secondary"
                      disabled={isSpamChecking || !subjectA || !bodyTemplate}
                      style={{ fontSize: "0.85rem" }}
                    >
                      {isSpamChecking ? "Scanning..." : "🛡️ Scan Deliverability / Spam"}
                    </button>
                  </div>
                </div>
              </div>

              {/* AI Assistant Sidebar */}
              <div className="glass-panel" style={{ ...panelStyle, flex: 0.9 }}>
                <h3 style={panelTitleStyle}>🤖 AI Personalizer Assistant</h3>
                <div style={aiFormStyle}>


                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>Personalization Instructions</label>
                    <textarea 
                      value={aiInstruction}
                      onChange={(e) => setAiInstruction(e.target.value)}
                      className="input-field"
                      style={{ height: "80px", fontSize: "0.85rem", resize: "none" }}
                    />
                  </div>

                  <button 
                    onClick={handleAiGenerate} 
                    className="btn btn-primary"
                    disabled={isAiGenerating || selectedLeadIds.length === 0}
                    style={{ width: "100%" }}
                  >
                    {isAiGenerating ? "Drafting with AI..." : "✨ Generate AI Draft Preview"}
                  </button>

                  {/* AI Output Preview */}
                  {aiPreviewBody && (
                    <div style={aiOutputBoxStyle} className="animate-fade-in">
                      <div style={aiOutputHeaderStyle}>
                        <span style={{ fontWeight: 600, fontSize: "12px", color: "hsl(var(--accent-cyan))" }}>AI Draft Preview</span>
                        <button onClick={applyAiTemplate} className="btn btn-secondary" style={{ padding: "0.25rem 0.5rem", fontSize: "11px" }}>
                          Apply Template
                        </button>
                      </div>
                      <div style={aiOutputContentStyle}>
                        <p style={{ fontWeight: 600, borderBottom: "1px solid var(--glass-border)", paddingBottom: "0.25rem", marginBottom: "0.5rem" }}>
                          Subject: {aiPreviewSubj}
                        </p>
                        <p style={{ whiteSpace: "pre-line" }}>{aiPreviewBody}</p>
                      </div>
                    </div>
                  )}

                  {/* Spam Check Results Output */}
                  {spamResult && (
                    <div style={{
                      ...spamOutputBoxStyle,
                      borderColor: spamResult.is_spam ? "hsl(var(--danger) / 30%)" : spamResult.spam_score >= 4.0 ? "hsl(var(--warning) / 30%)" : "hsl(var(--success) / 30%)"
                    }} className="animate-fade-in">
                      <div style={spamOutputHeaderStyle}>
                        <span style={{ fontWeight: 600, fontSize: "12px" }}>Deliverability Scan Score</span>
                        <span style={{
                          fontWeight: 700,
                          fontSize: "13px",
                          color: spamResult.is_spam ? "hsl(var(--danger))" : spamResult.spam_score >= 4.0 ? "hsl(var(--warning))" : "hsl(var(--success))"
                        }}>
                          {spamResult.spam_score} / 10
                        </span>
                      </div>
                      
                      <div style={spamScoreProgressBgStyle}>
                        <div style={{
                          ...spamScoreProgressFillStyle,
                          width: `${spamResult.spam_score * 10}%`,
                          backgroundColor: spamResult.is_spam ? "hsl(var(--danger))" : spamResult.spam_score >= 4.0 ? "hsl(var(--warning))" : "hsl(var(--success))"
                        }} />
                      </div>

                      <p style={{ fontSize: "12px", color: "hsl(var(--text-secondary))", marginTop: "0.5rem", fontStyle: "italic" }}>
                        {spamResult.recommendation}
                      </p>

                      {spamResult.warnings.length > 0 && (
                        <div style={{...spamWarningsListStyle, borderTop: "1px solid var(--glass-border)"}}>
                          {spamResult.warnings.map((warn, wIdx) => (
                            <div key={wIdx} style={spamWarnItemStyle}>• {warn}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}

          {/* Step 3: A/B Testing */}
          {step === 3 && (
            <div className="glass-panel animate-fade-in" style={panelStyle}>
              <h3 style={panelTitleStyle}>Step 3: A/B Split Testing</h3>
              <p style={stepDescriptionStyle}>
                Optionally test different subject lines. The system will alternate between subject A and subject B for your list of leads.
              </p>
              
              <div style={checkboxWrapperStyle}>
                <input 
                  type="checkbox" 
                  id="abtest" 
                  checked={enableABTest} 
                  onChange={(e) => setEnableABTest(e.target.checked)} 
                  style={checkboxStyle}
                />
                <label htmlFor="abtest" style={checkboxLabelStyle}>Enable A/B testing on Subject Line</label>
              </div>

              {enableABTest && (
                <div style={{ ...inputGroupStyle, marginTop: "1.5rem" }} className="animate-fade-in">
                  <label style={labelStyle}>Subject Line B</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Let's discuss {{company}}'s customer outreach strategy" 
                    value={subjectB}
                    onChange={(e) => setSubjectB(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 4: Follow-up Sequences */}
          {step === 4 && (
            <div className="glass-panel animate-fade-in" style={panelStyle}>
              <h3 style={panelTitleStyle}>Step 4: Follow-up Sequences</h3>
              <p style={stepDescriptionStyle}>
                Set up automated follow-up emails that trigger if a prospect does not reply within a specific timeframe. Sequences stop automatically once they reply.
              </p>

              {/* Follow up 1 */}
              <div style={followUpWrapperStyle} className="glass-panel">
                <div style={followUpHeaderStyle}>
                  <div style={checkboxWrapperStyle}>
                    <input 
                      type="checkbox" 
                      id="f1" 
                      checked={enableFollowUp1} 
                      onChange={(e) => setEnableFollowUp1(e.target.checked)} 
                      style={checkboxStyle}
                    />
                    <label htmlFor="f1" style={{ ...checkboxLabelStyle, fontWeight: 600, color: "hsl(var(--text-primary))" }}>Enable Follow-up 1</label>
                  </div>
                  {enableFollowUp1 && (
                    <div style={followUpDaysGroupStyle}>
                      <span style={{ fontSize: "13px" }}>Send after</span>
                      <input 
                        type="number" 
                        min="1" 
                        max="30" 
                        value={followUp1Days} 
                        onChange={(e) => setFollowUp1Days(Number(e.target.value))} 
                        style={daysInputStyle}
                        className="input-field"
                      />
                      <span style={{ fontSize: "13px" }}>days</span>
                    </div>
                  )}
                </div>
                {enableFollowUp1 && (
                  <div style={{ ...inputGroupStyle, marginTop: "1rem" }} className="animate-fade-in">
                    <label style={labelStyle}>Follow-up Body Template</label>
                    <textarea 
                      placeholder="Hi {{name}}, just following up on my email last week..." 
                      value={followUp1Body}
                      onChange={(e) => setFollowUp1Body(e.target.value)}
                      className="input-field"
                      style={{ height: "120px", resize: "none" }}
                      required
                    />
                  </div>
                )}
              </div>

              {/* Follow up 2 */}
              <div style={followUpWrapperStyle} className="glass-panel">
                <div style={followUpHeaderStyle}>
                  <div style={checkboxWrapperStyle}>
                    <input 
                      type="checkbox" 
                      id="f2" 
                      checked={enableFollowUp2} 
                      onChange={(e) => setEnableFollowUp2(e.target.checked)} 
                      style={checkboxStyle}
                      disabled={!enableFollowUp1}
                    />
                    <label htmlFor="f2" style={{ ...checkboxLabelStyle, fontWeight: 600, color: !enableFollowUp1 ? "hsl(var(--text-muted))" : "hsl(var(--text-primary))" }}>
                      Enable Follow-up 2
                    </label>
                  </div>
                  {enableFollowUp2 && (
                    <div style={followUpDaysGroupStyle}>
                      <span style={{ fontSize: "13px" }}>Send after</span>
                      <input 
                        type="number" 
                        min="1" 
                        max="30" 
                        value={followUp2Days} 
                        onChange={(e) => setFollowUp2Days(Number(e.target.value))} 
                        style={daysInputStyle}
                        className="input-field"
                      />
                      <span style={{ fontSize: "13px" }}>days</span>
                    </div>
                  )}
                </div>
                {enableFollowUp2 && enableFollowUp1 && (
                  <div style={{ ...inputGroupStyle, marginTop: "1rem" }} className="animate-fade-in">
                    <label style={labelStyle}>Follow-up Body Template</label>
                    <textarea 
                      placeholder="Hi {{name}}, I know you are busy, just wanted to float this to the top of your inbox..." 
                      value={followUp2Body}
                      onChange={(e) => setFollowUp2Body(e.target.value)}
                      className="input-field"
                      style={{ height: "120px", resize: "none" }}
                      required
                    />
                  </div>
                )}
              </div>

            </div>
          )}

          {/* Step 5: Schedule & Launch */}
          {step === 5 && (
            <div className="glass-panel animate-fade-in" style={panelStyle}>
              <h3 style={panelTitleStyle}>Step 5: Sending Schedule</h3>
              <p style={stepDescriptionStyle}>
                Configure timezone and sending windows to make sure emails are delivered only during business hours.
              </p>

              <div style={formRowStyle}>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Sending Time Window (Start Hour)</label>
                  <select 
                    value={sendStartHour} 
                    onChange={(e) => setSendStartHour(Number(e.target.value))} 
                    className="input-field"
                    style={{ cursor: "pointer" }}
                  >
                    {[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23].map(h => (
                      <option key={h} value={h}>{h === 0 ? "12 AM" : h === 12 ? "12 PM" : h > 12 ? `${h-12} PM` : `${h} AM`}</option>
                    ))}
                  </select>
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Sending Time Window (End Hour)</label>
                  <select 
                    value={sendEndHour} 
                    onChange={(e) => setSendEndHour(Number(e.target.value))} 
                    className="input-field"
                    style={{ cursor: "pointer" }}
                  >
                    {[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23].map(h => (
                      <option key={h} value={h}>{h === 0 ? "12 AM" : h === 12 ? "12 PM" : h > 12 ? `${h-12} PM` : `${h} AM`}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ ...formRowStyle, marginTop: "1.5rem" }}>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Timezone</label>
                  <select 
                    value={timezone} 
                    onChange={(e) => setTimezone(e.target.value)} 
                    className="input-field"
                    style={{ cursor: "pointer" }}
                  >
                    <option value="Asia/Dhaka">Asia/Dhaka (GMT+6)</option>
                    <option value="Asia/Kolkata">Asia/Kolkata (GMT+5:30)</option>
                    <option value="UTC">UTC / GMT</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="Europe/London">Europe/London (GMT/BST)</option>
                  </select>
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Send Interval (Minutes)</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="60" 
                    value={sendInterval} 
                    onChange={(e) => setSendInterval(Math.max(1, Number(e.target.value)))} 
                    className="input-field"
                    required
                  />
                </div>
              </div>

              {/* Duration Calculator */}
              <div style={calculatorCardStyle}>
                <div style={calculatorHeaderStyle}>
                  <span style={calculatorTitleStyle}>📅 Estimated Sending Duration</span>
                  <span style={calculatorBadgeStyle}>Active Plan: {user?.plan || "Free"}</span>
                </div>
                <div style={calculatorContentStyle}>
                  <div style={calculatorMetricRowStyle}>
                    <div style={calculatorMetricStyle}>
                      <span style={calculatorMetricLabelStyle}>Total Selected Leads</span>
                      <span style={calculatorMetricValueStyle}>{selectedLeadIds.length}</span>
                    </div>
                    <div style={calculatorMetricDividerStyle} />
                    <div style={calculatorMetricStyle}>
                      <span style={calculatorMetricLabelStyle}>Sending Interval</span>
                      <span style={calculatorMetricValueStyle}>{sendInterval} Min</span>
                    </div>
                    <div style={calculatorMetricDividerStyle} />
                    <div style={calculatorMetricStyle}>
                      <span style={calculatorMetricLabelStyle}>Sending Hours/Day</span>
                      <span style={calculatorMetricValueStyle}>
                        {sendEndHour === sendStartHour
                          ? 24
                          : sendEndHour > sendStartHour
                            ? sendEndHour - sendStartHour
                            : 24 - sendStartHour + sendEndHour} hrs
                      </span>
                    </div>
                  </div>
                  
                  <div style={calculatorResultWrapperStyle}>
                    <div style={calculatorResultLabelStyle}>Expected Completion Time:</div>
                    <div style={calculatorResultValueStyle}>{getEstimatedDuration()}</div>
                  </div>
                  
                  <p style={calculatorNoteStyle}>
                    * Based on your timezone and daily sending window of {sendStartHour === 0 ? "12 AM" : sendStartHour === 12 ? "12 PM" : sendStartHour > 12 ? `${sendStartHour-12} PM` : `${sendStartHour} AM`} to {sendEndHour === 0 ? "12 AM" : sendEndHour === 12 ? "12 PM" : sendEndHour > 12 ? `${sendEndHour-12} PM` : `${sendEndHour} AM`}.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Stepper Navigation Buttons */}
          <div style={stepperNavButtonsWrapperStyle}>
            {step > 1 && (
              <button onClick={prevStep} className="btn btn-secondary" style={{ width: "120px" }}>
                Back
              </button>
            )}
            
            {step < 5 ? (
              <button onClick={nextStep} className="btn btn-primary" style={{ width: "120px", marginLeft: "auto" }}>
                Next
              </button>
            ) : (
              <div style={{ marginLeft: "auto", display: "flex", gap: "1rem" }}>
                <button 
                  onClick={() => handleSubmitCampaign("draft")} 
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                >
                  Save as Draft
                </button>
                <button 
                  onClick={() => handleSubmitCampaign("active")} 
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Launching..." : "🚀 Launch Campaign"}
                </button>
              </div>
            )}
          </div>

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

const stepperContainerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "1rem 2rem",
  background: "var(--card-bg-alt)",
  borderRadius: "14px",
  border: "1px solid var(--glass-border)",
  flexWrap: "wrap",
  gap: "1rem",
};

const stepIndicatorWrapperStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  position: "relative",
  flex: 1,
};

const stepIndicatorStyle: React.CSSProperties = {
  width: "28px",
  height: "28px",
  borderRadius: "50%",
  border: "1.5px solid transparent",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold",
  fontSize: "0.85rem",
  zIndex: 1,
};

const stepLabelStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const stepConnectorLineStyle: React.CSSProperties = {
  position: "absolute",
  left: "32px",
  right: "-20px",
  top: "50%",
  height: "2px",
  transform: "translateY(-50%)",
  zIndex: 0,
  // Hide on mobile or small viewports as it might warp, but standard layouts are ok
};

const errorBannerStyle: React.CSSProperties = {
  padding: "0.75rem 1.5rem",
  backgroundColor: "hsl(var(--danger) / 10%)",
  border: "1px solid hsl(var(--danger) / 20%)",
  color: "hsl(var(--danger))",
  borderRadius: "12px",
  fontSize: "0.9rem",
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
  gap: "1.25rem",
};

const formRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "1.5rem",
};

const inputGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "hsl(var(--text-secondary))",
  fontWeight: 500,
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

const leadsSelectionContainerStyle: React.CSSProperties = {
  height: "200px",
  overflowY: "auto",
  padding: "0.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
};

const leadSelectorRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  padding: "0.6rem 0.8rem",
  borderRadius: "8px",
  cursor: "pointer",
  transition: "background-color 0.15s ease",
  borderBottom: "1px solid var(--glass-border)",
};

const leadDetailsStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.15rem",
};

const leadNameTextStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  fontWeight: 600,
  color: "hsl(var(--text-primary))",
};

const leadEmailTextStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "hsl(var(--text-muted))",
};

const gridRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "2rem",
  flexWrap: "wrap",
};

const templateActionsRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "1rem",
  marginTop: "0.5rem",
};

const aiFormStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const aiOutputBoxStyle: React.CSSProperties = {
  marginTop: "1.25rem",
  backgroundColor: "hsl(var(--bg-secondary))",
  border: "1px solid hsl(var(--border-color))",
  borderRadius: "10px",
  padding: "1rem",
};

const aiOutputHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "0.75rem",
};

const aiOutputContentStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "hsl(var(--text-secondary))",
  lineHeight: "1.5",
  maxHeight: "150px",
  overflowY: "auto",
};

const spamOutputBoxStyle: React.CSSProperties = {
  marginTop: "1.25rem",
  borderWidth: "1px",
  borderStyle: "solid",
  borderRadius: "10px",
  padding: "1rem",
};

const spamOutputHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "0.5rem",
};

const spamScoreProgressBgStyle: React.CSSProperties = {
  width: "100%",
  height: "5px",
  backgroundColor: "hsl(var(--bg-tertiary))",
  borderRadius: "2px",
  overflow: "hidden",
};

const spamScoreProgressFillStyle: React.CSSProperties = {
  height: "100%",
  borderRadius: "2px",
  transition: "width 0.4s ease",
};

const spamWarningsListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
  marginTop: "0.75rem",
  borderTop: "1px solid var(--glass-border)",
  paddingTop: "0.75rem",
};

const spamWarnItemStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "hsl(var(--text-muted))",
};

const stepDescriptionStyle: React.CSSProperties = {
  fontSize: "0.9rem",
  color: "hsl(var(--text-secondary))",
  lineHeight: "1.5",
  marginBottom: "1.5rem",
};

const followUpWrapperStyle: React.CSSProperties = {
  padding: "1.5rem",
  marginBottom: "1.25rem",
};

const followUpHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "1rem",
};

const followUpDaysGroupStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
};

const daysInputStyle: React.CSSProperties = {
  width: "60px",
  padding: "0.4rem",
  textAlign: "center",
};

const stepperNavButtonsWrapperStyle: React.CSSProperties = {
  display: "flex",
  marginTop: "1rem",
};

const calculatorCardStyle: React.CSSProperties = {
  marginTop: "2rem",
  padding: "1.5rem",
  borderRadius: "12px",
  backgroundColor: "hsl(var(--bg-secondary) / 50%)",
  border: "1px solid var(--glass-border)",
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const calculatorHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const calculatorTitleStyle: React.CSSProperties = {
  fontSize: "0.95rem",
  fontWeight: 600,
  color: "hsl(var(--text-primary))",
};

const calculatorBadgeStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  padding: "0.25rem 0.6rem",
  borderRadius: "20px",
  backgroundColor: "hsl(var(--accent) / 10%)",
  color: "hsl(var(--accent))",
  fontWeight: 500,
};

const calculatorContentStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
};

const calculatorMetricRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  backgroundColor: "hsl(var(--bg-tertiary) / 30%)",
  padding: "1rem",
  borderRadius: "8px",
  gap: "1rem",
  flexWrap: "wrap",
};

const calculatorMetricStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  flex: 1,
  minWidth: "100px",
  gap: "0.25rem",
};

const calculatorMetricLabelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "hsl(var(--text-muted))",
};

const calculatorMetricValueStyle: React.CSSProperties = {
  fontSize: "1.1rem",
  fontWeight: 700,
  color: "hsl(var(--text-primary))",
};

const calculatorMetricDividerStyle: React.CSSProperties = {
  width: "1px",
  height: "30px",
  backgroundColor: "var(--glass-border)",
};

const calculatorResultWrapperStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
  backgroundColor: "hsl(var(--accent) / 5%)",
  border: "1px dashed hsl(var(--accent) / 25%)",
  padding: "1rem",
  borderRadius: "8px",
};

const calculatorResultLabelStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  color: "hsl(var(--text-muted))",
};

const calculatorResultValueStyle: React.CSSProperties = {
  fontSize: "1.2rem",
  fontWeight: 700,
  color: "hsl(var(--accent))",
};

const calculatorNoteStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "hsl(var(--text-muted))",
  fontStyle: "italic",
  margin: 0,
};

