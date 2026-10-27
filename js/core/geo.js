// Generadores de geometría paramétrica para piezas de máquinas eléctricas.
// Convenciones: unidades en mm, el eje del motor es el eje Z (z>0 = lado de acoplamiento, LA).
import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

const V2 = THREE.Vector2;
const V3 = THREE.Vector3;
const TAU = Math.PI * 2;
const Z = new V3(0, 0, 1);

// ───────────────────────────── utilidades básicas ─────────────────────────────

export function crease(geo, deg = 35) {
  return toCreasedNormals(geo, THREE.MathUtils.degToRad(deg));
}

function prep(g) {
  // Normaliza atributos para poder fusionar geometrías heterogéneas
  let out = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(out.attributes)) {
    if (k !== 'position' && k !== 'normal' && k !== 'uv') out.deleteAttribute(k);
  }
  if (!out.attributes.uv) {
    out.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(out.attributes.position.count * 2), 2));
  }
  out.clearGroups();
  return out;
}

export function merge(geos) {
  const list = geos.filter(Boolean).map(prep);
  if (!list.length) return new THREE.BufferGeometry();
  return mergeGeometries(list, false);
}

export function mesh(geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Matriz que lleva el eje +Z local a la dirección `dir`, girado `roll` sobre ella y trasladado a `pos`
export function frameMatrix(pos, dir = Z, roll = 0) {
  const q = new THREE.Quaternion().setFromUnitVectors(Z, dir.clone().normalize());
  if (roll) q.multiply(new THREE.Quaternion().setFromAxisAngle(Z, roll));
  return new THREE.Matrix4().compose(pos, q, new V3(1, 1, 1));
}

export function placed(geo, pos, dir = Z, roll = 0) {
  return geo.clone().applyMatrix4(frameMatrix(pos, dir, roll));
}

export function polar(r, a, z = 0) {
  return new V3(r * Math.cos(a), r * Math.sin(a), z);
}

// Repite una geometría alrededor del eje Z
export function circular(geo, n, phase = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(geo.clone().applyMatrix4(new THREE.Matrix4().makeRotationZ(phase + (i * TAU) / n)));
  }
  return merge(out);
}

// ───────────────────────────── sólidos de revolución ─────────────────────────────

// Perfil [[r, z], ...] revolucionado alrededor del eje Z
export function lathe(profile, seg = 64, phiStart = 0, phiLen = TAU) {
  const pts = profile.map(([r, z]) => new V2(Math.max(r, 0.0001), z));
  const g = new THREE.LatheGeometry(pts, seg, phiStart, phiLen);
  g.rotateX(Math.PI / 2);
  return crease(g, 40);
}

// Anillo rectangular (r interior, r exterior, z0, z1)
export function ring(rIn, rOut, z0, z1, seg = 64) {
  if (rIn <= 0.001) return cyl(rOut, z0, z1, seg);
  return lathe([[rIn, z0], [rOut, z0], [rOut, z1], [rIn, z1], [rIn, z0]], seg);
}

export function cyl(r, z0, z1, seg = 48) {
  const g = new THREE.CylinderGeometry(r, r, z1 - z0, seg);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, (z0 + z1) / 2);
  return crease(g, 40);
}

export function cone(r0, r1, z0, z1, seg = 48) {
  const g = new THREE.CylinderGeometry(r1, r0, z1 - z0, seg);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, (z0 + z1) / 2);
  return crease(g, 40);
}

export function box(w, h, d, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

export function sphere(r, x = 0, y = 0, z = 0, seg = 12) {
  const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.6));
  g.translate(x, y, z);
  return g;
}

export function torus(R, r, arc = TAU, seg = 48, rs = 10) {
  return new THREE.TorusGeometry(R, r, rs, seg, arc);
}

// ───────────────────────────── extrusiones ─────────────────────────────

export function extrude(shape, z0, z1, curveSegments = 24) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: z1 - z0, bevelEnabled: false, curveSegments });
  g.translate(0, 0, z0);
  return crease(g, 35);
}

