"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Minus, Trash2, ShoppingBag, ImageOff } from "lucide-react";
import { useStore } from "./provider";
import { Card, Empty, Field, Sheet } from "./ui";
import { CustomerForm } from "./customers";
import { money, cents } from "@/lib/format";
import { methods, type ProductImage } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { coverPhoto, variantPhoto } from "@/lib/pos-photo";
import { availableVariants, saleSchema } from "@/lib/domain";
import { averageVariantCost, salaryFromRevenue } from "@/lib/profit";
type Line = { variant_id: string; quantity: number; unit_price: number };
export function POS() {
  const { data, run, busy, notify, online, demo } = useStore(),
    router = useRouter(),
    params = useSearchParams();
  const selectedProduct = params.get("produto");
  const [search, setSearch] = useState(""),
    [cart, setCart] = useState<Line[]>([]),
    [customer, setCustomer] = useState(""),
    [quick, setQuick] = useState(false),
    [discount, setDiscount] = useState("0"),
    [discountType, setDiscountType] = useState("BRL"),
    [payments, setPayments] = useState<{ method: string; amount: number }[]>([
      { method: "Pix", amount: 0 },
    ]),
    [note, setNote] = useState(""),
    [tendered, setTendered] = useState("0");
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const photosByProduct = useMemo(() => {
    const groups = new Map<string, ProductImage[]>();
    for (const image of data.product_images) {
      if (image.hidden_at) continue;
      const photos = groups.get(image.product_id) ?? [];
      photos.push(image);
      groups.set(image.product_id, photos);
    }
    return groups;
  }, [data.product_images]);
  const displayPhotos = useMemo(() => {
    const chosen = new Map<string, ProductImage>();
    for (const photos of photosByProduct.values()) {
      const cover = coverPhoto(photos);
      if (cover) chosen.set(cover.id, cover);
      for (const photo of photos) {
        if (!photo.color?.trim()) continue;
        const match = variantPhoto(photos, photo.color);
        if (match) chosen.set(match.id, match);
      }
    }
    return [...chosen.values()];
  }, [photosByProduct]);
  useEffect(() => {
    if (!supabase || !displayPhotos.length) return;
    let mounted = true;
    void supabase.storage.from("products").createSignedUrls(displayPhotos.map((photo) => photo.path), 3600)
      .then(({ data: signed }) => {
        if (mounted) setPhotoUrls(Object.fromEntries(displayPhotos.map((photo, index) => [photo.id, signed?.[index]?.signedUrl ?? ""])));
      });
    return () => { mounted = false; };
  }, [displayPhotos]);
  const key = useRef(crypto.randomUUID());
  const gross = cart.reduce((a, l) => a + l.quantity * l.unit_price, 0),
    disc =
      discountType === "%"
        ? Math.round((gross * Number(discount)) / 100)
        : cents(discount),
    total = gross - disc,
    cartCost = cart.reduce((sum, line) => {
      const variant = data.product_variants.find((item) => item.id === line.variant_id);
      return sum + line.quantity * (variant?.cost ?? 0);
    }, 0),
    estimatedSalary = salaryFromRevenue(total, cartCost),
    paid = payments.reduce((a, p) => a + p.amount, 0),
    visibleProducts = data.products.filter((p) => p.active &&
      (!selectedProduct || p.id === selectedProduct) &&
      (p.name + " " + p.category + " " + p.collection + " " +
        availableVariants(data.product_variants.filter((v) => v.product_id === p.id))
          .map((v) => `${v.sku} ${v.barcode} ${v.color} ${v.size} ${v.model ?? ""}`).join(" "))
        .toLowerCase().includes(search.toLowerCase())),
    cash = payments
      .filter((p) => p.method === "Dinheiro")
      .reduce((a, p) => a + p.amount, 0);
  function change(lines: Line[]) {
    setCart(lines);
    key.current = crypto.randomUUID();
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PONTO DE VENDA</div>
          <h1>Vamos fechar uma venda.</h1>
          <p>Produto, tamanho, pagamento. Pronto.</p>
        </div>
        <span className="badge gray">
          {cart.reduce((a, l) => a + l.quantity, 0)} peças
        </span>
      </div>
      {!data.cash_sessions.some((c) => c.status === "open") && (
        <div className="banner">
          Abra o caixa no Financeiro antes de concluir a venda.
        </div>
      )}
      <div className="split">
        <div>
          <div className="toolbar">
            <input
              aria-label="Buscar produto para venda"
              placeholder="Busque produto, SKU ou leia um código…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const v = availableVariants(data.product_variants).find(
                    (v) => v.barcode === search || v.sku === search,
                  );
                  if (v) {
                    const p = data.products.find((p) => p.id === v.product_id);
                    if (p?.active && v.stock > 0) {
                      const l = cart.find((l) => l.variant_id === v.id);
                      if (!l || l.quantity < v.stock) {
                        change(
                          l
                            ? cart.map((x) =>
                                x === l
                                  ? { ...x, quantity: x.quantity + 1 }
                                  : x,
                              )
                            : [
                                ...cart,
                                {
                                  variant_id: v.id,
                                  quantity: 1,
                                  unit_price: p.price,
                                },
                              ],
                        );
                        setSearch("");
                      }
                    }
                  }
                }
              }}
            />
            {selectedProduct && <Link className="button" href="/app/vender">Todos os produtos</Link>}
          </div>
          <div className="product-grid">
            {visibleProducts
              .map((p) => {
                const variants = data.product_variants.filter((v) => v.product_id === p.id);
                const available = availableVariants(variants);
                const units = variants.reduce((sum, variant) => sum + variant.stock, 0);
                const averageCost = averageVariantCost(variants);
                const estimatedProductSalary = salaryFromRevenue(p.price, averageCost);
                const cover = coverPhoto(photosByProduct.get(p.id) ?? []);
                const coverUrl = cover && photoUrls[cover.id];
                const colors = new Set(available.map((variant) => variant.color.trim()).filter(Boolean)).size;
                const sizes = new Set(available.map((variant) => variant.size.trim()).filter(Boolean)).size;
                return <Card className="product-card pos-product-card" key={p.id}>
                  <div className="pos-product-head">
                    <div className="pos-product-photo">
                      {coverUrl ? <Image src={coverUrl} alt={p.name} width={180} height={180} /> : <ImageOff size={27} aria-label="Produto sem foto" />}
                    </div>
                    <div className="pos-product-summary">
                      <div className="product-meta">{p.category}{p.subcategory ? ` · ${p.subcategory}` : ""}</div>
                      <h3>{p.name}</h3>
                      <p>{colors} {colors === 1 ? "cor" : "cores"} · {sizes} {sizes === 1 ? "tamanho" : "tamanhos"} · {units} {units === 1 ? "peça" : "peças"}</p>
                    </div>
                  </div>
                  <div className="pos-product-metrics">
                    <div><small>Preço de venda</small><strong>{money(p.price)}</strong></div>
                    <div><small>Custo médio</small><strong>{money(averageCost)}</strong></div>
                  </div>
                  <p className="pos-product-margin">Margem bruta média: <strong>{money(p.price - averageCost)}{p.price > 0 ? ` · ${Math.round((p.price - averageCost) / p.price * 100)}%` : ""}</strong><br />Salário estimado (50%): <strong>{money(estimatedProductSalary)}</strong></p>
                  <div className="sizes pos-sizes">
                    {!variants.length &&
                      <Link className="button ghost" href={`/app/produtos/${p.id}`}>
                        Complete tamanho, cor e estoque para vender
                      </Link>}
                    {available.map((v) => {
                        const line = cart.find((l) => l.variant_id === v.id);
                        return (
                          <button
                            key={v.id}
                            disabled={v.stock <= (line?.quantity ?? 0)}
                            onClick={() =>
                              change(
                                line
                                  ? cart.map((l) =>
                                      l === line
                                        ? { ...l, quantity: l.quantity + 1 }
                                        : l,
                                    )
                                  : [
                                      ...cart,
                                      {
                                        variant_id: v.id,
                                        quantity: 1,
                                        unit_price: p.price,
                                      },
                                    ],
                              )
                            }
                          >
                            <span>{v.model ? `${v.model} · ` : ""}{v.color} / {v.size}</span>
                            <small>{v.stock - (line?.quantity ?? 0)} un. · custo {money(v.cost)}</small>
                          </button>
                        );
                      })}
                    {!!variants.length && !available.length && (
                      <p className="fine">Sem variações disponíveis em estoque.</p>
                    )}
                  </div>
                </Card>;
              })}
          </div>
          {!data.products.length && (
            <Empty
              title="Cadastre seu primeiro produto"
              text="Os produtos ativos e suas variações aparecem aqui."
            />
          )}
          {!!data.products.length && !visibleProducts.length &&
            <Empty title="Nenhum produto encontrado" text="Confira a busca ou volte à lista completa." />}
        </div>
        <div id="sacola">
          <Card className="cart">
            <div className="card-head">
              <h2>Sacola da venda</h2>
              <ShoppingBag size={21} />
            </div>
            {!cart.length && (
              <Empty
                title="Sua sacola está vazia"
                text="Toque no tamanho de uma peça para adicionar."
              />
            )}
            {cart.map((l) => {
              const v = data.product_variants.find(
                (v) => v.id === l.variant_id,
              )!;
              const p = data.products.find((p) => p.id === v.product_id)!;
              const photo = variantPhoto(photosByProduct.get(p.id) ?? [], v.color);
              const photoUrl = photo && photoUrls[photo.id];
              return (
                <div className="cart-line" key={l.variant_id}>
                  <header>
                    <div className="pos-cart-product">
                      <div className="pos-cart-photo">
                        {photoUrl ? <Image src={photoUrl} alt={`${p.name} · ${v.color}`} width={112} height={112} /> : <ImageOff size={22} aria-label="Produto sem foto" />}
                      </div>
                      <div>
                        <strong>{p.name}</strong>
                        <small className="muted" style={{ display: "block" }}>
                          {v.model ? `${v.model} · ` : ""}{v.color} / {v.size}
                        </small>
                        <small className="muted" style={{ display: "block" }}>Custo: {money(v.cost)} · Venda: {money(l.unit_price)}</small>
                      </div>
                    </div>
                    <button
                      className="icon-button"
                      aria-label={"Remover " + p.name}
                      onClick={() => change(cart.filter((x) => x !== l))}
                    >
                      <Trash2 size={17} />
                    </button>
                  </header>
                  <div className="cart-controls">
                    <button
                      aria-label="Diminuir quantidade"
                      onClick={() =>
                        change(
                          l.quantity === 1
                            ? cart.filter((x) => x !== l)
                            : cart.map((x) =>
                                x === l
                                  ? { ...x, quantity: x.quantity - 1 }
                                  : x,
                              ),
                        )
                      }
                    >
                      <Minus size={16} />
                    </button>
                    <span>{l.quantity}</span>
                    <button
                      aria-label="Aumentar quantidade"
                      disabled={l.quantity >= v.stock}
                      onClick={() =>
                        change(
                          cart.map((x) =>
                            x === l ? { ...x, quantity: x.quantity + 1 } : x,
                          ),
                        )
                      }
                    >
                      <Plus size={16} />
                    </button>
                    <input
                      aria-label={"Preço unitário de " + p.name}
                      type="number"
                      min="0"
                      step="0.01"
                      value={l.unit_price / 100}
                      onChange={(e) =>
                        change(
                          cart.map((x) =>
                            x === l
                              ? { ...x, unit_price: cents(e.target.value) }
                              : x,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
              );
            })}
            <div className="section-gap">
              <Field name="customer" label="Cliente">
                <select
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                >
                  <option value="">Consumidor final</option>
                  {data.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <button
                className="ghost full"
                style={{ marginTop: 0 }}
                onClick={() => setQuick(true)}
              >
                <Plus size={16} />
                Cadastro rápido
              </button>
              <div className="form-grid section-gap">
                <Field name="discount" label="Desconto">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                  />
                </Field>
                <Field name="discountType" label="Tipo">
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value)}
                  >
                    <option>BRL</option>
                    <option>%</option>
                  </select>
                </Field>
              </div>
              <div className="total-row">
                <span>Subtotal</span>
                <span>{money(gross)}</span>
              </div>
              <div className="total-row">
                <span>Desconto</span>
                <span>− {money(disc)}</span>
              </div>
              <div className="total-row total">
                <span>Total</span>
                <span>{money(total)}</span>
              </div>
              <div className="total-row">
                <span>Salário estimado (50% do lucro real)</span>
                <strong>{money(estimatedSalary)}</strong>
              </div>
              <h3 className="section-gap">Pagamento</h3>
              {payments.map((p, i) => (
                <div className="payment-row" key={i}>
                  <select
                    aria-label={"Forma de pagamento " + (i + 1)}
                    value={p.method}
                    onChange={(e) =>
                      setPayments(
                        payments.map((x, j) =>
                          j === i ? { ...x, method: e.target.value } : x,
                        ),
                      )
                    }
                  >
                    {methods.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                  <input
                    aria-label={"Valor do pagamento " + (i + 1)}
                    type="number"
                    min={0}
                    step="0.01"
                    value={p.amount / 100}
                    onChange={(e) =>
                      setPayments(
                        payments.map((x, j) =>
                          j === i ? { ...x, amount: cents(e.target.value) } : x,
                        ),
                      )
                    }
                  />
                  <button
                    className="icon-button"
                    aria-label="Remover pagamento"
                    disabled={payments.length === 1}
                    onClick={() =>
                      setPayments(payments.filter((_, j) => i !== j))
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <div className="inline-actions">
                <button
                  className="ghost"
                  onClick={() =>
                    setPayments([
                      ...payments,
                      { method: "Dinheiro", amount: Math.max(0, total - paid) },
                    ])
                  }
                >
                  Dividir pagamento
                </button>
                <button
                  className="ghost"
                  onClick={() =>
                    setPayments([
                      {
                        method: payments[0]?.method ?? "Pix",
                        amount: Math.max(0, total),
                      },
                    ])
                  }
                >
                  Valor total
                </button>
              </div>
              <p
                className={"fine " + (paid !== total ? "negative" : "positive")}
              >
                {paid === total
                  ? "Pagamento completo"
                  : `Falta ${money(total - paid)}`}
              </p>
              {cash > 0 && (
                <>
                  <Field label="Dinheiro entregue (R$)" name="tendered">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={tendered}
                      onChange={(e) => setTendered(e.target.value)}
                    />
                  </Field>
                  <p className="fine">
                    Troco: {money(Math.max(0, cents(tendered) - cash))}
                  </p>
                </>
              )}
              <Field name="notes" label="Observação">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>
              <button
                className="primary full"
                disabled={
                  busy ||
                  !online ||
                  !cart.length ||
                  paid !== total ||
                  disc < 0 ||
                  disc > gross ||
                  (cash > 0 && cents(tendered) < cash)
                }
                onClick={async () => {
                  const input = {
                    request_id: key.current,
                    customer_id: customer || null,
                    discount: disc,
                    notes: note,
                    items: cart,
                    payments,
                    tendered: cents(tendered),
                  };
                  if(demo){notify("Prévia de leitura. Conecte o Supabase para salvar dados reais.");return;}
                  const parsed = saleSchema.safeParse(input);
                  if (!parsed.success) {
                    notify("Revise quantidades, descontos e pagamentos.");
                    return;
                  }
                  const id = await run("sale", parsed.data);
                  if (id) {
                    change([]);
                    router.push("/app/vendas/" + id + "?sucesso=1");
                  }
                }}
              >
                {busy ? "Registrando…" : "Concluir venda · " + money(total)}
              </button>
            </div>
          </Card>
        </div>
      </div>
      {!!cart.length && (
        <a className="mobile-cart-link primary" href="#sacola">
          Ver sacola · {cart.reduce((a, l) => a + l.quantity, 0)} peças{" "}
          <strong>{money(total)}</strong>
        </a>
      )}
      {quick && (
        <Sheet title="Cadastrar cliente" close={() => setQuick(false)}>
          <CustomerForm onSaved={() => setQuick(false)} />
        </Sheet>
      )}
    </>
  );
}
