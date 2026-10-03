/* eslint-env node, es2020 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { setImmediate as yieldToIO } from "node:timers/promises";
import { codegen } from "@graphql-codegen/core";
import * as typescript from "@graphql-codegen/typescript";
import * as introspectionPlugin from "@graphql-codegen/introspection";
import { gqlPluckFromCodeString } from "@graphql-tools/graphql-tag-pluck";
import { preset, pluckConfig } from "@shopify/graphql-codegen";
import { buildClientSchema, getIntrospectionQuery, lexicographicSortSchema, parse, printSchema } from "graphql";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const HELP = "Usage: npm run graphql-codegen -- [--project default | --help]\nGenerates July 2026 Admin types. Extension projects remain available to GraphQL editors.\n";

export function parseArguments(args) {
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) return "help";
  if (args.length === 0 || (args.length === 2 && args[0] === "--project" && args[1] === "default")) return "default";
  throw new Error("Unsupported GraphQL codegen arguments. Use --help.");
}

async function regularPath(file, directory = false, allowAbsent = false) {
  let stat;
  try { stat = await fs.lstat(file); }
  catch (error) { if (allowAbsent && error.code === "ENOENT") return false; throw error; }
  if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile())) {
    throw new Error("GraphQL codegen requires regular files/directories; source links are unsupported.");
  }
  return true;
}

export async function enumerateApp(root) {
  const files = [];
  const app = path.join(root, "app");
  await regularPath(app, true);
  async function walk(directory, top) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error("GraphQL codegen source links are unsupported.");
      if (entry.name.startsWith(".") && !(top && entry.name === ".server" && entry.isDirectory())) continue;
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(target, false);
      else if (entry.isFile() && /\.(js|ts|jsx|tsx)$/.test(entry.name)
        && !["app/types/admin.types.d.ts", "app/types/admin.generated.d.ts"].includes(path.relative(root, target).replaceAll("\\", "/"))) files.push(target);
    }
  }
  await walk(app, true);
  return files.sort();
}

// Only the fixed public schema URL from the checked-in config is used by CLI.
// Injection is for local fixture tests; no command-line endpoint selector exists.
export async function fetchSchema(url, { fetchImpl = globalThis.fetch, timeoutMs = 25_000, maxBytes = 8 * 1024 * 1024 } = {}) {
  const controller = new AbortController();
  const deadline = performance.now() + timeoutMs;
  const checkDeadline = () => {
    if (performance.now() >= deadline) {
      controller.abort();
      throw new Error("Public GraphQL schema request timed out.");
    }
  };
  let timer;
  let reader;
  const expired = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("Public GraphQL schema request timed out."));
    }, timeoutMs);
  });
  const bounded = (operation) => Promise.race([operation, expired]);
  try {
    checkDeadline();
    const response = await bounded(fetchImpl(url, {
      method: "POST", redirect: "error", signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: getIntrospectionQuery() }),
    }));
    checkDeadline();
    if (response.body) reader = response.body.getReader();
    if (!response.ok || !reader) throw new Error("Public GraphQL schema request failed.");
    const length = response.headers.get("content-length");
    if (length !== null && Number(length) > maxBytes) throw new Error("Public GraphQL schema exceeds size limit.");
    // Race the whole pump once, not each read: attaching every read to the
    // pending deadline would retain one promise reaction per chunk until expiry.
    const payload = await bounded((async () => {
      const body = Buffer.allocUnsafe(maxBytes);
      let bytes = 0;
      let reads = 0;
      for (;;) {
        checkDeadline();
        const next = await reader.read();
        checkDeadline();
        if (next.done) break;
        if (bytes + next.value.byteLength > maxBytes) throw new Error("Public GraphQL schema exceeds size limit.");
        body.set(next.value, bytes);
        bytes += next.value.byteLength;
        // Empty/tiny immediately fulfilled reads must not starve timers or
        // retain per-chunk objects. Total storage is the single capped buffer.
        if (++reads % 64 === 0) await yieldToIO();
      }
      checkDeadline();
      return JSON.parse(body.subarray(0, bytes).toString("utf8"));
    })());
    if (payload.errors || !payload.data?.__schema) throw new Error("Public GraphQL schema response is invalid.");
    return payload.data;
  } finally {
    clearTimeout(timer);
    controller.abort();
    if (reader) {
      // Abort bounds native fetch/body work. Do not let a failing or stalled
      // cancellation acknowledgment replace the original result/deadline.
      try { reader.cancel().catch(() => {}); } catch { /* Already closed. */ }
      try { reader.releaseLock(); } catch { /* Pending read was aborted. */ }
    }
  }
}

