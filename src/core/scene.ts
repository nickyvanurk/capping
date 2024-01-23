import GUI from 'lil-gui';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import '@ui/style.css';

export class Scene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private cube: THREE.Mesh;

  constructor() {
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(71, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(5, 5, 5);

    window.addEventListener('resize', this.handleResize.bind(this), false);

    new OrbitControls(this.camera, this.renderer.domElement);

    // Green cube
    const cubeMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    this.cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), cubeMaterial);
    this.scene.add(this.cube);

    // Plane
    const planeGeo = new THREE.PlaneGeometry(100, 100);
    planeGeo.rotateX(-Math.PI / 2);
    const planeMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    const plane = new THREE.Mesh(planeGeo, planeMaterial);
    this.scene.add(plane);

    // Test GUI
    const gui = new GUI();
    const config = {
      clippingPlaneHeight: 0,
    };

    gui
      .add(config, 'clippingPlaneHeight', -10, 10, 0.01)
      .name('Clipping Plane')
      .onChange((value: number) => {
        plane.position.y = value;
      });
  }

  render() {
    requestAnimationFrame(this.render.bind(this));

    this.renderer.render(this.scene, this.camera);
  }

  handleResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
