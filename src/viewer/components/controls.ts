import * as THREE from '@viewer/three';

export function createControls(camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement) {
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.target.set(585, 249, 563);
  controls.update();
  return controls;
}
