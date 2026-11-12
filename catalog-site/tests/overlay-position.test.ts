import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("catalog stacking rule leaves fixed overlays and mobile cart in normal position", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(
    css,
    /\.catalog-page > \*:not\(\.catalog-detail-overlay\):not\(\.catalog-lightbox-overlay\):not\(\.catalog-mobile-cart\)\s*\{\s*position:\s*relative;\s*z-index:\s*1;/,
  );
});
