# Stylist IA para Stories — design

## Intenção

Adicionar ao aplicativo interno da EXCLUSIV um módulo mobile chamado **Stylist IA**. Ele analisa peças reais do catálogo, considera disponibilidade, fotos e compatibilidade de cores/categorias e entrega combinações de camisa com short ou camisa com calça. Para o kit escolhido, gera textos e um roteiro curto de Stories usando as fotos já cadastradas.

O objetivo é reduzir o tempo gasto escolhendo produtos e escrevendo conteúdo, sem criar imagens artificiais, publicar no Instagram ou alterar estoque e catálogo.

## Objetivos

- Usar somente produtos ativos, visíveis no catálogo, com estoque e ao menos uma foto utilizável.
- Sugerir kits de `Camisa + Short` ou `Camisa + Calça` que possam ser vendidos de verdade.
- Considerar cor, categoria, coleção, preço, variedade de tamanhos e quantidade disponível.
- Gerar título, texto principal, chamada para ação e roteiro de três Stories.
- Exibir as fotos reais do produto e da cor selecionada, com fallback seguro para a capa do produto.
- Permitir trocar uma peça, escolher outra sugestão, regenerar somente o texto e copiar o roteiro.
- Manter a experiência simples, rápida e totalmente adequada ao celular.
- Limitar custos e continuar entregando uma sugestão básica se a IA estiver indisponível.

## Fora do escopo

- Gerar ou editar imagens.
- Montar automaticamente uma arte final de Story.
- Publicar ou agendar conteúdo no Instagram.
- Enviar mensagens para clientes.
- Alterar preços, fotos, catálogo ou estoque.
- Criar histórico permanente de campanhas nesta primeira versão.

## Antiobjetivos

- Não sugerir produto sem estoque ou sem foto.
- Não expor custo, margem, dados financeiros ou dados de clientes ao modelo de IA.
- Não permitir que a IA invente produtos, cores, tamanhos, preços ou links.
- Não depender da IA para a regra básica de combinação: o aplicativo deve validar tudo.
- Não enviar o catálogo inteiro nem os arquivos das fotos ao modelo em cada solicitação.

## Abordagens consideradas

### 1. Seleção inteligente local + IA para conteúdo — escolhida

O aplicativo filtra e pontua combinações válidas com regras determinísticas. Somente uma lista pequena de candidatos, contendo metadados não sensíveis, é enviada para a IA. A IA ordena os candidatos e gera o texto estruturado.

Vantagens: menor custo, resposta rápida, estoque confiável, menos exposição de dados e fallback sem IA. Foi a opção escolhida pelo usuário.

### 2. IA analisando todo o catálogo

Enviaria todas as peças e imagens ao modelo em cada execução. Poderia produzir sugestões mais livres, mas aumentaria custo, latência e risco de escolhas inválidas. Foi descartada.

### 3. Regras e textos fixos sem IA

Seria a opção mais barata, porém repetitiva e pouco útil para criação de conteúdo. Fica apenas como fallback operacional.

## Entrada no aplicativo

- Novo item **Stylist IA** na tela `/app/mais`, com ícone gráfico minimalista e descrição “Kits e roteiros para Stories”.
- Nova rota interna `/app/stylist` renderizada pelo roteador dinâmico já existente.
- O módulo usa o mesmo cabeçalho, botão Voltar, navegação inferior, animações e estados visuais do restante do app.

## Experiência da tela

### Estado inicial

- Título: “Monte o próximo Story.”
- Explicação curta de que apenas peças com foto e estoque serão consideradas.
- Controle **Combinação**:
  - Camisa + short
  - Camisa + calça
- Controle **Objetivo**:
  - Vender hoje
  - Divulgar novidades
  - Girar estoque
- Ação principal: **Gerar combinações**.

### Resultado

