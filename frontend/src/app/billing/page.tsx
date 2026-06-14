"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, UserProfile } from "@/utils/auth";
import { api } from "@/utils/api";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

interface HistoryItem {
  id: string;
  action: string;  // scrape, purchase, bonus
  amount: number;
  balance_after: number;
  reference: string | null;
  created_at: string;
}

function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const status = searchParams.get("status");
  const tranId = searchParams.get("tran_id");

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState("");
  const [checkoutLoadingId, setCheckoutLoadingId] = useState<string | null>(null);

  // Promo Code States
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount_type: string; discount_value: number } | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoSuccess, setPromoSuccess] = useState("");
  const [validatingPromo, setValidatingPromo] = useState(false);

  // Sync auth
  useEffect(() => {
    const currentUser = auth.getCurrentUser();
    if (!currentUser) {
      router.push("/login");
    } else {
      setUser(currentUser);
      setLoading(false);
    }
  }, [router]);

  // Sync details from DB and load transaction log history
  const loadBillingData = async () => {
    try {
      // Sync latest user profile details (credits/plan)
      const userData = await api.get("/api/auth/me");
      auth.updateCurrentUserProfile(userData);
      setUser(userData);

      // Load credits history
      const historyData = await api.get("/api/billing/history");
      setHistory(historyData || []);
    } catch (err: any) {
      console.error("Failed to load billing history details:", err);
    }
  };

  useEffect(() => {
    if (user) {
      loadBillingData();
    }
  }, [user]);

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    try {
      setValidatingPromo(true);
      setPromoError("");
      setPromoSuccess("");
      
      const res = await api.get(`/api/billing/promo-codes/validate?code=${encodeURIComponent(promoCode.trim().toUpperCase())}`);
      setAppliedPromo(res);
      
      let msg = "";
      if (res.discount_type === "percentage") msg = `Promo code applied: ${res.code} (${res.discount_value}% Discount)`;
      else if (res.discount_type === "fixed") msg = `Promo code applied: ${res.code} (৳${res.discount_value} Discount)`;
      else msg = `Promo code applied: ${res.code} (+${res.discount_value.toLocaleString()} Bonus Credits)`;
      
      setPromoSuccess(msg);
    } catch (err: any) {
      setAppliedPromo(null);
      setPromoError(err.message || "Invalid or expired promo code.");
    } finally {
      setValidatingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCode("");
    setPromoSuccess("");
    setPromoError("");
  };

  const handleCheckout = async (itemType: "plan" | "pack", itemId: string) => {
    const btnId = `${itemType}_${itemId}`;
    setCheckoutLoadingId(btnId);
    setError("");

    try {
      const response = await api.post("/api/billing/checkout", {
        item_type: itemType,
        item_id: itemId,
        promo_code: appliedPromo ? appliedPromo.code : null
      });

      if (response && response.GatewayPageURL) {
        // Redirect user to SSLCommerz gateway
        window.location.href = response.GatewayPageURL;
      } else {
        throw new Error("Failed to retrieve payment redirection URL.");
      }
    } catch (err: any) {
      setError(err.message || "Checkout initiation failed. Please try again.");
      setCheckoutLoadingId(null);
    }
  };

  const getDisplayPrice = (original: number) => {
    if (!appliedPromo || appliedPromo.discount_type === "credits") return `৳${original.toLocaleString()}`;
    if (appliedPromo.discount_type === "percentage") {
      const discounted = original * (1.0 - (appliedPromo.discount_value / 100.0));
      return (
        <span>
          <span style={{ textDecoration: "line-through", color: "hsl(var(--text-muted))", fontSize: "0.55em", marginRight: "0.4rem", fontWeight: 400 }}>
            ৳{original.toLocaleString()}
          </span>
          ৳{discounted.toLocaleString()}
        </span>
      );
    } else if (appliedPromo.discount_type === "fixed") {
      const discounted = Math.max(0, original - appliedPromo.discount_value);
      return (
        <span>
          <span style={{ textDecoration: "line-through", color: "hsl(var(--text-muted))", fontSize: "0.55em", marginRight: "0.4rem", fontWeight: 400 }}>
            ৳{original.toLocaleString()}
          </span>
          ৳{discounted.toLocaleString()}
        </span>
      );
    }
    return `৳${original.toLocaleString()}`;
  };

  const getDisplayCredits = (original: number) => {
    if (!appliedPromo || appliedPromo.discount_type !== "credits") return original.toLocaleString();
    const bonus = appliedPromo.discount_value;
    const total = original + bonus;
    return (
      <span>
        {original.toLocaleString()}
        <span style={{ color: "hsl(142 71% 45%)", fontSize: "0.85em", marginLeft: "0.4rem", fontWeight: 700 }}>
          (+{bonus.toLocaleString()} Bonus)
        </span>
      </span>
    );
  };

  if (loading || !user) {
    return (
      <div style={loadingContainerStyle}>
        <div style={spinnerStyle} />
        <span>Loading Billing Center...</span>
      </div>
    );
  }

  return (
    <main className="content-pane animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      
      {/* Header */}
      <div style={headerActionRowStyle}>
        <div style={headerTextWrapperStyle}>
          <h2 style={sectionTitleStyle}>Plan & Billing</h2>
          <p style={sectionSubStyle}>Upgrade plan limits and manage scraping credits</p>
        </div>
      </div>

      {/* Redirect Status Alerts */}
      {status === "success" && (
        <div style={successBannerStyle}>
          🎉 <b>Payment Successful!</b> Your transaction (ID: <code style={{ fontFamily: "monospace", fontSize: "12px", background: "rgb(0 0 0 / 20%)", padding: "2px 6px", borderRadius: "4px" }}>{tranId}</code>) was validated successfully. Your scraping credits and plan quotas have been upgraded.
        </div>
      )}
      {status === "fail" && (
        <div style={errorBannerStyle}>
          ⚠️ <b>Payment Failed!</b> Transaction could not be completed. Please verify your payment details and try again.
        </div>
      )}
      {status === "cancel" && (
        <div style={warningBannerStyle}>
          ⚠️ <b>Payment Canceled!</b> The payment transaction was canceled.
        </div>
      )}
      {error && <div style={errorBannerStyle}>⚠️ {error}</div>}

      {/* Current Subscription Summary */}
      <div className="glass-panel" style={summaryPanelStyle}>
        <h3 style={panelTitleStyle}>My Subscription Plan</h3>
        <div style={summaryGridStyle}>
          <div style={summaryCardStyle}>
            <span style={summaryCardLabelStyle}>Current Active Plan</span>
            <span style={{ ...summaryCardValueStyle, color: "hsl(var(--accent-cyan))" }}>
              {user.plan} Plan
            </span>
          </div>
          <div style={summaryCardStyle}>
            <span style={summaryCardLabelStyle}>Remaining Scraping Credits</span>
            <span style={summaryCardValueStyle}>
              🪙 {user.credits.toLocaleString()}
            </span>
          </div>
          <div style={summaryCardStyle}>
            <span style={summaryCardLabelStyle}>Daily Outreach Limit</span>
            <span style={summaryCardValueStyle}>
              {user.plan === "Pro" ? "500" : user.plan === "Starter" ? "200" : "50"} / day
            </span>
          </div>
        </div>
      </div>

      {/* Promo Code Coupon Input Panel */}
      <div className="glass-panel" style={{ padding: "1.25rem 1.75rem" }}>
        <h3 style={panelTitleStyle}>🎁 Have a Promo Code?</h3>
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <input 
            className="input-field" 
            placeholder="ENTER COUPON CODE" 
            value={promoCode} 
            onChange={e => setPromoCode(e.target.value)} 
            disabled={appliedPromo !== null || validatingPromo}
            style={{ width: "240px", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}
          />
          {appliedPromo ? (
            <button className="btn btn-secondary" onClick={handleRemovePromo} style={{ padding: "0.6rem 1.25rem" }}>
              ❌ Remove Coupon
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleApplyPromo} disabled={validatingPromo || !promoCode.trim()} style={{ padding: "0.6rem 1.25rem" }}>
              {validatingPromo ? "Validating..." : "Apply Coupon"}
            </button>
          )}
        </div>
        {promoError && (
          <p style={{ color: "hsl(var(--danger))", fontSize: "0.82rem", marginTop: "0.5rem", fontWeight: 500 }}>
            ⚠️ {promoError}
          </p>
        )}
        {promoSuccess && (
          <p style={{ color: "hsl(142 71% 45%)", fontSize: "0.82rem", marginTop: "0.5rem", fontWeight: 600 }}>
            ✅ {promoSuccess}
          </p>
        )}
      </div>

      {/* Subscription Pricing Plans */}
      <div>
        <h3 style={sectionGroupTitleStyle}>Choose a Subscription Plan</h3>
        <div style={pricingGridStyle}>
          
          {/* Free Card */}
          <div className="glass-panel" style={user.plan === "Free" ? { ...pricingCardStyle, border: "2px solid hsl(var(--success) / 30%)" } : pricingCardStyle}>
            <div style={pricingCardHeaderStyle}>
              <span style={pricingCardTitleStyle}>Free Plan</span>
              <span style={pricingCardPriceStyle}>৳0 <span style={pricingCardUnitStyle}>/ month</span></span>
            </div>
            <div style={pricingDividerStyle} />
            <ul style={featuresListStyle}>
              <li style={featureItemStyle}>✓ 50 Scraped Leads included</li>
              <li style={featureItemStyle}>✓ Gmail cold email outreach</li>
              <li style={featureItemStyle}>✓ 50 emails sending limit / day</li>
              <li style={featureItemStyle} className="disabled-feature">✗ Brevo SMTP Integration</li>
              <li style={featureItemStyle} className="disabled-feature">✗ AI email personalization</li>
              <li style={featureItemStyle} className="disabled-feature">✗ Telegram alerts & reports</li>
            </ul>
            <button 
              disabled 
              className="btn btn-secondary" 
              style={{ width: "100%", marginTop: "auto", cursor: "not-allowed", opacity: 0.6 }}
            >
              {user.plan === "Free" ? "Current Active Plan" : "Default Plan"}
            </button>
          </div>

          {/* Starter Card */}
          <div className="glass-panel" style={user.plan === "Starter" ? { ...pricingCardStyle, border: "2px solid hsl(var(--success) / 30%)" } : pricingCardStyle}>
            <div style={pricingCardHeaderStyle}>
              <span style={pricingCardTitleStyle}>Starter Plan</span>
              <span style={pricingCardPriceStyle}>{getDisplayPrice(490)} <span style={pricingCardUnitStyle}>/ month</span></span>
            </div>
            <div style={pricingDividerStyle} />
            <ul style={featuresListStyle}>
              <li style={featureItemStyle}>✓ <b>{getDisplayCredits(2500)}</b> leads included</li>
              <li style={featureItemStyle}>✓ Gmail + Brevo email senders</li>
              <li style={featureItemStyle}>✓ 200 emails sending limit / day</li>
              <li style={featureItemStyle}>✓ Claude & GPT Email personalization</li>
              <li style={featureItemStyle}>✓ Automated follow-up sequencing</li>
              <li style={featureItemStyle} className="disabled-feature">✗ A/B split testing</li>
              <li style={featureItemStyle} className="disabled-feature">✗ Telegram Bot notifications</li>
            </ul>
            <button 
              onClick={() => handleCheckout("plan", "starter")}
              disabled={checkoutLoadingId !== null || user.plan === "Starter"} 
              className="btn btn-primary" 
              style={{ width: "100%", marginTop: "auto" }}
            >
              {checkoutLoadingId === "plan_starter" ? "Initiating..." : user.plan === "Starter" ? "Current Plan" : "Upgrade to Starter"}
            </button>
          </div>

          {/* Pro Card */}
          <div className="glass-panel" style={user.plan === "Pro" ? { ...pricingCardStyle, border: "2px solid hsl(var(--success) / 35%)", transform: "scale(1.02)", borderColor: "hsl(var(--accent) / 40%)" } : { ...pricingCardStyle, transform: "scale(1.02)" }}>
            <div style={{ ...pricingCardHeaderStyle, position: "relative" }}>
              <span style={popularBadgeStyle}>MOST POPULAR</span>
              <span style={pricingCardTitleStyle}>Pro Plan</span>
              <span style={pricingCardPriceStyle}>{getDisplayPrice(1490)} <span style={pricingCardUnitStyle}>/ month</span></span>
            </div>
            <div style={pricingDividerStyle} />
            <ul style={featuresListStyle}>
              <li style={featureItemStyle}>✓ <b>{getDisplayCredits(10000)}</b> leads included</li>
              <li style={featureItemStyle}>✓ Unlimited Gmail & Brevo mailboxes</li>
              <li style={featureItemStyle}>✓ 500 emails sending limit / day</li>
              <li style={featureItemStyle}>✓ AI email template drafts</li>
              <li style={featureItemStyle}>✓ A/B Split Testing winner selection</li>
              <li style={featureItemStyle}>✓ <b>Telegram Bot alerts & reports</b></li>
              <li style={featureItemStyle}>✓ Full Campaign Analytics dashboard</li>
            </ul>
            <button 
              onClick={() => handleCheckout("plan", "pro")}
              disabled={checkoutLoadingId !== null || user.plan === "Pro"} 
              className="btn btn-primary" 
              style={{ width: "100%", marginTop: "auto", background: "linear-gradient(135deg, hsl(var(--accent)), hsl(var(--accent-secondary)))" }}
            >
              {checkoutLoadingId === "plan_pro" ? "Initiating..." : user.plan === "Pro" ? "Current Plan" : "Upgrade to Pro"}
            </button>
          </div>

        </div>
      </div>

      {/* Credit Purchase Packs */}
      <div>
        <h3 style={sectionGroupTitleStyle}>Purchase One-time Scraping Credits</h3>
        <p style={{ fontSize: "0.85rem", color: "hsl(var(--text-secondary))", marginTop: "-0.5rem", marginBottom: "1.25rem" }}>
          Need more leads? Buy additional scraping credits instantly. Credits never expire.
        </p>
        <div style={creditPacksGridStyle}>
          
          {/* Bundle 1 */}
          <div className="glass-panel" style={packCardStyle}>
            <span style={packCreditsStyle}>🪙 {getDisplayCredits(2500)} Credits</span>
            <span style={packPriceStyle}>{getDisplayPrice(490)}</span>
            <button 
              onClick={() => handleCheckout("pack", "starter")}
              disabled={checkoutLoadingId !== null}
              className="btn btn-secondary" 
              style={{ width: "100%", fontSize: "0.85rem" }}
            >
              {checkoutLoadingId === "pack_starter" ? "Purchasing..." : "Purchase Bundle"}
            </button>
          </div>

          {/* Bundle 2 */}
          <div className="glass-panel" style={packCardStyle}>
            <span style={packCreditsStyle}>🪙 {getDisplayCredits(10000)} Credits</span>
            <span style={packPriceStyle}>{getDisplayPrice(1490)}</span>
            <button 
              onClick={() => handleCheckout("pack", "pro")}
              disabled={checkoutLoadingId !== null}
              className="btn btn-secondary" 
              style={{ width: "100%", fontSize: "0.85rem" }}
            >
              {checkoutLoadingId === "pack_pro" ? "Purchasing..." : "Purchase Bundle"}
            </button>
          </div>

          {/* Bundle 3 */}
          <div className="glass-panel" style={packCardStyle}>
            <span style={packCreditsStyle}>🪙 {getDisplayCredits(25000)} Credits</span>
            <span style={packPriceStyle}>{getDisplayPrice(2950)}</span>
            <button 
              onClick={() => handleCheckout("pack", "business")}
              disabled={checkoutLoadingId !== null}
              className="btn btn-primary" 
              style={{ width: "100%", fontSize: "0.85rem" }}
            >
              {checkoutLoadingId === "pack_business" ? "Purchasing..." : "Purchase Bundle"}
            </button>
          </div>

        </div>
      </div>

      {/* Credit Log History Table */}
      <div className="glass-panel" style={tablePanelStyle}>
        <h3 style={panelTitleStyle}>Payment & Credit History</h3>
        
        <div style={{ overflowX: "auto", marginTop: "1rem" }}>
          <table style={tableStyle}>
            <thead>
              <tr style={tableHeaderRowStyle}>
                <th style={thStyle}>Activity</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Credits Balance</th>
                <th style={thStyle}>Reference / TXN</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Date & Time</th>
              </tr>
            </thead>
            <tbody>
              {history.length > 0 ? (
                history.map((h) => (
                  <tr key={h.id} style={tableRowStyle}>
                    <td style={{ ...tdStyle, textTransform: "capitalize", fontWeight: 600, color: "hsl(var(--text-primary))" }}>
                      {h.action === "purchase" ? "🛒 Credit Purchase" : h.action === "scrape" ? "🔍 Scraper Deduction" : "🎁 Bonus Credits"}
                    </td>
                    <td style={{ 
                      ...tdStyle, 
                      fontWeight: 700, 
                      color: h.amount > 0 ? "hsl(var(--success))" : "hsl(var(--danger))" 
                    }}>
                      {h.amount > 0 ? `+${h.amount.toLocaleString()}` : h.amount.toLocaleString()}
                    </td>
                    <td style={tdStyle}>🪙 {h.balance_after.toLocaleString()}</td>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "12px", color: "hsl(var(--text-muted))" }}>
                      {h.reference || "-"}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", color: "hsl(var(--text-muted))", fontSize: "12px" }}>
                      {new Date(h.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={noDataTdStyle}>
                    No transaction history logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </main>
  );
}

export default function BillingPage() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <Suspense fallback={
          <div style={loadingContainerStyle}>
            <div style={spinnerStyle} />
            <span>Loading Billing Center...</span>
          </div>
        }>
          <BillingContent />
        </Suspense>
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
  lineHeight: "1.5"
};

const warningBannerStyle: React.CSSProperties = {
  padding: "0.75rem 1.5rem",
  backgroundColor: "hsl(var(--warning) / 10%)",
  border: "1px solid hsl(var(--warning) / 20%)",
  color: "hsl(var(--warning))",
  borderRadius: "12px",
  fontSize: "0.9rem",
  lineHeight: "1.5"
};

const successBannerStyle: React.CSSProperties = {
  padding: "0.75rem 1.5rem",
  backgroundColor: "hsl(var(--success) / 10%)",
  border: "1px solid hsl(var(--success) / 20%)",
  color: "hsl(var(--success))",
  borderRadius: "12px",
  fontSize: "0.9rem",
  lineHeight: "1.5"
};

const summaryPanelStyle: React.CSSProperties = {
  padding: "2rem",
};

const panelTitleStyle: React.CSSProperties = {
  fontSize: "1.15rem",
  color: "hsl(var(--text-primary))",
  marginBottom: "1.25rem",
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "1.5rem",
};

const summaryCardStyle: React.CSSProperties = {
  padding: "1.25rem",
  background: "var(--card-bg-alt)",
  border: "1px solid var(--glass-border)",
  borderRadius: "12px",
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
};

const summaryCardLabelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "hsl(var(--text-muted))",
  fontWeight: 500,
};

const summaryCardValueStyle: React.CSSProperties = {
  fontSize: "1.5rem",
  fontWeight: 700,
  color: "hsl(var(--text-primary))",
};

const sectionGroupTitleStyle: React.CSSProperties = {
  fontSize: "1.25rem",
  color: "hsl(var(--text-primary))",
  marginBottom: "1rem",
};

const pricingGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "1.5rem",
};

