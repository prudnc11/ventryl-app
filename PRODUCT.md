# Ventryl — Product Document

**Version**: 1.0
**Last Updated**: July 2026
**Live URL**: https://ventryl-app.vercel.app

---

## 1. Product Overview

Ventryl is a B2B petroleum marketplace for Nigeria. It connects petroleum product buyers (marketers, distributors, industrials) with depot owners for price discovery, order placement, delivery negotiation, and fulfillment tracking — all through a single platform.

The platform eliminates the opacity, phone-call dependency, and trust gaps that characterize Nigeria's downstream petroleum supply chain.

### Vision

Become the default digital infrastructure for petroleum trading in Nigeria — a trusted, transparent marketplace where every litre moved is tracked, every price is visible, and every transaction is settled on time.

### Target Market

- **Buyers**: Independent petroleum marketers, filling station chains, industrial consumers, aviation fuel buyers
- **Depot Owners**: Tank farm operators, storage terminal owners, ex-depot product holders
- **Geography**: All 36 Nigerian states + FCT (774 LGAs supported)

---

## 2. Product Offerings

### 2.1 Petroleum Products Traded

| Code | Product | Unit | Use Case |
|------|---------|------|----------|
| PMS | Premium Motor Spirit (Petrol) | per litre | Filling stations, transport |
| AGO | Automotive Gas Oil (Diesel) | per litre | Industrial, transport, generators |
| DPK | Dual Purpose Kerosene | per litre | Household, industrial |
| LPG | Liquefied Petroleum Gas | per kg | Cooking gas, industrial |
| ATK | Aviation Turbine Kerosene | per litre | Aviation fuel |

All prices are denominated in Nigerian Naira (NGN / ₦).

### 2.2 Platform Revenue Model

- **Platform Fee**: 1% of total order value
- **VAT**: 7.5% on platform fee
- **Net to Depot**: Order value minus platform fee

---

## 3. User Roles & Access

### 3.1 Buyer (Default)

Every registered user is a buyer. Buyers can:
- Browse the marketplace and compare depot prices
- Place orders for one or more petroleum products
- Fund their wallet and track balances
- Track order lifecycle (placement → delivery)
- Negotiate delivery costs with depots
- Raise disputes on orders
- View order history and financial summaries

### 3.2 Depot Owner

Any buyer can also register depots. Depot owners can:
- Create and manage one or more depots
- Set product prices and stock levels
- Receive and action incoming orders (confirm/reject)
- Assign loading bays and dispatch trucks
- Manage team members (invite, assign roles, revoke)
- Track stock history and low-stock alerts
- Complete KYB (Know Your Business) verification

### 3.3 Admin

Platform administrators (flagged via `is_admin` on profile) can:
- Review and approve/reject KYC submissions
- Review and approve/reject KYB submissions
- View all platform orders across all depots
- Manage pricing data
- View all registered users

---

## 4. Core Workflows

### 4.1 Onboarding

```
Sign Up → Email Verification → Profile Setup → KYC Submission → KYC Review (Admin) → Verified Buyer
```

**Registration Fields**: Full name, company name, email, phone, password
**KYC Documents**: Government-issued ID, CAC certificate, utility bill, proof of address
**KYC Statuses**: `pending` → `submitted` → `approved` / `rejected`

### 4.2 Depot Registration

```
KYC Verified → Create Depot → Add Products/Prices → KYB Submission → KYB Review (Admin) → Verified Depot
```

**Depot Fields**: Name, location (state/LGA/address), DPR license number, license expiry, storage capacity, contact details
**KYB Documents**: DPR license, CAC certificate, NMDPRA permit, tank calibration certificate, environmental compliance
**KYB Statuses**: `pending` → `submitted` → `verified` / `rejected`
**Gate**: Users must have KYC `approved` before creating a depot.

### 4.3 Order Lifecycle