export function circlePath(r, n = 64, ccw = true, cx = 0, cy = 0) {
  const p = new THREE.Path();
  p.absarc(cx, cy, r, 0, TAU, !ccw);
  return p;
}

export function circleShape(r, holes = [], n = 64) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r, 0, TAU, false);
  holes.forEach((h) => s.holes.push(h));
  return s;
}

export function annulusShape(rIn, rOut) {
  return circleShape(rOut, [circlePath(rIn)]);
}

export function polyShape(pts) {
  return new THREE.Shape(pts.map((p) => new V2(p[0] ?? p.x, p[1] ?? p.y)));
}

export function polyPath(pts) {
  return new THREE.Path(pts.map((p) => new V2(p[0] ?? p.x, p[1] ?? p.y)));
}

export function roundedRectPts(w, h, r, cx = 0, cy = 0, n = 6) {
  r = Math.min(r, w / 2 - 0.01, h / 2 - 0.01);
  const pts = [];
  const corners = [
    [cx + w / 2 - r, cy + h / 2 - r, 0],
    [cx - w / 2 + r, cy + h / 2 - r, Math.PI / 2],
    [cx - w / 2 + r, cy - h / 2 + r, Math.PI],
    [cx + w / 2 - r, cy - h / 2 + r, (3 * Math.PI) / 2],
  ];
  for (const [x, y, a0] of corners) {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * (Math.PI / 2);
      pts.push(new V2(x + r * Math.cos(a), y + r * Math.sin(a)));
    }
  }
  return pts;
}

export function roundedRectShape(w, h, r, cx = 0, cy = 0) {
  return new THREE.Shape(roundedRectPts(w, h, r, cx, cy));
}

export function hexPts(s, rot = 0) {
  // s = distancia entre caras
  const R = s / Math.sqrt(3);
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = rot + (i * Math.PI) / 3 + Math.PI / 6;
    pts.push(new V2(R * Math.cos(a), R * Math.sin(a)));
  }
  return pts;
}

// Deforma una geometría girando cada vértice proporcionalmente a su z (inclinación de ranuras)
export function skew(geo, totalAngle, z0, z1) {
  const p = geo.attributes.position;
  const n = geo.attributes.normal;
  const v = new V3();
  for (let i = 0; i < p.count; i++) {
    const t = (p.getZ(i) - z0) / (z1 - z0) - 0.5;
    const a = t * totalAngle;
    const c = Math.cos(a), s = Math.sin(a);
    const x = p.getX(i), y = p.getY(i);
    p.setXY(i, x * c - y * s, x * s + y * c);
    if (n) {
      v.set(n.getX(i), n.getY(i), n.getZ(i));
      n.setXY(i, v.x * c - v.y * s, v.x * s + v.y * c);
    }
  }
  p.needsUpdate = true;
  geo.computeBoundingSphere();
  return geo;
}

// Dobla una geometría plana (eje x = ancho) sobre un cilindro de radio R alrededor de Z
export function bendAroundZ(geo, R) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const a = x / R;
    const r = R + y;
    p.setXY(i, r * Math.sin(a), r * Math.cos(a));
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// ───────────────────────────── chapas magnéticas ranuradas ─────────────────────────────

/**
 * Perfil de ranura en coordenadas locales [d, semiancho] desde la superficie del entrehierro.
 * w0: abertura, h0: altura del labio, h1: cuña, wTop/wBot: anchos superior/inferior, depth: profundidad.
 */
export function slotProfile({ w0, h0, h1, wTop, wBot, depth, round = true, n = 6 }) {
  const pr = [[0, w0 / 2], [h0, w0 / 2], [h0 + h1, wTop / 2]];
  if (round) {
    const dc = depth - wBot / 2;
    pr.push([dc, wBot / 2]);
    for (let i = 1; i <= n; i++) {
      const f = (i / n) * (Math.PI / 2);
      pr.push([dc + (wBot / 2) * Math.sin(f), (wBot / 2) * Math.cos(f)]);
    }
  } else {
    pr.push([depth, wBot / 2], [depth, 0]);
  }
  return pr;
}

