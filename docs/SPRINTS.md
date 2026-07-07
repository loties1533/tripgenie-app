# TripGenie — Documentation Agile (Sprints, Reviews & Rétrospectives)

**Projet** : TripGenie — agence de voyage conversationnelle assistée par IA.
**Méthodologie** : Scrum — 6 sprints itératifs (projet solo, multi-rôles PM/SCM/QA/Dev).
**Board Trello (public)** : https://trello.com/b/GfQ3gMc8/tripgenie-agile-board

---

## Sprint planning

Découpage du développement en 6 sprints (une colonne Trello par sprint), tâches priorisées MoSCoW.

| Sprint | Période | Objectif | Statut |
|--------|---------|----------|--------|
| **S1 — Fondations** | 27 mai – 3 juin | Serveur, BDD, auth, 1ʳᵉ génération LLM | ✅ |
| **S2 — Auth & sécurité** | 4 – 10 juin | Pipeline IA orchestré, scoring, sécurité | ✅ |
| **S3 — Cœur IA** | 11 – 19 juin | TypeScript, suite de tests, conteneurisation | ✅ |
| **S4 — CRUD & fonctionnalités** | 20 – 24 juin | Diagrammes, documentation, recette & corrections | ✅ |
| **S5 — Industrialisation** | 25 juin – 1 juil | Migration Prisma, Docker, tests, doc technique | ✅ |
| **S6 — Finalisation & production** | à finaliser | CI, déploiement, accessibilité, performances | 🔄 |

**Priorisation MoSCoW** : MUST (auth, génération, modification, score) · SHOULD (préférences, votes, collaborateurs, données réelles) · COULD (partage public) · WON'T v1 (réservation in-app).

**Dépendances** : BDD → Auth → Pipeline IA → Scoring → CRUD → Frontend → CI/CD → Déploiement.

---

## Sprint Reviews

Démonstration du livrable à la fin de chaque sprint.

### Sprint 1 — Fondations
Inscription/connexion sécurisée (cookie httpOnly), base de données 6 tables, première génération de pack via LLM.

### Sprint 2 — Auth & sécurité
Pipeline IA complet (recherches parallèles + assemblage), scoring déterministe, validation Zod sur tous les endpoints.

### Sprint 3 — Cœur IA
Suite de tests verte (Vitest + Supertest), conteneurisation Docker, durcissement sécurité (Helmet).

### Sprint 4 — CRUD & fonctionnalités
Application bout-en-bout (onboarding → pack → carte → mes voyages), diagrammes (architecture, ERD, MCD), recette manuelle (4 bugs corrigés).

### Sprint 5 — Industrialisation
Migration 100 % Prisma, conteneurisation PostgreSQL, documentation technique.

### Sprint 6 — Finalisation & production
En cours : CI verte à chaque push ; préparation au déploiement (Render).

---

## Retrospectives

Réflexion sur le process à la fin de chaque sprint.

### Sprint 1
- ✅ **Réussite** : socle propre dès le départ (TypeScript strict, Prisma), authentification robuste.
- ⚠️ **Difficulté** : fiabilité variable des APIs externes (vols/hôtels).
- 🔧 **Amélioration** : prévoir des *fallbacks* systématiques (fait en S2).

### Sprint 2
- ✅ **Réussite** : `Promise.allSettled` — un service en panne n'interrompt plus la génération.
- ⚠️ **Difficulté** : quotas des fournisseurs LLM.
- 🔧 **Amélioration** : cascade de repli Claude → Gemini → OpenRouter → mocks.

### Sprint 3
- ✅ **Réussite** : filet de sécurité de tests solide.
- ⚠️ **Difficulté** : cohérence d'affichage de certaines données générées.
- 🔧 **Amélioration** : recette manuelle dédiée (réalisée en S4).

### Sprint 4
- ✅ **Réussite** : bugs d'affichage détectés et corrigés en direct.
- ⚠️ **Difficulté** : bugs cosmétiques (camembert budget, formats de dates).
- 🔧 **Amélioration** : backlog pour les anomalies mineures.

### Sprint 5
- ✅ **Réussite** : base de code consolidée et plus maintenable (100 % Prisma).
- ⚠️ **Difficulté** : surface de tests à étendre.
- 🔧 **Amélioration** : étendre la couverture de tests.

### Sprint 6
- 🔄 **En cours.**
- 🔧 **Amélioration** : finaliser le déploiement Render + accessibilité/responsive + performances.

---

## Outils de suivi

- **Board Trello** (sprint planning + statuts des cartes) : https://trello.com/b/GfQ3gMc8/tripgenie-agile-board
- **GitHub Issues** (bug & task tracking, 12 issues fermées) : https://github.com/loties1533/tripgenie-app/issues
- **GitHub Actions** (CI — tests + typecheck à chaque push) : https://github.com/loties1533/tripgenie-app/actions
