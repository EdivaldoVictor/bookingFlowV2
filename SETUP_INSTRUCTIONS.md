# Setup Instructions - BookingFlow Application

## Quick Start (5 minutos)

### 1. Instalar Dependências

```bash
pnpm install
```

### 2. Configurar Banco de Dados

```bash
# Criar as tabelas no banco de dados PostgreSQL
pnpm db:push
```

### 3. Popular Dados de Exemplo (Practitioners)

```bash
# Seed practitioners no banco de dados
pnpm db:seed
```

### 4. Executar Testes

```bash
# Rodar todos os testes (deve passar com 17 testes)
pnpm test
```

### 5. Iniciar Servidor de Desenvolvimento

```bash
pnpm dev
```

A aplicação estará disponível em `http://localhost:3000`

**A página inicial agora busca practitioners do banco de dados automaticamente!** 🎉

---

## Troubleshooting

### Erro: "Practitioner not found" ao rodar testes

**Causa:** O banco de dados não foi seeded com dados de practitioners.

**Solução:**

```bash
# Execute o script de seed
npx tsx scripts/seed-db.ts

# Depois rode os testes novamente
pnpm test
```

### Erro: "Cannot find module" ao rodar seed script

**Causa:** Dependências não instaladas.

**Solução:**

```bash
pnpm install
npx tsx scripts/seed-db.ts
```

### Erro: "ECONNREFUSED" ao conectar ao banco de dados

**Causa:** Banco de dados PostgreSQL não está acessível ou DATABASE_URL está incorreta.

**Solução:**

1. Certifique-se de que PostgreSQL está rodando ou use Neon (cloud)
2. Verifique `.env` tem a DATABASE_URL correta
3. Exemplo Neon: `DATABASE_URL=postgresql://user:password@host/database?sslmode=require`
4. Exemplo local: `DATABASE_URL=postgresql://user:password@localhost:5432/booking_db`

---

## Variáveis de Ambiente Necessárias

Crie um arquivo `.env` na raiz do projeto (exemplo já existe como `.env.example`):

```env
# Banco de Dados PostgreSQL (obrigatório)
DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# Cal.com Integration (já configurado - funciona com API real)
CALCOM_API_KEY=cal_live_e0a3714f1b10d5da9a7c5384777535e3
CALCOM_API_URL=https://api.cal.com/v1
CALCOM_USER_ID_1=1967202
CALCOM_EVENT_TYPE_1=4071936

# Stripe (opcional - mock funciona sem isso)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...

# JWT e Sessões (já configurados)
JWT_SECRET=your-jwt-secret-here
SESSION_SECRET=your-session-secret-here

# Aplicação
BASE_URL=http://localhost:3000
PORT=3000
NODE_ENV=development
```

---

## Fluxo de Desenvolvimento

### 1. Desenvolver Novas Features

```bash
# Iniciar servidor com hot reload
pnpm dev
```

### 2. Atualizar Schema do Banco

```bash
# Editar drizzle/schema.ts
# Depois executar:
pnpm db:push
```

### 3. Testar Mudanças

```bash
# Rodar todos os testes
pnpm test

# Ou rodar testes específicos
pnpm test server/bookings.test.ts
```

### 4. Build para Produção

```bash
pnpm build
NODE_ENV=production pnpm start
```

---

## Estrutura do Projeto

```
vite-express-booking/
├── client/                 # Frontend React 19 + Vite
│   └── src/
│       ├── pages/         # Páginas (Home, BookingPage, BookingSuccess)
│       ├── components/    # Componentes UI + shadcn/ui
│       └── App.tsx        # Roteamento com Wouter
├── server/                # Backend Node.js + Express + tRPC
│   ├── _core/             # Configurações centrais
│   ├── routers.ts         # APIs tRPC (bookings, auth)
│   ├── db.ts              # Queries PostgreSQL com Drizzle
│   └── services/          # Serviços externos
│       ├── availability.ts # Cal.com API (REAL)
│       └── stripe.ts      # Stripe API (MOCK - pending real)
├── drizzle/               # PostgreSQL ORM
│   ├── schema.ts          # Definição das tabelas
│   └── migrations/        # Scripts de migração
├── scripts/               # Utilitários
│   └── db.ts              # Setup e seed do banco
├── shared/                # Código compartilhado
├── todo.md                # Lista de tarefas pendentes
├── README.md              # Documentação geral
├── TECHNICAL_DECISIONS.md # Arquitetura e decisões
├── POSTGRESQL_MIGRATION.md# Guia de migração
└── SETUP_INSTRUCTIONS.md  # Este arquivo
```

---

## Status Atual do Projeto

### ✅ Implementado
- **Cal.com Integration:** Real API funcionando com dados reais
- **Database:** PostgreSQL/Neon completamente configurado
- **Booking System:** Fluxo completo de reserva funcionando
- **Testing:** 17 testes passando
- **Documentation:** Completa em README.md e TECHNICAL_DECISIONS.md

### ⚠️ Próximo Passo Crítico - Integração com Stripe Real

1. Obter chaves de teste em https://dashboard.stripe.com
2. Adicionar `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` ao `.env`
3. Configurar Stripe CLI para testar webhooks localmente
4. Seguir guia completo em `STRIPE_WEBHOOK_TESTING.md`

### Deploy para Produção

1. Configurar variáveis de ambiente no servidor
2. Executar `pnpm build`
3. Executar `NODE_ENV=production pnpm start`
4. Configurar webhook URL do Stripe para produção

---

## Dúvidas?

Consulte:

- `README.md` - Documentação geral e features
- `TECHNICAL_DECISIONS.md` - Arquitetura e integrações
- `todo.md` - Status atual e próximos passos
- `server/bookings.test.ts` - Exemplos de uso das APIs
- `POSTGRESQL_MIGRATION.md` - Setup avançado do banco

### Suporte

- **Cal.com Real:** ✅ Funcionando com API real
- **Database:** ✅ PostgreSQL/Neon configurado
- **Testing:** ✅ 17 testes passando
- **Stripe:** ⚠️ Próxima prioridade crítica

---

**Última atualização:** Dezembro 2025
**Versão:** 2.0.0 (Cal.com Real Integration)
**Status:** 95% Completo - Aguardando Stripe Real
