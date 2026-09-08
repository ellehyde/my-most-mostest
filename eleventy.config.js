import { readFileSync } from "node:fs";
import path from "node:path";
import Image from "@11ty/eleventy-img";

const IS_PREVIEW = process.env.ELEVENTY_ENV === "preview";

export default function (eleventyConfig) {
  // ---- passthrough -------------------------------------------------------
  // static/ lands at the web root byte-identical. The Search Console
  // verification file, CNAME and the OG image must keep their exact paths and
  // bytes, so they are copied, never processed.
  eleventyConfig.addPassthroughCopy({ static: "." });
  eleventyConfig.addPassthroughCopy("assets/fonts");
  eleventyConfig.addPassthroughCopy("assets/stores");
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
      urlPath: "/img/",
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
