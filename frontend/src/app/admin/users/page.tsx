"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/utils/api";
import { auth } from "@/utils/auth";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar: string;
  plan: string;
  credits: number;
  stripe_customer_id?: string;
  telegram_chat_id?: string;
  telegram_bot_token?: string;
  is_admin: boolean;
  created_at: string;
  leads_count?: number;
  campaigns_count?: number;
  accounts_count?: number;
}

function AdminUsersContent() {
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filters — pre-fill from URL ?search= (used when clicking email from Transactions page)
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") ?? "");
  const [planFilter, setPlanFilter] = useState("");

  // Modal / Editing states
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editPlan, setEditPlan] = useState("Free");
  const [editCredits, setEditCredits] = useState(50);
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Deletion state
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError("");
      
      let endpoint = "/api/admin/users";
      const params = [];
      if (searchQuery.trim()) {
        params.push(`search=${encodeURIComponent(searchQuery.trim())}`);
      }
      if (planFilter) {
        params.push(`plan=${encodeURIComponent(planFilter)}`);
      }
      if (params.length > 0) {
        endpoint += `?${params.join("&")}`;
      }

      const data = await api.get(endpoint);
      setUsers(data);
    } catch (err: any) {
      setError(err.message || "Failed to load system users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchUsers();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, planFilter]);

  const handleOpenEdit = (user: UserProfile) => {
    setEditingUser(user);
    setEditPlan(user.plan);
    setEditCredits(user.credits);
    setEditIsAdmin(user.is_admin);
    setError("");
    setSuccess("");
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      const updated = await api.post(`/api/admin/users/${editingUser.id}/update-profile`, {
        plan: editPlan,
        credits: editCredits,
        is_admin: editIsAdmin,
      });

      // Update local state
      setUsers(users.map((u) => (u.id === editingUser.id ? { ...u, ...updated } : u)));
      setSuccess(`User profile for ${editingUser.email} updated successfully.`);
      setEditingUser(null);
    } catch (err: any) {
      setError(err.message || "Failed to update user profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;

    setIsDeleting(true);
    setError("");
    setSuccess("");

    try {
      await api.delete(`/api/admin/users/${deletingUser.id}`);
      setUsers(users.filter((u) => u.id !== deletingUser.id));
      setSuccess(`User account ${deletingUser.email} and all data deleted successfully.`);
      setDeletingUser(null);
    } catch (err: any) {
      setError(err.message || "Failed to delete user account.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleImpersonateUser = async (user: UserProfile) => {
    if (!confirm(`Are you sure you want to impersonate ${user.email}? You will be logged in as them.`)) {
      return;
    }

    try {
      setError("");
      setSuccess("");

      const res = await api.post(`/api/admin/users/${user.id}/impersonate`, {});
      if (res && res.token) {
        // Save current admin token & session
        const currentToken = auth.getToken();
        const currentUser = auth.getCurrentUser();

        if (currentToken && currentUser) {
          localStorage.setItem("getleads_admin_token", currentToken);
          localStorage.setItem("getleads_admin_session", JSON.stringify(currentUser));
        }

        // Log in as target user
        const targetUserProfile = {
          id: res.user.id,
          email: res.user.email,
          name: res.user.name || res.user.email.split("@")[0],
          avatar: res.user.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${res.user.id}`,
          plan: res.user.plan || "Free",
          credits: res.user.credits || 0,
          is_admin: res.user.is_admin || false
        };

        localStorage.setItem("getleads_session", JSON.stringify(targetUserProfile));
        localStorage.setItem("getleads_token", res.token);

        // Dispatch events to notify listeners (Navbar, etc.)
        window.dispatchEvent(new Event("storage"));
        window.dispatchEvent(new Event("credits_updated"));

        // Redirect to dashboard as the impersonated user
        window.location.href = "/dashboard";
      } else {
        throw new Error("Invalid response from impersonate API.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to impersonate user.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-fade-in">
      
      {/* Alert Banners */}
      {error && <div style={errorBannerStyle}>⚠️ {error}</div>}
      {success && <div style={successBannerStyle}>✓ {success}</div>}

      {/* Filter and Actions Header */}
      <div className="glass-panel" style={filterPanelStyle}>
        <div style={searchWrapperStyle}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={searchIconStyle}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.603 10.603z" />
          </svg>
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field"
            style={{ paddingLeft: "2.75rem" }}
          />
        </div>
        
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="input-field"
          style={{ maxWidth: "200px" }}
        >
          <option value="">All Plan Tiers</option>
          <option value="Free">Free Plan</option>
          <option value="Starter">Starter Plan</option>
          <option value="Pro">Pro Plan</option>
        </select>
      </div>

      {/* Users Registry Table */}
      <div className="glass-panel" style={tableContainerStyle}>
        {loading ? (
          <div style={loadingWrapperStyle}>
            <div style={spinnerStyle} />
            <span>Updating registry...</span>
          </div>
        ) : users.length === 0 ? (
          <div style={noDataStyle}>No users found in the system matching criteria.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr style={thRowStyle}>
                  <th style={thStyle}>User</th>
                  <th style={thStyle}>Plan Tier</th>
                  <th style={thStyle}>Scraping Credits</th>
                  <th style={thStyle}>System Role</th>
                  <th style={thStyle}>Usage Stats</th>
                  <th style={thStyle}>Joined Date</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} style={trStyle}>
                    <td style={tdStyle}>
                      <div style={userInfoWrapperStyle}>
                        <img
                          src={user.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.name || user.email}`}
                          alt="Avatar"
                          style={avatarStyle}
                        />
                        <div style={userDetailStyle}>
                          <span style={userNameStyle}>{user.name || "N/A"}</span>
                          <span style={userEmailStyle}>{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span className={`badge ${user.plan === "Pro" ? "badge-primary" : user.plan === "Starter" ? "badge-warning" : "badge-success"}`}>
                        {user.plan}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600, color: "hsl(var(--text-primary))" }}>🪙 {user.credits.toLocaleString()}</span>
                    </td>
                    <td style={tdStyle}>
                      <span className={`badge ${user.is_admin ? "badge-primary" : "badge-secondary"}`} style={{ opacity: user.is_admin ? 1 : 0.6 }}>
                        {user.is_admin ? "Super Admin" : "User"}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.75rem" }}>
                        <span style={{ color: "hsl(var(--text-secondary))" }}>
                          📧 <b>{user.accounts_count || 0}</b> mailboxes
                        </span>
                        <span style={{ color: "hsl(var(--text-secondary))" }}>
                          🚀 <b>{user.campaigns_count || 0}</b> campaigns
                        </span>
                        <span style={{ color: "hsl(var(--text-secondary))" }}>
                          👥 <b>{user.leads_count || 0}</b> leads
                        </span>
                      </div>
                    </td>
                    <td style={tdStyle}>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "0.5rem" }}>
                        {user.id !== auth.getCurrentUser()?.id && (
                          <button
                            onClick={() => handleImpersonateUser(user)}
                            className="btn btn-secondary"
                            style={{ 
                              padding: "0.4rem 0.8rem", 
                              fontSize: "0.8rem",
                              color: "hsl(var(--accent))",
                              borderColor: "hsl(var(--accent) / 20%)"
                            }}
                          >
                            👥 Impersonate
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEdit(user)}
                          className="btn btn-secondary"
                          style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}
                        >
                          ✏️ Edit
                        </button>
                        
                        {/* Only allow deleting if it's not the logged-in user themselves */}
                        {user.email !== "borhan.seoexpert@gmail.com" && (
                          <button
                            onClick={() => setDeletingUser(user)}
                            className="btn btn-secondary"
                            style={{ 
                              padding: "0.4rem 0.8rem", 
                              fontSize: "0.8rem", 
                              color: "hsl(var(--danger))", 
                              borderColor: "hsl(var(--danger) / 10%)" 
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "hsl(var(--danger) / 10%)"}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                          >
                            🗑️ Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Editing Overlay Modal */}
      {editingUser && (
        <div style={overlayStyle} className="animate-fade-in">
          <div className="glass-panel" style={modalStyle}>
            <div style={modalHeaderStyle}>
              <h3 style={modalTitleStyle}>✏️ Edit Profile: {editingUser.name || editingUser.email}</h3>
              <button onClick={() => setEditingUser(null)} style={closeBtnStyle}>✕</button>
            </div>
            
            <form onSubmit={handleSaveUser} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Subscription Plan</label>
                <select
                  value={editPlan}
                  onChange={(e) => setEditPlan(e.target.value)}
                  className="input-field"
                  required
                >
                  <option value="Free">Free Plan (50 credits/mo)</option>
                  <option value="Starter">Starter Plan (2,500 credits/mo)</option>
                  <option value="Pro">Pro Plan (10,000 credits/mo)</option>
                </select>
              </div>

              <div style={inputGroupStyle}>
                <label style={labelStyle}>Scraping Credits (Token Balance)</label>
                <input
                  type="number"
                  min="0"
                  value={editCredits}
                  onChange={(e) => setEditCredits(parseInt(e.target.value) || 0)}
                  className="input-field"
                  required
                />
              </div>

              <div style={checkboxGroupStyle}>
                <input
                  type="checkbox"
                  id="isAdminCheckbox"
                  checked={editIsAdmin}
                  onChange={(e) => setEditIsAdmin(e.target.checked)}
                  style={checkboxStyle}
                />
                <label htmlFor="isAdminCheckbox" style={checkboxLabelStyle}>
                  Grant Super Admin privileges (`is_admin`)
                </label>
              </div>

              <div style={modalActionsStyle}>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="btn btn-secondary"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSaving}
                >
                  {isSaving ? "Saving Adjustments..." : "Save Adjustments"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deletion Confirmation Modal */}
      {deletingUser && (
        <div style={overlayStyle} className="animate-fade-in">
          <div className="glass-panel" style={{ ...modalStyle, borderColor: "hsl(var(--danger) / 30%)" }}>
            <div style={modalHeaderStyle}>
              <h3 style={{ ...modalTitleStyle, color: "hsl(var(--danger))" }}>⚠️ Delete User Account?</h3>
              <button onClick={() => setDeletingUser(null)} style={closeBtnStyle}>✕</button>
            </div>
            
            <p style={warningTextStyle}>
              Are you absolutely sure you want to delete the user account for <b>{deletingUser.email}</b>?
            </p>
            
            <p style={{ fontSize: "0.85rem", color: "hsl(var(--text-secondary))", lineHeight: 1.5 }}>
              This action is <b>permanent</b> and cannot be undone. It will immediately purge all associated data, including connected email addresses, lead databases, outreach campaigns, blacklists, and credit logs.
            </p>

            <div style={modalActionsStyle}>
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="btn btn-secondary"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                className="btn btn-primary"
                style={{ 
                  background: "linear-gradient(135deg, hsl(var(--danger)), #e11d48)",
                  boxShadow: "0 4px 14px 0 rgba(225, 29, 72, 0.3)"
                }}
                disabled={isDeleting}
              >
                {isDeleting ? "Purging Account..." : "Yes, Purge Account"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Inline Styles
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

const filterPanelStyle: React.CSSProperties = {
  padding: "1rem 1.5rem",
  display: "flex",
  gap: "1rem",
  alignItems: "center",
  flexWrap: "wrap",
};

const searchWrapperStyle: React.CSSProperties = {
  position: "relative",
  flex: 1,
  minWidth: "260px",
};

const searchIconStyle: React.CSSProperties = {
  position: "absolute",
  left: "1rem",
  top: "50%",
  transform: "translateY(-50%)",
  width: "18px",
  height: "18px",
  color: "hsl(var(--text-muted))",
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

const userInfoWrapperStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
};

const avatarStyle: React.CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "50%",
  backgroundColor: "hsl(var(--bg-tertiary))",
  border: "1px solid hsl(var(--accent) / 20%)",
};

const userDetailStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.15rem",
};

const userNameStyle: React.CSSProperties = {
  fontWeight: 600,
  color: "hsl(var(--text-primary))",
};

const userEmailStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  color: "hsl(var(--text-muted))",
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(3, 7, 18, 0.75)",
  backdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: "1rem",
};

const modalStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "480px",
  padding: "2rem",
  background: "var(--glass-bg)",
  display: "flex",
  flexDirection: "column",
  gap: "1.5rem",
  border: "1px solid var(--glass-border)",
  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.5)",
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderBottom: "1px solid hsl(var(--border-color))",
  paddingBottom: "1rem",
};

const modalTitleStyle: React.CSSProperties = {
  fontSize: "1.15rem",
  color: "hsl(var(--text-primary))",
  fontWeight: 600,
};

const closeBtnStyle: React.CSSProperties = {
  backgroundColor: "transparent",
  border: "none",
  color: "hsl(var(--text-muted))",
  cursor: "pointer",
  fontSize: "1.1rem",
  transition: "color 0.2s ease",
};

const inputGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "hsl(var(--text-muted))",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const checkboxGroupStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
  marginTop: "0.25rem",
  userSelect: "none",
};

const checkboxStyle: React.CSSProperties = {
  width: "16px",
  height: "16px",
  accentColor: "hsl(var(--accent))",
  cursor: "pointer",
};

const checkboxLabelStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "hsl(var(--text-secondary))",
  cursor: "pointer",
};

const modalActionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "0.75rem",
  borderTop: "1px solid hsl(var(--border-color))",
  paddingTop: "1.25rem",
  marginTop: "0.5rem",
};

const warningTextStyle: React.CSSProperties = {
  fontSize: "0.95rem",
  color: "hsl(var(--text-primary))",
  lineHeight: 1.4,
};

export default function AdminUsersPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: "4rem", display: "flex", justifyContent: "center", color: "hsl(var(--text-muted))" }}>
        Loading users...
      </div>
    }>
      <AdminUsersContent />
    </Suspense>
  );
}
