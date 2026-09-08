#!/usr/bin/env python3
"""Build mymostmostest.com index.html from a pristine base + a list of exact edits.

Always builds from base-index.html (a frozen copy of the deployed file), so running
this twice produces the same output and never double-inserts.

Usage:
    python3 build.py preview     # -> repo/preview/index.html  (noindex, nofollow)
    python3 build.py root        # -> repo/index.html          (index, follow)
                                 #    refuses while any PLACEHOLDER remains
"""
import json
import re
import sys
from pathlib import Path

SP = Path(__file__).resolve().parent
# Was a hard-coded /Users/bluemac/... path while this script lived in a scratch
# directory outside the repo. Now that it is committed under tools/, derive the
# repo root from its own location so a fresh clone can run it.
REPO = SP.parent
BASE = SP / "base-index.html"

PLACEHOLDER = "TODO-NEEDS-URL"

# Gates the nav entries, the events teaser and the noscript links to /about/ and
# /events/. Held False while those pages carried placeholder copy; both went live
# with real content on 2026-08-18. Flip root back to False if either page ever
# needs to be pulled without rebuilding the rest of the page.
PAGES_LIVE = {"preview": True, "root": True}

# --------------------------------------------------------------------------
# Content config. Swap the PLACEHOLDER values for real ones and rebuild.
# --------------------------------------------------------------------------
C = {
    # Direct-from-publisher
    # Direct = IngramSpark's storefront (the publisher). Copy says "our publisher";
    # the GA label names it so reports read clearly.
    "publisher_name": "our publisher",
    "publisher_ga_name": "IngramSpark (direct)",
    "publisher_host_re": r"(^|\.)ingramspark\.",  # JS regex source for GA
    "direct_hardcover": "https://shop.ingramspark.com/b/084?params=P3pxhcsum0KOSjA4I9cG70FZr64LKUfw4KJVlyfLlVQ",
    "direct_paperback": "https://shop.ingramspark.com/b/084?params=lsBXSiQeXuNxgXtn8zwznFihprpzGvBZeFzuV7HSEVT",
    # Local signed copies (both stores run the same platform, hence the shared item id)
    "saltwater_url": "https://www.saltwaterbookshop.com/item/YZZx9elY01IAMdyeLygezQ",
    "saltwater_city": "Kingston, WA",
    "eagle_url": "https://www.eagleharborbooks.com/item/YZZx9elY01IAMdyeLygezQ",
    "eagle_city": "Bainbridge Island, WA",
}

INK = "#33322E"
CREAM = "#FFFDF7"
BLUE = "#3E5EA6"
YELLOW = "#F3C63C"
SAND = "#FBF8F0"   # warm cream, so white cards read as cards
FRED = "'Fredoka',sans-serif"


def pill(href, label, *, fill, color, hover, extra=""):
    return (
        f'<a href="{href}" target="_blank" rel="noopener" '
        f'style="font-family:{FRED};font-weight:600;font-size:17px;color:{color};text-decoration:none;'
        f'background:{fill};padding:14px 26px;border-radius:999px;border:2px solid {INK};'
        f'box-shadow:4px 4px 0 {INK};{extra}" '
        f'style-hover="background:{hover};transform:translate(-1px,-1px);box-shadow:5px 5px 0 {INK};">{label}</a>'
    )


