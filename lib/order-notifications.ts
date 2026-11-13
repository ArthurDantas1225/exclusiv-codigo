import { supabase } from "./supabase";

const endpoint = "https://sduacssupdhzwqmlijqv.supabase.co/functions/v1/team-notifications";
export async function notificationRequest(body: Record<string, unknown>) {
  if (!supabase) throw new Error("Aplicativo não conectado.");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Entre no aplicativo para ativar os avisos.");
  const response = await fetch(endpoint, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Não foi possível configurar os avisos.");
  return result as { configured?: boolean; publicKey?: string; ok?: boolean; subscribed?: boolean };
}

export function decodePushPublicKey(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const text = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(text, (character) => character.charCodeAt(0));
}

export async function notificationWorker() {
  await navigator.serviceWorker.register("/sw.js");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Não foi possível iniciar os avisos. Atualize o aplicativo e tente novamente.")), 12000); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}
