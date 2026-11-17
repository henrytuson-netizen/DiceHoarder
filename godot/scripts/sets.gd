## The 402 unique sets (material + base colour + ink). Same generator as the web version.
class_name DiceSets

const MATERIALS := ["plastic", "solidResin", "clearResin", "metal", "gemstone", "special"]
const MATERIAL_LABEL := {"plastic": "Plastic", "solidResin": "Solid Resin", "clearResin": "Clear Resin", "metal": "Metal", "gemstone": "Gemstone", "special": "Special"}
const BASES := [["Ruby", "#c8204a"], ["Coral", "#ef6f61"], ["Amber", "#e8a33c"], ["Gold", "#e0b43a"], ["Lime", "#8ad43c"], ["Emerald", "#1fa860"], ["Teal", "#2fb7a4"], ["Sky", "#6ad0ff"], ["Cobalt", "#2a4fc0"], ["Violet", "#8a6ad6"], ["Pink", "#e89bbd"], ["Ivory", "#eae6dc"], ["Silver", "#cfd4dc"], ["Copper", "#c9774c"], ["Onyx", "#2a2a2e"]]
const INKS := [["White", "#fff4e0"], ["Black", "#1a1414"], ["Gold", "#e9c25a"], ["Silver", "#d8dde4"], ["Red", "#c0202a"], ["Blue", "#2040c0"]]

static func _lum(hex: String) -> float:
	var c := Color(hex)
	return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b

## Returns Array of Dictionaries: {id, material, base_name, base, ink_name, ink, name}
static func build() -> Array:
	var state := [402]
	var rng := func() -> float:
		state[0] = (state[0] * 16807) % 2147483647
		return float(state[0]) / 2147483647.0
	var per_material := ceili(Cfg.TOTAL_SETS / float(MATERIALS.size()))
	var sets := []
	for material in MATERIALS:
		var pairs := []
		for b in BASES:
			for k in INKS:
				if absf(_lum(b[1]) - _lum(k[1])) > 0.18 and b[0] != k[0]:
					pairs.append([b, k])
		for i in range(pairs.size() - 1, 0, -1):
			var j := int(floor(rng.call() * (i + 1)))
			var t = pairs[i]; pairs[i] = pairs[j]; pairs[j] = t
		for p in pairs.slice(0, per_material):
			if sets.size() >= Cfg.TOTAL_SETS:
				break
			sets.append({"id": sets.size(), "material": material, "base_name": p[0][0], "base": Color(p[0][1]), "ink_name": p[1][0], "ink": Color(p[1][1]),
				"name": "%s · %s · %s ink" % [MATERIAL_LABEL[material], p[0][0], p[1][0]]})
	assert(sets.size() == Cfg.TOTAL_SETS)
	return sets
