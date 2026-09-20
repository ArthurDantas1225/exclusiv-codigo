# Validação e homologação

## Executado localmente

- TypeScript: sem erros.
- ESLint: sem erros (reexecutado após os ajustes finais).
- Build Next.js de produção: compilação, checagem de tipos e geração de páginas concluídas.
- PostgreSQL via PGlite e testes unitários: 25 cenários aprovados.
- Navegador: a versão publicada em 19/09/2026 mostra login e recuperação, sem acesso à demonstração; `/app` sem sessão redireciona para `/login`.
- Viewport mobile 390 × 844: dashboard e PDV inspecionados visualmente; dez rotas adicionais verificadas sem largura excedente do documento.
- Na revisão anterior, o PDV de demonstração foi exercitado; essa entrada pública foi removida. O fluxo real com os dois sócios ainda precisa de homologação.

Os testes PostgreSQL simulam o schema Auth e a identidade JWT. Eles validam as migrations do domínio, mas **não substituem** testes com Supabase Auth, PostgREST e Storage reais. Não foi usado um login fictício como prova de autenticação real.

## Detalhes do produto no PDV em 20/09/2026

- O cartão da aba Vender exibe foto de capa, categoria, quantidades por cor/tamanho, preço de venda, custo médio e margem; as opções mostram custo e estoque. A sacola usa a foto da cor selecionada, com fallback para a capa.
- No painel publicado, o produto “Camisa Street 2pac” mostrou foto e custos. Ao adicionar a opção Branca / G à sacola temporária, apareceu a miniatura da peça branca, a variação e os valores. O layout foi inspecionado em 390 × 844. A venda não foi concluída e o estoque não foi alterado.
- TypeScript, ESLint, build de produção e 26 testes passaram.

## Avisos temporários em 19/09/2026

- Avisos comuns do catálogo e do painel fecham em dois segundos; a opção Desfazer de uma peça removida ou de uma ação reversível do painel fecha em quatro segundos.
- No catálogo publicado em viewport 390 × 844, adicionar uma peça exibiu um aviso pequeno acima da barra do pedido e ele desapareceu automaticamente. A remoção exibiu Desfazer em aviso compacto; ele também desapareceu após o prazo. A navegação de teste não enviou pedido nem alterou o estoque.
- Testes: 25 aprovados; ESLint, TypeScript e build de produção passaram.

## Vitrine compacta em 19/09/2026

- A referência `coreonfit.vendizap.com` foi inspecionada em largura mobile: usa categorias rápidas e grade de duas colunas. A EXCLUSIV mantém a seleção de cor/tamanho em um detalhe próprio, com cartões menores e sem criar produtos separados para cada cor.
- Na publicação, o catálogo em 390 × 844 mostrou cabeçalho, busca, categorias e o primeiro cartão a partir de aproximadamente 430 px de altura. O cartão tem cerca de 169 px de largura; a página não ultrapassou a largura do documento.
- Filtro de categoria, remoção individual do filtro, abertura do produto e detalhe com fotos e variações funcionaram no navegador. Nenhum erro de console apareceu nessa verificação. Atualmente somente um produto está publicado; outros cartões aparecerão quando a equipe publicar mais produtos.
- Testes: 25 aprovados; ESLint, TypeScript e build de produção passaram. Nenhuma mudança de banco ou dado de produção foi feita nesta revisão.

## Navegação de retorno em 19/09/2026

- Todas as rotas internas exceto a página inicial exibem Voltar. O histórico de páginas do app é guardado na sessão; links diretos usam um destino da seção correspondente.
- As janelas abertas pelo componente de edição, o detalhe do produto no catálogo e o visualizador de fotos exibem Voltar para o nível anterior.
- Em produção, um produto aberto por link direto retornou ao estoque. O mesmo produto aberto pelo cartão do estoque mostrou Voltar; o editor retornou ao detalhe sem salvar. No catálogo, a galeria retornou ao produto e o produto à vitrine. Nenhum dado de produção foi alterado nesses testes.
- TypeScript, ESLint, build de produção e 25 testes passaram nesta revisão.

## Revisão de produto e catálogo em 19/09/2026

