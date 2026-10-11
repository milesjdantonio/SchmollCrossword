# Replace clues in place: python fix.py <file> <<< "WORD<TAB>new clue" lines on stdin
import sys, io
sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding="utf-8")
path = sys.argv[1]
new = {}
for line in sys.stdin.read().splitlines():
    if "\t" in line:
        w, c = line.split("\t", 1); new[w.strip().upper()] = c.strip()
out, seen = [], set()
for line in open(path, encoding="utf-8").read().splitlines():
    if "\t" in line:
        w = line.split("\t", 1)[0].strip().upper()
        if w in new: line = w + "\t" + new[w]; seen.add(w)
    out.append(line)
for w in new:
    if w not in seen: out.append(w + "\t" + new[w])
open(path, "w", encoding="utf-8").write("\n".join(out) + "\n")
print("fixed", len(seen), "added", len(new) - len(seen))
