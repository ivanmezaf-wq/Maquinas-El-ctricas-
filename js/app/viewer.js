// Visor 3D de un motor: despiece, menú de piezas con aislamiento, zoom hacia el cursor.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createRenderer, environment, addLights, fitDistance } from './scene.js';
import { findMotor, MOTORS } from './catalog.js';
import { SIMS } from './sim.js';
import { createSimPanel } from './simpanel.js';
import { SectionCaps } from './caps.js';

const params = new URLSearchParams(location.search);
const motorMod = findMotor(params.get('m'));
const info = motorMod.info;
document.title = `${info.name} · Motores 3D`;
if (window.innerWidth < 860) document.body.classList.add('panel-closed');

const canvas = document.getElementById('c');
const stage = document.getElementById('stage');
const renderer = createRenderer(canvas);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
scene.environment = environment(renderer);
const keyLight = addLights(scene, { shadows: true });

const camera = new THREE.PerspectiveCamera(35, 1, 1, 20000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.09;
controls.zoomToCursor = true; // el zoom avanza hacia el punto bajo el cursor, no hacia el centro
controls.screenSpacePanning = true;
controls.zoomSpeed = 1.1;
controls.minDistance = 2;
controls.maxDistance = 6000;
controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };

// ───── construcción del modelo ─────
const t0 = performance.now();
const model = motorMod.build();
scene.add(model.root);
model.root.updateMatrixWorld(true);
console.info(`[motor3d] ${info.id}: ${model.parts.length} piezas en ${(performance.now() - t0).toFixed(0)} ms`);

