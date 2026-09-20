"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="content">
      <h1>Não foi possível abrir esta tela.</h1>
      <p className="fine">
        Tente novamente. Se você estava concluindo uma venda, confira o
        histórico antes de repetir.
      </p>
      <button onClick={reset}>Tentar novamente</button>
    </main>
  );
}
