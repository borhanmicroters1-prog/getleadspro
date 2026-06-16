"use client";

import { useEffect, useState } from "react";
import { auth, UserProfile } from "@/utils/auth";
import { api } from "@/utils/api";
import { useRouter } from "next/navigation";
interface Ticket {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

interface Reply {
  id: string;
  ticket_id: string;
  sender_email: string;
  is_admin_reply: boolean;
  message: string;
  created_at: string;
}

export default function SupportPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketDetails, setTicketDetails] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form states
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newDescription, setNewDescription] = useState("");
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Reply state
  const [replyMsg, setReplyMsg] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  // Fetch all user tickets
  const fetchTickets = async () => {
    try {
      const data = await api.get("/api/tickets");
      setTickets(data || []);
    } catch (err) {
      console.error("Error fetching tickets:", err);
    } finally {
      setLoadingList(false);
    }
  };

  // Fetch details of a selected ticket
  const fetchTicketDetails = async (id: string) => {
    setLoadingDetails(true);
    try {
      const data = await api.get(`/api/tickets/${id}`);
      if (data) {
        setTicketDetails(data.ticket);
        setReplies(data.replies || []);
      }
    } catch (err) {
      console.error("Error fetching ticket details:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    const currentUser = auth.getCurrentUser();
    if (!currentUser) {
      router.push("/login");
    } else {
      setUser(currentUser);
      setLoadingAuth(false);
      fetchTickets();
    }
  }, [router]);

  useEffect(() => {
    if (selectedTicketId) {
      fetchTicketDetails(selectedTicketId);
    } else {
      setTicketDetails(null);
      setReplies([]);
    }
  }, [selectedTicketId]);

  // Handle new ticket submission
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim()) {
      setErrorMsg("Please fill in both title and description.");
      return;
    }
    setErrorMsg("");
    setSubmittingTicket(true);

    try {
      const newTicket = await api.post("/api/tickets", {
        title: newTitle,
        priority: newPriority,
        description: newDescription
      });

      if (newTicket) {
        setTickets((prev) => [newTicket, ...prev]);
        setSelectedTicketId(newTicket.id);
        setShowCreateModal(false);
        setNewTitle("");
        setNewDescription("");
        setNewPriority("medium");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create support ticket.");
    } finally {
      setSubmittingTicket(false);
    }
  };

  // Handle user reply submission
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMsg.trim() || !selectedTicketId) return;

    setSubmittingReply(true);
    try {
      const newReply = await api.post(`/api/tickets/${selectedTicketId}/reply`, {
        message: replyMsg
      });

      if (newReply) {
        setReplies((prev) => [...prev, newReply]);
        setReplyMsg("");
        
        // Refresh ticket header status (it changes to 'open' if closed)
        if (ticketDetails && (ticketDetails.status === "closed" || ticketDetails.status === "resolved")) {
          setTicketDetails({ ...ticketDetails, status: "open" });
        }
        // Refresh list
        fetchTickets();
      }
    } catch (err) {
      console.error("Error sending reply:", err);
    } finally {
      setSubmittingReply(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case "open":
        return "badge-primary";
      case "in_progress":
        return "badge-warning";
      case "resolved":
        return "badge-success";
      case "closed":
        return "badge-secondary";
      default:
        return "badge-secondary";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "high":
        return "#ef4444";
      case "medium":
        return "#f59e0b";
      case "low":
        return "#3b82f6";
      default:
        return "hsl(var(--text-muted))";
    }
  };

  if (loadingAuth) {
    return (
      <div style={loadingContainerStyle}>
        <div style={spinnerStyle} />
        <span>Loading support dashboard...</span>
      </div>
    );
  }

  return (
    
        <main className="content-pane animate-fade-in" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - var(--navbar-height))", overflow: "hidden" }}>
          {/* Page Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Customer Support</h1>
              <p style={{ margin: "0.25rem 0 0 0", color: "hsl(var(--text-muted))", fontSize: "0.9rem" }}>
                Submit tickets, describe issues, and connect with our administrators.
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
              style={{ padding: "0.6rem 1.25rem", fontSize: "0.9rem" }}
            >
              + Open New Ticket
            </button>
          </div>

          {/* Main Panel - Split Layout */}
          <div style={{ display: "flex", gap: "1.5rem", flex: 1, overflow: "hidden", minHeight: 0 }}>
            
            {/* Left pane - Tickets list */}
            <div className="glass-panel" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "1rem" }}>
              <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem", fontWeight: 600 }}>Your Tickets</h3>
              
              {loadingList ? (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1 }}>
                  <div style={spinnerStyle} />
                </div>
              ) : tickets.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", flex: 1, padding: "2rem", textAlign: "center" }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🎫</div>
                  <h4 style={{ margin: 0, fontWeight: 600 }}>No Support Tickets Yet</h4>
                  <p style={{ color: "hsl(var(--text-muted))", fontSize: "0.85rem", maxWidth: "260px", marginTop: "0.5rem" }}>
                    Need help with scraping limits or connected domains? Open a ticket to contact us.
                  </p>
                </div>
              ) : (
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.75rem", paddingRight: "4px" }}>
                  {tickets.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTicketId(t.id)}
                      style={{
                        padding: "1rem",
                        borderRadius: "12px",
                        backgroundColor: selectedTicketId === t.id ? "hsl(var(--accent) / 10%)" : "hsl(var(--bg-secondary) / 30%)",
                        border: `1px solid ${selectedTicketId === t.id ? "hsl(var(--accent) / 30%)" : "var(--glass-border)"}`,
                        cursor: "pointer",
                        transition: "all 0.15s ease"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                        <h4 style={{ margin: 0, fontSize: "0.925rem", fontWeight: 600, color: "hsl(var(--text-primary))", lineBreak: "anywhere" }}>
                          {t.title}
                        </h4>
                        <span className={`badge ${getStatusBadgeClass(t.status)}`} style={{ fontSize: "10px", textTransform: "capitalize", whiteSpace: "nowrap" }}>
                          {t.status.replace("_", " ")}
                        </span>
                      </div>
                      <p style={{ 
                        margin: "0.5rem 0", 
                        fontSize: "0.825rem", 
                        color: "hsl(var(--text-secondary))",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical"
                      }}>
                        {t.description}
                      </p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", color: "hsl(var(--text-muted))", marginTop: "0.5rem" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: getPriorityColor(t.priority) }}></span>
                          {t.priority.toUpperCase()} Priority
                        </span>
                        <span>{new Date(t.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right pane - Ticket Details & Replies thread */}
            <div className="glass-panel" style={{ flex: 2, display: "flex", flexDirection: "column", overflow: "hidden", padding: "1.5rem" }}>
              {selectedTicketId ? (
                loadingDetails ? (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1 }}>
                    <div style={spinnerStyle} />
                  </div>
                ) : ticketDetails ? (
                  <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
                    {/* Details Header */}
                    <div style={{ borderBottom: "1px solid hsl(var(--border-color))", paddingBottom: "1.25rem", marginBottom: "1rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                        <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "hsl(var(--text-primary))" }}>{ticketDetails.title}</h2>
                        <span className={`badge ${getStatusBadgeClass(ticketDetails.status)}`} style={{ fontSize: "11px", padding: "4px 8px" }}>
                          {ticketDetails.status.replace("_", " ")}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem", fontSize: "0.8rem", color: "hsl(var(--text-muted))" }}>
                        <span>Priority: <strong style={{ color: getPriorityColor(ticketDetails.priority) }}>{ticketDetails.priority.toUpperCase()}</strong></span>
                        <span>•</span>
                        <span>Opened: {new Date(ticketDetails.created_at).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Message & Replies History */}
                    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "1.25rem", paddingRight: "4px", marginBottom: "1rem" }}>
                      
                      {/* Original Question */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "1rem", borderRadius: "12px", backgroundColor: "hsl(var(--bg-secondary) / 20%)", border: "1px solid var(--glass-border)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.785rem", color: "hsl(var(--text-muted))" }}>
                          <strong>You (Creator)</strong>
                          <span>{new Date(ticketDetails.created_at).toLocaleTimeString()}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: "0.875rem", color: "hsl(var(--text-primary))", whiteSpace: "pre-wrap" }}>
                          {ticketDetails.description}
                        </p>
                      </div>

                      {/* Replies Thread */}
                      {replies.map((reply) => (
                        <div
                          key={reply.id}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.5rem",
                            padding: "1rem",
                            borderRadius: "12px",
                            backgroundColor: reply.is_admin_reply ? "hsl(var(--accent) / 5%)" : "hsl(var(--bg-secondary) / 20%)",
                            border: `1px solid ${reply.is_admin_reply ? "hsl(var(--accent) / 25%)" : "var(--glass-border)"}`,
                            marginLeft: reply.is_admin_reply ? "2rem" : "0",
                            marginRight: reply.is_admin_reply ? "0" : "2rem",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.785rem", color: "hsl(var(--text-muted))" }}>
                            <strong style={{ color: reply.is_admin_reply ? "hsl(var(--accent))" : "hsl(var(--text-secondary))" }}>
                              {reply.is_admin_reply ? "🛡️ Support Admin" : "You"}
                            </strong>
                            <span>{new Date(reply.created_at).toLocaleString()}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: "0.875rem", color: "hsl(var(--text-primary))", whiteSpace: "pre-wrap" }}>
                            {reply.message}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Reply Form */}
                    {ticketDetails.status.toLowerCase() !== "closed" ? (
                      <form onSubmit={handleSendReply} style={{ display: "flex", gap: "0.75rem", borderTop: "1px solid hsl(var(--border-color))", paddingTop: "1rem" }}>
                        <input
                          type="text"
                          placeholder="Type your reply message..."
                          value={replyMsg}
                          onChange={(e) => setReplyMsg(e.target.value)}
                          className="input-field"
                          style={{ flex: 1, padding: "0.75rem 1rem", fontSize: "0.875rem" }}
                        />
                        <button
                          type="submit"
                          disabled={submittingReply || !replyMsg.trim()}
                          className="btn btn-primary"
                          style={{
                            padding: "0 1.5rem",
                            fontSize: "0.875rem",
                            height: "42px",
                            opacity: replyMsg.trim() ? 1 : 0.6
                          }}
                        >
                          {submittingReply ? "Sending..." : "Send"}
                        </button>
                      </form>
                    ) : (
                      <div style={{ textAlign: "center", padding: "0.75rem", borderTop: "1px solid hsl(var(--border-color))", paddingTop: "1rem", color: "hsl(var(--text-muted))", fontSize: "0.85rem" }}>
                        🔒 This ticket is closed. Submit a new support ticket if the issue persists.
                      </div>
                    )}
                  </div>
                ) : null
              ) : (
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", flex: 1, color: "hsl(var(--text-muted))" }}>
                  <span style={{ fontSize: "3rem", marginBottom: "1rem" }}>💬</span>
                  <p style={{ margin: 0, fontSize: "0.95rem" }}>Select a support ticket from the list to view history and reply thread.</p>
                </div>
              )}
            </div>
          </div>

          {/* Modal - Create Ticket */}
          {showCreateModal && (
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
              <div className="glass-panel" style={{ width: "100%", maxWidth: "500px", padding: "2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>Open New Support Ticket</h3>
                  <button onClick={() => setShowCreateModal(false)} style={{ backgroundColor: "transparent", border: "none", color: "hsl(var(--text-muted))", cursor: "pointer", fontSize: "1.25rem" }}>×</button>
                </div>

                {errorMsg && (
                  <div style={{ padding: "0.75rem 1rem", backgroundColor: "hsl(var(--danger) / 10%)", border: "1px solid hsl(var(--danger) / 20%)", color: "hsl(var(--danger))", borderRadius: "8px", fontSize: "0.85rem" }}>
                    ⚠️ {errorMsg}
                  </div>
                )}

                <form onSubmit={handleCreateTicket} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                    <label style={labelStyle}>Ticket Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Scraper API returned 502 error / Account billing issue"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="input-field"
                      required
                    />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                    <label style={labelStyle}>Priority Level</label>
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value)}
                      className="input-field"
                      style={{ padding: "0.75rem 1rem" }}
                    >
                      <option value="low">Low - General query</option>
                      <option value="medium">Medium - Default / System errors</option>
                      <option value="high">High - Account lock or billing failed</option>
                    </select>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                    <label style={labelStyle}>Description of the Issue</label>
                    <textarea
                      rows={5}
                      placeholder="Provide details about the issue you are experiencing..."
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      className="input-field"
                      style={{ resize: "none" }}
                      required
                    ></textarea>
                  </div>

                  <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="btn btn-secondary"
                      style={{ flex: 1, padding: "0.75rem" }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingTicket}
                      className="btn btn-primary"
                      style={{ flex: 1, padding: "0.75rem" }}
                    >
                      {submittingTicket ? "Submitting..." : "Submit Ticket"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 700,
  color: "hsl(var(--text-muted))",
  textTransform: "uppercase",
  letterSpacing: "0.05em"
};

const loadingContainerStyle: React.CSSProperties = {
  minHeight: "100vh",
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "1.5rem",
  color: "hsl(var(--text-secondary))"
};

const spinnerStyle: React.CSSProperties = {
  width: "40px",
  height: "40px",
  border: "3px solid hsl(var(--border-color))",
  borderTopColor: "hsl(var(--accent))",
  borderRadius: "50%",
  animation: "spin 1s linear infinite"
};
