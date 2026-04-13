# Lift — Personal Weightlifting Tracker

Personal Olympic weightlifting tracker built on Vite + Vanilla JS, Supabase, and Cloudflare Pages.

## Stack

- **Frontend**: Vite, Vanilla JS ES modules
- **Database**: Supabase (Postgres)
- **Hosting**: Cloudflare Pages
- **Design**: Playfair Display + Nunito, off-white/beige palette

## First-time setup

### 1. Run the Supabase schema

Paste `schema.sql` into the Supabase SQL Editor and run it. This creates all tables, triggers, and indexes.

### 2. Set environment variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

In Cloudflare Pages → Settings → Environment Variables, add the same two keys.

### 3. Install and run locally

```bash
npm install
npm run dev
```

### 4. Deploy

```bash
git add .
git commit -m "Initial deployment"
git push origin main
```

Cloudflare Pages auto-deploys on push to `main`.

### 5. Install on iPhone

Open the deployed URL in Safari → Share → Add to Home Screen.

## Module overview

| Module | Purpose |
|---|---|
| `src/modules/units.js` | All unit conversion (kg ↔ lbs), plate math rounding |
| `src/modules/userData.js` | All Supabase read/write operations |
| `src/modules/program.js` | 52-week periodisation plan, intensity calculations |
| `src/modules/adaptation.js` | RPE analysis, suggestion engine |
| `src/modules/milestones.js` | Goal projection, rate of progress calculations |
| `src/modules/ui.js` | Router, bottom sheet, toast, navigation |

## Pages

| Page | Route trigger |
|---|---|
| Today | Default — shows today's workout |
| Log | Session history, expandable set detail |
| Progress | Trend charts, PRs, milestone projections |
| Program | Week overview, adaptation suggestions |
| Settings | Unit toggle, baselines, program start date |

## Athlete baseline

Current: Snatch 60kg · Clean & Jerk 60kg · Back squat 93kg (205 lbs)  
Targets: Snatch 90kg · Clean & Jerk 110kg · Back squat 150kg

## License

Private — personal use only.