```
Buyer places order
    ↓
Order status: PENDING (2h SLA for depot response)
    ↓
Depot confirms or rejects
    ↓ (if confirmed)
Order status: CONFIRMED
    ↓
Depot assigns loading bay + reference
    ↓
Order status: LOADING
    ↓
Depot dispatches trucks (driver, plate, volume per truck)
    ↓
Order status: IN_TRANSIT
    ↓
Buyer confirms delivery    OR    Buyer self-collects from depot
    ↓                                ↓
Order status: DELIVERED         Order status: COLLECTED
    ↓                                ↓
Escrow released to depot         Escrow released to depot
```

**Terminal States**: `delivered`, `collected`, `rejected`, `cancelled`
**Dispute Path**: `in_transit` or `delivered` → `disputed` → `delivered` or `collected`

### 4.4 Order State Machine

| From | Allowed Transitions |
|------|-------------------|
| pending | confirmed, rejected, cancelled |
| confirmed | loading, cancelled |
| loading | in_transit, collected |
| in_transit | delivered, collected, disputed |
| delivered | disputed |
| disputed | delivered, collected |
| collected | _(terminal)_ |
| rejected | _(terminal)_ |
| cancelled | _(terminal)_ |

### 4.5 Delivery Negotiation

For orders with delivery mode, the depot and buyer can negotiate delivery costs:

```
Depot sends quote → Buyer reviews (buyer_pending)
    ↓
Buyer counter-offers → Depot reviews (depot_pending)
    ↓ (repeat until agreed)
Either party accepts → Status: AGREED
```

Each round records: party, amount, timestamp. The agreed amount is finalized on the negotiation record.

### 4.6 Wallet & Payments

- **Funding**: Paystack integration for wallet top-up (preset amounts or custom)
- **Escrow**: When an order is placed, `total_value + platform_fee + VAT` is held from the buyer's wallet
- **Release**: On delivery/collection, escrow is released to the depot
- **Refund**: On rejection/cancellation, full escrow amount is refunded to the buyer's wallet
- **Transaction Types**: `credit`, `debit`, `hold`, `release`, `fee`
- **Currency**: Nigerian Naira (NGN)

---

## 5. Feature Map by Screen

### 5.1 Dashboard (`/`)

Unified view combining buyer and depot owner perspectives:
- Greeting with time-of-day personalization
- Wallet balance display
- KPI strip: Orders this month, total volume bought, active depots, depot revenue
- Order Inbox panel (for depot owners with verified depots — pending orders requiring action)
- Recent Orders list (clickable to order detail)
- Market Prices widget (live prices across 7 product types)

### 5.2 Price Discovery (`/market`)

Marketplace showing all verified depots and their current product pricing:
- Depot cards with product prices, stock levels, ratings
- Filtering and comparison across depots
- Direct "Place Order" action from any depot

### 5.3 Place Order (`/place-order`)

Multi-step order flow:
1. Select depot
2. Select products and volumes
3. Choose delivery mode (delivery to address or self-pickup)
4. If delivery: select state, LGA, and enter address
5. If pickup: enter pickup note
6. Review order summary (product value, platform fee, VAT, total)
7. Confirm and place order (funds held from wallet)

**Auto-calculations**: Truck count (33,000L per truck), platform fee (1%), VAT (7.5% on fee), net to depot

### 5.4 My Orders (`/orders`)

List view of all buyer orders with:
- Order ID, depot, product, volume, value
- Status badge (color-coded)
- Progress indicator
- Pending delivery quote indicator
- Click-through to order detail

### 5.5 Order Detail — Buyer (`/orders/:id`)

Comprehensive order tracking view:
- Status banner with contextual messaging and CTAs per status
- Progress stepper (Placed → Confirmed → Loading → In Transit → Delivered/Collected)
- Order metadata (product, volume, depot, buyer, dates)
- Truck tracking table (driver, plate, volume, departure, ETA, progress)
- Delivery negotiation panel (quote/counter-quote rounds)
- Financial breakdown (product value, platform fee, VAT, net to depot)
- Full timeline/audit log
- Dispute filing (multi-step: select reason → add details → attach evidence → submit)
- Print waybill and invoice actions

