# Practitioner UUIDs Fixos

Este documento lista os UUIDs fixos usados para os practitioners. Esses UUIDs **nunca mudam**, garantindo estabilidade na configuração.

## UUIDs dos Practitioners

| Nome | UUID | UUID sem hífens |
|------|------|-----------------|
| Dr. Sarah Johnson | `550e8400-e29b-41d4-a716-446655440421` 
| Dr. Michael Chen | `550e8400-e29b-41d4-a716-446655443462` 
| Emma Wilson | `550e8400-e29b-41d4-a716-446655440235` 

## Configuração Cal.com

o eventType foi configurado da seguinte maneira: 
### Opção escolhida: Por UUID completo (sem hífens)
Se você precisar de event types diferentes para cada practitioner:

```env
CALCOM_USER_ID=your_user_id
CALCOM_EVENT_TYPE_550e8400e29b41d4a716446655440001=eventTypeid  # Dr. Sarah Johnson
CALCOM_EVENT_TYPE_550e8400e29b41d4a716446655440002=  # Dr. Michael Chen
CALCOM_EVENT_TYPE_550e8400e29b41d4a716446655440003=  # Emma Wilson
```

## Nota Importante

⚠️ **Esses UUIDs são fixos e nunca mudam**, mesmo quando você recria o banco de dados usando `pnpm run db:reset` ou `pnpm run db:seed`.

O script de seed (`scripts/db.ts`) sempre usa esses mesmos UUIDs, garantindo que você não precise reconfigurar as variáveis de ambiente a cada reset do banco.

git commit -m "feat(db): use fixed UUIDs for practitioners and auto-update existing records

This change introduces fixed UUIDs for practitioners to ensure stable and predictable
identifiers across database resets, seeds, and environments.

### Why
Previously, practitioner UUIDs were regenerated on each seed, causing:
- Broken Cal.com event type mappings
- Need to reconfigure environment variables after every DB reset
- Instability between local, staging, and production environments

### What was implemented

#### 1. Fixed UUIDs for practitioners
- Defined constant UUIDs for each practitioner:
  - Dr. Sarah Johnson: 550e8400-e29b-41d4-a716-446655440001
  - Dr. Michael Chen: 550e8400-e29b-41d4-a716-446655440002
  - Emma Wilson: 550e8400-e29b-41d4-a716-446655440003
- Same UUIDs are used consistently in:
  - Database seed (scripts/db.ts)
  - Mock / server-side data
- UUIDs remain the same even after recreating the database

#### 2. Automatic migration for existing data
- If practitioners already exist with different UUIDs:
  - The seed script updates them to the fixed UUIDs
  - All related bookings are updated accordingly
- Referential integrity is preserved at all times

#### 3. Improved seed behavior and logs
- Seed detects whether practitioners already exist
- Prints clear logs showing:
  - Practitioner UUIDs
  - Recommended Cal.com environment variable configuration
- Supports both:
  - CALCOM_EVENT_TYPE_DEFAULT (recommended)
  - CALCOM_EVENT_TYPE_<UUID_WITHOUT_HYPHENS> (per practitioner)

#### 4. Documentation
- Added PRACTITIONER_UUIDS.md containing:
  - Fixed UUIDs (with and without hyphens)
  - Examples of Cal.com configuration
  - Recommendation to use default event type when possible

### Result
- Stable and predictable practitioner IDs
- No need to reconfigure Cal.com after DB resets
- Safer local development and deployments
- Database can be recreated freely without breaking integrations"

