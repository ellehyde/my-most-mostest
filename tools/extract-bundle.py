#!/usr/bin/env python3
"""Extract the images, fonts and page template out of the bundled index.html.

The home page is a ~10.6 MB single file whose `__bundler/manifest` script tag holds
every image and font as base64 (some gzipped). This pulls them back out as real files
so the Eleventy rebuild has proper sources, and writes the decoded page template as a
reference for porting the markup.

Read-only with respect to index.html. Usage:

    python3 tools/extract-bundle.py            # report only, writes nothing
    python3 tools/extract-bundle.py --write    # write assets/ + tools/reference/

Naming: each UUID is matched to how the template actually uses it (alt text, the
ext_resources id map, whether it sits in the favorites grid) rather than guessed from
size, so favorites-01..06 keep their on-page order.
"""
import argparse
import gzip
import json
import re
import sys
from base64 import b64decode
from pathlib import Path

SP = Path(__file__).resolve().parent
REPO = SP.parent
SRC = REPO / "index.html"
REF_DIR = SP / "reference"

EXT = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "font/woff2": ".woff2",
    "font/woff": ".woff",
    "text/javascript": ".js",
}

# Fonts we actually need: the bundle self-hosts every Google Fonts unicode subset,
# but the site is English-only, so only the `latin` subset of each family ships.
# Identified by which @font-face block's unicode-range covers U+0000-00FF.
WANTED_SUBSET = "latin"

# JS assets (React, ReactDOM, the dc-runtime) are deliberately dropped: the rebuild
# has no framework. Recorded in the report so the accounting adds up.
SKIP_MIME = {"text/javascript"}

# Assets already present in the repo at a path that must keep existing anyway, so
# extracting a second master would just be a duplicate to keep in sync.
# uuid -> (existing path, why it has to stay)
ALREADY_IN_REPO = {
    "712302f0-b36a-4fbd-bffe-a181afe0e91c": (
        "cover.jpg",
        "byte-identical to /cover.jpg (apple-touch-icon + JSON-LD image)",
    ),
}

# Nicer filenames than the slugified alt text would give.
NAME_OVERRIDES = {
    "2f6f436c": "story-bunny",
}


def read_blocks(html: str):
    def block(kind):
        m = re.search(rf'<script type="__bundler/{kind}">(.*?)</script>', html, re.S)
        if not m:
            sys.exit(f"could not find __bundler/{kind} block")
        return json.loads(m.group(1))

    return block("manifest"), block("ext_resources"), block("template")


def decode(entry) -> bytes:
    raw = b64decode(entry["data"])
    return gzip.decompress(raw) if entry.get("compressed") else raw


def font_subsets(template: str) -> dict:
    """uuid -> subset name, read from the @font-face rules' preceding comment.

    Google's CSS labels each block with a `/* latin */`-style comment; the bundler
    swapped the URLs for UUIDs but left the comments intact.
    """
    out = {}
    for comment, uuid in re.findall(
        r"/\*\s*([a-z0-9-]+)\s*\*/\s*@font-face\s*\{[^}]*?url\(\s*[\"']?([0-9a-f-]{36})[\"']?\s*\)",
        template,
        re.S,
    ):
        out[uuid] = comment
    return out


def font_families(template: str) -> dict:
    """uuid -> family name, from the same @font-face rules.

    In this bundle `font-family` precedes `src`, and the URL is quoted:
        @font-face { font-family: 'Fredoka'; ... src: url("<uuid>") format('woff2'); }
    """
    out = {}
    for fam, uuid in re.findall(
        r"@font-face\s*\{[^}]*?font-family:\s*'([^']+)'[^}]*?"
        r"url\(\s*[\"']?([0-9a-f-]{36})[\"']?\s*\)",
        template,
        re.S,
    ):
        out.setdefault(uuid, fam)
    return out


