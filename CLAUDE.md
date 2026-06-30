# Ventryl — Nigeria's B2B Petroleum Marketplace

## gstack
Use /browse from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.
Available skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review,
/design-consultation, /design-shotgun, /design-html, /review, /ship, /land-and-deploy,
/canary, /benchmark, /browse, /qa, /qa-only, /design-review,
/setup-browser-cookies, /setup-deploy, /setup-gbrain, /retro, /investigate,
/document-release, /document-generate, /cso, /autoplan, /careful, /freeze,
/guard, /unfreeze, /gstack-upgrade, /learn.

## Stack
- React 19 + Vite 7 + Tailwind CSS v4 (via @tailwindcss/vite plugin)
- React Router v7 (BrowserRouter, nested routes under Layout)
- Zustand v5 (persisted store at src/store/useAppStore.js)
- Recharts v3 for charts
- date-fns for date formatting

## Project Structure
src/
  components/
    layout/     — Layout, Sidebar, Header
    ui/         — Badge, Button, Card, Input, Modal, Table, EmptyState
    charts/     — PriceChart, VolumeChart
  pages/        — Dashboard, Marketplace, Orders, PriceBoard, Depots, Watchlist, Settings
  lib/          — constants.js, utils.js, data.js (mock data)
  store/        — useAppStore.js (Zustand)

## Routes
/             → Dashboard
/market       → Marketplace (listings, filters, order modal)
/orders       → Orders (timeline, detail modal)
/priceboard   → Price Board (live prices, 30d chart, comparison table)
/depots       → Depot Directory (search, filter, depot modal)
/watchlist    → Watchlist (saved listings)
/settings     → Settings (profile, wallet, notifications, security)

## Domain
Nigeria's B2B petroleum marketplace. Products: PMS (petrol), AGO (diesel),
DPK (kerosene), LPG (cooking gas), ATK (aviation). Prices in NGN (₦).
Volumes in litres (L) or metric litres (ML). Depot tiers: certified/verified/standard.

## Dev
npm run dev    → http://localhost:5173
npm run build  → dist/ (production)

## Deployment
Vercel — vercel.json already configured with SPA rewrites.
