import * as THREE from '@viewer/libs/three';

export class Environment {
  object = new THREE.Group();

  constructor() {
    this.addLights();
  }

  private addLights() {
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x8d8d8d, 2);
    hemisphereLight.position.set(0, 100, 0);
    this.object.add(hemisphereLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(-0, 40, 50);
    this.object.add(directionalLight);
  }
}
