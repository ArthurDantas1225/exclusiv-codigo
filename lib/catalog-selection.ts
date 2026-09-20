export type CatalogImage = { id: string; url: string; color: string; view: string; is_primary: boolean };

export function imagesForColor(images: CatalogImage[], color: string, _colorCount: number) {
  const exact = images.filter((image) => image.color.trim().toLocaleLowerCase("pt-BR") === color.trim().toLocaleLowerCase("pt-BR"));
  if (exact.length) return exact;
  return images.filter((image) => !image.color.trim());
}

export function galleryForColor(images: CatalogImage[], color: string) {
  const preferred = imagesForColor(images,color,0);
  return [...preferred,...images.filter((image) => !preferred.some((item) => item.id === image.id))];
}

export function sortedColors(variants: { color: string; stock: number }[]) {
  return [...new Set(variants.filter((variant) => variant.stock > 0).map((variant) => variant.color))];
}
