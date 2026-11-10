# Implementação do catálogo editorial EXCLUSIV

> **Execução:** Native, nesta sessão, conforme o pedido para aplicar a opção A.

**Objetivo:** Transformar o catálogo público em uma vitrine mobile-first com seções verticais para Streetwear, Casual e Surfwear, mantendo visíveis produtos sem classificação.

**Arquitetura:** Salvar um campo de estilo no produto do ERP, copiá-lo para a base pública do catálogo pelo fluxo de snapshots já existente e renderizar as seções no site independente. Chips fixos levam às seções; `IntersectionObserver` acompanha a seção atual para alternar a ambientação CSS sem arquivos de mídia novos.

**Stack:** Next.js 16, React 19, Supabase PostgreSQL/Edge Functions e CSS existente.

**Especificação:** `docs/superpowers/specs/2026-11-09-catalogo-editorial-streetwear-design.md`.

## Restrições

- Não alterar compra, pedido, promoções ou estoque.
- Produtos sem estilo definido ficam na seção geral de novidades.
- Fundos são feitos em CSS, leves e compatíveis com `prefers-reduced-motion`.
- Não adicionar dependências.

## Foco de revisão

- Produtos antigos com estilo vazio continuam visíveis na seção geral.
- Cada estilo mostra somente seus próprios produtos e os links levam à seção correta.
- Campanhas, busca, filtros, sacola e detalhes continuam presentes.
- Animações são reduzidas quando `prefers-reduced-motion` está ativo.
- Mudança de estilo salva no ERP e chega ao catálogo sincronizado.

## Arquivos e tarefas

### Tarefa 1: Persistir o estilo nos produtos do ERP

**Arquivos:**
- Criar migration `supabase/migrations/*_product_style.sql` com coluna `products.style` e atualização do wrapper `save_product_grid_with_taxonomy`.
- Modificar `lib/types.ts` e `components/product-editor.tsx` para salvar Streetwear, Casual ou Surfwear, permitindo vazio para itens ainda não classificados.

**Resultado:** Editar/salvar um produto conserva o estilo sem alterar campos existentes nem forçar a classificação de produtos antigos.

### Tarefa 2: Sincronizar estilo para o catálogo público

**Arquivos:**
- Criar migration `supabase-catalog/migrations/*_catalog_product_style.sql` para a coluna correspondente e ajuste do snapshot `apply_catalog_snapshot`.
- Modificar `supabase-catalog/functions/_shared/catalog-projection.ts`, `supabase-catalog/functions/sync-catalog/index.ts` e `catalog-site/lib/catalog-client.ts` para transportar e ler `style`.
- Atualizar o schema local relevante em `supabase-catalog/` se necessário para manter os snapshots reprodutíveis.

**Resultado:** A alteração de estilo feita no ERP aparece na próxima sincronização do produto, sem exigir foto nova.

### Tarefa 3: Criar a vitrine editorial

**Arquivos:**
- Modificar `catalog-site/components/public-catalog.tsx` para uma seção geral, três seções temáticas e navegação fixa por âncoras.
- Modificar `catalog-site/app/globals.css` com cenários de cidade, tons casuais quentes e praia/oceano; manter o grid compacto de produtos e o pedido fixo mobile.
- Modificar `components/public-catalog.tsx` e o CSS principal para manter a mesma apresentação na rota `/catalogo` do app.

**Resultado:** A seção atual acompanha a rolagem e muda apenas o tratamento visual; filtros, promoções, seleção de variantes, pedidos e WhatsApp continuam usando os fluxos atuais.

### Tarefa 4: Verificar e publicar

- Ler o guia Next.js 16 instalado e conferir os contratos atuais de migrations/sincronização Supabase antes de editar.
- Executar lint, TypeScript e builds dos dois projetos; revisar `git diff --check`.
- Inspecionar localmente a versão mobile e desktop, inclusive movimento reduzido, estoque/promoções, seleção de produto e envio de pedido.
- Aplicar as migrations nos dois projetos Supabase e publicar o commit para as implantações Vercel conectadas.

**Concluído quando:** os checks passam, os estilos sincronizam até a base pública e a implantação de produção fica `READY`.
