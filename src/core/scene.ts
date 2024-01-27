import GUI from 'lil-gui';
import * as THREE from 'three';
import { Dcel } from 'three-halfedge-dcel';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

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

  constructor() {
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.localClippingEnabled = true;
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(71, window.innerWidth / window.innerHeight, 0.1, 10000);
    this.camera.position.set(/*1500*/ 0, /*1200*/ 0, 1500);

    window.addEventListener('resize', this.handleResize.bind(this), false);

    new OrbitControls(this.camera, this.renderer.domElement);

    // Light
    const ambientLight = new THREE.AmbientLight();
    this.scene.add(ambientLight);

    // Clipping plane
    const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    plane.constant = 400;

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
            if (mesh.name.includes('Concrete-Round')) {
              //   // mesh.position.x += 10 * Math.random();
              //   // mesh.position.z += 10 * Math.random();
            } else {
              mesh.visible = false;
              return;
            }

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
              // // const geometry = new THREE.TubeGeometry(path, 1, 3, 14, false);
              // const geometry = new THREE.PlaneGeometry(10, 10);
              // const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
              // const me = new THREE.Mesh(geometry, mat);
              // me.scale.setScalar(100);
              // me.rotateX(Math.PI / -2);

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

                const newLine = (
                  p1: { x: number; y: number; z: number },
                  p2: { x: number; y: number; z: number },
                  color = 0x0000ff
                ) => {
                  const material = new THREE.LineBasicMaterial({ color });
                  const points = [new THREE.Vector3(p1.x, p1.y, p1.z), new THREE.Vector3(p2.x, p2.y, p2.z)];
                  const geometry = new THREE.BufferGeometry().setFromPoints(points);
                  const line = new THREE.Line(geometry, material);
                  line.rotation.copy(object.rotation);
                  mesh.add(line);
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

                const eps = 0.001;
                const epsSq = eps * eps;

                type Vec = { x: number; y: number; z: number };

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

              if (mesh.parent) {
                mesh.parent.add(backMesh);
              } else {
                object.add(backMesh);
              }

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

              if (mesh.parent) {
                mesh.parent.add(frontMesh);
              } else {
                object.add(frontMesh);
              }

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
