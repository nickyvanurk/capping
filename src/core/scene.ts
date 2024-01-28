import GUI from 'lil-gui';
import * as isPointInPolygon from 'robust-point-in-polygon';
import * as THREE from 'three';
import { Dcel } from 'three-halfedge-dcel';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { Earcut } from 'three/src/extras/Earcut.js';

import '@ui/style.css';

class CustomSinCurve extends THREE.Curve {
  constructor(public scale = 1) {
    super();
  }

  getPoint(t: number, optionalTarget = new THREE.Vector3()) {
    const tx = t * 3 - 1.5;
    const ty = Math.sin(2 * Math.PI * t);
    const tz = 0;

    return optionalTarget.set(tx, ty, tz).multiplyScalar(this.scale);
  }
}

export class Scene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private plane: THREE.Plane;
  private model: THREE.Group | null = null;

  private caps = new THREE.Group();
  private debug = new THREE.Group();

  constructor() {
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.localClippingEnabled = true;
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(71, window.innerWidth / window.innerHeight, 0.1, 100000);
    this.camera.position.set(/*1500*/ 0, /*1200*/ 0, 1500);

    window.addEventListener('resize', this.handleResize.bind(this), false);

    new OrbitControls(this.camera, this.renderer.domElement);

    this.scene.add(this.caps);
    this.scene.add(this.debug);

    // Light
    const ambientLight = new THREE.AmbientLight();
    this.scene.add(ambientLight);

    // Clipping plane
    const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    plane.constant = 200;
    this.plane = plane;

    // Stencil
    // PASS 1
    // everywhere that the back faces are visible (clipped region) the stencil
    // buffer is incremented by 1.
    const backFaceStencilMat = new THREE.MeshBasicMaterial();
    backFaceStencilMat.depthWrite = false;
    backFaceStencilMat.depthTest = false;
    backFaceStencilMat.colorWrite = false;
    backFaceStencilMat.stencilWrite = true;
    backFaceStencilMat.stencilFunc = THREE.AlwaysStencilFunc;
    backFaceStencilMat.side = THREE.BackSide;
    backFaceStencilMat.stencilFail = THREE.IncrementWrapStencilOp;
    backFaceStencilMat.stencilZFail = THREE.IncrementWrapStencilOp;
    backFaceStencilMat.stencilZPass = THREE.IncrementWrapStencilOp;

    // PASS 2
    // everywhere that the front faces are visible the stencil
    // buffer is decremented back to 0.
    const frontFaceStencilMat = new THREE.MeshBasicMaterial();
    frontFaceStencilMat.depthWrite = false;
    frontFaceStencilMat.depthTest = false;
    frontFaceStencilMat.colorWrite = false;
    frontFaceStencilMat.stencilWrite = true;
    frontFaceStencilMat.stencilFunc = THREE.AlwaysStencilFunc;
    frontFaceStencilMat.side = THREE.FrontSide;
    frontFaceStencilMat.stencilFail = THREE.DecrementWrapStencilOp;
    frontFaceStencilMat.stencilZFail = THREE.DecrementWrapStencilOp;
    frontFaceStencilMat.stencilZPass = THREE.DecrementWrapStencilOp;

    // PASS 3
    // draw the plane everywhere that the stencil buffer != 0, which will
    // only be in the clipped region where back faces are visible.
    const planeStencilMat = new THREE.MeshNormalMaterial();
    planeStencilMat.stencilWrite = true;
    planeStencilMat.stencilRef = 0;
    planeStencilMat.stencilFunc = THREE.NotEqualStencilFunc;
    planeStencilMat.stencilFail = THREE.ReplaceStencilOp;
    planeStencilMat.stencilZFail = THREE.ReplaceStencilOp;
    planeStencilMat.stencilZPass = THREE.ReplaceStencilOp;
    planeStencilMat.polygonOffset = true;
    planeStencilMat.polygonOffsetFactor = -10;

    const planeGeom = new THREE.PlaneGeometry(1000, 1000);
    const planeMesh = new THREE.Mesh(planeGeom, planeStencilMat);
    planeMesh.scale.setScalar(100);
    planeMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), plane.normal);
    planeMesh.position.y = plane.constant;
    this.scene.add(planeMesh);

    planeMesh.onAfterRender = (renderer: THREE.WebGLRenderer) => {
      renderer.clearStencil();
    };

    frontFaceStencilMat.clippingPlanes = [plane];
    backFaceStencilMat.clippingPlanes = [plane];

    // Test GUI
    const gui = new GUI();
    const config = {
      clippingPlaneHeight: plane.constant,
    };

    gui
      .add(config, 'clippingPlaneHeight', -2000, 2000, 0.1)
      .name('Clipping Plane')
      .onChange((value: number) => {
        plane.constant = value;
        planeMesh.position.y = value;

        if (this.model) {
          this.scene.remove(this.caps);
        }
      })
      .onFinishChange(async () => {
        if (this.model) {
          this.caps = new THREE.Group();
          this.scene.add(this.caps);
        }
        this.generateLines();
      });

    const material = new THREE.MeshStandardMaterial({
      clippingPlanes: [plane],
      side: THREE.DoubleSide,
      wireframe: false,
    });

    planeMesh.onAfterRender = (renderer: THREE.WebGLRenderer) => {
      renderer.clearStencil();
    };

    const fbxLoader = new FBXLoader();
    fbxLoader.load(
      '/house.fbx',
      (object) => {
        object.traverse(function (child) {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;

            // if (mesh.name.includes('Concrete-Round') || mesh.name.includes('Wind') || mesh.name.includes('fire')) {
            // if (mesh.name.includes('RevitTopography')) {
            // if (mesh.name.includes('Concrete-Round')) {
            // if (false) {
            //   //   // mesh.position.x += 10 * Math.random();
            //   //   // mesh.position.z += 10 * Math.random();
            // } else {
            //   mesh.visible = false;
            //   return;
            // }

            // console.log(mesh);

            // if (Array.isArray(mesh.material)) {
            //   for (let i = 0; i < mesh.material.length; i++) {
            //     mesh.material[i] = material;
            //   }
            // } else {
            mesh.material = material;
            // }

            mesh.traverse(function (child) {
              if ((child as THREE.Mesh).isMesh) {
                const m = child as THREE.Mesh;
                if (m.material) {
                  // if (Array.isArray(m.material)) {
                  //   for (let i = 0; i < m.material.length; i++) {
                  //     m.material[i] = material;
                  //   }
                  // } else {
                  m.material = material;
                  // }
                }
              }
            });

            try {
              mesh.geometry = BufferGeometryUtils.mergeVertices(mesh.geometry);
              // console.log(mesh.geometry);

              // const path = new CustomSinCurve(10);
              // const geometry = new THREE.TubeGeometry(path, 1, 3, 14, false);
              // // const geometry = new THREE.PlaneGeometry(10, 10);
              // const mat = new THREE.MeshBasicMaterial({ wireframe: true });
              // const me = new THREE.Mesh(geometry, mat);
              // me.scale.setScalar(20);
              // me.rotateZ(Math.PI / -2);
              // me.position.x += 100;
              // me.name = 'Concrete-Round';

              // object.add(me);

              // const segments = generateMeshPlaneIntersections(mesh, plane);
              // for (let i = 1; i < segments.length; i += 2) {
              //   newLine(scene, segments[i - 1], segments[i]);
              // }

              // scene.add(me);
              const dcel = new Dcel(mesh.geometry);

              let checkForHoles = false;
              let checkForPlane = false;
              // const boundaryEdges = new Set();
              const boundaryEdges = [];

              // Skip non-manifold meshes
              for (const f of dcel.faces) {
                let edge = f.edge;
                for (let i = 0; i < 3; i++) {
                  if (!edge.twin) {
                    // boundaryEdges.add(edge);
                    boundaryEdges.push(edge);
                    checkForHoles = true;
                    checkForPlane = true;
                    // break;
                  }
                  edge = edge.next;

                  if (i === 2 && edge !== f.edge) {
                    throw Error();
                  }
                }
              }

              if (checkForPlane) {
                const newCube = (p: { x: number; y: number; z: number }) => {
                  const geoom = new THREE.BoxGeometry(0.1, 0.1, 0.1);
                  const cube = new THREE.Mesh(geoom, material);
                  cube.position.set(p.x, p.y, p.z);
                  mesh.add(cube);
                };

                const firstEdge = boundaryEdges[0];
                boundaryEdges.splice(0, 1);
                const loops = [];
                const loop = [firstEdge];
                const firstSegment = {
                  start: firstEdge.prev.vertex.point,
                  end: firstEdge.vertex.point,
                };
                const segment = {
                  start: firstEdge.prev.vertex.point,
                  end: firstEdge.vertex.point,
                };

                // newLine(segment.start, segment.end);
                // newCube(segment.end);

                // console.log(boundaryEdges);

                const epsSq = eps * eps;

                const distSq = (a: Vec, b: Vec) => {
                  return (b.x - a.x) * (b.x - a.x) + ((b.y - a.y) * (b.y - a.y) + (b.z - a.z) * (b.z - a.z));
                };

                // console.log(boundaryEdges);
                // for (let i = 0; i < 42; i++) {
                while (boundaryEdges.length > 0) {
                  let foundNextSegment = false;
                  let loopComplete = false;

                  for (const [idx, edge] of boundaryEdges.entries()) {
                    const start = edge.prev.vertex.point;
                    const end = edge.vertex.point;

                    if (distSq(segment.start, end) < epsSq || distSq(segment.end, start) < epsSq) {
                      foundNextSegment = true;

                      const cw = distSq(segment.end, start) < epsSq;

                      // if (cw) {
                      //   newLine(start, end);
                      //   // newCube(end);
                      // } else {
                      //   newLine(end, start);
                      //   // newCube(start);
                      // }

                      // setTimeout(() => {
                      //   if (cw) {
                      //     newLine(start, end);
                      //     // newCube(end);
                      //   } else {
                      //     newLine(end, start);
                      //     // newCube(start);
                      //   }
                      // }, idx * 2000);

                      boundaryEdges.splice(idx, 1);

                      segment.start = start;
                      segment.end = end;
                      loop.push(segment);

                      // if (i === 41) {
                      //   console.log(segment);
                      //   console.log(cw);
                      //   console.log(distSq(start, firstSegment.end));

                      //   console.log(firstSegment.end, firstSegment.start);
                      //   newLine(firstSegment.end, firstSegment.start, 0xffff00);
                      //   // newLine(start, end, 0xff0000);
                      // }

                      // if (i === 40) {
                      //   newLine(start, end, 0xff0000);
                      //   console.log(distSq(start, firstSegment.end));
                      // }

                      if (
                        (!cw && distSq(start, firstSegment.end) < epsSq) ||
                        (cw && distSq(end, firstSegment.start) < epsSq)
                      ) {
                        // console.log(loop);
                        loops.push([...loop]);
                        loopComplete = true;
                        break;
                      }

                      break;
                    }

                    // console.log(edge);
                    // setTimeout(() => {
                    //   newLine(start, end);
                    //   // newCube(edge.vertex.point);
                    //   newCube(end);
                    //   // console.log('YOO', edge.vertex.point);
                    // }, idx * 500);
                  }

                  if (!foundNextSegment || loopComplete) {
                    // console.log(loopComplete ? 'loop complete' : 'next not found');
                    loop.length = 0;

                    if (boundaryEdges.length > 0) {
                      const edge = boundaryEdges[0];
                      firstSegment.start = edge.prev.vertex.point;
                      firstSegment.end = edge.vertex.point;
                      segment.start = edge.prev.vertex.point;
                      segment.end = edge.vertex.point;
                      loop.push(segment);
                      boundaryEdges.splice(0, 1);

                      // newLine(segment.start, segment.end);
                      // newCube(segment.end);
                    }
                  }
                }

                if (loops.length !== 0 && loops.length !== 2) return;
                // if (loops.length % 2 === 1) return;
              }

              // const backMesh = mesh.clone();
              // backMesh.material = [...mesh.material];
              // if (Array.isArray(backMesh.material)) {
              //   for (let i = 0; i < backMesh.material.length; i++) {
              //     backMesh.material[i] = material;
              //   }
              // } else {
              //   backMesh.material = material;
              // }
              // scene.add(backMesh);

              const backMesh = mesh.clone();
              backMesh.material = mesh.material.clone();
              // if (Array.isArray(backMesh.material)) {
              //   for (let i = 0; i < backMesh.material.length; i++) {
              //     backMesh.material[i] = backFaceStencilMat;
              //   }
              // } else {
              backMesh.material = backFaceStencilMat;
              // }

              // if (mesh.parent) {
              //   mesh.parent.add(backMesh);
              // } else {
              //   object.add(backMesh);
              // }

              backMesh.traverse(function (child) {
                if ((child as THREE.Mesh).isMesh) {
                  const m = child as THREE.Mesh;
                  if (m.material) {
                    // if (Array.isArray(m.material)) {
                    //   m.material = [...m.material];
                    //   for (let i = 0; i < m.material.length; i++) {
                    //     m.material[i] = backFaceStencilMat;
                    //   }
                    // } else {
                    m.material = backFaceStencilMat;
                    // }
                  }
                }
              });

              const frontMesh = mesh.clone();
              frontMesh.material = mesh.material.clone();
              // if (Array.isArray(frontMesh.material)) {
              //   for (let i = 0; i < frontMesh.material.length; i++) {
              //     frontMesh.material[i] = frontFaceStencilMat;
              //   }
              // } else {
              frontMesh.material = frontFaceStencilMat;
              // }

              // if (mesh.parent) {
              //   mesh.parent.add(frontMesh);
              // } else {
              //   object.add(frontMesh);
              // }

              frontMesh.traverse(function (child) {
                if ((child as THREE.Mesh).isMesh) {
                  const m = child as THREE.Mesh;
                  if (m.material) {
                    if (Array.isArray(m.material)) {
                      m.material = [...m.material];
                      for (let i = 0; i < m.material.length; i++) {
                        m.material[i] = frontFaceStencilMat;
                      }
                    } else {
                      m.material = frontFaceStencilMat;
                    }
                  }
                }
              });
            } catch (e) {
              // console.log(e);
            }

            // if (mesh.material) {
            //   if (Array.isArray(mesh.material)) {
            //     for (let i = 0; i < mesh.material.length; i++) {
            //       mesh.material[i] = material;
            //     }
            //   } else {
            //     mesh.material = material;
            //   }

            //   // if (Array.isArray(mesh.material)) {
            //   //   for (let i = 0; i < mesh.material.length; i++) {
            //   //     // mesh.material[i] = material;
            //   //     mesh.material[i].clippingPlanes = [plane];
            //   //     mesh.material[i].side = THREE.DoubleSide;
            //   //   }
            //   // } else {
            //   //   // mesh.material = material;
            //   //   mesh.material.clippingPlanes = [plane];
            //   //   mesh.material.side = THREE.DoubleSide;
            //   // }
            // }
          }
        });
        this.scene.add(object);

        this.model = object;

        this.generateLines();
      },
      (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + '% loaded');
      },
      (error) => {
        console.log(error);
      }
    );
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
          // if (!mesh.name.includes('Concrete-Round')) return;

          const segments = generateMeshPlaneIntersections(mesh, this.plane);
          // for (let i = 1; i < segments.length; i += 2) {
          //   newLine(this.scene, segments[i - 1], segments[i], 0x0000ff, 0x0000ff);
          // }

          if (segments.length) {
            const loops = getLoopsInSegments(segments, this.scene);

            // for (const loop of loops) {
            //   for (let i = 0; i < loop.length; i++) {
            //     newLine(this.scene, loop[i], loop[(i + 1) % loop.length], 0xff0000, 0xff0000);
            //   }
            // }

            const loopsStructure = new Map<number, number[]>();

            // TODO:
            // Transform loop into x/y plane
            // Right now my plane is always horizontal so let's assume that for now.
            for (let i = 0; i < loops.length; i++) {
              const loop1 = loops[i];
              const l1 = loop1.map((v) => [v.x, v.z]);

              loopsStructure.set(i, []);

              let hasInnerLoops = false;

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
                      if (intersects(l1p1.x, l1p1.z, l1p2.x, l1p2.z, l2p1.x, l2p1.z, l2p2.x, l2p2.z)) {
                        isLoopContained = false;
                        break;
                      }
                    }

                    if (!isLoopContained) break;
                  }

                  if (isLoopContained) {
                    // Debug rendering
                    // for (let i = 0; i < loop2.length; i++) {
                    //   newLine(this.scene, loop2[i], loop2[(i + 1) % loop2.length], 0xffff00, 0xffff00);
                    // }

                    hasInnerLoops = true;

                    loopsStructure.get(loops.indexOf(loop1))?.push(loops.indexOf(loop2));
                  }

                  break;
                }
              }

              // if (hasInnerLoops) {
              //   for (let i = 0; i < loop1.length; i++) {
              //     newLine(this.scene, loop1[i], loop1[(i + 1) % loop1.length], 0x0000ff, 0x0000ff);
              //   }
              // }
            }

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
                  // console.log(vertices);
                  // console.log(triangles);
                  // const points = [];

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
                  const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                  material.polygonOffset = true;
                  material.polygonOffsetFactor = -10;
                  const mesh = new THREE.Mesh(geometry, material);
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

