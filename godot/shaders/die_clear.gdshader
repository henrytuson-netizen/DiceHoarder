// See-through resin / gemstone dice.
shader_type spatial;
render_mode cull_back, depth_draw_always;
instance uniform vec3 tint : source_color = vec3(1.0);
uniform float rough = 0.06;
uniform float opacity = 0.62;
void fragment() {
	float f = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 3.0);
	ALBEDO = tint;
	ROUGHNESS = rough;
	SPECULAR = 0.7;
	CLEARCOAT = 1.0;
	ALPHA = clamp(opacity + f * 0.35, 0.0, 1.0);
}
