"use client";
import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cents } from "@/lib/format";
import { catalogCategories, categoryForProduct, categoryNames, type CatalogCategory } from "@/lib/catalog-taxonomy";
import { supabase } from "@/lib/supabase";
import type { Product, Variant } from "@/lib/types";
import { useStore } from "./provider";
import { compressPhoto } from "./product-photos";
import { Field, Form } from "./ui";

type Cell = { id?: string; stock: string; cost: string; minimum: string; sku?: string; barcode?: string };
type ColorRow = { key: string; color: string; model: string; cells: Record<string, Cell>; front?: File; back?: File };
const freshCell = (): Cell => ({ stock: "0", cost: "0", minimum: "2" });
const rowKey = () => crypto.randomUUID();
function initialRows(variants: Variant[]): ColorRow[] {
  if (!variants.length) return [{ key: rowKey(), color: "", model: "", cells: {} }];
  const groups = new Map<string, ColorRow>();
  for (const variant of variants) {
    const key = `${variant.model ?? ""}\u0000${variant.color}`;
    if (!groups.has(key)) groups.set(key, { key: rowKey(), color: variant.color, model: variant.model ?? "", cells: {} });
    groups.get(key)!.cells[variant.size] = {
      id: variant.id, stock: String(variant.stock), cost: String(variant.cost / 100),
      minimum: String(variant.minimum), sku: variant.sku, barcode: variant.barcode,
    };
  }
  return [...groups.values()];
}

