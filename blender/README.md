# Blender build scripts

Blender runs headless as the `bpy` Python module (Python 3.13):

```bash
python3.13 -m venv venv && ./venv/bin/pip install bpy
BAKE=1 TEXSIZE=2048 ./venv/bin/python build_shop.py 28
```

`build_shop.py` builds the island shelves (66 slots each), the two wall racks (72 slots), the counter and the desk
from individual boards, marks every slot with a `slot_###` empty (width/depth in glTF extras), bakes all the wood
into one atlas (colour, roughness, normal) and exports `shop-furniture.glb` plus preview renders.
Without `BAKE=1` it only renders procedural previews. Copy the `.glb` to `public/models/`.

Wood is built around `#3F2000` (dark ebony), matte oiled finish.
