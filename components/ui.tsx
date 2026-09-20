"use client";
import { useEffect, useRef, type ReactNode, type FormEvent } from "react";
import { ArrowLeft, X, PackageOpen } from "lucide-react";
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={"card " + className}>{children}</section>;
}
export function Empty({
  title = "Nada por aqui ainda",
  text,
  children,
}: {
  title?: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <PackageOpen size={30} />
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}
export function Field({
  label,
  name,
  type = "text",
  value,
  required = false,
  children,
  min,
  step,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  value?: string | number;
  required?: boolean;
  children?: ReactNode;
  min?: number;
  step?: string;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children ?? (
        <input
          name={name}
          type={type}
          defaultValue={value}
          required={required}
          min={min}
          step={step}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}
export function Sheet({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const body = document.body;
    const prev = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = prev;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="sheet"
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="sheet-inner">
        <header>
          <div className="sheet-heading"><button type="button" className="sheet-back" onClick={close}><ArrowLeft size={17} /> Voltar</button><h2>{title}</h2></div>
          <button className="icon-button" aria-label="Fechar" onClick={close}>
            <X />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
export function Form({
  children,
  onSubmit,
  busy = false,
  label = "Salvar",
}: {
  children: ReactNode;
  onSubmit: (data: FormData) => void | Promise<void>;
  busy?: boolean;
  label?: string;
}) {
  return (
    <form
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        void onSubmit(new FormData(e.currentTarget));
      }}
    >
      {children}
      <button className="primary full" type="submit" disabled={busy}>
        {busy ? "Salvando…" : label}
      </button>
    </form>
  );
}
export function Stat({
  label,
  value,
  detail,
  accent = false,
}: {
  label: string;
  value: string | number;
  detail?: string;
  accent?: boolean;
}) {
  return (
    <Card className={accent ? "stat accent" : "stat"}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </Card>
  );
}