export function profileHalfWidth(profile, d) {
  for (let i = 1; i < profile.length; i++) {
    const [d0, w0] = profile[i - 1];
    const [d1, w1] = profile[i];
    if (d >= d0 && d <= d1) {
      if (d1 - d0 < 1e-6) return Math.max(w0, w1);
      return w0 + ((d - d0) / (d1 - d0)) * (w1 - w0);
    }
  }
  return 0;
}

function slotLocalToGlobal(R, a, d, t, inward) {
  const r = inward ? R - d : R + d;
  return new V2(r * Math.cos(a) - t * Math.sin(a), r * Math.sin(a) + t * Math.cos(a));
}

/**
 * Contorno circular de radio R con N ranuras (inward=false: ranuras hacia afuera, p.ej. diámetro interior del estator;
 * inward=true: ranuras hacia adentro, p.ej. periferia de un inducido).
 */
export function slottedCirclePts(R, N, profile, inward = false, phase = 0, arcSeg = 6) {
  const pts = [];
  const hw0 = profile[0][1];
  const da = Math.asin(Math.min(0.99, hw0 / R));
  for (let k = 0; k < N; k++) {
    const a = phase + (k * TAU) / N;
    // flanco izquierdo (t negativo), hacia el fondo
    for (const [d, w] of profile) pts.push(slotLocalToGlobal(R, a, d, -w, inward));
    // flanco derecho de regreso
    for (let i = profile.length - 1; i >= 0; i--) {
      const [d, w] = profile[i];
      if (w < 1e-4) continue;
      pts.push(slotLocalToGlobal(R, a, d, w, inward));
    }
    // arco del diente hasta la siguiente ranura
    const a0 = a + da, a1 = a + TAU / N - da;
    for (let i = 1; i < arcSeg; i++) {
      const ai = a0 + ((a1 - a0) * i) / arcSeg;
      pts.push(new V2(R * Math.cos(ai), R * Math.sin(ai)));
    }
  }
  return pts;
}

// Región interior de una ranura (para conductores, aislamiento, cuñas)
export function slotRegionPts(R, a, profile, dFrom, dTo, inset = 0, inward = false, steps = 10) {
  const left = [], right = [];
  for (let i = 0; i <= steps; i++) {
    const d = dFrom + ((dTo - dFrom) * i) / steps;
    const w = Math.max(0.15, profileHalfWidth(profile, d) - inset);
    left.push(slotLocalToGlobal(R, a, d, -w, inward));
    right.push(slotLocalToGlobal(R, a, d, w, inward));
  }
  return [...left, ...right.reverse()];
}

// Ranura cerrada tipo gota (barras de jaula): centro superior rT radio aT, centro inferior rB radio aB
export function teardropPts(a, rT, aT, rB, aB, n = 10, inward = true) {
  const pts = [];
  const toG = (r, t) => new V2(r * Math.cos(a) - t * Math.sin(a), r * Math.sin(a) + t * Math.cos(a));
  for (let i = 0; i <= n; i++) {
    const f = -Math.PI / 2 + (i / n) * Math.PI;
    pts.push(toG(rT + aT * Math.cos(f), aT * Math.sin(f)));
  }
  for (let i = 0; i <= n; i++) {
    const f = Math.PI / 2 + (i / n) * Math.PI;
    pts.push(toG(rB + aB * Math.cos(f), aB * Math.sin(f)));
  }
  return pts;
}

// Agujero del eje con chavetero
export function shaftHolePts(r, keyW = 0, keyH = 0, n = 48) {
  if (!keyW) {
    const pts = [];
    for (let i = 0; i < n; i++) pts.push(new V2(r * Math.cos((i / n) * TAU), r * Math.sin((i / n) * TAU)));
    return pts;
  }
  const pts = [];
  const a0 = Math.asin(keyW / 2 / r);
  pts.push(new V2(r + keyH, -keyW / 2), new V2(r + keyH, keyW / 2));
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((TAU - 2 * a0) * i) / n;
    pts.push(new V2(r * Math.cos(a), r * Math.sin(a)));
  }
  return pts;
}

