# Editar a EXCLUSIV em outra máquina

O código está no repositório privado `ArthurDantas1225/exclusiv-codigo`. Entre no GitHub com uma conta autorizada para acessá-lo. O projeto Vercel existente está conectado à branch `main`.

1. Instale Git e Node.js 24 na outra máquina.
2. Abra um terminal e execute:

```sh
git clone https://github.com/ArthurDantas1225/exclusiv-codigo.git
cd exclusiv-codigo
corepack enable
corepack prepare pnpm@11.19.0 --activate
pnpm install --frozen-lockfile
```

3. Copie `.env.example` para `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` com os valores públicos do projeto Supabase EXCLUSIV. O arquivo `.env.local` é ignorado pelo Git; nunca inclua uma chave secreta ou `service_role` nele.
4. Execute `pnpm dev` e abra `http://localhost:3000`. Entre com sua conta do aplicativo.
5. Antes de editar, execute `git pull`. Para enviar alterações testadas, use `git add .`, `git commit -m "Descrição da mudança"` e `git push`. Commits na branch `main` acionam a publicação automática na Vercel.

O código pode ser editado no VS Code ou Codex. Dados, usuários e fotos continuam no Supabase. Alterações de banco e Edge Functions em `supabase/` exigem publicação separada; não reaplique as migrations já executadas em produção.

Para dar acesso ao código a outra pessoa, o dono do repositório deve convidar sua conta GitHub em **Settings → Collaborators**. O acesso de administrador dentro do aplicativo não concede acesso ao repositório.
