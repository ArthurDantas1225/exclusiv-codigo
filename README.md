# EXCLUSIV

Aplicação de gestão de streetwear, com Next.js App Router, React, TypeScript e Supabase. Interface em pt-BR, moeda BRL e fuso operacional America/Fortaleza. O arquivo original `erp_streetwear.html` foi analisado como referência e não foi alterado.

## Estado desta entrega

O código foi publicado em `https://exclusiv-codigo.vercel.app`. O projeto Vercel tem as variáveis públicas do Supabase configuradas e o build de produção foi concluído. Em 19/09/2026, oito migrations foram aplicadas ao projeto Supabase `rznnojrtgolekdkcvxnv`; as 22 tabelas públicas têm RLS. Gabriel e Arthur foram convidados e receberam perfis ativos de administrador da mesma organização. Gabriel confirmou o convite e tem senha cadastrada. O SMTP personalizado com Gmail de Gabriel foi salvo e um envio de recuperação para Arthur retornou HTTP 200; Arthur ainda precisa abrir o e-mail, confirmar o acesso e definir a própria senha. Consulte `docs/VALIDACAO.md` e `docs/ESCOPO.md` antes de registrar vendas reais.

O acesso de demonstração foi removido da tela de login. Sem autenticação e perfil ativo, o aplicativo redireciona para `/login`. A função `manage-team` foi publicada após autorização específica do usuário; um sócio administrador pode convidar outro administrador e suspender/reativar acessos em Configurações → Usuários. Convites de funcionários aguardam permissões específicas no banco e na interface. Consulte `docs/AUDITORIA_EXCLUSIV.md` para a avaliação de produto e as prioridades.

O cadastro e a edição de produtos usam uma tela única para categoria, subcategoria, cores, tamanhos, quantidades e custos. No estoque, cada produto aparece em um cartão com foto, total de peças, opções, códigos, custo médio e margem bruta média; a grade por SKU fica em um detalhe expansível. Fotos podem ser marcadas por cor e ângulo (frente, costas ou detalhe). Excluir produto ou foto apenas oculta o registro e oferece restauração. O catálogo público fica em `/catalogo`; cada produto precisa ser publicado explicitamente por um administrador. O cliente pode buscar e filtrar por categoria, subcategoria, cor e tamanho, ampliar a imagem e percorrer as fotos de todas as cores. A função pública `catalog` devolve somente nome, preço, opções disponíveis e fotos temporárias, sem custos nem dados de clientes. O carrinho cria uma mensagem para o WhatsApp `(84) 99600-8220`; o envio não registra venda ou reserva estoque.

As telas internas do aplicativo têm um botão Voltar que retorna à página anterior dentro do app. Um produto aberto por link direto retorna ao estoque; as demais telas internas usam uma seção conhecida como destino seguro. Janelas de edição, o detalhe do catálogo e a galeria de fotos também têm retorno visível.

A vitrine pública usa cartões compactos em duas colunas no celular e três colunas na área de produtos do desktop. O cabeçalho e os filtros foram reduzidos para mostrar as peças mais cedo, sem esconder a busca, categorias, contato ou pedido. Cada cartão informa preço e quantas cores e tamanhos têm estoque; os filtros aplicados podem ser removidos individualmente.

Os avisos comuns desaparecem após dois segundos. O aviso de remoção mantém a opção Desfazer por quatro segundos; os avisos do painel seguem os mesmos prazos. Em telas pequenas, os avisos ocupam uma área reduzida acima da barra fixa do pedido.

Na aba Vender, cada produto mostra foto, categoria, opções, disponibilidade, preço de venda, custo médio e margem bruta. Cada variação exibe seu custo e estoque restante. A sacola mostra uma miniatura correspondente à cor escolhida quando há foto identificada; se não houver, usa a foto de capa. Os custos ficam visíveis apenas no painel autenticado.

## Rodar localmente

Requisitos: Node.js 24 e pnpm 11.19 (ou versão compatível com o lockfile).

```sh
corepack enable
corepack prepare pnpm@11.19.0 --activate
pnpm install --frozen-lockfile
```

