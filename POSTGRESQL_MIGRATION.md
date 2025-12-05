# PostgreSQL Migration Guide

This document describes the migration from MySQL to PostgreSQL and the implementation of real integrations.

## Changes Made

### 1. Database Migration (MySQL → PostgreSQL)

#### Schema Changes

**Before (MySQL):**

```typescript
import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
```

**After (PostgreSQL):**

```typescript
import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
```

Key differences:

- `int()` → `integer()`
- `mysqlTable()` → `pgTable()`
- `mysqlEnum()` → `pgEnum()` (defined separately)
- `autoincrement()` → `generatedAlwaysAsIdentity()`
- `onUpdateNow()` removed (PostgreSQL doesn't support automatic timestamp updates)

#### Database Connection

**Before (MySQL):**

```typescript
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

const pool = await mysql.createPool({ uri: process.env.DATABASE_URL });
const db = drizzle(pool);
```

**After (PostgreSQL):**

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);
```

#### Upsert Syntax

**Before (MySQL):**

```typescript
await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
```

**After (PostgreSQL):**

```typescript
await db.insert(users).values(values).onConflictDoUpdate({
  target: users.openId,
  set: updateSet,
});
```

#### Returning Values

PostgreSQL supports `RETURNING` clause:

```typescript
const result = await db.insert(bookings).values(booking).returning();
return result[0]; // Returns the inserted row with generated ID
```

### 2. Real Stripe Integration

#### Implementation

**File:** `server/services/stripe.ts`

Replaced mock implementation with real Stripe SDK:

```typescript
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

