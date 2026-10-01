import { test } from "node:test";
import assert from "node:assert/strict";
import { dataUrlToFile } from "../lib/format.ts";

test("receipt data URL becomes a PNG file suitable for sharing", () => {
  const file = dataUrlToFile(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAF" +
      "c0qAAAAAXNSR0IArz4AAAAAElFTkSuQmCC",
    "comprovante.png",
  );

  assert.equal(file.name, "comprovante.png");
  assert.equal(file.type, "image/png");
  assert.ok(file.size > 0);
});
