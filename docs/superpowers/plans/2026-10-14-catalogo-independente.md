# Catálogo Independente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar o catálogo como site independente no Supabase do Arthur e manter produtos, estoque e pedidos sincronizados com o ERP da EXCLUSIV.

**Architecture:** O ERP permanece como fonte oficial e envia uma projeção pública idempotente ao banco do catálogo. O catálogo grava pedidos pendentes em seu próprio banco; o ERP os consulta por uma função autenticada, confirma a venda com o ID do pedido como chave de repetição e devolve o novo estoque ao catálogo.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Supabase Postgres/Storage/Edge Functions, Vercel, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-14-catalogo-independente.md`

## Global Constraints

- O projeto Supabase `rznnojrtgolekdkcvxnv` do Gabriel continua sendo a fonte oficial do ERP.
- O projeto Supabase `sduacssupdhzwqmlijqv` do Arthur recebe somente dados públicos e pedidos pendentes.
- Custos, margens, usuários, fornecedores, caixa, contas e vendas confirmadas não podem ser copiados para o catálogo.
- Chaves administrativas e segredos ficam apenas em funções de servidor.
- O catálogo deve funcionar com a última fotografia válida quando o ERP estiver indisponível.
- A confirmação da venda, e somente ela, reduz estoque no ERP.
- Não adicionar dependência quando APIs do Next.js, Supabase ou plataforma resolverem o caso.
- Antes de editar Next.js, ler os guias relevantes em `node_modules/next/dist/docs/` conforme `AGENTS.md`.

## Review Focus

- Dois envios com a mesma chave retornam o mesmo pedido e não duplicam itens.
- Um pedido salvo continua recuperável quando a abertura do WhatsApp falha.
- Uma resposta de sincronização antiga não substitui produto ou estoque mais novo.
- Falta de estoque na confirmação mantém o pedido pendente e informa o item afetado.
- Um usuário anônimo não consegue ler pedidos nem alterar produtos do catálogo.

---

### Task 1: Esquema isolado do catálogo

**Files:**
- Create: `supabase-catalog/migrations/20261014090000_catalog_core.sql`
- Create: `supabase-catalog/seed.sql`
- Create: `tests/catalog-schema.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: IDs UUID já existentes de produtos, variantes e imagens no ERP.
- Produces: RPC `create_catalog_order(p jsonb)`, tabelas `catalog_products`, `catalog_variants`, `catalog_images`, `catalog_orders`, `catalog_order_items`, `catalog_sync_events`, `catalog_order_attempts`, `catalog_settings` e bucket público `catalog-products`.

- [ ] **Step 1: Escrever testes estruturais que exijam tabelas, chaves únicas, estados, RLS e ausência de leitura pública de pedidos**

O teste deve ler a migração e afirmar os nomes definidos nas Interfaces, `unique (source_id)`, `unique (idempotency_key)`, os cinco estados do pedido e políticas públicas apenas para projeções publicadas.

- [ ] **Step 2: Executar o teste e confirmar a falha**

Run: `node --test tests/catalog-schema.test.ts`
Expected: FAIL porque a migração ainda não existe.

- [ ] **Step 3: Criar a migração mínima e a configuração pública da EXCLUSIV**

`create_catalog_order(p jsonb)` deve validar preço/estoque atuais dentro da transação, gravar total canônico e devolver o pedido existente quando `idempotency_key` já existir.

- [ ] **Step 4: Documentar as novas variáveis sem incluir valores secretos**

Adicionar `CATALOG_SUPABASE_URL`, `CATALOG_SUPABASE_SERVICE_ROLE_KEY` e `CATALOG_SYNC_SECRET`; manter variáveis públicas separadas no aplicativo do catálogo.

- [ ] **Step 5: Executar os testes**

Run: `node --test tests/catalog-schema.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase-catalog .env.example tests/catalog-schema.test.ts
git commit -m "feat: add isolated catalog schema"
```

### Task 2: Aplicativo independente do catálogo

**Files:**
- Create: `catalog-site/package.json`
- Create: `catalog-site/pnpm-lock.yaml`
- Create: `catalog-site/tsconfig.json`
- Create: `catalog-site/next.config.ts`
- Create: `catalog-site/app/layout.tsx`
- Create: `catalog-site/app/page.tsx`
- Create: `catalog-site/app/globals.css`
- Create: `catalog-site/components/public-catalog.tsx`
- Create: `catalog-site/lib/catalog-client.ts`
- Copy/adapt: `lib/catalog-order.ts`
- Copy/adapt: `lib/catalog-selection.ts`
- Copy/adapt: `lib/catalog-taxonomy.ts`
- Create: `catalog-site/tests/catalog-client.test.ts`

**Interfaces:**
- Consumes: leitura pública de `catalog_products`, `catalog_variants`, `catalog_images` e `catalog_settings`.
- Produces: `loadCatalog(): Promise<CatalogData>` e site mobile com a interface atual do catálogo.

- [ ] **Step 1: Escrever teste para montar `CatalogData` somente com produtos publicados e variantes disponíveis**

