# Diagrams

The diagrams in the main README are PNG images made from the Mermaid files in this folder. Images show up everywhere, including the GitHub phone app, which doesn't draw Mermaid diagrams. They use a light theme with a white background, so they're readable in GitHub's light and dark modes.

| Diagram | Source | Image |
|---|---|---|
| Architecture | `01-architecture.mmd` | `01-architecture.png` |
| The order flow (three gates) | `02-order-flow.mmd` | `02-order-flow.png` |
| Idempotency note lifecycle | `03-idempotency-note.mmd` | `03-idempotency-note.png` |
| One purchase, step by step | `04-one-purchase.mmd` | `04-one-purchase.png` |
| Login and token refresh | `05-auth-refresh.mmd` | `05-auth-refresh.png` |
| Product list cache vs stock counters | `06-cache-vs-stock.mmd` | `06-cache-vs-stock.png` |
| Data model | `07-data-model.mmd` | `07-data-model.png` |

## Changing a diagram

1. Edit the `.mmd` file. You can preview it at [mermaid.live](https://mermaid.live), or in any editor with Mermaid preview.
2. Render it again from this folder:

   ```bash
   npx -p @mermaid-js/mermaid-cli mmdc -i 02-order-flow.mmd -o 02-order-flow.png -c mermaid.config.json -b white -s 2
   ```

   `-s 2` renders at double size, so it stays sharp on phones. `mermaid.config.json` sets the light theme and font.

   The first run downloads Mermaid's renderer and a headless Chromium (around 150–200 MB). To use your installed Chrome instead, set `PUPPETEER_SKIP_DOWNLOAD=true` when installing, and pass `-p puppeteer.json` with `{ "executablePath": "<path to chrome>" }`.

3. Commit both the `.mmd` and the `.png`.
