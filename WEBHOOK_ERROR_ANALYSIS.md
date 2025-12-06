# 🔍 Análise de Erros nos Webhooks Stripe

## 📋 **PROBLEMAS IDENTIFICADOS NOS 3 LOGS**

### **❌ Problema 1: Erro de Parse - Arquivo Stripe Binário**

**Log (Terminal 7):**
```
Error: Parse error /home/victor-dev/booking-flow-vite-express/project/vite-express-booking/stripe:1:529
```

**Causa:**
- O arquivo binário `stripe` foi colocado dentro da pasta do projeto
- O `tsx watch` está tentando parsear o binário como código TypeScript
- Binários não podem ser parseados como código

**Solução:**
1. Remover o arquivo `stripe` da pasta do projeto
2. Adicionar `stripe` ao `.gitignore`
3. O Stripe CLI deve estar em `/usr/local/bin/stripe` (já feito)

**Comando:**
```bash
# Remover da pasta do projeto
rm project/vite-express-booking/stripe

# Verificar se está no PATH
which stripe  # Deve mostrar /usr/local/bin/stripe
```

---

### **❌ Problema 2: Webhook Signature Verification Failed**

**Log (Terminal 8):**
```
[Webhook] Error processing webhook: Error: Webhook signature verification failed: 
No signatures found matching the expected signature for payload.
```

**Causa Raiz:**
O webhook está recebendo eventos do Stripe CLI, mas a verificação de assinatura está falhando porque:

1. **STRIPE_WEBHOOK_SECRET não configurado no .env**
   - O secret do `stripe listen` é: `whsec_74d63bdb50d5933a991d74bf311dc156923c993aa70636892004e2168925c195`
   - Mas não está no `.env`

2. **Body Parser pode estar modificando o body**
   - O raw body precisa ser preservado exatamente como recebido
   - Qualquer modificação quebra a assinatura

**Solução:**

#### Passo 1: Adicionar Secret ao .env
```env
STRIPE_WEBHOOK_SECRET=whsec_74d63bdb50d5933a991d74bf311dc156923c993aa70636892004e2168925c195
```

#### Passo 2: Verificar Ordem dos Middlewares
O webhook handler DEVE estar ANTES do `express.json()`:
```typescript
// ✅ CORRETO (atual)
registerWebhookRoutes(app);  // Raw body parser aqui
app.use(express.json());      // JSON parser depois
```

#### Passo 3: Reiniciar Servidor
Após adicionar o secret, reinicie o servidor para carregar a nova variável.

---

### **❌ Problema 3: Teste Falhando - Mock Faltando**

**Log (Terminal 8):**
```
[Booking] Error creating Cal.com event: Error: [vitest] No "createCalComBooking" export is defined on the "./services/availability" mock.
```

**Causa:**
- O teste está tentando usar `createCalComBooking` mas o mock não inclui essa função
- Foi adicionada recentemente mas o mock não foi atualizado

**Solução:**
✅ **JÁ CORRIGIDO** - Mock atualizado no `bookings.test.ts`

---

## 🔧 **CORREÇÕES APLICADAS**

### ✅ 1. Adicionado `stripe` ao .gitignore
- Previne commit acidental do binário
- Evita erros de parse

### ✅ 2. Mock atualizado nos testes
- `createCalComBooking` mockado
- `cancelCalComBooking` mockado
- Testes devem passar agora

### ✅ 3. Logs melhorados no webhook
- Mensagens mais claras sobre o que está faltando
- Facilita debug

---

## 🚀 **PRÓXIMOS PASSOS PARA RESOLVER**

### **1. Remover arquivo stripe do projeto:**
```bash
cd project/vite-express-booking
rm stripe  # Se ainda existir
```

### **2. Adicionar STRIPE_WEBHOOK_SECRET ao .env:**
```env
STRIPE_WEBHOOK_SECRET=whsec_74d63bdb50d5933a991d74bf311dc156923c993aa70636892004e2168925c195
```

### **3. Reiniciar servidor:**
```bash
pnpm dev
```

### **4. Testar novamente:**
```bash
# Em outro terminal
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Em outro terminal
stripe trigger checkout.session.completed
```

---

## 📊 **RESUMO DOS ERROS**

| Erro | Status | Solução |
|------|--------|---------|
| Parse error (stripe binary) | ⚠️ Precisa ação | Remover arquivo `stripe` do projeto |
| Webhook signature failed | ⚠️ Precisa ação | Adicionar `STRIPE_WEBHOOK_SECRET` ao .env |
| Test mock missing | ✅ Corrigido | Mock atualizado |

---

**Última atualização:** Dezembro 2025