### 5.6 Order Detail — Depot (`/depot/:depotId/order/:orderId`)

Depot-side order management:
- Confirm or reject pending orders
- Assign loading bay and reference number
- Dispatch trucks (add driver name, plate number, volume per truck)
- Update truck progress during transit
- Mark as delivered/collected
- View buyer details and delivery negotiation
- Gate record management
- Print waybill/invoice

### 5.7 Wallet (`/wallet`)

- Current NGN balance
- Fund wallet via Paystack (preset amounts: ₦500K, ₦1M, ₦2M, ₦5M, ₦10M, or custom)
- Transaction history with type indicators (credit, debit, hold, release)
- Active orders summary (orders with held funds)

### 5.8 Depot Detail (`/depot/:id`)

Tabbed view for depot management:
- **Overview**: Stock KPI strip, product inventory with prices/stock/thresholds, stock adjustment controls, low-stock alerts, recent depot orders, Order Inbox panel
- **Inbox**: Dedicated order inbox with pending/confirmed orders, confirm/reject actions, SLA timers
- **Schedule**: Truck scheduling view
- **Buyers**: Buyer network / repeat buyer tracking
- **KYB**: Document upload and verification status
- **Settings**: Depot configuration, team management

### 5.9 Create Depot (`/depot/new`)

Multi-step depot creation flow:
1. Basic info: name, state, LGA, address
2. License details: DPR license number, expiry date
3. Capacity and products offered
4. Contact person details
5. Review and submit

### 5.10 Settings (`/settings`)

Multi-tab settings module:
- **Profile**: Edit personal details (name, company, phone, state, LGA)
- **Verification (KYC)**: Upload documents, track verification status
- **Notifications**: Configure preferences for order updates, price alerts, security alerts (email/SMS/push channels)
- **Security**: Password change
- **Bay Config** (depot mode): Configure loading bay assignments
- **Team** (depot mode): Invite members, assign roles (Admin, Operator, Viewer), activate/deactivate, revoke invites

### 5.11 Admin Panel (`/admin`)

Admin-only panel with tabs:
- **Overview**: Platform-wide statistics
- **KYC Review**: List of submitted KYC applications, approve/reject with reason
- **KYB Review**: List of submitted KYB applications, approve/reject with reason
- **Orders**: View all platform orders
- **Pricing**: Manage price history data
- **Users**: View all registered users

---

## 6. Data Architecture

### 6.1 Database Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (extends Supabase auth.users) |
| `depots` | Depot registrations |
| `depot_products` | Products offered by each depot (prices, stock, thresholds) |
| `stock_history` | Stock adjustment audit trail |
| `orders` | Order records |
| `order_items` | Line items per order (product, volume, price) |
| `order_trucks` | Truck assignments per order (driver, plate, volume, progress) |
| `order_status_logs` | Order status change audit trail |
| `delivery_negotiations` | Delivery cost negotiation state per order |
| `delivery_rounds` | Individual quote/counter-quote rounds |
| `wallets` | User wallet balances |
| `transactions` | Wallet transaction history |
| `kyc_documents` | KYC document uploads |
| `kyb_documents` | KYB document uploads |
| `depot_members` | Team members per depot |
| `notification_log` | Notification delivery history |
| `price_history` | Historical product price data |

### 6.2 Storage Buckets

| Bucket | Purpose | Access |
|--------|---------|--------|
| `kyc-documents` | KYC verification documents | Private (signed URLs) |
| `kyb-documents` | KYB verification documents | Private (signed URLs) |

### 6.3 Real-time Subscriptions

