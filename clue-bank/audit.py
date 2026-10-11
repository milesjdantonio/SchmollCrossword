# audit.py: in the finished puzzles, how much of each lesson's style each one has (averages per lesson group)
import sys, os, json, re, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cw import *
OUT = r"C:/Users/miles/OneDrive/Documents/Personal Projects/SchmollCrosswordMain/src/main/resources"
G = json.load(open(os.path.join(ROOT, "groups.json"), encoding="utf-8"))
rows = collections.defaultdict(lambda: collections.Counter())
for g in G:
    sts = styles(g["focus"])
    for f in g["files"]:
        folder = "daily" if re.match(r"\d{4}-", f) else "campaign"
        p = json.load(open(os.path.join(OUT, folder, f), encoding="utf-8"))
        cl = [e["clue"] for e in p["across"] + p["down"]]
        r = rows[(g["difficulty"], ",".join(sts) or "-")]
        r["puzzles"] += 1; r["clues"] += len(cl)
        r["blank"] += sum("___" in c for c in cl); r["pun"] += sum(c.endswith("?") for c in cl)
        r["quote"] += sum(c.startswith('"') for c in cl); r["eg"] += sum(bool(re.search(r"e\.g\.|for one", c)) for c in cl)
for (d, s), r in sorted(rows.items()):
    n = r["clues"]
    print(f"{d:6} {s[:48]:48} {r['puzzles']:4} puzzles  blank {r['blank']/n:4.0%}  pun {r['pun']/n:4.0%}  quote {r['quote']/n:4.0%}  e.g. {r['eg']/n:4.0%}")
