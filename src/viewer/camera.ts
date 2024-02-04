import * as THREE from '@viewer/libs/three';

import type { Viewport } from './viewport';

export class Camera {
  instance: THREE.PerspectiveCamera;

  private controls: THREE.OrbitControls;

  constructor(
    private viewport: Viewport,
    canvas: HTMLCanvasElement
  ) {
    const aspect = viewport.width / viewport.height;
    const camera = new THREE.PerspectiveCamera(71, aspect, 0.1, 100000);
    camera.position.set(-106, 1254, 1118);
    this.instance = camera;

    const controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = false;
    controls.target.set(585, 249, 563);
    controls.update();
    this.controls = controls;
  }

  update() {
    if (this.controls.enableDamping) {
      this.controls.update();
    }
  }

  resize() {
    this.instance.aspect = this.viewport.width / this.viewport.height;
    this.instance.updateProjectionMatrix();
  }
}
