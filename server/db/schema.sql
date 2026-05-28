-- =============================================
-- TRIPGENIE — server/db/schema.sql
-- À exécuter dans Supabase > SQL Editor
-- 6 tables : users, trips, packs, trip_votes,
--            user_preferences, trip_collaborators
-- =============================================

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---- USERS ----
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,
  name        TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ---- TRIPS (itinéraires sauvegardés) ----
CREATE TABLE IF NOT EXISTS trips (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  destination   TEXT NOT NULL,
  country       TEXT,
  origin        TEXT,
  departure     DATE,
  return_date   DATE,
  travelers     INT DEFAULT 1,
  budget        TEXT,
  mode          TEXT CHECK (mode IN ('party','student','luxury','group','relax','surprise')),
  status        TEXT DEFAULT 'draft' CHECK (status IN ('draft','confirmed','archived')),
  score         FLOAT,
  pack_data     JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ---- PACKS (options générées — top 3 par recherche) ----
-- 1 pack pour l'instant (rank=1), extensible à 3 options avec vote
CREATE TABLE IF NOT EXISTS packs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id          UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  rank             INT NOT NULL DEFAULT 1,   -- 1, 2 ou 3
  score            FLOAT,
  pack_data        JSONB NOT NULL,
  selected         BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ---- VOTES CONSENSUS (votes sur les items d'un pack) ----
-- Les amis votent sur vol, hôtel, activités via le lien de partage
CREATE TABLE IF NOT EXISTS trip_votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id     UUID NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
  item_id     TEXT NOT NULL,       -- "flight_0", "hotel_1", "activity_2"...
  voter_name  TEXT DEFAULT 'Anonyme',
  vote_type   BOOLEAN NOT NULL,    -- true = 👍  false = 👎
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ---- PRÉFÉRENCES UTILISATEUR (relation 1-1) ----
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  default_mode    TEXT DEFAULT 'party',
  preferred_prefs TEXT[],          -- ['gastronomie', 'culture', 'nightlife'...]
  home_city       TEXT,
  currency        TEXT DEFAULT 'EUR',
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ---- COLLABORATEURS DE VOYAGE (relation many-to-many) ----
-- Partage d'un voyage avec d'autres utilisateurs
CREATE TABLE IF NOT EXISTS trip_collaborators (
  trip_id     UUID REFERENCES trips(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor')),
  invited_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (trip_id, user_id)   -- clé primaire composée — impossible d'inviter 2x
);

-- ---- INDEX ----
CREATE INDEX IF NOT EXISTS idx_trips_user_id      ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_mode         ON trips(mode);
CREATE INDEX IF NOT EXISTS idx_packs_trip_id      ON packs(trip_id);
CREATE INDEX IF NOT EXISTS idx_votes_pack_id      ON trip_votes(pack_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_user ON trip_collaborators(user_id);

-- ---- RLS (Row Level Security) ----
-- ATTENTION : les policies ci-dessous utilisent auth.uid() (Supabase Auth, NON utilisé) →
-- elles sont HISTORIQUES. La migration server/db/migrations/0001_rls_self_managed.sql les
-- REMPLACE par un RLS « maison » : rôle dédié tripgenie_app (sans BYPASSRLS) + policies sur
-- notre variable de session app.current_user_id, posée par withUser(). Voir docs/RLS_MAISON.md.
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips               ENABLE ROW LEVEL SECURITY;
ALTER TABLE packs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_votes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences    ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_collaborators  ENABLE ROW LEVEL SECURITY;

-- Policies propriétaire
CREATE POLICY "users_own_data"   ON users   FOR ALL USING (id = auth.uid());
CREATE POLICY "trips_own_data"   ON trips   FOR ALL USING (user_id = auth.uid());
CREATE POLICY "packs_own_data"   ON packs   FOR ALL
  USING (trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid()));
CREATE POLICY "prefs_own_data"   ON user_preferences FOR ALL USING (user_id = auth.uid());
CREATE POLICY "collab_own_data"  ON trip_collaborators
  FOR ALL USING (trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid()));

-- Votes publics : tout le monde peut voter via le lien de partage
CREATE POLICY "votes_insert_all" ON trip_votes FOR INSERT WITH CHECK (true);
CREATE POLICY "votes_select_all" ON trip_votes FOR SELECT USING (true);
