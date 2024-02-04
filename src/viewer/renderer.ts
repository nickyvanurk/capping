import * as THREE from '@viewer/libs/three';

import type { Camera } from './camera';
import type { Viewport } from './viewport';

export class Renderer {
  instance: THREE.WebGLRenderer;
  canvas: HTMLCanvasElement;

  constructor() {
    const canvas = document.createElement('canvas');
    this.canvas = canvas;

    const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
    renderer.localClippingEnabled = true;
    renderer.setClearColor(0x131a29);
    this.instance = renderer;
  }

  render(scene: THREE.Scene, camera: Camera) {
    this.instance.render(scene, camera.instance);
  }

  resize(viewport: Viewport) {
    this.instance.setSize(viewport.width, viewport.height);
    this.instance.setPixelRatio(viewport.dpr);
  }
}
