#!/usr/bin/env python3
"""Import older club totals from a dated Transfermarkt archive; never call them live."""
from __future__ import annotations
import csv, difflib, gzip, io, json, re, unicodedata, urllib.request
from pathlib import Path

RAW = "https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/clubs.csv.gz"
FIXTURES = "https://raw.githubusercontent.com/openfootball/football.json/master/2026-27"
FILES = {"PL":"en.1","PD":"es.1","SA":"it.1","BL1":"de.1","FL1":"fr.1"}
LEAGUES = {"PL":"GB1","PD":"ES1","SA":"IT1","BL1":"L1","FL1":"FR1"}
SNAPSHOT = "2026-07-06"  # Archive cut-off; NOT a verified per-club valuation date.
PLAYER_CUTOFF = "2026-06-12"  # Latest player valuation anywhere in the archive.
EUR_GBP = 0.86305  # ECB 2026-06-12: 1 EUR = 0.86305 GBP.
FX_SOURCE = "https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX:C/2026/02847"
ALIASES = {
 "PL:Brighton & Hove Albion FC": ["brighton and hove albion"],
 "PL:Tottenham Hotspur FC": ["tottenham hotspur"],
 "PL:Manchester United FC": ["manchester united"],
 "PL:Manchester City FC": ["manchester city"],
 "PL:Nottingham Forest FC": ["nottingham forest"],
 "PL:Newcastle United FC": ["newcastle united"],
 "PL:AFC Bournemouth": ["bournemouth"],
 "PD:Club Atlético de Madrid": ["atletico madrid"],
 "PD:RC Celta de Vigo": ["celta vigo"],
 "PD:RCD Espanyol de Barcelona": ["espanyol"],
 "PD:Real Betis Balompié": ["real betis"],
 "PD:Real Sociedad de Fútbol": ["real sociedad"],
 "PD:Real Racing Club de Santander": ["racing santander"],
 "PD:RC Deportivo La Coruña": ["deportivo la coruna"],
 "PD:Rayo Vallecano de Madrid": ["rayo vallecano"],
 "SA:FC Internazionale Milano": ["internazionale", "inter milan"],
 "SA:AC Milan": ["milan"],
 "SA:AS Roma": ["roma"],
 "SA:SSC Napoli": ["napoli"],
 "SA:SS Lazio": ["lazio"],
 "SA:ACF Fiorentina": ["fiorentina"],
 "SA:US Sassuolo Calcio": ["sassuolo"],
 "BL1:FC Bayern München": ["bayern munich", "bayern munchen"],
 "BL1:1. FC Union Berlin": ["union berlin"],
 "BL1:1. FC Köln": ["koln", "cologne"],
 "BL1:1. FSV Mainz 05": ["mainz"],
 "BL1:FC Schalke 04": ["schalke"],
 "BL1:SC Paderborn 07": ["paderborn"],
 "BL1:SV Werder Bremen": ["werder bremen"],
 "BL1:TSG 1899 Hoffenheim": ["hoffenheim"],
 "BL1:Bayer 04 Leverkusen": ["bayer leverkusen"],
 "FL1:Paris Saint-Germain FC": ["paris saint germain", "paris sg"],
 "FL1:Olympique de Marseille": ["marseille"],
 "FL1:Olympique Lyonnais": ["lyon"],
 "FL1:AS Monaco FC": ["monaco"],
 "FL1:Racing Club de Lens": ["lens"],
 "FL1:RC Strasbourg Alsace": ["strasbourg"],
 "FL1:Stade Rennais FC 1901": ["rennes"],
 "FL1:Stade Brestois 29": ["brest"],
}

def normalise(s):
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii","ignore").decode().lower().replace("&","and")
    s = re.sub(r"\b(football|futbol|club|association|calcio|balompie|de|la|el|fc|cf|ac|as|sc|ud|us|ss|afc|cfc|bc|rc|rcd)\b"," ",s)
    return re.sub(r"[^a-z0-9]","",s)

def download(url):
    req = urllib.request.Request(url, headers={"User-Agent":"FootballValueIndex/1.0 (public archive research)"})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read()

def year(value):
    m = re.search(r"20\d{2}", str(value or ""))
    return int(m.group()) if m else 0

