# three-soil-volume-shader

A Three.js shader for rendering soil volumetric data (CT scan results).

## Features

- This shader is specifically optimized for soil CT scans.
- Written in TypeScript
- Zero dependencies
- Total gzipped size: 1.61&nbsp;KB

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
        "three": "https://cdn.jsdelivr.net/npm/three/build/three.module.min.js",
        "@agrodt/three-soil-volume-shader": "https://esm.run/@agrodt/three-soil-volume-shader"
      }
    }
    </script>
    <script type="module">
        import * as THREE from 'three';
        import createSoilShaderMaterial from '@agrodt/three-soil-volume-shader';
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
import * as THREE from 'three';
import createSoilShaderMaterial from 'three-soil-volume-shader';

const texture: THREE.Data3DTexture = /* load your volume texture here */;
const cmData: THREE.Texture = /* load your color map texture here */;

const {width, height, depth} = texture.image;

const geometry = new THREE.BoxGeometry(width, height, depth)
  .translate(width / 2, height / 2, depth / 2);

const material = createSoilShaderMaterial({
  data: texture,
  size: new THREE.Vector3(width, height, depth),
  cmData,
  renderThreshold: 0.001,
});

const scene = new THREE.Scene();
scene.add(new THREE.Mesh(geometry, material));
```

This package is designed to be used with
[@agrodt/three-zstd-volume-loader](https://github.com/AgroDT/three-zstd-volume-loader)
for data loading. For a complete example, see
[@agrodt/three-soil-volume-example](https://github.com/AgroDT/three-soil-volume-example).

## License

This project is licensed under the MIT License.

## Contributing

Contributions are welcome!
