# PRD — Zero Dollar Email Outreach SaaS
**Product Name:** GetClient (working title)
**Version:** 1.1
**Author:** Borhan
**Date:** June 2026
**Status:** Draft

---

## 1. Overview

### 1.1 Product Summary

GetClient হলো একটি AI-powered email outreach SaaS platform যেটা ব্যবহারকারীদের Google Maps এবং Facebook Ads Library থেকে lead scrape করতে, AI দিয়ে personalized email লিখতে, এবং Gmail বা Brevo দিয়ে automated email campaign পরিচালনা করতে দেয়। পুরো system ব্যবহারকারীর নিজের account এ চলে — কোনো third-party automation tool ছাড়া।

### 1.2 Problem Statement

Instantly এবং Lemlist এর মতো email outreach tool প্রতি মাসে $69+ চার্জ করে শুধুমাত্র Gmail দিয়ে email পাঠানোর জন্য। এদের মূল mechanism হলো:

- ব্যবহারকারীর Google Sheet
- ব্যবহারকারীর Gmail
- মাঝখানে একটি interface যেটা $69 নেয়

GetClient এই gap পূরণ করবে — same functionality, zero monthly cost, সম্পূর্ণ data ownership।

### 1.3 Target Users

| Segment | Description |
|---|---|
| Freelancers | Client outreach করতে চান, budget কম |
| Small agencies | Lead generation automate করতে চান |
| Solopreneurs | নিজেই sales করেন, tool কিনতে চান না |
| BD/IN market | Local currency তে affordable tool চান |

### 1.4 Success Metrics

- Month 1: ১০০ registered users
- Month 3: ৫০ paying customers
- Month 6: MRR ৳৫০,০০০+
- Churn rate: ৫% এর নিচে

---

## 2. Goals & Non-Goals

### Goals
- Google Maps ও Facebook Ads Library থেকে lead scrape করা
- AI দিয়ে প্রতিটি lead এর জন্য unique personalized email লেখা
- Gmail ও Brevo দিয়ে automated email sending
- Follow-up sequence automation (reply না আসলে auto follow-up)
- Reply, bounce, unsubscribe সব auto-handle করা
- Telegram এ real-time notification
- A/B testing, analytics, spam checker

### Non-Goals (v1.0 তে থাকবে না)
- LinkedIn outreach
- Cold calling feature
- CRM integration (HubSpot, Salesforce)
- Mobile app
- WhatsApp outreach

---

## 3. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Backend | FastAPI (Python) | Scraping + AI + email সব Python এ সহজ |
| Frontend | Next.js 15 (React) | Professional SaaS UI, Vercel deploy |
| Database | Supabase (PostgreSQL) | Free tier, realtime, built-in auth support |
| Auth | JWT + Google OAuth | Simple, secure |
| Email sending | Gmail API + Brevo | দুটোই support, user choose করবে |
| AI | Claude API (Anthropic) | Best email personalization |
| Scraping | Google Places API + FB Ads API | Official API, legal, free |
| Email extraction | requests + BeautifulSoup | Website থেকে email বের করা |
| Background jobs | Celery + Redis | Async email sending, cron jobs |
| Payment | Stripe | Subscription + credit purchase |
| Notification | Telegram Bot API | Instant reply alert |
| Backend deploy | Railway | Python support, free tier |
| Frontend deploy | Vercel | Next.js optimized, free tier |

---

## 4. System Architecture

```
User (Browser)
      │
      ▼
Next.js Frontend (Vercel)
      │
      ▼ API calls
FastAPI Backend (Railway)
      │
      ├── Supabase (PostgreSQL) — data storage
      ├── Google Places API — Maps scraping
      ├── FB Ads Library API — Facebook scraping
      ├── Claude API — AI email generation
      ├── Gmail API — email sending
      ├── Brevo API — email sending
      ├── Celery + Redis — background jobs
      └── Telegram Bot API — notifications
```

---

## 5. Features

### 5.1 Lead Scraping

#### Google Maps Scraper
- User keyword input দেবে (e.g. "Restaurants in Dhaka")
- Campaign name দেবে
- Max results set করবে
- "Scrape emails from websites" checkbox
- System Google Places API call করবে → business list আনবে → প্রতিটার website থেকে email extract করবে
- Credit deduction: ১ lead = ১ credit

**Output fields:**
- Business name
- Email (website থেকে extracted)
- Phone number
- Address
- Website URL
- Google rating
- Source: google_maps

