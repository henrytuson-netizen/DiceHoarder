shader_type spatial;
instance uniform vec3 ink : source_color = vec3(1.0);
void fragment() { ALBEDO = ink; ROUGHNESS = 0.55; }
