-- =============================================
-- TRIPGENIE — migrations/0001_rls_self_managed.sql
-- RLS (Row Level Security) GÉRÉE PAR NOUS, pas par Supabase Auth.
--
-- POURQUOI :
--   Les policies actuelles (schema.sql) utilisent auth.uid(), une fonction de
--   Supabase Auth qu'on n'utilise PAS (on a notre propre JWT). De plus le code
--   se connecte avec la SERVICE_KEY (attribut BYPASSRLS) → le RLS est ignoré.
--   Ici on recrée les policies pour qu'elles lisent NOTRE variable de session
--   app.current_user_id, posée par withUser() dans server/db/pg.ts, via un rôle
--   applicatif dédié SANS BYPASSRLS. Le RLS devient alors une vraie 2ᵉ barrière.
--
-- COMMENT APPLIQUER (UNE FOIS, dans Supabase > SQL Editor, connecté en admin) :
--   1. Coller TOUT ce fichier dans le SQL Editor et exécuter.
--   2. Donner un mot de passe au rôle applicatif (JAMAIS commité dans le repo) :
--        ALTER ROLE tripgenie_app WITH PASSWORD 'un_mot_de_passe_long_et_fort';
--   3. Mettre la chaîne de connexion dans .env (host = Project Settings > Database) :
--        DATABASE_URL=postgresql://tripgenie_app:<mot_de_passe>@<host>:5432/postgres
--
-- NOTE : ce fichier ne touche PAS les routes. Tant qu'on n'a pas basculé les
-- routes de supabase.ts vers pg.ts, l'application continue de tourner à l'identique.
-- =============================================

-- ÉTAPE 1 — Rôle applicatif dédié, SANS BYPASSRLS.
-- C'EST la clé : si on se connecte avec le rôle `postgres` de Supabase
-- (propriétaire des tables et/ou BYPASSRLS), le RLS est silencieusement ignoré.
-- Ce rôle n'est PAS propriétaire des tables → le RLS s'applique vraiment à lui.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripgenie_app') THEN
    CREATE ROLE tripgenie_app
      LOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOBYPASSRLS;   -- ← interdit explicitement le contournement du RLS
  END IF;
END
$$;

-- ÉTAPE 2 — Droits MINIMAUX : DML uniquement (lecture/écriture des lignes),
-- jamais de DDL (le rôle ne peut pas modifier le schéma). Principe du moindre privilège.
GRANT USAGE ON SCHEMA public TO tripgenie_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tripgenie_app;
-- Les tables utilisent des UUID (uuid_generate_v4 / gen_random_uuid), pas de
-- séquences SERIAL → aucun GRANT sur séquence n'est nécessaire.

-- ÉTAPE 3 — Remplacer les policies auth.uid() (Supabase Auth) par des policies
-- basées sur app.current_user_id (NOTRE variable, posée par withUser()).
--
-- NULLIF(current_setting('app.current_user_id', true), '')::uuid
--   - 2ᵉ arg `true` (missing_ok) : renvoie NULL si la variable n'est pas posée,
--     au lieu de lever une erreur.
--   - NULLIF(..., '') : transforme une chaîne vide en NULL.
--   → dans les deux cas : NULL → aucune ligne ne correspond (fail-closed = sûr).

-- users
DROP POLICY IF EXISTS "users_own_data" ON users;
CREATE POLICY "users_own_data" ON users FOR ALL
  USING (id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- trips
DROP POLICY IF EXISTS "trips_own_data" ON trips;
CREATE POLICY "trips_own_data" ON trips FOR ALL
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- packs (accès via la propriété du voyage parent)
DROP POLICY IF EXISTS "packs_own_data" ON packs;
CREATE POLICY "packs_own_data" ON packs FOR ALL
  USING (trip_id IN (
    SELECT id FROM trips
    WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  ));

-- user_preferences (relation 1-1)
DROP POLICY IF EXISTS "prefs_own_data" ON user_preferences;
CREATE POLICY "prefs_own_data" ON user_preferences FOR ALL
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- trip_collaborators (le propriétaire du voyage gère ses collaborateurs)
DROP POLICY IF EXISTS "collab_own_data" ON trip_collaborators;
CREATE POLICY "collab_own_data" ON trip_collaborators FOR ALL
  USING (trip_id IN (
    SELECT id FROM trips
    WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  ));

-- trip_votes : INCHANGÉ. Les votes sont publics (lien de partage entre amis),
-- donc les policies votes_insert_all / votes_select_all (USING/CHECK true) restent.

-- =============================================
-- CAS PARTICULIERS à traiter PLUS TARD, au moment de basculer les routes
-- (pas maintenant — juste pour mémoire) :
--
--   a) AUTH (signup / login / recherche d'un user par email) : ces opérations
--      ont lieu AVANT qu'un utilisateur soit identifié → app.current_user_id
--      n'est pas encore posé → la policy users_own_data bloquerait tout.
--      Solution à la bascule : exposer ces lectures/écritures via une fonction
--      SECURITY DEFINER dédiée, ou une policy spécifique limitée à l'auth.
--
--   b) PARTAGE PUBLIC (GET /api/trips/share/:id) : pas d'utilisateur connecté
--      → la policy trips_own_data renverrait 0 ligne.
--      Solution à la bascule : fonction SECURITY DEFINER en lecture seule
--      exposant uniquement les voyages au statut partageable.
-- =============================================