// Paquete de chapas: devuelve malla con material de cara (chapa) y de costado (franjas de laminado)
export function lamStack(shape, z0, z1, matFace, matSide, seg = 24) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: z1 - z0, bevelEnabled: false, curveSegments: seg });
  g.translate(0, 0, z0);
  const g2 = crease(g, 30);
  return mesh(g2, [matFace, matSide]);
}

// ───────────────────────────── devanados ─────────────────────────────

// Bobina de cabeza (cabeza de bobina) entre dos ranuras, como tubo
export function endTurn(r1, a1, r2, a2, zc, ext, over, rBulge, tubeR, dir = 1, seg = 24) {
  let am = (a1 + a2) / 2;
  if (Math.abs(a2 - a1) > Math.PI) am += Math.PI;
  const pts = [
    polar(r1, a1, zc - dir * 2),
    polar(r1, a1, zc + dir * ext),
    polar((r1 + rBulge) / 2, a1 + (am - a1) * 0.45, zc + dir * (ext + over * 0.75)),
    polar(rBulge, am, zc + dir * (ext + over)),
    polar((r2 + rBulge) / 2, a2 + (am - a2) * 0.45, zc + dir * (ext + over * 0.75)),
    polar(r2, a2, zc + dir * ext),
    polar(r2, a2, zc - dir * 2),
  ];
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  return new THREE.TubeGeometry(curve, seg, tubeR, 6, false);
}

// Bobina de polo (concentrada) de sección rectangular alrededor de un núcleo w×l, altura h y espesor t
export function poleCoil(w, l, t, h, r = 4) {
  const outer = roundedRectShape(w + 2 * t, l + 2 * t, r + t);
  outer.holes.push(new THREE.Path(roundedRectPts(w + 0.6, l + 0.6, r).reverse()));
  const bv = Math.min(1.2, t * 0.3);
  const g = new THREE.ExtrudeGeometry(outer, { depth: h, bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelSegments: 2, curveSegments: 8 });
  return crease(g, 40);
}

// Hélice (resortes)
export function helix(r, pitch, turns, wire, seg = 12) {
  class H extends THREE.Curve {
    getPoint(t, target = new V3()) {
      const a = t * turns * TAU;
      return target.set(r * Math.cos(a), r * Math.sin(a), t * turns * pitch);
    }
  }
  return new THREE.TubeGeometry(new H(), Math.ceil(turns * seg), wire, 6, false);
}

export function tubeThrough(points, r, seg = 32, closed = false, radial = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : new V3(...p))), closed, 'centripetal');
  return new THREE.TubeGeometry(curve, seg, r, radial, closed);
}

// ───────────────────────────── tornillería ─────────────────────────────

// Tornillo hexagonal (ISO 4017). La cabeza queda en z∈[0,k], la caña hacia -z con longitud L.
export function hexBolt(d, L, { socket = false, thread = true } = {}) {
  const s = socket ? 1.5 * d : 1.6 * d + 1;
  const k = socket ? d : 0.65 * d;
  const parts = [];
  if (socket) {
    const head = new THREE.Shape();
    head.absarc(0, 0, s / 2, 0, TAU, false);
    head.holes.push(new THREE.Path(hexPts(0.5 * d).reverse()));
    parts.push(extrude(head, k * 0.45, k, 24));
    parts.push(cyl(s / 2, 0, k * 0.45, 24));
    parts.push(cyl(s / 2 - 0.3, k * 0.4, k * 0.5, 24));
  } else {
    parts.push(extrude(new THREE.Shape(hexPts(s)), 0.08 * k, k, 1));
    parts.push(cyl(s * 0.47, 0, 0.1 * k, 24));
    parts.push(cone(s * 0.5, s * 0.42, k, k + 0.04 * k, 6));
  }
  parts.push(cyl(d / 2 * 0.92, -L, 0, 16));
  parts.push(cone(d / 2 * 0.92, d / 2 * 0.6, -L - 0.12 * d, -L, 16));
  if (thread) {
    const pitch = Math.max(0.5, 0.15 * d);
    const nT = Math.min(18, Math.floor((L * 0.7) / pitch));
    for (let i = 0; i < nT; i++) {
      const t = torus(d / 2 * 0.92, d * 0.045, TAU, 14, 3);
      t.translate(0, 0, -L + pitch * (i + 0.5));
      parts.push(t);
    }
  }
  return merge(parts);
}

