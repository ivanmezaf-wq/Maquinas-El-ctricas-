// Utilidades de escena compartidas por el grid y el visor.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function createRenderer(canvas, { alpha = true } = {}) {
  // stencil: necesario para las tapas de sección de los cortes
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha, stencil: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

let envCache = null;
export function environment(renderer) {
  if (envCache) return envCache;
  const pm = new THREE.PMREMGenerator(renderer);
  envCache = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  pm.dispose();
  return envCache;
}

export function addLights(scene, { shadows = false } = {}) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f98, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(400, 700, 500);
  if (shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const c = key.shadow.camera;
    c.left = c.bottom = -600;
    c.right = c.top = 600;
    c.near = 10;
    c.far = 2500;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.6;
  }
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdde8ff, 0.5);
  rim.position.set(-500, 200, -600);
  scene.add(rim);
  return key;
}

// Distancia de cámara para encuadrar una esfera
export function fitDistance(camera, radius, pad = 1.15) {
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const fovH = 2 * Math.atan(Math.tan(fov / 2) * camera.aspect);
  const f = Math.min(fov, fovH);
  return (radius * pad) / Math.sin(f / 2);
}