Cobrir produto sem foto, produto sem estoque e resposta indisponível usando dados injetados no cliente.

- [ ] **Step 2: Executar o teste e confirmar a falha**

Run: `cd catalog-site; pnpm test`
Expected: FAIL porque o cliente ainda não existe.

- [ ] **Step 3: Criar o menor aplicativo Next.js independente**

Preservar grade mobile, filtros, galeria, carrinho, Instagram, contato direto e texto atuais. Substituir a chamada à Edge Function do ERP por `loadCatalog()` no banco do catálogo.

- [ ] **Step 4: Configurar cache de cinco minutos e estado visível de indisponibilidade**

O cache não pode conter dados de pedido; apenas a fotografia pública de produtos.

- [ ] **Step 5: Executar teste, lint e build do catálogo**

Run: `cd catalog-site; pnpm test && pnpm lint && pnpm build`
Expected: todos concluem com código 0.

- [ ] **Step 6: Commit**

```bash
git add catalog-site
git commit -m "feat: extract public catalog site"
```

### Task 3: Criação durável do pedido e WhatsApp

**Files:**
- Create: `supabase-catalog/functions/create-order/index.ts`
- Create: `catalog-site/lib/order-client.ts`
- Modify: `catalog-site/components/public-catalog.tsx`
- Create: `catalog-site/tests/order-client.test.ts`
- Adapt: `catalog-site/lib/catalog-order.ts`

**Interfaces:**
- Consumes: `create_catalog_order(p jsonb)` e `CatalogOrderInput` com `idempotencyKey`, cliente, pagamento, entrega e itens.
- Produces: `submitCatalogOrder(input: CatalogOrderInput): Promise<CatalogOrderReceipt>`; recibo contém `id`, `code`, `total`, itens e `whatsappUrl` canônicos.

- [ ] **Step 1: Escrever testes de envio repetido, preço alterado, estoque insuficiente e falha antes do WhatsApp**

O clique repetido com a mesma chave deve retornar o mesmo `code`; a URL do WhatsApp deve usar os dados devolvidos pelo servidor.

- [ ] **Step 2: Executar o teste e confirmar a falha**

Run: `cd catalog-site; pnpm test`
Expected: FAIL porque `submitCatalogOrder` ainda não existe.

- [ ] **Step 3: Implementar a Edge Function pública com validação e limites de entrada**

Aceitar apenas `POST`, limitar quantidade por item, itens por pedido e comprimento dos textos; registrar tentativa por hash de origem, rejeitar excesso em uma janela curta, chamar a RPC atômica e mapear falta de estoque para resposta legível.

- [ ] **Step 4: Trocar o armazenamento local pelo envio durável**

Gerar uma chave uma vez por tentativa, desabilitar o botão durante o envio, abrir o WhatsApp somente após sucesso e manter o carrinho quando houver falha.

- [ ] **Step 5: Executar testes, lint e build**

Run: `cd catalog-site; pnpm test && pnpm lint && pnpm build`
Expected: todos concluem com código 0.

- [ ] **Step 6: Commit**

```bash
git add catalog-site supabase-catalog/functions/create-order
git commit -m "feat: persist catalog orders before WhatsApp"
```

### Task 4: Pedidos remotos no ERP

**Files:**
- Create: `supabase/functions/catalog-orders/index.ts`
- Modify: `components/pending-orders.tsx`
- Modify: `lib/pending-orders.ts`
- Create: `tests/catalog-pending-orders.test.ts`

**Interfaces:**
- Consumes: pedidos `pending`/`failed` do Supabase do Arthur através de segredos do servidor.
- Produces: operações autenticadas `list`, `confirm` e `cancel`; `confirm` recebe `order_id` e `sale_id`.

- [ ] **Step 1: Escrever testes para mapear pedidos remotos, importar pedido local legado e impedir confirmação duplicada**

Cobrir também falta de variante e estoque insuficiente mantendo o pedido aberto.

- [ ] **Step 2: Executar o teste e confirmar a falha**

Run: `node --test tests/catalog-pending-orders.test.ts`
Expected: FAIL para o novo adaptador remoto.

- [ ] **Step 3: Implementar a função de ponte autenticada**

Validar o JWT no Supabase do ERP, exigir associação ativa à organização e acessar o catálogo com `CATALOG_SUPABASE_SERVICE_ROLE_KEY` somente no servidor.

- [ ] **Step 4: Substituir a listagem local pela listagem remota**

Na primeira carga, enviar pedidos legados de `localStorage` ao catálogo e removê-los localmente somente após confirmação do servidor.

- [ ] **Step 5: Confirmar venda usando `order.id` como `request_id`**

Depois de `run("sale", ...)` retornar `sale_id`, marcar o pedido remoto como `confirmed`. Se a marcação remota falhar, a repetição deve recuperar a mesma venda pelo `request_id`.

- [ ] **Step 6: Executar testes e lint do ERP**

Run: `node --test tests/catalog-pending-orders.test.ts && pnpm lint`
Expected: ambos concluem com código 0.

- [ ] **Step 7: Commit**

