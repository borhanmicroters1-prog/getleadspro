"use client";

import { useEffect, useState } from "react";
import { auth } from "@/utils/auth";
import Link from "next/link";

interface Ticket {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
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

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketDetails, setTicketDetails] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");

  // Reply state
  const [replyMsg, setReplyMsg] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // Fetch all support tickets (with status filter)
  const fetchTickets = async () => {
    setLoadingList(true);
    try {
      const token = auth.getToken();
      const url = statusFilter
        ? `${apiBaseUrl}/api/admin/tickets?status_filter=${statusFilter}`
        : `${apiBaseUrl}/api/admin/tickets`;
        
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
      }
    } catch (err) {
      console.error("Error fetching admin tickets:", err);
    } finally {
      setLoadingList(false);
    }
  };

  // Fetch details of a selected ticket
  const fetchTicketDetails = async (id: string) => {
    setLoadingDetails(true);
    try {
      const token = auth.getToken();
      const res = await fetch(`${apiBaseUrl}/api/admin/tickets/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setTicketDetails(data.ticket);
        setReplies(data.replies);
      }
    } catch (err) {
      console.error("Error fetching admin ticket details:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [statusFilter]);

  useEffect(() => {
    if (selectedTicketId) {
      fetchTicketDetails(selectedTicketId);
    } else {
      setTicketDetails(null);
      setReplies([]);
    }
  }, [selectedTicketId]);

  // Handle admin reply submission
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMsg.trim() || !selectedTicketId) return;

    setSubmittingReply(true);
    try {
      const token = auth.getToken();
      const res = await fetch(`${apiBaseUrl}/api/admin/tickets/${selectedTicketId}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          message: replyMsg
        })
      });

      if (res.ok) {
        const newReply = await res.json();
        setReplies((prev) => [...prev, newReply]);
        setReplyMsg("");
        
        // Refresh ticket details (sets status to 'in_progress')
        if (ticketDetails) {
          setTicketDetails({ ...ticketDetails, status: "in_progress" });
        }
        
        // Refresh sidebar ticket statuses
        fetchTickets();

        // Dispatch custom event to refresh Sidebar badge count
        window.dispatchEvent(new CustomEvent("ticketStatusChanged"));
      }
    } catch (err) {
      console.error("Error sending admin reply:", err);
    } finally {
      setSubmittingReply(false);
    }
  };

  // Change ticket status manually
  const handleStatusChange = async (newStatus: string) => {
    if (!selectedTicketId || !ticketDetails) return;
    try {
      const token = auth.getToken();
      const res = await fetch(`${apiBaseUrl}/api/admin/tickets/${selectedTicketId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status: newStatus
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setTicketDetails({ ...ticketDetails, status: updated.status });
        // Refresh list
        fetchTickets();

        // Dispatch custom event to refresh Sidebar badge count
        window.dispatchEvent(new CustomEvent("ticketStatusChanged"));
      }
    } catch (err) {
      console.error("Error updating ticket status:", err);
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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - var(--navbar-height) - 4rem)", overflow: "hidden" }}>
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Customer Support Tickets</h1>
          <p style={{ margin: "0.25rem 0 0 0", color: "hsl(var(--text-muted))", fontSize: "0.9rem" }}>
            Super Admin Portal — review client tickets, reply, and manage system resolutions.
          </p>
        </div>

        {/* Filter Pills */}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {["", "open", "in_progress", "resolved", "closed"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              style={{
                padding: "0.45rem 1rem",
                backgroundColor: statusFilter === status ? "hsl(var(--accent) / 20%)" : "transparent",
                border: `1px solid ${statusFilter === status ? "hsl(var(--accent) / 30%)" : "hsl(var(--border-color))"}`,
                borderRadius: "20px",
                color: statusFilter === status ? "hsl(var(--text-primary))" : "hsl(var(--text-secondary))",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
                textTransform: "capitalize",
                transition: "all 0.15s ease"
              }}
            >
              {status === "" ? "All Statuses" : status.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split Layout */}
      <div style={{ display: "flex", gap: "1.5rem", flex: 1, overflow: "hidden", minHeight: 0 }}>
        
        {/* Left pane - Tickets list */}
        <div className="glass-panel" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "1rem" }}>
          <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem", fontWeight: 600 }}>Active Tickets</h3>
          
          {loadingList ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1 }}>
              <div className="spinner"></div>
            </div>
          ) : tickets.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", flex: 1, padding: "2rem", textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🎉</div>
              <h4 style={{ margin: 0, fontWeight: 600 }}>No Support Tickets Found</h4>
              <p style={{ color: "hsl(var(--text-muted))", fontSize: "0.85rem", marginTop: "0.5rem" }}>
                All customer support requests have been resolved or closed.
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
                  
                  {/* User identifier */}
                  <div style={{ fontSize: "0.75rem", color: "hsl(var(--accent))", fontWeight: 600, margin: "0.3rem 0" }}>
                    👤 {t.user_email}
                  </div>

                  <p style={{ 
                    margin: "0.3rem 0", 
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
                <div className="spinner"></div>
              </div>
            ) : ticketDetails ? (
              <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
                
                {/* Details Header */}
                <div style={{ borderBottom: "1px solid hsl(var(--border-color))", paddingBottom: "1.25rem", marginBottom: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "hsl(var(--text-primary))" }}>{ticketDetails.title}</h2>
                      <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem", fontSize: "0.8rem", color: "hsl(var(--text-muted))" }}>
                        <span>Customer: <strong style={{ color: "hsl(var(--accent))" }}>{ticketDetails.user_name}</strong> ({ticketDetails.user_email})</span>
                      </div>
                    </div>
                    
                    {/* Admin status switcher */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.3rem" }}>
                      <span className={`badge ${getStatusBadgeClass(ticketDetails.status)}`} style={{ fontSize: "11px", padding: "4px 8px" }}>
                        {ticketDetails.status.replace("_", " ")}
                      </span>
                      <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.3rem" }}>
                        {["open", "in_progress", "resolved", "closed"].map((st) => (
                          <button
                            key={st}
                            onClick={() => handleStatusChange(st)}
                            disabled={ticketDetails.status === st}
                            style={{
                              padding: "2px 6px",
                              backgroundColor: ticketDetails.status === st ? "hsl(var(--accent) / 20%)" : "transparent",
                              border: "1px solid hsl(var(--border-color))",
                              borderRadius: "4px",
                              fontSize: "10px",
                              color: ticketDetails.status === st ? "hsl(var(--text-primary))" : "hsl(var(--text-muted))",
                              cursor: "pointer",
                              textTransform: "capitalize"
                            }}
                            title={`Mark as ${st.replace("_", " ")}`}
                          >
                            {st === "in_progress" ? "In Prog" : st}
                          </button>
                        ))}
                      </div>
                    </div>
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
                      <strong>{ticketDetails.user_name} (Client)</strong>
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
                          {reply.is_admin_reply ? "🛡️ You (Support Admin)" : `${ticketDetails.user_name} (Client)`}
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
                <form onSubmit={handleSendReply} style={{ display: "flex", gap: "0.75rem", borderTop: "1px solid hsl(var(--border-color))", paddingTop: "1rem" }}>
                  <input
                    type="text"
                    placeholder="Type your official reply (sends user an email notification)..."
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
                    {submittingReply ? "Responding..." : "Send Reply"}
                  </button>
                </form>
              </div>
            ) : null
          ) : (
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", flex: 1, color: "hsl(var(--text-muted))" }}>
              <span style={{ fontSize: "3rem", marginBottom: "1rem" }}>💬</span>
              <p style={{ margin: 0, fontSize: "0.95rem" }}>Select a customer support ticket to review the issue and write replies.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