The platform uses Supabase Realtime for live updates on:
- Order status changes (buyer and depot views)
- Depot inbox (new incoming orders)
- Profile changes

---

## 7. Technical Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 7 |
| Styling | Tailwind CSS v4 + inline styles (design tokens) |
| Routing | React Router v7 (BrowserRouter, code-split routes) |
| State | Zustand v5 (authStore, ventrylStore) |
| Charts | Recharts v3 |
| Backend | Supabase (PostgreSQL + Auth + Storage + Realtime + Edge Functions) |
| Payments | Paystack (wallet funding) |
| Hosting | Vercel (SPA with rewrites) |
| Testing | Vitest + React Testing Library (33 tests, 6 suites) |

### 7.1 Architecture

```
src/
  App.jsx                    — Root component (auth gate, loading screen)
  main.jsx                   — Entry point (BrowserRouter wrapper)
  screens/                   — 20 screen components (lazy-loaded via React.lazy)
    VentrylPlatform.jsx      — Platform shell (sidebar, topbar, routes, ErrorBoundary)
    Auth.jsx                 — Login / Signup / Forgot Password
    UnifiedDash.jsx          — Dashboard
    BuyerMarketplace.jsx     — Price Discovery
    OrderFlow.jsx            — Place Order wizard
    OrdersListView.jsx       — My Orders list
    BuyerOrderDetail.jsx     — Buyer order detail + DisputeModal
    BuyerWallet.jsx          — Wallet & funding
    DepotDetailView.jsx      — Depot management (tabbed)
    DepotOrderDetail.jsx     — Depot-side order management
    CreateDepotFlow.jsx      — Depot creation wizard
    SettingsModule.jsx       — Settings (profile, KYC, notifications, security)
    AdminPanel.jsx           — Admin panel
    DepotInbox.jsx           — Depot order inbox
    DepotDash.jsx            — Depot dashboard
    DepotKYBView.jsx         — KYB document upload
    TruckSched.jsx           — Truck scheduling
    BuyerNetwork.jsx         — Buyer network
    TeamSettings.jsx         — Team management
    BuyerDash.jsx            — Buyer-specific dashboard
  components/
    shared/index.jsx         — Badge, Card, KpiCard, SectionHead, Topbar, Sidebar, Icon
    shared/OrderWidgets.jsx  — MarketPulseWidget, OrderInboxPanel
    layout/PlatformSidebar.jsx — Navigation sidebar (desktop + mobile bottom bar)
  store/
    authStore.js             — Authentication state (Zustand)
    ventrylStore.js          — Application data state (Zustand)
  context/
    DepotContext.js           — React Context for depot data in nested routes
  lib/
    api.js                   — API service layer (all Supabase operations)
    supabase.js              — Supabase client initialization
    tokens.js                — Design tokens (colors, fonts, global styles)
    ngStates.js              — All 37 Nigerian states + 774 LGAs
    sessionCache.js          — Module-level session caches (8 stores)
    documents.js             — Waybill and invoice generation
    payment.js               — Paystack integration
    realtime.js              — Supabase Realtime subscription hooks
  hooks/
    useBreakpoint.js         — Responsive breakpoint hook (mobile/tablet/desktop)
  test/
    6 test suites, 33 tests  — Tokens, states, cache, store adapters, API state machine, components
```

---

## 8. Design System

### 8.1 Colors

| Token | Hex | Usage |
|-------|-----|-------|
| black | #000000 | Primary text, hero backgrounds |
| white | #FFFFFF | Card backgrounds |
| green | #06C167 | Primary accent, success, CTAs |
| greenLight | #E6F9F1 | Success badges background |
| greenDark | #038C48 | Success badge text |
| gray50 | #FAFAFA | Page background |
| gray100 | #F5F5F5 | Borders, dividers |
| gray200 | #E5E5E5 | Subtle borders |
| gray400 | #9CA3AF | Secondary text, labels |
| gray600 | #4B5563 | Muted text |
| red | #F23333 | Error, destructive actions |
| amber | #FFAB00 | Warnings, pending states |
| blue | #0057FF | Info, in-transit status |

