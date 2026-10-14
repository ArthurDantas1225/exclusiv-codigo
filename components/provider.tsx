"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import { requestCatalogSync } from "@/lib/catalog-sync";
import { emptyStore, type Store, type Profile } from "@/lib/types";
import { useRouter, usePathname } from "next/navigation";
interface Context {
  data: Store;
  profile: Profile | null;
  loading: boolean;
  demo: boolean;
  error: string;
  busy: boolean;
  online: boolean;
  notice: string;
  undo: { label: string; action: string; payload: Record<string, unknown> } | null;
  undoLast: () => Promise<void>;
  load: () => Promise<void>;
  loadMore: () => Promise<void>;
  run: (
    action: string,
    p: Record<string, unknown>,
  ) => Promise<string | undefined>;
  notify: (message: string) => void;
}
const catalogActions = new Set(["product_grid", "product_archive", "image_save", "image_hidden", "catalog_visibility", "sale", "stock", "purchase", "receive_purchase", "cancel", "return", "import"]);
const Ctx = createContext<Context | null>(null);
const tableOrder = (table: string) =>
  table === "app_settings"
    ? "key"
    : ["sale_items", "sale_payments"].includes(table)
      ? "id"
      : table === "crm_tasks"
        ? "due_date"
        : "created_at";
