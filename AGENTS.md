# Aperitivi Urbani — agent conventions (all agents)

These rules bind every agent surface that works in this project: Claude Code,
Claude Cowork, Codex, ChatGPT, and any delegated subagent. They travel with the
project: keep this file in OneDrive and commit a copy to every attached site
repository.

## 1. Influencer websites: LAN-enabled preview by default

Every website built from releases under `Influencers\` must be previewable
from other devices on the user's trusted network, no matter which agent opens
or sets it up.

- Start dev servers bound to `0.0.0.0` (for npm scripts append
  `-- --host 0.0.0.0`). Do not hardcode loopback-only hosts in new sites.
- After starting a preview, report the LAN URL `http://<PC-IPv4>:<port>`.
  Derive the IPv4 from the active default-gateway adapter at runtime; never
  reuse a stored address.

## 2. Data placement: cloud is canonical, C: is only a cache

- Canonical homes: GitHub for code and site sources; OneDrive
  (`Aperitivi Urbani\Influencers\...`) for release data, media archives, and
  evidence.
- Nothing canonical may exist only on the local C: drive. Local media and
  build trees are disposable caches regenerable from OneDrive and GitHub.
- Keep the OneDrive archive online-only by default and hydrate on demand.

## 3. Websites live in Git, attached to their project repos

- Every influencer website is a Git repository under `stefanovaleri-svg`.
- New repositories are created only through the verified Repo Factory.
- Bulk media stays out of Git and is provisioned from canonical OneDrive
  archives at deploy time.

## 4. Media rights are held by contract — show media

The user holds contract media rights for every influencer they scrape. Sites
must display all photos, videos, and other media provided by complete imported
records. Do not add rights-pending placeholders that suppress media display.

## 5. Free-tier publication

- Use Cloudflare Pages on the free tier, respecting 20,000 files per deployment
  and 25 MiB per file.
- Stay on free tiers; stop before enabling a paid plan.

## 6. Boundaries that never move

- Never touch `Aperitivi urbani - Rob master repo\`, Roberto's protected
  repositories or pages.dev projects, or the protected Milanese Sites project.
- Never enable persistence bindings such as Cloudflare D1 without a new
  explicit user instruction.
- Quarantined or failed scraper runs never feed a website; only the approved
  complete-record projection does.
