import { Camera } from './camera';
import { GUI } from './gui';
import { Renderer } from './renderer';
import sources from './sources';
import { Loop, Resources } from './utils';
import { Viewport } from './viewport';
import { World } from './world';

const config = {
  clippingPlaneHeight: 200,
  meshWireframe: false,
  capWireframe: false,
  model: 'house',
};

export class Viewer {
  dom: HTMLElement;

  private viewport: Viewport;
  private loop: Loop;

  private resources: Resources;

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

    const resources = new Resources(sources);
    resources.startLoading();
    this.resources = resources;

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
      .add(config, 'model', ['house', 'building', 'blizzard'])
      .name('Model')
      .onChange(async (filename: string) => this.showModel(filename));
    this.gui = gui;

    const loadingBar = document.querySelector('.bar') as HTMLElement;

    resources.on('progress', (loaded, total) => {
      const percent = Math.floor((loaded / total) * 100);
      loadingBar.style.width = `${percent}%`;
    });

    resources.on('loaded', () => this.init());

    const world = new World(config, renderer);
    this.world = world;
  }

  init() {
    this.resize();
    this.showModel('house');
    this.start();
  }

  async showModel(filename: string) {
    const loadingScreen = document.querySelector('.loadingScreen') as HTMLElement;
    const loadingBar = document.querySelector('.bar') as HTMLElement;

    let model = this.resources.items.get(filename);

    loadingScreen.style.transition = 'none';
    loadingScreen.style.opacity = '1';
    loadingScreen.style.zIndex = '99';
    loadingBar.style.width = `${0}%`;

    if (!model) {
      model = await this.resources.loadAsync(filename);
    }

    if (model) {
      const loadingScreen = document.querySelector('.loadingScreen') as HTMLElement;
      loadingBar.style.width = `${90}%`;

      setTimeout(() => {
        this.world.displayModel(model!);

        loadingScreen.style.transition = 'opacity 0.5s ease-in 0.25s';
        loadingBar.style.width = `${100}%`;

        setTimeout(() => {
          loadingScreen.style.opacity = '0';
        }, 500); // Delay, otherwise the transition is not triggered for some reason.

        setTimeout(() => {
          if (!loadingScreen.style.zIndex) {
            loadingScreen.style.zIndex = '99';
          }

          const newZ = loadingScreen.style.zIndex === '99' ? '-1' : '99';
          loadingScreen.style.zIndex = newZ;
        }, 1250); // 500 + total transition time
      }, 500); // Delay, otherwise the transition is not triggered for some reason.
    }
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
