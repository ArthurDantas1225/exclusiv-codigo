import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("app router and More expose the Stylist IA workspace", () => {
  const router = read("app/app/[[...path]]/page.tsx");
  const settings = read("components/settings.tsx");
  assert.match(router, /import \{ Stylist \}/);
  assert.match(router, /case "stylist"[\s\S]*<Stylist/);
  assert.match(settings, /Stylist IA/);
  assert.match(settings, /Kits e roteiros para Stories/);
});

test("stylist screen contains every selection and action", () => {
  const source = read("components/stylist.tsx");
  for (const text of [
    "Camisa + Short",
    "Camisa + Calça",
    "Vender hoje",
    "Divulgar novidades",
    "Girar estoque",
    "Gerar combinações",
    "Copiar roteiro",
    "Trocar uma peça",
    "Gerar outro texto",
  ]) assert.match(source, new RegExp(text.replace("+", "\\+")));
  assert.match(source, /aria-live="polite"/);
});

test("request is authenticated and results are revalidated against current variants", () => {
  const source = read("components/stylist.tsx");
  assert.match(source, /Authorization: `Bearer \$\{token\}`/);
  assert.match(source, /JSON\.stringify\(\{ pairing, goal, candidates:/);
  assert.match(source, /validateStylistResult\([\s\S]*data\.product_variants/);
  assert.doesNotMatch(source, /JSON\.stringify\([\s\S]{0,200}(product_images|cost)/);
});

test("screen resolves existing photos and renders exactly three Story frames", () => {
  const source = read("components/stylist.tsx");
  assert.match(source, /createSignedUrls/);
  assert.match(source, /candidate\.top\.imageId/);
  assert.match(source, /candidate\.bottom\.imageId/);
  assert.match(source, /kit\.story\.map/);
  assert.match(source, /story\.length !== 3/);
});
