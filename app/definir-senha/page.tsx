"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function DefinirSenha() {
  const [status, setStatus] = useState<"loading" | "ready" | "done" | "invalid">("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setStatus("invalid");
      return;
    }
    let active = true;
    const check = async () => {
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (!active) return;
      if (authError || !user) {
        setStatus("invalid");
        return;
      }
      const { data: profile } = await client
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .eq("active", true)
        .maybeSingle();
      if (!active) return;
      if (!profile) {
        setStatus("invalid");
        return;
      }
      window.history.replaceState(null, "", "/definir-senha");
      setStatus("ready");
    };
    void check();
    const { data: { subscription } } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY") {
        setTimeout(() => { void check(); }, 0);
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || busy) return;
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    if (password.length < 12) {
      setError("Use pelo menos 12 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError("Não foi possível salvar a senha. Solicite um novo link e tente novamente.");
    } else {
      await supabase.auth.signOut();
      setStatus("done");
    }
    setBusy(false);
  }

  return (
    <main className="login">
      <div className="login-brand">
        <span className="wordmark">EXCLUSIV<span>®</span></span>
        <p>SEU ESTILO. SUA OPERAÇÃO.</p>
      </div>
      <section className="login-card">
        <Link className="auth-back" href="/login"><ArrowLeft size={17} /> Voltar ao login</Link>
        <LockKeyhole className="orange" />
        <h1>Definir senha</h1>
        {status === "loading" && <p>Validando seu link de acesso…</p>}
        {status === "invalid" && (
          <>
            <p role="alert">Este link expirou ou a conta não está habilitada.</p>
            <Link className="ghost full auth-link" href="/login">Voltar e solicitar outro link</Link>
          </>
        )}
        {status === "ready" && (
          <>
            <p>Escolha uma senha pessoal para entrar na EXCLUSIV.</p>
            <form onSubmit={save}>
              <label className="field"><span>Nova senha</span><input name="password" type="password" autoComplete="new-password" minLength={12} required /></label>
              <label className="field"><span>Repita a senha</span><input name="confirmation" type="password" autoComplete="new-password" minLength={12} required /></label>
              {error && <p role="alert" className="negative">{error}</p>}
              <button className="primary full" disabled={busy}>{busy ? "Salvando…" : "Salvar senha"}</button>
            </form>
          </>
        )}
        {status === "done" && (
          <>
            <p role="status">Senha definida. Agora entre com seu e-mail e essa senha.</p>
            <Link className="primary full auth-link" href="/login">Ir para o login</Link>
          </>
        )}
      </section>
      <footer>EXCLUSIV / SISTEMA INTERNO</footer>
    </main>
  );
}
