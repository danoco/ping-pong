import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as dat from 'lil-gui';
import CANNON from 'cannon';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import './style.css';

THREE.ColorManagement.enabled = false;

//Debug

const gui = new dat.GUI();
const debugObject = {};

debugObject.createSphere = () => {
  createSphere(0.3, {
    x: (Math.random() - 0.5) * 1.5,
    y: 3,
    z: (Math.random() - 0.5) * 1.5,
  });
};

gui.add(debugObject, 'createSphere');

// Canvas
const canvas = document.querySelector('canvas.webgl');

// Scene
const scene = new THREE.Scene();

//Sounds

const hitSound = new Audio('/sounds/hit.mp3');

const playHitSound = (collision) => {
  const impactStrength = collision.contact.getImpactVelocityAlongNormal();

  if (impactStrength > 1.5) {
    hitSound.volume = Math.random();
    hitSound.currentTime = 0;
    hitSound.play();
  }
};

//Textures

const textureLoader = new THREE.TextureLoader();
const cubeTextureLoader = new THREE.CubeTextureLoader();

const environmentMapTexture = cubeTextureLoader.load(
  '/textures/environmentMaps/0/px.png'
);

const loader = new FBXLoader();

//Physics

const world = new CANNON.World();
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;
world.gravity.set(0, -9.82, 0);

// Default material
const defaultMaterial = new CANNON.Material('default');
const defaultContactMaterial = new CANNON.ContactMaterial(
  defaultMaterial,
  defaultMaterial,
  {
    friction: 0.1,
    restitution: 0.7,
  }
);
world.defaultContactMaterial = defaultContactMaterial;

const objectsToUpdate = [];

//score
let score = 0;
const scoreElement = document.getElementById('score');
function onBallBounce() {
  score++;
  scoreElement.textContent = score;
}

//rocket
let fbxModel;

loader.load('/ping.fbx', (fbx) => {
  const scaleFactor = 1 / 5;
  fbx.scale.set(scaleFactor, scaleFactor, scaleFactor);
  fbx.position.y = 1.5;
  fbx.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  fbxModel = fbx;
  scene.add(fbxModel);

  // Cannon.js body
  const shape = new CANNON.Box(new CANNON.Vec3(3, 0.2, 2));

  fbxModel.body = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(0, 1.5, 0),
    shape: shape,
    material: defaultMaterial,
  });
  fbxModel.body.position.copy({ x: 0, y: 1.5, z: 0 });
  fbxModel.body.addEventListener('collide', onBallBounce);
  world.addBody(fbxModel.body);

  tick();
});

//ball
const sphereGeometry = new THREE.SphereGeometry(1, 20, 20);
const sphereMaterial = new THREE.MeshStandardMaterial({
  metalness: 0.3,
  roughness: 0.4,
  envMap: environmentMapTexture,
  envMapIntensity: 0.5,
});

const createSphere = (radius, position) => {
  // Three.js mesh
  const mesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
  mesh.castShadow = true;
  mesh.scale.set(radius, radius, radius);
  mesh.position.copy(position);
  scene.add(mesh);

  // Cannon.js body
  const shape = new CANNON.Sphere(radius);

  const body = new CANNON.Body({
    mass: 1,
    position: new CANNON.Vec3(0, 3, 0),
    shape: shape,
    material: defaultMaterial,
  });
  body.position.copy(position);
  body.addEventListener('collide', playHitSound);
  world.addBody(body);

  objectsToUpdate.push({ mesh, body });
};

createSphere(0.3, {
  x: (Math.random() - 0.5) * 1.5,
  y: 3,
  z: (Math.random() - 0.5) * 1.5,
});

// Floor
const floorShape = new CANNON.Plane();
const floorBody = new CANNON.Body();
floorBody.mass = 0;
floorBody.addShape(floorShape);
floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(-1, 0, 0), Math.PI * 0.5);
world.addBody(floorBody);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(10, 10),
  new THREE.MeshStandardMaterial({
    color: '#777777',
    metalness: 0.3,
    roughness: 0.4,
    envMap: environmentMapTexture,
    envMapIntensity: 0.5,
  })
);
floor.receiveShadow = true;
floor.rotation.x = -Math.PI * 0.5;
scene.add(floor);

//Lights

const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.2);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.set(1024, 1024);
directionalLight.shadow.camera.far = 15;
directionalLight.shadow.camera.left = -7;
directionalLight.shadow.camera.top = 7;
directionalLight.shadow.camera.right = 7;
directionalLight.shadow.camera.bottom = -7;
directionalLight.position.set(0, 10, 0);
scene.add(directionalLight);

// Sizes

const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

window.addEventListener('resize', () => {
  // Update sizes
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  // Update camera
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  // Update renderer
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// Base camera
const camera = new THREE.PerspectiveCamera(
  75,
  sizes.width / sizes.height,
  0.1,
  100
);
camera.position.set(-3, 3, 3);
scene.add(camera);

// Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

//Renderer

const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
});
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

let isMovingUp = false;
const upwardMovementSpeed = 0.1;

//keys
function onKeyDown(event) {
  if (event.keyCode === 32) {
    isMovingUp = true;
  }
}

function onKeyUp(event) {
  if (event.keyCode === 32) {
    isMovingUp = false;
  }
}

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

// Animate

const clock = new THREE.Clock();
let oldElapsedTime = 0;

const tick = () => {
  const elapsedTime = clock.getElapsedTime();
  const deltaTime = elapsedTime - oldElapsedTime;
  oldElapsedTime = elapsedTime;

  world.step(1 / 60, deltaTime, 3);

  if (isMovingUp) {
    fbxModel.position.y += upwardMovementSpeed;
    fbxModel.body.position.copy(fbxModel.position);
  } else {
    fbxModel.position.y = 1.5;
    fbxModel.body.position.y = 1.5;
  }

  for (const object of objectsToUpdate) {
    object.mesh.position.copy(object.body.position);
    object.mesh.quaternion.copy(object.body.quaternion);
  }

  controls.update();

  renderer.render(scene, camera);

  window.requestAnimationFrame(tick);
};
