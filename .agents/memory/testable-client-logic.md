---
name: Testable client logic
description: How to make client-side logic unit-testable in this repo's test runner
---

The `test` workflow runs `npx tsx --test $(find client/src -name '*.test.ts')`.

- Runs under Node via `tsx` — there is **no DOM/JSDOM**. Importing a `.tsx` page (which pulls in React, `@/components/Layout`, lucide, etc.) will fail or pull heavy deps.
- **How to apply:** put pure/computational logic (models, math, formatters, seeded RNG/Monte Carlo) in a plain `.ts` module under `client/src/lib/`, import it from both the page and a sibling `*.test.ts`. Use `node:test` + `node:assert/strict`.
- **Why:** keeps deterministic business math (e.g. revenue/Monte Carlo for Enterprise Command Center) regression-guarded against formula drift without needing a browser test env.
