"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Field } from "@/components/ui";
import { ArrowUpRight, LockKeyhole } from "lucide-react";
export default function Login() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [resetMode, setResetMode] = useState(false),
    [resetSent, setResetSent] = useState(false);
  const router = useRouter();
  return (
    <main className="login">
      <div className="login-brand">
        <span className="wordmark">
          EXCLUSIV<span>®</span>
        </span>
        <p>SEU ESTILO. SUA OPERAÇÃO.</p>
      </div>
      <section className="login-card">
        <LockKeyhole className="orange" />
        <h1>
          Sua loja,
          <br />
          sob controle.
        </h1>
        <p>{resetMode ? "Informe seu e-mail para receber um link e definir sua senha." : "Entre para acompanhar a EXCLUSIV."}</p>
        {!supabase && (
          <div className="banner">
            Ambiente ainda não conectado. Configure as variáveis do Supabase
            para entrar com sua conta.
          </div>
        )}
        {resetMode ? <form onSubmit={async (e) => {
          e.preventDefault();
          if (!supabase || busy) return;
          setBusy(true);
          setError("");
          const email = String(new FormData(e.currentTarget).get("email") ?? "");
          const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/definir-senha`,
          });
          if (resetError) setError(resetError.status === 429
            ? "Limite temporário de e-mails atingido. Aguarde e tente novamente mais tarde. Se você recebeu o convite, use o link desse e-mail."
            : "Não foi possível enviar o link agora. Tente novamente mais tarde.");
          else setResetSent(true);
          setBusy(false);
        }}>
          <Field name="email" label="E-mail" type="email" required />
          {resetSent && <p role="status" className="positive">Se a conta estiver cadastrada, o link chegará por e-mail.</p>}
          {error && <p role="alert" className="negative">{error}</p>}
          <button className="primary full" disabled={busy || !supabase}>{busy ? "Enviando…" : "Enviar link para definir senha"}</button>
        </form> : <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!supabase) return;
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            const { error } = await supabase.auth.signInWithPassword({
              email: String(f.get("email")),
              password: String(f.get("password")),
            });
            if (error)
              setError("Não foi possível entrar. Confira e-mail e senha.");
            else {
              router.replace("/app");
            }
            setBusy(false);
          }}
        >
          <Field name="email" label="E-mail" type="email" required />
          <Field name="password" label="Senha" type="password" required />
          {error && (
            <p role="alert" className="negative">
              {error}
            </p>
          )}
          <button className="primary full" disabled={busy || !supabase}>
            {busy ? "Entrando…" : "Entrar na EXCLUSIV"}
            <ArrowUpRight size={18} />
          </button>
        </form>}
        <button className="ghost full" type="button" onClick={() => { setResetMode(!resetMode); setError(""); setResetSent(false); }}>
          {resetMode ? "Voltar ao login" : "Primeiro acesso ou esqueceu a senha?"}
        </button>
        <small>
          Acesso exclusivo da equipe. Contas são criadas por convite.
        </small>
      </section>
      <footer>EXCLUSIV / SISTEMA INTERNO</footer>
    </main>
  );
}
