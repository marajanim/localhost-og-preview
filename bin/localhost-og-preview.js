#!/usr/bin/env node
"use strict";

const { startServer } = require("../src/server");

const HELP = `
localhost-og-preview - test Open Graph tags and link previews on localhost.

Usage:
  localhost-og-preview [options]

Options:
  --target <url>     Your local site (default: http://localhost:3000)
  --site-url <url>   Your live site, e.g. https://example.com. Image URLs that
                     point at it are loaded from --target instead, so you can
                     test before you deploy.
  --port <number>    Port for the tester (default: 4545)
  --open             Open the tester in your browser
  -h, --help         Show this help

Environment variables (used when the option isn't given):
  OG_PREVIEW_TARGET, OG_PREVIEW_SITE_URL, OG_PREVIEW_PORT

Example:
  localhost-og-preview --target http://localhost:3000 --site-url https://yoursite.com --open
`;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") args.help = true;
    else if (arg === "--open") args.open = true;
    else if (arg.startsWith("--")) {
      const [key, inline] = arg.slice(2).split("=");
      args[key] = inline ?? argv[++i];
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(HELP);
  process.exit(0);
}

const major = Number(process.versions.node.split(".")[0]);
if (major < 18) {
  console.error(`Node.js 18 or newer is required (you have ${process.versions.node}).`);
  process.exit(1);
}

const config = {
  target: (args.target || process.env.OG_PREVIEW_TARGET || "http://localhost:3000").replace(/\/$/, ""),
  siteUrl: (args["site-url"] || process.env.OG_PREVIEW_SITE_URL || "").replace(/\/$/, "") || null,
  port: Number(args.port || process.env.OG_PREVIEW_PORT || 4545),
  open: Boolean(args.open),
};

for (const [name, value] of [["--target", config.target], ["--site-url", config.siteUrl]]) {
  if (value && !/^https?:\/\//i.test(value)) {
    console.error(`${name} must start with http:// or https:// (got "${value}")`);
    process.exit(1);
  }
}

startServer(config);