- A terceira revisão agrupou as variações em um cartão por produto no estoque, com foto, opções, códigos, custo médio e margem bruta média. A grade por SKU abre dentro do mesmo cartão. O catálogo ganhou busca, categorias e filtros de subcategoria, cor e tamanho, além de visualizador de tela cheia que percorre fotos de todas as cores.
- A migration `20260919193842_product_subcategory.sql` foi aplicada no Supabase real e sua função de gravação pode ser executada por usuários autenticados, não por anônimos. A função pública `catalog` foi atualizada para incluir a subcategoria e até 30 fotos por produto, sem expor custos. A versão web foi publicada na Vercel.
- No navegador real, “Camisa Exclusiv Catedral” apareceu em um único cartão com foto e oito variações, seis peças, custo médio de R$ 21,00 e margem bruta média de R$ 39,00. O editor abriu com as categorias e subcategorias; não foi salvo para evitar alterar dados reais. O catálogo mobile em 390 × 844 exibiu a busca e os filtros, e a galeria ampliada mostrou a foto inteira e navegou de Preta/Frente para Branca/Costas. Não houve rolagem horizontal nem erros de console nas telas verificadas.
- TypeScript, ESLint, build de produção e 24 testes passaram. O cadastro real de uma subcategoria ainda depende de o administrador escolher a opção adequada para cada produto existente.

- A segunda revisão passou em TypeScript, ESLint e 22 testes. A migration `20260919190000_product_grid_media_undo.sql` foi aplicada no Supabase real. Ela permite salvar produto e grade de cores/tamanhos/quantidades numa transação e ocultar/restaurar produtos e fotos, com registro de auditoria. A função pública `catalog` foi atualizada para devolver fotos identificadas por cor e lado com URLs temporárias.
- A interface nova foi publicada na Vercel. No navegador autenticado, o produto real “Camisa Street exclusiv” mostrou duas combinações com quatro peças cada e o editor unificado abriu com os valores existentes. A tela foi inspecionada em 390 × 844, inclusive a grade de estoque. Nenhum produto, estoque ou foto foi alterado durante essa inspeção.
- No catálogo público, o mesmo produto apareceu e o detalhe abriu com seleção de cor, tamanho e quantidade. As três imagens atuais são artes sem cor/lado identificados; elas aparecem como imagens gerais, com aviso claro. Para mostrar a camisa exata ao selecionar Branca ou Preta, a equipe ainda precisa enviar fotos das peças e marcar cor e frente/costas na seção Fotos do produto.
- O catálogo tem links diretos para Instagram e WhatsApp e o título “Escolha suas peças exclusivas”. A montagem da mensagem de pedido foi testada sem duplicação de nome e total. O envio real pelo WhatsApp e uma venda real não foram executados.

- A migration anterior `20260919174030_product_catalog_flow.sql` também está aplicada. A função pública `catalog` é GET com `verify_jwt=false` e expõe apenas itens publicados. Após login feito pelo sócio no navegador, a tela inicial mostrou o acesso grande de venda e métricas do dia.
- As 12 rotas autenticadas de produtos, clientes, vendas, financeiro, CRM, relatórios, inventário, configurações, alertas, compras, fornecedores e importação abriram seus títulos sem erro visível. A aba ativa mudou para Estoque e Mais em navegação real. A página Mais foi inspecionada visualmente e os cartões mostram descrições e ícones. Nenhum erro apareceu no console durante o percurso.
- O sócio cadastrou no projeto real duas variações com custo/estoque e publicou o produto. O envio real pelo WhatsApp e uma venda real ainda não foram testados. Um pedido enviado pelo WhatsApp não reserva estoque nem cria venda no ERP.
- O Security Advisor não apontou tabela sem RLS. Mantém alertas para oito funções `SECURITY DEFINER` intencionalmente executáveis apenas por usuários autenticados, com verificações internas de organização e papel; consulte [a regra do linter](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). A [proteção contra senhas vazadas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) do Supabase Auth segue desativada no projeto e deve ser avaliada pelo administrador.

## Revisão de acesso e publicação em 19/09/2026

- TypeScript, ESLint, build Next.js e 16 testes PostgreSQL concluíram sem erros. A versão final foi publicada na Vercel e a página `/login` foi inspecionada visualmente.
- Uma tentativa de abrir `/app` sem sessão retornou à tela de login; a opção de demonstração não apareceu.
- A Edge Function `manage-team` ficou ativa com `verify_jwt=true`. Uma chamada POST sem autenticação retornou HTTP 401; o preflight CORS do domínio publicado retornou HTTP 204 e a origem esperada.
- O convite real a um novo administrador, a suspensão/reativação e os fluxos de venda/recibo autenticados ainda não foram testados nesta rodada, pois exigem sessão dos sócios. Nenhuma conta nova ou venda de teste foi criada.

## Testes automatizados

