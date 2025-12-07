| 🟦 tRPC                                  | 🟧 REST                                  |
| ---------------------------------------- | ---------------------------------------- |
| Não usa rotas URL                        | Usa URLs como `/users/1`                 |
| Não usa verbos HTTP                      | GET/POST/PUT/DELETE                      |
| Input/output **tipados automaticamente** | Tipagem manual ou com libs (Zod/Swagger) |
| Client é gerado automaticamente          | Client precisa ser escrito (axios/fetch) |
| Contrato é 100% seguro em build-time     | Contrato pode quebrar em runtime         |
| API é “orientada a funções”              | API é “orientada a recursos”             |
| Front e back compartilham tipos          | Tipos não são compartilhados             |
