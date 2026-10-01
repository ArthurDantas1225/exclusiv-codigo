# Kit de referência sanitizado para produto SaaS

## Objetivo

Criar um arquivo ZIP portátil do projeto EXCLUSIV para ser anexado em outro chat como referência técnica e de produto. O pacote deve permitir que outro agente entenda o sistema e planeje uma versão genérica vendável para outros lojistas, sem receber credenciais, caches, dados pessoais ou identificadores da produção atual.

O aplicativo EXCLUSIV existente e sua publicação não serão alterados por este trabalho.

## Entrega

O pacote será criado em uma pasta independente com esta estrutura:

```text
EXCLUSIV-REFERENCIA-SAAS/
  LEIA-ME-PRIMEIRO.md
  PROMPT-PARA-OUTRO-CHAT.md
  MAPA-DO-PROJETO.md
  PLANO-PRODUTO-GENERICO.md
  CHECKLIST-DE-SANITIZACAO.md
  codigo-fonte/
```

Também será gerado `EXCLUSIV-REFERENCIA-SAAS.zip` ao lado da pasta.

## Conteúdo do código-fonte

`codigo-fonte/` conterá os arquivos necessários para compreender e executar o projeto:

- aplicação Next.js em `app/`, `components/` e `lib/`;
- migrations e Edge Functions em `supabase/`;
- testes automatizados em `tests/`;
- recursos da PWA em `public/`;
- configuração de TypeScript, ESLint, Next.js e pnpm;
- `.env.example` apenas com valores fictícios;
- documentação técnica útil, reescrita quando contiver detalhes da operação real.

## Exclusões obrigatórias

O pacote não conterá:

- `.env.local` ou qualquer outro arquivo de ambiente real;
- `.git/`, `.vercel/`, `.next/`, `node_modules/` ou caches;
- `tsconfig.tsbuildinfo`;
- credenciais, tokens, senhas, chaves ou cookies;
- referência do projeto Supabase de produção;
- URLs de painéis autenticados;
- nomes, e-mails ou estado de acesso dos sócios;
- detalhes do SMTP pessoal;
- registros de clientes, vendas, estoque ou fotos reais.

## Sanitização

O código será preservado como exemplo funcional, mas identificadores operacionais serão substituídos por placeholders claros:

| Dado atual | Valor no pacote |
|---|---|
| URL de produção | `https://sua-loja.example` |
| URL do aplicativo nas Edge Functions | variável de ambiente ou placeholder documentado |
| telefone do WhatsApp | `SEU_NUMERO_WHATSAPP` ou número fictício inválido |
| slug público da organização | `sua-loja` |
| referência do Supabase | `SEU_PROJECT_REF` |
| nomes e contas dos sócios | `ADMIN_1` e `ADMIN_2` |
| SMTP pessoal | instrução genérica para provedor transacional |

A marca EXCLUSIV poderá aparecer em trechos visuais e funcionais para demonstrar o produto original. O mapa de personalização indicará cada ponto que precisa virar configuração na versão comercial.

## Documentos para o outro chat

### `LEIA-ME-PRIMEIRO.md`

Explica o que existe no ZIP, o que foi removido, como abrir o projeto e a diferença entre referência técnica e produto pronto para venda.

### `PROMPT-PARA-OUTRO-CHAT.md`

Prompt pronto em português que instrui o novo chat a:

1. ler todo o pacote antes de alterar arquivos;
2. preservar o núcleo transacional, RLS, auditoria e isolamento por organização;
3. transformar marca, moeda, fuso, catálogo, contatos e textos em configurações;
4. propor arquitetura multiloja, onboarding, planos, cobrança e permissões;
5. não reutilizar credenciais nem conectar na produção EXCLUSIV;
6. trabalhar em etapas revisáveis, começando por um MVP comercial.

### `MAPA-DO-PROJETO.md`

Resume módulos, rotas, componentes, banco, funções, fluxo de dados, segurança e testes. Também lista os principais pontos de acoplamento à marca e à operação atual.

### `PLANO-PRODUTO-GENERICO.md`

Organiza a evolução em fases:

1. configuração de marca e dados da loja;
2. matriz de permissões para administrador, gerente e vendedor;
3. onboarding e criação segura de tenants;
4. catálogo e WhatsApp configuráveis;
5. planos, cobrança e limites comerciais;
6. administração da plataforma, suporte, observabilidade e backups;
7. homologação e requisitos legais antes de vender.

O documento distinguirá claramente o que já existe, o que pode ser reutilizado e o que precisa ser construído.

### `CHECKLIST-DE-SANITIZACAO.md`

Registra os padrões verificados, os arquivos excluídos e o resultado de uma busca final por segredos e identificadores pessoais.

## Estratégia recomendada para o produto

A versão comercial deve nascer como uma evolução separada, sem converter diretamente a instalação de produção da EXCLUSIV. O núcleo atual já possui `organization_id`, RLS e referências compostas, oferecendo uma base para multitenancy. Porém, onboarding, cobrança, permissões por papel e administração da plataforma ainda exigem desenho e implementação próprios.

O primeiro MVP genérico deve atender lojas de moda e varejo pequeno que precisam de produtos com variações, estoque, PDV, clientes, fiado, caixa, compras, catálogo e WhatsApp. Recursos fiscais, adquirência, WhatsApp Business API, marketplace de extensões e personalizações profundas ficam fora da primeira versão.

## Validação

Antes de entregar o ZIP:

1. listar todos os arquivos incluídos;
2. confirmar que os diretórios e arquivos excluídos não aparecem;
3. pesquisar no pacote por URLs, referência Supabase, nomes, e-mails, telefone e termos de credenciais;
4. confirmar que `.env.example` contém somente placeholders;
5. executar `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test` e `pnpm build` na cópia sanitizada quando as substituições atingirem código executável;
6. abrir o ZIP e conferir sua integridade;
7. registrar limitações restantes no checklist.

## Limites desta entrega

Esta entrega prepara material de referência e um roteiro de produto. Ela não cria contas de novos lojistas, não implementa cobrança, não publica outro aplicativo e não transforma automaticamente a produção EXCLUSIV em SaaS.
