import GUI from 'lil-gui';
import isPointInPolygon from 'robust-point-in-polygon';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { Earcut } from 'three/src/extras/Earcut.js';

import './style.css';

export class World {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private plane: THREE.Plane;
  private model: THREE.Group | null = null;

  private caps = new THREE.Group();
  private debug = new THREE.Group();

  private controls;

  private meshMaterial;
  private capMaterial;

  constructor() {
    const config = {
      clippingPlaneHeight: 200,
      meshWireframe: false,
      capWireframe: false,
    };

    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.localClippingEnabled = true;
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(71, window.innerWidth / window.innerHeight, 0.1, 100000);
    this.camera.position.set(-106, 1254, 1118);

    window.addEventListener('resize', this.handleResize.bind(this), false);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(585, 249, 563);
    this.controls.update();

    this.scene.add(this.caps);
    this.scene.add(this.debug);

    // Light
    const ambientLight = new THREE.AmbientLight();
    this.scene.add(ambientLight);

    // Clipping plane
    const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    plane.constant = config.clippingPlaneHeight;
    this.plane = plane;

    // Materials
    this.meshMaterial = new THREE.MeshStandardMaterial({
      clippingPlanes: [plane],
      side: THREE.DoubleSide,
      wireframe: config.meshWireframe,
    });

    this.capMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    this.capMaterial.polygonOffset = true;
    this.capMaterial.polygonOffsetFactor = -10;
    this.capMaterial.wireframe = config.capWireframe;

    // Test GUI
    const gui = new GUI();

    gui
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
          this.caps = new THREE.Group();
          this.scene.add(this.caps);
          this.generateLines();
        }
      });

    gui
      .add(config, 'meshWireframe')
      .name('Mesh Wireframe')
      .onChange((value: boolean) => (this.meshMaterial.wireframe = value));

    gui
      .add(config, 'capWireframe')
      .name('Cap Wireframe')
      .onChange((value: boolean) => (this.capMaterial.wireframe = value));
  }

  async init() {
    THREE.DefaultLoadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
      console.log('Loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.');
    };

    const { house } = await this.loadModels();

    this.scene.add(house);

    this.model = house;
    this.generateLines();
  }

  async loadModels() {
    const fbxLoader = new FBXLoader();
    const house = await fbxLoader.loadAsync('/house.fbx');
    this.setupModel(house);
    return { house };
  }

  setupModel(model: THREE.Group) {
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).material = this.meshMaterial;
      }
    });
  }

  render() {
    requestAnimationFrame(this.render.bind(this));

    this.renderer.render(this.scene, this.camera);
  }

  handleResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  generateLines() {
    if (this.model) {
      const toRemove: THREE.Line[] = [];
      this.scene.traverse((child: unknown) => {
        if ((child as THREE.Line).isLine) {
          toRemove.push(child as THREE.Line);
        }
      });

      for (const line of toRemove) {
        this.scene.remove(line);
      }

      this.model.traverse((child: unknown) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const segments = generateMeshPlaneIntersections(mesh, this.plane);

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

                  // BUG: Loops should never be less than 3 points;
                  if (loop.length < 3) {
                    continue;
                  }

                  const vertices = loop.map((v) => [v.x, v.z]).flat();
                  const triangles = Earcut.triangulate(vertices);

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
                  const mesh = new THREE.Mesh(geometry, this.capMaterial);
                  this.caps.add(mesh);
                }
              }
            }
          }
        }
      });
    }
  }
}

function distFromPlane(p: THREE.Vector3, plane: THREE.Plane) {
  return plane.normal.dot(p) + plane.constant;
}

function getSegmentPlaneIntersect(p1: THREE.Vector3, p2: THREE.Vector3, plane: THREE.Plane, segment: THREE.Vector3[]) {
  const d1 = distFromPlane(p1, plane);
  const d2 = distFromPlane(p2, plane);

  const eps = 0.0001;
  const p1OnPlane = Math.abs(d1) < eps;
  const p2OnPlane = Math.abs(d2) < eps;

  if (p1OnPlane) {
    segment.push(p1);
    return true;
  }

  if (p2OnPlane) {
    segment.push(p2);
    return true;
  }

  if (p1OnPlane && p2OnPlane) return true;

  if (d1 * d2 > eps) return false; // points on same side of plane

  const t = d1 / (d1 - d2);
  segment.push(p1.clone().add(p2.clone().sub(p1).multiplyScalar(t)));

  return true;
}

function generateMeshPlaneIntersections(mesh: THREE.Mesh, plane: THREE.Plane) {
  const indexAttribute = mesh.geometry.getIndex();
  const positionAttribute = mesh.geometry.getAttribute('position');
  const segments = [];

  if (indexAttribute && positionAttribute) {
    const indices = indexAttribute.array;
    const vertices = positionAttribute.array;

    for (let i = 0; i < indices.length; i += 3) {
      const a = new THREE.Vector3(vertices[indices[i] * 3], vertices[indices[i] * 3 + 1], vertices[indices[i] * 3 + 2]);
      const b = new THREE.Vector3(
        vertices[indices[i + 1] * 3],
        vertices[indices[i + 1] * 3 + 1],
        vertices[indices[i + 1] * 3 + 2]
      );
      const c = new THREE.Vector3(
        vertices[indices[i + 2] * 3],
        vertices[indices[i + 2] * 3 + 1],
        vertices[indices[i + 2] * 3 + 2]
      );
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

      if (segment.length === 2) {
        segments.push(...segment);
      }
    }
  } else if (!indexAttribute && positionAttribute) {
    const vertices = positionAttribute.array;

    for (let i = 0; i < vertices.length; i += 9) {
      const a = new THREE.Vector3(vertices[i + 0], vertices[i + 0 + 1], vertices[i + 0 + 2]);
      const b = new THREE.Vector3(vertices[i + 3], vertices[i + 3 + 1], vertices[i + 3 + 2]);
      const c = new THREE.Vector3(vertices[i + 6], vertices[i + 6 + 1], vertices[i + 6 + 2]);

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

      if (segment.length === 2) {
        segments.push(...segment);
      }
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
