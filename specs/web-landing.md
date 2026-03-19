# Web Landing Page

## Related Documentation

- [Architecture](../docs/architecture.md) — web component section (SSR, standalone, no API dependency)
- [AGENTS.md](../AGENTS.md) — code quality rules, file size limits
- [Brief](../docs/cli/brief.md) — product capabilities (what to market)
- [Schema](../docs/cli/schema.md) — schema features to highlight

## Overview

SSR landing page for the Wireframes platform. Product description, features, pricing, and links to the admin editor. Standalone — no API dependency for rendering.

## Monorepo Location

```
web/
  src/
    pages/
      index.astro      Home page
      pricing.astro    Pricing page (if needed)
    components/        Reusable Astro/React components
    layouts/
      Base.astro       Base HTML layout
    styles/
      global.css       Global styles
    content/           Content files (if using Astro content collections)
  public/
    assets/            Static assets (images, icons)
  package.json
  tsconfig.json
  astro.config.mjs
```

Package name: `@wireframes/web`. Framework: Astro (SSR). Language: TypeScript.

---

## Task 23: Scaffold Astro SSR landing page with product content

### Requirements

**Framework:**
- Astro for SSR (lightweight, fast, good for content-heavy pages)
- Add to pnpm workspace

**Pages:**

1. **Home page (`/`)**:
   - Hero section: headline, subheadline, CTA button ("Get Started" → links to admin)
   - Product description: what Wireframes is and why
   - Features grid: key capabilities
     - Declarative YAML specs
     - Template + page system
     - Component reuse
     - Data binding with datasets
     - Interactive prototypes (navigation, overlays, state)
     - Two rendering modes (line / card)
     - Multi-device support (web, tablet, mobile)
     - CLI tooling
     - Online editor with AI chat
     - Preview sharing (public, password, SSO)
   - How it works section: 3-step flow (Define → Preview → Share)
   - Screenshots / demo wireframe (use wf build output as demo)
   - Footer with links

2. **Pricing page (`/pricing`)** (if needed, otherwise section on home):
   - Free tier info
   - Placeholder for future plans

**Design:**
- Clean, modern, professional design
- Responsive (mobile-first)
- Light theme
- No wireframe aesthetic — this is a marketing page, not a wireframe
- Use system fonts (no custom font loading)
- Accessible: contrast ratios, focus states, semantic HTML

**SEO:**
- Meta tags (title, description, og:image)
- Semantic HTML (header, main, footer, nav, section)
- Sitemap generation (Astro built-in)

**Links:**
- "Get Started" / "Sign Up" → admin app URL (configurable via env var `PUBLIC_ADMIN_URL`)
- "Documentation" → docs (if public docs exist, otherwise placeholder)
- "CLI" → npm package page (placeholder)

**Performance:**
- No JavaScript required for the landing page (Astro islands only if needed)
- Images optimized (Astro image integration)
- Fast initial load (< 1s on 3G)

### Patterns

- Static generation for the landing page (no server-side data fetching)
- Content in Astro components, not external CMS
- CSS in `<style>` blocks or global CSS file
- No heavy CSS framework (Astro's built-in scoping is sufficient)

### Acceptance Criteria

- `pnpm --filter @wireframes/web dev` starts the Astro dev server
- Home page renders with all sections
- Page is responsive (looks good on mobile, tablet, desktop)
- All links work (CTA, footer links)
- Lighthouse score: Performance > 90, Accessibility > 90
- No JavaScript shipped to client (pure SSR/SSG)
- SEO meta tags are present
