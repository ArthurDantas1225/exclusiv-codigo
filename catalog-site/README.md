# Catálogo EXCLUSIV

Site público independente do ERP. Ele lê somente a projeção pública de produtos no Supabase do catálogo, grava o pedido antes de abrir o WhatsApp e continua exibindo a última sincronização válida quando o ERP estiver indisponível.

## Configuração

Copie `.env.example` para `.env.local` e preencha somente as três variáveis públicas:

```dotenv
NEXT_PUBLIC_CATALOG_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_CATALOG_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICAVEL
NEXT_PUBLIC_CATALOG_ORDER_URL=https://SEU-PROJETO.supabase.co/functions/v1/create-order
```

Nunca coloque a chave `service_role` no site. Ela pertence apenas às Edge Functions.

## Execução e validação

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm build
pnpm dev
```

Na Vercel, use `catalog-site` como Root Directory e mantenha o framework Next.js detectado automaticamente.
