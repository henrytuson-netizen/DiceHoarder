# Blender build scripts

Blender runs headless as the `bpy` Python module (Python 3.13):

```bash
python3.13 -m venv venv && ./venv/bin/pip install bpy
BAKE=1 TEXSIZE=2048 ./venv/bin/python build_shop.py 28
```

`build_shop.py` builds the shelf, counter and desk, bakes all the wood into one 2048 atlas
(colour, roughness, normal) and exports `shop-furniture.glb` plus preview renders.
`integrate.py` embeds that `.glb` into `shop/index.html` (it expects the pre-integration page and the `.glb` in the working directory).

Wood is built around `#3F2000` (dark ebony), matte oiled finish.
