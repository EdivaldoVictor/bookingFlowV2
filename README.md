# BookingFlow - Fast Appointment Booking with Payment

Application deployed on Render URL: https://bookingflowv2.onrender.com/
REAL STRIPE API, NOT THE TEST ONE PROCCESING REAL PAYMENT, CONFIGURED MY STRIPE ACCOUNT AND MY BANK ACCOUNT.

A modern booking-flow application built with **Vite + React + Express + tRPC**, featuring real **Stripe payments** and **Cal.com availability + booking creation**.

Complete a full booking flow in **2–3 minutes** with:

* real-time availability
* secure payments
* automatic event creation
* webhooks
* PostgreSQL database

> **Architecture:** Hybrid Vite + Express setup for the best development experience (HMR) and production-ready backend performance.

---

## 🚀 Quick Start (< 5 minutes)

### **Prerequisites**

* Node.js 18+ and pnpm
* PostgreSQL (Neon recommended)
* Stripe account + API keys
* Cal.com account + API key

### **Installation**

```bash
pnpm install
pnpm db:reset
pnpm dev
```

App available at: **[http://localhost:3000](http://localhost:3000)**

---

## 📁 Project Structure

```
vite-express-booking/
├── client/                           # Vite + React frontend
│   └── src/
│       ├── pages/
│       │   ├── Home.tsx
│       │   ├── BookingPage.tsx
│       │   └── BookingSuccess.tsx
│       ├── App.tsx
│       └── lib/trpc.ts
├── server/                           # Express + tRPC backend
│   ├── _core/
│   │   ├── index.ts
│   │   ├── vite.ts
│   │   └── context.ts
│   ├── routers.ts                    # tRPC procedures
│   ├── db.ts                         # PostgreSQL + fallback
│   └── services/
│       ├── availability.ts           # Cal.com integration
│       └── stripe.ts                 # Stripe checkout + webhook
├── scripts/db.ts                     # Full DB setup
├── drizzle/                          # ORM schema + migration
├── dist/                             # Production build output
└── TECHNICAL_DECISIONS.md
```

---

## ⭐ Features

### **Core Functionality**

* Practitioner listing with prices
* Real availability from Cal.com
* 14-day slot selection
* Booking form with details
* Stripe real payment checkout
* Webhook confirmation
* Automatic Cal.com event creation
* Confirmation page with real-time status

### **Technical Features**

* End-to-end **type safety** (tRPC + TypeScript)
* Modern frontend: **Vite + React + Tailwind**
* Backend: **Express + tRPC**
* Database: **PostgreSQL + Drizzle**
* Smart fallbacks when APIs fail
* Full Stripe + Cal.com integration
* Real-time sync between frontend and backend
* One-command DB setup

---

## 📦 Available Scripts

```bash
pnpm dev
pnpm build
pnpm start
pnpm db:reset
pnpm db:setup
pnpm db:seed
pnpm check
pnpm test
```

---

## 🔌 API Routes (tRPC)

All endpoints are available under **/api/trpc**.

### **bookings.getAvailability**

Returns practitioner info + time slots.

### **bookings.createBooking**

Creates DB record + Stripe checkout session.

### **bookings.confirmBooking**

Confirms booking after webhook.

---

## 🗄️ Database Schema (PostgreSQL)

Two tables:

* **practitioners**
* **bookings**

Schema includes: pricing, timestamps, statuses, Stripe IDs, and practitioner mapping.

---

## 🔧 Configuration

Create `.env.local`:

```env
DATABASE_URL=...

CALCOM_API_KEY=...
CALCOM_API_URL=https://api.cal.com/v2
CALCOM_USER_ID=1967202
CALCOM_EVENT_TYPE_1=4071936
CALCOM_EVENT_TYPE_2=...

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
BASE_URL=http://localhost:3000
```

---

## 🧩 Integration Guides

### Stripe

* real Stripe integration
* Configure webhook
* Validate events

### Cal.com

* Real availability
* Map event types per practitioner
* Automatic event creation after payment confirmation
* Fallback when Cal.com is unreachable

---

## 🧪 Testing

### Manual

* Book appointments end-to-end
* Webhook confirmation
* Availability fetching

### API

Use curl to test tRPC endpoints.

---

## 🛠️ Troubleshooting

* Database connection errors
* Missing environment vars
* Stripe checkout failures
* Cal.com "Invalid event length"

Full debugging guide in `TECHNICAL_DECISIONS.md`.

---

## 🏗️ Architecture Overview

### Hybrid Architecture

* **Dev mode:** Express + Vite HMR on the same port
* **Prod mode:** Static frontend + Express API

### Data Flow

```
User → Express → tRPC → DB/Cal/Stripe → Response
```

---

## 🔐 Security

* Zod validation
* Secure env vars
* PostgreSQL parameterized queries
* Proper webhook signature validation

🧩 SOLID Principles in This Project

This project follows SOLID to keep the architecture clean, modular, and scalable.

S — Single Responsibility

Each module has one job:

tRPC routers are separated by domain (booking, availability, practitioner).

External integrations (Cal.com, Stripe) live in isolated service modules.

O — Open/Closed

You can add new routers, procedures, or integrations without modifying existing logic thanks to the service-based structure.

L — Liskov Substitution

Service modules follow replaceable internal interfaces (e.g., scheduling provider, payment provider), allowing integrations to be swapped without breaking the app.

I — Interface Segregation

Routers are small and focused. Each service only exposes what is necessary — no bloated APIs.

D — Dependency Inversion

Routers depend on internal abstractions (services), not external SDKs. Stripe, Cal, and Prisma remain fully decoupled from business logic.

---

## 🚀 Deployment

```bash
pnpm build
NODE_ENV=production pnpm start
```

* Setup env vars
* Configure Stripe webhook URL
* Configure Cal.com API

---

## 📄 License

MIT

## Contact

For help, open an issue or consult `TECHNICAL_DECISIONS.md`.

---

**Status:** Production Ready

**Version:** 1.1.0

**Last Updated:** December 2025
