import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const appUrl = "https://exclusiv-codigo.vercel.app";
const origins = new Set([appUrl, "http://localhost:3000"]);

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin") ?? "";
  const headers = {
    "content-type": "application/json",
    "access-control-allow-origin": origins.has(origin) ? origin : appUrl,
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
    "access-control-allow-methods": "POST, OPTIONS",
    vary: "Origin",
  };
  const reply = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), { status, headers });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST" || (origin && !origins.has(origin)))
    return reply(403, { error: "Origem ou método não permitido." });

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return reply(401, { error: "Entre novamente para continuar." });
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return reply(503, { error: "Serviço indisponível." });
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: identity, error: authError } = await admin.auth.getUser(token);
  if (authError || !identity.user) return reply(401, { error: "Sessão inválida." });
  const { data: operator, error: profileError } = await admin
    .from("profiles")
    .select("organization_id,role,active")
    .eq("id", identity.user.id)
    .single();
  if (profileError || !operator?.active || operator.role !== "admin")
    return reply(403, { error: "Somente um sócio administrador pode gerenciar acessos." });

  let body: { action?: string; name?: string; email?: string; userId?: string };
  try {
    body = await request.json();
  } catch {
    return reply(400, { error: "Dados inválidos." });
  }
  if (body.action === "invite") {
    const name = body.name?.trim() ?? "";
    const email = body.email?.trim().toLowerCase() ?? "";
    if (name.length < 2 || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return reply(400, { error: "Informe nome e e-mail válidos." });
    const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
    if (existing) return reply(409, { error: "Este e-mail já possui acesso." });
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${appUrl}/definir-senha`,
    });
    if (inviteError || !invited.user)
      return reply(inviteError?.status === 429 ? 429 : 409, {
        error: inviteError?.status === 429
          ? "Limite de convites atingido. Tente novamente mais tarde."
          : "Não foi possível convidar este e-mail. Verifique se já existe uma conta.",
      });
    const { error: linkError } = await admin.from("profiles").insert({
      id: invited.user.id,
      organization_id: operator.organization_id,
      name,
      email,
      role: "admin",
      active: true,
    });
    if (linkError) return reply(500, { error: "Convite enviado, mas o vínculo falhou. Confira o usuário no Supabase antes de reenviar." });
    await admin.from("audit_logs").insert({
      organization_id: operator.organization_id,
      user_id: identity.user.id,
      action: "staff_invite",
      entity: "profiles",
      entity_id: invited.user.id,
      after_data: { role: "admin" },
    });
    return reply(200, { ok: true });
  }
  if (body.action === "set_active") {
    const userId = body.userId ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(userId) || userId === identity.user.id)
      return reply(400, { error: "Selecione outro integrante da equipe." });
    const { data: target, error: targetError } = await admin.from("profiles")
      .select("id,active,role")
      .eq("id", userId)
      .eq("organization_id", operator.organization_id)
      .single();
    if (targetError || !target) return reply(404, { error: "Integrante não encontrado." });
    const active = !target.active;
    const { error: updateError } = await admin.from("profiles")
      .update({ active })
      .eq("id", userId)
      .eq("organization_id", operator.organization_id);
    if (updateError) return reply(500, { error: "Não foi possível alterar o acesso." });
    await admin.from("audit_logs").insert({
      organization_id: operator.organization_id,
      user_id: identity.user.id,
      action: active ? "staff_activate" : "staff_deactivate",
      entity: "profiles",
      entity_id: userId,
      after_data: { active },
    });
    return reply(200, { ok: true });
  }
  return reply(400, { error: "Operação desconhecida." });
});
