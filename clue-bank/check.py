# Check hand-written clues: python check.py <set> [--missing]
#   set: base-easy, base-medium, base-hard, or a styled set like hard-pun (files <set>-*.tsv in this folder)
# Reports clues that contain their answer (anywhere, even inside another word: the game's checker refuses those),
# clues over 10 words, clues with a blocked word, duplicates, words not in the plan, and (base sets) the plan's words still without a clue.
import os, sys, json, glob, re
H = os.path.dirname(os.path.abspath(__file__))
# words a clue may never use, even inside a name like "Moby-Dick" (the game's blocklist; the user, 2026-10-11)
BLOCKED = {l.strip().upper() for l in open(os.path.join(H, "..", "src", "main", "resources", "blocked-words.txt")) if l.strip()}
name = sys.argv[1]
plan = json.load(open(os.path.join(H, "plan.json")))
st = None
if name.startswith("base-"): want = set(plan["base"][name[5:]])
elif name.startswith("st-"):                       # st-<difficulty>-<style>: the words needs.py picked
    d, st = name[3:].split("-", 1)
    full = {k.replace("|", "-").replace(":", "-").replace(" ", "-"): k for k in json.load(open(os.path.join(H, "needs.json")))}
    want = set(json.load(open(os.path.join(H, "needs.json")))[full[d + "-" + st]])
    st = full[d + "-" + st].split("|")[1]
else:
    d, st = name.split("-", 1)
    want = set(plan["styled"].get(f"{d}|{st.replace('_', ' ')}", []))
clues, bad = {}, []
for f in sorted(glob.glob(os.path.join(H, name + "-*.tsv"))):
    for n, line in enumerate(open(f, encoding="utf-8"), 1):
        line = line.rstrip("\n")
        if not line.strip(): continue
        if "\t" not in line: bad.append(f"{os.path.basename(f)}:{n} no tab: {line}"); continue
        w, c = line.split("\t", 1)
        w, c = w.strip().upper(), c.strip()
        if w in clues: bad.append(f"duplicate {w}")
        clues[w] = c
        if c == "-": continue
        look = {"pun": c.endswith("?"), "blank": "___" in c, "quote": c.startswith('"'), "double": not c.endswith("?") and "___" not in c,
                "misdirection": not c.endswith("?") and "___" not in c, "definition": not c.endswith("?") and "___" not in c}
        if st in look and not look[st]: bad.append(f"NOT {st.upper()} {w}: {c}")
        if any(ord(ch) > 126 for ch in c): bad.append(f"NON-ASCII {w}: {c}")
        if w in c.upper().replace("___", ""): bad.append(f"GIVES AWAY {w}: {c}")
        if len(c.split()) > 10: bad.append(f"LONG {w}: {c}")
        if set(re.findall(r"[A-Z]+", c.upper())) & BLOCKED: bad.append(f"BLOCKED WORD {w}: {c}")
        if w not in want and not st: bad.append(f"not in plan {w}")
for b in bad: print(b)
missing = sorted(want - set(clues))
if st: want = want | set(clues)
print(f"{name}: {len(clues)} clues, {len(bad)} problems, {len(missing)} of {len(want)} still to write")
if "--missing" in sys.argv: print(" ".join(missing))
