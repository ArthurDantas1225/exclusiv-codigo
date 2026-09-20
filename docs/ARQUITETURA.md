# Arquitetura

O HTML de referência tinha quatro telas, armazenamento local e cancelamento que removia a venda. A nova aplicação preserva fundo escuro, cartões, laranja e números monoespaçados, mas separa UI, domínio e persistência.

## Modelo

`organizations` → `profiles` (Auth), `products` → `product_variants` / `product_images`, `customers`, `sales` → `sale_items` / `sale_payments`, `ledger`, `cash_sessions`, `inventory_movements`, `inventory_counts` → `inventory_count_items`, `crm_tasks`, `suppliers` → `purchase_orders` → `purchase_order_items`, `accounts_payable`, `app_settings`, `audit_logs`, `operation_keys`.

O ledger reúne lançamentos com origem explícita. Débito de cliente é positivo; recebimento e crédito são negativos na conta. O recebimento em dinheiro tem sinal invertido apenas na composição do saldo físico do caixa. Crédito utilizado volta a aumentar o saldo da conta, sem movimentar caixa. Compras pagas afetam o caixa; mercadorias são reconhecidas no resultado pelo CMV ao vender, evitando dupla despesa.

## Operação crítica

UI validada → Supabase RPC `command` → autenticação e perfil ativo/admin → lock por organização → chave idempotente → validações → gravações de venda/itens/pagamentos/estoque/ledger → auditoria → commit.

Qualquer exceção desfaz o comando inteiro. A função `command_core` e `move_stock` ficam privadas para usuários da API. Leituras usam RLS e referências compostas impedem ligações entre tenants. O navegador não recebe chave administrativa.

## Apresentação

Barra inferior no mobile, sidebar no desktop, formulários em dialog/bottom sheet, safe areas, feedback, skeleton, estados vazios, ação de sacola fixa no celular. Valores e datas são centralizados em `lib/format.ts`. Sem dados reais, a demonstração informa explicitamente que é de leitura.

## Decisões

- CSS próprio com tokens: evita dependência de um kit visual para uma interface pequena e específica.
- Next.js oficial e Vercel conforme pedido; não foi usado hosting alternativo do plugin Sites.
- PostgreSQL executa as regras críticas, não apenas o frontend.
- Sem sincronização financeira offline.
- Contas e transações financeiras não são excluídas silenciosamente.
- Demonstração em memória isolada da produção, sem seed automático no banco.
