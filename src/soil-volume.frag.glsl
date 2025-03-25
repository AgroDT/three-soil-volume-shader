#version 300 es

precision highp float;
precision mediump sampler3D;

uniform sampler3D u_data;
uniform sampler2D u_cmdata;

uniform vec3 u_size;
uniform float u_render_threshold;

// Distances to clipping planes
uniform vec3 u_min_distance;
uniform vec3 u_max_distance;

in vec3 v_position;
in vec4 v_nearpos;
in vec4 v_farpos;

out vec4 fragColor;

// The maximum distance through our rendering volume is sqrt(3).
const int REFINEMENT_STEPS = 4;
const float RELATIVE_STEP_SIZE = 1.0;

void cast_iso(vec3 start_loc, vec3 step, int nsteps, vec3 view_ray);
float sample1(vec3 texcoords);
vec4 apply_colormap(float val);
vec4 add_lighting(float val, vec3 loc, vec3 step, vec3 view_ray);

void main() {
  // Normalize clipping plane info
  vec3 farpos = v_farpos.xyz / v_farpos.w;
  vec3 nearpos = v_nearpos.xyz / v_nearpos.w;

  // Calculate unit vector pointing in the view direction through this fragment.
  vec3 view_ray = normalize(nearpos.xyz - farpos.xyz);

  // Compute the (negative) distance to the front surface or near clipping plane.
  vec3 distance = vec3(dot(nearpos - v_position, view_ray));
  distance = max(distance, min((-0.5 - v_position) / view_ray, (u_size - 0.5 - v_position) / view_ray));
  float max_distance = max(distance.x, max(distance.y, distance.z));

  // Now we have the starting position on the front surface
  vec3 front = v_position + view_ray * max_distance;

  // Decide how many steps to take
  int nsteps = int(-max_distance / RELATIVE_STEP_SIZE + 0.5);
  if(nsteps < 1) {
    discard;
  }

  // Get starting location and step vector in texture coordinates
  vec3 step = ((v_position - front) / u_size) / float(nsteps);
  vec3 start_loc = front / u_size;

  cast_iso(start_loc, step, nsteps, view_ray);

  if(fragColor.a < 0.05) {
    discard;
  }
}

float sample1(vec3 texcoords) {
  /* Sample float value from a 3D texture. Assumes intensity data. */
  return texture(u_data, texcoords.xyz).r;
}

vec4 apply_colormap(float val) {
  return texture(u_cmdata, vec2(val, 0.5));
}

void cast_iso(vec3 start_loc, vec3 step, int nsteps, vec3 view_ray) {
  fragColor = vec4(0.0);	// init transparent
  vec3 dstep = 1.5 / u_size;	// step to sample derivative
  vec3 loc = start_loc;

  float low_threshold = u_render_threshold - 0.02;

  // Enter the raycasting loop.
  for(int iter = 0; iter < nsteps; iter++) {
    // Discard the fragment if it lies on the opposite side of the clipping plane
    if(any(lessThan(loc, u_min_distance)) || any(greaterThan(loc, u_max_distance))) {
      loc += step;
      continue;
    }

    // Sample from the 3D texture
    float val = sample1(loc);

    if(val > low_threshold) {
      // Take the last interval in smaller steps
      vec3 iloc = loc - 0.5 * step;
      vec3 istep = step / float(REFINEMENT_STEPS);
      for(int i = 0; i < REFINEMENT_STEPS; i++) {
        val = sample1(iloc);
        if(val > u_render_threshold) {
          fragColor = add_lighting(val, iloc, dstep, view_ray);
          return;
        }
        iloc += istep;
      }
    }

    // Advance location deeper into the volume
    loc += step;
  }
}

vec4 add_lighting(float val, vec3 loc, vec3 step, vec3 view_ray) {
  // Calculate color by incorporating lighting

  // View direction
  vec3 V = normalize(view_ray);

  // Calculate normal vector from gradient
  vec3 N;
  float val1, val2;
  val1 = sample1(loc + vec3(-step[0], 0.0, 0.0));
  val2 = sample1(loc + vec3(+step[0], 0.0, 0.0));
  N[0] = val1 - val2;
  val = max(max(val1, val2), val);
  val1 = sample1(loc + vec3(0.0, -step[1], 0.0));
  val2 = sample1(loc + vec3(0.0, +step[1], 0.0));
  N[1] = val1 - val2;
  val = max(max(val1, val2), val);
  val1 = sample1(loc + vec3(0.0, 0.0, -step[2]));
  val2 = sample1(loc + vec3(0.0, 0.0, +step[2]));
  N[2] = val1 - val2;
  val = max(max(val1, val2), val);

  N = normalize(N);

  // Flip normal so it points towards viewer
  float Nselect = float(dot(N, V) > 0.0);
  N = (2.0 * Nselect - 1.0) * N;

  // Light direction
  vec3 L = vec3(V.x, V.y, V.z);  // Light direction
  L = normalize(L);

  // Ambient, Diffuse, and Specular terms
  vec4 ambient_color = vec4(0.45, 0.45, 0.45, 1.0);  // Ambient light color
  vec4 diffuse_color = vec4(0.36, 0.36, 0.36, 1.0);  // Diffuse light color

  // Lambertian diffuse reflection (diffuse shading)
  float diff = max(dot(N, L), 0.0);

  // Combine the components: Ambient + Diffuse
  vec4 color = apply_colormap(val);
  vec4 final_color = color * (ambient_color + diffuse_color * diff);

  final_color.a = color.a;  // Set alpha to the original texture alpha

  return final_color;
}
