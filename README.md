# MY A.I. — Sabathil720

**Intended public URL:** https://melacquaah00.github.io/my-ai-site/

Site files are on `main`. GitHub Pages is **not enabled yet** — that is a one-time admin setting the Actions `GITHUB_TOKEN` cannot flip (`Resource not accessible by integration`).

## Enable Pages (required once)

1. Open https://github.com/melacquaah00/my-ai-site/settings/pages
2. Under **Build and deployment** → **Source**, choose either:
   - **GitHub Actions** (preferred — workflow `.github/workflows/pages.yml` is ready), or
   - **Deploy from a branch** → Branch **main** / folder **/ (root)**
3. Save. After the next successful deploy (or immediately for branch source), the URL above should return HTTP 200.

Then re-run the failed workflow if needed: Actions → Deploy GitHub Pages → Re-run.

## What’s in the repo

- `index.html` + `styles.css` — brand page
- `hero-a.js` + `hero-b.js` — compressed hero photo (base64; MCP cannot push binary JPG)
- `hero.svg` — neon fallback if JS is blocked
- `.nojekyll` — skip Jekyll for branch deploy
- `.github/workflows/pages.yml` — Pages deploy workflow (`enablement: true` attempted; admin enable still required)

## Preview locally

```bash
python3 -m http.server 8765
```

Then visit http://localhost:8765
