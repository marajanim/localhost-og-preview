"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { inspect } = require("./inspect");

const UI_FILE = path.join(__dirname, "ui.html");

function send(res, status, type, body) {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

function startServer(config) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/") {
      const html = fs
        .readFileSync(UI_FILE, "utf8")
        .replace("__CONFIG__", JSON.stringify({ target: config.target, siteUrl: config.siteUrl }));
      return send(res, 200, "text/html; charset=utf-8", html);
    }

    if (url.pathname === "/api/inspect") {
      try {
        const result = await inspect(url.searchParams.get("url") || "/", config);
        return send(res, 200, "application/json", JSON.stringify(result));
      } catch (err) {
        return send(res, 500, "application/json", JSON.stringify({ error: err.message }));
      }
    }

    return send(res, 404, "text/plain", "Not found");
  });

  // Localhost only: the tester fetches URLs for you, so it shouldn't be
  // reachable from other machines on the network.
  server.listen(config.port, "127.0.0.1", () => {
    const address = `http://localhost:${config.port}`;
    console.log("");
    console.log("  localhost-og-preview");
    console.log(`  Open:      ${address}`);
    console.log(`  Checking:  ${config.target}`);
    console.log(`  Live site: ${config.siteUrl || "(not set - use --site-url to map live image URLs to local)"}`);
    console.log("");
    if (config.open) openBrowser(address);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${config.port} is already in use. Try --port ${config.port + 1}`);
    } else {
      console.error(err.message);
    }
    process.exit(1);
  });

  return server;
}

function openBrowser(address) {
  const { exec } = require("node:child_process");
  const command =
    process.platform === "win32"
      ? `start "" "${address}"`
      : process.platform === "darwin"
        ? `open "${address}"`
        : `xdg-open "${address}"`;
  exec(command, () => {});
}

module.exports = { startServer };