// suelo que recibe sombras
const box0 = new THREE.Box3().setFromObject(model.root);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.ShadowMaterial({ opacity: 0.18 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = box0.min.y - 0.5;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(4000, 80, 0x9aa7b8, 0xc3cdd9);
grid.position.y = box0.min.y - 0.4;
grid.material.transparent = true;
grid.material.opacity = 0.55;
scene.add(grid);
const sz = box0.getSize(new THREE.Vector3()).length();
keyLight.shadow.camera.left = keyLight.shadow.camera.bottom = -sz;
keyLight.shadow.camera.right = keyLight.shadow.camera.top = sz;
keyLight.position.set(sz * 0.6, sz * 1.1, sz * 0.8);
keyLight.shadow.camera.far = sz * 4;
keyLight.shadow.camera.updateProjectionMatrix();

// ───── estado ─────
const state = {
  explode: 0,
  explodeTarget: 0,
  isolated: null,
  selected: null,
  hover: null,
  angle: 0,
  hidden: new Set(),
};

// ───── resaltado ─────
const hiCache = new Map();
let currentClip = [];
const caps = new SectionCaps(scene, model, box0.getSize(new THREE.Vector3()).length() * 6);
function hiMat(mat) {
  if (!hiCache.has(mat)) {
    const h = mat.clone();
    h.emissive = new THREE.Color(0x1f6bff);
    h.emissiveIntensity = 0.55;
    h.clippingPlanes = currentClip;
    h.clipIntersection = currentInter;
    hiCache.set(mat, h);
  }
  return hiCache.get(mat);
}
function setHighlight(part, on) {
  if (!part) return;
  part.group.traverse((o) => {
    if (!o.isMesh || o.userData.isStencil) return;
    if (on) {
      if (!o.userData.baseMat) o.userData.baseMat = o.material;
      o.material = Array.isArray(o.userData.baseMat) ? o.userData.baseMat.map(hiMat) : hiMat(o.userData.baseMat);
    } else if (o.userData.baseMat) {
      o.material = o.userData.baseMat;
    }
  });
}
function refreshHighlights() {
  // la pieza aislada se muestra con su color real
  for (const p of model.parts) setHighlight(p, p !== state.isolated && (p === state.selected || p === state.hover));
}

// ───── cámara ─────
let camAnim = null;
function frameBox(box, { animate = true, dir, pad = 1.05 } = {}) {
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const d = fitDistance(camera, Math.max(sphere.radius, 5), pad);
  const v = dir || camera.position.clone().sub(controls.target).normalize();
  const toPos = sphere.center.clone().addScaledVector(v, d);
  if (!animate) {
    controls.target.copy(sphere.center);
    camera.position.copy(toPos);
    return;
  }
  camAnim = { t: 0, fromPos: camera.position.clone(), fromT: controls.target.clone(), toPos, toT: sphere.center.clone() };
}
function partBox(part) {
  return new THREE.Box3().setFromObject(part.group);
}
function visibleBox() {
  const b = new THREE.Box3();
  for (const p of model.parts) if (p.group.visible) b.union(partBox(p));
  return b;
}

// ───── interfaz ─────
const $ = (s) => document.querySelector(s);
$('#motor-name').textContent = info.name;
$('#motor-short').textContent = info.short;
$('#part-count').textContent = `${model.parts.length} piezas · ${model.parts.reduce((a, p) => a + p.qty, 0)} unidades`;

const nav = $('#motor-switch');
for (const mm of MOTORS) {
  const o = document.createElement('option');
  o.value = mm.info.id;
  o.textContent = mm.info.name;
  if (mm.info.id === info.id) o.selected = true;
  nav.appendChild(o);
}
nav.addEventListener('change', () => (location.search = '?m=' + nav.value));

const list = $('#parts');
const itemById = new Map();
function buildList(filter = '') {
  list.innerHTML = '';
  const f = filter.trim().toLowerCase();
  for (const cat of model.categories) {
    const parts = model.parts.filter((p) => p.cat === cat && (!f || (p.name + ' ' + p.mat + ' ' + p.desc).toLowerCase().includes(f)));
    if (!parts.length) continue;
    const sec = document.createElement('details');
    sec.open = true;
    sec.className = 'cat';
    const sum = document.createElement('summary');
    sum.innerHTML = `<span>${cat}</span><span class="n">${parts.length}</span>`;
    sec.appendChild(sum);
    const ul = document.createElement('ul');
    for (const p of parts) {
      const li = document.createElement('li');
      li.className = 'part';
      li.dataset.id = p.id;
      li.innerHTML = `<button class="eye" title="Mostrar / ocultar">${eyeIcon(!state.hidden.has(p.id))}</button><span class="pn">${p.name}</span>${p.qty > 1 ? `<span class="q">×${p.qty}</span>` : ''}`;
      li.addEventListener('click', (e) => {
        if (e.target.closest('.eye')) {
          toggleHidden(p);
          return;
        }
        if (state.isolated === p) showAll();
        else isolate(p);
      });
      li.addEventListener('mouseenter', () => {
        state.hover = p;
        refreshHighlights();
      });
      li.addEventListener('mouseleave', () => {
        if (state.hover === p) state.hover = null;
        refreshHighlights();
      });
      ul.appendChild(li);
      itemById.set(p.id, li);
    }
    sec.appendChild(ul);
    list.appendChild(sec);
  }
  syncList();
}
function eyeIcon(on) {
  return on
    ? '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 5C6.5 5 2.7 9.1 1.5 12c1.2 2.9 5 7 10.5 7s9.3-4.1 10.5-7C21.3 9.1 17.5 5 12 5zm0 11a4 4 0 110-8 4 4 0 010 8z"/></svg>'
    : '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M2 4.3L3.3 3 21 20.7 19.7 22l-3.3-3.3A11.6 11.6 0 0112 19C6.5 19 2.7 14.9 1.5 12a13 13 0 014-5.1zM12 7a5 5 0 015 5c0 .6-.1 1.2-.3 1.8l3.6 3.6c1.4-1.3 2.4-2.8 3.2-4.4C21.3 9.1 17.5 5 12 5c-1.4 0-2.7.3-3.9.7l2.1 2.1c.6-.5 1.2-.8 1.8-.8z"/></svg>';
}
function syncList() {
  for (const [id, li] of itemById) {
    const p = model.byId.get(id);
    li.classList.toggle('active', state.isolated === p);
    li.classList.toggle('selected', state.selected === p);
    li.classList.toggle('off', state.hidden.has(id));
    li.querySelector('.eye').innerHTML = eyeIcon(!state.hidden.has(id));
  }
  $('#btn-all').classList.toggle('hot', !!state.isolated || state.hidden.size > 0);
}
$('#search').addEventListener('input', (e) => buildList(e.target.value));

function applyVisibility() {
  for (const p of model.parts) {
    p.group.visible = state.isolated ? p === state.isolated : !state.hidden.has(p.id);
  }
  syncList();
}
function toggleHidden(p) {
  if (state.hidden.has(p.id)) state.hidden.delete(p.id);
  else state.hidden.add(p.id);
  if (state.isolated) state.isolated = null;
  applyVisibility();
}
function isolate(p) {
  state.isolated = p;
  select(p);
  applyVisibility();
  refreshHighlights();
  frameBox(partBox(p), { pad: 0.8 });
  $('#iso-banner').hidden = false;
  $('#iso-name').textContent = p.name;
}
function showAll() {
  state.isolated = null;
  state.hidden.clear();
  applyVisibility();
  $('#iso-banner').hidden = true;
  frameBox(visibleBox());
}
function select(p) {
  state.selected = p;
  refreshHighlights();
  syncList();
  const card = $('#info');
  if (!p) {
    card.hidden = true;
    return;
  }
  card.hidden = false;
  $('#info-cat').textContent = p.cat + (p.qty > 1 ? ` · ${p.qty} unidades` : '');
  $('#info-name').textContent = p.name;
  $('#info-desc').textContent = p.desc;
  $('#info-mat').textContent = p.mat;
  $('#info-iso').textContent = state.isolated === p ? 'Ver motor completo' : 'Aislar pieza';
  const li = itemById.get(p.id);
  if (li) li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
$('#info-iso').addEventListener('click', () => {
  if (!state.selected) return;
  if (state.isolated === state.selected) showAll();
  else isolate(state.selected);
  $('#info-iso').textContent = state.isolated ? 'Ver motor completo' : 'Aislar pieza';
});
$('#info-close').addEventListener('click', () => select(null));
$('#btn-all').addEventListener('click', showAll);
$('#iso-exit').addEventListener('click', showAll);

const slider = $('#explode');
slider.addEventListener('input', () => {
  state.explodeTarget = slider.value / 100;
  $('#explode-val').textContent = slider.value + ' %';
});
$('#btn-explode').addEventListener('click', () => {
  const v = state.explodeTarget > 0.5 ? 0 : 1;
  state.explodeTarget = v;
  slider.value = v * 100;
  $('#explode-val').textContent = slider.value + ' %';
});
// ───── simulación: el giro 3D sigue la velocidad que resuelven las ecuaciones del motor ─────
const simModel = SIMS[info.id];
const simPanel = simModel ? createSimPanel($('#tab-sim'), simModel, simModel.desc || '') : null;
function showTab(name) {
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
  $('#tab-parts').hidden = name !== 'parts';
  $('#tab-sim').hidden = name !== 'sim';
  if (name === 'sim' && simPanel) requestAnimationFrame(() => simPanel.redraw());
}
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
$('#btn-spin').addEventListener('click', () => {
  if (!simPanel) return;
  if (simPanel.sim.on) simPanel.sim.stop();
  else {
    simPanel.sim.start();
    showTab('sim');
    document.body.classList.remove('panel-closed');
  }
});
// ───── cortes: tres planos independientes (se pueden combinar para un cuarto de corte) ─────
// El eje del motor queda sobre X en pantalla: el plano vertical y el horizontal contienen al eje,
// el transversal es perpendicular a él.
const cuts = [
  { id: 'v', name: 'Vertical', hint: 'Plano longitudinal vertical, pasa por el eje', normal: new THREE.Vector3(0, 0, -1), axis: 'z', on: false, pos: 0, flip: false },
  { id: 'h', name: 'Horizontal', hint: 'Plano longitudinal horizontal, pasa por el eje', normal: new THREE.Vector3(0, -1, 0), axis: 'y', on: false, pos: 0, flip: false },
  { id: 't', name: 'Transversal', hint: 'Plano perpendicular al eje (sección recta)', normal: new THREE.Vector3(-1, 0, 0), axis: 'x', on: false, pos: 0, flip: false },
];
for (const c of cuts) c.plane = new THREE.Plane(c.normal.clone(), 0);
let clipKey = '';
let cutIntersect = false;
let currentInter = false;
function modelMaterials() {
  const set = new Set(hiCache.values());
  model.root.traverse((o) => {
    if (!o.isMesh || o.userData.isStencil) return;
    for (const src of [o.material, o.userData.baseMat]) {
      if (!src) continue;
      (Array.isArray(src) ? src : [src]).forEach((m) => set.add(m));
    }
  });
  return set;
}
function activeCuts() {
  return cuts.filter((c) => c.on).map((c) => c.plane);
}
function updateCuts() {
  for (const c of cuts) {
    const n = c.normal.clone().multiplyScalar(c.flip ? -1 : 1);
    c.plane.normal.copy(n);
    c.plane.constant = -n[c.axis] * c.pos; // el plano pasa por pos sobre su eje
  }
  const act = activeCuts();
  const inter = cutIntersect && act.length > 1;
  const key = cuts.map((c) => (c.on ? c.id : '')).join('') + inter;
  if (key !== clipKey) {
    // recorte por material (no global) para que las tapas de sección no se recorten a sí mismas
    clipKey = key;
    currentClip = act;
    currentInter = inter;
    for (const m of modelMaterials()) {
      m.clippingPlanes = act;
      m.clipIntersection = inter;
      m.needsUpdate = true;
    }
    caps.rebuild(act, inter);
  }
  $('#cut-inter').checked = cutIntersect;
  caps.update();
  $('#btn-section').classList.toggle('on', act.length > 0);
  for (const c of cuts) {
    c.row.classList.toggle('on', c.on);
    c.row.querySelector('input[type=checkbox]').checked = c.on;
    c.row.querySelector('.v').textContent = Math.round(c.pos) + ' mm';
  }
}
const cutBox = $('#cuts');
for (const c of cuts) {
  const lo = Math.floor(box0.min[c.axis]), hi = Math.ceil(box0.max[c.axis]);
  const row = document.createElement('div');
  row.className = 'cut-row';
  row.innerHTML = `
    <div class="cut-head">
      <label><input type="checkbox" /> <b>${c.name}</b></label>
      <button class="flip" title="Invertir el lado que se conserva">⇄ Invertir</button>
    </div>
    <p class="hint">${c.hint}</p>
    <div class="cut-slide"><input type="range" min="${lo}" max="${hi}" step="1" value="0" /><span class="v">0 mm</span></div>`;
  c.row = row;
  row.querySelector('input[type=checkbox]').addEventListener('change', (e) => {
    c.on = e.target.checked;
    updateCuts();
  });
  row.querySelector('input[type=range]').addEventListener('input', (e) => {
    c.pos = +e.target.value;
    if (!c.on) c.on = true;
    updateCuts();
  });
  row.querySelector('.flip').addEventListener('click', () => {
    c.flip = !c.flip;
    if (!c.on) c.on = true;
    updateCuts();
  });
  cutBox.appendChild(row);
}
const interRow = document.createElement('label');
interRow.className = 'cut-inter';
interRow.innerHTML = '<input id="cut-inter" type="checkbox" /> Quitar solo la zona común de los planos (cuarto de corte)';
cutBox.after(interRow);
interRow.querySelector('input').addEventListener('change', (e) => {
  cutIntersect = e.target.checked;
  updateCuts();
});
$('#cut-quarter').addEventListener('click', () => {
  cutIntersect = true;
  for (const c of cuts) {
    c.on = c.id !== 't';
    c.pos = 0;
    c.flip = false;
    c.row.querySelector('input[type=range]').value = 0;
  }
  updateCuts();
});
$('#cut-clear').addEventListener('click', () => {
  for (const c of cuts) c.on = false;
  updateCuts();
});
$('#btn-section').addEventListener('click', () => {
  const panel = $('#cut-panel');
  panel.hidden = !panel.hidden;
  if (!panel.hidden && !activeCuts().length) {
    cuts[0].on = true; // primera vez: corte vertical por defecto
    updateCuts();
  }
});
$('#cut-close').addEventListener('click', () => ($('#cut-panel').hidden = true));
$('#btn-reset').addEventListener('click', () => frameBox(visibleBox(), { dir: new THREE.Vector3(0.62, 0.42, 0.66).normalize() }));
$('#btn-panel').addEventListener('click', () => document.body.classList.toggle('panel-closed'));

// ficha técnica
const specs = $('#specs');
specs.innerHTML = `<p>${info.summary}</p><dl>${info.specs.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;

// ───── interacción en el lienzo ─────
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pick(ev) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const objs = model.parts.filter((p) => p.group.visible).map((p) => p.group);
  const hits = ray.intersectObjects(objs, true);
  for (const h of hits) {
    // ignora lo que el plano de corte ya recortó
    const ac = activeCuts();
    const cut = currentInter ? ac.every((pl) => pl.distanceToPoint(h.point) < 0) : ac.some((pl) => pl.distanceToPoint(h.point) < 0);
    if (ac.length && cut) continue;
    const id = h.object.userData.partId;
    if (id) return { part: model.byId.get(id), point: h.point };
  }
  return null;
}
let down = null;
canvas.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
canvas.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4 || e.button !== 0) return;
  const h = pick(e);
  select(h ? h.part : null);
});
canvas.addEventListener('dblclick', (e) => {
  const h = pick(e);
  if (!h) return;
  // centra la órbita en el punto señalado (sin cambiar la distancia)
  const off = camera.position.clone().sub(controls.target);
  camAnim = { t: 0, fromPos: camera.position.clone(), fromT: controls.target.clone(), toPos: h.point.clone().add(off.multiplyScalar(0.8)), toT: h.point.clone() };
});
let hoverPending = null;
canvas.addEventListener('pointermove', (e) => {
  if (e.buttons) return;
  hoverPending = e;
});
canvas.addEventListener('pointerleave', () => {
  hoverPending = null;
  tip.hidden = true;
});
const tip = $('#tip');
function processHover() {
  if (!hoverPending) return;
  const e = hoverPending;
  hoverPending = null;
  const h = pick(e);
  const p = h ? h.part : null;
  if (p !== state.hover) {
    state.hover = p;
    refreshHighlights();
  }
  canvas.style.cursor = p ? 'pointer' : 'grab';
  if (p) {
    tip.hidden = false;
    tip.textContent = p.name;
    const r = stage.getBoundingClientRect();
    tip.style.left = e.clientX - r.left + 14 + 'px';
    tip.style.top = e.clientY - r.top + 12 + 'px';
  } else tip.hidden = true;
}
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') showAll();
  if (e.key.toLowerCase() === 'e' && e.target.tagName !== 'INPUT') $('#btn-explode').click();
});

// ───── tamaño y bucle ─────
function resize() {
  const r = stage.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / Math.max(1, r.height);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();
buildList();
frameBox(box0, { animate: false, dir: new THREE.Vector3(0.62, 0.42, 0.66).normalize() });

const clock = new THREE.Clock();
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  // despiece suave
  if (Math.abs(state.explode - state.explodeTarget) > 0.0005) {
    state.explode += (state.explodeTarget - state.explode) * Math.min(1, dt * 6);
    model.setExplode(state.explode);
  }
  if (simPanel) {
    state.angle += simPanel.tick(dt, !$('#tab-sim').hidden);
    model.setRotation(state.angle % (Math.PI * 2000));
    const b = $('#btn-spin');
    const on = simPanel.sim.on;
    if (b.classList.contains('on') !== on) {
      b.classList.toggle('on', on);
      b.textContent = on ? '■ Parar' : '▶ Arrancar';
    }
  }
  caps.update();
  if (camAnim) {
    camAnim.t = Math.min(1, camAnim.t + dt * 2.2);
    const k = 1 - Math.pow(1 - camAnim.t, 3);
    camera.position.lerpVectors(camAnim.fromPos, camAnim.toPos, k);
    controls.target.lerpVectors(camAnim.fromT, camAnim.toT, k);
    if (camAnim.t >= 1) camAnim = null;
  }
  processHover();
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();
document.body.classList.add('ready');
window.__motor3d = { THREE, scene, camera, controls, model, state, renderer };
