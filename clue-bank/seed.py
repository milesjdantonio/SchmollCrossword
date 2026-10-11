# seed.py <from-difficulty> <to-difficulty> <style>: copy the words' clues (not the skips) of one difficulty's
# styled set into the other's, for the words needs.py still wants there. Writes st-<to>-<style>-NN.tsv.
import sys, os, json, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cw import *
a, b, st = sys.argv[1:4]
S = styled(); src = S.get((a, safe(st)), S.get((a, st), {}))
N = json.load(open(os.path.join(HERE, "needs.json")))[f"{b}|{st}"]
have = S.get((b, safe(st)), {})
rows = [(w, src[w]) for w in N if w in src and src[w] != "-" and w not in have]
if rows:
    k = len(glob.glob(os.path.join(HERE, f"st-{b}-{safe(st)}-*.tsv"))) + 1
    open(os.path.join(HERE, f"st-{b}-{safe(st)}-{k:02d}.tsv"), "w", encoding="utf-8").write("".join(f"{w}\t{c}\n" for w, c in rows))
print(f"seeded {len(rows)} {b} {st} clues from {a}")
