import { DirectionalLight, HemisphereLight } from 'three';

export function createLights() {
  const hemisphereLight = new HemisphereLight(0xffffff, 0x8d8d8d, 2);
  hemisphereLight.position.set(0, 100, 0);

  const directionalLight = new DirectionalLight(0xffffff, 1);
  directionalLight.position.set(-0, 40, 50);

  return { hemisphereLight, directionalLight };
}
