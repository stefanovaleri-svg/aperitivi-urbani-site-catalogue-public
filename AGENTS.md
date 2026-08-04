# Public-site contributor guide

This repository contains one public Aperitivi Urbani website option. Keep its
source, configuration, issues, and commit history safe for public inspection.

## Data and privacy

- Publish only the committed complete-record projection.
- Do not add comments, commenter identifiers, parent identifiers, collection
  evidence, run metadata, archive paths, local paths, hashes, credentials, or
  other private operational data.
- Preserve the published coverage totals and source links unless a new
  accepted projection is supplied and independently validated.
- Bulk media is supplied at deployment time from a separately verified source
  and must remain outside Git.

## Media

- Display every media item referenced by the accepted public projection.
- Stage media only from the projection's exact route allowlist.
- Reject unsafe paths, unexpected links, unsupported signatures, duplicate
  routes, and files above the hosting limit.

## Development and release

- Keep the ordinary development server on localhost. LAN preview is an
  explicit, temporary opt-in on a trusted network.
- Run the full test, typecheck, build, privacy, and dependency-audit checks
  before merging or deploying.
- Deploy only to this repository's dedicated Cloudflare Pages project and stay
  within its free-tier file and size limits.
- Do not add persistence services or external data bindings without explicit
  authorization.

## Repository hygiene

- Never commit generated deployment media, build output, secrets, local
  machine details, or private project topology.
- Preserve unrelated changes and use reviewed branches for substantive work.
