# Pix Inter com conferência manual — 13/11/2026

Implementado QR EMV Pix e Copia e Cola com valor canônico do pedido, chave aleatória cadastrada pelo titular, configuração administrativa privada e snapshot imutável por pedido. A conferência de titularidade é feita no aplicativo bancário; o site não consulta DICT nem confirma recebimento automaticamente.

Novos pedidos Pix configurados ficam aguardando conferência. Usuário ativo da organização confirma o crédito no Inter com confirmação explícita; função transacional bloqueia linha e preserva primeiro autor/data em repetições. Registro da venda e baixa de estoque continuam separados. Backend impede venda antes de conferir e impede registrar Pix recebido como dinheiro/cartão; confirmação remota exige venda ERP com request_id correspondente.

Web Push privado para equipe, nos estados aguardando conferência e pago. VAPID e segredo interno gerados fora do Git e armazenados em tabelas sem permissões públicas; membresia ativa revalidada no ERP por função interna com segredo. Outbox única por pedido/estado, lease, retentativas limitadas, remoção de subscriptions expiradas. Sem dados do cliente na notificação. Logout cancela assinatura no dispositivo.

Migrações aditivas aplicadas nos dois bancos. Edge create-order, catalog-orders, team-notifications e sale-with-promotions publicadas. Smoke do dispatch de produção: HTTP200 delivered:0, sem dispositivos cadastrados no momento. Deno validou geração criptografada Web Push. Testes do app e do catálogo, TypeScript e lint direcionado passaram. Entrega em iPhone real depende de instalar PWA, permitir notificações e testar no dispositivo; não foi alegada como validada.

iPhone: Safari > Compartilhar > Adicionar à Tela de Início; abrir ícone, entrar no app, Pedidos > Ativar notificações > Permitir. Requer iOS16.4+ e permissões do sistema. QR local de conferência separado de pedidos reais foi gerado em armazenamento de visualizações; não houve transferência bancária.
