import './style.css';
import { Viewer } from './world/viewer';

async function main() {
  const container = document.querySelector('#scene-container')! as HTMLDivElement;
  const viewer = new Viewer(container);
  await viewer.init();
  viewer.start();
}

main();
