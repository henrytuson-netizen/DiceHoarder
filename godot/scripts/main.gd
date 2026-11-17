## Builds the shop: room with real window openings, sun + sky, baked furniture, 2,814 physics dice.
extends Node3D

var kit: DiceKit
var sets: Array
var furniture: Node
var player: CharacterBody3D
var slots: Array[Node3D] = []
var dice: Array[RigidBody3D] = []
var _pending := []   # dice still to spawn: [set, kind, transform]
var _rng_state := 21
var mat_wall := StandardMaterial3D.new()
var mat_trim := StandardMaterial3D.new()
var mat_floor := StandardMaterial3D.new()
var mat_ceiling := StandardMaterial3D.new()

func rng() -> float:
	_rng_state = (_rng_state * 16807) % 2147483647
	return float(_rng_state) / 2147483647.0

var _ready_ms := 0

func _ready() -> void:
	var t0 := Time.get_ticks_msec()
	kit = DiceKit.new()
	sets = DiceSets.build()
	furniture = load("res://assets/models/shop-furniture.glb").instantiate()
	_materials()
	_environment()
	_room()
	_furniture()
	_lights()
	_dice()
	player = preload("res://scripts/player.gd").new()
	add_child(player)
	player.global_position = Cfg.START
	player.look_at_point(Cfg.START_LOOK)
	_ready_ms = Time.get_ticks_msec() - t0
	print("READY_MS ", _ready_ms)
	_test_hooks()

# ---------------------------------------------------------------- look
func _materials() -> void:
	mat_wall.albedo_color = Color("#7d9c97"); mat_wall.roughness = 0.95
	mat_trim.albedo_color = Color("#b9773c"); mat_trim.roughness = 0.6
	mat_floor.albedo_color = Color.WHITE; mat_floor.roughness = 0.6
	var fn := FastNoiseLite.new(); fn.frequency = 0.01; fn.fractal_octaves = 3
	var ft := NoiseTexture2D.new(); ft.noise = fn; ft.seamless = true; ft.width = 1024; ft.height = 1024
	var g := Gradient.new(); g.set_color(0, Color("#5e3418")); g.set_color(1, Color("#8a5228")); ft.color_ramp = g
	mat_floor.albedo_texture = ft; mat_floor.uv1_triplanar = true; mat_floor.uv1_scale = Vector3(0.25, 4.0, 0.25)
	mat_ceiling.albedo_color = Color("#8a5a32"); mat_ceiling.roughness = 0.8

func _environment() -> void:
	var we := WorldEnvironment.new(); var e := Environment.new()
	var sky := Sky.new(); var sm := ProceduralSkyMaterial.new()
	sm.sky_top_color = Color("#9ec3e8"); sm.sky_horizon_color = Color("#ffe2b8"); sm.ground_horizon_color = Color("#d8b48a"); sm.sun_angle_max = 30
	sky.sky_material = sm; e.sky = sky; e.background_mode = Environment.BG_SKY
	e.ambient_light_source = Environment.AMBIENT_SOURCE_SKY; e.ambient_light_energy = 0.25
	e.tonemap_mode = Environment.TONE_MAPPER_AGX; e.tonemap_exposure = 1.0
	e.sdfgi_enabled = true; e.sdfgi_use_occlusion = true; e.sdfgi_energy = 0.75
	e.ssao_enabled = true; e.ssao_radius = 0.6
	e.glow_enabled = true; e.glow_intensity = 0.4; e.glow_bloom = 0.05
	e.volumetric_fog_enabled = true; e.volumetric_fog_density = 0.025; e.volumetric_fog_albedo = Color("#fff4e6"); e.volumetric_fog_anisotropy = 0.7; e.volumetric_fog_gi_inject = 0.3
	e.adjustment_enabled = true; e.adjustment_saturation = 0.95
	we.environment = e; add_child(we)

func _box(size: Vector3, pos: Vector3, mat: Material, collide := true, parent: Node = self) -> MeshInstance3D:
	var mi := MeshInstance3D.new(); var bm := BoxMesh.new(); bm.size = size; mi.mesh = bm
	mi.material_override = mat; mi.position = pos; parent.add_child(mi)
	if collide:
		var sb := StaticBody3D.new(); var cs := CollisionShape3D.new(); var sh := BoxShape3D.new(); sh.size = size
		cs.shape = sh; sb.add_child(cs); mi.add_child(sb)
	return mi