const pricingCardStyle: React.CSSProperties = {
  padding: "2rem",
  display: "flex",
  flexDirection: "column",
  gap: "1.5rem",
  minHeight: "440px",
};

const pricingCardHeaderStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const pricingCardTitleStyle: React.CSSProperties = {
  fontSize: "1.15rem",
  color: "hsl(var(--text-primary))",
  fontWeight: 600,
};

const pricingCardPriceStyle: React.CSSProperties = {
  fontSize: "2rem",
  fontWeight: 700,
  color: "hsl(var(--text-primary))",
  fontFamily: "var(--font-family-heading)",
};

const pricingCardUnitStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "hsl(var(--text-muted))",
  fontWeight: 400,
};

const popularBadgeStyle: React.CSSProperties = {
  position: "absolute",
  top: "-1.2rem",
  right: "0",
  fontSize: "9px",
  fontWeight: 700,
  color: "#fff",
  background: "linear-gradient(135deg, hsl(var(--accent)), hsl(var(--accent-secondary)))",
  padding: "0.25rem 0.6rem",
  borderRadius: "4px",
  letterSpacing: "0.05em",
};

const pricingDividerStyle: React.CSSProperties = {
  width: "100%",
  height: "1px",
  backgroundColor: "hsl(var(--border-color))",
};

