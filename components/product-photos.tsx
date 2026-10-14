"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { RotateCcw, Trash2, Star } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { photoTargetSize } from "@/lib/photo-compression";
import { useStore } from "./provider";
import { Card } from "./ui";

export async function compressPhoto(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Envie JPG, PNG ou WebP.");
  if (file.size > 20000000) throw new Error("Imagem maior que 20 MB.");
  const bitmap = await createImageBitmap(file);
  const size = photoTargetSize(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("Não foi possível comprimir a imagem.")),
    "image/webp", 0.72,
  ));
}

const views = { front: "Frente", back: "Costas", detail: "Detalhe", other: "Outra" } as const;
export function ProductPhotos({ productId }: { productId: string }) {
  const { data, profile, run, demo, notify, busy } = useStore();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [color, setColor] = useState("");
  const [view, setView] = useState<keyof typeof views>("front");
  const images = data.product_images.filter((image) => image.product_id === productId);
  const active = images.filter((image) => !image.hidden_at);
  const removed = images.filter((image) => !!image.hidden_at);
  const colors = [...new Set(data.product_variants.filter((variant) => variant.product_id === productId).map((variant) => variant.color))];
  useEffect(() => {
    if (!supabase || demo) return;
    let mounted = true;
    Promise.all(data.product_images.filter((image) => image.product_id === productId).map(async (image) => {
      const { data: signed, error } = await supabase!.storage.from("products").createSignedUrl(image.path, 3600);
      return [image.id, error ? "" : signed.signedUrl] as const;
    })).then((entries) => { if (mounted) setUrls(Object.fromEntries(entries)); });
    return () => { mounted = false; };
  }, [data.product_images, productId, demo]);
  async function upload(files: FileList | null) {
    if (!files?.length || !profile || !supabase) return;
    setUploading(true);
    let failures = 0;
    let firstPhoto = active.length === 0;
    for (const file of Array.from(files)) {
      const path = `${profile.organization_id}/${productId}/${crypto.randomUUID()}.webp`;
      try {
        const blob = await compressPhoto(file);
        const { error } = await supabase.storage.from("products").upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
        if (error) throw error;
        if (!await run("image_save", { product_id:productId, path, color, view, is_primary:firstPhoto })) {
          await supabase.storage.from("products").remove([path]);
          failures++;
        } else firstPhoto = false;
      } catch { failures++; }
    }
    if (failures) notify(`${failures} foto${failures === 1 ? " não foi enviada" : "s não foram enviadas"}. Tente novamente.`);
    setUploading(false);
  }
  return <Card className="section-gap">
    <div className="card-head"><div><h2>Fotos do produto</h2><p className="fine">Identifique cor e lado. O cliente verá as fotos correspondentes à cor escolhida.</p></div></div>
    <div className="photo-manager-grid">
      {active.map((image) => <div className="photo-manager-item" key={image.id}>
        {urls[image.id] && <Image width={600} height={600} src={urls[image.id]} alt={`${image.color || "Produto"} · ${views[image.view ?? "other"]}`} />}
        <div className="photo-manager-fields">
          <select aria-label="Cor da foto" defaultValue={image.color ?? ""} onChange={(e) => void run("image_save", { id:image.id, product_id:productId, color:e.target.value, view:image.view ?? "other" })}>
            <option value="">Todas as cores</option>
            {colors.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select aria-label="Lado da foto" defaultValue={image.view ?? "other"} onChange={(e) => void run("image_save", { id:image.id, product_id:productId, color:image.color ?? "", view:e.target.value })}>
            {Object.entries(views).map(([value,label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </div>
        <div className="inline-actions">
          <button type="button" className="ghost" disabled={busy || image.is_primary} onClick={() => void run("image_save", { id:image.id, product_id:productId, color:image.color ?? "", view:image.view ?? "other", is_primary:true })}><Star size={16} /> {image.is_primary ? "Capa" : "Usar como capa"}</button>
          <button type="button" className="ghost" disabled={busy} onClick={() => void run("image_hidden", { image_id:image.id, hide:true })}><Trash2 size={16} /> Excluir</button>
        </div>
      </div>)}
    </div>
    {!active.length && <p className="fine">Ainda não há fotos. Você pode adicionar frente, costas e detalhes de cada cor.</p>}
    <div className="photo-upload section-gap">
      <label className="field"><span>Cor da nova foto</span><select value={color} onChange={(e) => setColor(e.target.value)}><option value="">Todas as cores</option>{colors.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="field"><span>Lado da peça</span><select value={view} onChange={(e) => setView(e.target.value as keyof typeof views)}>{Object.entries(views).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label className="field"><span>{uploading ? "Enviando fotos…" : "Adicionar fotos (várias de uma vez)"}</span><input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={uploading || demo} onChange={(e) => void upload(e.target.files)} /></label>
    </div>
    {!!removed.length && <details className="section-gap"><summary>Fotos excluídas ({removed.length}) · restaurar</summary><div className="photo-manager-grid section-gap">{removed.map((image) => <div className="photo-manager-item" key={image.id}>
      {urls[image.id] && <Image width={600} height={600} src={urls[image.id]} alt="Foto excluída" />}
      <small>{image.color || "Todas as cores"} · {views[image.view ?? "other"]}</small>
      <button type="button" className="ghost" disabled={busy} onClick={() => void run("image_hidden", { image_id:image.id, hide:false })}><RotateCcw size={16} /> Restaurar foto</button>
    </div>)}</div></details>}
  </Card>;
}
