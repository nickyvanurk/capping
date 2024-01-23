import GUI from 'lil-gui';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

import '@ui/style.css';

export class Scene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private cube: THREE.Mesh;

  constructor() {
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.localClippingEnabled = true;
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(71, window.innerWidth / window.innerHeight, 0.1, 10000);
    this.camera.position.set(1500, 1200, 1500);

    window.addEventListener('resize', this.handleResize.bind(this), false);

    new OrbitControls(this.camera, this.renderer.domElement);

    // Clipping plane
    const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);

    // Green cube
    const cubeMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      side: THREE.DoubleSide,
      clippingPlanes: [plane],
    });
    this.cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), cubeMaterial);
    this.scene.add(this.cube);

    // Test GUI
    const gui = new GUI();
    const config = {
      clippingPlaneHeight: 0,
    };

    const axisHelper = new THREE.AxesHelper(2);
    this.scene.add(axisHelper);

    gui
      .add(config, 'clippingPlaneHeight', -10, 10, 0.01)
      .name('Clipping Plane')
      .onChange((value: number) => {
        plane.constant = value;
        axisHelper.position.y = value;
      });

    const fbxLoader = new FBXLoader();
    fbxLoader.load(
      '/house.fbx',
      (object) => this.scene.add(object),
      (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + '% loaded');
      },
      (error) => {
        console.log(error);
      }
    );
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
