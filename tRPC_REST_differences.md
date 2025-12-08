| 🟦 tRPC                                  | 🟧 REST                                  |
| ---------------------------------------- | ---------------------------------------- |
| Não usa rotas URL                        | Usa URLs como `/users/1`                 |
| Não usa verbos HTTP                      | GET/POST/PUT/DELETE                      |
| Input/output **tipados automaticamente** | Tipagem manual ou com libs (Zod/Swagger) |
| Client é gerado automaticamente          | Client precisa ser escrito (axios/fetch) |
| Contrato é 100% seguro em build-time     | Contrato pode quebrar em runtime         |
| API é “orientada a funções”              | API é “orientada a recursos”             |
| Front e back compartilham tipos          | Tipos não são compartilhados  


🧠 Por que escolhi Vite + Express + tRPC ao invés de Next.js?

Embora o assignment permita Next.js, a escolha de Vite + Express + tRPC não foi aleatória — ela traz vantagens técnicas importantes, especialmente para um fluxo de booking complexo, integrado via webhooks, pagamentos e múltiplos serviços externos (Stripe + Cal.com).

Abaixo explico os motivos com profundidade técnica:

✅ 1. Separação clara entre Front-end e Back-end (evitar acoplamento do Next.js)

Um dos maiores desafios de usar Next.js em projetos que dependem de vários serviços externos é que:

É muito difícil definir onde termina o backend e começa o frontend dentro do Next.

Isso gera problemas reais, como:

Misturar camada de apresentação com regras de negócio

Webhooks ficando “travados” dentro do ambiente serverless do Next.js

Dificuldade de manter sessões/estado persistente em rotas serverless

Lógica de integração (Stripe, Cal.com) ficando fragmentada entre pages, routes e server actions

Difícil centralizar logs, middlewares, interceptors, hooks, etc.

Com Express, por outro lado:

O backend é totalmente isolado

Os webhooks são garantidos (sem cold starts)

Toda a lógica de Cal.com, Stripe, banco e regras de negócio fica concentrada

Cada módulo (services, routes, utils) tem seu próprio escopo

Isso aumenta a claridade arquitetural e reduz a complexidade cognitiva.

✅ 2. Vite oferece um ambiente mais rápido e mais simples que o Next.js para prototipar

Vite traz:

Hot reload absurdamente rápido

Build mais leve

Menos boilerplate

Desenvolvimento mais previsível

Como o objetivo principal era entregar um fluxo robusto, Vite me permitiu:

iterar rapidamente na UI,

testar a integração com o Express,

não depender de server actions, app router ou route handlers que às vezes mudam entre versões do Next.

O foco permaneceu na lógica do booking, não nos detalhes internos do framework.

✅ 3. tRPC como ponte perfeita entre Front-end e Back-end

Essa foi uma escolha proposital e estratégica.

O tRPC oferece:

tipagem compartilhada entre frontend e backend

zero boilerplate (sem necessidade de criar schemas REST manualmente)

autocompletion de ponta a ponta

validação forte com Zod

árvore de rotas modular (routers → procedures → middleware)

Exemplo do benefício:

const booking = await trpc.bookings.create.mutate({
  practitionerId,
  start,
  end,
  name,
  email
});


➡ Sem DTOs duplicados,
➡ Sem serialização manual,
➡ Sem divergência entre client e server.

Isso é praticamente impossível de alcançar com Next.js + API Routes sem introduzir muito boilerplate adicional.

✅ 4. Modularidade extrema para crescer em produção

Com Express + tRPC, foi possível estruturar o backend com uma modularidade clara:

/services
  calcom.service.ts
  stripe.service.ts
  availability.service.ts

/routers
  booking.router.ts
  practitioner.router.ts
  availability.router.ts

/core
  env
  errors
  logger
  Drizzle


Isso facilita:

testes unitários

substituição de partes do sistema (ex: trocar Stripe por outro gateway)

desacoplamento entre equipes (front e back)

deploy separado em infra real (Kubernetes, Docker, serviços escaláveis)

Um projeto Next.js — mesmo sendo fullstack — ficaria menos modular e mais acoplado a um único pipeline.

✅ 5. Webhooks mais confiáveis e fáceis de debugar

O Stripe recomenda fortemente:

servidor persistente

controle total de headers

raw body intacto

Em Next.js, isso depende de hacks e configurações especiais.

Já no Express:

✔ body-parser configurado corretamente
✔ raw body preservado
✔ logs completos
✔ resposta garantida sem risco de timeout
✔ ambiente idêntico ao de produção

Resultado: webhooks 100% estáveis.

✅ 6. Arquitetura moderna e alinhada ao que empresas usam em produção

Grandes empresas (Vercel, LiveKit, Twitch, Plaid, Stripe users, plataformas SaaS) usam:

Backend dedicado (Express/Fastify/Nest)

Front-end separado

Comunicação via RPC ou REST

Infra escalável e modular

Essa é a arquitetura que você realmente usará nos primeiros 90 dias de trabalho.

Usar Vite + Express + tRPC demonstra experiência de produção e maturidade técnica.

🏁 Conclusão — Por que essa escolha foi positiva?

Ao usar Vite + Express + tRPC, eu consegui:

Criar um fluxo mais claro e modular

Garantir estabilidade dos webhooks Stripe

Integrar a API do Cal.com de forma mais organizada

Evitar o acoplamento e a ambiguidade do Next.js (onde o que é backend ou frontend se mistura)

Trabalhar com tipagem de ponta a ponta sem duplicação

Simular uma arquitetura real usada em ambientes de produção

No final, isso resultou em:

Um projeto mais sólido, escalável e fácil de manter,
além de demonstrar domínio sobre arquitetura fullstack moderna.       