# --------------------------------------------------------------------------
# Template edits: (description, old, new). Every `old` must appear exactly once.
# --------------------------------------------------------------------------
def template_edits(pages_live):
    edits = []

    # 1. Nav: story link becomes mobile-only, add about + events, root-absolute hashes
    old_story = ('      <a href="#story" style="font-family:\'Fredoka\',sans-serif;font-size:16px;'
                 'font-weight:500;color:#33322E;text-decoration:none;" style-hover="color:#3E5EA6;">the story</a>\n')
    nav_link = ('      <a href="{href}"{extra} style="font-family:\'Fredoka\',sans-serif;font-size:16px;'
                'font-weight:500;color:#33322E;text-decoration:none;" style-hover="color:#3E5EA6;">{label}</a>\n')
    new_nav = (
        nav_link.format(href="/about/", extra="", label="about")
        + nav_link.format(href="/events/", extra="", label="events")
        + nav_link.format(href="/#story", extra=' id="navStory"', label="the story")
    )
    if pages_live:
        edits.append(("nav: about + events links", old_story, new_nav))

    for anchor in ("favorites", "hello"):
        edits.append((
            f"nav: root-absolute #{anchor}",
            f'<a href="#{anchor}" style="font-family:\'Fredoka\'',
            f'<a href="/#{anchor}" style="font-family:\'Fredoka\'',
        ))

    # 2. Nav CSS: hide "the story" on desktop, show it inside the hamburger
    if pages_live:
        edits.append((
            "css: #navStory desktop hidden",
            "#navMenu>a{white-space:nowrap;}",
            "#navMenu>a{white-space:nowrap;}#navStory{display:none;}",
        ))
        edits.append((
            "css: #navStory visible on mobile",
            "@media (max-width:600px){#navBurger{display:flex;}",
            "@media (max-width:600px){#navBurger{display:flex;}#navStory{display:block!important;}",
        ))

    # 3. GA listener: new hosts, channel param, data-ga-skip guard
    old_hosts = ("  var HOSTS=[{re:/(^|\\.)amazon\\./i,name:'Amazon'},"
                 "{re:/(^|\\.)barnesandnoble\\./i,name:'Barnes & Noble'},"
                 "{re:/(^|\\.)bookshop\\.org/i,name:'Bookshop.org'},"
                 "{re:/(^|\\.)walmart\\./i,name:'Walmart'}];\n"
                 "  function retailerFor(h){for(var i=0;i<HOSTS.length;i++){if(HOSTS[i].re.test(h))return HOSTS[i].name;}return null;}")
    new_hosts = ("  var HOSTS=[{re:/(^|\\.)amazon\\./i,name:'Amazon',channel:'retail'},"
                 "{re:/(^|\\.)barnesandnoble\\./i,name:'Barnes & Noble',channel:'retail'},"
                 "{re:/(^|\\.)bookshop\\.org/i,name:'Bookshop.org',channel:'retail'},"
                 "{re:/(^|\\.)walmart\\./i,name:'Walmart',channel:'retail'},"
                 "{re:/" + C["publisher_host_re"] + "/i,name:'" + C["publisher_ga_name"] + "',channel:'direct'},"
                 "{re:/(^|\\.)saltwaterbookshop\\./i,name:'Saltwater Bookshop',channel:'local'},"
                 "{re:/(^|\\.)eagleharborbooks\\./i,name:'Eagle Harbor Book Co.',channel:'local'}];\n"
                 "  function retailerFor(h){for(var i=0;i<HOSTS.length;i++){if(HOSTS[i].re.test(h))return HOSTS[i];}return null;}")
    edits.append(("ga: host table + channel", old_hosts, new_hosts))

    old_fire = ("    if(!a)return;\n"
                "    var host;try{host=new URL(a.href).hostname;}catch(_){return;}\n"
                "    var r=retailerFor(host);\n"
                "    if(!r||typeof gtag!=='function')return;\n"
                "    gtag('event','retailer_click',{retailer:r,link_url:a.href,"
                "link_text:(a.textContent||'').trim().replace(/\\s+/g,' ').slice(0,100),location:locFor(a)});")
    new_fire = ("    if(!a||a.hasAttribute('data-ga-skip'))return;\n"
                "    var host;try{host=new URL(a.href).hostname;}catch(_){return;}\n"
                "    var r=retailerFor(host);\n"
                "    if(!r||typeof gtag!=='function')return;\n"
                "    gtag('event','retailer_click',{retailer:r.name,channel:r.channel,link_url:a.href,"
                "link_text:(a.textContent||'').trim().replace(/\\s+/g,' ').slice(0,100),location:locFor(a)});")
    edits.append(("ga: fire with channel + skip guard", old_fire, new_fire))

    # 4. Events teaser strip, above "say hello"
    teaser = (
        '  <section id="comesayhi" data-screen-label="Events teaser" '
        f'style="background:{CREAM};border-top:2px solid {INK};border-bottom:2px solid {INK};'
        'padding:clamp(22px,3.4vw,32px) clamp(18px,5vw,64px);">\n'
        '    <div style="max-width:900px;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;'
        'justify-content:center;gap:12px 26px;text-align:center;">\n'
        f'      <p style="font-family:{FRED};font-weight:600;font-size:clamp(17px,2.1vw,21px);line-height:1.35;'
        f'color:{INK};margin:0;">we started doing readings, come say hi in person.</p>\n'
        f'      <a href="/events/" style="font-family:{FRED};font-weight:600;font-size:16px;color:{CREAM};'
        f'text-decoration:none;background:{BLUE};padding:12px 24px;border-radius:999px;border:2px solid {INK};'
        f'box-shadow:3px 3px 0 {INK};white-space:nowrap;" style-hover="background:#33508F;">'
        'see upcoming events</a>\n'
        '    </div>\n'
        '  </section>\n\n'
    )
    if pages_live:
        edits.append(("section: events teaser", '  <section id="hello" data-screen-label="Say hello"',
                      teaser + '  <section id="hello" data-screen-label="Say hello"'))

    # 5. #direct + #signed, above the retailers block
    direct = (
        '  <section id="direct" data-screen-label="Buy direct" '
        f'style="position:relative;background:{BLUE};color:{CREAM};border-top:2px solid {INK};'
        'padding:clamp(52px,7vw,86px) clamp(18px,5vw,64px);">\n'
        '    <div style="max-width:820px;margin:0 auto;text-align:center;">\n'
        f'      <div style="display:inline-block;font-family:{FRED};background:{YELLOW};color:{INK};'
        f'padding:6px 15px;border-radius:999px;border:2px solid {INK};font-weight:600;font-size:14px;'
        f'transform:rotate(-2deg);margin-bottom:20px;box-shadow:3px 3px 0 {INK};">the one that helps us most</div>\n'
        f'      <h2 style="font-family:{FRED};font-weight:600;font-size:clamp(28px,4.4vw,44px);line-height:1.1;'
        'margin:0 0 16px;">want to support us directly?</h2>\n'
        '      <p style="font-family:\'Nunito\',sans-serif;font-size:clamp(16px,1.9vw,19px);line-height:1.6;'
        'margin:0 0 28px;color:#EDEFF7;">buying straight from '
        + C["publisher_name"] +
        ' sends more back to the two of us.</p>\n'
        '      <div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center;">\n        '
        + pill(C["direct_paperback"], "get the paperback, direct &rarr;", fill=CREAM, color=INK, hover="#F1EFE8")
        + '\n        '
        + pill(C["direct_hardcover"], "or the hardcover, direct", fill="transparent", color=CREAM,
               hover="rgba(255,253,247,0.14)", extra=f"border-color:{CREAM};box-shadow:4px 4px 0 rgba(51,50,46,0.55);")
        + '\n      </div>\n'
        '      <p style="font-family:\'Nunito\',sans-serif;font-size:15px;line-height:1.6;margin:24px 0 0;'
        'color:#CBD4EA;">prefer one click? the usual shops are just below - a copy from anywhere is still a '
        'copy read at bedtime.</p>\n'
        '    </div>\n'
        '  </section>\n\n'
    )

    def store_card(logo, alt, name, city, url, logo_max):
        return (
            '        <div style="flex:1 1 300px;max-width:390px;display:flex;flex-direction:column;'
            f'align-items:center;gap:16px;background:#FFFFFF;border:2px solid {INK};border-radius:22px;'
            f'box-shadow:5px 5px 0 {INK};padding:28px 24px;">\n'
            '          <div style="height:140px;display:flex;align-items:center;justify-content:center;">\n'
            f'            <img src="{logo}" alt="{alt}" loading="lazy" '
            f'style="max-height:140px;max-width:{logo_max};width:auto;height:auto;display:block;">\n'
            '          </div>\n'
            f'          <div style="font-family:{FRED};font-weight:600;font-size:20px;color:{INK};'
            f'text-align:center;line-height:1.25;">{name}<br>'
            f'<span style="font-family:\'Nunito\',sans-serif;font-weight:400;font-size:15px;color:#7a776f;">'
            f'{city}</span></div>\n          '
            + pill(url, "buy a signed copy &rarr;", fill=BLUE, color=CREAM, hover="#33508F",
                   extra="font-size:16px;padding:12px 22px;")
            + '\n        </div>\n'
        )

    signed = (
        '  <section id="signed" data-screen-label="Signed copies" '
        f'style="background:{SAND};border-top:2px solid {INK};'
        'padding:clamp(48px,6.5vw,76px) clamp(18px,5vw,64px);">\n'
        '    <div style="max-width:900px;margin:0 auto;text-align:center;">\n'
        f'      <div style="display:inline-block;font-family:{FRED};background:{YELLOW};color:{INK};'
        f'padding:6px 15px;border-radius:999px;border:2px solid {INK};font-weight:600;font-size:14px;'
        f'transform:rotate(2deg);margin-bottom:20px;box-shadow:3px 3px 0 {INK};">limited</div>\n'
        f'      <h2 style="font-family:{FRED};font-weight:600;font-size:clamp(26px,4vw,40px);line-height:1.15;'
        f'color:{INK};margin:0 0 14px;">signed copies, on a real shelf</h2>\n'
        '      <p style="font-family:\'Nunito\',sans-serif;font-size:clamp(16px,1.9vw,19px);line-height:1.6;'
        'color:#5f5c55;margin:0 auto 8px;max-width:620px;">we signed a stack at each of these shops '
        'when we read to little kids. support an independent bookshop, get a copy with a scribble.</p>\n'
        '      <p style="font-family:\'Nunito\',sans-serif;font-size:clamp(16px,1.9vw,19px);line-height:1.6;'
        'color:#5f5c55;margin:0 auto 34px;max-width:620px;">not nearby? they ship!</p>\n'
        '      <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:22px;">\n'
        + store_card("/assets/stores/saltwater.png", "Saltwater Bookshop", "Saltwater Bookshop",
                     C["saltwater_city"], C["saltwater_url"], "240px")
        + store_card("/assets/stores/eagle-harbor.png", "Eagle Harbor Book Co.", "Eagle Harbor Book Co.",
                     C["eagle_city"], C["eagle_url"], "230px")
        + '      </div>\n'
        '    </div>\n'
        '  </section>\n\n'
    )

    edits.append(("sections: direct + signed",
                  '  <section id="retailers" data-screen-label="Where to buy"',
                  direct + signed + '  <section id="retailers" data-screen-label="Where to buy"'))

    return edits


