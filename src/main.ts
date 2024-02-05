import './style.css';
import { Viewer } from './viewer';

async function main() {
  const container = document.querySelector('#scene-container')! as HTMLDivElement;
  const viewer = new Viewer(container);
}

main();
