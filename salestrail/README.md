# SalesTrail

A Next.js (App Router) app for discovering and planning local yard, estate, and garage sales.

## Design System & Theming

SalesTrail uses a small, consistent theme powered by CSS variables and utilities.

- Theme variables (light/dark) are defined in `app/globals.css`:
  - `--primary`, `--primary-hover`, `--accent`, `--foreground`, `--background`
  - `--muted`, `--muted-foreground`, `--card`, `--border`, `--gradient-from`, `--gradient-to`
- Reusable utilities:
  - Buttons: `btn`, `btn-primary`, `btn-outline`
  - Inputs: `input`
  - Cards: `card`
  - Text: `text-muted`
  - Badges: `badge`, `badge-dot`

Example usage:

```tsx
<button className="btn btn-primary">Search</button>
<input className="input" placeholder="ZIP" />
<div className="card">Content</div>
<span className="badge"><span className="badge-dot" /> ZIP 06103</span>
```

## Development

- Install: `npm i`
- Run dev: `npm run dev`
- Lint: `npm run lint`

## Deploy

- Configure environment variables as needed (see `/app/api` and `/lib`).
- Deploy via Vercel with root directory set to `salestrail`.
