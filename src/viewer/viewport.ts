import { EventEmitter } from 'eventemitter3';

export class Viewport extends EventEmitter {
  dom: HTMLElement;
  width: number;
  height: number;
  dpr: number;

  constructor(container?: HTMLElement) {
    super();

    this.dom = container ? container : document.createElement('div');

    if (!container) {
      this.dom.id = 'viewer';
      this.dom.style.width = '100%';
      this.dom.style.height = '100%';
    }

    this.width = this.dom.clientWidth;
    this.height = this.dom.clientHeight;
    this.dpr = Math.min(window.devicePixelRatio, 2);

    new ResizeObserver(() => {
      this.width = this.dom.clientWidth;
      this.height = this.dom.clientHeight;
      this.dpr = Math.min(window.devicePixelRatio, 2);

      this.emit('resize');
    }).observe(this.dom);
  }
}
