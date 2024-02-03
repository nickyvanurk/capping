import isPointInPolygon from 'robust-point-in-polygon';

import { GUI } from './gui';
import * as THREE from './three';
import { Loop } from './utils/loop';

const config = {
  clippingPlaneHeight: 200,
  meshWireframe: false,
  capWireframe: false,
  model: 'house.fbx',
};

export class Viewer {
  domElement: HTMLElement;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private loop: Loop;
  private controls: THREE.OrbitControls;
  private gui: GUI;

  private meshMaterial: THREE.MeshLambertMaterial;
  private capMaterial: THREE.MeshBasicMaterial;

  private plane: THREE.Plane;
  private model: THREE.Mesh | null = null;
  private caps = new THREE.Group();

  constructor(container?: HTMLDivElement) {
    this.domElement = container ? container : document.createElement('div');

    if (!container) {
      this.domElement.id = 'viewer';
      this.domElement.style.width = '100%';
      this.domElement.style.height = '100%';
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.localClippingEnabled = true;
    this.domElement.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(71, 1, 0.1, 100000);
    camera.position.set(-106, 1254, 1118);
    this.camera = camera;

    const resizeObserver = new ResizeObserver(this.resize.bind(this));
    resizeObserver.observe(this.domElement);

    this.loop = new Loop();
    this.loop.onTick(this.render.bind(this));

    const controls = new THREE.OrbitControls(camera, this.renderer.domElement);
    controls.target.set(585, 249, 563);
    controls.update();
    this.controls = controls;

    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x8d8d8d, 2);
    hemisphereLight.position.set(0, 100, 0);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(-0, 40, 50);
    this.scene.add(hemisphereLight, directionalLight);

    const gui = new GUI(this.domElement);
    this.gui = gui;

    gui.settings
      .add(config, 'clippingPlaneHeight', -2000, 2000, 0.1)
      .name('Clipping Plane')
      .onChange((value: number) => {
        plane.constant = value;

        if (this.model) {
          this.scene.remove(this.caps);
        }
      })
      .onFinishChange(async () => {
        if (this.model) {
          this.generateCaps();
        }
      });

    gui.settings
      .add(config, 'meshWireframe')
      .name('Mesh Wireframe')
      .onChange((value: boolean) => (this.meshMaterial.wireframe = value));

    gui.settings
      .add(config, 'capWireframe')
      .name('Cap Wireframe')
      .onChange((value: boolean) => (this.capMaterial.wireframe = value));

    gui.settings
      .add(config, 'model', ['house.fbx', 'building.fbx', 'blizzard.fbx'])
      .name('Model')
      .onChange(async (filename: string) => {
        this.reset();

        this.model = await this.loadModel(filename);
        this.scene.add(this.model);

        this.generateCaps();
      });

    this.scene.add(this.caps);

    // Clipping plane
    const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    plane.constant = config.clippingPlaneHeight;
    this.plane = plane;

    // Materials
    this.meshMaterial = new THREE.MeshLambertMaterial({
      clippingPlanes: [plane],
      side: THREE.DoubleSide,
      wireframe: config.meshWireframe,
    });

    this.capMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    this.capMaterial.polygonOffset = true;
    this.capMaterial.polygonOffsetFactor = -10;
    this.capMaterial.wireframe = config.capWireframe;
  }

  async init() {
    this.resize();

    const house = await this.loadModel('house.fbx');
    this.scene.add(house);

    this.model = house;

    this.generateCaps();
  }

  async loadModel(filename: string) {
    const fbxLoader = new THREE.FBXLoader();
    const model = await fbxLoader.loadAsync(import.meta.env.BASE_URL + filename);
    const mesh = this.createMergedMeshFromModel(model);
    return mesh;
  }

