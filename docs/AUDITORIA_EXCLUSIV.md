# Auditoria de produto e operação — EXCLUSIV

Leitura do código e do briefing em 19/09/2026. Esta avaliação considera a aplicação Next.js, as cinco migrations, os testes locais e as conversas anteriores sobre a marca. Não equivale a homologação com vendas reais ou a parecer fiscal/contábil.

## O que a EXCLUSIV está construindo

Nas conversas “Criar prompt para Codex”, o pedido foi um ERP/CRM mobile para a loja de streetwear: dois sócios administradores, venda rápida, estoque por tamanho/cor, caixa, clientes, fiado, WhatsApp, indicadores mensais e anuais, Vercel e Supabase. O briefing anexo tem 93 tópicos, dos quais a versão atual cobre o núcleo operacional, mas não todos. A conversa “Direção de Arte Exclusiv” pede uma estética street-art; “Criação de Estampas Streetwear” reforça identidade urbana, premium, editorial, tipografia forte e pouca aparência genérica. “Estruturação de Fornecedores” prioriza organização de contatos, pedido mínimo e serviços/embalagens. “Plano de Marketing Exclusiv” mostra que kits e promoções por coleção são relevantes; os preços citados naquela conversa são exemplos históricos, não preços atuais.

## Mapa atual

| Área | Estado no app | Principal lacuna |
| --- | --- | --- |
| Acesso | Auth com senha, recuperação, dois perfis administradores, RLS por organização; cadastro público desativado | Homologar login dos dois sócios; papéis de funcionário com permissões reais |
| PDV e venda | Carrinho, SKU, desconto, pagamentos mistos, troco, fiado, crédito, cancelamento e devolução | Conciliação de Pix/cartão, impressão térmica, vendas por vendedor em relatório |
| Produto e estoque | SKU por tamanho/cor, custo, preço, foto privada, mínimo, inventário e movimentos | Etiquetas/barcode por câmera, histórico completo por SKU, grade/coleção estruturadas |
| Clientes e CRM | Cadastro, tags, consentimento, fiado, WhatsApp preparado, tarefas | Endereço/aniversário, segmentação automática, campanhas autorizadas e mensuração |
| Compras | Fornecedor, pedido, recebimento parcial e contas a pagar | Pedido mínimo, prazo, frete/custo landed, anexos e status de fornecedor |
| Financeiro | Caixa, DRE gerencial, despesas, contas a pagar/receber | Conciliação bancária/adquirente, taxas e parcelamento efetivos, múltiplos caixas |
| Relatórios | Dashboard, períodos, anual, métodos, exportação CSV | Margem e giro por coleção/SKU, coortes/RFM, metas, filtros por responsável |
| Fiscal | Comprovante de venda não fiscal | Emissão NFC-e/NF-e com CNPJ/UF/regime/certificado e integração SEFAZ |
| Plataforma | PWA, layout responsivo, Storage privado, RLS, auditoria | Backup/restauração ensaiados, observabilidade, alertas automáticos, offline transacional |

## Correções executadas nesta rodada

1. Removida a entrada de demonstração da tela inicial e o atalho por `sessionStorage`. Sem uma conta autenticada e perfil ativo, `/app` redireciona para login; cadastro público continua desativado. A tela pública só oferece login e recuperação de senha.
2. Criada gestão de equipe dentro de Configurações para que um administrador convide **outro administrador/sócio** pelo e-mail e possa suspender ou reativar o acesso de outro integrante. A função Supabase verifica o JWT e o perfil ativo de administrador no servidor, vincula o convidado à organização e registra a ação. Nenhuma chave de serviço vai ao navegador. A publicação foi autorizada explicitamente pelo usuário após uma revisão automática inicial.
3. Mostrado o responsável por venda, cadastro de produto/cliente/fornecedor, compra, tarefa de CRM, caixa, movimentação financeira e estoque. Histórico de vendas e aba Atividade aceitam filtro por pessoa. Atribuição antiga de cadastros depende dos registros de auditoria ainda disponíveis no lote carregado; quando não encontrada, a interface sinaliza “Registro anterior”.
4. Recibo de venda com identidade EXCLUSIV, cliente, atendente, itens, pagamentos, total e identificador permanente. Compartilhamento, impressão e salvar em PDF pelo diálogo de impressão continuam disponíveis. O recibo declara “comprovante não fiscal”; a marca no rodapé é identificação da loja, **não assinatura digital fiscal**.
5. Entrada suave e feedback de toque nos botões, com desativação automática de movimento quando o sistema pede redução de animações. Impressão focada no recibo.