- Até três kits válidos, com um deles marcado como recomendado.
- Cada kit mostra as duas fotos existentes, nome, cor, tamanhos disponíveis, preço de cada peça e total.
- Ao selecionar um kit, a tela exibe:
  - título da ideia;
  - motivo curto da combinação;
  - roteiro de três Stories;
  - legenda curta;
  - chamada para WhatsApp ou catálogo;
  - sugestão de interação, como enquete ou caixa de pergunta.
- Ações:
  - **Copiar roteiro**;
  - **Trocar uma peça**;
  - **Gerar outro texto**;
  - selecionar outro kit sugerido.

### Estados de erro e vazio

- Sem combinações: explicar que são necessárias peças compatíveis com foto e estoque e oferecer link para o estoque.
- IA indisponível, sem crédito ou limite atingido: mostrar a melhor combinação calculada localmente e um roteiro padrão editável/copiável.
- Produto alterado enquanto a tela está aberta: revalidar estoque antes de exibir o resultado e remover candidatos inválidos.
- Requisição repetida: desabilitar o botão enquanto estiver processando.

## Regra de candidatos

Um produto só participa quando:

- está ativo e não arquivado;
- está marcado como visível no catálogo;
- pertence a uma das categorias necessárias;
- possui pelo menos uma variante com estoque positivo;
- possui pelo menos uma foto não ocultada.

As combinações são pontuadas em uma função pura e testável. A pontuação considera:

- compatibilidade de cores por grupos simples: neutros, terrosos, frios, quentes e contrastes seguros;
- compatibilidade de coleção e estilo quando esses campos estiverem preenchidos;
- quantidade total disponível e variedade de tamanhos;
- presença de foto correspondente à cor;
- objetivo selecionado: novidade privilegia itens recentes; giro de estoque privilegia disponibilidade maior; vender hoje equilibra os fatores.

O custo e a margem do produto não entram na solicitação da IA. Empates usam ordem estável por nome e ID para manter resultados previsíveis.

## Fotos

- O modelo não recebe os arquivos das fotos nesta versão.
- A IA recebe nome, categoria, subcategoria, coleção, cores, tamanhos, preço e estoque agregado dos poucos candidatos.
- Depois da resposta, a interface resolve as imagens usando `product_images`, preferindo:
  1. foto da cor escolhida e vista frontal;
  2. foto da cor escolhida em outra vista;
  3. foto principal do produto;
  4. primeira foto visível.
- URLs assinadas continuam sendo criadas pelo Supabase Storage conforme o padrão já usado no aplicativo.

## Integração de IA

- Endpoint autenticado: `POST /api/stylist` em uma Route Handler do Next.js.
- Cliente envia: tipo de combinação, objetivo e uma lista limitada de candidatos já validados.
- O servidor valida tamanho e formato com Zod, limita a quantidade de candidatos e rejeita IDs duplicados ou campos fora do permitido.
- O servidor confirma o token Supabase e exige um perfil ativo da organização antes de chamar o modelo.
- A geração usa Vercel AI SDK com saída estruturada por Zod (`generateText` + `Output.object`).
- O modelo será configurado em `AI_GATEWAY_MODEL`; o ID exato será escolhido na implementação a partir da lista atual do AI Gateway, priorizando custo baixo, saída estruturada e português.
- Em produção, a autenticação do AI Gateway usará o OIDC já fornecido pela Vercel, sem chave exposta no navegador.
- O prompt obriga a escolher somente IDs recebidos, escrever em português brasileiro, manter o tom urbano da EXCLUSIV e não prometer reserva ou disponibilidade futura.
- A resposta é novamente validada contra a lista de candidatos. Qualquer produto ou variante desconhecida invalida a resposta e aciona o fallback local.

## Controle de custo e disponibilidade