// function createPlaneStencilGroup(geometry: THREE.BufferGeometry, plane: THREE.Plane, renderOrder: number) {
//   const group = new THREE.Group();
//   const baseMat = new THREE.MeshBasicMaterial();
//   baseMat.depthWrite = false;
//   baseMat.depthTest = false;
//   baseMat.colorWrite = false;
//   baseMat.stencilWrite = true;
//   baseMat.stencilFunc = THREE.AlwaysStencilFunc;

//   // back faces
//   const mat0 = baseMat.clone();
//   mat0.side = THREE.BackSide;
//   mat0.clippingPlanes = [plane];
//   mat0.stencilFail = THREE.IncrementWrapStencilOp;
//   mat0.stencilZFail = THREE.IncrementWrapStencilOp;
//   mat0.stencilZPass = THREE.IncrementWrapStencilOp;

//   const mesh0 = new THREE.Mesh(geometry, mat0);
//   mesh0.renderOrder = renderOrder;
//   group.add(mesh0);

//   // front faces
//   const mat1 = baseMat.clone();
//   mat1.side = THREE.FrontSide;
//   mat1.clippingPlanes = [plane];
//   mat1.stencilFail = THREE.DecrementWrapStencilOp;
//   mat1.stencilZFail = THREE.DecrementWrapStencilOp;
//   mat1.stencilZPass = THREE.DecrementWrapStencilOp;

