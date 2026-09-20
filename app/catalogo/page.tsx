import type { Metadata } from "next";
import { PublicCatalog, type CatalogData } from "@/components/public-catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Catálogo EXCLUSIV",
  description: "Escolha peças, tamanhos e cores e envie seu pedido para a EXCLUSIV pelo WhatsApp.",
};

export default async function CatalogPage() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let catalog: CatalogData | null = null;
  if (base && key) {
    try {
      const response = await fetch(`${base}/functions/v1/catalog`, {
        headers: { apikey: key },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (response.ok) catalog = await response.json() as CatalogData;
    } catch { /* A visible retry link is shown below. */ }
  }
  if (!catalog) return <main className="catalog-page catalog-error">
    <h1>Catálogo temporariamente indisponível</h1>
    <p>Tente novamente em alguns instantes.</p>
    <a className="button primary" href="/catalogo">Tentar novamente</a>
  </main>;
  return <PublicCatalog catalog={catalog} />;
}
