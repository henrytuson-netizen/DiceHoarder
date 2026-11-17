## First-person walker: WASD, mouse look (click to capture, Esc to release), Shift to run.
extends CharacterBody3D

const WALK := 2.6
const RUN := 4.6
const SENS := 0.0022
var cam: Camera3D
var pitch := 0.0

func _ready() -> void:
	var shape := CollisionShape3D.new()
	var cap := CapsuleShape3D.new(); cap.radius = 0.3; cap.height = 1.75
	shape.shape = cap; shape.position.y = 0.875; add_child(shape)
	cam = Camera3D.new(); cam.position.y = 1.62; cam.fov = 68; cam.near = 0.03; add_child(cam); cam.current = true

func look_at_point(p: Vector3) -> void:
	var d := p - (global_position + Vector3(0, 1.62, 0))
	rotation.y = atan2(-d.x, -d.z)
	pitch = atan2(d.y, Vector2(d.x, d.z).length()); cam.rotation.x = pitch

func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventMouseButton and e.pressed and Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif e is InputEventKey and e.pressed and e.physical_keycode == KEY_ESCAPE:
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	elif e is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		rotation.y -= e.relative.x * SENS
		pitch = clampf(pitch - e.relative.y * SENS, -1.4, 1.4); cam.rotation.x = pitch

func _physics_process(dt: float) -> void:
	var f := float(Input.is_physical_key_pressed(KEY_W)) - float(Input.is_physical_key_pressed(KEY_S))
	var r := float(Input.is_physical_key_pressed(KEY_D)) - float(Input.is_physical_key_pressed(KEY_A))
	var speed := RUN if Input.is_physical_key_pressed(KEY_SHIFT) else WALK
	var dir := (transform.basis * Vector3(r, 0, -f))
	dir.y = 0
	dir = dir.normalized() * speed if dir.length() > 0.01 else Vector3.ZERO
	velocity.x = dir.x; velocity.z = dir.z
	velocity.y = 0.0 if is_on_floor() else velocity.y - 9.8 * dt
	move_and_slide()
