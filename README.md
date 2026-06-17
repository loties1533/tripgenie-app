<div align="center">

# ✈️ TripGenie

### AI-Powered Travel Pack Generator

**Décris ton voyage. TripGenie génère tout le reste.**

[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Vitest](https://img.shields.io/badge/Vitest-282_tests-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev)

[🚀 Demo Live](https://tripgenie.onrender.com) · [📖 API Docs](http://localhost:3000/api/docs) · [🐛 Issues](https://github.com/loties1533/tripgenie-app/issues)

---

</div>

## 🎯 Présentation

Les comparateurs de voyage (Booking, Kayak, TripAdvisor) retournent **300 résultats bruts**. L'utilisateur doit filtrer, comparer, décider seul.

**TripGenie fait la synthèse à sa place.**

L'utilisateur décrit son voyage en langage naturel → l'app génère un **pack complet clé en main** en moins de 30 secondes :

- ✈️ Vols avec prix et compagnies (Tavily recherche web temps réel)
- 🏨 Hôtels sélectionnés selon le style de voyage
- 🍽️ Restaurants réels via Foursquare → Yelp (fallback)
- 🎉 Événements locaux via PredictHQ → Tavily (fallback)
- 🗓️ Itinéraire jour par jour
- 🌤️ Météo prévue (Open-Meteo, sans clé API)
- 💰 Budget ventilé par poste
- 📊 Score de qualité du pack (0–1, algorithme déterministe)

---

## ✨ Fonctionnalités

### Onboarding conversationnel
L'IA pose des questions naturelles pour extraire destination, budget, style, dates — et génère le pack à la fin. Pas de formulaire complexe.

### Données temps réel
Vols, hôtels et événements sont récupérés via **Tavily** (recherche web) et **PredictHQ** (événements structurés) pour éviter les hallucinations LLM sur les prix et disponibilités.

### 6 modes de voyage
`party` · `luxury` · `student` · `group` · `relax` · `surprise` — chaque mode adapte le prompt IA, le scoring et la répartition budgétaire.

### Chat de modification post-génération
Après génération, l'utilisateur modifie le pack en langage naturel : *"Change l'hôtel pour quelque chose de moins cher"* → le pack se met à jour sans tout régénérer. C'est la seule partie **agentique** du projet.

### Carte interactive
Visualisation des activités et hôtels sur une carte Leaflet avec marqueurs géolocalisés.

### Partage public
Chaque voyage génère un lien public `/share/:id` — consultable sans compte, sans exposer les données privées de l'utilisateur.

### Vote collectif
En mode groupe, chaque membre vote pour/contre les éléments du pack pour construire un consensus.

### Documentation API interactive
Interface Swagger disponible sur `/api/docs` — toutes les routes sont testables directement depuis le navigateur.

---

## 🏗️ Architecture

> **Pipeline IA orchestré côté serveur — pas un agent autonome.** Les étapes sont prédéfinies et s'enchaînent toujours dans le même ordre. Seul le chat de modification (`/api/ai/chat`) est agentique.

### Architecture en couches (3-tier)

```mermaid
flowchart TB
    subgraph PRES["🎨 COUCHE PRÉSENTATION"]
        UI["Frontend React<br/>pages · composants · Zustand"]
        REST["API REST Express<br/>auth · trips · ai · packs · votes · preferences · collaborators"]
    end
    subgraph LOGIC["⚙️ COUCHE LOGIQUE MÉTIER"]
        Sec["Auth JWT · bcrypt · Validation Zod · Rate-limit"]
        Pipe["Pipeline IA : analyze → search → assemble → score"]
        Svc["Services : scoring · smartSearch · LLM cascade · restaurants"]
    end
    subgraph PERS["🗄️ COUCHE PERSISTANCE"]
        ORM["Prisma ORM"]
        DB[("PostgreSQL — 6 tables (Docker)")]
    end
    UI -->|"HTTPS · Cookie httpOnly (JWT)"| REST
    REST --> Sec --> Pipe --> Svc
    Svc -->|"requêtes typées"| ORM
    ORM --- DB
    Pipe -.->|"APIs externes"| EXT["🌐 Tavily · Foursquare/Yelp · PredictHQ · Open-Meteo · Unsplash · Gemini/Claude/OpenRouter"]
```

### Le pipeline de génération

```
POST /api/ai/generate
        │
        ├─ 1. Validation Zod
        │
        ├─ 2. Promise.allSettled([          ← Parallèle, 30s timeout
        │       smartFlightSearch(),        ← Tavily : vols réels
        │       smartEventsSearch(),        ← PredictHQ → Tavily fallback
        │       smartHotelSearch(),         ← Tavily : hôtels
        │       getRealWeather(),           ← Open-Meteo (sans clé)
        │       getDestinationPhoto()       ← Unsplash (proxy backend)
        │     ])
        │   + foursquareSearch() → yelpSearch() (fallback)
        │
        ├─ 3. assemblePack()               ← LLM + données réelles injectées
        │      Gemini → Claude → OpenRouter (cascade fallback)
        │
        ├─ 4. Merge restaurants            ← Foursquare/Yelp dans activities
        │
        ├─ 5. scorepack()                  ← Algorithme déterministe (0–1)
        │      pondération par mode de voyage
        │
        └─ 6. Sauvegarde PostgreSQL        ← via Prisma si l'utilisateur est connecté
```

### Cascade LLM (fallback automatique)

```
Gemini 2.0 Flash  →  Claude Haiku  →  OpenRouter (7 modèles gratuits)  →  Mocks statiques
```

Si un provider échoue (quota, timeout 45s), le suivant prend le relais automatiquement. `Promise.allSettled` garantit que la génération continue même si un service externe est en panne.

### Séquence — génération d'un pack

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant F as Frontend
    participant A as API /ai/generate
    participant Ext as APIs externes
    participant LLM as LLM (cascade)
    participant DB as PostgreSQL
    U->>F: décrit son voyage (langage naturel)
    F->>A: POST /api/ai/generate
    A->>A: 1. Validation Zod
    par Recherches parallèles (Promise.allSettled)
        A->>Ext: vols · hôtels · événements · météo · photo
        A->>Ext: restaurants (Foursquare → Yelp)
    end
    Ext-->>A: données réelles
    A->>LLM: 2. assemblePack(données injectées)
    LLM-->>A: pack JSON structuré
    A->>A: 3. scoring déterministe (0–1)
    A->>DB: 4. sauvegarde via Prisma (si connecté)
    A-->>F: pack + score
    F-->>U: pack clé en main 🎉
```

---

## 🗄️ Base de données

PostgreSQL via l'**ORM Prisma**. Le schéma est défini dans `prisma/schema.prisma`, les requêtes sont **typées de bout en bout**, et PostgreSQL tourne en local dans **Docker**.

```sql
users        — Comptes, auth JWT custom
trips        — Voyages avec pack_data JSONB + score float 0-1
packs        — Packs générés par voyage (rank, selected)
trip_votes   — Votes collectifs par item (true/false)
preferences  — Préférences utilisateur (relation 1-1 avec users)
trip_collaborators — Collaborateurs par voyage (viewer/editor)
```

### Schéma relationnel (ERD)

```mermaid
erDiagram
    users ||--o{ trips : "possède"
    users ||--o| user_preferences : "a (1-1)"
    users ||--o{ trip_collaborators : "collabore"
    trips ||--o{ packs : "génère"
    trips ||--o{ trip_collaborators : "partagé via"
    packs ||--o{ trip_votes : "reçoit"
    users {
        uuid id PK
        text email UK
        text password
        text name
        timestamptz created_at
    }
    trips {
        uuid id PK
        uuid user_id FK
        text destination
        text mode
        float score
        jsonb pack_data
    }
    packs {
        uuid id PK
        uuid trip_id FK
        int rank
        boolean selected
        jsonb pack_data
    }
    trip_votes {
        uuid id PK
        uuid pack_id FK
        text item_id
        boolean vote_type
    }
    user_preferences {
        uuid user_id PK
        text default_mode
        text currency
    }
    trip_collaborators {
        uuid trip_id PK
        uuid user_id PK
        text role
    }
```

### Isolation des données

Chaque route protégée filtre **systématiquement** par utilisateur — `where: { user_id }`, l'`id` provenant du JWT signé. Un utilisateur ne peut donc jamais accéder aux données d'un autre (vérifié dans la suite de tests sécurité).

```typescript
// Un utilisateur ne lit que SES voyages — filtre appliqué à chaque requête protégée
const trips = await prisma.trip.findMany({
  where: { user_id: req.user.id },
});
```

---

## 📊 Algorithme de Scoring

100% déterministe — zéro IA. Même entrée → même sortie. Score float entre 0 et 1.

| Mode | Hôtel | Activités | Vols | Prix | Événements | Calme |
|------|-------|-----------|------|------|------------|-------|
| luxury | 40% | 30% | 20% | 10% | — | — |
| party | 20% | — | 10% | 30% | 40% | — |
| student | 15% | 25%* | — | 50% | 10% | — |
| group | 35% | 30% | 15% | 20% | — | — |
| relax | 30% | 25% | — | 10% | — | 35% |

*activités gratuites uniquement en mode student

---

## 🛠️ Stack Technique

### Frontend
| Technologie | Rôle |
|-------------|------|
| React 18 + Vite | UI déclarative, HMR ultra-rapide |
| TypeScript | Typage statique partagé front/back |
| React Router v6 | SPA — navigation sans rechargement |
| Zustand v5 | State management global (auth + trips) |
| React Query v5 | Cache + fetching automatique |
| Tailwind CSS | Styles utilitaires |
| Framer Motion | Animations déclaratives |
| Leaflet | Carte interactive |
| Recharts | Graphique budget breakdown |

### Backend
| Technologie | Rôle |
|-------------|------|
| Node.js ≥18 + Express 4 | Runtime + framework HTTP |
| TypeScript | Typage statique strict (ES2022, NodeNext) |
| Prisma 6 | ORM typé pour PostgreSQL — requêtes type-safe, migrations versionnées |
| Zod v4 | Validation des inputs — aucun endpoint sans validation |
| JWT + bcryptjs | Auth stateless + hashage bcrypt (genSalt 10) |
| cookie-parser | Lecture cookie httpOnly `tg_token` |
| Helmet + CORS | Headers de sécurité HTTP |
| express-rate-limit | Protection DDoS (10 req/h routes IA) |
| swagger-ui-express | Documentation API interactive sur `/api/docs` |
| Morgan | Logger HTTP (méthode, route, status, durée) |

### IA & Services externes
| Service | Rôle | Fallback |
|---------|------|---------|
| Google Gemini 2.0 Flash | LLM principal | Claude |
| Anthropic Claude Haiku | LLM secondaire | OpenRouter |
| OpenRouter | LLM tertiaire — 7 modèles gratuits | Mocks statiques |
| Tavily | Recherche web temps réel (vols, hôtels) | Données IA |
| PredictHQ | Événements structurés (concerts, festivals) | Tavily |
| Foursquare Places | Restaurants réels (1000 req/jour gratuit) | Yelp |
| Yelp Fusion | Restaurants fallback | `[]` (pack sans restos) |
| Open-Meteo | Météo temps réel — **sans clé API** | Données IA |
| Unsplash | Photos destinations (proxy backend) | Placeholder |

---

## 🔒 Sécurité

| Menace | Solution |
|--------|----------|
| Vol de token JWT | Cookie httpOnly `tg_token` — inaccessible depuis JavaScript |
| XSS | Token hors portée JS + Helmet CSP headers |
| CSRF | `sameSite: strict` sur le cookie |
| Injection SQL | Prisma ORM — requêtes paramétrées automatiquement |
| Inputs malveillants | Validation Zod sur tous les endpoints |
| Spam / DDoS | Rate limiting par IP (global + par route IA) |
| Exposition clés API | Proxy backend Unsplash, variables d'env serveur uniquement |
| Accès inter-utilisateurs | `where: { user_id }` — filtre applicatif Prisma sur chaque route protégée |
| IDOR | 404 si ressource non possédée (pas de 403 qui confirme l'existence) |

### Séquence — authentification (login JWT)

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant F as Frontend
    participant A as API /auth/login
    participant DB as PostgreSQL (Prisma)
    U->>F: email + mot de passe
    F->>A: POST /api/auth/login
    A->>DB: findUnique({ email })
    DB-->>A: utilisateur + hash bcrypt
    A->>A: bcrypt.compare(motDePasse, hash)
    A->>A: jwt.sign({ id, email })
    A-->>F: 200 + Cookie httpOnly (tg_token)
    F-->>U: connecté ✅
```

---

## 🧪 Tests

```bash
npm test          # 4 fichiers core (~0.8s)
npm run test:all  # 14 fichiers complets
```

```
tests/
├── unit/
│   ├── scoring-party.test.ts           8 tests — scoring mode party
│   └── smartSearch-hotel.test.ts      12 tests — recherche hôtels
├── services/
│   ├── predictHQ.test.ts              15 tests — événements PredictHQ
│   ├── foursquare.test.ts             17 tests — restaurants Foursquare
│   └── yelp.test.ts                   10 tests — fallback Yelp
├── security/
│   ├── auth-signup.test.ts            12 tests — inscription, bcrypt, cookie
│   ├── auth-login.test.ts             12 tests — connexion, JWT, logout
│   ├── auth-tokens.test.ts            13 tests — expiration, alg:none, IDOR
│   └── input-validation.test.ts       20 tests — Zod toutes routes
└── integration/
    └── generate-restaurants.test.ts    8 tests — pipeline FSQ→Yelp
─────────────────────────────────────────────────────────────────
  282 tests — tous les services externes mockés (zéro clé API requise)
```

---

## 🚀 Installation locale

### Prérequis
- Node.js ≥ 18
- PostgreSQL (en local via Docker — voir `docker-compose.yml`)
- Au moins une clé LLM (Gemini gratuit suffit)

### Setup

```bash
# 1. Cloner le repo
git clone https://github.com/loties1533/tripgenie.git
cd tripgenie

# 2. Installer les dépendances backend
npm install

# 3. Configurer les variables d'environnement
cp .env.example .env
# Remplir .env avec tes clés API

# 4. Lancer en développement
npm run dev          # Backend Express → http://localhost:3000
npm run client:dev   # Frontend Vite  → http://localhost:5173

# 5. Documentation API interactive
# http://localhost:3000/api/docs
```

### Variables d'environnement

```env
# Serveur
PORT=3000
NODE_ENV=development
JWT_SECRET=your-strong-secret-here
CLIENT_URL=http://localhost:5173

# Base de données (PostgreSQL via Prisma)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tripgenie?schema=public

# IA (au moins une clé requise — fallback automatique)
GEMINI_API_KEY=...
ANTHROPIC_API_KEY=...
OPENROUTER_API_KEY=...

# Services (optionnels — fallback IA si absent)
TAVILY_API_KEY=...
UNSPLASH_ACCESS_KEY=...
FOURSQUARE_API_KEY=...
PREDICTHQ_API_KEY=...
# Open-Meteo : aucune clé requise
```

> ⚠️ Ne jamais committer le `.env` réel. Le `.env.example` ne contient aucune valeur sensible.

---

## 📁 Structure du projet

```
tripgenie/
├── server/                     # Backend Node.js / Express / TypeScript
│   ├── index.ts                # Point d'entrée — middleware, routes, démarrage
│   ├── routes/                 # auth · trips · ai · votes · photos · packs
│   │                           # preferences · collaborators
│   ├── middleware/
│   │   ├── auth.ts             # requireAuth · optionalAuth (cookie + Bearer)
│   │   ├── limiter.ts          # Rate limiters (generate 10/h, chat 30/15min, auth 10/15min)
│   │   └── validation.ts       # Middleware de validation Zod centralisé
│   ├── services/
│   │   ├── claude/             # Pipeline IA : core · analyze · pack · chat
│   │   ├── providers.ts        # Adaptateurs multi-LLM (Gemini / Claude / OpenRouter / Ollama)
│   │   ├── scoring.ts          # Algorithme scoring déterministe 0–1
│   │   ├── smartSearch.ts      # Recherche vols / hôtels / événements (Tavily)
│   │   ├── foursquare.ts       # Restaurants réels Foursquare
│   │   ├── yelp.ts             # Restaurants fallback Yelp
│   │   ├── predictHQ.ts        # Événements structurés PredictHQ
│   │   ├── weather.ts          # Météo Open-Meteo (sans clé)
│   │   ├── photo.ts            # Photo destination Unsplash
│   │   └── mocks.ts            # Fallback données statiques
│   ├── lib/
│   │   ├── AppError.ts         # Classe erreur custom + middleware global
│   │   ├── constants.ts        # MODES, BUDGET_RATIOS, DEFAULT_VALUES
│   │   └── types.ts            # Types TypeScript partagés
│   ├── db/
│   │   └── prisma.ts           # Client Prisma singleton
│   └── docs/
│       └── openapi.ts          # Spec OpenAPI 3.0.3 — 21 routes documentées
│
├── client-react/               # Frontend React / Vite / TypeScript
│   └── src/
│       ├── pages/              # Home · Trips · TripDetail · Login · Preferences
│       ├── components/         # PackResults · Chat · Map · VoteButtons · UI
│       ├── store/index.ts      # Zustand : useAuthStore · useTripStore
│       └── lib/api.ts          # Toutes les requêtes HTTP vers l'API
│
├── tests/                      # 282 tests Vitest + Supertest
├── .github/workflows/          # GitHub Actions CI (tests + tsc à chaque push)
└── render.yaml                 # Configuration déploiement Render (PaaS)
```

---

## 🌐 Routes API

Documentation interactive complète → **`/api/docs`** (Swagger UI)

### Authentification
| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/api/auth/signup` | — | Création de compte (bcrypt + cookie JWT) |
| POST | `/api/auth/login` | — | Connexion + cookie httpOnly `tg_token` |
| POST | `/api/auth/logout` | — | Clear cookie |
| GET | `/api/auth/me` | ✅ | Profil utilisateur connecté |

### IA
| Méthode | Route | Auth | Limite |
|---------|-------|------|--------|
| POST | `/api/ai/generate` | optionnel | 10/h/IP |
| POST | `/api/ai/chat` | optionnel | 30/15min/IP |
| POST | `/api/ai/onboarding` | — | 30/15min/IP |
| POST | `/api/ai/destinations` | — | 30/15min/IP |

### Voyages (CRUD complet)
| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/trips` | ✅ | Liste (filtre mode/status, pagination) |
| POST | `/api/trips` | ✅ | Créer un voyage |
| GET | `/api/trips/:id` | ✅ | Détail + packs agrégés |
| PUT | `/api/trips/:id` | ✅ | Modifier (title, status, pack_data…) |
| DELETE | `/api/trips/:id` | ✅ | Supprimer |
| GET | `/api/trips/share/:id` | 🌐 public | Partage public d'un voyage |

### Autres ressources
| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET/PUT | `/api/preferences` | ✅ | Préférences utilisateur |
| GET/POST | `/api/trips/:id/collaborators` | ✅ | Collaborateurs |
| DELETE | `/api/trips/:id/collaborators/:uid` | ✅ | Retirer un collaborateur |
| GET | `/api/packs/:trip_id` | ✅ | Packs d'un voyage |
| POST | `/api/packs/:trip_id/select/:pack_id` | ✅ | Sélectionner un pack |
| POST | `/api/votes` | 🌐 public | Voter sur un élément |
| GET | `/api/votes/:pack_id` | 🌐 public | Récupérer les votes |
| GET | `/api/photos/:city` | 🌐 public | Photo destination (proxy Unsplash) |
| GET | `/api/health` | 🌐 public | Healthcheck |

---

<div align="center">

**Projet solo — Juin 2026**

*TripGenie — Explorez le monde, l'IA s'occupe du reste.*

</div>
