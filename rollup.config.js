import glsl from 'rollup-plugin-glsl-optimize';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import replace from '@rollup/plugin-replace';

/** @type {import('rollup').RollupOptions} */
export default {
  input: 'src/index.ts',
  external: ['three'],
  output: {
    format: 'esm',
    file: 'dist/agrodt-three-soil-volume-shader.min.mjs',
    sourcemap: true,
    globals: {three: 'THREE'},
  },
  plugins: [
    typescript(),
    glsl(),
    replace({
      preventAssignment: true,
      delimiters: ['', ''],
      // #version is required for the optimizer, but leads to an error in runtime
      values: {'#version 300 es\\n': ''},
    }),
    terser(),
  ]
}
