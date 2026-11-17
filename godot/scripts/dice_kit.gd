## Dice meshes (from Blender, numerals included), physics shapes, materials and resting poses.
class_name DiceKit
extends RefCounted

const KINDS := [4, 6, 8, 10, 100, 12, 20]
var meshes := {}        # kind -> Mesh
var shapes := {}        # kind -> ConvexPolygonShape3D
var faces := {}         # kind -> Array of [normal, centre] for faces it can rest on
var body_mats := {}     # material kind -> ShaderMaterial
var ink_mat: ShaderMaterial
var phys := PhysicsMaterial.new()

func _init() -> void:
	var root: Node = load("res://assets/models/dice.glb").instantiate()
	for k in KINDS:
		var mi := root.find_child("d%d" % k, true, false) as MeshInstance3D
		meshes[k] = mi.mesh
		shapes[k] = mi.mesh.create_convex_shape(true, true)
		faces[k] = _rest_faces(mi.mesh)
	root.free()
	var body := load("res://shaders/die_body.gdshader")
	var clear := load("res://shaders/die_clear.gdshader")
	for m in DiceSets.MATERIALS:
		var sm := ShaderMaterial.new()
		match m:
			"plastic": sm.shader = body; sm.set_shader_parameter("rough", 0.5)
			"solidResin": sm.shader = body; sm.set_shader_parameter("rough", 0.28); sm.set_shader_parameter("coat", 0.6)
			"clearResin": sm.shader = clear; sm.set_shader_parameter("opacity", 0.6)
			"metal": sm.shader = body; sm.set_shader_parameter("rough", 0.3); sm.set_shader_parameter("metal", 0.95)
			"gemstone": sm.shader = clear; sm.set_shader_parameter("opacity", 0.82); sm.set_shader_parameter("rough", 0.04)
			"special": sm.shader = body; sm.set_shader_parameter("rough", 0.25); sm.set_shader_parameter("shimmer", 0.9)
		body_mats[m] = sm
	ink_mat = ShaderMaterial.new(); ink_mat.shader = load("res://shaders/die_ink.gdshader")
	phys.friction = 0.6; phys.bounce = 0.25

## Group the body surface's triangles by normal; keep the big flat faces a die can rest on.
func _rest_faces(mesh: Mesh) -> Array:
	var arr := mesh.surface_get_arrays(0)
	var v: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
	var acc := {}
	for t in range(0, idx.size(), 3):
		var a := v[idx[t]]; var b := v[idx[t + 1]]; var c := v[idx[t + 2]]
		var cr := (b - a).cross(c - a); var area := cr.length() * 0.5
		if area <= 0.0: continue
		var n := cr.normalized()
		var key := "%d,%d,%d" % [roundi(n.x * 20), roundi(n.y * 20), roundi(n.z * 20)]
		if not acc.has(key): acc[key] = [n, Vector3.ZERO, 0.0]
		acc[key][1] += (a + b + c) / 3.0 * area; acc[key][2] += area
	var best := 0.0
	for k in acc: best = maxf(best, acc[k][2])
	var out := []
	for k in acc:
		if acc[k][2] > best * 0.4: out.append([acc[k][0], acc[k][1] / acc[k][2]])
	return out

## Transform of a die resting on a random big face at floor point p, turned by yaw.
func resting(kind: int, p: Vector3, yaw: float, face: int) -> Transform3D:
	var f: Array = faces[kind][face % faces[kind].size()]
	var n: Vector3 = f[0]
	var q := Quaternion(Vector3.UP, yaw) * Quaternion(n, Vector3.DOWN)
	return Transform3D(Basis(q), p + Vector3(0, absf((f[1] as Vector3).dot(n)) + 0.001, 0))
