#version 300 es

uniform mat4 viewMatrix;
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

in vec3 position;

out vec4 v_nearpos;
out vec4 v_farpos;
out vec3 v_position;

void main() {
  // Prepare transforms to map to "camera view"
  mat4 viewtransformf = modelViewMatrix;
  mat4 viewtransformi = inverse(modelViewMatrix);

  // Project local vertex coordinate to camera position
  vec4 position4 = vec4(position, 1.0);
  vec4 pos_in_cam = viewtransformf * position4;

  // Apply the projection matrix
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * position4;

  // Compute the near and far clipping planes in camera space
  // Intersection of ray and near clipping plane (z = -1 in clip coords)
  pos_in_cam.z = -pos_in_cam.w;
  v_nearpos = viewtransformi * pos_in_cam;

  // Intersection of ray and far clipping plane (z = +1 in clip coords)
  pos_in_cam.z = pos_in_cam.w;
  v_farpos = viewtransformi * pos_in_cam;

  // Set varyings and output position
  v_position = position;
}
