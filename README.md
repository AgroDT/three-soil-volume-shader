# three-soil-volume-shader

A Three.js WebGPU volume renderer for soil volumetric data (CT scan results).

## Features

- Designed for normalized scalar soil CT volumes.
- Uses Three.js WebGPU and TSL nodes.
- Written in TypeScript.
- Exposes runtime uniforms for threshold and clipping updates.
- Keeps `three` as a peer dependency.
- Total gzipped size: 1.3&nbsp;KB.

## Installation

You can import this package directly through services like
[jsDelivr](https://www.jsdelivr.com/) or similar:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Soil Volume Example</title>
  </head>
  <body>
    <script type="importmap">
    {
      "imports": {
        "three/webgpu": "https://cdn.jsdelivr.net/npm/three/build/three.webgpu.min.js",
        "three/tsl": "https://cdn.jsdelivr.net/npm/three/build/three.tsl.min.js",
        "@agrodt/three-soil-volume-shader": "https://cdn.jsdelivr.net/npm/@agrodt/three-soil-volume-shader/dist/agrodt-three-soil-volume-shader.min.mjs"
      }
    }
    </script>
    <script type="module">
        import * as THREE from 'three/webgpu';
        import {createSoilVolume} from '@agrodt/three-soil-volume-shader';
        // Your code here
    </script>
  </body>
</html>
```

To use with bundlers, install the package using your preferred package manager:

```sh
npm add @agrodt/three-soil-volume-shader
# or
pnpm add @agrodt/three-soil-volume-shader
# or
yarn add @agrodt/three-soil-volume-shader
```

## Usage

Here is a basic example of how to use this package:

```typescript
import * as THREE from 'three/webgpu';
import {createSoilVolume} from '@agrodt/three-soil-volume-shader';

const volume: THREE.Data3DTexture = /* load your volume texture here */;
const palette: THREE.Texture = /* load your palette texture here */;

const {width, height, depth} = volume.image;
const size = new THREE.Vector3(width, height, depth);

const {material, uniforms} = createSoilVolume({
  volume,
  palette,
  size,
  threshold: 0.001,
});

const geometry = new THREE.BoxGeometry(1, 1, 1);
const mesh = new THREE.Mesh(geometry, material);
mesh.scale.copy(size);

const scene = new THREE.Scene();
scene.add(mesh);

const renderer = new THREE.WebGPURenderer();
await renderer.init();

uniforms.threshold.value = 0.25;
```

The renderer uses a cube mesh as a proxy volume. The cube should use local
coordinates from `-0.5` to `0.5` on each axis, which is the default for
`THREE.BoxGeometry(1, 1, 1)`. Scale the mesh separately to match the dimensions
represented by the 3D texture.

`createSoilVolume` configures the provided three.js textures for this renderer.
Clone shared textures before passing them to the function when those textures
must keep different sampling settings elsewhere.

This package is designed to be used with
[@agrodt/three-zstd-volume-loader](https://github.com/AgroDT/three-zstd-volume-loader)
for data loading. For a complete example, see
[@agrodt/three-soil-volume-example](https://github.com/AgroDT/three-soil-volume-example).

## License

This project is licensed under the MIT License.

## Contributing

Contributions are welcome!
