import { readFileSync } from "node:fs";
import path from "node:path";
import Image from "@11ty/eleventy-img";
import { execFileSync } from "node:child_process";

const IS_PREVIEW = process.env.ELEVENTY_ENV === "preview";
// Mirrors the --pathprefix passed alongside ELEVENTY_ENV=preview.
const PATH_PREFIX = IS_PREVIEW ? "/preview/" : "/";

export default function (eleventyConfig) {
  // ---- passthrough -------------------------------------------------------
  // static/ lands at the web root byte-identical. The Search Console
  // verification file, CNAME and the OG image must keep their exact paths and
  // bytes, so they are copied, never processed.
  eleventyConfig.addPassthroughCopy({ static: "." });
  eleventyConfig.addPassthroughCopy("assets/fonts");
  eleventyConfig.addPassthroughCopy("assets/stores");
  // Event photos, including whatever Brie uploads. originals/ is deliberately
  // excluded - it holds multi-MB camera files that must never be deployed.
  eleventyConfig.addPassthroughCopy({ "assets/events": "assets/events" }, {
    filter: (p) => !p.includes("originals"),
  });
  // The macaroni drops are referenced from JS at runtime, so they need a
  // stable URL rather than a content-hashed one from the image pipeline.
  eleventyConfig.addPassthroughCopy("assets/home/mac-*.png");
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");

  eleventyConfig.addWatchTarget("./src/css/");
  eleventyConfig.addWatchTarget("./src/js/");
  eleventyConfig.addWatchTarget("./content/");

  // ---- images ------------------------------------------------------------
  // Emits <picture> with WebP + an original-format fallback, and always sets
  // width/height so the layout never shifts as images load. Widths above the
  // source width are dropped by eleventy-img rather than upscaled.
  async function imageShortcode(src, alt, opts = {}) {
    if (alt === undefined) {
      throw new Error(`Missing alt text for image: ${src}`);
    }
    const file = src.startsWith("/") ? path.join(".", src) : src;
    const metadata = await Image(file, {
      widths: opts.widths ?? [400, 800],
      // JPEG, not PNG, for the fallback: every image the pipeline touches is
      // fully opaque (verified when they were extracted from the bundle), so a
      // PNG fallback buys nothing and cost 2.4 MB of artifact. Browsers take
      // the WebP regardless; this only exists as a safety net.
      formats: ["webp", opts.fallback ?? "jpeg"],
      outputDir: "./_site/img/",
      urlPath: PATH_PREFIX + "img/",
      sharpWebpOptions: { quality: 82 },
    });
    return Image.generateHTML(metadata, {
      alt,
      sizes: opts.sizes ?? "100vw",
      loading: opts.loading ?? "lazy",
      decoding: "async",
      class: opts.class ?? "",
      ...(opts.fetchpriority ? { fetchpriority: opts.fetchpriority } : {}),
    });
  }
  eleventyConfig.addAsyncShortcode("image", imageShortcode);

  // ---- filters -----------------------------------------------------------
  // Absolute URL for canonical/OG tags. Always production, even in the
  // preview build, so /preview/ never competes with the real page in search.
  eleventyConfig.addFilter("absoluteUrl", (p) => {
    const base = "https://mymostmostest.com";
    if (!p) return base + "/";
    return p.startsWith("http") ? p : base + (p.startsWith("/") ? p : "/" + p);
  });

  // lastmod from git, not file mtime: a fresh clone (which is what CI has)
  // gives every file the checkout time, which would claim every page changed
  // on every build. Falls back to today if git history is unavailable.
  const lastmodCache = new Map();
  eleventyConfig.addFilter("lastmod", (paths) => {
    const list = Array.isArray(paths) ? paths : [paths];
    const key = list.join("|");
    if (lastmodCache.has(key)) return lastmodCache.get(key);
    let newest = "";
    for (const p of list) {
      try {
        const out = execFileSync("git", ["log", "-1", "--format=%cs", "--", p], {
          encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
        }).trim();
        if (out > newest) newest = out;
      } catch { /* no git history (shallow clone, or not a repo) */ }
    }
    const val = newest || new Date().toISOString().slice(0, 10);
    lastmodCache.set(key, val);
    return val;
  });

  eleventyConfig.addFilter("jsonld", (obj) =>
    JSON.stringify(obj).replace(/</g, "\\u003c"),
  );

  // Inline a file from src/ (used for the critical GA snippet + click listener,
  // which must run before anything else on the page).
  eleventyConfig.addFilter("inlineFile", (p) =>
    readFileSync(path.join("src", p), "utf8"),
  );

  eleventyConfig.addGlobalData("env", {
    preview: IS_PREVIEW,
    // Preview keeps the production canonical, so it never competes in search.
    robots: IS_PREVIEW ? "noindex, nofollow" : "index, follow",
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["njk", "html"],
  };
}
