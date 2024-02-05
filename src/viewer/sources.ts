import type { Source } from './utils';

export default [
  {
    name: 'house',
    type: 'fbxModel',
    path: import.meta.env.BASE_URL + 'house.fbx',
    preload: true,
  },
  {
    name: 'building',
    type: 'fbxModel',
    path: import.meta.env.BASE_URL + 'building.fbx',
  },
  {
    name: 'blizzard',
    type: 'fbxModel',
    path: import.meta.env.BASE_URL + 'blizzard.fbx',
  },
] as Source[];
