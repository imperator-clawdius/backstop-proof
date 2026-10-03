/* eslint-env node, es2020 */
import assert from "node:assert/strict";
import { test, after } from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import net from "node:net";
import tls from "node:tls";
import { buildSchema, introspectionFromSchema } from "graphql";
import { enumerateApp, fetchSchema, generate, parseArguments } from "../../scripts/graphql-codegen.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const original = { fetch: globalThis.fetch, connect: net.Socket.prototype.connect, tls: tls.connect };
let networkCalls = 0;
const deny = () => { networkCalls++; throw new Error("Unexpected network in GraphQL fixture."); };
globalThis.fetch = deny;
net.Socket.prototype.connect = deny;
tls.connect = deny;
after(() => {
  globalThis.fetch = original.fetch;
  net.Socket.prototype.connect = original.connect;
  tls.connect = original.tls;
  assert.equal(networkCalls, 0);
});

const sdl = await fs.readFile(path.join(repo, "tests/fixtures/graphql-codegen/schema.graphql"), "utf8");
const schema = introspectionFromSchema(buildSchema(sdl));
const sha = (text) => createHash("sha256").update(text).digest("hex");
const tempParent = await fs.realpath(os.tmpdir());

async function removeOwnedFixture(root, prefix) {
  const resolved = path.resolve(root);
  assert.equal(path.dirname(resolved), tempParent, "cleanup must stay in the intended temporary parent");
  assert.ok(path.basename(resolved).startsWith(prefix), "cleanup must have the owned fixture prefix");
  assert.equal(await fs.realpath(resolved), resolved, "cleanup root must not be a link");
  await fs.rm(resolved, { recursive: true, force: true });
}

async function fixture(t, { cached = true } = {}) {
  const root = await fs.mkdtemp(path.join(tempParent, "backstop-codegen-"));
  t.after(() => removeOwnedFixture(root, "backstop-codegen-"));
  await fs.mkdir(path.join(root, "app/services"), { recursive: true });
  await fs.mkdir(path.join(root, "app/types"));
  await fs.copyFile(path.join(repo, ".graphqlrc.cjs"), path.join(root, ".graphqlrc.cjs"));
  await fs.copyFile(path.join(repo, "app/services/shopify-graphql.server.ts"), path.join(root, "app/services/shopify-graphql.server.ts"));
  if (cached) await fs.writeFile(path.join(root, "app/types/admin-2026-07.schema.json"), JSON.stringify(schema));
  return root;
}

async function outputs(root) {
  return Promise.all(["admin.types.d.ts", "admin.generated.d.ts"].map(name => fs.readFile(path.join(root, "app/types", name), "utf8")));
}

function schemaResponse(value = { data: schema }) {
  return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });
}

test("six current operations and interpolated fragments match the original CLI bytes", async (t) => {
  const root = await fixture(t);
  assert.deepEqual(await generate(root), { files: 1, templates: 8 });
  const [types, operations] = await outputs(root);
  // Golden hashes from the original installed CLI against this fictional schema.
  assert.equal(sha(types), "93eb5a570d2744e5b651f3c8f2b61d60bcdde74f8adc4e98751ba805a15e76e7");
  assert.equal(sha(operations), "27c80017f12fa581a2e2d7d4ddf133a8ae025e6d872a6f2f051e1709b25783d8");
  assert.match(types, /JSON: \{ input: unknown; output: unknown; \}/);
  assert.match(operations, /import type \* as AdminTypes from '\.\/admin.types.js'/);
  assert.match(operations, /interface AdminQueries extends/);
  assert.match(operations, /interface AdminMutations extends/);
});

