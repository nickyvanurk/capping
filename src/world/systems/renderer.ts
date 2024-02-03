import { WebGLRenderer } from 'three';

export function createRenderer() {
  const renderer = new WebGLRenderer();
  renderer.localClippingEnabled = true;
  return renderer;
}
