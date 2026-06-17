/**
 * A Three.js WebGPU volume renderer for soil volumetric data (CT scan results).
 *
 * @packageDocumentation
 */

import * as THREE from 'three/webgpu';

import {
  Break,
  Discard,
  Fn,
  If,
  Loop,
  bool,
  cameraPosition,
  clamp,
  dot,
  float,
  max,
  min,
  modelWorldMatrixInverse,
  normalize,
  positionLocal,
  texture,
  texture3D,
  uniform,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';

/**
 * Parameters for creating a soil tomography volume renderer.
 *
 * @remarks
 * {@link createSoilVolume} configures the provided three.js objects for this
 * renderer. Clone shared textures or vectors before passing them here when the
 * original objects must keep their existing renderer settings or runtime state.
 */
export type SoilVolumeOptions = {
  /**
   * Source 3D texture with normalized scalar values.
   *
   * @remarks
   * The texture is expected to contain values in the `0..1` range.
   * Values below or equal to {@link SoilVolumeOptions.threshold} are treated
   * as empty space. Values above {@link SoilVolumeOptions.threshold} are
   * treated as soil material and mapped to the palette texture.
   */
  volume: THREE.Data3DTexture;

  /**
   * Texture used to color visible scalar values.
   *
   * @remarks
   * The renderer samples the palette at `u = scalarValue` and `v = 0.5`, so the
   * texture should contain the intended color ramp horizontally:
   *
   * - low values sample the left side of the palette.
   * - high values sample the right side of the palette.
   */
  palette: THREE.Texture;

  /**
   * Size of the 3D texture in voxels.
   *
   * @remarks
   * The renderer uses this value to convert gradient sampling distance from
   * voxel units to normalized texture coordinates. Applications can also use
   * this value to scale the proxy cube mesh to the physical volume dimensions.
   */
  size: THREE.Vector3;

  /**
   * Material threshold.
   *
   * @remarks
   * Voxels with values less than or equal to this threshold are treated as
   * empty space. The first value above this threshold along the ray is treated
   * as the visible surface.
   *
   * Expected to be in the same scalar range as {@link SoilVolumeOptions.volume}.
   *
   * @defaultValue 0
   */
  threshold?: number;

  /**
   * Minimum clipping bounds in normalized texture space.
   *
   * @remarks
   * Each component is expected to be in the `0..1` range and less than or equal
   * to the corresponding component of {@link SoilVolumeOptions.clipMax}.
   *
   * For example, `clipMin.z = 0.2` and `clipMax.z = 0.8` keep only the middle
   * part of the volume along the Z axis.
   *
   * @defaultValue `new THREE.Vector3(0, 0, 0)`
   */
  clipMin?: THREE.Vector3;

  /**
   * Maximum clipping bounds in normalized texture space.
   *
   * @remarks
   * Each component is expected to be in the `0..1` range and greater than or
   * equal to the corresponding component of {@link SoilVolumeOptions.clipMin}.
   *
   * @defaultValue `new THREE.Vector3(1, 1, 1)`
   */
  clipMax?: THREE.Vector3;

  /**
   * Number of coarse raymarching steps through the volume.
   *
   * @remarks
   * Higher values improve surface detection quality, especially for thin or
   * detailed structures, but increase fragment shader cost.
   *
   * This is a shader-generation parameter. Changing it requires recreating the
   * material.
   *
   * Must be a positive integer.
   *
   * @defaultValue 192
   */
  steps?: number;

  /**
   * Number of refinement steps after the coarse raymarch detects a possible hit.
   *
   * @remarks
   * Higher values make the detected surface position more stable and precise,
   * but add extra texture reads near the hit point.
   *
   * This is a shader-generation parameter. Changing it requires recreating the
   * material.
   *
   * Must be a positive integer.
   *
   * @defaultValue 4
   */
  refinementSteps?: number;

  /**
   * Lower threshold used during the coarse raymarching pass.
   *
   * @remarks
   * The rough pass uses `threshold - thresholdSoftness` to avoid skipping thin
   * surfaces between two coarse samples. The final hit is still accepted only
   * when the refined value is above the real `threshold`.
   *
   * This is a shader-generation parameter. Changing it requires recreating the
   * material.
   *
   * Must be non-negative.
   *
   * @defaultValue 0.02
   */
  thresholdSoftness?: number;

  /**
   * Distance between neighboring samples used for gradient-based normal
   * estimation, measured in voxels.
   *
   * @remarks
   * Larger values produce smoother normals. Smaller values preserve more local
   * detail but can make lighting noisier.
   *
   * Must be positive.
   *
   * @defaultValue 1.5
   */
  gradientVoxelStep?: number;

  /**
   * Constant ambient light contribution.
   *
   * @remarks
   * This is a simple readability control, not a physically based lighting
   * parameter.
   *
   * Expected to be non-negative.
   *
   * @defaultValue 0.45
   */
  ambient?: number;

  /**
   * View-dependent diffuse light contribution.
   *
   * @remarks
   * This makes the reconstructed soil structure easier to read by emphasizing
   * local surface orientation.
   *
   * Expected to be non-negative.
   *
   * @defaultValue 0.55
   */
  diffuse?: number;
};

/**
 * Public uniforms exposed by the volume renderer.
 *
 * These values can be changed without recreating the mesh or material.
 */
export type SoilVolumeUniforms = {
  /**
   * Runtime material threshold.
   *
   * Values below or equal to this threshold are considered empty.
   */
  threshold: THREE.UniformNode<'float', number>;

  /**
   * Minimum clipping bounds in normalized texture space.
   *
   * Components correspond to `x`, `y`, and `z` axes.
   */
  clipMin: THREE.UniformNode<'vec3', THREE.Vector3>;

  /**
   * Maximum clipping bounds in normalized texture space.
   *
   * Components correspond to `x`, `y`, and `z` axes.
   */
  clipMax: THREE.UniformNode<'vec3', THREE.Vector3>;
};

/**
 * Result returned by {@link createSoilVolume}.
 */
export type SoilVolume = {
  /**
   * Node material to assign to a cube mesh used as the proxy volume.
   */
  material: THREE.MeshBasicNodeMaterial;

  /**
   * Runtime uniforms that can be updated by the application.
   */
  uniforms: SoilVolumeUniforms;
};

/**
 * Creates a material and runtime uniforms for rendering a soil volume.
 *
 * @remarks
 * The renderer uses a cube mesh as a proxy volume. The fragment shader casts a
 * ray through the 3D texture, finds the first scalar value above the threshold,
 * maps that value to the provided palette texture, estimates a local normal from
 * the volume field, and applies simple readability lighting.
 *
 * The proxy cube is expected to use local coordinates from `-0.5` to `0.5` on
 * each axis. Scale that mesh separately when the rendered object should match
 * the physical dimensions represented by {@link SoilVolumeOptions.size}.
 *
 * This function assumes ownership of the provided three.js objects for renderer
 * configuration. It updates texture sampling parameters and marks textures for
 * upload. Clone shared textures or vectors before calling this function when
 * those objects must retain different settings elsewhere.
 *
 * @returns A node material for the proxy cube and uniforms that can be updated
 * at runtime without recreating the material.
 *
 * @example Creating a proxy mesh
 * ```typescript
 * const size = new THREE.Vector3(width, height, depth);
 * const {material, uniforms} = createSoilVolume({volume, palette, size});
 *
 * const geometry = new THREE.BoxGeometry(1, 1, 1);
 * const mesh = new THREE.Mesh(geometry, material);
 * mesh.scale.copy(size);
 *
 * uniforms.threshold.value = 0.25;
 * ```
 */
export function createSoilVolume({
  volume,
  palette,
  size,
  threshold = 0,
  clipMin,
  clipMax,
  steps = 192,
  refinementSteps = 4,
  thresholdSoftness = 0.02,
  gradientVoxelStep = 1.5,
  ambient = 0.45,
  diffuse = 0.55,
}: SoilVolumeOptions): SoilVolume {
  prepareVolumeTexture(volume);
  preparePaletteTexture(palette);

  const uniforms: SoilVolumeUniforms = {
    threshold: uniform(threshold),
    clipMin: uniform(clipMin ?? new THREE.Vector3(0, 0, 0)),
    clipMax: uniform(clipMax ?? new THREE.Vector3(1, 1, 1)),
  };

  const material = new THREE.MeshBasicNodeMaterial({
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  });

  material.fragmentNode = createFragmentNode({
    volume,
    palette,
    steps,
    refinementSteps,
    thresholdSoftness,
    gradientVoxelStep,
    ambient,
    diffuse,
    ...uniforms,
    size: uniform(size),
  });

  return {
    material,
    uniforms,
  };
}

function prepareVolumeTexture(texture: THREE.Data3DTexture): void {
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.wrapR = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
}

function preparePaletteTexture(texture: THREE.Texture): void {
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
}

type FragmentNodeFnArgs = SoilVolumeUniforms & {
  volume: THREE.Data3DTexture;
  size: THREE.UniformNode<'vec3', THREE.Vector3>;
  palette: THREE.Texture;
  steps: number;
  refinementSteps: number;
  thresholdSoftness: number;
  gradientVoxelStep: number;
  ambient: number;
  diffuse: number;
};

const createFragmentNode = Fn<FragmentNodeFnArgs, THREE.Node>(({
  volume,
  size,
  palette,
  steps,
  refinementSteps,
  thresholdSoftness,
  gradientVoxelStep,
  ambient,
  diffuse,
  threshold,
  clipMin,
  clipMax,
}) => {
  // Ray setup: transform the camera position into the local space of the volume cube.
  const rayOrigin = modelWorldMatrixInverse
    .mul(vec4(cameraPosition, 1))
    .xyz
    .toVar('rayOrigin');

  // Ray setup: build the ray direction from the camera to the current back-face fragment.
  const rayDirection = normalize(positionLocal.sub(rayOrigin)).toVar('rayDirection');

  // Clipping setup: convert user clipping bounds from texture space [0..1]
  // to local cube space [-0.5..0.5].
  const boxMin = clipMin.sub(0.5).toVar('boxMin');
  const boxMax = clipMax.sub(0.5).toVar('boxMax');

  // Ray-box intersection: compute intersections against all three axis slabs.
  const t0 = boxMin.sub(rayOrigin).div(rayDirection).toVar('t0');
  const t1 = boxMax.sub(rayOrigin).div(rayDirection).toVar('t1');

  // Ray-box intersection: select near and far slab distances per axis.
  const tMin3 = min(t0, t1).toVar('tMin3');
  const tMax3 = max(t0, t1).toVar('tMax3');

  // Ray-box intersection: collapse per-axis distances into one valid ray segment.
  const tNear = max(max(tMin3.x, tMin3.y), tMin3.z).max(0).toVar('tNear');
  const tFar = min(min(tMax3.x, tMax3.y), tMax3.z).toVar('tFar');

  // Early reject: discard fragments whose rays do not cross the clipped volume box.
  If(tNear.greaterThanEqual(tFar), () => {
    Discard();
  });

  // March setup: split the visible ray segment into a fixed number of samples.
  const rayLength = tFar.sub(tNear).toVar('rayLength');
  const rayStep = rayDirection.mul(rayLength.div(float(steps))).toVar('rayStep');

  // March setup: convert the first sample position from local cube space
  // to normalized texture space.
  const texturePosition = rayOrigin
    .add(rayDirection.mul(tNear))
    .add(0.5)
    .toVar('texturePosition');

  // Refinement setup: use smaller steps around the first rough hit.
  const refinementStep = rayStep.div(float(refinementSteps)).toVar('refinementStep');

  // Threshold setup: use a lower rough threshold to avoid missing thin surfaces.
  const roughThreshold = threshold.sub(thresholdSoftness).toVar('roughThreshold');

  // Hit state: store whether the ray has already found a visible surface.
  const hit = bool(false).toVar('hit');

  // Hit state: store the final color for the first accepted surface hit.
  const result = vec4(0, 0, 0, 0).toVar('result');

  // Normal setup: convert the gradient sampling step from voxel units
  // to normalized texture coordinates.
  const gradientStep = vec3(gradientVoxelStep).div(size).toVar('gradientStep');

  // Coarse raymarch: walk through the clipped volume until the first candidate
  // material boundary is found.
  Loop(steps, () => {
    If(hit, () => {
      Break();
    });

    // Coarse sample: read the normalized granulometric value from the volume.
    const value = texture3D(volume, texturePosition).r.toVar('value');

    // Candidate detection: enter refinement only near a possible visible surface.
    If(value.greaterThan(roughThreshold), () => {
      const refinedPosition = texturePosition
        .sub(rayStep.mul(0.5))
        .toVar('refinedPosition');

      // Hit refinement: resample with smaller steps around the rough hit.
      Loop(refinementSteps, () => {
        If(hit, () => {
          Break();
        });

        // Refined sample: read the candidate surface value.
        const refinedValue = texture3D(volume, refinedPosition).r.toVar('refinedValue');

        // Surface acceptance: accept only points above the real material threshold.
        If(refinedValue.greaterThan(threshold), () => {
          // Normal estimation: sample neighboring values along the X axis.
          const dx0 = texture3D(volume, refinedPosition.sub(vec3(gradientStep.x, 0, 0))).r;
          const dx1 = texture3D(volume, refinedPosition.add(vec3(gradientStep.x, 0, 0))).r;

          // Normal estimation: sample neighboring values along the Y axis.
          const dy0 = texture3D(volume, refinedPosition.sub(vec3(0, gradientStep.y, 0))).r;
          const dy1 = texture3D(volume, refinedPosition.add(vec3(0, gradientStep.y, 0))).r;

          // Normal estimation: sample neighboring values along the Z axis.
          const dz0 = texture3D(volume, refinedPosition.sub(vec3(0, 0, gradientStep.z))).r;
          const dz1 = texture3D(volume, refinedPosition.add(vec3(0, 0, gradientStep.z))).r;

          // Normal estimation: build a scalar-field gradient normal.
          const normal = normalize(
            vec3(
              dx0.sub(dx1),
              dy0.sub(dy1),
              dz0.sub(dz1),
            ),
          ).toVar('normal');

          // Lighting setup: orient the normal toward the camera to avoid unstable
          // one-sided lighting when the gradient direction flips.
          const viewDirection = rayDirection.negate().toVar('viewDirection');

          If(dot(normal, viewDirection).lessThan(0), () => {
            normal.mulAssign(-1);
          });

          // Palette mapping: use the granulometric value as a horizontal coordinate
          // in the user-provided palette texture.
          const paletteValue = clamp(refinedValue, 0, 1).toVar('paletteValue');
          const color = texture(palette, vec2(paletteValue, 0.5)).toVar('color');

          // Lighting: apply simple view-dependent diffuse shading to make local
          // soil structure easier to read.
          const light = max(dot(normal, viewDirection), 0)
            .mul(diffuse)
            .add(ambient)
            .toVar('light');

          // Output: store the shaded palette color and stop all remaining work.
          result.assign(vec4(color.rgb.mul(light), color.a));
          hit.assign(bool(true));
        });

        // Hit refinement: advance to the next refined sample.
        refinedPosition.addAssign(refinementStep);
      });
    });

    // Coarse raymarch: advance to the next sample.
    texturePosition.addAssign(rayStep);
  });

  // Empty ray handling: invisible fragment if no material was hit.
  If(hit.not(), () => {
    Discard();
  });

  return result;
});