Copie `.env.example` para `.env.local` e preencha:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA_ANON
```

A chave anon/publishable é pública e depende das políticas RLS para segurança. Nunca use a service_role nesse arquivo ou no frontend. O arquivo local `.env.local`, ignorado pelo Git, já aponta para o projeto Supabase Exclusiv; as variáveis também estão no ambiente Production da Vercel.

```sh
pnpm dev
```

Abra `http://localhost:3000`. Para validar:

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm start
```

O comando de testes usa suporte nativo a TypeScript do Node 24, sem carregar o aplicativo ou contatar serviços externos. O banco de testes é descartado ao final da execução.

## Configurar Supabase

1. Crie um projeto dedicado à EXCLUSIV. Guarde a senha do banco em um gerenciador seguro.
2. Em um projeto novo, no SQL Editor, aplique **uma vez e na ordem** os arquivos de `supabase/migrations`: `001_core.sql`, `002_metrics.sql`, `003_storage.sql`, `004_balances.sql`, `005_operations.sql`, `20260919174030_product_catalog_flow.sql`, `20260919190000_product_grid_media_undo.sql` e `20260919193842_product_subcategory.sql`. **Não reaplique no projeto Supabase Exclusiv:** os oito arquivos já foram executados nele. Um ajuste adicional revogou a execução pública da função interna `rls_auto_enable()`.
3. Alternativamente, use a Supabase CLI: execute `supabase init` para gerar o arquivo de configuração, vincule o projeto com `supabase link --project-ref SEU_REF` e execute `supabase db push`. A CLI deve guardar o histórico de migrations; não combine aplicação manual e CLI sem alinhar esse histórico.
4. No projeto Supabase Exclusiv, o cadastro público já está desativado. As duas contas administrativas já foram convidadas em Authentication → Users. Não há senha embutida no projeto: cada sócio usa o link do próprio convite para definir sua senha. Se o link expirar, a tela de login permite solicitar recuperação.
5. Os perfis administrativos e a organização EXCLUSIV já foram criados. O SQL de bootstrap abaixo é apenas para instalar uma **nova instância vazia**; não o execute no projeto atual.
6. No projeto Supabase Exclusiv, a Site URL já é `https://exclusiv-codigo.vercel.app` e os retornos permitidos incluem esse domínio e `http://localhost:3000`. Ajuste apenas se o endereço definitivo mudar.
7. Confira o Security Advisor e teste isolamento entre duas organizações em homologação.

```sql
-- Execute como administrador do projeto, nunca no navegador da aplicação.
do $$
declare org uuid; u1 uuid; u2 uuid;
begin
  select id into u1 from auth.users where email='EMAIL_SOCIO_1';
  select id into u2 from auth.users where email='EMAIL_SOCIO_2';
  if u1 is null or u2 is null or u1=u2 then
    raise exception 'Crie as duas contas distintas no Auth e substitua os e-mails';
  end if;
  if exists(select 1 from public.profiles where id in (u1,u2)) then
    raise exception 'Uma conta já possui vínculo; confira antes de repetir';
  end if;
  insert into public.organizations(name,public_slug) values('EXCLUSIV','exclusiv') returning id into org;
  insert into public.profiles(id,organization_id,name,email,role)
    select u1,org,'NOME_SOCIO_1',email,'admin' from auth.users where id=u1;
  insert into public.profiles(id,organization_id,name,email,role)
    select u2,org,'NOME_SOCIO_2',email,'admin' from auth.users where id=u2;
  insert into public.app_settings(organization_id,key,value) values
    (org,'company_name','EXCLUSIV'),
    (org,'sizes','PP,P,M,G,GG,XG,38,40,42,44');
end $$;
```

Contas não vinculadas a um perfil ativo não têm acesso aos dados. Desativar `profiles.active` bloqueia leituras e RPC. A função `command_core` e a função interna `move_stock` não são executáveis por usuários da aplicação; somente `command` é a entrada de escrita.

## Publicar na Vercel

1. Crie um repositório privado com o conteúdo desta pasta (sem `node_modules`, `.next` ou `.env.local`).
2. Importe-o na Vercel, selecione o framework Next.js e Node 24.x. Use esta pasta como Root Directory.
3. Defina as duas variáveis de `.env.example` nos ambientes adequados. Use projetos Supabase separados para homologação e produção.
4. Build command: `pnpm build`. Install command: `pnpm install --frozen-lockfile`. Output Directory: padrão do Next.js.
5. Publique e cadastre a URL HTTPS em Supabase Auth. Variáveis `NEXT_PUBLIC_*` entram no build; alterá-las requer novo deploy.
6. Publique a Edge Function `supabase/functions/catalog/index.ts` como `catalog` com `verify_jwt=false`, pois ela é um GET público somente de produtos publicados. Mantenha `manage-team` protegida com `verify_jwt=true`.
7. Execute o roteiro de homologação, inclusive login com os dois sócios, leitura após recarregar e operações simultâneas em duas sessões.

A aplicação não contém token de deploy, integração fiscal, conexão bancária ou automação de envio no WhatsApp. O recibo é um comprovante não fiscal identificado pela EXCLUSIV; não é NFC-e nem assinatura digital fiscal.

## PWA / iPhone

Manifest, ícones 192/512 e apple-touch-icon estão em `public`. O layout usa safe areas, controles de toque e barra inferior. No Safari, Compartilhar → Adicionar à Tela de Início. O service worker guarda somente ícones e uma tela offline; não faz cache de dados pessoais, respostas Supabase ou operações financeiras. Não existe sincronização offline.

## Operação diária