## A wall along x (axis "x") or z (axis "z") from a to b, with window holes [centre, ...] (1.4 w x 1.7 h, sill 1.05).
func _wall(axis: String, fixed: float, a: float, b: float, holes: Array, h := Cfg.WALL_H) -> void:
	var t := 0.14
	var cuts := []
	for c in holes: cuts.append([c - 0.7, c + 0.7])
	cuts.sort_custom(func(p, q): return p[0] < q[0])
	var cur := a
	var segs := []
	for c in cuts:
		segs.append([cur, c[0], 0.0, h]); segs.append([c[0], c[1], 0.0, 1.05]); segs.append([c[0], c[1], 2.75, h]); cur = c[1]
	segs.append([cur, b, 0.0, h])
	for s in segs:
		var len: float = s[1] - s[0]
		if len <= 0.001: continue
		var hh: float = s[3] - s[2]
		var mid: float = (s[0] + s[1]) / 2.0
		var size := Vector3(len, hh, t) if axis == "x" else Vector3(t, hh, len)
		var pos := Vector3(mid, s[2] + hh / 2, fixed) if axis == "x" else Vector3(fixed, s[2] + hh / 2, mid)
		_box(size, pos, mat_wall)
	# wainscot strip and window frames
	for c in cuts:
		var cx: float = (c[0] + c[1]) / 2
		for side in [-1, 1]:
			var p := Vector3(cx + side * 0.7, 1.9, fixed) if axis == "x" else Vector3(fixed, 1.9, cx + side * 0.7)
			_box(Vector3(0.08, 1.75, 0.2) if axis == "x" else Vector3(0.2, 1.75, 0.08), p, mat_trim, false)
		for y in [1.05, 2.75, 1.9]:
			var p2 := Vector3(cx, y, fixed) if axis == "x" else Vector3(fixed, y, cx)
			_box(Vector3(1.48, 0.07, 0.2) if axis == "x" else Vector3(0.2, 0.07, 1.48), p2, mat_trim, false)
		var pm := Vector3(cx, 1.9, fixed) if axis == "x" else Vector3(fixed, 1.9, cx)
		_box(Vector3(0.05, 1.7, 0.1) if axis == "x" else Vector3(0.1, 1.7, 0.05), pm, mat_trim, false)

func _room() -> void:
	_box(Vector3(Cfg.MAIN_W, 0.1, Cfg.MAIN_D), Vector3(Cfg.MAIN_W / 2, -0.05, Cfg.MAIN_D / 2), mat_floor)
	_box(Vector3(11, 0.1, 5), Vector3(11.5, -0.05, 10.7), mat_floor)
	var north := []; var east := []; var west := []
	for w in Cfg.WINDOWS:
		match w[0]:
			"N": north.append(w[1])
			"E": east.append(w[1])
			"W": west.append(w[1])
	_wall("x", 0.0, 0.0, Cfg.MAIN_W, north)
	_wall("z", Cfg.MAIN_W, 0.0, Cfg.BACK_Z1, east)
	_wall("z", 0.0, 0.0, Cfg.MAIN_D, west)
	_wall("z", Cfg.BACK_X0, Cfg.DIVIDER_Z, Cfg.BACK_Z1, [])
	_wall("x", Cfg.BACK_Z1, Cfg.BACK_X0, Cfg.MAIN_W, [])
	_wall("x", Cfg.DIVIDER_Z, 0.0, Cfg.BACK_X0, [])
	# dividing wall with the doorway
	_box(Vector3(Cfg.DOOR_X - Cfg.DOOR_W / 2 - Cfg.BACK_X0, Cfg.WALL_H, 0.14), Vector3((Cfg.BACK_X0 + Cfg.DOOR_X - Cfg.DOOR_W / 2) / 2, Cfg.WALL_H / 2, Cfg.DIVIDER_Z), mat_wall)
	_box(Vector3(Cfg.MAIN_W - Cfg.DOOR_X - Cfg.DOOR_W / 2, Cfg.WALL_H, 0.14), Vector3((Cfg.MAIN_W + Cfg.DOOR_X + Cfg.DOOR_W / 2) / 2, Cfg.WALL_H / 2, Cfg.DIVIDER_Z), mat_wall)
	_box(Vector3(Cfg.DOOR_W, Cfg.WALL_H - 2.1, 0.14), Vector3(Cfg.DOOR_X, 2.1 + (Cfg.WALL_H - 2.1) / 2, Cfg.DIVIDER_Z), mat_wall)
	for s in [-1, 1]: _box(Vector3(0.1, 2.1, 0.22), Vector3(Cfg.DOOR_X + s * Cfg.DOOR_W / 2, 1.05, Cfg.DIVIDER_Z), mat_trim)
	# ceiling, beams, posts, wainscot
	_box(Vector3(Cfg.MAIN_W, 0.1, Cfg.MAIN_D), Vector3(Cfg.MAIN_W / 2, Cfg.WALL_H, Cfg.MAIN_D / 2), mat_ceiling)
	_box(Vector3(11, 0.1, 5), Vector3(11.5, Cfg.WALL_H, 10.7), mat_ceiling)
	var x := 1.5
	while x < Cfg.MAIN_W:
		_box(Vector3(0.24, 0.3, Cfg.MAIN_D), Vector3(x, Cfg.WALL_H - 0.2, Cfg.MAIN_D / 2), mat_trim, false)
		x += 2.8
	for p in [Vector3(0.12, 0, 0.12), Vector3(Cfg.MAIN_W - 0.12, 0, 0.12), Vector3(0.12, 0, Cfg.MAIN_D - 0.12), Vector3(Cfg.MAIN_W - 0.12, 0, Cfg.MAIN_D - 0.12)]:
		_box(Vector3(0.24, Cfg.WALL_H, 0.24), p + Vector3(0, Cfg.WALL_H / 2, 0), mat_trim)
	_box(Vector3(Cfg.MAIN_W, 0.9, 0.04), Vector3(Cfg.MAIN_W / 2, 0.45, 0.09), mat_trim, false)
	_box(Vector3(Cfg.MAIN_W, 0.06, 0.06), Vector3(Cfg.MAIN_W / 2, 0.92, 0.1), mat_trim, false)

