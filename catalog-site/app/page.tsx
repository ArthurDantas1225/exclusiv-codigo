import { PublicCatalog } from "@/components/public-catalog";
import { loadCatalog } from "@/lib/catalog-client";
import Link from "next/link";
export const revalidate = 300;
export default async function CatalogPage() {
  let catalog;
  try { catalog = await loadCatalog(); }
  catch { return <main className="catalog-page catalog-error"><h1>Catálogo temporariamente indisponível</h1><p>Tente novamente em alguns instantes.</p><Link className="button primary" href="/">Tentar novamente</Link></main>; }
  return <PublicCatalog catalog={catalog} />;
}
