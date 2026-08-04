# Aperitivi Urbani — opzione catalogo

Public, card-first guide built from the operator-approved Aperitivi Urbani
snapshot. It includes 573 complete posts, 327 venue groups, and every one of
the 2,307 contract-approved media assets. The 42 incomplete records are
excluded from the interface.

Live site: https://aperitivi-urbani-catalogo.pages.dev

## Public-data boundary

`src/data/catalog.json` is a deterministic public projection. It contains only
venue display fields, source-post links, editorial summaries/tags, verified
coordinates, and public media routes. Raw comments, commenter references,
parent IDs, archive paths, hashes, local paths, and private run evidence are
deliberately excluded.

Regenerate from a trusted private catalogue:

```text
npm run data:sanitize -- --source <path-to-private-catalog.ts>
```

## Verify and build

```text
npm install
npm test
```

The dev server binds to `0.0.0.0` for LAN preview.

## Cloudflare Pages direct upload

Bulk media is not stored in Git. After `npm run build`, create disposable
same-volume hardlinks from the verified media allowlist, then deploy:

```text
npm run pages:prepare -- --media-root <path-to-verified-public-media>
npm run pages:deploy
```

The Pages project is `aperitivi-urbani-catalogo`. No database or persistence
binding is used.
