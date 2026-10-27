// Página principal: grid de tarjetas con vista previa 3D en vivo de cada motor.
// Se usa un único lienzo WebGL a pantalla completa y se dibuja cada motor en el
// rectángulo de su tarjeta (técnica de scissor), así no se agotan los contextos WebGL.
import * as THREE from 'three';
import { createRenderer, environment, addLights, fitDistance } from './scene.js';
import { MOTORS } from './catalog.js';

const canvas = document.getElementById('bg');
const renderer = createRenderer(canvas);
renderer.setScissorTest(true);
const env = environment(renderer);
const gridEl = document.getElementById('grid');

const views = [];
for (const mod of MOTORS) {
  const a = document.createElement('a');
  a.className = 'card';
  a.href = `viewer.html?m=${mod.info.id}`;
  a.innerHTML = `
    <div class="view"><span class="loading">Construyendo modelo…</span></div>
    <div class="meta">
      <h2>${mod.info.name}</h2>
      <p class="short">${mod.info.short}</p>
      <p class="sum">${mod.info.summary}</p>
      <div class="foot"><span class="count"></span><span class="open">Abrir en 3D →</span></div>
    </div>`;
  gridEl.appendChild(a);
  views.push({ mod, el: a.querySelector('.view'), card: a, scene: null, camera: null, model: null, hover: false, angle: Math.random() * 6 });
  a.addEventListener('mouseenter', () => (views.find((v) => v.card === a).hover = true));
  a.addEventListener('mouseleave', () => (views.find((v) => v.card === a).hover = false));
}

// construcción diferida para no bloquear la primera pintura
let buildIdx = 0;
function buildNext() {
  if (buildIdx >= views.length) return;
  const v = views[buildIdx++];
  try {
    const model = v.mod.build();
    const scene = new THREE.Scene();
    scene.environment = env;
    addLights(scene);
    const pivot = new THREE.Group();
    pivot.add(model.root);
    scene.add(pivot);
    const box = new THREE.Box3().setFromObject(model.root);
    const c = box.getCenter(new THREE.Vector3());
    model.root.position.sub(c);
    const radius = box.getBoundingSphere(new THREE.Sphere()).radius;
    const camera = new THREE.PerspectiveCamera(30, 1, 1, 20000);
    Object.assign(v, { model, scene, camera, pivot, radius });
    v.el.querySelector('.loading').remove();
    v.card.querySelector('.count').textContent = `${model.parts.length} piezas`;
  } catch (err) {
    console.error(err);
    v.el.querySelector('.loading').textContent = 'Error al construir: ' + err.message;
  }
  setTimeout(buildNext, 30);
}
setTimeout(buildNext, 50);

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  renderer.setScissorTest(false);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.setScissorTest(true);
  const H = canvas.clientHeight;
  for (const v of views) {
    if (!v.scene) continue;
    const r = v.el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > H || r.right < 0 || r.left > canvas.clientWidth) continue;
    v.angle += dt * (v.hover ? 0.9 : 0.25);
    v.pivot.rotation.y = v.angle;
    v.model.setExplode(v.hover ? Math.min(1, (v.ex = (v.ex || 0) + dt * 1.2)) * 0.35 : Math.max(0, (v.ex = Math.max(0, (v.ex || 0) - dt * 1.2))) * 0.35);
    v.camera.aspect = r.width / r.height;
    v.camera.updateProjectionMatrix();
    const d = fitDistance(v.camera, v.radius, v.hover ? 1.0 : 0.82);
    v.camera.position.set(0, d * 0.32, d * 0.95);
    v.camera.lookAt(0, 0, 0);
    const y = H - r.bottom;
    renderer.setViewport(r.left, y, r.width, r.height);
    renderer.setScissor(r.left, y, r.width, r.height);
    renderer.render(v.scene, v.camera);
  }
  requestAnimationFrame(loop);
}
loop();