export async function createCheckoutSession(params) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [...],
    mode: "payment",
    customer_email: params.clientEmail,
    metadata: { bookingId: params.bookingId.toString() },
    success_url: `${BASE_URL}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${BASE_URL}/booking/cancel`,
  });

  return session;
}
```

#### Webhook Handler

**File:** `server/_core/webhooks.ts`

New webhook endpoint for Stripe events:

```typescript
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    const event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      webhookSecret
    );

    if (event.type === "checkout.session.completed") {
      // Update booking status to confirmed
      await updateBookingStatus(bookingId, "confirmed");
    }

    res.json({ received: true });
  }
);
```

**Important:** Webhook route must be registered BEFORE the JSON body parser middleware.

### 3. Real Cal.com Integration

#### Implementation

**File:** `server/services/availability.ts`

Added real Cal.com API integration with mock fallback:

```typescript
async function getCalComAvailability(practitionerId: number) {
  const apiKey = process.env.CALCOM_API_KEY;

  if (!apiKey) {
    return getMockAvailability(practitionerId); // Fallback
  }

  try {
    const response = await axios.get(`${CALCOM_API_URL}/availability`, {
      params: {
        userId: calComUserId,
        eventTypeId: eventTypeId,
        dateFrom: startDate.toISOString(),
        dateTo: endDate.toISOString(),
      },
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    // Process busy slots and generate available slots
    return processAvailability(response.data);
  } catch (error) {
    console.error("Cal.com API error:", error);
    return getMockAvailability(practitionerId); // Fallback on error
  }
}
```

#### Practitioner Mapping

Map practitioner IDs to Cal.com users via environment variables:

```env
CALCOM_USER_ID_1=user-id-for-practitioner-1
CALCOM_EVENT_TYPE_1=30min
CALCOM_USER_ID_2=user-id-for-practitioner-2
CALCOM_EVENT_TYPE_2=60min
```

### 4. Updated Dependencies

#### Added Packages

```json
{
  "dependencies": {
    "pg": "^8.13.1",
    "stripe": "^17.5.0"
  },
  "devDependencies": {
    "@types/pg": "^8.11.10"
  }
}
```

#### Removed Packages

- `mysql2` (replaced with `pg`)

## Environment Variables

### Required

```env
# Database (PostgreSQL)
DATABASE_URL=postgresql://user:password@host:port/database

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Manus OAuth
MANUS_OAUTH_CLIENT_ID=...
MANUS_OAUTH_CLIENT_SECRET=...
OWNER_OPEN_ID=...

# Application
BASE_URL=http://localhost:3000
```

### Optional (Cal.com)

```env
CALCOM_API_KEY=your_api_key
CALCOM_API_URL=https://api.cal.com/v1
CALCOM_USER_ID_1=user-id-1
CALCOM_EVENT_TYPE_1=30min
```

If Cal.com variables are not set, the system falls back to mock availability data.

## Setup Instructions

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
# Edit .env.local with your credentials
```

### 3. Setup PostgreSQL Database

Create a PostgreSQL database:

```sql
CREATE DATABASE booking_db;
```

Update `DATABASE_URL` in `.env.local`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/booking_db
```

### 4. Run Migrations

```bash
pnpm db:push
```

This will:

1. Generate migration files in `drizzle/`
2. Apply migrations to your PostgreSQL database
3. Create tables: `users`, `practitioners`, `bookings`

### 5. Seed Database

```bash
pnpm tsx scripts/seed-db.ts
```

This creates sample practitioners in the database.

### 6. Configure Stripe Webhooks

#### Local Development

Use Stripe CLI to forward webhooks:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the webhook signing secret to `.env.local`:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

#### Production

1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://yourdomain.com/api/webhooks/stripe`
3. Select event: `checkout.session.completed`
4. Copy signing secret to production environment

### 7. Start Development Server

```bash
pnpm dev
```

## Testing

### Database Connection

```bash
# Test PostgreSQL connection
psql $DATABASE_URL -c "SELECT version();"
```

### Stripe Integration

1. Create a test booking
2. Use Stripe test card: `4242 4242 4242 4242`
3. Check webhook logs: `stripe listen`
4. Verify booking status updated to "confirmed"

### Cal.com Integration

Set `CALCOM_API_KEY` and test availability endpoint:

```bash
curl http://localhost:3000/api/trpc/bookings.getAvailability?input=%7B%22practitionerId%22:1%7D
```

Without API key, it falls back to mock data automatically.

## Migration Checklist

- [x] Update schema from MySQL to PostgreSQL types
- [x] Update database connection from mysql2 to pg
- [x] Update Drizzle config dialect to postgresql
- [x] Implement real Stripe checkout session creation
- [x] Implement Stripe webhook handler
- [x] Implement real Cal.com availability API
- [x] Add fallback to mock data when Cal.com unavailable
- [x] Update package.json dependencies
- [x] Generate fresh PostgreSQL migrations
- [x] Update seed script for PostgreSQL
- [x] Create .env.example with all variables
- [x] Update server to register webhook routes
- [x] Test TypeScript compilation

## Troubleshooting

### Database Connection Error

```
Error: connect ECONNREFUSED
```

**Solution:** Verify PostgreSQL is running and DATABASE_URL is correct.

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test connection
psql $DATABASE_URL
```

### Stripe Webhook Signature Verification Failed

```
Error: Webhook signature verification failed
```

**Solution:** Ensure STRIPE_WEBHOOK_SECRET matches the secret from Stripe CLI or Dashboard.

### Cal.com API Error

```
Error: Failed to fetch from Cal.com
```

**Solution:** The system automatically falls back to mock data. Check:

- CALCOM_API_KEY is valid
- CALCOM_API_URL is correct
- Cal.com service is accessible

### TypeScript Errors

```bash
# Run type checking
pnpm check

# Fix common issues
pnpm format
```

## Rollback Plan

If you need to rollback to MySQL:

1. Restore original files from git:

   ```bash
   git checkout HEAD -- drizzle/schema.ts server/db.ts drizzle.config.ts
   ```

2. Reinstall MySQL dependencies:

   ```bash
   pnpm add mysql2
   pnpm remove pg @types/pg
   ```

3. Restore MySQL migrations:
   ```bash
   git checkout HEAD -- drizzle/
   ```

## Performance Considerations

### PostgreSQL vs MySQL

- **Auto-increment:** PostgreSQL uses sequences (more efficient for high concurrency)
- **UPSERT:** PostgreSQL `ON CONFLICT` is more flexible than MySQL `ON DUPLICATE KEY`
- **JSON:** PostgreSQL has better JSON support (useful for future features)
- **Full-text search:** PostgreSQL has built-in full-text search

### Stripe Webhooks

- Webhook endpoint must respond within 30 seconds
- Use async processing for long-running tasks
- Return 200 immediately, process in background

### Cal.com API

- Cache availability data (5-15 minutes)
- Use fallback to mock data on API errors
- Implement retry logic with exponential backoff

## Security Notes

### Database

- Use connection pooling (already configured)
- Never expose DATABASE_URL in client code
- Use parameterized queries (Drizzle handles this)

### Stripe

- Verify webhook signatures (implemented)
- Use test keys in development
- Never log full API keys

### Cal.com

- Store API keys in environment variables
- Use HTTPS for API calls
- Implement rate limiting

## Next Steps

1. **Email Notifications:** Send confirmation emails after booking
2. **Calendar Integration:** Create Cal.com bookings automatically
3. **Refund Handling:** Implement cancellation and refund flow
4. **Admin Dashboard:** Build admin interface for managing bookings
5. **Monitoring:** Add logging and error tracking (Sentry, DataDog)

## Support

For questions or issues:

1. Check this migration guide
2. Review `README.md` for general setup
3. Check `TECHNICAL_DECISIONS.md` for architecture details
4. Contact development team

---

**Migration Date:** December 2024  
**Status:** ✅ Complete  
**Database:** PostgreSQL  
**Integrations:** Stripe (Real), Cal.com (Real with Mock Fallback)