#### Facebook Ads Library Scraper
- User keyword input দেবে (e.g. "Digital agency in Bangladesh")
- Country select করবে (BD, IN, US...)
- Active Status filter (Active/Inactive/All)
- Ad Type filter (All/Image/Video)
- Max results per keyword
- "Scrape emails from websites" checkbox
- System FB Ads API call করবে → active advertisers list আনবে → website থেকে email extract করবে
- Credit deduction: ১ lead = ১ credit

**Output fields:**
- Page name (advertiser)
- Email (website থেকে extracted)
- Website URL
- Ad copy preview
- Ad type
- Source: facebook_ads

#### CSV Upload
- User CSV file upload করবে
- Required columns: name, email
- Optional: company, phone, website
- Duplicate email auto-skip
- Credit deduction নেই (নিজের data)

#### Email Extractor Logic
```
Website URL পেলে →
  1. Homepage fetch
  2. /contact page check
  3. /about page check
  4. Regex দিয়ে email find
  5. Filter: noreply, example.com, support@domain বাদ
  6. First valid email return
```

---

### 5.2 Lead Management

- All leads একটা table এ দেখা
- Filter by: source, status, date range, campaign
- Search by: name, email, company
- Bulk select + delete
- Export CSV
- Duplicate detection
- Lead status: new / contacted / replied / bounced / unsubscribed

---

### 5.3 Email Account Setup

#### Gmail
- User "Connect Gmail" click করবে
- Google OAuth popup → permission দেবে
- System access token + refresh token save করবে
- Daily sending limit set করবে (default: ৫০/day, max: ৫০০/day)

#### Brevo (Sendinblue)
- User Brevo API key input করবে
- From name + from email set করবে
- Daily limit set করবে (default: ৩০০/day)
- Multiple Brevo accounts add করা যাবে (limit বাড়ানোর জন্য)

---

### 5.4 Campaign Builder

#### Step 1 — Basic Info
- Campaign name
- Select leads (from scraped leads বা upload)
- Select email account (Gmail বা Brevo)

#### Step 2 — Email Template
- Subject line (variables: `{{name}}`, `{{company}}`, `{{website}}`)
- Email body (rich text editor)
- AI Generate button — Claude API দিয়ে lead এর info based এ unique email লিখবে
- Spam checker — send এর আগে spam words scan করবে, warning দেখাবে

#### Step 3 — A/B Testing (optional)
- Subject A + Subject B দুটো দেওয়া যাবে
- ৫০/৫০ split এ পাঠাবে
- ৪৮ ঘণ্টা পর winner (higher open rate) auto-detect
- বাকি leads এ winner subject যাবে

#### Step 4 — Follow-up Sequence
- Follow-up ১: X দিন পর (default: ১ দিন)
- Follow-up ২: X দিন পর (default: ৩ দিন)
- Follow-up ৩: X দিন পর (default: ৭ দিন)
- প্রতিটা follow-up এর আলাদা email template
- Reply আসলে sequence automatically বন্ধ

#### Step 5 — Schedule
- Send immediately বা schedule করা
- Sending time window set করা (e.g. 9am–6pm only)
- Timezone select

---

### 5.5 Email Automation Engine

| Event | Action |
|---|---|
| Email sent | Log করো, next follow-up schedule করো |
| Reply received | Sequence বন্ধ করো, Telegram notification পাঠাও |
| Bounce received | Lead status = bounced, bounce count বাড়াও |
| Bounce > 10% | Campaign auto-pause করো |
| Unsubscribe link click | Lead blacklist এ add করো, sequence বন্ধ |
| Out-of-office reply | Follow-up timing auto-adjust (৭ দিন পিছিয়ে দাও) |
| Daily email limit hit | পরের দিনের জন্য queue করো |

---

### 5.6 Blacklist

- Email বা domain blacklist এ add করা যাবে
- Manual add: email বা domain type করে
- Auto add: unsubscribe click করলে
- Blacklisted email এ কোনো campaign থেকে email যাবে না
- Import blacklist CSV

---

### 5.7 Analytics Dashboard

**Campaign level:**
- Total sent
- Open rate (%)
- Click rate (%)
- Reply rate (%)
- Bounce rate (%)
- Unsubscribe rate (%)
- A/B test winner

**Account level:**
- Total emails sent (all time)
- Best performing campaign
- Best send time (hour of day)
- Reply rate trend (last 30 days)

---

### 5.8 Notifications

