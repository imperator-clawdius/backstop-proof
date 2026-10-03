/* eslint-env node */
// Plain GraphQL Config data keeps editor discovery independent of the runner.
const fs = require("node:fs");
const path = require("node:path");

const apiVersion = "2026-07";
const outputDir = "./app/types";
const schemaCache = `${outputDir}/admin-${apiVersion}.schema.json`;
const schemaUrl = `https://shopify.dev/admin-graphql-direct-proxy/${apiVersion}`;
const projects = {
  default: {
    schema: fs.existsSync(path.join(__dirname, schemaCache)) ? schemaCache : schemaUrl,
    documents: ["./app/**/*.{js,ts,jsx,tsx}", "./app/.server/**/*.{js,ts,jsx,tsx}"],
  },
};

const extensionsDir = path.join(__dirname, "extensions");
if (fs.existsSync(extensionsDir)) {
  for (const entry of fs.readdirSync(extensionsDir).sort()) {
    const schema = `./extensions/${entry}/schema.graphql`;
    if (fs.existsSync(path.join(__dirname, schema))) {
      projects[entry] = { schema, documents: [`./extensions/${entry}/**/*.graphql`] };
    }
  }
}

module.exports = {
  projects,
  extensions: { backstopCodegen: { apiVersion, outputDir, schemaCache, schemaUrl } },
};
