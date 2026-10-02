# localhost-og-preview

**Test Open Graph tags and link previews on localhost before you deploy.** See exactly how your links look when shared on **WhatsApp, iMessage, Facebook, LinkedIn and X (Twitter)**, check your `og:image`, and catch broken previews while you're still developing.

WhatsApp, Facebook's Sharing Debugger and the other link-preview tools can't reach `localhost`, so normally you can't test Open Graph until the site is live. `localhost-og-preview` reads your local pages the same way their link-preview bots do and shows you the result.

- **Zero dependencies.** Plain Node.js 18+, nothing to install.
- **Works with any stack:** Next.js, React, Vue, Svelte, Nuxt, Astro, Django, Rails, Laravel or plain HTML. If it serves HTML on a URL, it works.
- **Link preview mock-ups** for WhatsApp (received, sent and small thumbnail), iMessage, Facebook / LinkedIn and X.
- **Open Graph checks:** missing `og:title` / `og:description` / `og:image`, images that are too big, the wrong shape or don't load, relative image URLs, Markdown in descriptions, missing `twitter:card`, pages returning 404.

## Quick start

1. Start your own site as usual (for example on `http://localhost:3000`).
2. Clone this repo and run it:

   ```bash
   git clone https://github.com/marajanim/localhost-og-preview.git
   cd localhost-og-preview
   node bin/localhost-og-preview.js --target http://localhost:3000 --site-url https://yoursite.com --open
   ```

3. The tester opens at **http://localhost:4545**. Type a page path (like `/blog/my-post`) and click **Check preview**.

You can type any of these into the box:

| You type | It checks |
|---|---|
| `/about` | `http://localhost:3000/about` |
| `http://localhost:3000/about` | that page |
| `https://yoursite.com/about` | `http://localhost:3000/about` (when `--site-url` is set) |

## Options

| Option | Default | What it does |
|---|---|---|
| `--target <url>` | `http://localhost:3000` | Your local site. |
| `--site-url <url>` | *(none)* | Your live site. Pages usually point `og:image` at the live domain (e.g. `https://yoursite.com/og.png`), which doesn't have your new image yet. With this set, those image URLs are loaded from `--target` instead. |
| `--port <number>` | `4545` | Port the tester runs on. |
| `--open` | off | Opens the tester in your browser. |

The same settings can come from environment variables: `OG_PREVIEW_TARGET`, `OG_PREVIEW_SITE_URL`, `OG_PREVIEW_PORT`.

You can also use the npm script:

```bash
npm start -- --target http://localhost:5173 --site-url https://yoursite.com
```

## Install it as a command (optional)

From the cloned folder:

```bash
npm link
```

Then run it from anywhere:

```bash
localhost-og-preview --target http://localhost:3000 --site-url https://yoursite.com --open
```

## What the checks mean

| Check | Why it matters |
|---|---|
| **No og:image** | The link is shared without a picture. |
| **Image did not load** | The URL is wrong, private, or the server is down - apps show no picture. |
| **Image over 600 KB / 5 MB** | WhatsApp in particular skips large images. Aim for under 300 KB. |
| **Square or tall image** | WhatsApp and iMessage show the image in its own shape (up to 4:5 tall), but Facebook, LinkedIn and X crop it to a wide 1.91:1 strip. Use **1200 x 630** to look right everywhere. |
| **Image narrower than 600px** | Looks blurry in large previews. |
| **Relative og:image URL** | Use a full `https://` URL - some apps ignore relative ones. |
| **Markdown in the description** | `##`, `**` and link syntax show up as plain symbols in previews. |
| **No twitter:card** | X shows a small summary card. Use `summary_large_image` for a big image. |
| **Page returned 404** | Apps will preview an error page. |

## FAQ

**How do I test Open Graph tags on localhost?**
Run `localhost-og-preview` next to your dev server and enter a page path. It fetches the page like a link-preview bot, reads the Open Graph and Twitter Card tags, and shows how the link will look in each app.

**Why can't I use the Facebook Sharing Debugger on localhost?**
Facebook's debugger (and WhatsApp, LinkedIn, X) fetch your page from their own servers, which can't reach your computer. This tool runs on your machine, so it can.

**Why is my WhatsApp link preview not showing the image?**
The most common causes are an `og:image` that is too large (several MB), an image URL that isn't public or doesn't load, or a relative image URL. The tester flags all three.

**What size should my og:image be?**
**1200 x 630 pixels** (1.91:1), ideally under 300 KB. That shape works in every app; square and tall images get cropped on Facebook, LinkedIn and X.

**Does it work with Next.js `generateMetadata` / `opengraph-image`?**
Yes - it reads the final HTML your dev server returns, so it works with any way of generating meta tags.

## Good to know

- **The mock-ups are close, not exact.** Each app changes its layout from time to time; use this to catch problems early, then do a final check on the live site.
- **Real apps cache previews.** After you deploy a fix, add something like `?v=2` to the link, or use Facebook's Sharing Debugger / LinkedIn's Post Inspector to refresh their cache.
- **Local only.** The tester listens on `127.0.0.1`, so other machines on your network can't use it to fetch URLs.
- Pages are requested with a link-preview bot user agent (`facebookexternalhit` / `WhatsApp`), the same way the real apps ask.

## Project layout

```
bin/localhost-og-preview.js   command-line entry point
src/server.js                 tiny local web server
src/inspect.js                fetches a page, reads its tags, runs the checks
src/meta.js                   reads <meta> tags from HTML
src/imageSize.js              reads PNG / JPEG / GIF / WebP dimensions without libraries
src/ui.html                   the tester page
```

## License

MIT
