# 🧪 Guia de Teste de Webhooks Stripe

## 📋 Pré-requisitos

- ✅ Stripe CLI instalado e no PATH
- ✅ Servidor rodando em `http://localhost:3000`
- ✅ Conta Stripe (test mode)

---

## 🔧 Passo 1: Verificar Stripe CLI

```bash
# Verificar se está funcionando
stripe --version

# Deve mostrar algo como: stripe version X.X.X
```

Se não funcionar, adicione ao PATH:
```bash
# Adicionar ao ~/.bashrc ou ~/.zshrc
export PATH=$PATH:/caminho/para/stripe

# Ou criar symlink
sudo ln -s /caminho/para/stripe /usr/local/bin/stripe
```

---

## 🔑 Passo 2: Login no Stripe CLI

```bash
# Fazer login no Stripe
stripe login

# Isso abrirá o navegador para autenticação
# Após login, você terá um token de autenticação
```

**Importante:** Isso gera um par de chaves restritas automaticamente.

---

## 🌐 Passo 3: Configurar Webhook Forwarding

### Opção A: Forwarding Automático (Recomendado)

```bash
# Em um terminal separado, rodar:
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Isso vai:
# 1. Criar um webhook endpoint temporário
# 2. Forward eventos para seu servidor local
# 3. Mostrar um webhook signing secret (whsec_...)
```

**Copie o `webhook signing secret` que aparece!** Você precisará dele.

### Opção B: Usar Webhook Signing Secret Existente

Se você já tem um secret configurado no `.env`:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe --print-secret
```

---

## ⚙️ Passo 4: Configurar Variáveis de Ambiente

Adicione ao seu `.env`:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...  # Sua chave de teste do Stripe Dashboard
STRIPE_WEBHOOK_SECRET=whsec_... # O secret que apareceu no `stripe listen`

# Base URL para redirects
BASE_URL=http://localhost:3000
```

### Como obter STRIPE_SECRET_KEY:

1. Acesse: https://dashboard.stripe.com/test/apikeys
2. Copie a **Secret key** (começa com `sk_test_`)
3. Cole no `.env`

### Como obter STRIPE_WEBHOOK_SECRET:

1. Rode `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
2. Copie o secret que aparece (começa com `whsec_`)
3. Cole no `.env`

---

## 🧪 Passo 5: Testar Webhook Localmente

### 5.1. Iniciar Servidor

```bash
# Terminal 1: Servidor
cd project/vite-express-booking
pnpm dev
```

### 5.2. Iniciar Stripe Listen

```bash
# Terminal 2: Stripe CLI
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Você verá algo como:
```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
```

### 5.3. Trigger Event de Teste

```bash
# Terminal 3: Trigger evento
stripe trigger checkout.session.completed
```

Ou criar um evento específico:
```bash
# Criar um checkout session de teste
stripe trigger payment_intent.succeeded
```

---

## 🔍 Passo 6: Verificar Logs

### No Terminal do Servidor:

Você deve ver:
```
[Webhook] Received event: checkout.session.completed
[Webhook] Booking X confirmed successfully
[Webhook] Cal.com event created: event-id-xxx
```

### No Terminal do Stripe CLI:

Você verá:
```
2025-12-05 21:30:15   --> checkout.session.completed [evt_xxx]
2025-12-05 21:30:15  <--  [200] POST http://localhost:3000/api/webhooks/stripe [evt_xxx]
```

---

## 🎯 Passo 7: Testar Fluxo Completo

### 7.1. Criar Booking via Frontend

1. Acesse: `http://localhost:3000`
2. Selecione um practitioner
3. Escolha um horário
4. Preencha o formulário
5. Clique em "Book Appointment"

### 7.2. Usar Stripe Test Card

No checkout do Stripe, use:
- **Card:** `4242 4242 4242 4242`
- **Expiry:** Qualquer data futura (ex: `12/34`)
- **CVC:** Qualquer 3 dígitos (ex: `123`)
- **ZIP:** Qualquer 5 dígitos (ex: `12345`)

### 7.3. Verificar Webhook

Após pagamento, verifique:
- ✅ Webhook recebido no servidor
- ✅ Booking status mudou para "confirmed"
- ✅ Evento criado no Cal.com
- ✅ Logs mostram sucesso

---

## 🐛 Troubleshooting

### Problema: "Webhook signature verification failed"

**Solução:**
```bash
# Verificar se o secret está correto
echo $STRIPE_WEBHOOK_SECRET

# Se estiver vazio, copie do `stripe listen` e adicione ao .env
```

### Problema: "Connection refused"

**Solução:**
```bash
# Verificar se servidor está rodando
curl http://localhost:3000/api/webhooks/stripe

# Verificar porta
netstat -tulpn | grep 3000
```

### Problema: "Event not processed"

**Solução:**
```bash
# Verificar logs do servidor
# Verificar se booking existe no banco
# Verificar se Cal.com está configurado
```

### Problema: Stripe CLI não encontrado

**Solução:**
```bash
# Verificar localização
which stripe

# Se não encontrar, adicionar ao PATH
export PATH=$PATH:/caminho/completo/para/stripe

# Ou usar caminho completo
/path/to/stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

---

## 📊 Verificar Eventos no Dashboard

1. Acesse: https://dashboard.stripe.com/test/webhooks
2. Veja eventos enviados
3. Veja respostas do servidor
4. Debug event payloads

---

## 🎯 Comandos Úteis

```bash
# Listar eventos recentes
stripe events list

# Ver detalhes de um evento
stripe events retrieve evt_xxxxx

# Reenviar um evento
stripe events resend evt_xxxxx

# Ver logs em tempo real
stripe logs tail

# Testar webhook específico
stripe trigger checkout.session.completed --override checkout_session:metadata[bookingId]=123
```

---

## ✅ Checklist de Teste

- [ ] Stripe CLI instalado e funcionando
- [ ] Login realizado (`stripe login`)
- [ ] `stripe listen` rodando em terminal separado
- [ ] `STRIPE_SECRET_KEY` configurado no `.env`
- [ ] `STRIPE_WEBHOOK_SECRET` configurado no `.env` (do `stripe listen`)
- [ ] Servidor rodando em `localhost:3000`
- [ ] Webhook endpoint acessível: `/api/webhooks/stripe`
- [ ] Teste com `stripe trigger` funcionando
- [ ] Logs mostrando eventos recebidos
- [ ] Booking sendo confirmado no banco
- [ ] Cal.com event sendo criado

---

## 🚀 Próximos Passos

Após testar localmente:

1. **Deploy para produção**
2. **Configurar webhook no Stripe Dashboard** para URL de produção
3. **Obter webhook secret de produção**
4. **Atualizar variáveis de ambiente de produção**

---

**Última atualização:** Dezembro 2025

