import GUI from 'lil-gui';
import * as THREE from 'three';
import { Dcel } from 'three-halfedge-dcel';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HalfEdge } from 'three/addons/math/ConvexHull.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

import '@ui/style.css';

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
    this.camera.position.set(1500, 1200, 1500);

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
    backFaceStencilMat.depthWrite = false;
    backFaceStencilMat.depthTest = false;
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

    const planeGeom = new THREE.PlaneGeometry();
    const planeMesh = new THREE.Mesh(planeGeom, planeStencilMat);
    planeMesh.scale.setScalar(100000);
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
    });

    planeMesh.onAfterRender = (renderer: THREE.WebGLRenderer) => {
      renderer.clearStencil();
    };

    const scene = this.scene;

    const fbxLoader = new FBXLoader();
    fbxLoader.load(
      '/house.fbx',
      (object) => {
        object.traverse(function (child) {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;

            if (mesh.material) {
              mesh.material = material;
            }

            try {
              mesh.geometry = BufferGeometryUtils.mergeVertices(mesh.geometry);
              const dcel = new Dcel(mesh.geometry);

              // Skip non-manifold meshes
              for (const f of dcel.faces) {
                if (!f.edge.twin) {
                  throw Error();
                }
              }

              const backMesh = mesh.clone();
              backMesh.geometry = backMesh.geometry.clone();
              backMesh.material = backFaceStencilMat;
              scene.add(backMesh);

              backMesh.traverse(function (child) {
                if ((child as THREE.Mesh).isMesh) {
                  const mesh = child as THREE.Mesh;
                  if (mesh.material) {
                    mesh.material = backFaceStencilMat;
                  }
                }
              });

              const frontMesh = mesh.clone();
              frontMesh.geometry = frontMesh.geometry.clone();
              frontMesh.material = frontFaceStencilMat;
              scene.add(frontMesh);

              frontMesh.traverse(function (child) {
                if ((child as THREE.Mesh).isMesh) {
                  const mesh = child as THREE.Mesh;
                  if (mesh.material) {
                    mesh.material = frontFaceStencilMat;
                  }
                }
              });
            } catch (e) {
              // console.log(e);
            }
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