def image_names(template: str, ext_resources) -> dict:
    """uuid -> filename stem, derived from how the template uses each image."""
    names = {}

    # 1. ext_resources gives the two macaroni drops their ids (macA/macB).
    for r in ext_resources:
        if r["id"] in ("macA", "macB"):
            names[r["uuid"]] = "mac-" + ("1" if r["id"] == "macA" else "2")

    # 2. The favorites grid: take <img> uuids in document order inside #favorites.
    fav = re.search(r'id="favorites".*?(?=<section)', template, re.S)
    if fav:
        seen = []
        for uuid in re.findall(r'<img[^>]+src="([0-9a-f-]{36})"', fav.group(0)):
            if uuid not in seen:
                seen.append(uuid)
        for i, uuid in enumerate(seen, 1):
            names[uuid] = f"favorites-{i:02d}"

    # 3. Everything else: slugify its alt text, falling back to the section id.
    for tag in re.findall(r"<img[^>]+>", template):
        m = re.search(r'src="([0-9a-f-]{36})"', tag)
        if not m or m.group(1) in names:
            continue
        alt = re.search(r'alt="([^"]*)"', tag)
        stem = "image"
        if alt and alt.group(1).strip():
            stem = re.sub(r"[^a-z0-9]+", "-", alt.group(1).lower()).strip("-")[:40]
        names[m.group(1)] = stem
    return names


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="actually write files")
    args = ap.parse_args()

    html = SRC.read_text(encoding="utf-8")
    manifest, ext_resources, template = read_blocks(html)

    subsets = font_subsets(template)
    families = font_families(template)
    names = image_names(template, ext_resources)

    img_dir = REPO / "assets" / "home"
    font_dir = REPO / "assets" / "fonts"

    plan, skipped = [], []
    for uuid, entry in manifest.items():
        mime = entry.get("mime", "")
        data = decode(entry)
        if mime in SKIP_MIME:
            skipped.append((uuid, mime, len(data), "framework JS - not needed"))
            continue
        if uuid in ALREADY_IN_REPO:
            path, why = ALREADY_IN_REPO[uuid]
            on_disk = (REPO / path).exists() and (REPO / path).read_bytes() == data
            note = f"use /{path} - {why}"
            skipped.append((uuid, mime, len(data), note if on_disk else f"MISMATCH vs /{path}"))
            continue
        if mime.startswith("font/"):
            sub = subsets.get(uuid, "?")
            if sub != WANTED_SUBSET:
                skipped.append((uuid, mime, len(data), f"{families.get(uuid,'?')} {sub} subset"))
                continue
            fam = families.get(uuid, "font").lower()
            plan.append((font_dir / f"{fam}-{sub}{EXT.get(mime,'')}", data, uuid, mime))
            continue
        stem = NAME_OVERRIDES.get(uuid[:8]) or names.get(uuid, f"asset-{uuid[:8]}")
        plan.append((img_dir / f"{stem}{EXT.get(mime,'.bin')}", data, uuid, mime))

    plan.sort(key=lambda r: str(r[0]))
    total = sum(len(d) for _, d, _, _ in plan)

    print(f"{'file':44} {'mime':16} {'bytes':>10}  uuid")
    print("-" * 88)
    for path, data, uuid, mime in plan:
        print(f"{str(path.relative_to(REPO)):44} {mime:16} {len(data):>10,}  {uuid[:8]}")
    print("-" * 88)
    print(f"{'':44} {'':16} {total:>10,}  ({len(plan)} files, {total/1048576:.2f} MB)")

    if skipped:
        print("\nskipped:")
        for uuid, mime, n, why in sorted(skipped, key=lambda r: -r[2]):
            print(f"  {uuid[:8]}  {mime:16} {n:>10,}  {why}")

    if not args.write:
        print("\n(report only - pass --write to create the files)")
        return

    img_dir.mkdir(parents=True, exist_ok=True)
    font_dir.mkdir(parents=True, exist_ok=True)
    REF_DIR.mkdir(parents=True, exist_ok=True)
    for path, data, _, _ in plan:
        path.write_bytes(data)

    (REF_DIR / "home-template.html").write_text(template, encoding="utf-8")
    raw_head = re.search(r"<head>.*?</head>", html, re.S)
    if raw_head:
        (REF_DIR / "raw-head.html").write_text(raw_head.group(0), encoding="utf-8")
    (REF_DIR / "ext_resources.json").write_text(
        json.dumps(ext_resources, indent=2), encoding="utf-8"
    )
    print(f"\nwrote {len(plan)} assets + tools/reference/{{home-template,raw-head}}.html")


if __name__ == "__main__":
    main()