def match_club(code, team, clubs):
    options = {normalise(s) for s in [team] + ALIASES.get(f"{code}:{team}", [])}
    matches = [r for r in clubs if normalise(r.get("name")) in options or normalise(r.get("club_code")) in options]
    if len(matches) == 1:
        return matches[0], "exact"
    if len(matches) > 1:
        same_league = [r for r in matches if r.get("domestic_competition_id") == LEAGUES[code]]
        return (same_league[0], "exact+league") if len(same_league)==1 else (None,"ambiguous")
    candidates = []
    for row in clubs:
        ratio = max(difflib.SequenceMatcher(None, x, normalise(row.get("name"))).ratio() for x in options if x)
        if row.get("domestic_competition_id") == LEAGUES[code]:
            ratio += 0.02
        candidates.append((ratio,row))
    candidates.sort(key=lambda item:item[0], reverse=True)
    if candidates and candidates[0][0] >= 0.96 and (len(candidates)==1 or candidates[0][0]-candidates[1][0]>=0.10):
        return candidates[0][1],"unique-high-confidence"
    return None,"no unambiguous match"

def build(clubs, teams):
    result, included, unmatched, excluded = {}, [], [], []
    for code,team in teams:
        club_id = f"{code}:{team}"
        row,method = match_club(code,team,clubs)
        if row is None:
            unmatched.append({"id":club_id,"reason":method})
            continue
        if year(row.get("last_season")) < 2025:
            excluded.append({"id":club_id,"sourceClub":row.get("name"),"last_season":row.get("last_season"),"reason":"historical club profile older than 2025/26"})
            continue
        try:
            value_gbp = float(str(row.get("total_market_value","")).replace(",",""))
        except (TypeError,ValueError):
            value_gbp = 0.0
        if not 0 < value_gbp < 10000:
            excluded.append({"id":club_id,"sourceClub":row.get("name"),"reason":"missing or implausible archive market value"})
            continue
        value_eur = round(value_gbp/EUR_GBP,2)
        result[club_id] = {
          "valueEurM":value_eur,
          "asOf":SNAPSHOT,
          "dateBasis":"archive snapshot; individual club valuation date not supplied",
          "source":f"dcaribou/transfermarkt-datasets clubs.csv.gz, historical 2025/26 club_id={row['club_id']}; archive snapshot {SNAPSHOT} (NOT verified date of club valuation); latest player valuation anywhere in dataset {PLAYER_CUTOFF}; GBP millions converted at ECB 2026-06-12 rate 1 EUR = {EUR_GBP} GBP"
        }
        included.append({"id":club_id,"sourceClubId":row["club_id"],"sourceClub":row.get("name"),"last_season":row.get("last_season"),"match":method,"valueGbpM":value_gbp,"valueEurM":value_eur})
    return dict(sorted(result.items())), {"snapshotDate":SNAPSHOT,"snapshotDateIsIndividualClubValuationDate":False,
        "latestPlayerValuationAnywhere":PLAYER_CUTOFF,"source":RAW,"fxSource":FX_SOURCE,
        "matched":included,"unmatched":unmatched,"excluded":excluded,"tracked":len(teams)}

def main():
    clubs = list(csv.DictReader(io.StringIO(gzip.decompress(download(RAW)).decode("utf-8-sig"))))
    if len(clubs) < 500:
        raise RuntimeError("Unexpectedly few archive club rows; refusing to write.")
    teams = []
    for code,file in FILES.items():
        matches = json.loads(download(f"{FIXTURES}/{file}.json"))["matches"]
        names = sorted({m[k].strip() for m in matches for k in ("team1","team2")})
        teams.extend((code,name) for name in names)
    vals,audit = build(clubs,teams)
    audit["imported"] = len(vals)
    if len(vals) < 50:
        raise RuntimeError(f"Only {len(vals)}/{len(teams)} safe matches. Not overwriting valuations.json. First unmatched: {audit['unmatched'][:8]}")
    Path("data/valuations.json").write_text(json.dumps(vals,indent=2,ensure_ascii=False)+"\n")
    Path("data/historical-valuation-audit.json").write_text(json.dumps(audit,indent=2,ensure_ascii=False)+"\n")
    print(f"Imported {len(vals)}/{len(teams)} dated archive club totals. Unmatched {len(audit['unmatched'])}, excluded {len(audit['excluded'])}.")
    for missed in audit["unmatched"]+audit["excluded"]:
        print("SKIPPED",json.dumps(missed,ensure_ascii=False))

if __name__ == "__main__":
    main()
