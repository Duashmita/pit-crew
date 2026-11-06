---
name: ship-check
description: Pre-submission check for the hackathon repo. Run before 12:30. Verifies the README, secrets, data rules, smoke test, git state and repo visibility.
---
Check and fix, in this order, then print a pass/fail checklist.

1. README.md has, in this order: the problem in one paragraph with the persona; the demo video link; a mermaid architecture diagram; how to run (3 commands max); how we used Claude (extraction schema with quotes, citations, the engine boundary, Claude Code lanes and agents); safety and limits (synthetic data only, not medical, legal or financial advice, human review, AI disclosure); the eval table if eval/results.md exists; team.
2. No secrets: search the tree and the git history for `sk-ant`, `ANTHROPIC_API_KEY=` followed by a value, and committed .env files. `.env` must be gitignored.
3. No real personal data in data/. Every persona file says synthetic at the top.
4. `make smoke` passes on a clean checkout of main.
5. `git status` is clean, main is pushed, and the repo is public (`gh repo view --json visibility`).
6. Print the two submission lines: repo url, video url.
