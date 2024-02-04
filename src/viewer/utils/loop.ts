import { EventEmitter } from 'eventemitter3';

export class Loop extends EventEmitter {
  elapsed = 0;
  delta = 0;

  private now = performance.now();
  private raf = 0;

  constructor() {
    super();
  }

  tick() {
    const currentTime = performance.now();
    this.delta = (currentTime - this.now) / 1000;
    this.now = currentTime;
    this.elapsed += this.delta;

    if (this.delta > 0.25) {
      this.delta = 0.25;
    }

    this.emit('tick', this.delta, this.elapsed);

    this.raf = requestAnimationFrame(() => this.tick());
  }

  start() {
    this.now = performance.now();
    this.raf = requestAnimationFrame(() => this.tick());
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }
}
