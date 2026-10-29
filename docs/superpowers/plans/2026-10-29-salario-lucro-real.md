# Salário sobre lucro real Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calcular e exibir salário estimado por produto e salário efetivo por venda e vendedor, sempre limitado a 50% do lucro bruto real positivo.

**Architecture:** Centralizar cálculos monetários puros em `lib/profit.ts`; derivar o valor definitivo dos registros históricos já existentes. Uma migração PostgreSQL estende `metrics` com movimentos salariais e agrupamento por vendedor, sem persistir um campo duplicado de salário.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Supabase/PostgreSQL, Node test runner, PGlite.

**Spec:** `docs/superpowers/specs/2026-10-29-salario-lucro-real-design.md`

## Global Constraints

- Salário é 50% do lucro bruto real positivo e nunca ultrapassa esse percentual.
- Descontos, cancelamentos e devoluções alteram o valor definitivo.
- Custos históricos de vendas não podem ser substituídos pelo custo atual do produto.
- Valores em centavos inteiros; meio centavo é arredondado para baixo.
- O salário é interno e não aparece no comprovante do cliente.
- Não adicionar dependências nem criar folha de pagamento ou campo editável.

## Review Focus

- Lucro de R$ 18,00 precisa resultar exatamente em R$ 9,00.
- Desconto que elimina a margem precisa gerar salário zero.
- Uma devolução não pode reverter mais salário do que a venda gerou.
- Cancelamentos não podem aparecer no total salarial.
- Usuários de outra organização não podem aparecer no agrupamento por vendedor.

---

### Task 1: Fórmulas monetárias centralizadas

**Files:**
- Create: `lib/profit.ts`
- Create: `tests/profit.test.ts`

**Interfaces:**
- Produces: `averageVariantCost(variants)`, `positiveGrossProfit(revenue, cost)`, `salaryFromProfit(profit)`, `salaryFromRevenue(revenue, cost)` e `currentSaleProfit(sale, entries)`.

- [ ] **Step 1: Write the failing tests** para custo médio ponderado, R$ 40/R$ 22/R$ 9, desconto sem margem, centavo ímpar, cancelamento e devolução.
- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/profit.test.ts`
Expected: FAIL porque `lib/profit.ts` ainda não existe.

- [ ] **Step 3: Implement the minimal pure functions** em `lib/profit.ts`, aceitando apenas números inteiros em centavos e estruturas mínimas de venda/lançamento.
- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/profit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add lib/profit.ts tests/profit.test.ts && git commit -m "feat: centralize real-profit salary rules"`

### Task 2: Métricas salariais no PostgreSQL

**Files:**
- Create: `supabase/migrations/20261029150000_salary_metrics.sql`
- Modify: `tests/database.test.ts`

**Interfaces:**
- Consumes: regra de centavos e arredondamento da Task 1.
- Produces: `public.salary_metrics(start_date, end_date)` e novos campos `salary` e `seller_salary` em `public.metrics`.

- [ ] **Step 1: Write failing database assertions** cobrindo venda com desconto, venda sem lucro, cancelamento, devolução, teto da reversão e isolamento por organização.
- [ ] **Step 2: Run the focused database test to verify it fails**

Run: `node --test --test-name-pattern="salary metrics" tests/database.test.ts`
Expected: FAIL porque a migração/função ainda não existe.

- [ ] **Step 3: Implement the migration** com eventos de venda e devolução agrupados por `sales.created_by`, proteção por `my_org()` e substituição compatível de `metrics`.
- [ ] **Step 4: Load the migration in the PGlite setup and run the focused test**

Run: `node --test --test-name-pattern="salary metrics" tests/database.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the complete database suite**

Run: `node --test tests/database.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

Run: `git add supabase/migrations/20261029150000_salary_metrics.sql tests/database.test.ts && git commit -m "feat: report salary by real profit and seller"`

### Task 3: Exibição no estoque, venda e relatórios

**Files:**
- Modify: `components/stock-product-card.tsx`
- Modify: `components/pos.tsx`
- Modify: `components/sales.tsx`
- Modify: `components/reports.tsx`
- Modify: `components/dashboard.tsx`
- Modify: `components/provider.tsx`
- Modify: `lib/metrics.ts`
- Modify: `app/globals.css`
- Create: `tests/salary-ui.test.ts`

**Interfaces:**
- Consumes: helpers da Task 1 e os campos `salary`/`seller_salary` da Task 2.
- Produces: estimativa nos produtos e sacola, salário atual na venda, DRE com salário e tabela/CSV por vendedor.

- [ ] **Step 1: Write a failing UI contract test** que exige os rótulos internos, uso dos helpers compartilhados e ausência de salário no texto do comprovante.
- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/salary-ui.test.ts`
Expected: FAIL porque as telas ainda não exibem salário.

- [ ] **Step 3: Add the new metric types and demo calculation** em `lib/metrics.ts`, mantendo a consulta completa no banco em produção.
- [ ] **Step 4: Replace duplicated average-cost formulas and render salary estimates** no estoque e no PDV, incluindo a sacola após desconto.
- [ ] **Step 5: Render current salary in sale details** usando custo histórico e lançamentos de devolução, sem alterar o comprovante.
- [ ] **Step 6: Add salary to the DRE and seller report/CSV** e subtrair salário do resultado operacional estimado.
- [ ] **Step 7: Adjust responsive styles** para quatro métricas no estoque e leitura mobile.
- [ ] **Step 8: Run the UI contract test**

Run: `node --test tests/salary-ui.test.ts`
Expected: PASS.

- [ ] **Step 9: Run typecheck, lint and build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: todos com exit code 0.

- [ ] **Step 10: Commit**

Run: `git add components lib app/globals.css tests/salary-ui.test.ts && git commit -m "feat: show salary across products sales and reports"`

### Task 4: Validação integral e publicação

**Files:**
- Modify only if a verified failure requires a fix.

**Interfaces:**
- Consumes: Tasks 1–3 completas.
- Produces: commit publicado, migração aplicada e produção verificada.

- [ ] **Step 1: Run all automated checks**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: todos com exit code 0.

- [ ] **Step 2: Review the whole diff** contra a especificação, com atenção aos cinco itens de Review Focus.
- [ ] **Step 3: Apply the Supabase migration** ao projeto vinculado e confirmar que `metrics` retorna `salary` e `seller_salary`.
- [ ] **Step 4: Push `main`** para o repositório conectado à Vercel.
- [ ] **Step 5: Verify production** no estoque, PDV, detalhe de venda e relatórios, sem expor salário no recibo.
