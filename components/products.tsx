"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ProductPhotos } from "./product-photos";
import { ProductEditor } from "./product-editor";
import { StockProductCard } from "./stock-product-card";
import { supabase } from "@/lib/supabase";
import { requestCatalogSync } from "@/lib/catalog-sync";
import { Plus, ArrowUpRight, Download, Globe2, Trash2, RotateCcw } from "lucide-react";
import { useStore } from "./provider";
import { Card, Stat, Empty, Sheet, Field, Form } from "./ui";
import { money, dateTime, downloadCSV } from "@/lib/format";
import type { Product } from "@/lib/types";
export function Products({
  id,
  stock = false,
}: {
  id?: string;
  stock?: boolean;
}) {
  const { data, profile, run, busy, notify } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const [clock] = useState(() => Date.now());
  const [photoUrls, setPhotoUrls] = useState<Record<string,string>>({});
  const [syncingCatalog, setSyncingCatalog] = useState(false);
  const [modal, setModal] = useState(params.get("novo") ? "product" : ""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("Todos"),
    [selected, setSelected] = useState("");
  const product = data.products.find((p) => p.id === id);
  const currentProducts = data.products.filter((p) => !p.archived_at);
  const archivedProducts = data.products.filter((p) => !!p.archived_at);
  useEffect(() => {
    if (!supabase || !stock || id) return;
    let mounted = true;
    const images = data.products.filter((p) => !p.archived_at).flatMap((p) => {
      const photos = data.product_images.filter((image) => image.product_id === p.id && !image.hidden_at);
      const cover = photos.find((image) => image.is_primary) ?? photos[0];
      return cover ? [{ productId:p.id,path:cover.path }] : [];
    });
    if (!images.length) return;
    void supabase.storage.from("products").createSignedUrls(images.map((image) => image.path),3600).then(({ data: signed }) => {
      if (mounted) setPhotoUrls(Object.fromEntries(images.map((image,index) => [image.productId,signed?.[index]?.signedUrl ?? ""])));
    });
    return () => { mounted = false; };
  }, [data.products,data.product_images,stock,id]);
  const actorName = (actor?: string) =>
    data.profiles.find((p) => p.id === actor)?.name ?? "Equipe EXCLUSIV";
  const productAuthor = (productId: string) => {
    const history = data.audit_logs.filter((a) => a.action === "product" && a.entity_id === productId);
    return history.length ? actorName(history[history.length - 1].user_id) : "Registro anterior";
  };
  const variants = data.product_variants.filter((v) =>
    id ? v.product_id === id : currentProducts.some((p) => p.id === v.product_id));
  const incomplete = currentProducts.filter((p) => !data.product_variants.some((v) => v.product_id === p.id));
  const [edit, setEdit] = useState<Product | undefined>();
  const products = (id ? data.products : currentProducts).filter((p) =>
    (
      p.name +
      " " +
      p.category +
      " " +
      (p.subcategory ?? "") +
      " " +
      p.collection +
      " " +
      data.product_variants
        .filter((v) => v.product_id === p.id)
        .map((v) => v.sku + " " + v.barcode + " " + v.color)
        .join(" ")
    )
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const lastSale = (vid: string) =>
    Math.max(
      0,
      ...data.sale_items
        .filter(
          (i) =>
            i.variant_id === vid &&
            data.sales.some(
              (s) => s.id === i.sale_id && s.status !== "cancelled",
            ),
        )
        .map((i) =>
          new Date(
            data.sales.find((s) => s.id === i.sale_id)!.created_at,
          ).getTime(),
        ),
    );
  const days = (vid: string, created: string) =>
    Math.floor(
      (clock - (lastSale(vid) || new Date(created).getTime())) / 86400000,
    );
  const matchesStockFilter = (v: (typeof variants)[number]) =>
    filter === "Todos" ||
    (filter === "Precisa repor" && v.stock <= v.minimum) ||
    (filter === "Sem estoque" && v.stock === 0) ||
    (filter.includes("dias") && v.stock > 0 && days(v.id,v.created_at) >= parseInt(filter));
  const stockProducts = products.filter((p) => filter === "Todos" || variants.some((v) => v.product_id === p.id && matchesStockFilter(v)));
  const sizeList = (
    data.app_settings.find((s) => s.key === "sizes")?.value ?? "PP,P,M,G,GG,XG"
  ).split(",");
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">CATÁLOGO / EXCLUSIV</div>
          <h1>
            {product?.name ?? (stock ? "Seu estoque, em dia." : "Produtos")}
          </h1>
          <p>
            {product
              ? `${product.category} · ${product.collection}`
              : "Cada cor. Cada tamanho. Cada peça."}
          </p>
        </div>
        <div className="inline-actions">
          {!id && profile?.role === "admin" && <button className="ghost" disabled={busy || syncingCatalog} onClick={async () => {
            setSyncingCatalog(true);
            try {
              await requestCatalogSync(data.products.map((item) => item.id));
              notify("Catálogo e fotos sincronizados.");
            } catch (error) {
              notify(error instanceof Error ? error.message : "Não foi possível sincronizar.");
            } finally {
              setSyncingCatalog(false);
            }
          }}><Globe2 size={18} /> {syncingCatalog ? "Enviando fotos…" : "Sincronizar catálogo"}</button>}
          <button
            className="primary"
            disabled={busy}
            onClick={() => {
              if (product?.archived_at) {
                void run("product_archive", { product_id:product.id, archive:false });
                return;
              }
              setEdit(product);
              setModal("product");
            }}
          >
            {product?.archived_at ? <RotateCcw size={18} /> : <Plus size={18} />}
            {product?.archived_at ? "Restaurar" : product ? "Editar tudo" : "Novo produto"}
          </button>
        </div>
      </div>
      {stock && (
        <div className="stats">
          <Stat
            label="Peças carregadas"
            value={variants.reduce((a, v) => a + v.stock, 0)}
          />
          <Stat
            label="Custo em estoque"
            value={money(variants.reduce((a, v) => a + v.stock * v.cost, 0))}
          />
          <Stat
            label="Precisa repor"
            value={variants.filter((v) => v.stock <= v.minimum).length}
          />
          <Stat
            label="Sem venda há 60 dias"
            value={
              variants.filter(
                (v) => v.stock > 0 && days(v.id, v.created_at) >= 60,
              ).length
            }
          />
        </div>
      )}
      {!id && (
        <>
          <div className="toolbar">
            <input
              className="search-input"
              aria-label="Buscar produtos"
              placeholder="Nome, SKU, código de barras, cor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              onClick={() =>
                downloadCSV(
                  "estoque",
                  variants.map((v) => ({
                    ...v,
                    produto: data.products.find((p) => p.id === v.product_id)
                      ?.name,
                  })),
                )
              }
            >
              <Download size={17} />
              CSV
            </button>
            <Link className="button" href="/app/inventario">
              Inventário
            </Link>
          </div>
          {stock && (
            <div className="chips">
              {[
                "Todos",
                "Precisa repor",
                "Sem estoque",
                "30 dias",
                "60 dias",
                "90 dias",
                "120 dias",
              ].map((f) => (
                <button
                  key={f}
                  className={f === filter ? "selected" : ""}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {id && product && (
        <>
          <p className="fine attribution">Cadastrado por {productAuthor(product.id)} · {dateTime(product.created_at)}</p>
          {product.archived_at && <div className="banner">Produto excluído da operação e do catálogo. Histórico, estoque e fotos foram preservados para restauração.</div>}
          {!variants.length && <div className="banner">Este produto foi salvo, mas ainda não tem tamanho e cor. Adicione a primeira variação para aparecer no estoque e poder ser vendido.</div>}
          <div className="stats">
            <Stat label="Preço de venda" value={money(product.price)} accent />
            <Stat label="Variantes" value={variants.length} />
            <Stat
              label="Peças disponíveis"
              value={variants.reduce((a, v) => a + v.stock, 0)}
            />
            <Stat label="Coleção" value={product.collection || "Sem coleção"} />
          </div>
          {!product.archived_at && <><div className="toolbar">
            <button className="primary" onClick={() => { setEdit(product); setModal("product"); }}>
              <Plus size={18} />
              {variants.length ? "Editar cores, tamanhos e quantidades" : "Completar cores, tamanhos e estoque"}
            </button>
            <Link className="button" href={`/app/vender?produto=${product.id}`}>
              Vender este produto <ArrowUpRight size={17} />
            </Link>
          </div>
          <button className="ghost section-gap" disabled={busy} onClick={async () => {
            if (await run("product_archive", { product_id:product.id, archive:true })) router.push("/app/produtos");
          }}><Trash2 size={17} /> Excluir produto (pode desfazer)</button>
          <Card className="section-gap">
            <div className="row"><div><h2>Catálogo online</h2><small>{product.catalog_visible ? "Publicado para clientes" : "Visível apenas para a equipe"}</small></div><Globe2 size={22} /></div>
            <p className="fine">Somente nome, fotos, preço, opções e quantidade disponível são mostrados. O custo permanece interno.</p>
            <div className="inline-actions section-gap">
              <button disabled={busy || !variants.length} onClick={() => void run("catalog_visibility", { product_id: product.id, visible: !product.catalog_visible })}>
                {product.catalog_visible ? "Ocultar do catálogo" : "Publicar no catálogo"}
              </button>
              <button disabled={!product.catalog_visible} onClick={async () => {
                await navigator.clipboard.writeText(`${location.origin}/catalogo`);
                notify("Link do catálogo copiado.");
              }}>Copiar link</button>
            </div>
          </Card></>}
        </>
      )}
      {id ? (
        <Card>
          {variants
            .filter(
              (v) =>
                products.some((p) => p.id === v.product_id) &&
                matchesStockFilter(v),
            )
            .map((v) => (
              <div className="row" key={v.id}>
                <div>
                  <Link href={"/app/produtos/" + v.product_id}>
                    <strong>
                      {data.products.find((p) => p.id === v.product_id)?.name}
                    </strong>
                  </Link>
                  <small>
                    {v.model ? `${v.model} · ` : ""}{v.color} / {v.size} · {v.sku}
                  </small>
                  <small>
                    Custo {money(v.cost)} · Margem bruta {money((data.products.find((p) => p.id === v.product_id)?.price ?? 0) - v.cost)} · {days(v.id, v.created_at)} dias sem
                    venda
                  </small>
                </div>
                <div>
                  <span
                    className={
                      "badge " + (v.stock <= v.minimum ? "warning" : "")
                    }
                  >
                    {v.stock} un.
                  </span>
                  <button
                    className="ghost"
                    style={{ marginLeft: 8 }}
                    onClick={() => {
                      setSelected(v.id);
                      setModal("stock");
                    }}
                  >
                    Ajustar
                  </button>
                  {id && <button className="ghost" style={{ marginLeft: 8 }} onClick={() => { setEdit(product); setModal("product"); }}>Editar grade</button>}
                </div>
              </div>
            ))}
          {!variants.length && (
            <Empty
              title="Cadastre as variações"
              text="Crie um SKU para cada combinação de tamanho e cor."
            />
          )}
        </Card>
      ) : stock ? (
        <div className="stock-product-list">
          {stockProducts.map((p) => <StockProductCard key={p.id} product={p}
            variants={variants.filter((v) => v.product_id === p.id)} photo={photoUrls[p.id]}
            onAdjust={(variantId) => { setSelected(variantId); setModal("stock"); }}
            onEdit={() => { setEdit(p); setModal("product"); }} />)}
          {!stockProducts.length && <Empty title="Nenhum produto encontrado" text="Tente outra busca ou ajuste os filtros." />}
        </div>
      ) : (
        <div className="product-grid">
          {products.map((p) => (
            <Card className="product-card" key={p.id}>
              <div className="product-top">
                <div className="product-mark">
                  {p.name.slice(0, 2).toUpperCase()}
                </div>
                <span className={"badge " + (incomplete.some((x) => x.id === p.id) ? "warning" : "gray")}>
                  {incomplete.some((x) => x.id === p.id) ? "Incompleto" : p.active ? "Ativo" : "Arquivado"}
                </span>
              </div>
              <div className="product-meta">
                {p.collection || "SEM COLEÇÃO"}
              </div>
              <h3>{p.name}</h3>
              <small>{p.category}</small>
              <div className="product-price">{money(p.price)}</div>
              <small className="attribution">Cadastro: {productAuthor(p.id)} · {p.catalog_visible ? "Online" : "Interno"}</small>
              <div className="sizes">
                {data.product_variants
                  .filter((v) => v.product_id === p.id)
                  .map((v) => (
                    <span
                      className={
                        "badge " + (v.stock <= v.minimum ? "warning" : "gray")
                      }
                      key={v.id}
                    >
                      {v.model ? `${v.model} · ` : ""}{v.color} · {v.size} · {v.stock}
                    </span>
                  ))}
              </div>
              <Link
                href={"/app/produtos/" + p.id}
                className="button full ghost"
              >
                {incomplete.some((x) => x.id === p.id) ? "Completar cadastro" : "Ver produto"} <ArrowUpRight size={17} />
              </Link>
            </Card>
          ))}
        </div>
      )}
      {!stock && !products.length && (
        <Empty
          title="Seu catálogo começa aqui"
          text="Cadastre um produto e adicione suas variações."
        />
      )}
      {!id && !!archivedProducts.length && <details className="section-gap archived-products"><summary>Produtos excluídos ({archivedProducts.length}) · restaurar</summary>
        {archivedProducts.map((item) => <div className="row" key={item.id}><div><strong>{item.name}</strong><small>Histórico e fotos preservados</small></div>
          <button className="ghost" disabled={busy} onClick={() => void run("product_archive", { product_id:item.id, archive:false })}><RotateCcw size={16} /> Restaurar</button>
        </div>)}
      </details>}
      <p className="fine">
        500 registros por lote; carregue mais no fim da página. Exportação e
        análises desta tela consideram os registros carregados.
      </p>
      {id && (
        <Card className="section-gap">
          <h2>Histórico de movimentações</h2>
          {data.inventory_movements
            .filter((m) => variants.some((v) => v.id === m.variant_id))
            .map((m) => (
              <div className="row" key={m.id}>
                <div>
                  <strong>{m.reason}</strong>
                  <small>{dateTime(m.created_at)} · {actorName(m.created_by)}</small>
                </div>
                <span>
                  {m.before_stock} → {m.after_stock}
                </span>
              </div>
            ))}
        </Card>
      )}
      {id && product && !product.archived_at && <ProductPhotos productId={id} />}
      {modal === "product" && (
        <Sheet title={edit ? "Editar produto completo" : "Novo produto completo"} close={() => setModal("")}>
          <ProductEditor key={edit?.id ?? "new"} product={edit} variants={edit ? data.product_variants.filter((v) => v.product_id === edit.id) : []} sizeOptions={sizeList}
            onSaved={(savedId) => { setModal(""); router.push(`/app/produtos/${savedId}`); }} />
        </Sheet>
      )}
      {modal === "stock" && (
        <Sheet title="Movimentar estoque" close={() => setModal("")}>
          <Form
            busy={busy}
            onSubmit={async (f) => {
              if (
                await run("stock", {
                  variant_id: selected,
                  quantity: Number(f.get("quantity")),
                  reason: f.get("reason"),
                })
              )
                setModal("");
            }}
          >
            <Field
              name="quantity"
              label="Quantidade (+ entrada / − saída)"
              type="number"
              required
            />
            <Field name="reason" label="Motivo da movimentação" required />
            <p className="fine">
              O saldo será atualizado com registro de responsável, horário e
              motivo.
            </p>
          </Form>
        </Sheet>
      )}
    </>
  );
}