- Uma solicitação ao modelo por clique; trocar de kit não chama a IA novamente.
- **Gerar outro texto** reutiliza apenas o kit escolhido e um prompt menor.
- A lista enviada ao modelo é limitada aos melhores candidatos calculados localmente.
- Textos e resultados ficam apenas no estado da tela nesta primeira versão.
- Configurar um orçamento do projeto no AI Gateway antes de liberar em produção.
- Usuários anônimos nunca acessam a rota; somente perfis ativos da equipe.
- Falhas de autenticação, créditos, orçamento, limite, timeout ou resposta inválida produzem mensagem clara e usam o roteiro padrão.

## Fluxo de dados

1. A tela lê `products`, `product_variants` e `product_images` já carregados pelo Provider.
2. A função de seleção filtra produtos válidos, agrupa cores/tamanhos e gera candidatos.
3. A tela envia apenas os melhores candidatos e o objetivo para `/api/stylist` com o token da sessão.
4. A rota valida usuário, entrada e limites, chama o AI Gateway e devolve JSON estruturado.
5. A tela valida os IDs devolvidos, associa as fotos existentes e mostra kits e roteiro.
6. Se qualquer etapa remota falhar, a tela usa o melhor candidato local e o roteiro padrão.

## Estrutura prevista

- `components/stylist.tsx`: tela e estados de interação.
- `lib/stylist.ts`: filtros, pontuação, candidatos, fallback e validação dos IDs.
- `app/api/stylist/route.ts`: autenticação e geração estruturada.
- `app/app/[[...path]]/page.tsx`: registro da rota `stylist`.
- `components/settings.tsx`: item do Stylist IA em Mais.
- `lib/types.ts`: tipos mínimos do resultado, se compartilhados.
- estilos existentes do aplicativo: somente classes necessárias para o módulo.
- testes focados em regras, validação, autenticação e presença da interface.

## Segurança e privacidade

- Nenhuma chave de IA vai para o cliente ou para o repositório.
- Nenhum dado de cliente, venda, salário, custo, lucro ou usuário é enviado ao modelo.
- Não são enviados arquivos de imagem; apenas metadados do produto e IDs opacos.
- A rota não aceita URLs arbitrárias nem instruções livres do cliente.
- O modelo não executa ações e sua resposta é tratada como dado não confiável.
- A organização é validada pela sessão Supabase já existente.

## Acessibilidade e mobile

- Botões e controles com rótulos visíveis, foco nativo e alvos adequados para toque.
- Fotos possuem texto alternativo com produto e cor.
- Carregamento e resultado usam `aria-live` sem anunciar animações.
- Layout em uma coluna no celular; kits alternativos podem ser selecionados sem rolagem horizontal obrigatória.
- Respeitar `prefers-reduced-motion` nas transições.

## Verificação

- Testes unitários para filtros, grupos de cor, pontuação e ordenação estável.
- Testes para excluir produtos sem estoque, foto ou visibilidade no catálogo.
- Testes para impedir IDs inventados pela resposta da IA.
- Teste da rota para sessão ausente, perfil inativo, entrada excessiva, sucesso e fallback.
- Teste de interface para rota, módulo em Mais, fotos, roteiro e ações principais.
- `npm test`, `npm run typecheck`, `npm run lint` e `npm run build`.
- Uma chamada real autorizada em ambiente de teste e verificação dos metadados/consumo no AI Gateway antes da publicação.
- Teste em produção do fluxo autenticado e do fallback sem IA.

## Decisões do usuário

- Usar a abordagem de seleção inteligente local com IA para conteúdo.
- Gerar apenas combinações, textos e roteiro usando fotos existentes.
- Não gerar imagens.
- Direção visual mobile apresentada em 30 de outubro de 2026 e aprovada pelo usuário.

## Decisões do implementador

- Usar Vercel AI Gateway com OIDC para evitar credenciais de provedor no aplicativo.
- Não enviar imagens nem dados financeiros ao modelo.
- Não persistir os resultados nesta primeira versão.
- Manter fallback determinístico para que o módulo continue útil sem IA.
- Escolher o modelo somente durante a implementação, consultando a lista atual e configurando-o por variável de ambiente.
