# Escopo e limites conhecidos

## Implementado

- Login Supabase Auth com perfil administrativo e organização; dois sócios com a mesma função.
- Dashboard com agregações SQL, faturamento, caixa, alertas, gráfico do mês e atalhos.
- Produtos, SKU, barcode por teclado, tamanho configurável, cor, custo, preço e estoque mínimo.
- Movimentações rastreáveis e inventário com bloqueio quando há alterações durante a contagem.
- PDV, carrinho, ajuste de preço administrativo, desconto, cliente rápido, pagamento misto, troco, fiado e crédito na loja.
- Venda transacional e idempotente, snapshots históricos, recibo, cancelamento e devolução parcial.
- Caixa, fechamento com diferença, suprimento, sangria, receita avulsa e despesa paga.
- Contas a pagar, recorrência após quitação, fornecedores, pedidos e recebimentos parciais.
- Fiado com limite, recebimentos parciais, cobrança revisável no WhatsApp e histórico de conta.
- Perfil de cliente, tags, consentimento, edição, anonimização e CRM com lembretes e funil simples.
- Relatórios agregados por período, visão anual, pagamentos e DRE gerencial.
- Importação CSV com prévia/validação/lote atômico; exportação de listas e do resumo mensal.
- Supabase Storage privado e compressão de fotos; primeira foto principal.
- PWA com manifest/ícones e tela offline, sem sincronização de operações.
- RLS, grants restritos, chaves estrangeiras por organização, trilha de auditoria e testes SQL.

## Ainda não coberto integralmente pelo briefing extenso

- Vercel, Supabase e contas reais estão configurados, mas Arthur ainda precisa confirmar o acesso e definir sua senha. O SMTP personalizado temporário com Gmail foi salvo e o Supabase aceitou um envio de recuperação para Arthur; a entrega na caixa de entrada e o primeiro login ainda não foram confirmados.
- Não foram executados testes integrados contra Auth, PostgREST e Storage de um Supabase real; testes locais simulam `auth.uid()` e executam o PostgreSQL das migrations.
- Não há integração fiscal, adquirente, WhatsApp Business API, leitura pela câmera, push externo ou offline transacional.
- Cartões têm estrutura inicial de parcelas/taxas/data prevista no banco; interface de conciliação e liquidação futura ainda não implementada.
- Categorias e coleções são textos livres no produto. Não há cadastros relacionais próprios, promoção programada, combos ou rateio de frete em compras.
- Troca usa devolução vinculada e nova venda. Não há transação única envolvendo simultaneamente a peça devolvida e a nova peça; o operador deve concluir ambas.
- Limite de crédito é bloqueante. Não há fluxo de exceção administrativa com justificativa.
- Grupos, comparações e rankings avançados por produto/categoria/coleção/tamanho/cor, retenção e RFM configurável não estão completos.
- Segmentos de clientes e tempo sem venda são análises locais dos registros carregados; carregue lotes anteriores para ampliar o histórico. Totais globais e saldos financeiros são calculados no banco.
- A lista de vendas oferece filtros por data, status e cliente/número. Filtros combinados por produto, categoria, pagamento e vendedor ainda não estão completos.
- Cadastro do cliente é enxuto: não inclui endereço, CPF, aniversário ou preferências estruturadas. Consentimento é booleano; não há gestão de documentos comprobatórios.
- O template WhatsApp salvo nas configurações ainda não substitui todas as mensagens específicas de recibo e cobrança.
- A primeira foto é principal; reordenação/remoção de imagens e alteração da principal ainda não têm interface.
- O aplicativo permite convite e suspensão/reativação de administradores em Configurações → Usuários. `manager` e `seller` estão previstos no schema, mas ainda não têm matriz de permissões segura: somente admin pode escrever e as leituras de dados financeiros precisam ser separadas antes de convidar funcionários.
- Uma sessão de caixa por organização, não caixas independentes por terminal.
- Cancelamento de fiado é bloqueado quando o cliente já tem recebimentos; use o fluxo de devolução/crédito e concilie a conta. Não há alocação de cada recebimento a parcelas específicas.
- A paginação de listas é manual. Exportações CSV dessas listas não são exportações irrestritas do banco.

Essas limitações impedem tratar a entrega como implementação integral dos 93 tópicos ou como aplicação já homologada para produção. O núcleo está preparado para conexão, testes integrados e evolução.
