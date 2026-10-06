"use client";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ImageOff, Pencil, SlidersHorizontal } from "lucide-react";
import { categoryForProduct } from "@/lib/catalog-taxonomy";
import { availableVariants } from "@/lib/domain";
import { money } from "@/lib/format";
import type { Product, Variant } from "@/lib/types";
import { Card } from "./ui";

export function StockProductCard({ product, variants, photo, onAdjust, onEdit }: {
  product: Product; variants: Variant[]; photo?: string;
  onAdjust: (variantId: string) => void; onEdit: () => void;
}) {
  const available = availableVariants(variants);
  const units = variants.reduce((sum, variant) => sum + variant.stock, 0);
  const averageCost = variants.length ? Math.round(variants.reduce((sum, variant) => sum + variant.cost * (units ? variant.stock : 1),0) / (units || variants.length)) : 0;
  const margin = product.price - averageCost;
  const colors = [...new Set(available.map((variant) => variant.color.trim()).filter(Boolean))];
  const sizes = [...new Set(available.map((variant) => variant.size.trim()).filter(Boolean))];
  const codes = [...new Set(available.map((variant) => variant.sku.trim()).filter(Boolean))];
  const category = categoryForProduct(product.category,product.name);
  return <Card className="stock-product-card">
    <div className="stock-product-head">
      <Link className="stock-product-image" href={`/app/produtos/${product.id}`} aria-label={`Ver ${product.name}`}>
        {photo ? <Image unoptimized src={photo} alt={product.name} width={420} height={420} /> : <ImageOff size={30} aria-hidden="true" />}
      </Link>
      <div className="stock-product-title">
        <small>{category}{product.subcategory ? ` · ${product.subcategory}` : ""}</small>
        <Link href={`/app/produtos/${product.id}`}><h2>{product.name}</h2></Link>
        <p>{colors.length} {colors.length === 1 ? "cor" : "cores"} · {sizes.length} {sizes.length === 1 ? "tamanho" : "tamanhos"} · {units} {units === 1 ? "peça" : "peças"}</p>
        <p className="stock-product-code">Código: {codes.length ? `${codes.slice(0,2).join(" · ")}${codes.length > 2 ? ` +${codes.length-2}` : ""}` : "a definir"}</p>
      </div>
      <span className={`badge ${!variants.length || variants.some((variant) => variant.stock <= variant.minimum) ? "warning" : "gray"}`}>
        {!variants.length ? "Completar cadastro" : units ? `${units} em estoque` : "Sem estoque"}
      </span>
    </div>
    {!!variants.length && <>
      <div className="stock-product-options">{available.length
        ? available.map((variant) => <span key={variant.id}>{variant.color.trim()} · {variant.size.trim()} <b>{variant.stock} un.</b></span>)
        : <span>Nenhuma variação disponível em estoque.</span>}</div>
      <div className="stock-product-metrics"><div><small>Preço de venda</small><strong>{money(product.price)}</strong></div><div><small>Custo médio por peça</small><strong>{money(averageCost)}</strong></div><div><small>Margem bruta média</small><strong>{money(margin)}{product.price > 0 ? ` · ${Math.round(margin / product.price * 100)}%` : ""}</strong></div></div>
      {!!available.length && <details className="stock-product-details"><summary><SlidersHorizontal size={16} /> Ver variações disponíveis e ajustar estoque</summary><div className="stock-product-variants">{available.map((variant) => <div className="stock-variant" key={variant.id}><div><strong>{variant.model ? `${variant.model} · ` : ""}{variant.color.trim()} / {variant.size.trim()}</strong><small>{variant.sku} · custo {money(variant.cost)} · {variant.stock} un.</small></div><button type="button" className="ghost" onClick={() => onAdjust(variant.id)}>Ajustar</button></div>)}</div></details>}
    </>}
    <div className="stock-product-actions"><Link className="button ghost" href={`/app/produtos/${product.id}`}>Ver produto <ArrowUpRight size={16} /></Link><button type="button" className="ghost" onClick={onEdit}><Pencil size={16} /> Editar grade</button></div>
  </Card>;
}