Cadastre produto com ao menos uma variação, custo e estoque inicial → abra o caixa → registre a venda. Para uma peça existente marcada **Incompleto**, abra o produto e adicione a primeira variação. A opção de publicar no catálogo é separada do cadastro interno. Os tamanhos são configuráveis. O PDV aceita scanner que emula teclado e Enter, pagamentos mistos, descontos em reais/percentual e crédito na loja. Fiado exige cliente autorizado e limite suficiente.

Na venda, preços/custos são fotografados no histórico. Cancelamentos preservam a venda e registram reversões. Devoluções parciais ajustam estoque e custo, com correção de arredondamento na última devolução. Para trocar uma peça, faça a devolução vinculada e uma nova venda; o crédito gerado pode ser utilizado como pagamento. O estorno real ao cliente é feito fora do ERP.

Despesas diretas representam valores já pagos. Para compromissos futuros, use A pagar. Contas recorrentes geram a próxima competência após quitação integral. Recebimentos de compras podem ser parciais e geram conta a pagar pelo valor recebido. Pagamentos de mercadoria não entram novamente nas despesas da DRE, pois o custo das peças é reconhecido pelo CMV.

## Arquitetura e segurança

- `app/`: rotas App Router, layout, login e shell.
- `components/`: telas separadas por domínio e primitivas compartilhadas.
- `lib/`: tipos, cliente Supabase, validação Zod, CSV, formatação e regras de apresentação.
- `supabase/migrations/`: modelo relacional, índices, RLS, RPC transacionais e Storage privado.
- `tests/`: testes de domínio e isolamento em PostgreSQL embarcado.

Todos os valores monetários persistidos são **centavos inteiros**, e timestamps são `timestamptz`. Escritas REST diretas nas tabelas empresariais são revogadas. As funções verificam usuário ativo e admin, derivam organization_id do perfil e nunca confiam em organization_id enviado pelo cliente. Chaves estrangeiras compostas impedem referências cruzadas entre organizações. Ações por organização são serializadas por lock transacional. Chaves idempotentes impedem duplicação de uma operação repetida com a mesma identificação.

Leituras respeitam RLS. Indicadores globais e saldos vêm de agregações no banco. Listas carregam lotes e oferecem “Carregar registros anteriores”; o detalhe também consulta diretamente seu registro e relações. Algumas análises locais de clientes/estoque consideram os registros carregados, conforme indicado na interface. A versão atual usa uma sessão de caixa aberta por organização.

## Fotos

O bucket `products` é privado, limitado a JPG/PNG/WebP. A aplicação comprime fotos para WebP, com lado máximo de 1600 px, antes de enviar. O caminho começa pelo UUID da organização; a política Storage limita leitura/escrita ao tenant correto. A primeira foto fica como principal. URLs assinadas expiram em uma hora.

## Importação e exportação

Importação: CSV UTF-8, separador vírgula ou ponto-e-vírgula, cabeçalhos do modelo baixado, até 200 linhas / 1 MB. Valores monetários de entrada usam ponto decimal e reais; a prévia validada mostra centavos. O lote é atômico: um erro no banco reverte todas as linhas. Cada linha de produto cria um produto com um SKU; variações adicionais podem ser cadastradas no produto. Estoque importado é uma movimentação (+/-), não uma substituição silenciosa do saldo.

Exportações escapam aspas e neutralizam prefixos de fórmulas. Exportações de listas consideram os registros carregados; carregue lotes anteriores para ampliar o conjunto. Relatórios agregados não dependem desses lotes.

## Backup e restauração

Ative backups e/ou PITR conforme o plano do Supabase. Além disso, mantenha exportações criptografadas fora do projeto. Exemplo com credencial de conexão fornecida somente no ambiente do terminal:

```sh
supabase db dump --linked --file schema.sql
supabase db dump --linked --data-only --use-copy --file data.sql
```

Proteja os arquivos: eles contêm dados pessoais e financeiros. Faça cópia separada dos objetos do Supabase Storage: backup do banco não inclui os arquivos binários. Registre periodicidade, retenção e responsável. Teste a restauração em um projeto isolado, incluindo Auth, políticas, dados e fotos. Não teste restauração por cima da produção.

## LGPD e auditoria

Clientes podem ser editados e anonimizados quando o saldo está zerado. O histórico financeiro é preservado. Consentimento de marketing é explícito. O log de operações de cadastro não replica snapshots de dados pessoais; ações financeiras e de estoque mantêm dados operacionais para rastreabilidade. Notas livres e mensagens exigem cuidado da equipe para não incluir dados desnecessários. O aplicativo prepara a mensagem no WhatsApp; quem usa decide o envio.

## Referências técnicas

- Next.js App Router: https://nextjs.org/docs/app
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Functions: https://supabase.com/docs/guides/database/functions
- Supabase backups: https://supabase.com/docs/guides/platform/backups
- Vercel Node: https://vercel.com/docs/functions/runtimes/node-js


> Recuperação de serviço: cache de imagens públicas e compressão de novos uploads ativados em 13/10/2026.
