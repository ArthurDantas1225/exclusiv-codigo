# Stylist IA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar ao app interno um Stylist IA mobile que sugere kits reais de camisa com short ou calça e gera textos e roteiros de Stories usando fotos já cadastradas.

**Architecture:** Uma função pura filtra e ordena combinações válidas com dados já carregados pelo Provider. Uma Route Handler autenticada recebe somente os melhores candidatos, usa Vercel AI SDK/AI Gateway para devolver JSON estruturado e valida os IDs antes de responder; a tela associa as fotos existentes e possui fallback determinístico quando a IA falha.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Supabase Auth/Storage, Zod 4, Vercel AI SDK, Vercel AI Gateway, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-30-stylist-ia-design.md`

## Global Constraints

- Somente produtos ativos, não arquivados, visíveis no catálogo, com estoque positivo e foto não ocultada participam.
- Combinações permitidas: `Camisa + Short` e `Camisa + Calça`.
- Objetivos permitidos: `Vender hoje`, `Divulgar novidades` e `Girar estoque`.
- Nunca enviar fotos, clientes, vendas, salários, custo, lucro ou dados de usuários ao modelo.
- Nunca aceitar produtos, variantes ou cores inventados pela IA.
- Não gerar imagens, publicar no Instagram, alterar catálogo ou alterar estoque.
- Interface mobile-first, acessível e consistente com o app atual.
- Usar AI Gateway por OIDC em produção; nenhum segredo pode chegar ao cliente ou ao Git.
- Sem persistência de resultados nesta versão.
- Usar fallback determinístico quando autenticação do Gateway, crédito, orçamento, limite, timeout ou saída estruturada falhar.
- Instalar somente o pacote `ai`; não adicionar pacote de provedor sem necessidade comprovada.

## Review Focus

- Produto muda para estoque zero entre a geração dos candidatos e a renderização: o resultado precisa ser revalidado e removido.
- Cores com grafias equivalentes (`Preto`, `Preta`, espaços e caixa): normalizar sem misturar cores diferentes.
- Foto da cor não existe, mas há capa visível: usar fallback de imagem sem descartar um kit válido.
- Modelo devolve ID desconhecido, kit duplicado ou mais de três kits: rejeitar a resposta remota e usar fallback local.
- Sessão ausente, perfil inativo, corpo excessivo ou clique repetido: negar/limitar sem consumir uma chamada de IA.

---

### Task 1: Motor determinístico de combinações

**Files:**
- Create: `lib/stylist.ts`
- Create: `tests/stylist.test.ts`

**Interfaces:**
- Consumes: `Product`, `Variant`, `ProductImage` de `lib/types.ts`.
- Produces: `StylistPairing`, `StylistGoal`, `StylistCandidate`, `StylistRequest`, `StylistResult`, `stylistRequestSchema`, `stylistResultSchema`, `buildStylistCandidates(...)`, `resolveStylistPhoto(...)`, `validateStylistResult(...)` e `fallbackStylistResult(...)`.

- [ ] **Step 1: Escrever testes que falham para produtos elegíveis e combinações permitidas**

Cobrir em `tests/stylist.test.ts`:

- `shirt_short` nunca usa calça como peça inferior;
- `shirt_pants` nunca usa short;
- produto inativo, arquivado, invisível, sem foto ou sem estoque não participa;
- cada candidato contém IDs, cor, tamanhos disponíveis, preço, estoque agregado e `score`.

- [ ] **Step 2: Executar o teste focado e confirmar a falha**

Run: `node --test tests/stylist.test.ts`

Expected: FAIL porque `lib/stylist.ts` ainda não existe.

- [ ] **Step 3: Criar tipos e `buildStylistCandidates`**

Assinatura:

```ts
export function buildStylistCandidates(
  input: { products: Product[]; variants: Variant[]; images: ProductImage[] },
  pairing: StylistPairing,
  goal: StylistGoal,
): StylistCandidate[];
```

Retornar no máximo 12 candidatos em ordem estável. Pontuar compatibilidade dos grupos de cor, foto da cor, variedade de tamanhos, estoque e o objetivo selecionado. O `candidate.id` deve ser derivado somente dos dois produtos e cores normalizadas.

- [ ] **Step 4: Executar o teste focado e confirmar que passa**

Run: `node --test tests/stylist.test.ts`

Expected: PASS nos casos de elegibilidade e categoria.

- [ ] **Step 5: Escrever testes que falham para normalização, fotos, objetivos e empates**

Adicionar casos que provem:

- `Preto`, `preto`, `Preta` e espaços externos pertencem ao mesmo grupo cromático sem mudar o texto original exibido;
- `resolveStylistPhoto(images, productId, color)` prefere frente/cor, depois outra vista/cor, capa e primeira foto;
- `new_arrivals` favorece `created_at` recente;
- `move_stock` favorece estoque agregado maior;
- empates usam nome e ID para ordenação repetível.

- [ ] **Step 6: Implementar normalização, pontuação por objetivo e resolução de foto**

Assinatura:

```ts
export function resolveStylistPhoto(
  images: ProductImage[],
  productId: string,
  color: string,
): ProductImage | undefined;
```

Manter os mapas de cor pequenos e explícitos em `lib/stylist.ts`; cores desconhecidas recebem compatibilidade neutra, não erro.

- [ ] **Step 7: Escrever testes que falham para resultado remoto não confiável e fallback**

Adicionar casos para:

- ID ou cor que não pertence ao candidato;
- kit duplicado e mais de três kits;
- estoque que passou a zero antes da validação;
- fallback com um kit, título, legenda, CTA e exatamente três passos de Story.

- [ ] **Step 8: Implementar schemas, validação e fallback**

Assinaturas:

```ts
export function validateStylistResult(
  value: unknown,
  candidates: StylistCandidate[],
  currentVariants?: Variant[],
): StylistResult | null;

