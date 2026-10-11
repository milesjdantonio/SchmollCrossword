# convert.py: one clue map per staged puzzle, written to target/puzzle-batch/clues/files/<file>.json, for
# PuzzleBatch assemble. Every answer gets its base clue at the puzzle's clue difficulty; then the puzzle's lesson
# styles are given out (each answer at most one style, scarcest style first) until each style has its share
# (cw.need), using answers whose base clue already has the look before swapping in a styled clue.
#   acrossdown: Down answers get the easier difficulty's base clue (the Downs crack the Acrosses)
#   definition: no "___" or "?" clue is left in (a plain definition from the other sets replaces it)
#   mix:        one clue of each style where the puzzle has one
# Prints a report: puzzles short of a style, answers with no clue (must be 0), clue texts used twice in a puzzle.
import sys, os, json, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cw import *

B, S = base(), styled()
def styled_clue(d, st, w):
    c = S.get((d, safe(st)), {}).get(w)
    return c if c and c != "-" else None
def plain(c): return "___" not in c and not c.endswith("?")
def plain_def(d, w):
    """a clue for w with no blank or '?': this difficulty's base, the definition set, then the other difficulties"""
    for c in (B[d].get(w), styled_clue(d, "definition", w), B[easier(d)].get(w), B["medium"].get(w), B["hard"].get(w), B["easy"].get(w)):
        if c and plain(c): return c
    return None

out_dir = os.path.join(ROOT, "clues", "files")
os.makedirs(out_dir, exist_ok=True)
short = collections.Counter(); missing = []; dupes = 0; written = 0; swapped = collections.Counter()
for g, f, ans in puzzles():
    d, sts = g["difficulty"], styles(g["focus"])
    review = "review of four skills" in g["focus"]
    n = len(ans)
    clue, style_of = {}, {}
    for w, across in ans:
        if "acrossdown" in sts and not across: clue[w] = B[easier(d)].get(w) or B[d].get(w)
        else: clue[w] = B[d].get(w)
        if not clue[w]: missing.append((f, w))
    free = [w for w, across in ans if not ("acrossdown" in sts and not across)]
    wanted = [s for s in sts if s not in ("acrossdown", "mix", "definition", "synonym")]
    # the synonym lesson: short base clues already count; swap in styled ones only where needed
    if "synonym" in sts: wanted.append("synonym")
    def avail(s, w): return s in kind(clue[w] or "") or styled_clue(d, s, w)
    wanted.sort(key=lambda s: sum(1 for w in free if avail(s, w)))
    for s in wanted:
        k = need(s, n, review)
        have = [w for w in free if w not in style_of and s in kind(clue[w] or "")]
        for w in have[:k]: style_of[w] = s
        got = min(len(have), k)
        for w in free:
            if got >= k: break
            if w in style_of: continue
            c = styled_clue(d, s, w)
            if c: clue[w] = c; style_of[w] = s; got += 1; swapped[s] += 1
        if got < k: short[(d, s)] += k - got
    if "mix" in sts:
        for s in ("pun", "quote", "example", "double", "misdirection", "blank"):
            if any(style_of.get(w) == s or s in kind(clue[w] or "") for w in free): continue
            for w in free:
                if w in style_of: continue
                c = styled_clue(d, s, w)
                if c: clue[w] = c; style_of[w] = s; swapped[s] += 1; break
    if "definition" in sts:
        for w in free:
            if w in style_of or not clue[w] or plain(clue[w]): continue
            c = plain_def(d, w)
            if c: clue[w] = c; swapped["definition"] += 1
            else: short[(d, "definition")] += 1
    # the same clue text twice in one puzzle: give the later one another clue
    seen = {}
    for w, across in ans:
        c = clue[w]
        if c in seen:
            for alt in (B[d].get(w), B[easier(d)].get(w), B["hard"].get(w), B["medium"].get(w), B["easy"].get(w)):
                if alt and alt not in seen: clue[w] = alt; break
            else: dupes += 1
        seen[clue[w]] = w
    json.dump({w: c for w, c in clue.items() if c}, open(os.path.join(out_dir, f), "w", encoding="utf-8"), indent=0)
    written += 1
print(f"{written} puzzles, styled clues used: {dict(swapped)}")
print(f"answers with no clue: {len(missing)}", missing[:10])
print(f"clue texts left repeated in a puzzle: {dupes}")
for k, v in sorted(short.items()): print(f"short {k[0]} {k[1]}: {v} clue(s) across all puzzles")
