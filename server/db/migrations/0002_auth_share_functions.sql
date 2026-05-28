-- =============================================
-- TRIPGENIE — migrations/0002_auth_share_functions.sql
-- Fonctions SECURITY DEFINER pour les opérations qui NE PEUVENT PAS passer par
-- le RLS "propriétaire" (app.current_user_id), car elles ont lieu AVANT qu'un
-- utilisateur soit identifié, ou concernent un AUTRE utilisateur que l'appelant.
--
-- POURQUOI SECURITY DEFINER :
--   Le rôle applicatif tripgenie_app est SANS BYPASSRLS. Les policies
--   "users_own_data" / "trips_own_data" sont fail-closed : sans app.current_user_id
--   posé, aucune ligne n'est visible. Or trois opérations légitimes n'ont pas
--   (encore) de contexte utilisateur exploitable :
--     - signup / login : lisent/écrivent `users` AVANT de connaître l'id  → bloqués
--     - partage public : lit un `trip` sans utilisateur connecté          → bloqué
--     - inviter / lister des collaborateurs : lit un AUTRE user (par email
--       ou via JOIN) que l'appelant                                       → bloqué
--
--   Ces fonctions s'exécutent avec les droits de LEUR PROPRIÉTAIRE (postgres,
--   qui contourne le RLS), mais :
--     - leur périmètre est volontairement MINIMAL (colonnes précises) ;
--     - celle qui expose des données d'autrui (trip_collaborators_for_owner)
--       VÉRIFIE elle-même la propriété du voyage (p_owner_id vient du JWT
--       vérifié côté serveur, jamais du client) ;
--     - `search_path` est figé → pas de détournement de résolution de noms ;
--     - EXECUTE est révoqué de PUBLIC et accordé uniquement à tripgenie_app.
--
-- À EXÉCUTER UNE FOIS dans Supabase > SQL Editor (connecté en admin/postgres),
-- APRÈS 0001_rls_self_managed.sql.
-- =============================================

-- 1) Lecture d'un utilisateur par email (login + vérif signup + invite collaborateur).
--    Renvoie le hash : nécessaire à bcrypt.compare côté serveur, jamais exposé au client.
CREATE OR REPLACE FUNCTION auth_user_by_email(p_email text)
RETURNS TABLE (id uuid, email text, name text, password text, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id, email, name, password, created_at
  FROM users
  WHERE email = p_email;
$$;

-- 2) Création d'un utilisateur (signup). Le hash bcrypt est calculé côté serveur.
CREATE OR REPLACE FUNCTION auth_create_user(p_email text, p_password text, p_name text)
RETURNS TABLE (id uuid, email text, name text, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO users (email, password, name)
  VALUES (p_email, p_password, p_name)
  RETURNING id, email, name, created_at;
$$;

-- 3) Lecture publique d'un voyage partagé (+ ses packs, colonnes minimales).
--    Lecture seule ; aucune donnée utilisateur (email, hash) n'est exposée.
CREATE OR REPLACE FUNCTION public_shared_trip(p_trip_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT json_build_object(
    'id',          t.id,
    'title',       t.title,
    'destination', t.destination,
    'country',     t.country,
    'pack_data',   t.pack_data,
    'score',       t.score,
    'mode',        t.mode,
    'departure',   t.departure,
    'return_date', t.return_date,
    'travelers',   t.travelers,
    'budget',      t.budget,
    'packs', COALESCE(
      (SELECT json_agg(
                json_build_object('id', p.id, 'rank', p.rank, 'selected', p.selected)
                ORDER BY p.rank)
       FROM packs p WHERE p.trip_id = t.id),
      '[]'::json)
  )
  FROM trips t
  WHERE t.id = p_trip_id;
$$;

-- 4) Collaborateurs d'un voyage AVEC nom/email (la table users est RLS-restreinte
--    au seul appelant, donc un JOIN classique masquerait les autres utilisateurs).
--    SÉCURITÉ : ne renvoie RIEN si p_owner_id n'est pas le propriétaire du voyage.
--    p_owner_id = req.user.id (JWT vérifié côté serveur), jamais une entrée client.
CREATE OR REPLACE FUNCTION trip_collaborators_for_owner(p_trip_id uuid, p_owner_id uuid)
RETURNS TABLE (user_id uuid, role text, invited_at timestamptz, name text, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT c.user_id, c.role, c.invited_at, u.name, u.email
  FROM trip_collaborators c
  JOIN users u ON u.id = c.user_id
  WHERE c.trip_id = p_trip_id
    AND EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = p_trip_id AND t.user_id = p_owner_id
    );
$$;

-- Périmètre d'exécution : seul le rôle applicatif peut appeler ces fonctions.
REVOKE ALL ON FUNCTION auth_user_by_email(text)                 FROM PUBLIC;
REVOKE ALL ON FUNCTION auth_create_user(text, text, text)       FROM PUBLIC;
REVOKE ALL ON FUNCTION public_shared_trip(uuid)                 FROM PUBLIC;
REVOKE ALL ON FUNCTION trip_collaborators_for_owner(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION auth_user_by_email(text)                 TO tripgenie_app;
GRANT EXECUTE ON FUNCTION auth_create_user(text, text, text)       TO tripgenie_app;
GRANT EXECUTE ON FUNCTION public_shared_trip(uuid)                 TO tripgenie_app;
GRANT EXECUTE ON FUNCTION trip_collaborators_for_owner(uuid, uuid) TO tripgenie_app;
