"use strict";

const ENTITIES = {
  "&amp;": "&",
  "&quot;": '"',
  "&#x27;": "'",
  "&#39;": "'",
  "&lt;": "<",
  "&gt;": ">",
};

function decode(value) {
  return value.replace(/&(amp|quot|#x27|#39|lt|gt);/g, (m) => ENTITIES[m] || m);
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  if (!match) return null;
  return decode(match[2] ?? match[3] ?? "");
}

/** Reads <title>, <meta> and <link rel="canonical"> out of a page's HTML. */
function readMeta(html) {
  const head = html.split(/<\/head>/i)[0] || html;
  const meta = {};

  for (const tag of head.match(/<meta\b[^>]*>/gi) || []) {
    const key = (attr(tag, "property") || attr(tag, "name") || "").toLowerCase();
    const content = attr(tag, "content");
    if (key && content != null && meta[key] == null) meta[key] = content;
  }

  const title = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const canonical = (head.match(/<link\b[^>]*>/gi) || []).find(
    (tag) => (attr(tag, "rel") || "").toLowerCase() === "canonical",
  );

  return {
    title: title ? decode(title[1].trim()) : null,
    canonical: canonical ? attr(canonical, "href") : null,
    meta,
  };
}

module.exports = { readMeta };