1. Produto, SKU, entrada inicial e cliente via RPC.
2. Escrita direta negada, isolamento por organização e FK cruzada bloqueada.
3. Exigência de caixa aberto e bloqueio de duas sessões abertas.
4. Pagamento misto, desconto, custo histórico e repetição idempotente.
5. Estoque insuficiente, desconto inválido e soma de pagamentos incorreta sem gravação parcial.
6. Limite de fiado, recebimento parcial e bloqueio de recebimento excedente.
7. Cancelamento mantém histórico e devolve estoque uma única vez.
8. Devolução gera crédito e movimentação de estoque.
9. Despesas/sangria e cálculo de fechamento de caixa.
10. Indicadores SQL e auditoria imutável para o usuário da aplicação.
11. Uso de crédito na loja e bloqueio de valor acima do disponível.
12. Compra, recebimento parcial e pagamento parcial de conta a pagar.
13. CSV com erro em linha posterior reverte o lote inteiro.
14. Inventário detecta alteração no saldo durante a contagem.
15. Devolução final ajusta centavos e reverte custo histórico corretamente.
16. Desativar perfil revoga leituras e mutações.

## Antes de usar a loja real

Configure um Supabase de homologação e publique um preview Vercel com variáveis próprias. Execute e registre:

- Login/logout dos dois sócios e recuperação segura de acesso.
- Criar produto e dois SKUs; recarregar para confirmar persistência.
- Upload de imagem, acesso pela própria organização e tentativa por outra conta/organização.
- Abrir caixa; vender em Pix + Dinheiro, confirmar troco, estoque, recibo, histórico e dashboard.
- Duas sessões tentando vender a última unidade: apenas uma deve concluir.
- Venda fiado com cliente autorizado; receber parte e revisar cobrança do restante.
- Testar cancelamento, devolução parcial, devolução integral e uso de crédito em nova venda.
- Registrar despesa e sangria; fechar com diferença de contagem.
- Criar compra, receber em duas etapas e conferir contas a pagar.
- Importar CSV válido, inválido e duplicado; confirmar que erros não deixam dados parciais.
- Conferir corte de dia às 00:00 de America/Fortaleza e períodos dos relatórios.
- Instalar no Safari do iPhone, teclado aberto, safe areas, rotação e aumento de fonte.
- Simular perda de conexão durante uma operação e reenvio idempotente.
- Fazer e restaurar backup em projeto separado, incluindo fotos.

## Conexão publicada em 19/09/2026

- O Supabase Exclusiv contém 22 tabelas públicas, todas com RLS ativo, e o bucket privado `products`.
- `command` aceita somente usuários autenticados; `command_core` e `move_stock` não aceitam execução por `anon` nem `authenticated`.
- O Security Advisor apontou execução pública de `rls_auto_enable()`; o privilégio foi revogado e a consulta de confirmação retornou `false` para os dois papéis. Os outros cinco avisos são das funções de aplicação que precisam de execução autenticada; ainda exigem revisão integrada antes de produção.
- O projeto Vercel `exclusiv-codigo` foi vinculado à CLI e publicado com build Ready. As variáveis públicas do Supabase estão configuradas em Production; a tela de login publicada reconhece a conexão e inclui recuperação de senha.
- Site URL e URLs de retorno foram configuradas no Supabase; cadastro público está desativado.
- Os convites de Gabriel e Arthur foram aceitos pela API Auth (`/invite`: HTTP 200). Ambos têm perfis ativos com papel `admin` na mesma organização. Em consulta ao Auth, Gabriel apareceu com e-mail confirmado e senha cadastrada; Arthur ainda tinha e-mail não confirmado e nenhuma senha.
- O pedido inicial de recuperação para Gabriel retornou HTTP 429 em `/auth/v1/recover`, após os dois convites, quando o projeto ainda usava o serviço padrão de e-mail do Supabase.
- O SMTP personalizado foi salvo com `smtp.gmail.com`, porta 465 e remetente Gabriel. A configuração persistiu após recarregar o painel. O envio de recuperação para Arthur foi confirmado pelo painel e pelo log Auth (`/recover`, HTTP 200). Isso verifica a aceitação pelo serviço de autenticação, mas não confirma a chegada na caixa de entrada nem o clique no link. O link vale 60 minutos.
- O painel Supabase alerta que Gmail pessoal não é um provedor transacional e pode prejudicar a entregabilidade. Migrar para domínio e serviço de e-mail próprios quando disponíveis.
- O fluxo de criação de senha e o tratamento de link inválido foram verificados localmente sem credenciais reais. O login completo e as operações reais na instância publicada continuam pendentes da participação dos sócios.

O arquivo `docs/ESCOPO.md` lista recursos do briefing que ainda não estão completos.
