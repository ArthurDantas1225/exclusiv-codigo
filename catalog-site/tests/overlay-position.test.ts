import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("catalog uses the normal background and preserves fixed product overlays", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /\.catalog-page\s*::before/);
  assert.doesNotMatch(css, /\.catalog-page\s*>\s*\*\s*\{/);
  assert.match(css, /\.catalog-detail-overlay\s*\{[^}]*position:\s*fixed/);
  assert.match(css, /\.catalog-lightbox-overlay\s*\{[^}]*position:\s*fixed/);
});
