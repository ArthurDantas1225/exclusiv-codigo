# Pedidos do catálogo na aba Pedidos do aplicativo

## Causa

Os pedidos estavam salvos no projeto do catálogo: a consulta de diagnóstico encontrou 3 pendentes e 2 cancelados. Os registros de invocação mostraram create-order retornando 200 e catalog-orders retornando 403.

A função catalog-orders executava `auth.getUser(token)` corretamente, mas seu cliente ERP não tinha o mesmo Bearer nos headers das consultas ao banco. A leitura do perfil era feita sem a sessão do funcionário e barrada pela política de acesso, produzindo “Acesso suspenso”.

## Correção

O cliente ERP da função agora encaminha o Bearer recebido também às consultas. Permanecem obrigatórios token válido e perfil ativo. A função não concede acesso anônimo. A configuração do gateway continua delegando a autenticação ao handler, porque a sessão pertence ao projeto ERP, e não ao projeto do catálogo.

Função `catalog-orders` publicada na versão 3, projeto `sduacssupdhzwqmlijqv`. Nenhum pedido foi recriado, confirmado, cancelado ou removido nesta correção. Nenhuma venda ou alteração de estoque foi realizada.

## Verificações

- Teste de integração executa o handler real transpilado com o cliente Supabase e respostas HTTP controladas. Antes da correção, sessão válida recebia 403; depois recebe 200 e os pedidos salvos.
- Sessões ausentes, inválidas e de perfil inativo continuam sem acesso aos pedidos.
- Suite completa do aplicativo: 82 testes passaram.
- TypeScript e lint do teste passaram.
- Na função publicada, verificadas respostas 401 para ausência de sessão e token inválido.
- Tentativa de conferência da tela privada no navegador do agente exigiu login; não foram lidas credenciais nem validada a listagem com uma sessão real da equipe nessa etapa.

Após a publicação, basta atualizar/reabrir a aba Pedidos em uma sessão válida da equipe. Pedidos já registrados não precisam ser enviados novamente.