#### Telegram Bot
- User Telegram Bot token + chat ID add করবে
- Reply আসলে: instant notification (lead name + email preview)
- Bounce আসলে: notification
- Campaign pause হলে: notification
- প্রতিদিন রাত ১০টায়: daily summary report

**Daily Report Format:**
```
📊 Daily Report — [Campaign Name]
📤 Sent: 45
📬 Opened: 12 (26%)
💬 Replied: 3 (6.6%)
❌ Bounced: 1 (2.2%)
🔇 Unsubscribed: 0
```

---

### 5.9 Spam Checker

Send করার আগে email body + subject scan করবে।

**Check করবে:**
- Common spam words (FREE, CLICK NOW, GUARANTEED...)
- All caps text
- Too many exclamation marks
- Spam score (0–10)
- Warning দেখাবে, block করবে না (user decide করবে)

---

### 5.10 Priority Queue

- Lead এর score calculate করবে
- Score বেশি হলে আগে email যাবে

**Score factors:**
- Email valid কিনা (MX record check)
- Website আছে কিনা
- Recently scraped কিনা
- Source (FB ads = higher intent)

---

### 5.11 Email Warm-up

#### কেন দরকার

নতুন Gmail account দিয়ে হঠাৎ করে বেশি email পাঠালে Google সেই account কে suspicious মনে করে এবং email spam folder এ যায় বা account suspend হয়। Warm-up মানে হলো ধীরে ধীরে sending volume বাড়ানো যাতে email provider এর কাছে account টা trustworthy দেখায়।

#### কীভাবে কাজ করবে

User "Start Warm-up" চালু করলে system automatically প্রতিদিন real email accounts এর মধ্যে email send করবে এবং সেগুলো reply করবে, inbox এ move করবে। এতে account এর reputation বাড়বে।

**Warm-up Pool:**
- GetClient এর নিজের একটা pool of email accounts থাকবে (warm-up network)
- User এর account এই pool এ join করবে
- Pool এর accounts একে অপরকে email করবে, reply করবে, spam থেকে inbox এ move করবে

**Warm-up Schedule (৩০ দিনের plan):**

| Day | Emails/day | Reply rate |
|---|---|---|
| Day 1–3 | ৫ | ৮০% |
| Day 4–7 | ১০ | ৭৫% |
| Day 8–14 | ২০ | ৭০% |
| Day 15–21 | ৩০ | ৬৫% |
| Day 22–30 | ৪০ | ৬০% |
| Day 30+ | ৫০ (full capacity) | — |

**Warm-up Email Content:**
- Random subject line (business-related, natural)
- Random body (conversation style, not salesy)
- Claude API দিয়ে generate করা যাতে প্রতিটা unique হয়
- Plain text, no HTML, no links

**Auto actions (system করবে):**
- Email send করবে pool থেকে
- ৩০–৯০ মিনিট পর reply করবে
- Spam folder এ গেলে inbox এ move করবে
- "Not spam" mark করবে
- Star বা label দেবে

#### UI — Warm-up Dashboard

```
Email Warm-up
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Account: borhan@gmail.com
Status: 🟢 Warming up — Day 12 of 30

Health Score:  ████████░░  78/100
Reputation:    ████████░░  Good

Today's Activity:
  📤 Sent: 20
  📬 Received: 18
  ↩️  Replied: 15
  📥 Moved to inbox: 3

Progress: ████████░░░░░░  Day 12/30

[⏸ Pause Warm-up]   [📊 View Details]
```

#### Warm-up Rules

- Warm-up চলাকালীন campaign sending limit অর্ধেক রাখবে (account stress না করতে)
- Warm-up pause করলে campaign sending ও pause হবে
- Health Score ৫০ এর নিচে নামলে warning দেখাবে
- Health Score ৩০ এর নিচে নামলে campaign auto-pause + Telegram alert

#### Health Score Calculation

| Factor | Weight |
|---|---|
| Inbox delivery rate | ৪০% |
| Reply rate | ৩০% |
| Spam rate (কম হলে ভালো) | ২০% |
| Account age | ১০% |

#### Pages

```
/email-accounts/[id]/warm-up        — warm-up dashboard
/email-accounts/[id]/warm-up/logs   — daily activity log
```

#### API Endpoints

```
POST /api/warmup/start/{account_id}   — warm-up শুরু
POST /api/warmup/pause/{account_id}   — pause
GET  /api/warmup/status/{account_id}  — current status + health score
GET  /api/warmup/logs/{account_id}    — activity logs
POST /api/cron/warmup                 — daily warm-up cron job
```

#### Database Table — warmup_logs

