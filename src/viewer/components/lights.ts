import * as THREE from '@viewer/three';

export function createLights() {
  const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x8d8d8d, 2);
  hemisphereLight.position.set(0, 100, 0);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(-0, 40, 50);

  return { hemisphereLight, directionalLight };
}