```bash
git add components/pending-orders.tsx lib/pending-orders.ts supabase/functions/catalog-orders tests/catalog-pending-orders.test.ts
git commit -m "feat: connect catalog orders to ERP"
```

### Task 5: Sincronização de produtos, estoque e fotos

**Files:**
- Create: `supabase/functions/sync-catalog/index.ts`
- Create: `lib/catalog-sync.ts`
- Modify: `components/provider.tsx`
- Modify: `components/product-editor.tsx`
- Modify: `components/product-photos.tsx`
- Create: `tests/catalog-sync.test.ts`

**Interfaces:**
- Consumes: produto do ERP, suas variantes e imagens; credenciais do Supabase do catálogo.
- Produces: `requestCatalogSync(productIds?: string[]): Promise<void>` e sincronização `upsert` por `source_id` e `version`.

- [ ] **Step 1: Escrever testes para projeção pública, remoção de campos privados, eventos repetidos e versões fora de ordem**

O teste deve afirmar que `cost`, margem e dados internos nunca aparecem no payload.

- [ ] **Step 2: Executar o teste e confirmar a falha**

Run: `node --test tests/catalog-sync.test.ts`
Expected: FAIL porque a projeção ainda não existe.

- [ ] **Step 3: Implementar a função de sincronização autenticada**

Ler o produto diretamente do ERP, copiar fotos novas para `catalog-products`, remover projeções ocultas e fazer `upsert` somente quando a versão recebida for mais nova.

- [ ] **Step 4: Solicitar sincronização após mutações relevantes**

Após venda, compra, grade, variante, foto, publicação, arquivamento e restauração, chamar `requestCatalogSync`; falha na sincronização não pode desfazer a operação já salva no ERP e deve mostrar ação de tentar novamente.

- [ ] **Step 5: Adicionar sincronização completa manual para recuperação**

Expor a ação apenas para administradores na gestão de produtos e processar em lotes limitados.

- [ ] **Step 6: Executar testes, lint e typecheck direcionado**

Run: `node --test tests/catalog-sync.test.ts && pnpm lint && pnpm typecheck`
Expected: novos arquivos sem erros; erros TypeScript preexistentes devem ser registrados separadamente e não ampliados.

- [ ] **Step 7: Commit**

```bash
git add components/provider.tsx components/product-editor.tsx components/product-photos.tsx lib/catalog-sync.ts supabase/functions/sync-catalog tests/catalog-sync.test.ts
git commit -m "feat: synchronize ERP inventory with catalog"
```

### Task 6: Implantação, corte e verificação completa

**Files:**
- Create: `catalog-site/README.md`
- Create: `docs/CATALOGO-OPERACAO.md`
- Modify: `app/catalogo/page.tsx`
- Modify: `next.config.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: novo projeto Vercel, os dois projetos Supabase e todas as funções anteriores.
- Produces: URL pública do catálogo, redirecionamento do endereço antigo e procedimento de recuperação.

- [ ] **Step 1: Aplicar a migração no projeto Supabase do Arthur e executar os advisors de segurança**

Expected: migração registrada; nenhuma tabela de pedido com leitura pública; registrar e corrigir avisos relevantes.

- [ ] **Step 2: Implantar funções nos projetos corretos e configurar segredos fora do repositório**

Publicar `create-order` no catálogo; publicar `catalog-orders` e `sync-catalog` no ERP. Confirmar que logs não exibem chaves ou dados completos do cliente.

- [ ] **Step 3: Criar o projeto Vercel do catálogo com Root Directory `catalog-site`**

Configurar apenas URL e chave publicável no cliente. Confirmar build `Ready` antes de alterar a rota antiga.

- [ ] **Step 4: Executar a sincronização inicial e conferir contagens**

Comparar produtos publicados, variantes disponíveis e imagens por produto entre origem e projeção. Não prosseguir com diferenças inexplicadas.

- [ ] **Step 5: Testar o fluxo em navegador móvel e em outra sessão**

Criar um pedido, confirmar que aparece no ERP em outra sessão, abrir o WhatsApp, confirmar a venda, verificar redução única do estoque e atualização do catálogo. Repetir a mesma solicitação e confirmar ausência de duplicata.

- [ ] **Step 6: Ativar o redirecionamento `/catalogo` e publicar o ERP**

Usar redirecionamento temporário durante estabilização. Validar botão de retorno ao aplicativo e links públicos.

- [ ] **Step 7: Executar verificação final**

Run ERP: `pnpm test && pnpm lint && pnpm build`

Run catálogo: `cd catalog-site; pnpm test && pnpm lint && pnpm build`

Expected: todos concluem com código 0 e o teste manual completo passa.

- [ ] **Step 8: Documentar operação e retorno**

Registrar sincronização manual, inspeção de pedidos falhos e retorno pela remoção do redirecionamento.

- [ ] **Step 9: Commit**

```bash
git add app/catalogo/page.tsx next.config.ts README.md catalog-site/README.md docs/CATALOGO-OPERACAO.md
git commit -m "docs: publish independent catalog"
```
