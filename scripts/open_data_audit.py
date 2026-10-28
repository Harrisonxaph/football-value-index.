#!/usr/bin/env python3
"""Download five public-domain OpenFootball league feeds, validate and audit them.

Run: python scripts/open_data_audit.py --output open-data-audit.json
No API keys and no third-party Python packages. The site fetches the same feeds
server-side, independently; this audit runs daily to test data integrity.
"""
import argparse
from datetime import datetime, timezone, date
import json
from pathlib import Path
from urllib.request import Request, urlopen

LEAGUES = {"PL": "en.1", "PD": "es.1", "SA": "it.1", "BL1": "de.1", "FL1": "fr.1"}
ROOT = "https://raw.githubusercontent.com/openfootball/football.json/master"


def full_time_score(score):
    if isinstance(score, dict):
        score = score.get("ft")
    if (isinstance(score, list) and len(score) == 2
        and all(type(n) is int and 0 <= n <= 40 for n in score)):
        return score
    return None


def calculate_last_ten(matches, league, today):
    """Build rolling 10-match totals for every club in one league."""
    by_team = {}
    for index, match in enumerate(matches, 1):
        home, away, day = (match.get(k) for k in ("team1", "team2", "date"))
        if not all(isinstance(v, str) and v.strip() for v in (home, away, day)):
            raise ValueError(f"{league}: invalid fixture row {index}")
        try:
            played_on = date.fromisoformat(day)
        except ValueError as e:
            raise ValueError(f"{league}: invalid match date at row {index}") from e
        for team in (home, away):
            by_team.setdefault(team, [])
        score = full_time_score(match.get("score")) if played_on <= today else None
        if score is None:
            continue
        h_goals, a_goals = score
        for team, gf, ga in ((home, h_goals, a_goals), (away, a_goals, h_goals)):
            by_team[team].append({"date": day, "gf": gf, "ga": ga,
                                  "points": 3 if gf > ga else 1 if gf == ga else 0})
    totals = []
    for team, results in by_team.items():
        last_ten = sorted(results, key=lambda item: item["date"], reverse=True)[:10]
        gf = sum(r["gf"] for r in last_ten)
        ga = sum(r["ga"] for r in last_ten)
        totals.append({"clubId": f"{league}:{team}", "club": team,
                       "league": league, "played": len(last_ten),
                       "points": sum(r["points"] for r in last_ten),
                       "goalsFor": gf, "goalsAgainst": ga, "goalDifference": gf-ga,
                       "latestResult": max((r["date"] for r in results), default=None)})
    return sorted(totals, key=lambda t: (-t["points"], -t["goalDifference"], t["club"]))


def audit(season, today=None, fixture_dir=None):
    today = today or datetime.now(timezone.utc).date()
    report = {"provider": "https://github.com/openfootball/football.json",
              "retrievedAt": datetime.now(timezone.utc).isoformat(),
              "asOf": today.isoformat(), "season": f"{season}-{(season+1)%100:02d}",
              "leagues": {}, "clubs": []}
    for league, filecode in LEAGUES.items():
        filename = f"{filecode}.json"
        url = f"{ROOT}/{season}-{(season+1)%100:02d}/{filename}"
        if fixture_dir:
            data = json.loads((Path(fixture_dir)/filename).read_text(encoding="utf-8"))
        else:
            request = Request(url, headers={"User-Agent": "football-value-index/1.0 (open-data-audit)"})
            with urlopen(request, timeout=25) as response:
                data = json.load(response)
        if not isinstance(data, dict) or not isinstance(data.get("matches"), list):
            raise ValueError(f"{league}: matches is not a list")
        matches = data["matches"]
        teams = calculate_last_ten(matches, league, today)
        completed_dates = sorted(t["latestResult"] for t in teams if t["latestResult"])
        past_without_score = sum(1 for m in matches if m["date"] < today.isoformat()
                                 and full_time_score(m.get("score")) is None)
        report["leagues"][league] = {"sourceUrl": url, "teams": len(teams),
            "lastScoredMatch": completed_dates[-1] if completed_dates else None,
            "pastFixturesWithoutScores": past_without_score}
        report["clubs"].extend(teams)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--season", type=int, default=2026)
    parser.add_argument("--output", default="open-data-audit.json")
    parser.add_argument("--fixture-dir", help="For offline validation/test fixtures")
    args = parser.parse_args()
    result = audit(args.season, fixture_dir=args.fixture_dir)
    Path(args.output).write_text(json.dumps(result, indent=2, ensure_ascii=False)+"\n", encoding="utf-8")
    for league, details in result["leagues"].items():
        print(f"{league}: {details['teams']} clubs, last recorded score: {details['lastScoredMatch']}, missing past scores: {details['pastFixturesWithoutScores']}")
    print(f"Wrote {args.output}; figures are never described as real-time scores.")

if __name__ == "__main__":
    main()
