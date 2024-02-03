import LilGUI from 'lil-gui';

import { PerformanceStats } from '../stats';
import './style.css';

export class GUI {
  domElement: HTMLElement;
  settings: LilGUI;
  stats: PerformanceStats;

  constructor(container?: HTMLElement) {
    this.domElement = container ? container : document.createElement('div');

    if (!container) {
      this.domElement.id = 'gui';
      this.domElement.style.width = '100%';
      this.domElement.style.height = '100%';
    }

    this.stats = new PerformanceStats();
    this.stats.show(false);
    this.domElement.appendChild(this.stats.domElement);

    const settings = new LilGUI({ container: this.domElement });
    this.settings = settings;

    settings
      .add({ stats: false }, 'stats')
      .name('Performance Stats')
      .onChange((value: boolean) => this.stats.show(value));
  }
}
