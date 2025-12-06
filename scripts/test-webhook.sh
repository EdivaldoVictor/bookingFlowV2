#!/bin/bash

# Script para testar webhook do Stripe localmente
# Uso: ./scripts/test-webhook.sh

echo "🧪 Testing Stripe Webhook Setup"
echo "================================"
echo ""

# Verificar se Stripe CLI está instalado
if ! command -v stripe &> /dev/null; then
    echo "❌ Stripe CLI não encontrado!"
    echo "   Por favor, adicione o Stripe CLI ao PATH"
    echo "   Ou use o caminho completo: /path/to/stripe"
    exit 1
fi

echo "✅ Stripe CLI encontrado: $(stripe --version)"
echo ""

# Verificar se servidor está rodando
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "⚠️  Servidor não está rodando em localhost:3000"
    echo "   Por favor, inicie o servidor com: pnpm dev"
    exit 1
fi

echo "✅ Servidor está rodando em localhost:3000"
echo ""

# Verificar endpoint do webhook
echo "🔍 Verificando endpoint do webhook..."
WEBHOOK_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/webhooks/stripe -X POST)

if [ "$WEBHOOK_RESPONSE" == "400" ] || [ "$WEBHOOK_RESPONSE" == "500" ]; then
    echo "✅ Endpoint do webhook está acessível (retornou $WEBHOOK_RESPONSE - esperado sem signature)"
else
    echo "⚠️  Endpoint retornou código inesperado: $WEBHOOK_RESPONSE"
fi

echo ""
echo "📋 Próximos passos:"
echo "1. Em um terminal separado, rode:"
echo "   stripe listen --forward-to localhost:3000/api/webhooks/stripe"
echo ""
echo "2. Copie o webhook signing secret (whsec_...) que aparecer"
echo ""
echo "3. Adicione ao .env:"
echo "   STRIPE_WEBHOOK_SECRET=whsec_..."
echo ""
echo "4. Em outro terminal, teste com:"
echo "   stripe trigger checkout.session.completed"
echo ""
echo "5. Verifique os logs do servidor para ver o evento processado"
echo ""

