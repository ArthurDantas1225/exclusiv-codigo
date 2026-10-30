import { createClient } from "@supabase/supabase-js";
import { generateStylistResult } from "../../../lib/stylist-server.ts";
import { stylistRequestSchema, type StylistRequest, type StylistResult } from "../../../lib/stylist.ts";

export const runtime = "nodejs";

type AuthenticationStatus = "active" | "inactive" | "invalid";
type GenerateResult = (input: StylistRequest) => Promise<{ result: StylistResult; source: "ai" | "fallback" }>;
const maxBodyBytes = 64_000;

async function readLimitedBody(request: Request): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    size += value.byteLength;
    if (size > maxBodyBytes) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
}

async function authenticateStylistUser(token: string): Promise<AuthenticationStatus> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return "invalid";
  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return "invalid";
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("active")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError || !profile || profile.active !== true) return "inactive";
  return "active";
}

export function createStylistPost(dependencies: {
  authenticate?: (token: string) => Promise<AuthenticationStatus>;
  generate?: GenerateResult;
} = {}) {
  const authenticate = dependencies.authenticate ?? authenticateStylistUser;
  const generate = dependencies.generate ?? generateStylistResult;
  return async function post(request: Request): Promise<Response> {
    const authorization = request.headers.get("authorization") ?? "";
    const match = /^Bearer\s+(.+)$/i.exec(authorization);
    if (!match) return Response.json({ error: "Sessão obrigatória." }, { status: 401 });

    const status = await authenticate(match[1]);
    if (status === "invalid") return Response.json({ error: "Sessão inválida." }, { status: 401 });
    if (status === "inactive") return Response.json({ error: "Perfil inativo." }, { status: 403 });

    const declaredSize = Number(request.headers.get("content-length") ?? 0);
    if (declaredSize > maxBodyBytes) return Response.json({ error: "Corpo muito grande." }, { status: 413 });
    let body: unknown;
    try {
      const rawBody = await readLimitedBody(request);
      if (rawBody === null) return Response.json({ error: "Corpo muito grande." }, { status: 413 });
      body = JSON.parse(rawBody);
    } catch {
      return Response.json({ error: "JSON inválido." }, { status: 400 });
    }
    const parsed = stylistRequestSchema.safeParse(body);
    if (!parsed.success) return Response.json({ error: "Pedido inválido." }, { status: 400 });

    const generated = await generate(parsed.data);
    return Response.json(generated);
  };
}

export const POST = createStylistPost();
