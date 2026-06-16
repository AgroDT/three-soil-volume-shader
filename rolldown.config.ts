import glsl from 'rollup-plugin-glsl-optimize';
import type { RolldownOptions } from 'rolldown';
import { replacePlugin } from 'rolldown/plugins';

export default {
  input: 'src/index.ts',
  external: ['three'],
  output: {
    format: 'esm',
    file: 'dist/agrodt-three-soil-volume-shader.min.mjs',
    sourcemap: true,
    minify: true,
    globals: { three: 'THREE' },
  },
  plugins: [
    glsl(),
    replacePlugin(
      // #version is required for the optimizer, but leads to an error in runtime
      { '#version 300 es\\n': '' },
      {
        preventAssignment: true,
        delimiters: ['', ''],
      },
    ),
  ]
} satisfies RolldownOptions;
