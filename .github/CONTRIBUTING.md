# Contributing to Backstop Proof

Read [AGENTS.md](../AGENTS.md) for the product scope, tenant boundaries, evidence requirements, and validation commands.

Use this repository's issues and pull requests for Backstop Proof changes. Describe the user-visible problem, the resulting behavior, and the checks you ran. Keep customer records, credentials, local databases, and uploaded proof files out of commits and review artifacts.

Before opening a pull request, run `npm run setup`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm audit`. Shopify development-store and production checks must be identified separately from local fixtures.

This project was scaffolded from Shopify's React Router template. The template's Shopify employee ownership, Shopify CLA check, Slack/Gardener automation, and JavaScript-template branch generator do not operate this application. The application CI checks the committed npm lockfile and tests Backstop Proof itself.
