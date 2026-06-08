# TripGenie — Frontend React v2

Interface React moderne pour TripGenie. Stack : **Vite + React 18 + Tailwind CSS + Zustand + Framer Motion**.

## Installation

```bash
# 1. Depuis la racine du projet TripGenie
cd client-react

# 2. Installer les dépendances
npm install

# 3. Lancer en développement (proxifie automatiquement vers localhost:3000)
npm run dev
```

Le frontend tourne sur **http://localhost:3001** et proxifie `/api/*` vers le backend Express sur le port 3000.

## Structure

```
src/
├── components/
│   ├── chat/
│   │   └── ChatWidget.jsx     ← Chat IA fluide (Zustand + Framer Motion)
│   ├── results/
│   │   └── PackResults.jsx    ← Affichage complet du pack voyage
│   ├── layout/
│   │   └── index.jsx          ← Header + PageLayout
│   └── ui/
│       └── index.jsx          ← Atomes réutilisables (Badge, Stars, Skeleton…)
├── pages/
│   ├── Home.jsx               ← Hero + Chat + Résultats
│   ├── Trips.jsx              ← Liste des voyages sauvegardés
│   ├── TripDetail.jsx         ← Voyage partagé (lien public)
│   └── Login.jsx              ← Connexion / Inscription
├── store/
│   └── index.js               ← Zustand stores (search, chat, auth, theme)
├── lib/
│   └── api.js                 ← Toutes les requêtes vers l'API Express
├── App.jsx                    ← Router + Providers
├── main.jsx                   ← Point d'entrée React
└── index.css                  ← Tailwind + design tokens + composants CSS
```

## Ce qui a changé vs le front Vanilla

| Avant (Vanilla JS)              | Après (React)                        |
|---------------------------------|--------------------------------------|
| 50 `window.*` globals           | Zustand stores réactifs              |
| 46 `onclick=` dans le HTML      | Event handlers JSX                   |
| 18 `innerHTML` (risque XSS)     | JSX auto-escaped                     |
| Chat boucle à l'infini          | Limite 7 tours + historique envoyé   |
| État perdu au refresh           | Zustand persist (localStorage)       |
| Zéro animation                  | Framer Motion sur messages/sections  |
| Hôtels sans photo               | Photo réelle + badge Vérifié         |
| 1 fichier CSS par thème         | Tailwind + dark mode classe          |

## Build production

```bash
npm run build
# Les fichiers sont dans dist/
# À servir statiquement ou via nginx
```

## Ajouter une route au backend CORS

Dans `server/index.js`, ajouter l'origine de production :
```js
origin: [
  process.env.CLIENT_URL || 'http://localhost:3001',
  'https://ton-domaine.com'
]
```
