# Historical club squad valuations — 2025/26 archived benchmark

**This is a historical reference, not the squads or values of October 2026.** The dashboard compares 2026/27 on-pitch results with older 2025/26 market value estimates, so summer transfers and promoted clubs affect comparability.

## Dates and method

- **Archive snapshot date:** 6 July 2026 (`asOf: "2026-07-06"` in the JSON).
- **Latest player valuation anywhere in the archive:** 12 June 2026.
- **True valuation date for each individual player/club:** not reliably available from the `players.csv.gz` snapshot. The archive date is not an individual assessment date.
- **Source:** [dcaribou/transfermarkt-datasets](https://github.com/dcaribou/transfermarkt-datasets); its [players.csv.gz](https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/players.csv.gz) and [clubs.csv.gz](https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/clubs.csv.gz).
- **Values:** For each matched club, sum `players.market_value_in_eur` for players with `current_club_id` matching the club and `last_season >= 2025`. Convert EUR to millions and round to two decimals. **No currency conversion** is needed.
- **Eligibility:** a matching historical club with last season >=2025, at least 10 players with positive valuations and an unambiguous club-name match. The import script also guards against implausible totals.

This **player-value sum is an approximation**, not an independently published club market valuation. A `current_club_id` in an archived data extract is not guaranteed to match the October 2026 squad.

## Provenance and gaps

Every JSON entry includes:
- `valueEurM`: aggregated archived player values, €m.
- `asOf`: archive snapshot cut-off **2026-07-06**, not individual valuation date.
- `dateBasis`: explicitly states that individual club valuation dates are unavailable.
- `source`: repository, original CSV tables, source club ID, number of qualifying player records, and snapshot date.

The import presently covers **76 of 96 clubs**. Ten lack a high-confidence match, and ten have source club profiles older than 2025/26. They remain unvalued rather than receiving invented figures. See `data/historical-valuation-audit.json` for the complete included/excluded register and original player-counts.

## Updating and publication

The workflow `.github/workflows/import-historical-valuations.yml` runs the zero-dependency importer on the feature branch. It rejects too few validated clubs, checks JSON, and commits the generated values to that development branch only. It does not scrape Transfermarkt or need any secret token. The dataset is a fixed archive; rerunning it will not update values to the current season.

Review the PR and checks before merging into `main`. Once merged, Vercel should build a new production deployment (depending on its Git integration). Value-based rankings remain **provisional**, and stale OpenFootball match results still need fixing separately.

The public availability of third-party football data does not automatically grant all downstream redistribution rights. Keep the source attribution and review the dataset and original provider terms before commercial use.