  createMergedMeshFromModel(model: THREE.Group) {
    const geometryArray: THREE.BufferGeometry[] = [];
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).geometry) {
        const mesh = child as THREE.Mesh;
        const geom = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
        geom.deleteAttribute('uv');
        geom.deleteAttribute('color');
        if (!geom.hasAttribute('normal')) {
          geom.computeVertexNormals();
        }
        geometryArray.push(geom);
      }
    });

    const geometry = THREE.BufferGeometryUtils.mergeGeometries(geometryArray);
    const mesh = new THREE.Mesh(THREE.BufferGeometryUtils.mergeVertices(geometry), this.meshMaterial);
    mesh.matrixAutoUpdate = false;
    return mesh;
  }

  reset() {
    if (this.model) {
      this.scene.remove(this.model);
      this.scene.remove(this.caps);
    }
  }

  generateCaps() {
    this.scene.remove(this.caps);
    this.caps = new THREE.Group();
    this.scene.add(this.caps);

    if (this.model) {
      this.generateLines(this.model);
    }
  }

  render(delta = 0) {
    this.gui.stats.update(this.renderer, delta);
    this.renderer.render(this.scene, this.camera);
  }

  generateLines(mesh: THREE.Mesh) {
    const geometryArray: THREE.BufferGeometry[] = [];

    // const start = performance.now();
    const intersectingTriangles = getTrianglesIntersectingPlane(mesh, this.plane);
    const segments = getTrianglePlaneSegments(mesh, intersectingTriangles, this.plane);
    // const end = performance.now();
    // console.log(`Execution time: ${end - start} ms`);

    if (segments.length) {
      const loops = getLoopsInSegments(segments);
      const loopsStructure = new Map<number, number[]>();

      // TODO:
      // Transform loop into x/y plane
      // Right now my plane is always horizontal so let's assume that for now.
      for (let i = 0; i < loops.length; i++) {
        const loop1 = loops[i];
        const l1 = loop1.map((v) => [v.x, v.z]);

        loopsStructure.set(i, []);

        for (let j = i + 1; j < loops.length; j++) {
          const loop2 = loops[j];
          const p = loop2[0];

          let isLoopContained = true;

          // -1 = inside, 0 = on boundary, 1 = outside
          if (isPointInPolygon(l1, [p.x, p.z]) === -1) {
            // Check line intersections between the two loops.
            for (let i = 0; i < loop1.length; i++) {
              const l1p1 = loop1[i];
              const l1p2 = loop1[(i + 1) % loop1.length];

              for (let j = 0; j < loop2.length; j++) {
                const l2p1 = loop2[j];
                const l2p2 = loop2[(j + 1) % loop2.length];
                if (lineIntersectsLine(l1p1.x, l1p1.z, l1p2.x, l1p2.z, l2p1.x, l2p1.z, l2p2.x, l2p2.z)) {
                  isLoopContained = false;
                  break;
                }
              }

              if (!isLoopContained) break;
            }

            if (isLoopContained) {
              loopsStructure.get(loops.indexOf(loop1))?.push(loops.indexOf(loop2));
            }

            break;
          }
        }
      }

      // TODO: Create a proper tree structure for the loops
      // Makes it trivial to triangulate polygons with holes.
      // Right now that's something I skip.
      for (const [key1, value1] of loopsStructure) {
        // if no children
        if (value1.length === 0) {
          let isChildOfAnotherLoop = false;
          for (const [_, value2] of loopsStructure) {
            if (value2.includes(key1)) {
              isChildOfAnotherLoop = true;
              break;
            }
          }

          if (!isChildOfAnotherLoop) {
            const loop = loops[key1];

            const vertices = loop.map((v) => [v.x, v.z]).flat();
            const triangles = THREE.Earcut.triangulate(vertices);

            const indices = [];
            const verts = [];

            // Add y-axis
            for (let i = 0; i < vertices.length; i += 2) {
              verts.push(vertices[i + 0], this.plane.constant, vertices[i + 1]);
            }

            // Rotate faces so they face the correct direction
            for (let i = 0; i < triangles.length; i += 3) {
              indices.push(triangles[i + 2], triangles[i + 1], triangles[i]);
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setIndex(indices);
            geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
            geometryArray.push(geometry);
          }
        }
      }
    }

    if (geometryArray.length) {
      this.caps.add(new THREE.Mesh(THREE.BufferGeometryUtils.mergeGeometries(geometryArray), this.capMaterial));
    }
  }

  start() {
    this.loop.start();
  }

  stop() {
    this.loop.stop();
  }

  resize() {
    this.renderer.setSize(this.domElement.clientWidth, this.domElement.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.camera.aspect = this.domElement.clientWidth / this.domElement.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }
}

function distFromPlane(p: THREE.Vector3, plane: THREE.Plane) {
  return plane.normal.dot(p) + plane.constant;
}

function getSegmentPlaneIntersect(p1: THREE.Vector3, p2: THREE.Vector3, plane: THREE.Plane, segment: THREE.Vector3[]) {
  const d1 = distFromPlane(p1, plane);
  const d2 = distFromPlane(p2, plane);

  if (d1 * d2 > 0) return false; // points on same side of plane

  const t = d1 / (d1 - d2);
  segment.push(p1.clone().add(p2.clone().sub(p1).multiplyScalar(t)));

  return true;
}

function getTrianglesIntersectingPlane(mesh: THREE.Mesh, plane: THREE.Plane) {
  const vertices = mesh.geometry.getAttribute('position').array;
  const indices = mesh.geometry.getIndex()!.array;

  const eps = 0.0001;
  const intersectingTriangles = [];

  for (let i = 0; i < indices.length; i += 3) {
    const idx1 = indices[i + 0] * 3;
    const idx2 = indices[i + 1] * 3;
    const idx3 = indices[i + 2] * 3;

    const a = new THREE.Vector3(vertices[idx1], vertices[idx1 + 1], vertices[idx1 + 2]);
    const b = new THREE.Vector3(vertices[idx2], vertices[idx2 + 1], vertices[idx2 + 2]);
    const c = new THREE.Vector3(vertices[idx3], vertices[idx3 + 1], vertices[idx3 + 2]);

    mesh.localToWorld(a);
    mesh.localToWorld(b);
    mesh.localToWorld(c);

    const d1 = distFromPlane(a, plane);
    const d2 = distFromPlane(b, plane);
    const d3 = distFromPlane(c, plane);

    if (
      // No intersection
      (d1 < -eps && d2 < -eps && d3 < -eps) ||
      (d1 > eps && d2 > eps && d3 > eps) ||
      // All points on plane
      (Math.abs(d1) <= eps && Math.abs(d2) <= eps && Math.abs(d3) <= eps)
    ) {
      continue;
    }

    intersectingTriangles.push(i);
  }

  return intersectingTriangles;
}

function getTrianglePlaneSegments(mesh: THREE.Mesh, triangles: number[], plane: THREE.Plane) {
  const segments = [];

  const indices = mesh.geometry.getIndex()!.array;
  const vertices = mesh.geometry.getAttribute('position').array;

  for (let i = 0; i < triangles.length; i++) {
    const triangleIdx = triangles[i];
    const idx1 = indices[triangleIdx + 0] * 3;
    const idx2 = indices[triangleIdx + 1] * 3;
    const idx3 = indices[triangleIdx + 2] * 3;

    const a = new THREE.Vector3(vertices[idx1], vertices[idx1 + 1], vertices[idx1 + 2]);
    const b = new THREE.Vector3(vertices[idx2], vertices[idx2 + 1], vertices[idx2 + 2]);
    const c = new THREE.Vector3(vertices[idx3], vertices[idx3 + 1], vertices[idx3 + 2]);

    mesh.localToWorld(a);
    mesh.localToWorld(b);
    mesh.localToWorld(c);

    const verts = [
      {
        dist: distFromPlane(a, plane),
        vert: a,
      },
      {
        dist: distFromPlane(b, plane),
        vert: b,
      },
      {
        dist: distFromPlane(c, plane),
        vert: c,
      },
    ];

    // https://casual-effects.com/research/McGuire2011Clipping/McGuire-Clipping.pdf
    let temp;
    if (verts[1].dist > 0 && verts[0].dist <= 0) {
      // Cycle CCW
      temp = verts[0];
      verts[0] = verts[1];
      verts[1] = verts[2];
      verts[2] = temp;
    } else if (verts[2].dist > 0 && verts[1].dist <= 0) {
      // Cycle CW
      temp = verts[2];
      verts[2] = verts[1];
      verts[1] = verts[0];
      verts[0] = temp;
    }

    const segment: THREE.Vector3[] = [];
    getSegmentPlaneIntersect(verts[0].vert, verts[1].vert, plane, segment);
    getSegmentPlaneIntersect(verts[1].vert, verts[2].vert, plane, segment);
    getSegmentPlaneIntersect(verts[2].vert, verts[0].vert, plane, segment);

    if (segment.length >= 2) {
      segments.push(...segment);
    }
  }

  return segments;
}

function getLoopsInSegments(segments: THREE.Vector3[]) {
  const loops = [];
  const loop = [segments[0], segments[1]];
  const firstSegment = {
    start: segments[0].clone(),
    end: segments[1].clone(),
  };
  const segment = {
    start: segments[0],
    end: segments[1],
  };
  segments.splice(0, 2);

  const eps = 0.001;
  const epsSq = eps * eps;

  const distSq = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => {
    return (b.x - a.x) * (b.x - a.x) + ((b.y - a.y) * (b.y - a.y) + (b.z - a.z) * (b.z - a.z));
  };

  while (segments.length > 0) {
    let foundNextSegment = false;
    let loopComplete = false;

    for (let j = 0; j < segments.length; j += 2) {
      const start = segments[j];
      const end = segments[j + 1];

      if (distSq(segment.end, start) < epsSq) {
        foundNextSegment = true;

        segments.splice(j, 2);

        if (distSq(end, firstSegment.start) < epsSq) {
          loops.push([...loop]);
          loopComplete = true;
          break;
        } else {
          segment.start = start;
          segment.end = end;
          loop.push(end);
        }

        break;
      }
    }

    if (!foundNextSegment || loopComplete) {
      loop.length = 0;

      if (segments.length > 0) {
        loop.push(segments[0], segments[1]);
        firstSegment.start = segments[0].clone();
        firstSegment.end = segments[1].clone();
        segment.start = segments[0];
        segment.end = segments[1];
        segments.splice(0, 2);
      }
    }
  }

  return loops;
}

// https://stackoverflow.com/questions/9043805/test-if-two-lines-intersect-javascript-function
function lineIntersectsLine(a: number, b: number, c: number, d: number, p: number, q: number, r: number, s: number) {
  const det = (c - a) * (s - q) - (r - p) * (d - b);
  let gamma, lambda;
  if (det === 0) {
    return false;
  } else {
    lambda = ((s - q) * (r - a) + (p - r) * (s - b)) / det;
    gamma = ((b - d) * (r - a) + (c - a) * (s - b)) / det;
    return 0 < lambda && lambda < 1 && 0 < gamma && gamma < 1;
  }
}
