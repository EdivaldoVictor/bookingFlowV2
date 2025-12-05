# Setup Instructions - BookingFlow Application

## Quick Start (5 minutos)

### 1. Instalar Dependências

```bash
pnpm install
```

### 2. Configurar Banco de Dados

```bash
# Criar as tabelas no banco de dados
pnpm db:push
```

### 3. Popular Dados de Exemplo (Practitioners)

```bash
# Seed practitioners no banco de dados
npx tsx scripts/seed-db.ts
```

### 4. Executar Testes

```bash
# Rodar todos os testes (deve passar com 14 testes)
pnpm test
```

### 5. Iniciar Servidor de Desenvolvimento

```bash
pnpm dev
```

A aplicação estará disponível em `http://localhost:3000`

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

**Causa:** Banco de dados MySQL não está rodando ou DATABASE_URL está incorreta.

**Solução:**

1. Certifique-se de que MySQL está rodando
2. Verifique `.env.local` tem a DATABASE_URL correta
3. Exemplo: `DATABASE_URL=mysql://user:password@localhost:3306/booking_db`

---

## Variáveis de Ambiente Necessárias

Crie um arquivo `.env.local` na raiz do projeto:

```env
# Banco de Dados (obrigatório)
DATABASE_URL=mysql://user:password@localhost:3306/booking_db

# Stripe (opcional - mock funciona sem isso)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...

# OAuth Manus (opcional para desenvolvimento local)
VITE_OAUTH_PORTAL_URL=https://...
OAUTH_SERVER_URL=https://...
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
nextjs-app-router-project/
├── client/                 # Frontend React
│   └── src/
│       ├── pages/         # Páginas (Home, BookingPage, BookingSuccess)
│       ├── components/    # Componentes reutilizáveis
│       └── App.tsx        # Roteamento
├── server/                # Backend Node.js + tRPC
│   ├── routers.ts         # APIs tRPC
│   ├── db.ts              # Queries do banco
│   └── services/          # Serviços (availability, stripe)
├── drizzle/               # ORM e migrações
│   └── schema.ts          # Definição das tabelas
├── scripts/               # Scripts utilitários
│   └── seed-db.ts         # Popular banco com dados
├── README.md              # Documentação geral
├── TECHNICAL_DECISIONS.md # Decisões arquiteturais
└── SETUP_INSTRUCTIONS.md  # Este arquivo
```

---

## Próximos Passos

### Integração com Stripe Real

1. Obter chaves de teste em https://dashboard.stripe.com
2. Adicionar `STRIPE_SECRET_KEY` e `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` ao `.env.local`
3. Seguir guia em `TECHNICAL_DECISIONS.md` Seção 3

### Integração com Cal.com Real

1. Configurar Cal.com em https://cal.com
2. Gerar API key
3. Seguir guia em `TECHNICAL_DECISIONS.md` Seção 2

### Deploy para Produção

1. Configurar variáveis de ambiente no servidor
2. Executar `pnpm build`
3. Executar `NODE_ENV=production pnpm start`
4. Configurar webhook URL do Stripe

---

## Dúvidas?

Consulte:

- `README.md` - Documentação geral
- `TECHNICAL_DECISIONS.md` - Arquitetura e integração
- `server/bookings.test.ts` - Exemplos de como usar as APIs

---

**Última atualização:** Dezembro 2024
**Versão:** 1.0.0
