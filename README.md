# Football Value Index — open-data BI dashboard

A responsive 2026/27 dashboard comparing **the last ten completed domestic league matches** for all clubs in England's Premier League, Spain's La Liga, Italy's Serie A, Germany's Bundesliga and France's Ligue 1.

**Status: deployed to Vercel; historical squad-value benchmark added in feature branch for review.** Public-domain football match data requires **no API key**. The web app retrieves real match feeds from GitHub when opened, with a one-hour cache. The upstream 2026/27 result files may lag by weeks and are not guaranteed to be comprehensive; per-league freshness warnings expose that. **The historical benchmark currently populates 76/96 clubs with dated archival estimates. These are NOT 2026/27 valuations.** There are no fictional football results or valuations in the live dashboard.

## Stack and data flow

```text
OpenFootball 2026/27 JSON (five public files, updated daily if upstream changes)
    |                                        |
    | (Next.js fetches on server)            | (Python independently audits daily)
    v                                        v
Next.js /api/dashboard                 GitHub Actions daily audit
    + data/valuations.json                  + downloadable audit report
    |
    v
Last-ten statistics and value-efficiency rankings
    |
    v
React mobile-first web dashboard on Vercel (after you deploy)
```

### What the dashboard provides

- Filter one of five leagues or all clubs and search any team.
- Rank by last-ten points, goals for, goals against, goal difference, estimated squad market value, points per €100m, or an adjusted Value Index.
- Scatter chart of **squad market value versus points**; click a club to see individual recent match results and form.
- Full league data provenance and missing-results warnings; no assumption that an unscored past match was 0–0.
- Download JSON template with exactly matching club IDs for entering your valuation figures, including source and `asOf` date.
- Mobile-friendly UI, no authentication, API token, scraping, database or paid services required.

## How to run and publish (GitHub + Vercel, iPhone/iPad friendly)