// Tornillo de cabeza cilíndrica ranurada / Phillips pequeño
export function panScrew(d, L) {
  const parts = [];
  const head = lathe([[0, 0], [d, 0], [d, 0.35 * d], [0.85 * d, 0.6 * d], [0, 0.65 * d]], 24);
  parts.push(head);
  parts.push(cyl(d / 2 * 0.9, -L, 0, 12));
  const pitch = Math.max(0.35, 0.18 * d);
  for (let i = 0; i < Math.min(14, Math.floor(L / pitch)); i++) {
    const t = torus(d / 2 * 0.9, d * 0.05, TAU, 12, 3);
    t.translate(0, 0, -L + pitch * (i + 0.5));
    parts.push(t);
  }
  return merge(parts);
}

export function nut(d, { s = 1.6 * d + 1, m = 0.8 * d } = {}) {
  const sh = new THREE.Shape(hexPts(s));
  sh.holes.push(circlePath(d / 2, 24, false));
  return merge([extrude(sh, 0, m, 20)]);
}

export function washer(d, { od = 2 * d + 2, t = 0.18 * d + 0.4 } = {}) {
  return ring(d / 2 + 0.3, od / 2, 0, t, 32);
}

export function springWasher(d) {
  const g = torus(d * 0.7, d * 0.12, TAU * 0.95, 24, 4);
  return g;
}

// Espárrago roscado (barra de amarre)
export function stud(d, L) {
  const parts = [cyl(d / 2 * 0.92, 0, L, 16)];
  const pitch = Math.max(0.6, 0.15 * d);
  const n = Math.min(40, Math.floor(L / pitch));
  for (let i = 0; i < n; i++) {
    const t = torus(d / 2 * 0.92, d * 0.045, TAU, 12, 3);
    t.translate(0, 0, pitch * (i + 0.5));
    parts.push(t);
  }
  return merge(parts);
}

// Cáncamo de izaje (DIN 580) con eje +Z hacia arriba desde la base
export function eyeBolt(d) {
  const ringR = 1.6 * d;
  const t = torus(ringR, 0.42 * d, TAU, 40, 12);
  t.rotateX(Math.PI / 2);
  t.translate(0, 0, 0.9 * d + ringR + 0.4 * d);
  const collar = lathe([[0, 0], [1.9 * d, 0], [1.9 * d, 0.35 * d], [1.1 * d, 0.95 * d], [0, 0.95 * d]], 32);
  return merge([t, collar, stud(d, 1.5 * d).translate(0, 0, -1.5 * d)]);
}

// Engrasador (grasera) DIN 71412
export function greaseNipple(d = 6) {
  return merge([
    extrude(new THREE.Shape(hexPts(1.8 * d)), 0, 0.9 * d, 1),
    cyl(0.45 * d, 0.9 * d, 1.6 * d, 16),
    sphere(0.6 * d, 0, 0, 2.0 * d, 14),
    stud(d, 1.2 * d).translate(0, 0, -1.2 * d),
  ]);
}

// Chaveta paralela (DIN 6885) a lo largo de Z
export function parallelKey(b, h, L) {
  const s = roundedRectShape(b, L, b / 2 - 0.01);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.3, bevelSegments: 1, curveSegments: 10 });
  g.translate(0, 0, -h / 2);
  g.rotateX(Math.PI / 2); // largo sobre Z, altura sobre Y
  g.rotateZ(-Math.PI / 2); // altura sobre X (radial)
  return crease(g, 40);
}

