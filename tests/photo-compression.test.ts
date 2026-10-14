import { test } from "node:test";
import assert from "node:assert/strict";
import { photoTargetSize } from "../lib/photo-compression.ts";

test("catalog photos are reduced to a maximum side of 1000 pixels", () => {
  assert.deepEqual(photoTargetSize(4000, 3000), { width: 1000, height: 750 });
  assert.deepEqual(photoTargetSize(800, 1200), { width: 667, height: 1000 });
  assert.deepEqual(photoTargetSize(640, 480), { width: 640, height: 480 });
});