export function Provider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Store>(emptyStore),
    [profile, setProfile] = useState<Profile | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [online, setOnline] = useState(true),
    [notice, setNotice] = useState(""),
    [undo, setUndo] = useState<Context["undo"]>(null);
  const demo = false;
  const router = useRouter();
  const pathname = usePathname();
  const inFlight = useRef(false);
  const retryKeys = useRef(new Map<string, string>());
  const suppressUndo = useRef(false);
  const notify = useCallback((m: string) => setNotice(m), []);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 2000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), 4000);
    return () => window.clearTimeout(timer);
  }, [undo]);
  const load = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      router.replace("/login");
      return;
    }
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        router.replace("/login");
        return;
      }
      const { data: p, error: pe } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .eq("active", true)
        .single();
      if (pe || !p)
        throw new Error(
          "Sua conta ainda não foi vinculada à EXCLUSIV. Siga a configuração de administradores no README.",
        );
      setProfile(p);
      const entries = await Promise.all(
        Object.keys(emptyStore).map(async (table) => {
          const order = tableOrder(table);
          const { data: rows, error } = await supabase!
            .from(table)
            .select("*")
            .order(order, { ascending: false })
            .limit(500);
          if (error) throw new Error(error.message);
          return [table, rows ?? []];
        }),
      );
      const { data: balances, error: be } = await supabase.rpc("balances");
      if (be) throw new Error(be.message);
      setData({ ...Object.fromEntries(entries), balances } as Store);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível carregar os dados.",
      );
    } finally {
      setLoading(false);
    }
  }, [router]);
  useEffect(() => {
    void load();
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    const on = () => setOnline(navigator.onLine);
    on();
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    const sub = supabase?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setData(emptyStore);
        router.replace("/login");
      }
    });
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
      sub?.data.subscription.unsubscribe();
    };
  }, [load, router]);
  useEffect(() => {
    if (demo || loading || !supabase) return;
    const [, , module, id] = pathname.split("/");
    if (!id || !["produtos", "clientes", "vendas"].includes(module)) return;
    let active = true;
    async function details() {
      const table =
        module === "produtos"
          ? "products"
          : module === "clientes"
            ? "customers"
            : "sales";
      const { data: record, error } = await supabase!
        .from(table)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!record) {
        notify("Registro não encontrado.");
        return;
      }
      const entries: [string, { id: string }[]][] = [[table, [record]]];
      const related =
        module === "produtos"
          ? [
              ["product_variants", "product_id"],
              ["product_images", "product_id"],
            ]
          : module === "clientes"
            ? [
                ["sales", "customer_id"],
                ["ledger", "customer_id"],
              ]
            : [
                ["sale_items", "sale_id"],
                ["sale_payments", "sale_id"],
                ["ledger", "sale_id"],
              ];
      await Promise.all(
        related.map(async ([t, field]) => {
          const { data: rows, error } = await supabase!
            .from(t)
            .select("*")
            .eq(field, id)
            .limit(500);
          if (error) throw new Error(error.message);
          entries.push([t, rows ?? []]);
        }),
      );
      if (module === "vendas" && record.customer_id) {
        const { data: c, error } = await supabase!
          .from("customers")
          .select("*")
          .eq("id", record.customer_id)
          .single();
        if (error) throw new Error(error.message);
        entries.push(["customers", [c]]);
      }
      if (active)
        setData((current) => ({
          ...current,
          ...Object.fromEntries(
            entries.map(([t, rows]) => [
              t,
              [
                ...new Map(
                  [
                    ...(current[t as keyof Store] as { id: string }[]),
                    ...rows,
                  ].map((r) => [r.id, r]),
                ).values(),
              ],
            ]),
          ),
        }));
    }
    void details().catch((e) =>
      notify(
        e instanceof Error ? e.message : "Não foi possível carregar o detalhe.",
      ),
    );
    return () => {
      active = false;
    };
  }, [pathname, demo, loading, notify]);
  async function loadMore() {
    if (demo || !supabase || busy) return;
    setBusy(true);
    try {
      const entries = await Promise.all(
        Object.keys(emptyStore).map(async (table) => {
          const current = data[table as keyof typeof emptyStore] as {
            id: string;
          }[];
          const { data: rows, error } = await supabase!
            .from(table)
            .select("*")
            .order(tableOrder(table), { ascending: false })
            .range(current.length, current.length + 499);
          if (error) throw new Error(error.message);
          return [
            table,
            [
              ...new Map(
                [...current, ...(rows ?? [])].map((row) => [row.id, row]),
              ).values(),
            ],
          ];
        }),
      );
      setData({ ...data, ...Object.fromEntries(entries) });
      notify("Registros anteriores carregados.");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Falha ao carregar.");
    } finally {
      setBusy(false);
    }
  }
  async function run(action: string, p: Record<string, unknown>) {
    if (demo) {
      notify("Prévia de leitura. Conecte o Supabase para salvar dados reais.");
      return;
    }
    if (!online) {
      notify("Sem conexão. Operação não enviada.");
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    const signature = action + JSON.stringify(p);
    const requestId =
      p.request_id ?? retryKeys.current.get(signature) ?? crypto.randomUUID();
    retryKeys.current.set(signature, String(requestId));
    try {
      const payload = { ...p, request_id: requestId };
      const { data: r, error: e } = action === "product_grid"
        ? await supabase!.rpc("save_product_grid_with_taxonomy", { p: payload })
        : action === "product_archive"
          ? await supabase!.rpc("set_product_archived", { target_product_id: p.product_id, archive: p.archive })
          : action === "image_save"
            ? await supabase!.rpc("save_product_image", { p: payload })
            : action === "image_hidden"
              ? await supabase!.rpc("set_product_image_hidden", { target_image_id: p.image_id, hide: p.hide })
              : action === "product_bundle"
        ? await supabase!.rpc("create_product_bundle", { p: payload })
        : action === "variant_save"
          ? await supabase!.rpc("save_variant", { p: payload })
          : action === "catalog_visibility"
            ? await supabase!.rpc("set_catalog_visible", {
                target_product_id: p.product_id,
                visible: p.visible,
              })
            : await supabase!.rpc("command", { action, p: payload });
      if (e) throw new Error(e.message);
      await load();
      if (catalogActions.has(action)) {
        try { await requestCatalogSync(); notify("Operação registrada e catálogo atualizado."); }
        catch { notify("Operação salva. A atualização do catálogo ficou pendente; use Sincronizar catálogo para tentar novamente."); }
      } else notify("Operação registrada.");
      if (!suppressUndo.current) {
        if (action === "product_archive") setUndo({ label: p.archive ? "Produto arquivado" : "Produto restaurado", action, payload: { product_id: p.product_id, archive: !p.archive } });
        else if (action === "image_hidden") setUndo({ label: p.hide ? "Foto removida" : "Foto restaurada", action, payload: { image_id: p.image_id, hide: !p.hide } });
        else if (action === "catalog_visibility") setUndo({ label: p.visible ? "Produto publicado" : "Produto ocultado", action, payload: { product_id: p.product_id, visible: !p.visible } });
        else setUndo(null);
      }
      retryKeys.current.delete(signature);
      return String(r.id);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Não foi possível salvar.");
      return;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function undoLast() {
    if (!undo || busy) return;
    const last = undo;
    setUndo(null);
    suppressUndo.current = true;
    try { await run(last.action,last.payload); }
    finally { suppressUndo.current = false; }
  }
  return (
    <Ctx.Provider
      value={{
        data,
        profile,
        loading,
        error,
        demo,
        busy,
        online,
        notice,
        undo,
        undoLast,
        load,
        loadMore,
        run,
        notify,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("Provider ausente");
  return c;
}