// Anillo de retención (circlip) DIN 471
export function circlip(r, w = 2, t = 1.5) {
  const g = new THREE.ExtrudeGeometry(
    (() => {
      const s = new THREE.Shape();
      const a0 = 0.35, a1 = TAU - 0.35;
      s.absarc(0, 0, r + w, a0, a1, false);
      s.absarc(0, 0, r, a1, a0, true);
      return s;
    })(),
    { depth: t, bevelEnabled: false, curveSegments: 48 },
  );
  const lugs = [];
  for (const a of [0.35, TAU - 0.35]) {
    const l = cyl(w * 0.9, 0, t, 12);
    l.translate((r + w * 1.5) * Math.cos(a), (r + w * 1.5) * Math.sin(a), 0);
    lugs.push(l);
  }
  return merge([crease(g), ...lugs]);
}

// ───────────────────────────── rodamientos ─────────────────────────────

/**
 * Rodamiento rígido de bolas (p.ej. 6308-2Z). Centro en z=0, eje Z.
 * Devuelve un grupo con anillos, bolas, jaula y tapas de protección.
 */
export function ballBearing(d, D, B, mats, { shields = true, nBalls } = {}) {
  const g = new THREE.Group();
  const pitchR = (d + D) / 4;
  const ballR = (D - d) * 0.16;
  const n = nBalls || Math.max(7, Math.floor((TAU * pitchR) / (ballR * 2.6)));
  const ch = Math.min(1.2, B * 0.06);
  const grooveOut = [];
  const grooveIn = [];
  for (let i = 0; i <= 10; i++) {
    const f = -Math.PI / 2 + (i / 10) * Math.PI;
    grooveOut.push([pitchR + ballR * 1.02 * Math.cos(f) * 0.55 + ballR * 0.45, ballR * 1.02 * Math.sin(f)]);
    grooveIn.push([pitchR - ballR * 1.02 * Math.cos(f) * 0.55 - ballR * 0.45, -ballR * 1.02 * Math.sin(f)]);
  }
  const rOutIn = pitchR + ballR * 0.45;
  const rInOut = pitchR - ballR * 0.45;
  const outer = lathe([
    [D / 2 - ch, -B / 2], [D / 2, -B / 2 + ch], [D / 2, B / 2 - ch], [D / 2 - ch, B / 2],
    [rOutIn + 0.6, B / 2], [rOutIn + 0.6, B / 2 - 1.4], [rOutIn, B / 2 - 1.4],
    [rOutIn, ballR * 1.02],
    ...grooveOut.slice().reverse().map(([r, z]) => [r, z]),
    [rOutIn, -ballR * 1.02],
    [rOutIn, -B / 2 + 1.4], [rOutIn + 0.6, -B / 2 + 1.4], [rOutIn + 0.6, -B / 2],
    [D / 2 - ch, -B / 2],
  ], 72);
  const inner = lathe([
    [d / 2 + ch, -B / 2], [rInOut - 0.4, -B / 2], [rInOut, -B / 2 + 1],
    [rInOut, -ballR * 1.02],
    ...grooveIn.map(([r, z]) => [r, z]).reverse(),
    [rInOut, ballR * 1.02],
    [rInOut, B / 2 - 1], [rInOut - 0.4, B / 2], [d / 2 + ch, B / 2], [d / 2, B / 2 - ch], [d / 2, -B / 2 + ch], [d / 2 + ch, -B / 2],
  ], 72);
  g.add(mesh(outer, mats.aceroRodamiento));
  g.add(mesh(inner, mats.aceroRodamiento));
  const balls = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    balls.push(sphere(ballR, pitchR * Math.cos(a), pitchR * Math.sin(a), 0, 16));
  }
  g.add(mesh(merge(balls), mats.aceroRodamiento));
  // jaula estampada de dos mitades
  const cageParts = [ring(pitchR - ballR * 0.35, pitchR + ballR * 0.35, ballR * 0.75, ballR * 0.95, 64), ring(pitchR - ballR * 0.35, pitchR + ballR * 0.35, -ballR * 0.95, -ballR * 0.75, 64)];
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * TAU;
    const b = box(ballR * 0.7, ballR * 0.5, ballR * 1.9);
    b.rotateZ(a);
    b.translate(pitchR * Math.cos(a), pitchR * Math.sin(a), 0);
    cageParts.push(b);
  }
  g.add(mesh(merge(cageParts), mats.laton));
  if (shields) {
    for (const s of [1, -1]) {
      const sh = ring(rInOut + 0.3, rOutIn + 0.6, s * (B / 2 - 1.3) - 0.3, s * (B / 2 - 1.3) + 0.3, 72);
      g.add(mesh(sh, mats.zincado));
    }
  }
  return g;
}