//   const mesh1 = new THREE.Mesh(geometry, mat1);
//   mesh1.renderOrder = renderOrder;

//   group.add(mesh1);

//   return group;
// }

const newLine = (
  parent: THREE.Object3D,
  p1: { x: number; y: number; z: number },
  p2: { x: number; y: number; z: number },
  colorA = 0x0000ff,
  colorB = 0x0000ff
) => {
  // var material = new THREE.LineBasicMaterial( {
  //     color: 0xffffff,
  //     vertexColors: THREE.VertexColors
  // } );

  // var line = new THREE.LineSegments( geometry, material );

  // p1.y = Math.random() * 200 - 100;
  // p2.y = p1.y;

  const color1 = new THREE.Color(colorA);
  const color2 = new THREE.Color(colorB);

  const halfP = new THREE.Vector3(p1.x + (p2.x - p1.x) / 2, p1.y + (p2.y - p1.y) / 2, p1.z + (p2.z - p1.z) / 2);
  const material = new THREE.LineBasicMaterial({ vertexColors: true });
  const points = [new THREE.Vector3(p1.x, p1.y, p1.z), halfP, halfP, new THREE.Vector3(p2.x, p2.y, p2.z)];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  geometry.setAttribute(
    'color',
    new THREE.BufferAttribute(
      new Uint8Array([
        color1.r,
        color1.g,
        color1.b,
        color1.r,
        color1.g,
        color1.b,
        color2.r,
        color2.g,
        color2.b,
        color2.r,
        color2.g,
        color2.b,
      ]),
      3
    )
  );
  const line = new THREE.Line(geometry, material);
  // line.rotation.copy(mesh.rotation);
  // line.rotateX(Math.PI / 4);
  parent.add(line);
};

