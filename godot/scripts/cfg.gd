## Layout, shared with the web version (metres, +x east, +z south, y up).
class_name Cfg

const WALL_H := 3.2
const MAIN_W := 17.0
const MAIN_D := 8.2
const BACK_X0 := 6.0
const BACK_Z1 := 13.2
const DIVIDER_Z := 8.2
const DOOR_X := 9.8
const DOOR_W := 1.2

const TABLE_LEN := 1.25
const TABLE_DEPTH := 0.85
## 11 pairs x 2 tables x 15 slots = 330 slots
const TABLE_PAIRS: Array[Vector2] = [
	Vector2(2.2, 1.5), Vector2(5.9, 1.5), Vector2(9.6, 1.5), Vector2(13.3, 1.5),
	Vector2(2.2, 3.9), Vector2(5.9, 3.9), Vector2(9.6, 3.9), Vector2(13.3, 3.9),
	Vector2(1.9, 6.4), Vector2(5.3, 6.4), Vector2(8.7, 6.4),
]
## + 72 wall-rack slots = 402
const WALL_RACKS := [
	{"model": "WallRack11", "pos": Vector3(6.07, 0, 10.6), "ry": PI / 2},
	{"model": "WallRack7", "pos": Vector3(8.3, 0, 13.13), "ry": PI},
]
const COUNTER := Vector3(13.9, 0, 5.75)
const DESK := Vector3(14.8, 0, 12.5)
const CARPET := Rect2(12.4, 8.8, 4.0, 2.6)
const BASEMENT := Vector3(9.4, 0, 10.9)

const DIE_R := 0.03
const TOTAL_SETS := 402
const START := Vector3(0.7, 0, 2.7)
const START_LOOK := Vector3(9.0, 0.9, 2.9)

## Windows: [wall, centre along wall, sill height, width, height]
const WINDOWS := [
	["N", 2.6], ["N", 7.0], ["N", 11.0], ["N", 15.0],
	["E", 2.6], ["E", 10.5], ["W", 4.0],
]

static func tables() -> Array[Vector3]:
	var out: Array[Vector3] = []
	for p in TABLE_PAIRS:
		out.append(Vector3(p.x - TABLE_LEN / 2, 0, p.y))
		out.append(Vector3(p.x + TABLE_LEN / 2, 0, p.y))
	return out

## Floor areas dice must not be scattered on (tables, counter, desk, racks).
static func blockers() -> Array[Rect2]:
	var out: Array[Rect2] = []
	for p in TABLE_PAIRS:
		out.append(Rect2(p.x - TABLE_LEN - 0.02, p.y - TABLE_DEPTH / 2 - 0.02, TABLE_LEN * 2 + 0.04, TABLE_DEPTH + 0.04))
	out.append(Rect2(10.9, 5.29, 6.0, 0.92))
	out.append(Rect2(10.9, 6.2, 1.0, 1.4))
	out.append(Rect2(13.2, 11.9, 3.2, 1.2))
	out.append(Rect2(6.0, 8.35, 0.9, 4.5))
	out.append(Rect2(6.85, 12.3, 2.9, 0.9))
	return out

static func floor_free(x: float, z: float, margin: float) -> bool:
	if x < 0.35 or x > MAIN_W - 0.35 or z < 0.35 or z > BACK_Z1 - 0.35:
		return false
	if absf(z - DIVIDER_Z) < 0.25:
		return false
	if z > DIVIDER_Z and x < BACK_X0 + 0.35:
		return false
	for r in blockers():
		if x > r.position.x - margin and x < r.end.x + margin and z > r.position.y - margin and z < r.end.y + margin:
			return false
	return true
