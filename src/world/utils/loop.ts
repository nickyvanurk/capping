export class Loop {
  private raf = 0;
  private lastTime = 0.0;

  private callbacks: Callback[] = [];

  onTick(callback: Callback): void {
    const index = this.callbacks.indexOf(callback);
    index === -1 && this.callbacks.push(callback);
  }

  start(): void {
    this.raf = requestAnimationFrame(this.update.bind(this));
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.callbacks.length = 0;
  }

  private update(time: number): void {
    this.raf = requestAnimationFrame(this.update.bind(this));
    let delta = time - (this.lastTime || 0.0);

    // 250 ms
    if (delta > 250) {
      delta = 250;
    }

    for (let i = this.callbacks.length; i--; ) {
      this.callbacks[i](delta * 0.001 /* ms to s */, time);
    }

    this.lastTime = time;
  }
}

type Callback = (delta: number, time: number) => void;