### 8.2 Typography

- **Font Family**: Manrope (Google Fonts, preloaded)
- **Weights**: 600 (body), 700 (labels), 800 (headings, values)
- **Text Transform**: Uppercase + letter-spacing for labels

### 8.3 Status Badge Colors

| Status | Background | Text | Meaning |
|--------|-----------|------|---------|
| Pending | gray | gray | Awaiting action |
| Confirmed | amber | dark amber | Depot confirmed |
| Loading | gray | gray | At loading bay |
| In Transit | blue | blue | Trucks dispatched |
| Delivered | green | green | Delivery complete |
| Collected | green | green | Self-pickup complete |
| Disputed | red | red | Under dispute |
| Available | green | green | Open for orders |

---

## 9. Security & Compliance

### 9.1 Authentication

- Supabase Auth (email/password)
- Email verification required
- Password reset via email link
- Persistent sessions with auto-refresh tokens
- Auth state subscription for real-time session updates

### 9.2 Verification Layers

- **KYC (Know Your Customer)**: Individual/company identity verification before depot creation
- **KYB (Know Your Business)**: Depot-level verification with DPR licensing before marketplace listing

### 9.3 Data Security

- Supabase Row-Level Security (RLS) policies on all tables
- Private storage buckets with time-limited signed URLs for document access
- Client-side state machine mirrors server-side DB triggers
- No secrets exposed in client bundle (anon key is public by design)

### 9.4 Financial Controls

- Escrow-based payment flow (hold → release/refund)
- Wallet balance validation before order placement
- Platform fee and VAT calculated server-side (to be migrated from client)
- Full transaction audit trail

---

## 10. Nigerian Market Context

### 10.1 Regulatory

- DPR (Department of Petroleum Resources) licensing for depot operations
- NMDPRA (Nigerian Midstream and Downstream Petroleum Regulatory Authority) compliance
- CAC (Corporate Affairs Commission) registration for business verification
- VAT at 7.5% (FIRS standard rate)

### 10.2 Logistics

- Standard truck capacity: 33,000 litres (bridger truck)
- Truck count auto-calculated from order volume
- Delivery coverage: All 36 states + FCT
- SLA: 2-hour response window for depot order confirmation

### 10.3 Currency

- All transactions in Nigerian Naira (NGN / ₦)
- Locale: `en-NG` for number and date formatting
- Payment gateway: Paystack (Nigerian payment processor)

---

## 11. Roadmap (Planned)

| Feature | Priority | Status |
|---------|----------|--------|
| Server-side price/fee calculations | High | Planned |
| Push notifications (FCM) | High | Planned |
| GPS truck tracking integration | High | Planned |
| Multi-currency support (USD for ATK) | Medium | Planned |
| Depot analytics dashboard | Medium | Planned |
| Buyer credit/financing | Medium | Planned |
| Mobile app (React Native) | Medium | Planned |
| Automated price indexing | Low | Planned |
| API for third-party integrations | Low | Planned |
| Depot rating and review system | Low | Planned |

---

## 12. Glossary

| Term | Definition |
|------|-----------|
| Depot | A petroleum storage facility / tank farm |
| KYC | Know Your Customer — identity verification for individuals |
| KYB | Know Your Business — business verification for depots |
| DPR | Department of Petroleum Resources (now NMDPRA) |
| SLA | Service Level Agreement — time window for depot to respond to an order |
| Escrow | Funds held by the platform during order fulfillment |
| Bridger | Standard petroleum tanker truck (33,000L capacity) |
| VTL | Ventryl order ID prefix (e.g., VTL-01001) |
| LGA | Local Government Area — administrative subdivision of Nigerian states |
| CAC | Corporate Affairs Commission — Nigerian business registration body |