```
id, email_account_id, date, emails_sent, 
emails_received, replies_sent, inbox_moved, 
spam_found, health_score, created_at
```

#### Plan Availability

| Plan | Warm-up |
|---|---|
| Free | ❌ নেই |
| Starter | ✅ ১টা account |
| Pro | ✅ সব connected accounts |

---

## 6. Database Schema

### users
```
id, email, name, avatar, plan, credits, 
stripe_customer_id, telegram_chat_id, 
telegram_bot_token, created_at
```

### email_accounts
```
id, user_id, provider (gmail/brevo), 
access_token, refresh_token, from_email, 
from_name, daily_limit, emails_sent_today, 
is_active, created_at
```

### leads
```
id, user_id, name, email, company, phone, 
website, address, rating, source, 
campaign_name, status, score, created_at
```

### campaigns
```
id, user_id, name, status (draft/active/paused/completed),
email_account_id, subject_a, subject_b, ab_winner,
body_template, follow_up_1_days, follow_up_1_body,
follow_up_2_days, follow_up_2_body,
follow_up_3_days, follow_up_3_body,
send_start_hour, send_end_hour, timezone,
created_at, started_at, completed_at
```

### campaign_leads
```
id, campaign_id, lead_id, status 
(pending/sent/opened/replied/bounced/unsubscribed/ooo),
sent_count, last_sent_at, next_follow_up_at,
assigned_subject (a/b), created_at
```

### email_logs
```
id, campaign_lead_id, subject, body, 
provider, message_id, sent_at, 
opened_at, clicked_at, replied_at
```

### blacklist
```
id, user_id, type (email/domain), 
value, reason, created_at
```

### credits_log
```
id, user_id, action (scrape/purchase/bonus),
amount, balance_after, reference, created_at
```

### warmup_logs
```
id, email_account_id, date, emails_sent, 
emails_received, replies_sent, inbox_moved, 
spam_found, health_score, created_at
```

---

## 7. API Endpoints

### FastAPI Backend

