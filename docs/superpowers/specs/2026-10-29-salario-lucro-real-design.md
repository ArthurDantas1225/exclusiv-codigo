# Salário de 50% do lucro bruto real

**Data:** 2026-10-29  
**Status:** aguardando aprovação do desenho

## Objetivo

Adicionar ao aplicativo uma estimativa de salário por produto e o cálculo efetivo por venda e por vendedor. O salário corresponde a exatamente 50% do lucro bruto real positivo, considerando o valor efetivamente pago, o custo histórico, descontos, cancelamentos e devoluções.

## Regra de negócio

- Valores monetários continuam armazenados em centavos.
- Estimativa por produto: `máximo(preço atual - custo médio, 0) / 2`.
- Salário efetivo da venda: `máximo(total efetivamente pago - custo histórico, 0) / 2`.
- Cancelamento integral gera salário zero para a venda.
- Devolução reduz a receita e o custo da venda; o salário é recalculado sobre o lucro real restante.
- Prejuízo nunca gera salário negativo nem desconta salário de outra venda.
- Quando a divisão produzir meio centavo, o resultado será arredondado para baixo, garantindo que o salário nunca ultrapasse 50% do lucro.
- O vendedor responsável é o usuário gravado em `sales.created_by`.

Exemplo: preço efetivo de R$ 40,00 e custo de R$ 22,00 resultam em R$ 18,00 de lucro bruto real e R$ 9,00 de salário.

## Fonte dos valores

O cálculo não criará um campo de salário editável nem duplicará valores no banco:

- preço estimado: `products.price`;
- custo médio: média ponderada pelo estoque de `product_variants.cost`;
- valor efetivo: `sales.total`;
- custo histórico: `sales.cost` e `sale_items.unit_cost`;
- devoluções: lançamentos vinculados à venda em `ledger`, incluindo `amount` e `cost_delta`.

Essa derivação preserva as vendas antigas e evita que a alteração futura do custo de um produto mude o salário de uma venda já realizada.

## Interface

### Estoque e seleção para venda

Cada bloco de produto mostrará:

- preço de venda;
- custo médio por peça;
- margem bruta média;
- salário estimado por peça — 50% da margem positiva.

A estimativa é informativa. O valor definitivo só é calculado após desconto e conclusão da venda.

### Detalhe da venda

O detalhe mostrará o lucro bruto real atual e o salário gerado. Após devolução, os dois valores diminuem automaticamente. Vendas canceladas mostram salário zero.

O salário é informação interna e não será incluído no comprovante enviado ao cliente.

### Relatórios

O período selecionado mostrará:

- salário total gerado;
- lucro restante da empresa após o salário;
- tabela por vendedor com vendas, receita líquida, lucro bruto real e salário;
- exportação CSV com as mesmas colunas.

O relatório será calculado no PostgreSQL, sem depender da quantidade de registros carregados na tela.

## Dados e arquitetura

- Centralizar fórmulas puras de custo médio, lucro positivo e salário em um único módulo TypeScript.
- Estender a função `metrics` por uma nova migração, preservando as migrações já publicadas.
- Retornar o total de salário e o detalhamento por vendedor no mesmo intervalo do relatório.
- Derivar os valores a partir dos registros existentes; não adicionar tabela de folha de pagamento nesta etapa.
- Aplicar controle de organização já usado por `my_org()` e não expor dados entre lojas.

## Tratamento de devoluções e períodos

Uma venda gera salário na data da venda. Uma devolução reverte a parcela correspondente na data em que ocorreu. Assim, o relatório mensal representa o movimento real do período. Ao abrir uma venda específica, o aplicativo apresenta seu saldo atual após todas as devoluções.

## Validação

Serão cobertos por testes:

- exemplo de R$ 40,00, custo R$ 22,00 e salário R$ 9,00;
- desconto reduzindo o lucro e o salário;
- venda sem lucro gerando salário zero;
- arredondamento de centavos sem exceder 50%;
- cancelamento zerando salário;
- devolução parcial e integral;
- separação dos totais por vendedor e por organização;
- demonstração e build do aplicativo.

## Fora do escopo

- pagamento ou baixa de salário;
- encargos trabalhistas, comissão adicional, pró-labore ou folha contábil;
- percentuais diferentes de 50%;
- edição manual do salário calculado.

