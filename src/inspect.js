"use strict";

const { readMeta } = require("./meta");
const { imageSize } = require("./imageSize");

// Link-preview bots identify themselves like this; some sites serve them
// different HTML, so the tester asks for pages the same way.
const BOT_USER_AGENT = "WhatsApp/2.23 facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
const PAGE_TIMEOUT_MS = 180_000; // dev servers can take a while to compile a page
const IMAGE_TIMEOUT_MS = 60_000;

function fetchWithTimeout(url, ms, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...init, signal: controller.signal, redirect: "follow" }).finally(() =>
    clearTimeout(timer),
  );
}

function stripOrigin(url) {
  return url.replace(/\/$/, "");
}

/** Maps a live-site URL onto the local site so it can be fetched before deploy. */
function toLocal(url, config) {
  if (!config.siteUrl) return url;
  const site = stripOrigin(config.siteUrl);
  if (url === site || url.startsWith(`${site}/`) || url.startsWith(`${site}?`)) {
    return `${stripOrigin(config.target)}${url.slice(site.length)}`;
  }
  return url;
}

function resolvePageUrl(input, config) {
  const value = (input || "/").trim();
  if (/^https?:\/\//i.test(value)) return toLocal(value, config);
  return `${stripOrigin(config.target)}${value.startsWith("/") ? "" : "/"}${value}`;
}

function formatBytes(bytes) {
  if (bytes == null) return "unknown";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function checkImage(url) {
  try {
    const res = await fetchWithTimeout(url, IMAGE_TIMEOUT_MS, {
      headers: { "User-Agent": BOT_USER_AGENT },
    });
    const contentType = res.headers.get("content-type") || "";
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      ok: res.ok,
      status: res.status,
      finalUrl: res.url,
      contentType,
      bytes: buf.length,
      size: imageSize(buf),
    };
  } catch (err) {
    return { ok: false, error: err.name === "AbortError" ? "Timed out" : err.message };
  }
}

function buildChecks(result) {
  const checks = [];
  const add = (level, text) => checks.push({ level, text });
  const { preview, image, meta } = result;

  if (result.status >= 400) {
    add("error", `The page returned HTTP ${result.status} - apps will preview an error page. Check the URL.`);
  } else if (result.redirected) {
    add("info", `The page redirected to ${result.finalUrl} - apps preview the final page.`);
  }

  if (!preview.title) add("error", "No title - add og:title (or at least a <title>).");
  else if (!meta["og:title"]) add("warn", "No og:title - apps fall back to <title>, add og:title to control it.");

  if (!preview.description) add("warn", "No description - add og:description.");
  else {
    if (/(^|\s)#{1,6}\s|\*\*|__|\]\(|`/.test(preview.description)) {
      add("warn", "Description contains Markdown symbols (#, **, links) - they show up as-is in previews.");
    }
    if (preview.description.length > 200) {
      add("info", `Description is ${preview.description.length} characters - most apps cut it around 150-200.`);
    }
  }

  if (!preview.image) {
    add("error", "No og:image - the link will be shared without a picture.");
  } else {
    if (!/^https?:\/\//i.test(preview.rawImage)) {
      add("warn", "og:image is a relative URL - use a full https:// URL, some apps ignore relative ones.");
    } else if (preview.rawImage.startsWith("http://")) {
      add("warn", "og:image uses http:// - use https://, some apps refuse insecure images.");
    }

    if (!image) {
      add("error", "Could not check the image.");
    } else if (!image.ok) {
      add("error", `Image did not load (${image.error || `HTTP ${image.status}`}) - apps will show no picture.`);
    } else {
      if (image.contentType && !image.contentType.startsWith("image/")) {
        add("error", `Image URL returned "${image.contentType}", not an image.`);
      }
      if (image.bytes > 5 * 1024 * 1024) {
        add("error", `Image is ${formatBytes(image.bytes)} - too big; WhatsApp and iMessage often show no picture. Aim for under 300 KB.`);
      } else if (image.bytes > 600 * 1024) {
        add("warn", `Image is ${formatBytes(image.bytes)} - WhatsApp can skip large images. Aim for under 300 KB.`);
      } else {
        add("ok", `Image size ${formatBytes(image.bytes)} is fine.`);
      }

      if (image.size) {
        const { width, height } = image.size;
        const ratio = width / height;
        if (ratio >= 1.8 && ratio <= 2.0) {
          add("ok", `Image is ${width}x${height} (ratio ${ratio.toFixed(2)}) - the ideal wide shape.`);
        } else if (ratio > 0.9 && ratio < 1.1) {
          add("warn", `Image is square (${width}x${height}) - WhatsApp and iMessage show it whole, but Facebook, LinkedIn and X crop its top and bottom. 1200x630 fits every app.`);
        } else if (ratio < 0.8) {
          add("warn", `Image is very tall (${width}x${height}) - WhatsApp and iMessage crop it to 4:5, and Facebook, LinkedIn and X crop most of it. Use 1200x630.`);
        } else if (ratio <= 0.9) {
          add("warn", `Image is tall (${width}x${height}) - WhatsApp and iMessage show it whole, but Facebook, LinkedIn and X crop a large part of it. Use 1200x630.`);
        } else {
          add("info", `Image is ${width}x${height} (ratio ${ratio.toFixed(2)}) - 1200x630 (1.91:1) fits every app best.`);
        }
        if (width < 600) {
          add("warn", `Image is only ${width}px wide - it may look blurry. Use at least 1200x630.`);
        }
      }
    }

    if (!meta["og:image:width"] || !meta["og:image:height"]) {
      add("info", "og:image:width / og:image:height not set - optional, but helps apps render the first share faster.");
    }
  }

  if (!meta["twitter:card"]) {
    add("info", 'No twitter:card - X shows a small preview. Use "summary_large_image" for a big image.');
  }

  return checks;
}

async function inspect(input, config) {
  const pageUrl = resolvePageUrl(input, config);
  const started = Date.now();

  let res;
  try {
    res = await fetchWithTimeout(pageUrl, PAGE_TIMEOUT_MS, {
      headers: { "User-Agent": BOT_USER_AGENT, Accept: "text/html" },
    });
  } catch (err) {
    return {
      pageUrl,
      error:
        err.name === "AbortError"
          ? "The page took too long to respond."
          : `Could not reach ${pageUrl} - is your local site running? (${err.message})`,
    };
  }

  const html = await res.text();
  const { title, canonical, meta } = readMeta(html);

  const rawImage = meta["og:image"] || meta["og:image:url"] || meta["og:image:secure_url"] || meta["twitter:image"] || null;
  let image = null;
  let imageUrl = null;
  if (rawImage) {
    imageUrl = toLocal(new URL(rawImage, res.url).toString(), config);
    image = await checkImage(imageUrl);
  }

  const shownUrl = meta["og:url"] || canonical || (config.siteUrl ? pageUrl.replace(stripOrigin(config.target), stripOrigin(config.siteUrl)) : pageUrl);

  const result = {
    pageUrl,
    finalUrl: res.url,
    redirected: res.redirected,
    status: res.status,
    ms: Date.now() - started,
    meta,
    preview: {
      title: meta["og:title"] || meta["twitter:title"] || title,
      description: meta["og:description"] || meta["twitter:description"] || meta.description || null,
      rawImage,
      image: imageUrl,
      siteName: meta["og:site_name"] || null,
      url: shownUrl,
      domain: (() => {
        try {
          return new URL(shownUrl).hostname.replace(/^www\./, "");
        } catch {
          return "";
        }
      })(),
      twitterCard: meta["twitter:card"] || null,
    },
    image,
  };
  result.checks = buildChecks(result);
  return result;
}

module.exports = { inspect, resolvePageUrl, BOT_USER_AGENT };