func _piece(name: String) -> Node3D:
	var src := furniture.find_child(name, true, false) as Node3D
	var c := src.duplicate() as Node3D
	c.transform = Transform3D.IDENTITY
	return c

var _shapes := {}

## One merged collision shape per furniture type, shared by every copy (fast to build and to load).
func _piece_shape(name: String) -> ConcavePolygonShape3D:
	if _shapes.has(name): return _shapes[name]
	var src := furniture.find_child(name, true, false) as Node3D
	var faces := PackedVector3Array()
	for mi in src.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		var xf := src.global_transform.affine_inverse() * m.global_transform if src.is_inside_tree() else _rel(src, m)
		for v in m.mesh.get_faces(): faces.append(xf * v)
	var sh := ConcavePolygonShape3D.new(); sh.set_faces(faces)
	_shapes[name] = sh
	return sh

func _rel(root: Node3D, n: Node3D) -> Transform3D:
	var xf := Transform3D.IDENTITY
	var cur: Node = n
	while cur != root and cur is Node3D:
		xf = (cur as Node3D).transform * xf
		cur = cur.get_parent()
	return xf

func _add_furniture(name: String, pos: Vector3, ry := 0.0) -> Node3D:
	var p := _piece(name); add_child(p); p.global_position = pos; p.rotation.y = ry
	var sb := StaticBody3D.new(); var cs := CollisionShape3D.new(); cs.shape = _piece_shape(name)
	sb.add_child(cs); p.add_child(sb)
	return p

func _furniture() -> void:
	for t in Cfg.tables():
		var tb := _add_furniture("Table", t)
		_collect_slots(tb)
	for r in Cfg.WALL_RACKS:
		_collect_slots(_add_furniture(r["model"], r["pos"], r["ry"]))
	_add_furniture("Counter", Cfg.COUNTER)
	_add_furniture("Desk", Cfg.DESK)

func _collect_slots(piece: Node3D) -> void:
	var found := piece.find_children("slot_*", "Node3D", true, false)
	found.sort_custom(func(a, b): return a.name < b.name)
	for s in found: slots.append(s)

func _lights() -> void:
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-38, 160, 0)   # low warm sun from the north-east windows
	sun.light_color = Color("#ffd9a8"); sun.light_energy = 2.2; sun.shadow_enabled = true
	sun.light_volumetric_fog_energy = 5.0; sun.directional_shadow_max_distance = 30
	add_child(sun)
	for p in [Vector3(4.05, 2.6, 1.5), Vector3(11.45, 2.6, 1.5), Vector3(4.05, 2.6, 3.9), Vector3(11.45, 2.6, 3.9), Vector3(3.6, 2.6, 6.4), Vector3(8.7, 2.6, 6.4), Vector3(14.4, 2.6, 10.8), Vector3(8.4, 2.6, 10.8)]:
		var l := OmniLight3D.new(); l.position = p; l.light_color = Color("#ffc890"); l.light_energy = 0.6; l.omni_range = 6.0
		add_child(l)
		var shade := MeshInstance3D.new(); var cm := CylinderMesh.new(); cm.top_radius = 0.05; cm.bottom_radius = 0.28; cm.height = 0.3
		shade.mesh = cm; shade.position = p + Vector3(0, 0.15, 0)
		var sm := StandardMaterial3D.new(); sm.albedo_color = Color("#f0b45a"); sm.emission_enabled = true; sm.emission = Color("#ffbf6b"); sm.emission_energy_multiplier = 1.5
		shade.material_override = sm; add_child(shade)

