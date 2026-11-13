# Correção da finalização do catálogo

## Causa confirmada

A mensagem relatada foi “As promoções foram atualizadas. Atualize o catálogo e revise o total.” O serviço recebeu HTTP 409 porque a vitrine usava o fallback de fotografias do ERP e perdia `promotionVersion`/`promotions`: o ERP responde como `version`/`campaigns`. A vitrine enviava versão 0; o servidor exigia versão 2. A normalização agora cobre esses campos e respostas antigas sem metadados.

A investigação também confirmou dois bloqueios anteriores na sincronização: o gateway da função `sync-catalog` verificava um JWT do projeto do catálogo, embora o aplicativo use sessões do projeto ERP; e a rotina PostgreSQL `apply_catalog_snapshot_with_style` tinha uma variável `source_id` ambígua com a coluna. O gateway foi configurado para delegar a autenticação ao handler já existente, que verifica token no Auth do ERP, perfil ativo e organização. Solicitações sem sessão ou com sessão inválida continuam recebendo 401. A rotina foi corrigida sem ampliar permissões; permanece executável apenas pela service_role.

## Recuperação

O banco público estava sem imagens projetadas e com sincronização de produtos de 14/10. Havia 32 variantes exibidas no fallback sem correspondente na validação de pedidos. Após aplicar a migration, a projeção foi recuperada dos campos públicos da organização EXCLUSIV: 68 produtos, 306 variantes e 175 imagens. Nenhum custo, código interno, dado de cliente ou credencial foi projetado. As imagens apontam para as mesmas fotos públicas originais já usadas no fallback; não foram geradas novas fotos.

A conferência posterior encontrou 51 produtos com estoque, 129 variantes exibidas, nenhuma variante ausente na base de pedidos e nenhuma divergência de estoque entre essas variantes. Isso recupera a cópia pública; o estoque original do ERP não foi alterado.

## Evidências

- Teste de regressão reproduziu a perda da versão das promoções e passou após a normalização.
- PGlite reproduziu o erro PostgreSQL 42702 e passou após corrigir o nome da variável, inclusive rejeitando mudança de estilo de snapshot antigo.
- Suite ERP: 80 testes passaram. Suite catálogo: 19 testes passaram.
- Revisão independente: sem achados novos de alta/média gravidade; 10 testes focados passaram.
- Função sync-catalog publicada na versão 3; chamadas sem token e com token inválido retornaram 401 com mensagens controladas.
- Migration remota `20261112211730_fix_catalog_style_snapshot`, igual ao arquivo versionado.
- Um único pedido técnico `EXC-4D693369`, claramente identificado como NÃO É COMPRA / NÃO SEPARAR, recebeu HTTP 200 e URL `https://wa.me/5584996008220` com a mensagem preenchida.
- Esse pedido foi cancelado em seguida. Nenhuma venda, reserva de estoque ou mensagem de WhatsApp foi feita.

O teste confirmou a criação do pedido e a geração do link correto. A abertura do aplicativo WhatsApp no aparelho do cliente depende do navegador/aplicativo instalado; esta sessão não enviou mensagens nem acionou uma compra real.
