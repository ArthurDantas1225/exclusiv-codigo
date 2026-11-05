# Promoções por quantidade — design

## Intenção

Permitir que administradores configurem campanhas de desconto por quantidade e que o cliente veja o benefício no catálogo. A mesma regra deve valer no catálogo online e no ponto de venda do app, conforme escolha do usuário.

## Objetivos

- Criar, editar, ativar, pausar e excluir campanhas em Configurações > Promoções.
- Definir nome, período opcional, canais (catálogo, app ou ambos), produtos/categorias elegíveis e limites de quantidade.
- Oferecer formatos distintos: desconto percentual por faixa de quantidade; desconto fixo em reais a partir de uma quantidade; preço fechado por grupo de unidades; e “compre X, ganhe Y” com as unidades gratuitas de menor preço dentro do grupo elegível.
- Mostrar a promoção aplicável, subtotal, desconto e total no catálogo e na sacola do POS.
- Persistir o desconto no pedido online, na confirmação da venda, no histórico e nos totais financeiros.
- Validar o desconto no servidor nos dois canais; o navegador só apresenta uma prévia.

## Fora de escopo

- Cupons digitados pelo cliente, programas de fidelidade, preços por cliente ou combinações de descontos em cascata.
- Agendamento recorrente ou integração com plataformas externas de anúncios.

## Regras propostas

- Uma campanha tem faixas de quantidade crescentes; por exemplo, 3 unidades dão 10% e 5 unidades dão 15%. A maior faixa atingida se aplica.
- A quantidade elegível é contada por campanha e só inclui produtos/variantes correspondentes ao escopo escolhido. Produto e categoria podem ser selecionados; “todos os produtos” é o padrão.
- Campanhas que atingem o mesmo produto no carrinho formam um grupo concorrente; dentro dele vale a campanha que gerar a maior economia total para os itens elegíveis do carrinho. Campanhas que não disputam nenhuma peça presente podem valer juntas. Em caso de empate, vence a campanha com menor prioridade e, persistindo, a mais antiga.
- Preço fechado por grupo e “compre X, ganhe Y” repetem em grupos completos: por exemplo, 6 unidades em “compre 2, ganhe 1” dão 2 unidades grátis; sobras fora de grupos completos são cobradas pelo preço normal.
- O desconto promocional é calculado sobre os preços originais e não pode exceder o subtotal elegível. No POS, o desconto manual existente é aplicado depois da promoção sobre o saldo já promocional; o total de descontos nunca excede o subtotal da venda.
- Um pedido online conserva o preço, a campanha e o desconto calculados quando foi enviado, mesmo que a campanha seja editada antes da equipe confirmar o pedido.
- Moeda é calculada em centavos e a vigência usa o fuso operacional `America/Fortaleza`.

## Abordagens consideradas

1. **Somente catálogo:** menos alterações no POS, mas os pedidos convertidos em venda poderiam perder o desconto ou ter valor diferente no caixa.
2. **Catálogo e app com cálculo confiável no servidor (selecionada):** regras consistentes entre os canais; requer sincronizar configuração entre os dois projetos Supabase e validar novamente ao criar pedidos e vendas.

O usuário escolheu aplicar as promoções no app e no catálogo.

## Desenho técnico

- A configuração versionada fica na base principal do ERP, acessível somente à equipe autenticada. Um endpoint público dedicado retorna apenas as regras e os campos necessários ao catálogo; nenhum custo, margem ou dado interno acompanha essa projeção. A base separada do catálogo continua armazenando produtos, fotos e pedidos.
- A configuração tem uma única fonte de verdade, evitando publicação parcial entre os dois projetos. O catálogo recebe a versão atual pelo endpoint público sem cache prolongado; cada pedido congela a versão e o desconto retornado pelo servidor.
- O editor de campanhas é uma nova área em Configurações, com prévia dos descontos para os exemplos configurados.
- O catálogo recebe campanhas ativas pelo endpoint público e calcula apenas uma prévia. A função de criação de pedidos atualiza as campanhas no mesmo endpoint, calcula o benefício com os preços e estoque da base do catálogo e salva subtotal, desconto, campanhas e versão aplicada junto ao pedido.
- A lista de pedidos pendentes exibe o desconto salvo; ao confirmar, o POS transfere esse desconto para a venda sem calcular uma segunda promoção.
- O POS calcula uma prévia usando a versão publicada sincronizada no ERP e o RPC de venda recalcula essa mesma versão. O desconto discricionário já existente continua separado e é aplicado após a promoção.
- As telas registram subtotal, desconto promocional, desconto manual e total de forma distinta sempre que os dados estiverem disponíveis.

## Restrições e decisões deixadas ao implementador

- Preservar validações de estoque, idempotência, isolamento por organização e fluxo atual de pedidos/WhatsApp.
- Usar migrações nos dois projetos Supabase; configurar RLS e grants compatíveis com o acesso público somente de leitura às campanhas publicáveis.
- Manter as dependências atuais; validar datas, quantidades, percentuais, valores e seleção de produtos/categorias no cliente e no servidor.
- Limites propostos: até 20 campanhas ativas, 10 faixas por campanha, desconto até 90%, compra/ganhe até 10 itens por grupo e validade opcional. O empate usa prioridade configurada e depois antiguidade, conforme regra acima.

## Critérios de aceite

- Um administrador consegue criar e alterar campanhas de cada formato e escolher canal e produtos/categorias elegíveis.
- O catálogo mostra o desconto e envia no WhatsApp o mesmo total salvo no pedido pendente.
- Ao confirmar um pedido promocional, a venda, pagamentos, lucro e relatório usam o total com desconto salvo.
- No POS, campanhas elegíveis atualizam a sacola automaticamente; o registro mantém separados o desconto promocional e o manual.
- O catálogo mostra a regra atual e o pedido congela o total confirmado pelo servidor, inclusive se a campanha mudar posteriormente.
- Nenhuma promoção desconta mais que o subtotal, aplica duas regras concorrentes sobre as mesmas unidades ou vaza custo/margem.
