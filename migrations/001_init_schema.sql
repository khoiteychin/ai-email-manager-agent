-- ============================================================
-- AI Email Manager SaaS - Initial Schema Migration
-- Run on Supabase PostgreSQL
-- ============================================================

-- Enable pgvector extension for AI embeddings
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- users
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id            VARCHAR(255) PRIMARY KEY,  -- Firebase UID
  email         VARCHAR(255) UNIQUE NOT NULL,
  name          VARCHAR(255),
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- gmail_accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gmail_accounts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         VARCHAR(255) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  google_id       VARCHAR(255),
  email           VARCHAR(255),
  access_token    TEXT,
  refresh_token   TEXT,
  token_expiry    TIMESTAMPTZ,
  watch_expiry    TIMESTAMPTZ,
  history_id      VARCHAR(100),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)
);

-- ============================================================
-- discord_accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.discord_accounts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         VARCHAR(255) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  discord_id      VARCHAR(255),
  username        VARCHAR(255),
  guild_id        VARCHAR(255),
  channel_id      VARCHAR(255),
  webhook_url     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)
);

-- ============================================================
-- telegram_accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.telegram_accounts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         VARCHAR(255) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  telegram_id     BIGINT,
  username        VARCHAR(255),
  chat_id         BIGINT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)
);

-- ============================================================
-- user_integrations (used by existing frontend code)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_integrations (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     VARCHAR(255) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider    VARCHAR(50) NOT NULL,  -- 'gmail', 'discord', 'telegram'
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, provider)
);

-- ============================================================
-- emails
-- ============================================================
CREATE TABLE IF NOT EXISTS public.emails (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         VARCHAR(255) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  gmail_id        VARCHAR(255),
  thread_id       VARCHAR(255),
  sender          VARCHAR(500),
  sender_email    VARCHAR(255),
  receiver        VARCHAR(500),
  subject         TEXT,
  body            TEXT,
  body_text       TEXT,
  summary         TEXT,
  category        VARCHAR(100) DEFAULT 'other',  -- work, personal, social, promotion, invoice, security, spam
  priority        VARCHAR(50)  DEFAULT 'medium',  -- low, medium, high
  sentiment       VARCHAR(50),
  is_read         BOOLEAN DEFAULT FALSE,
  is_starred      BOOLEAN DEFAULT FALSE,
  received_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, gmail_id)
);

CREATE INDEX IF NOT EXISTS idx_emails_user_id      ON public.emails(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_category     ON public.emails(category);
CREATE INDEX IF NOT EXISTS idx_emails_priority     ON public.emails(priority);
CREATE INDEX IF NOT EXISTS idx_emails_is_read      ON public.emails(is_read);
CREATE INDEX IF NOT EXISTS idx_emails_received_at  ON public.emails(received_at DESC);

-- Full text search index
CREATE INDEX IF NOT EXISTS idx_emails_fts ON public.emails
  USING gin(to_tsvector('english', COALESCE(subject, '') || ' ' || COALESCE(body_text, '') || ' ' || COALESCE(sender, '')));

-- ============================================================
-- email_embeddings (pgvector)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_embeddings (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email_id    UUID NOT NULL REFERENCES public.emails(id) ON DELETE CASCADE,
  embedding   vector(1536),  -- OpenAI text-embedding-ada-002 / text-embedding-3-small
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (email_id)
);

-- HNSW index for fast approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS idx_email_embeddings_hnsw
  ON public.email_embeddings
  USING hnsw (embedding vector_cosine_ops);

-- ============================================================
-- labels
-- ============================================================
CREATE TABLE IF NOT EXISTS public.labels (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     VARCHAR(255) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  color       VARCHAR(50) DEFAULT '#6366f1',
  gmail_label_id VARCHAR(255),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, name)
);

-- ============================================================
-- email_labels
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_labels (
  email_id    UUID NOT NULL REFERENCES public.emails(id) ON DELETE CASCADE,
  label_id    UUID NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  PRIMARY KEY (email_id, label_id)
);

-- ============================================================
-- ai_chat_sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_chat_sessions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     VARCHAR(255) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title       VARCHAR(500) DEFAULT 'New Chat',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ai_chat_messages
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id  UUID NOT NULL REFERENCES public.ai_chat_sessions(id) ON DELETE CASCADE,
  role        VARCHAR(20) NOT NULL,  -- 'user' | 'assistant'
  content     TEXT NOT NULL,
  sources     JSONB,  -- referenced email IDs
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session ON public.ai_chat_messages(session_id);

-- ============================================================
-- notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     VARCHAR(255) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  platform    VARCHAR(50) NOT NULL,  -- 'discord', 'telegram'
  content     TEXT NOT NULL,
  status      VARCHAR(50) DEFAULT 'pending',  -- pending, sent, failed
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Update triggers
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_emails_updated_at BEFORE UPDATE ON public.emails
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_gmail_accounts_updated_at BEFORE UPDATE ON public.gmail_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
