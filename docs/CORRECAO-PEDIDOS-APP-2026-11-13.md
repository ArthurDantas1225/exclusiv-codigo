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

## Correção da sessão — 13/11/2026

A versão 2.57.0 do SDK usada pelas Edge Functions combina o cabeçalho global `authorization` com `Authorization` criado pelo cliente de autenticação. O resultado era um Bearer duplicado, recusado como sessão inválida. Alterado o cabeçalho global para `Authorization` em catalog-orders e sync-catalog.

O teste de autenticação passou a conferir o cabeçalho efetivamente recebido pelo serviço Auth, em vez de aceitar o token informado ao teste. Reproduzido 401 antes e 200 após a correção com o SDK exato 2.57.0 instalado temporariamente, sem alterar dependências do projeto. Sessões ausentes/inválidas e perfis inativos continuam bloqueados. Os 82 testes do projeto, TypeScript e lint do teste passaram. As duas funções foram publicadas como versão 4 ACTIVE. A confirmação da tela com uma sessão real ainda depende do acesso autenticado do usuário; não foi usada sua senha ou token.
