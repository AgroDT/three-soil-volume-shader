import type { RolldownOptions } from 'rolldown';

export default {
  input: 'src/index.ts',
  external: ['three/webgpu', 'three/tsl'],
  output: {
    format: 'esm',
    file: 'dist/agrodt-three-soil-volume-shader.min.mjs',
    sourcemap: true,
    minify: true,
  },
} satisfies RolldownOptions;
