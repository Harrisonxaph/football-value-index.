# Historical club valuation benchmark (2025/26 archive)

**This is not current 2026/27 squad value data.**

- **Archive snapshot cut-off**: 2026-07-06, recorded in each `asOf`.
- **Last player valuation found anywhere in the original source**: 2026-06-12. This is NOT the individual valuation date of every club or player.
- **Individual club valuation dates**: not published in the source club totals. JSON fields `dateBasis` and `source` explicitly say so.
- **Original source**: https://github.com/dcaribou/transfermarkt-datasets and https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/clubs.csv.gz .
- **Currency**: `clubs.total_market_value` is in GBP millions. Converted to EUR millions with 12 June 2026 ECB reference rate **EUR 1 = GBP 0.86305**: https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX:C/2026/02847 .
- **Coverage rules**: require a club profile last recorded in at least 2025/26, a unique or high-confidence name match, and a positive archived value; missing/promoted/ambiguous/old clubs remain blank, rather than generating false values.
- **Audit**: `data/historical-valuation-audit.json` records the source club ID, original GBP value, FX-converted EUR amount, name match method and exclusions.
- **Update mechanism**: GitHub Action `import-historical-valuations.yml` runs the Python standard-library importer on this development branch. It commits the generated snapshot JSON only if at least 50 clubs are safely matched. It does not read any private API keys or scrape Transfermarkt directly.

Comparisons between 2026/27 results and these archived 2025/26 squad valuations can be misleading following transfers or promotion. The archive is also known to contain some stale player valuations, so this represents a **provisional historical financial benchmark**, not verified current squads.

Do not merge until the audit and preview have been reviewed.