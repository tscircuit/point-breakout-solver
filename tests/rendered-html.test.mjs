import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Boundary Router product", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(
    html,
    /<title>Boundary \/ Router — Octilinear Escape Lab<\/title>/i,
  );
  assert.match(html, /Find every point a clean way out/);
  assert.match(html, /RUN 15-TRIAL BENCHMARK/);
  assert.match(html, /0° · 45° · 90°/);
  assert.match(html, /ROUTE[\s\S]{0,80}?0\.10/);
  assert.match(html, /MARGIN[\s\S]{0,80}?0\.10/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("keeps routing constraints explicit and the benchmark runnable", async () => {
  const [router, page, layout, packageJson] = await Promise.all([
    readFile(new URL("../lib/router.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(router, /export const FIELD_SIZE = 10/);
  assert.match(router, /export const ROUTE_WIDTH = 0\.1/);
  assert.match(router, /export const ROUTE_MARGIN = 0\.1/);
  assert.match(router, /const DIRECTIONS = \[/);
  assert.match(router, /segmentsIntersect/);
  assert.match(router, /segmentDistance/);
  assert.match(page, /const BENCHMARK_CASES = \[10, 25, 50, 75, 100\]/);
  assert.match(page, /const BENCHMARK_TRIALS = 3/);
  assert.match(page, /handleCanvasClick/);
  assert.match(packageJson, /"benchmark": "node --experimental-strip-types/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview|_sites-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
