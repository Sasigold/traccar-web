# viper fleet ↔ Traccar Web (upstream)

FND-09. viper fleet started as a fork of [traccar/traccar-web](https://github.com/traccar/traccar-web)
at commit `30c730bd` (2 Nov 2026). Most upstream files have been rewritten since, so **upstream is
a source to read, not a branch to merge**: a merge would conflict across the app and undo the
Hebrew, RTL and brand work.

## The rule

- **Read, then cherry-pick.** Every two weeks, run `sh tools/upstream-review.sh`. It fetches
  upstream and lists each new commit with the files it touches, marked `clean` (unchanged here
  since the fork, the fix applies as is), `changed` (ported by hand) or `gone` (removed here).
- **Label every commit** in the log below: `import` (a bug fix or a server API change we need),
  `skip` (we solved it differently), or `n/a` (an area we do not have, a translation, a version
  bump we already have). Then update "last reviewed".
- **Import** with `git cherry-pick -x <commit>` (clean files) or a hand port that cites the
  commit in its message (changed files). Every import runs `npm run lint`, `npm test` and the
  e2e suite like any other change.
- **Leave untouched upstream files untouched.** Extend them from the outside (a wrapper, a new
  component) so their upstream fixes stay a clean cherry-pick.
- **The real dependency is the Traccar server's API**, not this repository. Read the server's
  release notes (github.com/traccar/traccar/releases) at every server upgrade, and check the
  endpoints the app calls (`api/session`, `api/devices`, `api/positions`, `api/reports/*`,
  `api/commands/*`, the WebSocket at `api/socket`).

## What was removed from upstream

- `simple/` (the upstream "simple" page) and the 57 interface translations that are never
  loaded (the app ships Hebrew and English, and loads Arabic and Russian on demand; A11-10).
- The upstream Transifex workflow (it force-pulled `he.json` and dropped our strings).
- The upstream README header: the README now describes viper fleet and credits Traccar.

## Review log

Last reviewed upstream commit: `30c730bd` (the fork point; run the script for the next review).

| Date | Upstream commit | Subject | Label | Notes |
| --- | --- | --- | --- | --- |
| — | — | — | — | — |
