---
name: AI doctrine injection paths
description: Why "make all AI follow X" tasks have two coverage paths, and the rule for the surfaces that bypass the central persona.
---

# Platform-wide AI doctrine has TWO coverage paths

Any task framed as "make ALL AI output follow X" must cover both, or coverage is silently partial.

1. **Central path** — one shared persona constant is prepended to every call routed
   through the shared agent runner. Editing it changes the bulk of generative output
   in one place.

2. **Bypass path** — some product tools call the model SDK directly and never see the
   central persona; they carry their own strong specialized identity in per-call prompts.

**Why it matters:** forcing the full central identity on top of a tool that already says
"you are <specialized tool>" produces conflicting identity statements — a coherence
regression.

**How to apply:** for bypass tools, prepend a *compact complementary header* that scopes
itself ("apply this doctrine within your specialized role below") instead of a second full
identity. Never modify their JSON output schemas / `response_format` — those are parsed
downstream; only add voice/stance ahead of the existing system text. The central persona's
own trailing output contract must likewise stay intact.
