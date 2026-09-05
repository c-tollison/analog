# Analog

A personal physical media tracker. Forgetting what in your collection back at home? Use analog to track CDs, DVDs, video games, books, manga/comics from anywhere in the world. Later versions will hopefully have a barcode scanner.

Built as a side project to tighten understanding on multiple subjects, including but not limited to:
- Fullstack TypeScript
- API design with end-to-end type safety
- Database management
- Session auth with token rotation
- Self-hosting on a VPS: reverse proxy, TLS, CDN, zero-downtime deploys
- CI/CD with automated testing
- Observability: structured logs, metrics, uptime monitoring
- Integrating with an online data source

## Dev Info

`package.json` scripts:

```bash
# Format and lint, applying safe fixes in place
pnpm check

# Format and lint in check-only mode (used in CI)
pnpm check:ci
```