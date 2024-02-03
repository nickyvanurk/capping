import type { Object3D, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { Clock } from 'three';

export class Loop {
  updatables: Object3D[] = [];

  private clock = new Clock();

  constructor(
    public renderer: WebGLRenderer,
    public scene: Scene,
    public camera: PerspectiveCamera
  ) {}

  start() {
    this.renderer.setAnimationLoop(() => {
      this.tick();
      this.renderer.render(this.scene, this.camera);
    });
  }

  stop() {
    this.renderer.setAnimationLoop(null);
  }

  tick() {
    const delta = this.clock.getDelta();

    for (let i = 0; i < this.updatables.length; i++) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      //@ts-ignore
      this.updatables[i].tick(delta);
    }
  }
}