test("dot-server CRLF source is included and editor extension projects remain discoverable", async (t) => {
  const root = await fixture(t);
  await fs.mkdir(path.join(root, "app/.server"));
  await fs.writeFile(path.join(root, "app/.server/extra.ts"), 'export const extra = `#graphql\r\n query FixtureDotServer { order(id: "fixture") { id } }\r\n`;\r\n');
  await fs.mkdir(path.join(root, "extensions/fictional"), { recursive: true });
  await fs.writeFile(path.join(root, "extensions/fictional/schema.graphql"), "type Query { fictional: String }");
  const config = require(path.join(root, ".graphqlrc.cjs"));
  assert.equal(config.projects.default.schema, "./app/types/admin-2026-07.schema.json");
  assert.deepEqual(config.projects.default.documents, ["./app/**/*.{js,ts,jsx,tsx}", "./app/.server/**/*.{js,ts,jsx,tsx}"]);
  assert.deepEqual(config.projects.fictional, { schema: "./extensions/fictional/schema.graphql", documents: ["./extensions/fictional/**/*.graphql"] });
  assert.equal(config.projects.fictional.extensions, undefined);
  assert.equal((await generate(root)).templates, 9);
  assert.match((await outputs(root))[1], /FixtureDotServerQuery/);
});

for (const [name, query] of [
  ["invalid field", "query FixtureInvalid { nonexistentFixtureField }"],
  ["conflicting operation", 'query BackstopOrders { order(id: "fixture") { id } }'],
]) {
  test(`${name} refuses before altering existing outputs`, async (t) => {
    const root = await fixture(t);
    await generate(root);
    const before = await outputs(root);
    await fs.writeFile(path.join(root, "app/invalid.ts"), `export const q = \`#graphql\n${query}\`;`);
    await assert.rejects(generate(root));
    assert.deepEqual(await outputs(root), before);
  });
}

test("cache absence uses only fixed July26 endpoint, persists schema, then performs no fetch", async (t) => {
  const root = await fixture(t, { cached: false });
  const config = require(path.join(root, ".graphqlrc.cjs"));
  assert.equal(config.projects.default.schema, "https://shopify.dev/admin-graphql-direct-proxy/2026-07");
  let calls = 0;
  await generate(root, { fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, config.projects.default.schema);
    assert.equal(options.method, "POST");
    assert.equal(options.redirect, "error");
    assert.deepEqual(options.headers, { "Content-Type": "application/json" });
    assert.match(JSON.parse(options.body).query, /query IntrospectionQuery/);
    return schemaResponse();
  } });
  assert.equal(calls, 1);
  const first = await outputs(root);
  assert.ok(JSON.parse(await fs.readFile(path.join(root, "app/types/admin-2026-07.schema.json"), "utf8")).__schema);
  await generate(root, { fetchImpl: () => { throw new Error("Cache must win."); } });
  assert.deepEqual(await outputs(root), first);
});

test("invalid existing cache refuses without network or replacing generated outputs", async (t) => {
  const root = await fixture(t);
  await generate(root);
  const before = await outputs(root);
  await fs.writeFile(path.join(root, "app/types/admin-2026-07.schema.json"), "malformed");
  await assert.rejects(generate(root));
  assert.deepEqual(await outputs(root), before);
});

test("no pluckable documents refuses and leaves previous generated outputs intact", async (t) => {
  const root = await fixture(t);
  await generate(root);
  const before = await outputs(root);
  await fs.writeFile(path.join(root, "app/services/shopify-graphql.server.ts"), "export const noDocuments = true;\n");
  await assert.rejects(generate(root), /No GraphQL documents found/);
  assert.deepEqual(await outputs(root), before);
});

test("schema errors and byte caps refuse before writing cache or outputs", async (t) => {
  for (const response of [
    () => new Response("redirect", { status: 302 }),
    () => new Response("failure", { status: 503 }),
    () => new Response("not-json"),
    () => schemaResponse({ errors: [{ message: "fictional" }] }),
    () => new Response("x", { headers: { "content-length": "9999999" } }),
    () => new Response("x".repeat(1025)),
  ]) {
    const root = await fixture(t, { cached: false });
    await assert.rejects(generate(root, { maxBytes: 1024, fetchImpl: async () => response() }));
    assert.deepEqual(await fs.readdir(path.join(root, "app/types")), []);
  }
});

