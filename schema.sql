-- Database Schema for GetClient (SaaS)
-- Suitable for running in Supabase SQL Editor

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. users Table (referenced to auth.users in Supabase)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY, -- Set from auth.users.id
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    plan TEXT DEFAULT 'Free' CHECK (plan IN ('Free', 'Starter', 'Pro')),
    credits INTEGER DEFAULT 50 CHECK (credits >= 0),
    stripe_customer_id TEXT,
    telegram_chat_id TEXT,
    telegram_bot_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2. email_accounts Table
CREATE TABLE IF NOT EXISTS public.email_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('gmail', 'brevo')),
    access_token TEXT,
    refresh_token TEXT,
    api_key TEXT,
    from_email TEXT NOT NULL,
    from_name TEXT,
    daily_limit INTEGER DEFAULT 50 CHECK (daily_limit > 0),
    emails_sent_today INTEGER DEFAULT 0 CHECK (emails_sent_today >= 0),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

-- 3. leads Table
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT,
    email TEXT NOT NULL,
    company TEXT,
    phone TEXT,
    website TEXT,
    address TEXT,
    rating REAL,
    source TEXT NOT NULL CHECK (source IN ('google_maps', 'facebook_ads', 'csv_upload')),
    campaign_name TEXT,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'replied', 'bounced', 'unsubscribed', 'ooo')),
    score REAL DEFAULT 0,
    title TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE (user_id, email)
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- 4. campaigns Table
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
    email_account_id UUID REFERENCES public.email_accounts(id) ON DELETE SET NULL,
    subject_a TEXT,
    subject_b TEXT,
    ab_winner TEXT CHECK (ab_winner IN ('a', 'b')),
    body_template TEXT,
    follow_up_1_days INTEGER,
    follow_up_1_body TEXT,
    follow_up_2_days INTEGER,
    follow_up_2_body TEXT,
    follow_up_3_days INTEGER,
    follow_up_3_body TEXT,
    send_start_hour INTEGER DEFAULT 9 CHECK (send_start_hour >= 0 AND send_start_hour <= 23),
    send_end_hour INTEGER DEFAULT 18 CHECK (send_end_hour >= 0 AND send_end_hour <= 23),
    timezone TEXT DEFAULT 'UTC',
    send_interval INTEGER DEFAULT 2 CHECK (send_interval >= 1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- 5. campaign_leads Table
CREATE TABLE IF NOT EXISTS public.campaign_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'opened', 'replied', 'bounced', 'unsubscribed', 'ooo')),
    sent_count INTEGER DEFAULT 0 CHECK (sent_count >= 0),
    last_sent_at TIMESTAMP WITH TIME ZONE,
    next_follow_up_at TIMESTAMP WITH TIME ZONE,
    assigned_subject TEXT CHECK (assigned_subject IN ('a', 'b')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE (campaign_id, lead_id)
);

ALTER TABLE public.campaign_leads ENABLE ROW LEVEL SECURITY;

-- 6. email_logs Table
CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_lead_id UUID NOT NULL REFERENCES public.campaign_leads(id) ON DELETE CASCADE,
    subject TEXT,
    body TEXT,
    provider TEXT NOT NULL CHECK (provider IN ('gmail', 'brevo')),
    message_id TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    replied_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- 7. blacklist Table
CREATE TABLE IF NOT EXISTS public.blacklist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('email', 'domain')),
    value TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE (user_id, value)
);

ALTER TABLE public.blacklist ENABLE ROW LEVEL SECURITY;

-- 8. credits_log Table
CREATE TABLE IF NOT EXISTS public.credits_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('scrape', 'purchase', 'bonus')),
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    reference TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.credits_log ENABLE ROW LEVEL SECURITY;

-- 9. warmup_logs Table
CREATE TABLE IF NOT EXISTS public.warmup_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_account_id UUID NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    emails_sent INTEGER DEFAULT 0 CHECK (emails_sent >= 0),
    emails_received INTEGER DEFAULT 0 CHECK (emails_received >= 0),
    replies_sent INTEGER DEFAULT 0 CHECK (replies_sent >= 0),
    inbox_moved INTEGER DEFAULT 0 CHECK (inbox_moved >= 0),
    spam_found INTEGER DEFAULT 0 CHECK (spam_found >= 0),
    health_score INTEGER DEFAULT 100 CHECK (health_score >= 0 AND health_score <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE (email_account_id, date)
);

ALTER TABLE public.warmup_logs ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON public.leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign_id ON public.campaign_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_lead_id ON public.campaign_leads(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_user_id ON public.email_accounts(user_id);

-- RLS Policies (Ensure users can only access their own data)
DROP POLICY IF EXISTS user_all_policy ON public.users;
CREATE POLICY user_all_policy ON public.users FOR ALL USING (auth.uid() = id);

DROP POLICY IF EXISTS email_accounts_policy ON public.email_accounts;
CREATE POLICY email_accounts_policy ON public.email_accounts FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS leads_policy ON public.leads;
CREATE POLICY leads_policy ON public.leads FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS campaigns_policy ON public.campaigns;
CREATE POLICY campaigns_policy ON public.campaigns FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS campaign_leads_policy ON public.campaign_leads;
CREATE POLICY campaign_leads_policy ON public.campaign_leads FOR ALL USING (
    EXISTS (SELECT 1 FROM public.campaigns WHERE id = campaign_id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS email_logs_policy ON public.email_logs;
CREATE POLICY email_logs_policy ON public.email_logs FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.campaign_leads cl
        JOIN public.campaigns c ON c.id = cl.campaign_id
        WHERE cl.id = campaign_lead_id AND c.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS blacklist_policy ON public.blacklist;
CREATE POLICY blacklist_policy ON public.blacklist FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS credits_log_policy ON public.credits_log;
CREATE POLICY credits_log_policy ON public.credits_log FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS warmup_logs_policy ON public.warmup_logs;
CREATE POLICY warmup_logs_policy ON public.warmup_logs FOR ALL USING (
    EXISTS (SELECT 1 FROM public.email_accounts WHERE id = email_account_id AND user_id = auth.uid())
);

-- Trigger to copy new users from auth.users to public.users (Supabase trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, name, avatar, is_admin, plan, credits)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
        new.raw_user_meta_data->>'avatar_url',
        (new.email = 'borhan.seoexpert@gmail.com' OR new.email = 'admin@getleads.com' OR new.email = 'admin@getclient.com'),
        CASE WHEN new.email = 'borhan.seoexpert@gmail.com' THEN 'Pro' ELSE 'Free' END,
        CASE WHEN new.email = 'borhan.seoexpert@gmail.com' THEN 10000 ELSE 50 END
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger (only runs if table triggers are allowed, i.e., in Supabase)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
