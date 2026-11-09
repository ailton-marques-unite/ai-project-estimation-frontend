# Motor de Estimativa: interface web

Interface Next.js 16 (App Router) para a API do Motor de Estimativa (`../motor_estimativa_ia`). Ela cobre as telas da especificação do MVP:

| Rota | Tela |
|---|---|
| `/login` | Login com e-mail e senha (UNE AI SSO, via API) |
| `/` | Painel de projetos: última estimativa, última aprovada e pendências |
| `/projects/new` | Cadastro do projeto |
| `/projects/[id]` | Editor de escopo, dados do projeto e versões da estimativa |
| `/estimates/[id]` | Resultado: sem IA × com IA, gráficos, premissas e alertas, atividades, equipe, custos e aprovação |
| `/parameters` | Parâmetros vigentes, histórico de versões e nova versão (admin) |
| `/calibration` | Estimado × realizado por tipo de atividade e modalidade de IA |

Na estimativa aprovada, o cartão **Horas realizadas** registra o esforço real de cada atividade. O registro é feito pelo Tech Leader ou pelo administrador e alimenta a calibração.

O editor de escopo respeita a revisão técnica:
- **Product Owner:** cadastra funcionalidades, critérios de aceite e custos, e só visualiza tarefas, atividades, transversais e contingência.
- **Tech Leader e administrador:** editam tudo.

O botão **✦ Sugerir tarefas com IA** pede à API uma decomposição da funcionalidade salva. Com alterações pendentes, ele vira **Salvar e sugerir**: salva o escopo e depois consulta a IA. A sugestão aparece com justificativas, dúvidas, riscos e premissas, e só o Tech Leader pode aplicá-la ao escopo, que depois precisa ser salvo.

O editor de escopo cobre:
- funcionalidades, tarefas e atividades: tipo, horas O/M/P, modalidade de IA filtrada pelo tipo e equipe por papel e senioridade, com soma conferida;
- atividades transversais, com chave de escopo;
- custos adicionais, com valor "a confirmar";
- contingência.

## Rodar

Pré-requisitos:
- Docker e Node 20 ou superior;
- UNE AI SSO rodando em `http://localhost:4000`;
- a API configurada conforme o README de `../motor_estimativa_ia` (`.venv`, `.env` e migrações).

Na primeira vez, prepare o front-end:

```bash
cd frontend
cp .env.example .env.local     # API_BASE_URL=http://localhost:8000
npm install
```

No dia a dia, use **dois terminais**, os dois a partir da raiz do repositório (`ai-project-estimation-engine/`). A API ocupa o terminal enquanto roda, por isso o front-end precisa de outro.

**Terminal 1, a API** (deixe rodando):

```bash
cd motor_estimativa_ia
docker compose up -d && .venv/bin/uvicorn api:app --reload
```

**Terminal 2, o front-end:**

```bash
cd frontend
npm run dev
```

Depois abra **http://localhost:3000** e entre com seu e-mail e senha do SSO.

| Endereço | O que é |
|---|---|
| `http://localhost:3000` | Telas do app |
| `http://localhost:8000/docs` | Documentação interativa da API. A raiz `http://localhost:8000/` responde 404, e isso é esperado. |
| `http://localhost:8000/health` | Conferência rápida de que a API está no ar |

O login no SSO é limitado a 5 tentativas a cada 15 minutos por IP.

Para produção: `npm run build && npm start`.

## Tipos da API

Os tipos de [src/lib/api/schema.d.ts](src/lib/api/schema.d.ts) são **gerados do OpenAPI da API**, e as chamadas usam `openapi-fetch`, com rotas, parâmetros e corpos tipados. Depois de mudar a API, regenere os tipos:

```bash
npm run gen:api   # exporta o OpenAPI com o .venv da API e roda openapi-typescript
```

Os aliases usados nas telas ficam em [src/lib/api/types.ts](src/lib/api/types.ts).

## Autenticação

A identidade vem do UNE AI SSO, e a API faz o papel de proxy:
- **Login:** a Server Action `login` chama `POST /auth/login` e grava o access token e o refresh token em **cookies httpOnly** (`me_access`, `me_refresh`, `SameSite=Lax`, `Secure` em produção). O JavaScript do navegador nunca vê os tokens.
- **Renovação:** o [proxy](src/proxy.ts) (antigo middleware) renova o access token, via `POST /auth/refresh`, quando faltam 60 segundos ou menos para ele vencer. Sem sessão utilizável, ele redireciona para `/login?next=…`.
- **Validação:** cada chamada à API envia o Bearer, e a API valida no SSO. O perfil, que define o que aparece na tela (por exemplo, o botão de aprovação e o formulário de parâmetros), vem de `GET /users/me`. A autorização de verdade continua na API.
- **Sem role:** um usuário autenticado sem role do app vê um aviso com a orientação para pedir acesso.

Atenção: o SSO limita o login a 5 tentativas a cada 15 minutos por IP. Quando o limite é atingido, a API responde 503 e a tela mostra a mensagem do SSO.

## Estrutura

```
src/
  proxy.ts                 renovação de sessão e redirecionamento para o login
  app/actions.ts           Server Actions (login, logout, projetos, estimativas, aprovação, parâmetros)
  app/login/               tela de login
  app/(app)/               telas autenticadas (layout com navegação e verificação de acesso)
  components/              UI, formulário com action, editor de escopo, gráfico de comparação
  lib/api/                 cliente tipado, tipos gerados e aliases
  lib/dal.ts               leituras da API para Server Components
  lib/session.ts           cookies de sessão
```

Os gráficos ("sem IA × com IA") usam barras horizontais agrupadas. Têm legenda, tooltip ao passar o mouse e ao focar pelo teclado, e uma tabela alternativa. As duas cores de série foram validadas para daltonismo e contraste nos modos claro e escuro.

## Visual e tema

- **Design system:** os tokens ficam em [src/app/globals.css](src/app/globals.css), no padrão shadcn (`background`, `card`, `primary`, `muted-foreground`, `border`, `destructive`, `success`, `warning`…), com cores em `oklch`. Para criar uma cor, defina-a em `:root` e em `.dark` e registre em `@theme inline` como `--color-<nome>`.
- **Cores próprias do app:** `warning-text` (texto de alerta legível em fundo claro) e `series-1`/`series-2` (gráficos "Sem IA"/"Com IA").
- **Tema escuro:** a classe `.dark` no `<html>` ativa os tokens escuros. O seletor **Sistema · Claro · Escuro** fica no cabeçalho e no login. A escolha fica salva no navegador (`localStorage`), e "Sistema" segue o sistema operacional. Um script no `<head>` aplica o tema antes da primeira pintura, para a tela não piscar no tema claro.
