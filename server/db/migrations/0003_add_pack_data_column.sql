-- =============================================
-- Migration 0003 — Ajout colonne pack_data sur packs
-- =============================================
--
-- Contexte : la table `packs` a été créée avant que la colonne `pack_data`
-- soit ajoutée au schéma (schema.sql). Comme CREATE TABLE IF NOT EXISTS
-- ignore les tables existantes, la colonne n'a jamais été ajoutée.
--
-- Ce script est idempotent (IF NOT EXISTS) — sans danger à relancer.
--
-- À exécuter dans : Supabase SQL Editor
-- =============================================

ALTER TABLE packs
  ADD COLUMN IF NOT EXISTS pack_data JSONB;

-- Vérification
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'packs'
ORDER BY ordinal_position;