#### Auth
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/google
POST /api/auth/refresh
```

#### Leads
```
GET  /api/leads                    — list with filter/pagination
POST /api/leads/scrape/google-maps — Google Maps scraping
POST /api/leads/scrape/facebook-ads — FB Ads scraping
POST /api/leads/upload             — CSV upload
DELETE /api/leads/{id}
GET  /api/leads/export             — CSV export
```

#### Email Accounts
```
GET  /api/email-accounts
POST /api/email-accounts/gmail/connect
POST /api/email-accounts/brevo/connect
DELETE /api/email-accounts/{id}
```

#### Campaigns
```
GET  /api/campaigns
POST /api/campaigns
GET  /api/campaigns/{id}
PUT  /api/campaigns/{id}
POST /api/campaigns/{id}/start
POST /api/campaigns/{id}/pause
GET  /api/campaigns/{id}/analytics
```

#### Emails
```
POST /api/emails/generate          — Claude AI draft
POST /api/emails/spam-check        — spam scan
POST /api/emails/send-test         — test email
POST /api/webhooks/gmail           — reply/bounce webhook
POST /api/webhooks/brevo           — reply/bounce webhook
```

#### Blacklist
```
GET  /api/blacklist
POST /api/blacklist
DELETE /api/blacklist/{id}
POST /api/blacklist/import
```

#### Billing
```
GET  /api/billing/plans
POST /api/billing/checkout
POST /api/billing/portal
POST /api/webhooks/stripe
```

#### Cron Jobs (internal)
```
POST /api/cron/send-emails         — daily email sender
POST /api/cron/follow-ups          — follow-up checker
POST /api/cron/ab-test-winner      — A/B winner detect
POST /api/cron/daily-report        — Telegram report
```

---

## 8. Pages (Frontend — Next.js)

### Public
```
/                   — Landing page
/login              — Login
/register           — Register
/unsubscribe        — Unsubscribe page (public)
```

### Dashboard
```
/dashboard                          — Overview stats
/leads                              — All leads table
/leads/scraper/google-maps          — Google Maps scraper
/leads/scraper/facebook-ads         — FB Ads scraper
/leads/upload                       — CSV upload
/campaigns                          — Campaign list
/campaigns/new                      — Campaign builder
/campaigns/[id]                     — Campaign detail + analytics
/email-accounts                     — Gmail + Brevo setup
/analytics                          — Overall analytics
/blacklist                          — Blacklist management
/settings                           — Profile + Telegram setup
/billing                            — Plan + credits
```

---

## 9. Pricing

| Plan | Price | Credits | Email/day | Features |
|---|---|---|---|---|
| Free | ৳০ | ৫০ | ৫০ | Basic scraping, Gmail only |
| Starter | ৳৪৯০/মাস | ২,৫০০ | ২০০ | Gmail + Brevo, AI email, follow-up |
| Pro | ৳১,৪৯০/মাস | ১০,০০০ | ৫০০ | A/B test, Telegram, analytics, team |

### Credit Packs (one-time)
| Pack | Price | Credits |
|---|---|---|
| Starter | ৳৪৯০ | ২,৫০০ |
| Pro | ৳১,৪৯০ | ১০,০০০ |
| Business | ৳২,৯৫০ | ২৫,০০০ |

---

## 10. Build Phases

### Phase 1 — Foundation (সপ্তাহ ১)
- [ ] FastAPI project setup
- [ ] Supabase connection + schema create
- [ ] JWT auth (register, login, refresh)
- [ ] Google OAuth
- [ ] Next.js project setup
- [ ] Basic dashboard layout (sidebar, navbar)
- [ ] Vercel + Railway deploy (basic)

### Phase 2 — Lead Scraping (সপ্তাহ ২)
- [ ] Google Places API integration
- [ ] FB Ads Library API integration
- [ ] Email extractor (BeautifulSoup)
- [ ] CSV upload + parse
- [ ] All Leads table (filter, search, export)
- [ ] Credit deduction system
- [ ] Duplicate detection

### Phase 3 — Email Engine (সপ্তাহ ৩–৪)
- [ ] Gmail OAuth connect
- [ ] Brevo API integration
- [ ] Claude API email generator
- [ ] Campaign builder UI (5 steps)
- [ ] Spam checker
- [ ] Send test email
- [ ] Priority queue

### Phase 4 — Automation (সপ্তাহ ৫)
- [ ] Celery + Redis setup
- [ ] Email scheduler (cron)
- [ ] Follow-up sequence engine
- [ ] Reply detection (Gmail webhook)
- [ ] Bounce handling
- [ ] OOO detection
- [ ] Unsubscribe link + handler
- [ ] Blacklist system
- [ ] Telegram notification
- [ ] Daily summary report

### Phase 5 — SaaS Features (সপ্তাহ ৬)
- [ ] Stripe subscription
- [ ] Credit purchase
- [ ] A/B testing engine
- [ ] Analytics dashboard
- [ ] Admin panel
- [ ] Landing page
- [ ] Email warm-up pool setup
- [ ] Warm-up scheduler (cron)
- [ ] Warm-up dashboard UI
- [ ] Health score calculator
- [ ] Warm-up logs page

---

## 11. Security Considerations

- সব API key encrypted করে store করা (Supabase vault)
- Gmail access token refresh token secure রাখা
- Rate limiting সব public endpoint এ
- Unsubscribe token unique + expiry ছাড়া (permanent)
- User একে অপরের data access করতে পারবে না (row-level security)
- Webhook endpoint secret দিয়ে verify করা

---

## 12. External Dependencies

| Service | Purpose | Free Tier |
|---|---|---|
| Google Places API | Maps scraping | ২৮,৫০০ req/মাস |
| Meta Ads Library API | FB scraping | Unlimited (rate limited) |
| Claude API (Anthropic) | AI email writer | Pay per use |
| Gmail API | Email sending | Free (user এর account) |
| Brevo | Email sending | ৩০০ email/day free |
| Supabase | Database | ৫০০MB free |
| Railway | Backend hosting | $5/মাস |
| Vercel | Frontend hosting | Free |
| Stripe | Payment | 2.9% + $0.30/transaction |
| Telegram Bot API | Notification | Free |
| Redis | Job queue | Railway তে |

---

## 13. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Google Places API cost বেড়ে যাওয়া | Credit system দিয়ে control, user কে দেখানো |
| Gmail API daily limit | Multiple account support, Brevo fallback |
| FB API rate limit | Queue করে slow scraping, retry logic |
| Email deliverability কমে যাওয়া | Spam checker, daily limit, warm-up guide |
| User data breach | Encryption, RLS, audit log |

---

## 14. Future Roadmap (v2.0)

- LinkedIn outreach integration
- Zapier / Make.com integration
- Team collaboration (multiple users)
- Custom domain for unsubscribe page
- CRM integration (HubSpot)
- Mobile app (React Native)
- White-label option for agencies

---

*Document version: 1.0 | Last updated: June 2026*