const distFromPlane = (p: THREE.Vector3, plane: THREE.Plane) => {
  return plane.normal.dot(p) + plane.constant;
};

const getSegmentPlaneIntersect = (
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  plane: THREE.Plane,
  segment: THREE.Vector3[]
) => {
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
};

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

function getLoopsInSegments(segments: THREE.Vector3[], scene: THREE.Scene) {
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

  // for (let i = 0; i < 42; i++) {
  while (segments.length > 0) {
    let foundNextSegment = false;
    let loopComplete = false;

    for (let j = 0; j < segments.length; j += 2) {
      const start = segments[j];
      const end = segments[j + 1];

      // setTimeout(() => {
      //   newLine(scene, start, end, 0xff0000);
      // }, j * 500);

      // if (distSq(segment.start, end) < epsSq || distSq(segment.end, start) < epsSq) {
      if (distSq(segment.end, start) < epsSq) {
        foundNextSegment = true;

        // setTimeout(() => {
        //   if (cw) {
        //     newLine(start, end);
        //     // newCube(end);
        //   } else {
        //     newLine(end, start);
        //     // newCube(start);
        //   }
        // }, idx * 2000);

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

      // console.log(edge);
      // setTimeout(() => {
      //   newLine(start, end);
      //   // newCube(edge.vertex.point);
      //   newCube(end);
      //   // console.log('YOO', edge.vertex.point);
      // }, idx * 500);
    }

    if (!foundNextSegment || loopComplete) {
      // console.log(loopComplete ? 'loop complete' : 'next not found');
      loop.length = 0;

      if (segments.length > 0) {
        loop.push(segments[0], segments[1]);
        firstSegment.start = segments[0].clone();
        firstSegment.end = segments[1].clone();
        segment.start = segments[0];
        segment.end = segments[1];
        segments.splice(0, 2);

        // newLine(scene, segment.start, segment.end, 0xff0000);
        // newCube(segment.end);
      }
    }
  }

  return loops;
}

// https://stackoverflow.com/questions/9043805/test-if-two-lines-intersect-javascript-function
function intersects(a: number, b: number, c: number, d: number, p: number, q: number, r: number, s: number) {
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