1. Download the ZIP bundle, unzip it using the Files app or a computer, and create a new GitHub repository called `football-value-index` on [GitHub](https://github.com/new). **Do not put this project into an unrelated repository.**
2. Create a branch called `feature/open-football-dashboard` before uploading or applying changes. Use GitHub web uploads or Codex to add *all* project files (including the `.github` directory) at the repository root. The contents of the ZIP belong at the top level, not in a nested folder.
3. Open a pull request into `main` but **do not merge yet**. The included GitHub Actions workflow runs Python checks, audits the OpenFootball feeds, and runs the UI calculation tests/build. Read the PR checks and reports.
4. Once tests are green, sign in to [Vercel](https://vercel.com/new), import `football-value-index`, select Next.js and use the default root directory. **Test the feature branch as a preview**. Nothing requires a key or secret. Only merge and publish production when you're happy with the values and data quality.
5. The app will show actual completed results from OpenFootball. The historical benchmark currently covers **76 of 96** clubs. Value Index and points per €100m appear only for clubs with eligible historical valuations. Review the provenance/audit in `docs/historical-valuations.md` before merging the feature branch.
6. The historical values are archived 2025/26 player-value sums in **€ millions**. Their `asOf` field marks the **6 July 2026 archive snapshot**, not the date each individual club was assessed. Never label these as current 2026/27 values.

To run locally on a computer with Node.js 22+:

```bash
npm install
npm run dev
# Open http://localhost:3000
npm test
npm run build
```

Optional independent Python checks (Python 3.10+ and standard library only):

```bash
python -m unittest discover -s tests -p 'test_*.py' -v
python scripts/open_data_audit.py --output open-data-audit.json
```

## Valuations JSON file

`data/valuations.json` now includes 76 historical squad-value estimates derived from the archived player table. See `docs/historical-valuations.md` and `data/historical-valuation-audit.json`. Below is a **format example, not a reported real value**:

```json
{
  "PL:Arsenal FC": {
    "valueEurM": 250,
    "asOf": "2026-06-12",
    "source": "Example source reference; replace with your verified URL"
  }
}
```

The historical importer uses `players.csv.gz` and `clubs.csv.gz` from [dcaribou/transfermarkt-datasets](https://github.com/dcaribou/transfermarkt-datasets), matching club IDs to OpenFootball and summing positive player market values from 2025/26 entries. The archive's 2026/27 squads are missing, and the archive date is not an individual valuation date. **No direct Transfermarkt scraping is used.** Missing or mismatched clubs stay blank.

## Metric definitions

- **Played:** up to the latest ten completed domestic league matches in the 2026/27 season. All five league sources include future unplayed games which are excluded from calculations.
- **Points:** 3 for win, 1 for draw, 0 for loss; max 30 for 10 matches.
- **GF/GA/GD:** goals scored/conceded/difference in the same last-ten window.
- **Raw efficiency:** `points × 100 / total squad value in €m` = points per €100m; a club with €20m squad value can dominate this ratio even with average results.
- **Adjusted Value Index:** `100 × (0.75 × points / (3 × played) + 0.25 × clamp(0.5 + GD / played / 6, 0, 1)) × sqrt(median value of clubs with valuations in the same league / club value)`. This is a transparent **heuristic**, not an established football performance metric; league medians are incomplete until squad valuations are largely populated.
- **Missing values:** shown as `—` and excluded from efficiency rankings, not treated as zero.
- **Provisional:** `*` means fewer than ten completed fixtures are available; such teams should not be compared on aggregate points without checking sample size.

## Automation

`.github/workflows/open-data-audit.yml` runs on push, PR, manual trigger and daily at 07:17 UTC. On its daily schedule it:

- Checks data calculation invariants using Python's built-in `unittest`.
- Fetches each public OpenFootball file and independently calculates club results.
- Attaches a downloadable `open-data-audit.json` artifact showing the latest scored match and past unscored fixtures for every league. The artifact is retained for 7 days.

The workflow has **read-only repository permissions**, uses **no secrets** and **never commits to main or deploys anything**. Browser-side check is hourly, while the server caches for an hour. GitHub Actions auditing does not make the upstream match results more recent.

## Known limitations / what to improve next

1. **Source freshness:** OpenFootball regenerates JSON daily but its upstream human-maintained source does not automatically acquire every result. In the public 2026/27 English data inspected on 28 October 2026, October fixtures were missing full-time scores. The dashboard explicitly flags staleness. If accurate near-live results become essential, choose a licensed score provider and swap `lib/providers.ts`.
2. **Valuation completeness:** the free public match feed contains no current squad values. You need a dated dataset and club-name matching to generate fully populated value-based rankings. All comparisons should use the same valuation date and currency.
3. **Cross-league strength:** a point against an elite opponent is not equivalent to one against a relegation candidate. Future version: opponent-strength adjusted expected points.
4. **Time window:** when the season starts, teams have played fewer than ten games; this version does not silently mix in the previous season. Historical comparisons can be added explicitly.
5. **Data reconciliation:** if upstream club naming changes, `PL:Club Name` valuation keys may require manual remapping. See the downloaded valuation template for the exact supported keys.
6. **Build verification:** the bundled calculation and Python unit tests have run locally. A full Next.js deployment build requires downloading npm dependencies and must be checked in GitHub Actions / Vercel preview.

## Key files

| Path | Purpose |
|---|---|
| `lib/providers.ts` | Fetch and validate OpenFootball result data without keys. |
| `lib/metrics.ts` | Pure club statistics and Value Index calculations. |
| `app/api/dashboard/route.ts` | Combines live open-data fetches with dated valuations and freshness metadata. |
| `app/page.tsx` | Mobile dashboard, filters, scatter plot, rankings, team drill-downs, template export. |
| `app/globals.css` | Mobile and desktop layout and visual theme. |
| `data/valuations.json` | Historical market-value estimates, 76/96 clubs, with dated snapshot and source. |
| `scripts/open_data_audit.py` | Python independent analysis and integrity report. |
| `tests/` | Tests for result parsing, points, last-ten windows, and value calculations. |
| `.github/workflows/open-data-audit.yml` | Daily, PR and push automation, read-only and no secrets. |

**Data source:** [OpenFootball football.json](https://github.com/openfootball/football.json) (public-domain JSON with daily rebuilds conditional on source updates). **Historic valuation option:** [dcaribou/transfermarkt-datasets](https://github.com/dcaribou/transfermarkt-datasets) (paused July 2026). Check sources and their reuse conditions before publishing derived market values.


## Form trend charts and peer comparison

The **Form vs the mean** panel charts the selected club's rolling **points per match, goals scored, goals conceded or goal difference** alongside the mean of its domestic league and all five major European leagues. Tap a completed-match date on mobile to inspect values, sample sizes, and the club's difference from its league.

- **Real match dates, not an artificial weekly series.** The dashboard plots up to the club's ten most recent completed fixtures; an observation uses up to five **recorded completed league matches** up to that date. Three matches are required for a team to qualify.
- **Peer league mean:** the unweighted average of qualifying clubs' rolling form *on that date*, including the selected club. Requires at least three eligible league clubs.
- **Top-five mean:** average of qualifying clubs across the five tracked leagues on that date, each club weighted equally. Requires at least five eligible clubs. Means are not normalized for league strength.
- Missing scores never count as draws, but could make the displayed trend incomplete; see the freshness warnings at the top of the dashboard.
- **Not a historical value-index chart:** there is no historical time series of squad valuations in the project. The 2025/26 benchmark remains a fixed historical snapshot.
- **Scatter benchmarks:** vertical and horizontal mean lines, plus a descriptive straight-line regression between squad value and points **per recorded match**. The regression is purely a visual baseline, not a causal relationship or a forecast. Excludes clubs without valuation and teams with fewer than three recorded matches.

Tests live in `tests/trends.test.mjs`; run with `npm test`. The extra trend observations are generated server-side from the same fixture feed as the rest of the dashboard; no extra API keys or packages are required.