export function ProductEditor({ product, variants, sizeOptions, onSaved }: {
  product?: Product; variants: Variant[]; sizeOptions: string[]; onSaved: (id: string) => void;
}) {
  const { run, load, busy, profile, notify } = useStore();
  const sizes = [...new Set([...sizeOptions.map((s) => s.trim()).filter(Boolean), ...variants.map((v) => v.size)])];
  const [selectedSizes, setSelectedSizes] = useState<string[]>(() =>
    variants.length ? [...new Set(variants.map((v) => v.size))] :
      sizes.filter((s) => ["P", "M", "G", "GG"].includes(s)).slice(0, 4).length
        ? sizes.filter((s) => ["P", "M", "G", "GG"].includes(s)).slice(0, 4)
        : sizes.slice(0, 3));
  const [rows, setRows] = useState<ColorRow[]>(() => initialRows(variants));
  const [category, setCategory] = useState<CatalogCategory>(() => categoryForProduct(product?.category ?? "",product?.name));
  const [subcategory, setSubcategory] = useState(product?.subcategory ?? "");
  const [saving, setSaving] = useState(false);
  const saveGuard = useRef(false);
  const updateRow = (key: string, update: Partial<ColorRow>) =>
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...update } : row));
  const updateCell = (key: string, size: string, update: Partial<Cell>) =>
    setRows((current) => current.map((row) => row.key === key ? {
      ...row, cells: { ...row.cells, [size]: { ...(row.cells[size] ?? freshCell()), ...update } },
    } : row));
  function toggleSize(size: string) {
    if (selectedSizes.includes(size)) {
      if (rows.some((row) => row.cells[size]?.id)) {
        notify("Um tamanho já cadastrado permanece na grade para preservar o estoque e o histórico.");
        return;
      }
      setSelectedSizes((current) => current.filter((s) => s !== size));
    } else setSelectedSizes((current) => [...current, size]);
  }
  async function upload(file: File, productId: string, color: string, view: "front" | "back", primary: boolean) {
    if (!supabase || !profile) throw new Error("Sessão indisponível para fotos.");
    const path = `${profile.organization_id}/${productId}/${crypto.randomUUID()}.webp`;
    const blob = await compressPhoto(file);
    const { error } = await supabase.storage.from("products").upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
    if (error) throw error;
    const { error: metadataError } = await supabase.rpc("save_product_image", {
      p: { product_id: productId, path, color, view, is_primary: primary },
    });
    if (metadataError) {
      await supabase.storage.from("products").remove([path]);
      throw metadataError;
    }
  }
  return <Form busy={busy || saving} label={product ? "Salvar produto e estoque" : "Criar produto completo"} onSubmit={async (form) => {
    if (saveGuard.current) return;
    saveGuard.current = true;
    setSaving(true);
    try {
      const variantsToSave = rows.flatMap((row) => selectedSizes.map((size) => {
        const cell = row.cells[size] ?? freshCell();
        return { id: cell.id, model: row.model.trim(), color: row.color.trim(), size,
          stock: Number(cell.stock), cost: cents(cell.cost), minimum: Number(cell.minimum),
          sku: cell.sku ?? "", barcode: cell.barcode ?? "" };
      }));
      if (!variantsToSave.length || variantsToSave.length > 50) throw new Error("Escolha de 1 a 50 combinações de cores e tamanhos.");
      if (rows.some((row) => !row.color.trim())) throw new Error("Informe o nome de cada cor.");
      if (new Set(rows.map((row) => `${row.model.trim()}|${row.color.trim()}`.toLowerCase())).size !== rows.length)
        throw new Error("Há cores e modelos repetidos.");
      if (variantsToSave.some((v) => !Number.isInteger(v.stock) || v.stock < 0 || !Number.isInteger(v.minimum) || v.minimum < 0 || !Number.isFinite(v.cost) || v.cost < 0))
        throw new Error("Revise as quantidades, custos e mínimos da grade.");
      const id = await run("product_grid", {
        id: product?.id, name: String(form.get("name") ?? "").trim(),
        category,
        subcategory: subcategory.trim(),
        collection: String(form.get("collection") ?? "").trim(),
        price: cents(form.get("price")), active: form.get("active") === "on",
        catalog_visible: form.get("catalog_visible") === "on", variants: variantsToSave,
      });
      if (!id) return;
      const photos = rows.flatMap((row) => [
        row.front ? { file: row.front, color: row.color.trim(), view: "front" as const } : null,
        row.back ? { file: row.back, color: row.color.trim(), view: "back" as const } : null,
      ].filter((item): item is { file: File; color: string; view: "front" | "back" } => !!item));
      if (photos.length) {
        const results = await Promise.allSettled(photos.map((photo,index) => upload(photo.file,id,photo.color,photo.view,!product && index === 0)));
        await load();
        const failed = results.filter((result) => result.status === "rejected").length;
        if (failed) notify(`Produto salvo. ${failed} foto${failed === 1 ? " não foi enviada" : "s não foram enviadas"}; tente novamente em Fotos.`);
      }
      onSaved(id);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível salvar o produto.");
    } finally {
      saveGuard.current = false;
      setSaving(false);
    }
  }}>
    <Field name="name" label="Nome do produto" value={product?.name} required />
    <div className="form-grid">
      <label className="field"><span>Categoria principal</span><select name="category" value={category} onChange={(event) => { setCategory(event.target.value as CatalogCategory); setSubcategory(""); }}>{categoryNames.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label className="field"><span>Subcategoria</span>{catalogCategories[category].length ? <select name="subcategory" value={subcategory} onChange={(event) => setSubcategory(event.target.value)}><option value="">Escolha uma opção</option>{catalogCategories[category].map((item) => <option key={item} value={item}>{item}</option>)}</select> : <input name="subcategory" value={subcategory} onChange={(event) => setSubcategory(event.target.value)} placeholder="Opcional" maxLength={80} />}</label>
    </div>
    <div className="form-grid">
      <Field name="collection" label="Coleção" value={product?.collection} />
    </div>
    <Field name="price" label="Preço de venda (R$)" type="number" min={0} step="0.01" value={product ? product.price / 100 : undefined} required />
    <label className="check"><input name="active" type="checkbox" defaultChecked={product?.active ?? true} />Produto ativo para venda</label>
    <h3 className="section-gap">Tamanhos deste produto</h3>
    <p className="fine">Escolha os tamanhos uma vez. Depois informe a quantidade e o custo de cada cor abaixo.</p>
    <div className="chips product-size-chips">{sizes.map((size) => <button type="button" key={size} className={selectedSizes.includes(size) ? "selected" : ""} onClick={() => toggleSize(size)}>{size}</button>)}</div>
    <h3 className="section-gap">Cores e quantidades</h3>
    {rows.map((row,index) => <div className="color-matrix-card" key={row.key}>
      <div className="card-head"><h3>Cor {index + 1}</h3>{rows.length > 1 && !Object.values(row.cells).some((cell) => cell.id) &&
        <button type="button" className="icon-button" aria-label={`Remover cor ${index + 1}`} onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}><Trash2 size={17} /></button>}</div>
      <div className="form-grid">
        <label className="field"><span>Nome da cor</span><input value={row.color} onChange={(e) => updateRow(row.key,{color:e.target.value})} required placeholder="Ex.: Preto" /></label>
        <label className="field"><span>Modelo (opcional)</span><input value={row.model} onChange={(e) => updateRow(row.key,{model:e.target.value})} placeholder="Ex.: Oversized" /></label>
      </div>
      <div className="matrix-head"><span>Tamanho</span><span>Peças</span><span>Custo por peça</span></div>
      {selectedSizes.map((size) => {
        const cell = row.cells[size] ?? freshCell();
        return <div className="matrix-line" key={size}>
          <strong>{size}</strong>
          <input aria-label={`${row.color || `Cor ${index+1}`} tamanho ${size} quantidade`} type="number" min={0} step={1} value={cell.stock} onChange={(e) => updateCell(row.key,size,{stock:e.target.value})} required />
          <input aria-label={`${row.color || `Cor ${index+1}`} tamanho ${size} custo`} type="number" min={0} step="0.01" value={cell.cost} onChange={(e) => updateCell(row.key,size,{cost:e.target.value})} required />
        </div>;
      })}
      <p className="fine">Fotos opcionais desta cor (você pode adicionar mais depois).</p>
      <div className="form-grid">
        <label className="field"><span>Foto da frente</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => updateRow(row.key,{front:e.target.files?.[0]})} /></label>
        <label className="field"><span>Foto das costas</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => updateRow(row.key,{back:e.target.files?.[0]})} /></label>
      </div>
    </div>)}
    <button type="button" className="ghost" disabled={rows.length >= 12 || rows.length * selectedSizes.length >= 50} onClick={() => setRows((current) => [...current,{key:rowKey(),color:"",model:"",cells:{}}])}><Plus size={17} /> Adicionar outra cor</button>
    <label className="check section-gap"><input name="catalog_visible" type="checkbox" defaultChecked={product?.catalog_visible ?? false} />Mostrar no catálogo online</label>
    <p className="fine">O catálogo mostra somente fotos, nome, preço e opções com estoque. O custo fica interno.</p>
  </Form>;
}