// Buje de bronce sinterizado (cojinete de manguito)
export function sleeveBearing(d, D, L, mat) {
  return mesh(lathe([[d / 2, -L / 2], [D / 2 - 0.6, -L / 2], [D / 2, -L / 2 + 0.6], [D / 2, L / 2 - 0.6], [D / 2 - 0.6, L / 2], [d / 2, L / 2], [d / 2, -L / 2]], 48), mat);
}

// ───────────────────────────── ventiladores ─────────────────────────────

// Ventilador radial externo (enfriamiento TEFC). Cubo en el eje, álabes rectos radiales.
export function radialFan({ rHub, rOut, bore, nBlades = 10, z0, z1, hubLen, bladeT = 3, disc = true }) {
  const parts = [];
  parts.push(ring(bore / 2, rHub, z0 - (hubLen - (z1 - z0)), z1, 48));
  if (disc) parts.push(ring(rHub - 1, rOut, z1 - 3, z1, 72));
  for (let i = 0; i < nBlades; i++) {
    const a = (i / nBlades) * TAU;
    const sh = new THREE.Shape([new V2(rHub - 2, -bladeT / 2), new V2(rOut, -bladeT / 2), new V2(rOut, bladeT / 2), new V2(rHub - 2, bladeT / 2)]);
    const b = extrude(sh, z0, z1, 1);
    b.rotateZ(a);
    parts.push(b);
  }
  return merge(parts);
}

// Rejilla perforada (tapa del cubreventilador)
export function perforatedDisc(R, holeR, pitch, t, z0, rCenter = 0) {
  const s = new THREE.Shape();
  s.absarc(0, 0, R, 0, TAU, false);
  for (let rr = Math.max(rCenter, pitch * 0.7); rr < R - holeR - 3; rr += pitch) {
    const n = Math.max(6, Math.floor((TAU * rr) / pitch));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + (rr / pitch) * 0.3;
      s.holes.push(circlePath(holeR, 12, false, rr * Math.cos(a), rr * Math.sin(a)));
    }
  }
  return extrude(s, z0, z0 + t, 10);
}

// ───────────────────────────── conmutación ─────────────────────────────

/**
 * Colector (conmutador) con N delgas de cobre separadas por mica, de rIn a rOut, entre z0 y z1.
 * Devuelve { delgas, mica, risers } geometrías.
 */
export function commutator(N, rIn, rOut, z0, z1, riserH, riserLen) {
  const gap = 0.9; // espesor de la mica (mm, exagerado para visualización)
  const segs = [];
  const micas = [];
  const risers = [];
  const dA = TAU / N;
  const gA = gap / rOut;
  for (let i = 0; i < N; i++) {
    const a0 = i * dA + gA / 2;
    const a1 = (i + 1) * dA - gA / 2;
    const s = new THREE.Shape();
    s.absarc(0, 0, rOut, a0, a1, false);
    s.absarc(0, 0, rIn, a1, a0, true);
    segs.push(extrude(s, z0, z1, 4));
    // banderola (riser) en el extremo del lado del inducido
    const rs = new THREE.Shape();
    rs.absarc(0, 0, rOut + riserH, a0 + gA, a1 - gA, false);
    rs.absarc(0, 0, rOut - 1, a1 - gA, a0 + gA, true);
    risers.push(extrude(rs, z1 - 0.01, z1 + riserLen, 3));
    const ms = new THREE.Shape();
    ms.absarc(0, 0, rOut - 0.5, a1, a1 + gA, false);
    ms.absarc(0, 0, rIn, a1 + gA, a1, true);
    micas.push(extrude(ms, z0 + 0.5, z1 - 0.2, 1));
  }
  return { delgas: merge(segs), mica: merge(micas), risers: merge(risers) };
}

export { TAU, V2, V3 };