# ---------------------------------------------------------------- dice
func _dice() -> void:
	var cell := 0.08
	var grid := {}
	var piles := []
	while piles.size() < 14:
		var px := 0.8 + rng() * 15.4; var pz := 0.8 + rng() * 11.6
		if Cfg.floor_free(px, pz, 0.8): piles.append(Vector3(px, pz, 0.6 + rng() * 0.6))
	for s in sets:
		for ki in 7:
			var kind: int = DiceKit.KINDS[ki]
			var x := 0.0; var z := 0.0
			for t in 80:
				if rng() < 0.6:
					var pl: Vector3 = piles[int(rng() * piles.size())]
					var a := rng() * TAU; var d := sqrt(rng()) * pl.z
					x = pl.x + cos(a) * d; z = pl.y + sin(a) * d
				else:
					x = 0.5 + rng() * 16.0; z = 0.5 + rng() * 12.3
				if Cfg.floor_free(x, z, 0.05) and _clear(grid, x, z, cell): break
			var key := Vector2i(floori(x / cell), floori(z / cell))
			if not grid.has(key): grid[key] = []
			grid[key].append(Vector2(x, z))
			_pending.append([s, kind, kit.resting(kind, Vector3(x, 0, z), rng() * TAU, int(rng() * 20))])

## Spawn dice a few hundred per frame so the shop appears immediately.
func _process(_dt: float) -> void:
	var n := 0
	while _pending.size() > 0 and n < 300:
		var d = _pending.pop_back()
		dice.append(_make_die(d[0], d[1], d[2])); n += 1

func _clear(grid: Dictionary, x: float, z: float, cell: float) -> bool:
	var cx := floori(x / cell); var cz := floori(z / cell)
	for i in range(-1, 2):
		for j in range(-1, 2):
			for p in grid.get(Vector2i(cx + i, cz + j), []):
				if (p as Vector2).distance_to(Vector2(x, z)) < 0.072: return false
	return true

func _make_die(s: Dictionary, kind: int, xf: Transform3D) -> RigidBody3D:
	var rb := RigidBody3D.new()
	rb.mass = 0.05; rb.physics_material_override = kit.phys; rb.can_sleep = true; rb.sleeping = true
	rb.continuous_cd = false
	var cs := CollisionShape3D.new(); cs.shape = kit.shapes[kind]; rb.add_child(cs)
	var mi := MeshInstance3D.new(); mi.mesh = kit.meshes[kind]
	mi.set_surface_override_material(0, kit.body_mats[s["material"]])
	mi.set_surface_override_material(1, kit.ink_mat)
	mi.set_instance_shader_parameter("tint", s["base"])
	mi.set_instance_shader_parameter("ink", s["ink"])
	rb.add_child(mi)
	rb.set_meta("set", s["id"]); rb.set_meta("kind", kind)
	add_child(rb); rb.global_transform = xf
	return rb

# ---------------------------------------------------------------- test hooks
func _test_hooks() -> void:
	var args := OS.get_cmdline_user_args()
	var shot := ""
	for a in args:
		if a.begins_with("--shot="): shot = a.substr(7)
		if a == "--view=aerial":
			var c := Camera3D.new(); add_child(c); c.current = true; c.fov = 40
			c.global_position = Vector3(8.5, 19, 22); c.look_at(Vector3(8.5, 0, 6.6))
			for n in get_tree().get_nodes_in_group(""): pass
			var ceil_hide := true
			if ceil_hide: pass
	if shot == "": return
	var frames := 40
	for a in args:
		if a.begins_with("--frames="): frames = int(a.substr(9))
	for i in frames: await get_tree().process_frame
	get_viewport().get_texture().get_image().save_png(shot)
	print("SHOT ", shot, " slots=", slots.size(), " dice=", dice.size(), " pending=", _pending.size(), " ready_ms=", _ready_ms, " fps=", Engine.get_frames_per_second())
	get_tree().quit()
