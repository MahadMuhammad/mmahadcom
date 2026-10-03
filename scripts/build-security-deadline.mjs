import assert from "node:assert/strict";
import { expires } from "./audit-dependencies.mjs";

export function assertBuildDeadline(now = Date.now()) {
  assert.ok(Number.isFinite(now) && now < expires, "Temporary dependency exception expired; do not publish these assets.");
}

export function buildSecurityDeadline() {
  return {
    name: "temporary-build-security-deadline",
    hooks: {
      "astro:build:done": () => assertBuildDeadline(),
    },
  };
}