// root/options are an in-process fixture seam, not user-facing CLI arguments.
export async function generate(root = projectRoot, options = {}) {
  const configPath = path.join(root, ".graphqlrc.cjs");
  await regularPath(configPath);
  const config = require(configPath);
  const { schemaCache, schemaUrl, outputDir } = config.extensions.backstopCodegen;
  const files = await enumerateApp(root);
  const output = path.join(root, outputDir);
  await regularPath(output, true, true);
  const cached = path.join(root, schemaCache);
  const hasCache = await regularPath(cached, false, true);
  const input = hasCache
    ? JSON.parse(await fs.readFile(cached, "utf8"))
    : await fetchSchema(schemaUrl, options);
  const schemaAst = lexicographicSortSchema(buildClientSchema(input));
  const schema = parse(printSchema(schemaAst));
  const documents = [];
  for (const file of files) {
    const contents = await fs.readFile(file, "utf8");
    for (const source of await gqlPluckFromCodeString(file, contents, { skipIndent: true, ...pluckConfig })) {
      documents.push({ location: file.replaceAll("\\", "/"), rawSDL: source.body, document: parse(source) });
    }
  }
  if (documents.length === 0) throw new Error("No GraphQL documents found in the configured application paths.");
  const types = await codegen({ filename: "admin.types.d.ts", schema, schemaAst, documents: [],
    plugins: [{ typescript: {} }], pluginMap: { typescript },
    config: { defaultScalarType: "string", scalars: { JSON: "unknown" } } });
  const sections = await preset.buildGeneratesSection({
    baseOutputDir: "admin.generated.d.ts", schema, schemaAst, documents,
    plugins: [], pluginMap: {}, config: {},
    presetConfig: {
      importTypes: { namespace: "AdminTypes", from: "./admin.types.js" },
      interfaceExtension: ({ queryType, mutationType }) =>
        `declare module '@shopify/admin-api-client' {\n  type InputMaybe<T> = AdminTypes.InputMaybe<T>;\n  interface AdminQueries extends ${queryType} {}\n  interface AdminMutations extends ${mutationType} {}\n}`,
    },
  });
  const operations = await codegen(sections[0]);
  const schemaJSON = hasCache ? null : await codegen({ filename: path.basename(cached), schema, schemaAst, documents: [],
    plugins: [{ introspection: {} }], pluginMap: { introspection: introspectionPlugin }, config: { minify: true } });
  // No writes before all generation/document validation succeeds. Files are
  // independent outputs; this is not a cross-file crash-atomic transaction.
  const outputs = [["admin.types.d.ts", types], ["admin.generated.d.ts", operations]];
  for (const [name] of outputs) await regularPath(path.join(output, name), false, true);
  await fs.mkdir(output, { recursive: true });
  for (const [name, text] of outputs) await fs.writeFile(path.join(output, name), text);
  if (schemaJSON !== null) await fs.writeFile(cached, schemaJSON);
  return { files: files.length, templates: documents.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (parseArguments(process.argv.slice(2)) === "help") process.stdout.write(HELP);
    else {
      const result = await generate();
      process.stdout.write(`Generated Admin types from ${result.templates} GraphQL templates.\n`);
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
