# Which styled clues still have to be written: for every (difficulty, style), a greedy cover so each puzzle of a
# group with that style gets enough clues of it (counting base clues that already have the look).
# Usage: needs.py [--write]   (--write saves needs.json: {"<difficulty>|<style>": [words, best first]})
import sys, os, json, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cw import *
B, S = base(), styled()
P = puzzles()
need_words = {}
report = []
keys = sorted({(g["difficulty"], st) for g, f, a in P for st in styles(g["focus"]) if st not in ("acrossdown", "mix")})
for d, st in keys:
    have = {w: c for w, c in S.get((d, safe(st)), {}).items() if c != "-"}
    skip = {w for w, c in S.get((d, safe(st)), {}).items() if c == "-"}          # "-" = this word doesn't suit the style
    deficits = []     # (file, answers, needed)
    for g, f, ans in P:
        sts = styles(g["focus"])
        if g["difficulty"] != d or st not in sts: continue
        review = "review of four skills" in g["focus"]
        words = [w for w, a in ans if not ("acrossdown" in sts and not a)]     # Downs in an Across/Down level get easy clues
        k = need(st, len(ans), review)
        ok = sum(1 for w in words if w in have or st in kind(B[d].get(w, "")))
        if ok < k: deficits.append([set(w for w in words if w not in have and w not in skip and st not in kind(B[d].get(w, ""))), k - ok])
    chosen = []
    while any(x[1] > 0 for x in deficits):
        cnt = collections.Counter(w for ws, k in deficits if k > 0 for w in ws)
        if not cnt: break
        w, _ = cnt.most_common(1)[0]
        chosen.append(w)
        for x in deficits:
            if w in x[0] and x[1] > 0: x[0].discard(w); x[1] -= 1
    left = sum(x[1] for x in deficits if x[1] > 0)
    need_words[f"{d}|{st}"] = chosen
    report.append((d, st, len(chosen), left))
for r in report: print(f"{r[0]:6} {r[1]:32} write {r[2]:5}" + (f"  (UNCOVERABLE {r[3]})" if r[3] else ""))
print("total", sum(r[2] for r in report))
if "--write" in sys.argv: json.dump(need_words, open(os.path.join(HERE, "needs.json"), "w"), indent=0)
