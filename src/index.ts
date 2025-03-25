import * as THREE from 'three';
import fragmentShader from './soil-volume.frag.glsl';
import vertexShader from './soil-volume.vert.glsl';

/**
 * Uniforms used in soil volume shader.
 */
export type SoilShaderUniforms = {
  /** Volume texture */
  u_data: THREE.IUniform<THREE.Data3DTexture>,
  /** Color map texture */
  u_cmdata: THREE.IUniform<THREE.Texture>,
  /** Volume texture size */
  u_size: THREE.IUniform<THREE.Vector3>,
  /** ISO rendering threshold - selects the smallest particles for rendering */
  u_render_threshold: THREE.IUniform<number>,
  /** Minimum rendering distance - clips the model along XYZ axes from the origin */
  u_min_distance: THREE.IUniform<THREE.Vector3>,
  /** Maximum rendering distance - clips the model along XYZ axes from the maxima */
  u_max_distance: THREE.IUniform<THREE.Vector3>,
};

export type CreateSoilShaderMaterialParameters =
  Omit<THREE.ShaderMaterialParameters, 'uniforms' | 'vertexShader' | 'fragmentShader' | 'side' | 'glslVersion'>
  & {
    /** Volume texture */
    data: THREE.Data3DTexture,
    /** Color map texture */
    cmData: THREE.Texture,
    /** Volume texture size */
    size: THREE.Vector3,
    /** ISO rendering threshold - selects the smallest particles for rendering */
    renderThreshold?: number,
    /** Minimum rendering distance - clips the model along XYZ axes from the origin */
    minDistance?: THREE.Vector3,
    /** Maximum rendering distance - clips the model along XYZ axes from the maxima */
    maxDistance?: THREE.Vector3,
  };

/**
 * Creates shader material for rendering soil volume.
 */
function createSoilShaderMaterial({
  data,
  cmData,
  size,
  renderThreshold = 0,
  minDistance = new THREE.Vector3(0.0, 0.0, 0.0),
  maxDistance = new THREE.Vector3(1.0, 1.0, 1.0),
  ...parameters
}: CreateSoilShaderMaterialParameters): THREE.ShaderMaterial {
  const uniforms: SoilShaderUniforms = {
    u_data: {value: data},
    u_cmdata: {value: cmData},
    u_size: {value: size},
    u_render_threshold: {value: renderThreshold},
    u_min_distance: {value: minDistance},
    u_max_distance: {value: maxDistance},
  };

  return new THREE.RawShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    glslVersion: THREE.GLSL3,
    ...parameters,
  });
}

export default createSoilShaderMaterial;
