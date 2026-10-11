# The next styled clues to write: nextst.py <difficulty> <style> N  -> words (with their base clue), and the file to add
import sys, os, json, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cw import *
d, st, n = sys.argv[1], sys.argv[2], int(sys.argv[3])
N = json.load(open(os.path.join(HERE, "needs.json")))[f"{d}|{st}"]
S = styled().get((d, safe(st)), {}); AB = base(); B = AB[d]
todo = [w for w in N if w not in S]
k = len(glob.glob(os.path.join(HERE, f"st-{d}-{safe(st)}-*.tsv"))) + 1
print(f"{len(todo)} left -> st-{d}-{safe(st)}-{k:02d}.tsv")
for w in todo[:n]: print(f"{w}\t{B.get(w, '')}")
