# Especificação: catálogo independente conectado ao ERP

## Objetivo

Separar o catálogo público da EXCLUSIV em um site e uma implantação Vercel independentes, usando o projeto Supabase `sduacssupdhzwqmlijqv` da conta do Arthur. O aplicativo interno permanece no projeto Supabase `rznnojrtgolekdkcvxnv` da conta do Gabriel e continua sendo a fonte oficial de produtos, preços, variantes, estoque e vendas.

O catálogo deve permanecer disponível quando o ERP estiver indisponível. Ao finalizar um pedido, o cliente deve gerar um pedido pendente visível no aplicativo e abrir o WhatsApp com o mesmo resumo.

## Limites de dados

O banco do catálogo conterá somente:

- projeções públicas de produtos publicados;
- variantes com disponibilidade pública;
- referências das fotos públicas;
- configurações públicas da loja;
- carrinhos finalizados e o estado de sincronização dos pedidos.

Dados internos, incluindo custo, margem, usuários, fornecedores, caixa, contas e vendas confirmadas, não serão copiados para o catálogo.

## Estrutura dos projetos

- O repositório atual continuará contendo o ERP.
- O catálogo será extraído para um aplicativo Next.js independente, preservando a interface pública existente.
- O catálogo terá projeto Vercel e variáveis de ambiente próprios.
- O endereço antigo `/catalogo` redirecionará para o novo site depois da validação da implantação.
- O primeiro lançamento pode usar o domínio fornecido pela Vercel; domínio personalizado fica fora deste escopo.

## Banco do catálogo

O Supabase do Arthur terá as tabelas mínimas:

- `catalog_products`: identificação pública, nome, categoria, subcategoria, coleção, preço, visibilidade e versão;
- `catalog_variants`: identificador original da variante, modelo, cor, tamanho, quantidade disponível e versão;
- `catalog_images`: identificador original, produto, URL pública, cor, vista, ordem e imagem principal;
- `catalog_orders`: código público, cliente, pagamento desejado, entrega, total, estado e chave de idempotência;
- `catalog_order_items`: itens e variantes do pedido com preço registrado no momento da compra;
- `catalog_sync_events`: fila durável dos pedidos que aguardam importação pelo ERP;
- `catalog_settings`: nome, WhatsApp, Instagram e textos públicos.

As chaves originais do ERP serão preservadas para permitir `upsert` idempotente. Leitura anônima será permitida apenas para produtos publicados, variantes disponíveis, imagens e configurações. Pedidos serão criados somente por uma função de servidor que valida os dados; nenhuma chave administrativa será enviada ao navegador.

## Sincronização do catálogo

O ERP é a única fonte de alteração de produtos e estoque. Uma função autenticada produzirá uma fotografia pública por produto e fará `upsert` no banco do catálogo. Publicar, editar, alterar estoque, ocultar, arquivar ou restaurar um produto solicitará nova sincronização.

Para cobrir falhas depois de uma gravação no ERP, uma reconciliação completa poderá ser executada manualmente e durante a implantação. A sincronização registrará versão e horário; eventos repetidos ou fora de ordem não poderão substituir uma versão mais nova.

Se o banco do catálogo estiver indisponível, a operação do ERP continuará salva e ficará marcada para nova tentativa. Se o ERP estiver indisponível, o catálogo servirá a última fotografia válida.

## Fluxo do pedido

1. O cliente escolhe produtos e informa nome, pagamento e entrega.
2. O servidor do catálogo consulta novamente preços e disponibilidade no banco do catálogo.
3. O servidor cria o pedido e seus itens em uma única transação, usando uma chave de idempotência criada no navegador.
4. Somente depois da confirmação do banco, o catálogo abre o WhatsApp com o código e o resumo do pedido.
5. A área `Pedidos pendentes` do ERP consulta pedidos abertos através de uma rota de servidor autenticada do catálogo.
6. Ao confirmar, o ERP usa o mesmo código como `request_id`, cria a venda e reduz o estoque uma única vez.
7. O ERP marca o pedido remoto como confirmado e sincroniza as quantidades atualizadas.

Repetir o clique, atualizar a página ou repetir uma chamada com a mesma chave deve retornar o mesmo pedido sem duplicar registros ou reduzir estoque duas vezes.

## Estados e recuperação

Pedidos usam os estados `pending`, `importing`, `confirmed`, `cancelled` e `failed`. Um pedido salvo continua disponível mesmo se a abertura do WhatsApp falhar. O ERP pode tentar novamente a importação de pedidos `pending` ou `failed`.

O catálogo não reserva estoque na criação do pedido. A disponibilidade será validada novamente na confirmação da venda pelo ERP. Caso falte estoque, o pedido permanecerá pendente e o aplicativo mostrará quais itens precisam ser ajustados.

## Segurança

- Segredos de sincronização e chaves `service_role` existirão somente em funções de servidor.
- A comunicação entre os projetos usará segredo rotacionável, assinatura e comparação segura.
- Entradas públicas terão validação de formato, limites de quantidade e tamanho de texto.
- A criação de pedidos terá limitação de frequência por origem e proteção contra repetição.
- O banco do catálogo usará RLS e não permitirá alterações anônimas diretas.
- Custos, margens e dados pessoais internos nunca serão retornados pela API pública.

## Migração e publicação

1. Criar e validar o esquema no Supabase do Arthur.
2. Extrair o catálogo para o novo aplicativo sem remover a rota atual.
3. Importar a fotografia pública dos produtos e fotos existentes.
4. Publicar o novo projeto Vercel em endereço temporário.
5. Testar catálogo, pedido, WhatsApp, leitura no ERP, confirmação e atualização de estoque.
6. Redirecionar `/catalogo` somente depois dos testes.
7. Manter retorno simples: remover o redirecionamento restaura o catálogo anterior durante a estabilização.

## Critérios de aceite

- O site do catálogo abre sem consultar o Supabase do ERP.
- Produto, preço, foto, variante, publicação e estoque alterados no ERP aparecem no catálogo após sincronização.
- Um pedido finalizado aparece no ERP usado em outro navegador ou aparelho.
- O WhatsApp inclui o mesmo código, cliente, itens, variações, quantidades, pagamento, entrega e total gravados.
- Cliques ou chamadas repetidos não duplicam o pedido nem a venda.
- A confirmação reduz estoque somente no ERP e atualiza o catálogo.
- Falha de um dos sistemas não apaga pedidos nem impede a recuperação posterior.
- Nenhum custo, margem, usuário ou dado financeiro aparece no banco ou API públicos do catálogo.

## Fora do escopo inicial

- pagamento online;
- reserva automática de estoque antes da confirmação da loja;
- domínio personalizado;
- painel administrativo separado para o catálogo;
- migração definitiva das fotos para Cloudflare R2.

As fotos podem permanecer temporariamente no armazenamento escolhido para o catálogo. A migração para R2 deve ser tratada como etapa própria se o consumo de tráfego justificar.
