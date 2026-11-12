# Transição visual do catálogo — Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Aplicar o visual aprovado sem perder o fluxo integrado de catálogo e pedido.
**Architecture:** Alterar somente o aplicativo catalog-site; preservar projeção e banco. Extrair filtragem de variantes para uma função pura testável. Manter o servidor como autoridade sobre disponibilidade e valores.
**Tech Stack:** Next.js e React existentes, TypeScript, node:test, CSS nativo.
**Spec:** docs/superpowers/specs/2026-11-12-catalogo-visual-aprovado.md

## Global Constraints
- Fundo #141414, destaque #ff730a, Funnel Sans e Lora.
- Não copiar amostras de produto, contadores, depoimentos ou ofertas fictícias.
- Não publicar, alterar domínio ou gravar pedidos reais durante os testes locais.
- Preservar protocolos de pedido e sincronização; nenhuma dependência de animação.

## Review Focus
- Cor e tamanho precisam existir juntos em uma variante com estoque.
- Resposta de integração não JSON ou redirecionamento não WhatsApp deve produzir erro controlado.
- Envio repetido deve manter a mesma chave enquanto o pedido não mudar.
- Fotos indisponíveis não devem impedir seleção e compra.
- Escape, foco e telas pequenas precisam continuar utilizáveis.

## Task 1: Proteções de regressão
Files: catalog-site/lib/catalog-filter.ts, catalog-site/lib/order-client.ts; testes correspondentes.
- [x] Executar baseline.
- [x] Escrever e observar testes falhando para combinação inválida de variantes e respostas de pedido não JSON/redirecionamento inválido.
- [x] Implementar menor correção e executar suite.

## Task 2: Visual aprovado e acessibilidade
Files: catalog-site/components/public-catalog.tsx, catalog-site/components/catalog-image.tsx, catalog-site/app/globals.css, catalog-site/app/layout.tsx.
- [x] Aplicar cabeçalho, abertura central, grade e cores preservando dados e handlers.
- [x] Usar filtragem validada, foco em diálogos e placeholder de imagens quebradas.
- [x] Executar lint, typecheck, testes e build.

## Task 3: Verificação e entrega
- [x] Prévia local isolada sem configuração de escrita em produção.
- [x] Testar filtros, variante, carrinho, erro de pedido e responsividade.
- [x] Revisar diff e obter revisão independente; corrigir problemas confirmados.
- [x] Documentar mudanças, evidências, limites e reversão; entregar alteração revisável sem publicar.

