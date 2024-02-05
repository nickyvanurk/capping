import * as THREE from '@viewer/libs/three';
import { EventEmitter } from 'eventemitter3';

export class Resources extends EventEmitter {
  items = new Map<string, THREE.Group>();
  loaded = 0;
  toLoad: number;

  private loaders = { fbxLoader: new THREE.FBXLoader() };

  constructor(private sources: Source[]) {
    super();

    this.toLoad = sources.filter((source) => source.preload).length;
  }

  startLoading() {
    for (const source of this.sources) {
      if (!source.preload) continue;

      if (source.type === 'fbxModel') {
        this.loaders.fbxLoader.load(source.path, (file) => {
          this.sourceLoaded(source, file);
        });
      }
    }
  }

  load(name: string, onLoad: (object: THREE.Group) => void) {
    for (const source of this.sources) {
      if (source.name === name) {
        this.loaders.fbxLoader.load(source.path, (file) => {
          this.items.set(source.name, file);
          onLoad(file);
        });
      }
    }
  }

  async loadAsync(name: string, onProgress?: (event: ProgressEvent<EventTarget>) => void) {
    for (const source of this.sources) {
      if (source.name === name) {
        return this.loaders.fbxLoader.loadAsync(source.path, onProgress).then((file: THREE.Group) => {
          this.items.set(source.name, file);
          return file;
        });
      }
    }
  }

  private sourceLoaded(source: Source, file: THREE.Group) {
    this.items.set(source.name, file);

    this.loaded++;

    this.emit('progress', this.loaded, this.toLoad);

    if (this.loaded === this.toLoad) {
      this.emit('loaded');
    }
  }
}

export type Source = {
  name: string;
  type: 'fbxModel';
  path: string;
  preload?: boolean;
};