# --------------------------------------------------------------------------
# Raw-<head> edits (outside the bundle; what non-JS crawlers see)
# --------------------------------------------------------------------------
def raw_edits(pages_live):
    pages_block = (
        '      <h2>Readings and events</h2>\n'
        '      <p><a href="/events/">Upcoming readings and events</a>, and how to request a reading.</p>\n'
        '      <h2>About</h2>\n'
        '      <p><a href="/about/">About Brie Hollingsworth Krebs and Elle Harting</a>.</p>\n'
    ) if pages_live else ""
    return [
        ("noscript: direct links" + (" + new pages" if pages_live else ""),
         '      <h2>Say hello</h2>',
         '      <h2>Buy direct from the publisher</h2>\n'
         '      <ul>\n'
         f'        <li><a href="{C["direct_paperback"]}">Paperback, direct from the publisher</a></li>\n'
         f'        <li><a href="{C["direct_hardcover"]}">Hardcover, direct from the publisher</a></li>\n'
         '      </ul>\n'
         + pages_block +
         '      <h2>Say hello</h2>'),
    ]


# --------------------------------------------------------------------------
def move_hello_above_footer(tpl):
    """Relocate the yellow "say hello" section so it sits directly above the footer.

    Cut-and-paste rather than a string edit, so the section's markup stays byte-identical.
    """
    m = re.search(r'  <section id="hello" data-screen-label="Say hello".*?\n  </section>\n\n', tpl, re.S)
    if not m:
        raise SystemExit("move: #hello section not found")
    block = m.group()
    if block.count("<section") != 1:
        raise SystemExit(f"move: #hello block swallowed {block.count('<section')} sections")
    tpl = tpl[:m.start()] + tpl[m.end():]

    footer = '  <footer style="position:relative;background:#33322E;'
    if tpl.count(footer) != 1:
        raise SystemExit("move: footer anchor not unique")
    tpl = tpl.replace(footer, block + footer)

    if tpl.index('id="hello"') < tpl.index('id="retailers"'):
        raise SystemExit("move: #hello did not end up below #retailers")
    return tpl


