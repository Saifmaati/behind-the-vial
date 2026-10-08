# Decisions log

Judgment calls made while building without check-ins. Newest last.

1. **Name kept as "Behind the Vial"**; repo `Saifmaati/behind-the-vial`, GitHub Pages from `main` root (no build step, `.nojekyll`).
2. **Stack: vanilla ES modules + three.js r185.1 vendored** (MIT) with an import map. No bundler, no runtime npm dependencies; dev tools live in `tools/` only. Picked 0.185.1 rather than the newest 0.186.x because it has had three months of patch fixes.
3. **Commit identity uses the GitHub noreply address** for the Saifmaati account, so no personal email lands in public history.
4. **Research before copy.** Every number shown in the app comes from a claims ledger built by independent researcher agents and then re-checked by separate adversarial fact-checker agents who re-open each source (research/). Claims that fail verification are dropped or shown with an "Unverified" chip.
