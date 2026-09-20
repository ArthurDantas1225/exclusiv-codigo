"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  House,
  ShoppingBag,
  Package,
  Users,
  Ellipsis,
  ChartNoAxesCombined,
  Wallet,
  MessageCircle,
  Search,
  LogOut,
  Settings,
  ArrowUpRight,
  ClipboardList,
  Bell,
  ArrowLeft,
} from "lucide-react";
import { previousAppRoute, rememberAppRoute } from "@/lib/navigation";
import { useStore } from "./provider";
import { supabase } from "@/lib/supabase";
import { Sheet, Empty } from "./ui";
const nav = [
  ["", "Início", House],
  ["vender", "Vender", ShoppingBag],
  ["estoque", "Estoque", Package],
  ["clientes", "Clientes", Users],
  ["mais", "Mais", Ellipsis],
] as const;
const extra = [
  ["vendas", "Vendas", ClipboardList],
  ["financeiro", "Financeiro", Wallet],
  ["crm", "CRM", MessageCircle],
  ["relatorios", "Relatórios", ChartNoAxesCombined],
  ["mais", "Mais módulos", Ellipsis],
  ["configuracoes", "Configurações", Settings],
] as const;
const routeStackKey = "exclusiv-app-routes";
function readRouteStack() {
  try {
    const value = JSON.parse(sessionStorage.getItem(routeStackKey) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch { return []; }
}
export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname(),
    router = useRouter();
  const section = path.split("/")[2] ?? "";
  const activeNav = section === "vender" ? "vender" :
    ["estoque", "produtos", "inventario"].includes(section) ? "estoque" :
    section === "clientes" ? "clientes" :
    section === "" ? "" : "mais";
  const { demo, online, notice, undo, undoLast, data, loading, error, load, loadMore, busy } =
    useStore();
  const [search, setSearch] = useState<string | null>(null);
  const browserPop = useRef(false);
  useEffect(() => {
    const onPop = () => { browserPop.current = true; };
    window.addEventListener("popstate",onPop);
    return () => window.removeEventListener("popstate",onPop);
  }, []);
  useEffect(() => {
    const stored = readRouteStack();
    const previousIndex = stored.lastIndexOf(path);
    const next = browserPop.current && previousIndex >= 0
      ? stored.slice(0,previousIndex+1) : rememberAppRoute(stored,path);
    browserPop.current = false;
    sessionStorage.setItem(routeStackKey,JSON.stringify(next));
  }, [path]);
  function goBack() {
    const { destination,stack } = previousAppRoute(readRouteStack(),path);
    sessionStorage.setItem(routeStackKey,JSON.stringify(stack));
    router.push(destination);
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/app" className="wordmark">
          EXCLUSIV<span>®</span>
        </Link>
        <div className="side-caption">GESTÃO DA LOJA</div>
        <nav>
          {[...nav.slice(0, 4), ...extra].map(([url, name, Icon]) => (
            <Link
              key={url}
              href={"/app/" + url}
              className={
                (path === "/app" + (url ? "/" + url : "") ||
                  (url === "estoque" && activeNav === "estoque") ? "active " : "") +
                (url === "vender" ? "sell-link" : "")
              }
              aria-current={path === "/app" + (url ? "/" + url : "") ? "page" : undefined}
            >
              <Icon size={20} />
              {name}
              {url === "vender" && <ArrowUpRight size={17} />}
            </Link>
          ))}
        </nav>
        <div className="side-bottom">
          <span>EXCLUSIV / 026</span>
          <small>Feito para o seu corre.</small>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <Link href="/app" className="mobile-brand wordmark">
            EXCLUSIV<span>®</span>
          </Link>
          <span className="desktop-breadcrumb">
            OPERAÇÃO <span>/</span>{" "}
            {path.split("/")[2]?.toUpperCase() || "VISÃO GERAL"}
          </span>
          <div className="top-actions">
            <button
              className="icon-button"
              aria-label="Busca global"
              onClick={() => setSearch("")}
            >
              <Search size={20} />
            </button>
            <Link
              className="icon-button"
              aria-label="Alertas"
              href="/app/alertas"
            >
              <Bell size={20} />
            </Link>
            <button
              className="avatar"
              title="Sair"
              aria-label="Sair"
              onClick={async () => {
                await supabase?.auth.signOut();
                router.replace("/login");
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        {!online && (
          <div className="banner">
            Sem conexão. Algumas funções estão indisponíveis.
          </div>
        )}
        <main className="content">
          {path !== "/app" && <div className="page-back-row"><button type="button" className="page-back-button" onClick={goBack}><ArrowLeft size={18} /> Voltar</button></div>}
          {loading ? (
            <div className="skeleton" aria-label="Carregando">
              <div />
              <div />
              <div />
            </div>
          ) : error ? (
            <Empty title="Não foi possível carregar" text={error}>
              <button onClick={() => void load()}>Tentar novamente</button>
            </Empty>
          ) : (
            children
          )}
          {!demo && !loading && !error && (
            <button
              className="ghost full"
              disabled={busy}
              onClick={() => void loadMore()}
            >
              Carregar registros anteriores
            </button>
          )}
        </main>
        <nav className="bottom-nav">
          {nav.map(([url, name, Icon]) => (
            <Link
              key={url}
              href={"/app/" + url}
              className={
                (activeNav === url ? "active " : "") +
                (url === "vender" ? "sell-tab" : "")
              }
              aria-current={activeNav === url ? "page" : undefined}
            >
              <Icon size={22} />
              <span>{name}</span>
            </Link>
          ))}
        </nav>
      </div>
      {notice && !undo && (
        <div role="status" className="toast">
          {notice}
        </div>
      )}
      {undo && <div className="undo-toast" role="status">
        <span>{undo.label}</span>
        <button disabled={busy} onClick={() => void undoLast()}>Desfazer</button>
      </div>}
      {search !== null && (
        <Sheet title="Buscar na EXCLUSIV" close={() => setSearch(null)}>
          <label className="field">
            <span>Produto, SKU, cliente ou venda</span>
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {search.length > 1 && (
            <div className="list">
              {data.products
                .filter(
                  (p) =>
                    p.name.toLowerCase().includes(search.toLowerCase()) ||
                    data.product_variants.some(
                      (v) =>
                        v.product_id === p.id &&
                        (v.sku.toLowerCase().includes(search.toLowerCase()) ||
                          v.barcode === search),
                    ),
                )
                .map((p) => (
                  <Link
                    onClick={() => setSearch(null)}
                    href={"/app/produtos/" + p.id}
                    key={p.id}
                  >
                    {p.name} <span>Produto <ArrowUpRight size={15} /></span>
                  </Link>
                ))}
              {data.customers
                .filter((c) =>
                  (c.name + c.phone)
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((c) => (
                  <Link
                    onClick={() => setSearch(null)}
                    href={"/app/clientes/" + c.id}
                    key={c.id}
                  >
                    {c.name}
                    <span>Cliente <ArrowUpRight size={15} /></span>
                  </Link>
                ))}
              {data.sales
                .filter((s) => String(s.number).includes(search))
                .map((s) => (
                  <Link
                    onClick={() => setSearch(null)}
                    href={"/app/vendas/" + s.id}
                    key={s.id}
                  >
                    Venda #{s.number}
                    <span>Ver <ArrowUpRight size={15} /></span>
                  </Link>
                ))}
            </div>
          )}
          <p className="muted">
            Busca nos registros carregados (500 por lote) de cada módulo.
          </p>
        </Sheet>
      )}
    </div>
  );
}