def apply_edits(text, edits, label):
    for desc, old, new in edits:
        n = text.count(old)
        if n != 1:
            raise SystemExit(f"[{label}] edit {desc!r}: expected 1 match, found {n}")
        text = text.replace(old, new)
    return text


def build(target):
    html = BASE.read_text(encoding="utf-8")

    # raw edits first: they shift byte offsets, so locate the template block afterwards
    pages_live = PAGES_LIVE[target]
    html = apply_edits(html, raw_edits(pages_live), "raw")

    robots_from, robots_to = '"robots" content="index, follow"', '"robots" content="noindex, nofollow"'
    if target == "preview":
        html = html.replace(robots_from, robots_to)   # before locating the block: shifts offsets
        out = REPO / "preview" / "index.html"
    else:
        leftover = [k for k, v in C.items() if isinstance(v, str) and PLACEHOLDER in v] \
            + (["publisher_host_re"] if "TODOPUBLISHER" in C["publisher_host_re"] else [])
        if leftover:
            raise SystemExit(f"refusing to build root: placeholders still set for {sorted(set(leftover))}")
        out = REPO / "index.html"

    m = re.search(r'(<script type="__bundler/template">)(.*?)(</script>)', html, re.S)
    if not m:
        raise SystemExit("template block not found")
    tpl = json.loads(m.group(2))

    tpl = apply_edits(tpl, template_edits(pages_live), "template")
    tpl = move_hello_above_footer(tpl)
    if target == "preview":
        tpl = tpl.replace(robots_from, robots_to)

    encoded = json.dumps(tpl).replace("<", "\\u003c")
    if encoded.count("</script>") != 0:
        raise SystemExit("re-encoded template still contains a literal </script>")
    html = html[:m.start(2)] + encoded + html[m.end(2):]

    # integrity: exactly one </script> closing the template block
    m2 = re.search(r'<script type="__bundler/template">(.*?)</script>', html, re.S)
    region = html[m2.start():m2.end()]
    if region.count("</script>") != 1:
        raise SystemExit(f"template region has {region.count('</script>')} </script> tags, expected 1")
    if json.loads(m2.group(1)) != tpl:
        raise SystemExit("round-trip mismatch: decoded template != built template")

    robots = re.findall(r'name="robots" content="([^"]+)"', html)
    out.write_text(html, encoding="utf-8")
    print(f"wrote {out}  ({len(html):,} bytes)  robots={set(robots)}  links to /about/ + /events/: {pages_live}  edits ok")


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "preview")
