import type { ProductImage } from "./types";

const sameColor = (left: string | undefined, right: string) =>
  (left ?? "").trim().toLocaleLowerCase("pt-BR") === right.trim().toLocaleLowerCase("pt-BR");

export function coverPhoto(images: ProductImage[]) {
  return images.find((image) => image.is_primary)
    ?? images.find((image) => image.view === "front")
    ?? images[0];
}

export function variantPhoto(images: ProductImage[], color: string) {
  const matching = images.filter((image) => image.color?.trim() && sameColor(image.color, color));
  return matching.find((image) => image.view === "front")
    ?? matching.find((image) => image.is_primary)
    ?? matching[0]
    ?? coverPhoto(images);
}
