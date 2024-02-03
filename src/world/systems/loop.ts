import type { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { Clock } from 'three';

export class Loop {
  constructor(
    public renderer: WebGLRenderer,
    public scene: Scene,
    public camera: PerspectiveCamera
  ) {}

  start() {
    this.renderer.setAnimationLoop(() => {
      this.renderer.render(this.scene, this.camera);
    });
  }

  stop() {
    this.renderer.setAnimationLoop(null);
  }
}
