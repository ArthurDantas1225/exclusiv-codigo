import { test } from "node:test";
import assert from "node:assert/strict";
import { coverPhoto, variantPhoto } from "../lib/pos-photo.ts";
import type { ProductImage } from "../lib/types.ts";

const photos: ProductImage[] = [
  { id: "cover", product_id: "shirt", path: "cover.webp", is_primary: true, color: "Preta", view: "back" },
  { id: "black-front", product_id: "shirt", path: "black.webp", is_primary: false, color: "Preta", view: "front" },
  { id: "white-back", product_id: "shirt", path: "white-back.webp", is_primary: false, color: "Branca", view: "back" },
  { id: "white-front", product_id: "shirt", path: "white.webp", is_primary: false, color: "Branca", view: "front" },
];

test("POS keeps the cover in the product list and shows the selected color in the bag", () => {
  assert.equal(coverPhoto(photos)?.id, "cover");
  assert.equal(variantPhoto(photos, " branca ")?.id, "white-front");
  assert.equal(variantPhoto(photos, "Preta")?.id, "black-front");
  assert.equal(variantPhoto(photos, "Azul")?.id, "cover");
});
