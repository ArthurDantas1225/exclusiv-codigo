# Operação do catálogo independente

## Fluxo

O ERP é a fonte oficial de produtos e estoque. Cada alteração relevante chama `sync-catalog`, que envia ao Supabase do catálogo apenas nome, classificação, preço de venda, variações, estoque público e fotos. Custos, margens, usuários, fornecedores, caixa e dados financeiros permanecem no ERP.

O cliente finaliza o carrinho no site público. A função `create-order` valida preço e disponibilidade no banco do catálogo, grava o pedido com uma chave idempotente e só então devolve o link do WhatsApp. O pedido continua salvo mesmo se o WhatsApp não abrir.

No ERP, Pedidos do catálogo consulta os pedidos remotos. Ao confirmar, o ERP usa o ID do pedido como `request_id`, registra uma única venda, marca o pedido como confirmado e sincroniza o estoque atualizado.

## Recuperação

1. Abra Produtos no ERP como administrador e use **Sincronizar catálogo** para refazer a projeção completa.
2. Se um produto falhar, confira se a foto original ainda existe no bucket `products` e repita a sincronização.
3. Pedidos nos estados `pending`, `failed` ou `importing` continuam visíveis no ERP para nova tentativa.
4. Se o catálogo precisar voltar temporariamente ao aplicativo antigo, remova `CATALOG_SITE_URL` do projeto Vercel do ERP e publique novamente. Nenhum pedido ou produto é apagado por esse retorno.

## Segredos e acesso

- No catálogo/Supabase: `CATALOG_SITE_ORIGIN` limita a origem que cria pedidos.
- Na Vercel do catálogo: apenas as variáveis `NEXT_PUBLIC_*` documentadas em `catalog-site/.env.example`.
- A chave administrativa nunca deve entrar no Git, no navegador ou em logs.

As funções de sincronização e pedidos rodam no projeto do catálogo e validam o token do usuário no Auth do ERP. Assim, nenhuma chave `service_role` é copiada entre contas.

## Verificação após publicação

Confirme que a vitrine abre em uma sessão anônima, que produtos ocultos e custos não aparecem, que um pedido é salvo antes do WhatsApp, que ele aparece no ERP em outra sessão e que confirmar duas vezes não cria uma segunda venda. Depois de uma venda, confira se o estoque diminuiu uma vez no ERP e reapareceu atualizado no catálogo.