export function fallbackStylistResult(
  candidate: StylistCandidate,
  goal: StylistGoal,
): StylistResult;
```

Os schemas Zod limitam candidatos a 12, kits a 3, passos do Story a 3 e comprimentos de textos definidos no schema.

- [ ] **Step 9: Executar os testes do motor**

Run: `node --test tests/stylist.test.ts`

Expected: PASS em elegibilidade, cores, fotos, objetivos, ordenação, validação e fallback.

- [ ] **Step 10: Commit**

```bash
git add lib/stylist.ts tests/stylist.test.ts
git commit -m "feat: rank real catalog outfit combinations"
```

### Task 2: Endpoint autenticado e geração estruturada

**Files:**
- Modify: `package.json`
- Modify: lockfile detectado pelo gerenciador do projeto
- Create: `lib/stylist-server.ts`
- Create: `app/api/stylist/route.ts`
- Create: `tests/stylist-api.test.ts`

**Interfaces:**
- Consumes: schemas, `StylistCandidate`, `StylistGoal`, `StylistResult`, `validateStylistResult` e `fallbackStylistResult` da Task 1.
- Produces: `StylistGenerator`, `buildStylistPrompt(...)`, `generateStylistResult(...)` e `POST(request: Request)` em `/api/stylist`.

- [ ] **Step 1: Confirmar gerenciador e instalar somente o AI SDK**

Run: `pnpm add ai`

Expected: `package.json` recebe `ai` e apenas o lockfile do pnpm é atualizado.

- [ ] **Step 2: Ler documentação correspondente à versão instalada**

Verificar `node_modules/ai/package.json`, `node_modules/ai/docs/` e a API atual de `generateText` + `Output.object`. Não escrever chamada com sintaxe lembrada de outra versão.

- [ ] **Step 3: Escrever testes que falham para prompt e validação do gerador**

Em `tests/stylist-api.test.ts`, testar com um gerador injetado:

- prompt contém somente campos permitidos dos candidatos;
- prompt não contém `cost`, cliente, venda, lucro ou URL de foto;
- resposta válida retorna no máximo três kits;
- ID desconhecido aciona `fallbackStylistResult`;
- erro/timeout do gerador aciona fallback.

- [ ] **Step 4: Implementar `lib/stylist-server.ts`**

Assinaturas:

```ts
export function buildStylistPrompt(
  pairing: StylistPairing,
  goal: StylistGoal,
  candidates: StylistCandidate[],
): string;

export type StylistGenerator = (
  prompt: string,
  schema: typeof stylistResultSchema,
) => Promise<unknown>;

