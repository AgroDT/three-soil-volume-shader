import type {RolldownOptions} from 'rolldown';
import {dts} from 'rolldown-plugin-dts';

export default {
  input: {
    'agrodt-three-soil-volume-shader.min': 'src/index.ts',
  },
  external: ['three/webgpu', 'three/tsl'],
  plugins: [dts()],
  output: {
    format: 'esm',
    sourcemap: true,
    minify: true,
  },
} satisfies RolldownOptions;
