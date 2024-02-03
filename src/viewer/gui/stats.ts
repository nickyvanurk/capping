import * as THREE from '@viewer/libs/three';

/**
 * Used to monitor rendering performance.
 */
export class PerformanceStats {
  domElement: HTMLElement;

  private stats = new THREE.Stats();
  private panels: THREE.Stats.Panel[] = [];

  constructor() {
    this.domElement = document.createElement('div');
    this.domElement.className = 'performance-stats';

    this.stats.dom.style.position = 'absolute';
    this.stats.dom.style.display = import.meta.env.DEV ? 'flex' : 'none';
    this.stats.dom.style.flexDirection = 'column';
    this.domElement.appendChild(this.stats.dom);

    this.addPanel('Delta', '#0f0', '#020');
    this.addPanel('Draw Calls', '#ff0', '#220');
    this.addPanel('Programs', '#ff0', '#220');
    this.addPanel('Geometries', '#ff0', '#220');
    this.addPanel('Points', '#f08', '#201');
    this.addPanel('Lines', '#f08', '#201');
    this.addPanel('Tris', '#f08', '#201');
  }

  /**
   * Dispose dom elements.
   */
  dispose() {
    this.domElement.removeChild(this.stats.dom);
    this.domElement.remove();
  }

  /**
   * Update the performance stats.
   *
   * @param renderer Three.js `WebGLRenderer` instance.
   * @param dt The delta time from the update loop.
   */
  update(renderer: THREE.WebGLRenderer, dt: number) {
    this.stats.update();
    // The last value scaled the debug graph (max value)
    this.panels[0]?.update(dt * 1000, 200);
    this.panels[1]?.update(renderer.info.render.calls, 100);
    this.panels[2]?.update(renderer.info.programs?.length || 0, 10);
    this.panels[3]?.update(renderer.info.memory.geometries, 100);
    this.panels[4]?.update(renderer.info.render.points, 200000);
    this.panels[5]?.update(renderer.info.render.lines, 200000);
    this.panels[6]?.update(renderer.info.render.triangles, 200000);
  }

  /**
   * Toggle domElement visibility.
   */
  show(visible: boolean) {
    this.stats.dom.style.display = visible ? 'flex' : 'none';
  }

  private addPanel(name: string, bgColor: string, fgColor: string) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const callsPanel = THREE.Stats.Panel(name, bgColor, fgColor);
    this.stats.addPanel(callsPanel);
    this.panels.push(callsPanel);
  }
}