export async function generateStylistResult(
  input: StylistRequest,
  generate?: StylistGenerator,
): Promise<{ result: StylistResult; source: "ai" | "fallback" }>;
```

O gerador padrão usa `generateText`, `Output.object({ schema: stylistResultSchema })` e `process.env.AI_GATEWAY_MODEL`. Qualquer falha retorna fallback; ausência de candidato retorna erro de entrada, sem chamar IA.

- [ ] **Step 5: Executar testes do servidor e confirmar sucesso**

Run: `node --test tests/stylist-api.test.ts`

Expected: PASS sem fazer chamada real ao Gateway.

- [ ] **Step 6: Escrever testes que falham para a fronteira HTTP**

Adicionar verificações de fonte em `tests/stylist-api.test.ts` ou helper injetável que provem:

- `Authorization: Bearer` é obrigatório;
- `supabase.auth.getUser(token)` é chamado antes da geração;
- perfil precisa existir e ter `active = true`;
- corpo inválido ou com mais de 12 candidatos retorna `400`;
- sessão inválida retorna `401` e perfil inativo retorna `403`;
- sucesso retorna JSON com `source` e `result`.

- [ ] **Step 7: Implementar `POST` em `app/api/stylist/route.ts`**

Criar cliente Supabase no servidor usando somente `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`, com o header global `Authorization` igual ao Bearer recebido. Validar o JWT com `auth.getUser(token)`, consultar `profiles` pelo `user.id` e `active=true`, validar o corpo e só então chamar `generateStylistResult`.

Não aceitar prompt livre, URLs ou dados extras do cliente. Aplicar timeout da aplicação à geração e retornar fallback válido quando a chamada remota falhar.

- [ ] **Step 8: Executar testes do endpoint e typecheck**

Run: `node --test tests/stylist-api.test.ts && npm run typecheck`

Expected: todos os testes passam e TypeScript termina com exit 0.

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-lock.yaml lib/stylist-server.ts app/api/stylist/route.ts tests/stylist-api.test.ts
git commit -m "feat: generate authenticated stylist story scripts"
```

### Task 3: Tela mobile e integração ao aplicativo

**Files:**
- Create: `components/stylist.tsx`
- Modify: `app/app/[[...path]]/page.tsx`
- Modify: `components/settings.tsx`
- Modify: `app/globals.css`
- Create: `tests/stylist-ui.test.ts`

**Interfaces:**
- Consumes: `buildStylistCandidates`, `resolveStylistPhoto`, `validateStylistResult`, tipos da Task 1 e `/api/stylist` da Task 2; `useStore()` e cliente Supabase existentes.
- Produces: componente `<Stylist />`, rota `/app/stylist` e cartão “Stylist IA” em `/app/mais`.

- [ ] **Step 1: Escrever teste de interface que falha**

Em `tests/stylist-ui.test.ts`, verificar que:

- o roteador importa e renderiza `Stylist` para `case "stylist"`;
- Mais contém “Stylist IA” e “Kits e roteiros para Stories”;
- a tela contém os dois tipos de combinação, três objetivos, “Gerar combinações”, “Copiar roteiro”, “Trocar uma peça” e “Gerar outro texto”;
- o request envia token Bearer e não envia imagens/custos;
- o resultado exibe fotos reais resolvidas e três passos de Story.

- [ ] **Step 2: Executar teste de interface e confirmar a falha**

Run: `node --test tests/stylist-ui.test.ts`

Expected: FAIL porque o componente e a rota ainda não existem.

- [ ] **Step 3: Criar `components/stylist.tsx` com estado inicial e candidatos**

Usar `useStore()` para ler produtos, variantes e imagens. Calcular candidatos com `useMemo`; não chamar a API automaticamente. Se não houver candidatos, renderizar explicação e link para `/app/estoque`.

- [ ] **Step 4: Implementar chamada autenticada e fallback da tela**

No clique, obter sessão Supabase, enviar apenas `pairing`, `goal` e até 12 candidatos para `/api/stylist`, impedir cliques simultâneos e validar o retorno novamente antes de setar estado. Falha de rede usa `fallbackStylistResult` e informa que foi usada uma sugestão local.

- [ ] **Step 5: Implementar resultado e ações**

