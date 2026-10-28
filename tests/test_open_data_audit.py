import unittest
from datetime import date
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/"scripts"))
from open_data_audit import calculate_last_ten, full_time_score

class AuditTests(unittest.TestCase):
    def test_goal_score_object_or_array(self):
        self.assertEqual(full_time_score({"ht":[0,0],"ft":[2,0]}), [2,0])
        self.assertEqual(full_time_score([0,0]), [0,0])
        self.assertIsNone(full_time_score({"ht":[1,0]}))
        self.assertIsNone(full_time_score(None))
        self.assertIsNone(full_time_score([True,0]))

    def test_last_ten_ignores_missing_and_future_games(self):
        matches = [{"date":f"2026-09-{i:02d}","team1":"Alpha","team2":"Beta", "score":{"ft":[1,0]}} for i in range(1,13)]
        matches += [{"date":"2026-09-13","team1":"Alpha","team2":"Beta"},
                    {"date":"2026-12-30","team1":"Alpha","team2":"Beta","score":[8,0]}]
        row = next(t for t in calculate_last_ten(matches, 'PL', date(2026,10,28)) if t['club']=='Alpha')
        self.assertEqual(row['played'],10)
        self.assertEqual(row['points'],30)
        self.assertEqual(row['goalsFor'],10)
        self.assertEqual(row['goalsAgainst'],0)

    def test_invalid_data_raises(self):
        with self.assertRaises(ValueError):
            calculate_last_ten([{"team1":"Alpha","team2":"Beta","date":"nonsense"}], 'PL',date(2026,10,28))

if __name__=='__main__':
    unittest.main()
