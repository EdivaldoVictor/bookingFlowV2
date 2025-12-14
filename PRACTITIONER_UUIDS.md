# Practitioner UUIDs Fixos

Este documento lista os UUIDs fixos usados para os practitioners. Esses UUIDs **nunca mudam**, garantindo estabilidade na configuração.

## UUIDs dos Practitioners

| Nome | UUID | UUID sem hífens |
|------|------|-----------------|
| Dr. Sarah Johnson | `550e8400-e29b-41d4-a716-446655440001` | `550e8400e29b41d4a716446655440001` |
| Dr. Michael Chen | `550e8400-e29b-41d4-a716-446655440002` | `550e8400e29b41d4a716446655440002` |
| Emma Wilson | `550e8400-e29b-41d4-a716-446655440003` | `550e8400e29b41d4a716446655440003` |

## Configuração Cal.com

Você pode configurar os event types do Cal.com de duas formas:

### Opção 1: Event Type Padrão (Recomendado) ⭐
Use um event type padrão para todos os practitioners. Esta é a opção mais simples:

```env
CALCOM_USER_ID=your_user_id
CALCOM_EVENT_TYPE_DEFAULT=4071936
```

### Opção 2: Por UUID completo (sem hífens)
Se você precisar de event types diferentes para cada practitioner:

```env
CALCOM_USER_ID=your_user_id
CALCOM_EVENT_TYPE_550e8400e29b41d4a716446655440001=4071936  # Dr. Sarah Johnson
CALCOM_EVENT_TYPE_550e8400e29b41d4a716446655440002=4071937  # Dr. Michael Chen
CALCOM_EVENT_TYPE_550e8400e29b41d4a716446655440003=4071938  # Emma Wilson
```

## Nota Importante

⚠️ **Esses UUIDs são fixos e nunca mudam**, mesmo quando você recria o banco de dados usando `pnpm run db:reset` ou `pnpm run db:seed`.

O script de seed (`scripts/db.ts`) sempre usa esses mesmos UUIDs, garantindo que você não precise reconfigurar as variáveis de ambiente a cada reset do banco.
