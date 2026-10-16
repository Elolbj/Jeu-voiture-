#!/bin/bash
# usage: shots.sh out.png car1 car2 ... ; renders front 3/4, side, rear 3/4
out=$1; shift
files=()
node tools/play.mjs "showroom=kaze_86&q=haute" "wait:2500" 320 180 > /dev/null
for c in "$@"; do
  for a in -0.75 0 2.35; do
    n="v_${c}_${a}"
    node tools/play.mjs "showroom=$c&angle=$a&h=1.35&dist=5.6&q=haute" "wait:3500|shot:$n" 640 360 > /dev/null
    files+=("tools/scratch/$n.png")
  done
done
python3 - "$out" "${files[@]}" <<'PY'
import sys
from PIL import Image
out=sys.argv[1]; fs=sys.argv[2:]
ims=[Image.open(f) for f in fs]
w,h=ims[0].size
rows=(len(ims)+2)//3
g=Image.new('RGB',(w*3,h*rows))
for i,im in enumerate(ims): g.paste(im,((i%3)*w,(i//3)*h))
g.save(out)
PY
