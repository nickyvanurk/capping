import { PerspectiveCamera } from 'three';

export function createCamera() {
  const camera = new PerspectiveCamera(71, 1, 0.1, 100000);
  camera.position.set(-106, 1254, 1118);
  return camera;
}
