import type { PerspectiveCamera, WebGLRenderer } from 'three';

export class Resizer {
  constructor(container: HTMLDivElement, renderer: WebGLRenderer, camera: PerspectiveCamera) {
    setSize(container, renderer, camera);

    window.addEventListener('resize', () => {
      setSize(container, renderer, camera);
    });
  }
}

function setSize(container: HTMLDivElement, renderer: WebGLRenderer, camera: PerspectiveCamera) {
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
}
