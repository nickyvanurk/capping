import * as THREE from '@viewer/libs/three';

import { Camera } from './camera';
import { GUI } from './gui';
import { Renderer } from './renderer';
import { Loop } from './utils';
import { Viewport } from './viewport';
import { World } from './world';

const config = {
  clippingPlaneHeight: 200,
  meshWireframe: false,
  capWireframe: false,
  model: 'house.fbx',
};

export class Viewer {
  dom: HTMLElement;

  private viewport: Viewport;
  private loop: Loop;

  private renderer: Renderer;
  private camera: Camera;
  private gui: GUI;

  private world: World;

  constructor(container?: HTMLElement) {
    const viewport = new Viewport(container);
    this.dom = viewport.dom;
    this.viewport = viewport;

    viewport.on('resize', this.resize.bind(this));

    const loop = new Loop();
    this.loop = loop;

    loop.on('tick', this.render.bind(this));

    const renderer = new Renderer();
    this.dom.appendChild(renderer.canvas);
    this.renderer = renderer;

    const camera = new Camera(viewport, renderer.canvas);
    this.camera = camera;

    const gui = new GUI(this.dom);
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

    const world = new World(config);
    this.world = world;
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

  render(delta = 1 / 60) {
    this.camera.update();
    this.renderer.render(this.world.scene, this.camera);
    this.gui.stats.update(this.renderer.instance, delta);
  }

  resize() {
    this.camera.resize();
    this.renderer.resize(this.viewport);
    this.renderer.render(this.world.scene, this.camera);
  }

  start() {
    this.loop.start();
  }

  stop() {
    this.loop.stop();
  }
}
