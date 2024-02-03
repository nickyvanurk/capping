import './style.css';
import { World } from './world/world';

const container = document.querySelector('#scene-container')! as HTMLDivElement;

const world = new World(container);
await world.init();
world.render();
