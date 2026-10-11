# The next N words still to write for a set: python next.py <set> N
import os, sys, json, glob
H = os.path.dirname(os.path.abspath(__file__))
name, n = sys.argv[1], int(sys.argv[2])
plan = json.load(open(os.path.join(H, "plan.json")))
want = plan["base"][name[5:]] if name.startswith("base-") else plan["styled"][name.split("-", 1)[0] + "|" + name.split("-", 1)[1].replace("_", " ")]
have = set()
for f in glob.glob(os.path.join(H, name + "-*.tsv")):
    for line in open(f, encoding="utf-8"):
        if "\t" in line: have.add(line.split("\t", 1)[0].strip().upper())
left = [w for w in sorted(want) if w not in have]
print(len(left), "left:", " ".join(left[:n]))