test("one deadline spans headers and body; body cancellation is attempted", async () => {
  let canceled = 0;
  let signal;
  const started = performance.now();
  await assert.rejects(fetchSchema("https://fictional.invalid/schema", {
    timeoutMs: 60,
    fetchImpl: async (_url, options) => {
      signal = options.signal;
      await new Promise(resolve => setTimeout(resolve, 35));
      return new Response(new ReadableStream({ cancel() { canceled++; } }));
    },
  }), /timed out/);
  assert.ok(performance.now() - started < 1000, "stalled body must not hang");
  assert.equal(signal.aborted, true);
  assert.equal(canceled, 1);
});

test("stalled headers and overlimit stream use bounded abort/cancel paths", async () => {
  let signal;
  await assert.rejects(fetchSchema("https://fictional.invalid/schema", {
    timeoutMs: 25,
    fetchImpl: (_url, options) => { signal = options.signal; return new Promise(() => {}); },
  }), /timed out/);
  assert.equal(signal.aborted, true);
  let canceled = 0;
  await assert.rejects(fetchSchema("https://fictional.invalid/schema", {
    maxBytes: 2,
    fetchImpl: async () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(3)); },
      cancel() { canceled++; },
    })),
  }), /size limit/);
  assert.equal(canceled, 1);
});

test("immediate empty chunks yield to I/O and cannot escape the absolute deadline", async () => {
  let eventLoopTurn = false;
  let canceled = 0;
  const timer = setTimeout(() => { eventLoopTurn = true; }, 0);
  const started = performance.now();
  try {
    await assert.rejects(fetchSchema("https://fictional.invalid/schema", {
      timeoutMs: 40,
      fetchImpl: async () => new Response(new ReadableStream({
        pull(controller) { controller.enqueue(new Uint8Array(0)); },
        cancel() { canceled++; },
      })),
    }), /timed out/);
  } finally { clearTimeout(timer); }
  assert.equal(eventLoopTurn, true);
  assert.equal(canceled, 1);
  assert.ok(performance.now() - started < 1000);
});

test("late EOF is rejected even before timer dispatch; stalled cancel cannot hide size failure", async () => {
  let released = 0;
  const response = (read) => ({ ok: true, headers: new Headers(), body: { getReader: () => ({
    read, cancel: () => new Promise(() => {}), releaseLock: () => { released++; },
  }) } });
  await assert.rejects(fetchSchema("https://fictional.invalid/schema", {
    timeoutMs: 10,
    fetchImpl: async () => response(async () => {
      const until = performance.now() + 20;
      while (performance.now() < until) { /* Delay timer dispatch in this synthetic read. */ }
      return { done: true };
    }),
  }), /timed out/);
  await assert.rejects(fetchSchema("https://fictional.invalid/schema", {
    maxBytes: 2,
    fetchImpl: async () => response(async () => ({ done: false, value: new Uint8Array(3) })),
  }), /size limit/);
  assert.equal(released, 2);
});

test("source directory links are explicitly rejected", async (t) => {
  const root = await fixture(t);
  const destination = await fs.mkdtemp(path.join(tempParent, "backstop-codegen-link-"));
  t.after(() => removeOwnedFixture(destination, "backstop-codegen-link-"));
  await fs.symlink(destination, path.join(root, "app/linked"), process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(enumerateApp(root), /links are unsupported/);
  assert.deepEqual(await fs.readdir(path.join(root, "app/types")), ["admin-2026-07.schema.json"]);
});

test("CLI help/default compatibility and explicit unknown-argument refusal", () => {
  assert.equal(parseArguments([]), "default");
  assert.equal(parseArguments(["--project", "default"]), "default");
  assert.equal(parseArguments(["--help"]), "help");
  for (const args of [["--watch"], ["--project", "fictional"], ["--config", "elsewhere"], ["--help", "extra"]]) {
    assert.throws(() => parseArguments(args), /Unsupported/);
  }
  for (const [args, status] of [[["--help"], 0], [["--watch"], 1]]) {
    const result = spawnSync(process.execPath, [path.join(repo, "scripts/graphql-codegen.mjs"), ...args], { encoding: "utf8", timeout: 10_000 });
    assert.equal(result.status, status, result.stderr);
    assert.match(result.stdout + result.stderr, /Usage:|Unsupported/);
  }
});
