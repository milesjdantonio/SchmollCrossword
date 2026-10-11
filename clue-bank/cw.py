# Shared helpers for the hand-written clues: base and styled clue files, the styles each group's lesson asks for,
# how many clues of each style a puzzle needs, and every staged puzzle's answers (with direction).
import json, re, glob, math, os
ROOT = r"C:/Users/miles/OneDrive/Documents/Personal Projects/SchmollCrosswordMain/target/puzzle-batch"
HERE = os.path.dirname(os.path.abspath(__file__))
def styles(focus):
    out = []
    f = focus
    if "Mix every clue type:" in f:            # its own list of types isn't a demand for each (one of each, see convert)
        out.append("mix")
        f = re.sub(r"Mix every clue type:[^.]*\.", "", f)
    f = f.replace("(no wordplay, no fill-in-the-blanks)", "")     # the Definitions lesson forbids them
    if "fill-in-the-blanks" in f: out.append("blank")
    if "synonyms of the answer" in f: out.append("synonym")
    if "example and category clues" in f: out.append("example")
    if "something a person would say" in f: out.append("quote")
    if "puns or wordplay" in f: out.append("pun")
    if "less obvious but well-known meaning" in f: out.append("double")
    if "fair misdirection" in f: out.append("misdirection")
    if "straight, exact definition" in f: out.append("definition")
    for m in re.finditer(r"world's theme \(([^)]+)\)", f): out.append("theme:" + m.group(1))
    if "Across clues on the harder side" in f: out.append("acrossdown")
    if "Mix every clue type:" in f: out.append("mix")
    return sorted(set(out))
def safe(style): return style.replace(":", "-").replace(" ", "-")
def read_tsv(path, into):
    for line in open(path, encoding="utf-8"):
        line = line.rstrip("\n")
        if not line.strip(): continue
        w, c = line.split("\t", 1)
        into[w.strip().upper()] = c.strip()
def base():
    b = {}
    for d in ("easy", "medium", "hard"):
        b[d] = {}
        for f in sorted(glob.glob(os.path.join(HERE, f"base-{d}-*.tsv"))): read_tsv(f, b[d])
    return b
def styled():
    s = {}
    for f in sorted(glob.glob(os.path.join(HERE, "st-*.tsv"))):
        name = os.path.basename(f)[3:-4]           # st-<difficulty>-<style>-NN.tsv
        d, rest = name.split("-", 1)
        st = rest.rsplit("-", 1)[0]
        read_tsv(f, s.setdefault((d, st), {}))
    return s
def kind(clue):
    """the styles a clue already has, by its look"""
    k = set()
    if "___" in clue: k.add("blank")
    if clue.endswith("?"): k.add("pun")
    if clue.startswith('"') and clue.rstrip("?!.").endswith(('"', '!"', '?"', '."')): k.add("quote")
    if re.search(r"e\.g\.|, for one$|, for example|^Kind of |^One of |, say$|^Type of |, perhaps$", clue): k.add("example")
    if "___" not in clue and not clue.endswith("?") and not clue.startswith('"') and len(clue.split()) <= 2 and "e.g." not in clue: k.add("synonym")
    if "___" not in clue and not clue.endswith("?"): k.add("definition")
    return k
def need(style, n, review):
    t = {"blank": math.ceil(n / 2), "pun": math.ceil(n / 3), "quote": math.ceil(n / 4), "double": max(2, math.ceil(n / 5)),
         "misdirection": max(2, math.ceil(n / 5)), "example": math.ceil(n / 3), "synonym": math.ceil(n * 0.6)}.get(style)
    if style.startswith("theme:"): t = math.ceil(n / 4)
    if style == "definition": t = n
    if t is None: return 0
    return t if not review or style == "definition" else max(1, math.ceil(t / 2))
def puzzles():
    """[(group dict, file, [(answer, across?)])] for every staged puzzle with clues"""
    G = json.load(open(os.path.join(ROOT, "groups.json"), encoding="utf-8"))
    out = []
    for g in G:
        for f in g["files"]:
            folder = "daily" if re.match(r"\d{4}-\d\d-\d\d-", f) else "campaign"
            p = json.load(open(os.path.join(ROOT, folder, f), encoding="utf-8"))
            sol = p["solution"]; n = len(sol)
            ans = []
            for r in range(n):
                for m in re.finditer(r"[A-Z]{3,}", sol[r]): ans.append((m.group(), True))
            for c in range(n):
                col = "".join(sol[r][c] for r in range(n))
                for m in re.finditer(r"[A-Z]{3,}", col): ans.append((m.group(), False))
            out.append((g, f, ans))
    return out
def easier(d): return {"hard": "medium", "medium": "easy", "easy": "easy"}[d]
