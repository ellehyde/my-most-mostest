# tools/ — home-page build pipeline

This directory holds the **only supported way to edit the bundled home page** (`/index.html` and
`/preview/index.html`). Everything else on the site (`/events/`, `/about/`, `/privacy/`) is plain
hand-written HTML you edit directly.

## Why this exists / recovery note (2026-09-08)

`build.py` was written on 2026-08-18 but **was never committed** — it lived in a per-session
scratch directory under `/private/tmp` that has since been deleted. Its input `base-index.html`
was gone entirely, and the jsdom verification suites (`test-home.mjs`, `test-pages.mjs`) that
accompanied it are unrecoverable.

For roughly three weeks the home page was therefore **un-editable by its documented process**.
It was recovered from Claude Code's file-history cache (snapshot `@v17`, the version whose
timestamp matches commit `f51d046`) and committed here so it cannot be lost again.

`base-index.html` was reconstructed as **`git show 6dc6bd5:index.html`** — the state of the home
page immediately *before* the 2026-08-18 direct-buy / signed-copies work. That is the correct
base because the script *applies* those edits; using current production as the base makes every
exact-match assertion fail on already-applied edits.

**Verified on recovery:** running the script against this base reproduces the deployed
`index.html` and `preview/index.html` **byte-for-byte** (sha256 match against `HEAD`), from a
fresh clone, with all edit assertions passing.

The only change from the recovered original: `REPO` was a hard-coded `/Users/bluemac/...` path
(correct when the script lived outside the repo); it now derives from the script's own location
(`SP.parent`), so a fresh clone works. Verified byte-identical output after the change.

## Usage

```
python3 tools/build.py preview   # -> preview/index.html  (noindex, nofollow)
python3 tools/build.py root      # -> index.html          (index, follow)
```

Bare `python3 tools/build.py` defaults to **preview**, so it can never overwrite root by accident.

**Always build and review `/preview/` first** (https://mymostmostest.com/preview/, hard-refresh —
the 10 MB file caches hard), then build root. See the Preview section in `../CLAUDE.md`.

## How it works

It never hand-edits base64. It decodes the `__bundler/template` JSON, applies a list of
`(description, old, new)` string replacements — **each asserted to match exactly once** — and
re-encodes with the mandatory `json.dumps(tpl).replace("<", "\\u003c")` escaping.

Safety envelope, all fatal:

- every edit must match exactly once (`expected 1 match, found N`)
- the re-encoded template must contain **zero** literal `</script>`
- the rebuilt template region must contain **exactly one** `</script>`
- the template must round-trip: `json.loads(rebuilt) == built`
- `move_hello_above_footer` carries four of its own guards
- `root` refuses to build while any `TODO-NEEDS-URL` placeholder remains in `C`

Because it always starts from the frozen `base-index.html`, it is **idempotent** — running it
twice produces identical output and never double-inserts.

## Editing content

- **Buy URLs, store details, publisher/GA labels** — the `C = {...}` dict at the top.
- **Copy, markup, sections** — the edit list in `template_edits()`; raw `<head>` / `<noscript>`
  in `raw_edits()`.
- **`PAGES_LIVE`** gates the nav links to `/about/` + `/events/` and the events teaser. Both are
  live; flip a target to `False` to pull those links without rebuilding anything else.

After any change to an `old` string that no longer matches production, the assertion will fail
loudly rather than silently corrupting the page — that is the intended behaviour. Fix the `old`
string to match `base-index.html`, not production.

## Important

- **Do not delete `base-index.html`.** Without it the script cannot run, which is exactly how
  this pipeline was lost the first time.
- **Do not re-freeze `base-index.html` from current production** unless you also remove the
  already-applied edits from `template_edits()`/`raw_edits()`. The base is deliberately the
  pre-2026-08-18 state.
- The jsdom verification suites are still missing. Until they are rewritten, verify by hand:
  ```
  curl -s https://mymostmostest.com | grep -icE 'retailer_click|__bundler/template'
  ```
  plus a real-device check on `/preview/`.
- Section IDs (`buy story signup favorites comesayhi direct signed retailers hello`) are GA4
  dimensions — the `retailer_click` `location` parameter is derived from them. Renaming one
  silently breaks the "Direct vs retail" report.
