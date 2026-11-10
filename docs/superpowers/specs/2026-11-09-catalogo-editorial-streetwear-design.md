# Design: catálogo editorial EXCLUSIV

## Intenção

Transformar o catálogo em uma vitrine mobile-first mais marcante, com identidade streetwear, casual e surfwear. A navegação deve dar contexto visual a cada estilo e trocar o ambiente conforme o cliente percorre a página.

## Abordagens

- **Seções editoriais verticais (escolhida):** cada estilo tem uma seção com ambientação e produtos próprios; a pessoa percorre a página e o cenário acompanha a seção ativa. Chips fixos no topo levam diretamente a cada estilo. É a opção que melhor atende ao pedido de mudança visual durante a rolagem.
- **Abas que substituem a grade:** mantém uma única grade e troca o conteúdo ao selecionar um estilo. É mais curta, mas não cria uma experiência de descoberta durante a rolagem.

## Direção escolhida

- Criar seções para **Streetwear**, **Casual** e **Surfwear**, com cenários visuais leves feitos em CSS, sem vídeos ou imagens extras que aumentem o peso e o armazenamento.
- Usar as fotos de produto já existentes nos cards e manter a compra, promoções, busca, filtros, sacola e detalhes atuais.
- Adicionar o campo **Estilo** ao cadastro/edição do produto e sincronizar esse valor com o catálogo público. As opções iniciais são Streetwear, Casual e Surfwear.
- Produtos sem estilo definido continuam visíveis em uma seção geral de novidades, para que a mudança não esconda peças existentes.
- A troca do ambiente acompanha a seção em foco, com movimento discreto; respeitar `prefers-reduced-motion` e manter a rolagem leve em celulares.

## Limites

- Não mudar o fluxo de pedido, a regra de promoções nem o controle de estoque.
- Não inferir o estilo a partir do nome, categoria ou coleção do produto; essa classificação pode estar errada.
- Não adicionar dependências ou mídia de fundo pesada.

## Decisões restantes para implementação

- Integrar o novo campo ao produto principal, à projeção do catálogo separado e às leituras do site.
- Adicionar seção geral para itens sem classificação, preservando todos os produtos disponíveis.
- Verificar catálogo mobile, scroll, animação reduzida, promoções e pedido após a alteração.
