import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const catalogComponents = [
  "components/public-catalog.tsx",
  "catalog-site/components/public-catalog.tsx",
];

for (const path of catalogComponents) {
  test(`${path} renders every filtered product without style tabs`, () => {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

    assert.doesNotMatch(source, />\s*(?:Streetwear|Casual|Surfwear)\s*</);
    assert.doesNotMatch(source, /Explore (?:Streetwear|Casual|Surfwear)|Estilos do catálogo/);
    assert.match(source, /visibleProducts\.map\(\(product\) =>/);
    assert.doesNotMatch(source, /data-style-section|data-active-style|catalog-style-nav/);
  });
}