## Prioridade de produto

### P0 — antes de operar sem supervisão

- Homologar com Gabriel e Arthur em sessões reais: login, senha, produto, estoque, caixa, venda, cancelamento, devolução, fiado, recibo e recuperação; executar o roteiro de `VALIDACAO.md` com evidências.
- Implantar matriz de permissões **no banco e na interface**, não só ocultar botões: vendedor pode vender sem ver custos, margens e financeiro; gerente pode liberar descontos/devoluções; sócio administra pessoas, caixa, exportações e configurações. Então habilitar convite de funcionário. Hoje `seller`/`manager` existem no schema, mas o comando de escrita exige `admin` e a leitura financeira é ampla.
- Definir rotina real de backup e restauração do banco, Auth e fotos, com responsável e periodicidade. Ativar monitoramento de erros de venda/autenticação e avisos de estoque baixo.
- Revisar o Security Advisor periodicamente: ele ainda mostra cinco avisos de funções `SECURITY DEFINER` executáveis por contas autenticadas (intencionais para RLS/RPC, mas exigem revisão contínua) e proteção contra senhas vazadas desativada. [Orientação Supabase para senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) e [explicação do aviso de funções](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Definir com contador e dados da empresa qual documento fiscal é obrigatório para a operação e integrar emissor fiscal homologado antes de chamar qualquer recibo de nota fiscal.

### P1 — ganho direto de vendas e controle

- Relatório por vendedor e por SKU/coleção: faturamento, itens, desconto, devoluções e margem, com filtros de período. O banco já tem `created_by` em vendas e movimentos.
- Fluxo de etiquetas com código de barras/QR, leitura por câmera no celular e impressão; kits/promos de conjunto, seguindo a forma como a marca vende camisetas e shorts.
- Conciliação de Pix/cartão e taxas: registrar NSU/ID da transação, data prevista/real de recebimento, estorno e divergência de caixa.
- Histórico de estoque por variante com filtro de autor e motivo; compra com frete, embalagem, prazo e pedido mínimo por fornecedor.
- Recibo em PDF com canal de envio ao cliente, logo e políticas de troca, após confirmar textos e dados legais da empresa. Se desejarem verificação criptográfica, ela exige assinatura no servidor e mecanismo público de validação; o recibo atual não a simula.

### P2 — crescimento e experiência

- CRM com aniversário, frequência/recência/valor, campanhas para clientes que consentiram e resultados medidos; integração WhatsApp Business apenas com opt-in e custo avaliados.
- Múltiplas lojas/estoques/caixas, transferências e permissões por unidade quando a operação crescer.
- Identidade visual refinada: usar fotos reais dos produtos, tipografia com personalidade editorial e laranja EXCLUSIV como acento; microanimações curtas só em transições/feedback, respeitando `prefers-reduced-motion`.
- Central de ajuda contextual, onboarding dos sócios e indicadores de tarefa pendente na tela inicial.

## Comparação de mercado e limite fiscal

Shopify POS permite atribuir vendas a funcionários e controlar ações por permissão; Loyverse também separa acesso ao PDV e ao back office e filtra movimentos de estoque por funcionário. Esses são referenciais de produto, não exigências para copiar integralmente. Fontes: [Shopify — equipe na venda](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/order-management/add-staff-to-sale), [Shopify — permissões](https://help.shopify.com/en/manual/your-account/users/roles/permissions/pos-permissions), [Loyverse — convite e função](https://help.loyverse.com/help/how-give-employees-access-login), [Loyverse — histórico de inventário](https://help.loyverse.com/help/inventory-history-and-valuation).

Uma NFC-e é um documento eletrônico cuja validade envolve assinatura digital do emitente e autorização de uso pela SEFAZ. Um PDF ou recibo visual assinado com a marca não se converte em NFC-e. Referências: [SEFAZ AP — NFC-e](https://sefaz.portal.ap.gov.br/detalhe?id=9) e [Portal NF-e — DANFE NFC-e](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=p4adPc9Q0bA%3D).

## Decisões pendentes dos sócios

- CNPJ, UF, regime tributário, inscrição estadual e emissor/contador para definir emissão fiscal.
- Política de troca, dados de contato e identidade final do recibo.
- Quais ações gerente e vendedor poderão executar sem aprovação de um sócio, e se poderão ver faturamento, custos e clientes.
- Se kits, múltiplos pontos de venda, impressão térmica e leitura por câmera são prioridades imediatas.
