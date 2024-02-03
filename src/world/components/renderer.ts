import { WebGLRenderer } from 'three';

export function createRenderer() {
  const renderer = new WebGLRenderer();
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.localClippingEnabled = true;
  return renderer;
}
