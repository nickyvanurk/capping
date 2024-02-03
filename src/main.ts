import './style.css';
import { World } from './world/world';

async function main() {
  const container = document.querySelector('#scene-container')! as HTMLDivElement;
  const world = new World(container);
  await world.init();
  world.render();
}

main();
