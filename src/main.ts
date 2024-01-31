import '@ui/style.css';

import { World } from './world';

const world = new World();
await world.init();
world.render();
