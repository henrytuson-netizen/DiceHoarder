// One material per dice material type; each die sets its own colour via an instance uniform.
shader_type spatial;
render_mode cull_back;
instance uniform vec3 tint : source_color = vec3(1.0);
uniform float rough = 0.5;
uniform float metal = 0.0;
uniform float coat = 0.0;
uniform float shimmer = 0.0;   // iridescent "special" dice
void fragment() {
	vec3 c = tint;
	if (shimmer > 0.0) {
		float f = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 2.0);
		c = mix(c, 0.5 + 0.5 * cos(6.2831 * (f + vec3(0.0, 0.33, 0.67))), f * shimmer);
	}
	ALBEDO = c;
	ROUGHNESS = rough;
	METALLIC = metal;
	CLEARCOAT = coat;
	CLEARCOAT_ROUGHNESS = 0.15;
}
