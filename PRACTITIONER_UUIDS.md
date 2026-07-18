# Practitioner UUIDs Fixos

Este documento lista o UUID fixo usado para o practitioner Bispo barber. Esse UUID **não muda**, garantindo estabilidade na configuração.

## UUID do Practitioner

| Nome | UUID | UUID sem hífens |
|------|------|-----------------|
| Bispo barber | `550e8400-e29b-41d4-a716-446655440421` | `550e8400e29b41d4a716446655440421` |

## Configuração Cal.com

O event type pode ser configurado assim:

```env
CALCOM_USER_ID=your_user_id
CALCOM_EVENT_TYPE_550e8400e29b41d4a716446655440421=eventTypeid
```

## Nota Importante

⚠️ **Esse UUID é fixo e nunca muda**, mesmo quando você recria o banco de dados usando `pnpm run db:reset` ou `pnpm run db:seed`.

O script de seed (`scripts/db.ts`) usa esse mesmo UUID, garantindo que você não precise reconfigurar as variáveis de ambiente a cada reset do banco.

