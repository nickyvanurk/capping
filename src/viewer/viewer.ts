import * as THREE from '@viewer/libs/three';

import { GUI } from './gui';
import { Loop } from './utils';
import { World } from './world';

const config = {
  clippingPlaneHeight: 200,
  meshWireframe: false,
  capWireframe: false,
  model: 'house.fbx',
};

export class Viewer {
  domElement: HTMLElement;

  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private loop: Loop;
  private controls: THREE.OrbitControls;
  private gui: GUI;

  private world: World;

  constructor(container?: HTMLElement) {
    this.domElement = container ? container : document.createElement('div');

    if (!container) {
      this.domElement.id = 'viewer';
      this.domElement.style.width = '100%';
      this.domElement.style.height = '100%';
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.localClippingEnabled = true;
    renderer.setClearColor(0x131a29);
    this.domElement.appendChild(renderer.domElement);
    this.renderer = renderer;

    const world = new World(config);
    this.world = world;

    const camera = new THREE.PerspectiveCamera(71, 1, 0.1, 100000);
    camera.position.set(-106, 1254, 1118);
    this.camera = camera;

    const resizeObserver = new ResizeObserver(this.resize.bind(this));
    resizeObserver.observe(this.domElement);

    const loop = new Loop();
    loop.onTick(this.render.bind(this));
    this.loop = loop;

    const controls = new THREE.OrbitControls(camera, this.renderer.domElement);
    controls.target.set(585, 249, 563);
    controls.update();
    this.controls = controls;

    const gui = new GUI(this.domElement);
    gui.settings
      .add(config, 'clippingPlaneHeight', -2000, 2000, 0.1)
      .name('Clipping Plane')
      .onChange((value: number) => this.world.setPlaneConstant(value))
      .onFinishChange(async () => this.world.generateCaps());
    gui.settings
      .add(config, 'meshWireframe')
      .name('Mesh Wireframe')
      .onChange((visible: boolean) => this.world.meshWireframeVisible(visible));
    gui.settings
      .add(config, 'capWireframe')
      .name('Cap Wireframe')
      .onChange((visible: boolean) => this.world.capWireframeVisible(visible));
    gui.settings
      .add(config, 'model', ['house.fbx', 'building.fbx', 'blizzard.fbx'])
      .name('Model')
      .onChange(async (filename: string) => {
        const model = await this.loadModel(filename);
        this.world.displayModel(model);
      });
    this.gui = gui;

    const loadingManager = THREE.DefaultLoadingManager;
    loadingManager.onProgress = async (_url, itemsLoaded, itemsTotal) => {
      const percent = Math.floor((itemsLoaded / itemsTotal) * 100);
      if (percent === 100) {
        const loadingScreen = document.querySelector('.loadingScreen') as HTMLElement;
        const loadingBar = document.querySelector('.bar') as HTMLElement;

        loadingBar.style.width = `${100}%`;
        loadingScreen.style.transition = 'opacity 0.5s ease-in 0.25s';

        setTimeout(() => {
          loadingScreen.style.opacity = '0';
        }, 500); // Delay, otherwise the transition is not triggered for some reason.

        setTimeout(() => {
          loadingBar.style.width = `${0}%`;
          const newZ = loadingScreen.style.zIndex === '99' ? '-1' : '99';
          loadingScreen.style.zIndex = newZ;
        }, 1250); // 500 + total transition time
      }
    };
  }

  async init() {
    this.resize();

    const model = await this.loadModel('house.fbx');
    this.world.displayModel(model);
  }

  async loadModel(filename: string) {
    const loadingScreen = document.querySelector('.loadingScreen') as HTMLElement;
    loadingScreen.style.transition = 'none';
    loadingScreen.style.opacity = '1';
    loadingScreen.style.zIndex = '99';

    const fbxLoader = new THREE.FBXLoader();
    const model = await fbxLoader.loadAsync(import.meta.env.BASE_URL + filename, ({ loaded, total }) => {
      const loadingBar = document.querySelector('.bar') as HTMLElement;
      const percent = Math.floor((loaded / (total - 1)) * 90);
      loadingBar.style.width = `${percent}%`;
    });
    return model;
  }

  render(delta = 0) {
    this.gui.stats.update(this.renderer, delta);
    this.renderer.render(this.world.scene, this.camera);
  }

  resize() {
    this.renderer.setSize(this.domElement.clientWidth, this.domElement.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.camera.aspect = this.domElement.clientWidth / this.domElement.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.world.scene, this.camera);
  }

  start() {
    this.loop.start();
  }

  stop() {
    this.loop.stop();
  }
}