const featuresListStyle: React.CSSProperties = {
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
};

const featureItemStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "hsl(var(--text-secondary))",
  lineHeight: "1.4",
};

const creditPacksGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "1.5rem",
};

const packCardStyle: React.CSSProperties = {
  padding: "1.5rem",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "0.75rem",
  textAlign: "center",
};

const packCreditsStyle: React.CSSProperties = {
  fontSize: "1.1rem",
  fontWeight: 600,
  color: "hsl(var(--text-primary))",
};

const packPriceStyle: React.CSSProperties = {
  fontSize: "1.75rem",
  fontWeight: 700,
  color: "hsl(var(--success))",
  fontFamily: "var(--font-family-heading)",
};

const tablePanelStyle: React.CSSProperties = {
  padding: "2rem",
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
  letterSpacing: "0.05em",
};

const tableRowStyle: React.CSSProperties = {
  borderBottom: "1px solid hsl(var(--border-color))",
};

const tdStyle: React.CSSProperties = {
  padding: "1rem",
  fontSize: "0.9rem",
  color: "hsl(var(--text-secondary))",
};

const noDataTdStyle: React.CSSProperties = {
  padding: "3rem",
  textAlign: "center",
  color: "hsl(var(--text-muted))",
  fontSize: "0.95rem",
};