Mostrar até três kits, fotos assinadas, nome, cor, tamanhos, preços e total. Implementar seleção de kit, troca por outro candidato compatível, nova geração de texto somente para o kit escolhido e cópia do roteiro com `navigator.clipboard.writeText` mais mensagem de confirmação.

- [ ] **Step 6: Integrar rota e item em Mais**

Adicionar `case "stylist"` em `app/app/[[...path]]/page.tsx` e o módulo com ícone Lucide em `components/settings.tsx`. Não adicionar nova aba à navegação inferior; ele permanece dentro de Mais.

- [ ] **Step 7: Adicionar estilos mínimos e responsivos**

Em `app/globals.css`, criar somente classes `stylist-*` necessárias. Uma coluna até 600 px; cards não dependem de rolagem horizontal; alvos de toque de aproximadamente 44 px; `aria-live` para carregamento/resultado; animações respeitam `prefers-reduced-motion`.

- [ ] **Step 8: Executar teste da interface, typecheck e lint**

Run: `node --test tests/stylist-ui.test.ts && npm run typecheck && npm run lint`

Expected: todos passam com exit 0.

- [ ] **Step 9: Commit**

```bash
git add components/stylist.tsx app/app/[[...path]]/page.tsx components/settings.tsx app/globals.css tests/stylist-ui.test.ts
git commit -m "feat: add mobile stylist ai workspace"
```

### Task 4: Configuração, verificação real e publicação

**Files:**
- Modify: `README.md` apenas se faltar documentação de configuração da IA
- Test: `tests/*.test.ts`

**Interfaces:**
- Consumes: módulo completo das Tasks 1–3 e projeto Vercel/Supabase existentes.
- Produces: funcionalidade validada localmente, orçamento configurado, variável `AI_GATEWAY_MODEL` segura e deploy de produção verificado.

- [ ] **Step 1: Executar toda a suíte antes de configurar serviço externo**

Run: `npm test && npm run typecheck && npm run lint && npm run build`

Expected: todos os testes passam; build inclui `/api/stylist` e `/app/[[...path]]`.

- [ ] **Step 2: Consultar o catálogo atual de modelos e escolher um modelo de texto econômico**

Buscar a lista completa atual do AI Gateway. Confirmar suporte a saída estruturada, português e preço antes de definir `AI_GATEWAY_MODEL`; não gravar o ID no código.

- [ ] **Step 3: Configurar autenticação e orçamento no Vercel AI Gateway**

Usar OIDC do projeto Vercel. Consultar créditos e cobrança atuais, propor um teto mensal em USD e obter aprovação explícita do usuário imediatamente antes de salvar o orçamento. Não criar nem exibir chave de API se OIDC funcionar no deploy.

- [ ] **Step 4: Fazer uma chamada real autorizada em preview**

Enviar candidatos de teste não sensíveis, confirmar `source="ai"`, IDs válidos, português brasileiro, três passos e consumo registrado no Gateway. Se o Gateway não estiver disponível, confirmar `source="fallback"` e não publicar até o motivo estar documentado.

- [ ] **Step 5: Revisar segurança e dados transmitidos**

Inspecionar request do navegador e logs: nenhum custo, cliente, venda, usuário, URL assinada ou arquivo de imagem pode sair para `/api/stylist`/Gateway. Confirmar `401` sem sessão e `403` para perfil inativo.

- [ ] **Step 6: Atualizar documentação mínima, se necessário, e commit**

Se a configuração não estiver autoexplicativa, documentar somente `AI_GATEWAY_MODEL`, OIDC, orçamento e fallback.

```bash
git add README.md
git commit -m "docs: document stylist ai gateway setup"
```

Pular o commit se `README.md` não precisar mudar.

- [ ] **Step 7: Publicar e acompanhar o deploy**

Enviar a branch aprovada, acompanhar build até `Ready` e não promover um deploy com erro de geração/autenticação.

- [ ] **Step 8: Testar produção no mobile**

Com sessão real: abrir Mais → Stylist IA, gerar ambos os tipos de kit, trocar uma peça, regenerar texto e copiar roteiro. Confirmar fotos existentes, estoque, fallback e ausência de erros no console/runtime.

- [ ] **Step 9: Registrar resultado final**

Informar URL, commit, deployment ID, modelo configurado, limite de orçamento, testes executados e qualquer parte não verificada.
