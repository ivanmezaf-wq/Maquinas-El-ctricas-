// Piezas comunes de motores industriales de CA con carcasa IEC (TEFC, IC411).
// Eje = Z, LA (lado acoplamiento) en +Z, LOA (lado opuesto, ventilador) en -Z, y hacia arriba.
import * as THREE from 'three';
import * as G from '../core/geo.js';
import { nameplateMaterial } from '../core/materials.js';

const { V2, V3, TAU } = G;
const UP = new V3(0, 1, 0);

// ─────────────── carcasa con aletas de enfriamiento y patas ───────────────
export function frameGeometry(o) {
  const { Ri, Ro, finR, nFins, finT = 3.2, z0, z1, skipTop = 0.24, skipBottom = 0.55 } = o;
  const pts = [];
  const fins = [];
  for (let i = 0; i < nFins; i++) {
    const a = Math.PI / 2 + (i * TAU) / nFins + Math.PI / nFins;
    const da = Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2));
    const db = Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2));
    if (Math.abs(da) < skipTop || Math.abs(db) < skipBottom) continue;
    fins.push(a);
  }
  fins.sort((p, q) => p - q);
  const step = TAU / 180;
  let cursor = fins[fins.length - 1] - TAU;
  for (const a of fins) {
    const ha = finT / 2 / Ro;
    const start = cursor + finT / 2 / Ro;
    for (let t = start + step; t < a - ha; t += step) pts.push(new V2(Ro * Math.cos(t), Ro * Math.sin(t)));
    pts.push(new V2(Ro * Math.cos(a - ha), Ro * Math.sin(a - ha)));
    const hb = finT / 2 / finR;
    pts.push(new V2(finR * Math.cos(a - hb), finR * Math.sin(a - hb)));
    pts.push(new V2((finR + 0.8) * Math.cos(a), (finR + 0.8) * Math.sin(a)));
    pts.push(new V2(finR * Math.cos(a + hb), finR * Math.sin(a + hb)));
    pts.push(new V2(Ro * Math.cos(a + ha), Ro * Math.sin(a + ha)));
    cursor = a;
  }
  const sh = new THREE.Shape(pts);
  sh.holes.push(G.circlePath(Ri));
  return G.extrude(sh, z0, z1, 96);
}

export function addFrame(m, mats, o) {
  const { Ri, Ro, finR, zf, H, paint, A, B, footT = 18, footW = 48, K = 12, nFins = 40 } = o;
  const geos = [frameGeometry({ Ri, Ro, finR, nFins, z0: -zf + 8, z1: zf - 8 })];
  // anillos extremos (bridas de asiento de los escudos)
  geos.push(G.ring(Ri, finR - 1, zf - 8, zf, 96), G.ring(Ri, finR - 1, -zf, -zf + 8, 96));
  // nervios longitudinales superiores (asiento de caja de bornes) y cuna inferior de patas
  geos.push(G.box(70, finR - Ro + 6, 2 * zf - 16, 0, Ro + (finR - Ro) / 2 - 3, 0));
  // patas (B3) con agujeros de anclaje K
  const footShape = G.roundedRectShape(A + 2 * footW * 0.55, footW, 4);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) footShape.holes.push(new THREE.Path(G.roundedRectPts(K, K * 1.6, K / 2 - 0.01, (sx * A) / 2, sz * 0.01).reverse()));
  for (const s of [-1, 1]) {
    const f = G.extrude(footShape, 0, footT, 16);
    f.rotateX(Math.PI / 2);
    f.translate(0, -H + footT, (s * B) / 2);
    geos.push(f);
    // alma de la pata (une la base a la carcasa)
    const web = new THREE.Shape([
      new V2(-A / 2 - 10, -H + footT - 1), new V2(A / 2 + 10, -H + footT - 1),
      new V2(Ro * 0.62, -Ro * 0.78), new V2(-Ro * 0.62, -Ro * 0.78),
    ]);
    geos.push(G.extrude(web, (s * B) / 2 - 12, (s * B) / 2 + 12, 1));
  }
  // base del cáncamo
  geos.push(G.cyl(16, 0, 12).rotateX(-Math.PI / 2).translate(0, finR - 6, o.eyeZ ?? zf - 40));
  return m.part({
    id: 'carcasa', name: 'Carcasa con aletas y patas', cat: 'Carcasa y estructura',
    desc: 'Hierro inactivo: soporta el núcleo del estator, ancla el motor a la base (patas B3, IEC 60072) y disipa el calor por sus aletas longitudinales barridas por el aire del ventilador externo (IC411).',
    mat: 'Hierro fundido gris (FC-200) pintado con esmalte epóxico',
    objects: [[G.merge(geos), paint]],
    explode: [0, 260, 0],
  });
}

// ─────────────── núcleo del estator + devanado trifásico distribuido ───────────────
export function addACStator(m, mats, o) {
  const { Ri, Ro, L, Ns, prof, pitch, zLead = 1, idPrefix = 'estator' } = o;
  const zc = L / 2;
  const shape = new THREE.Shape(G.slottedCirclePts(Ri, Ns, prof, false, 0, 4).reverse());
  // contorno exterior con muescas de soldadura/sujeción
  const outer = new THREE.Shape();
  outer.absarc(0, 0, Ro, 0, TAU, false);
  outer.holes.push(new THREE.Path(G.slottedCirclePts(Ri, Ns, prof, false, 0, 4)));
  const core = G.lamStack(outer, -zc, zc, mats.chapa, mats.chapaLado, 96);
  m.part({
    id: idPrefix + '-nucleo', name: 'Núcleo del estator (paquete de chapas)', cat: 'Estator',
    desc: `Hierro activo: ${Ns} ranuras troqueladas en chapas de acero al silicio de 0.5 mm aisladas entre sí (barniz) para reducir las pérdidas por corrientes parásitas. Conduce el flujo magnético giratorio a través del entrehierro.`,
    mat: 'Acero eléctrico Fe-Si (1–3 % Si), chapa de 0.5 mm con aislamiento interlaminar C-5',
    objects: [core],
    explode: [0, 0, 0],
  });

  const depth = prof[prof.length - 1][0];
  const hw = prof[2][0];
  const liner = [], wedges = [], top = [], bot = [];
  for (let k = 0; k < Ns; k++) {
    const a = (k * TAU) / Ns;
    const out = G.polyShape(G.slotRegionPts(Ri, a, prof, hw + 0.2, depth - 0.1, 0, false));
    out.holes.push(G.polyPath(G.slotRegionPts(Ri, a, prof, hw + 0.6, depth - 0.5, 0.4, false).reverse()));
    liner.push(G.extrude(out, -zc - 4, zc + 4, 2));
    wedges.push(G.extrude(G.polyShape(G.slotRegionPts(Ri, a, prof, hw + 0.25, hw + 2.2, 0.15, false)), -zc - 2, zc + 2, 2));
    const mid = (hw + 2.6 + depth - 0.6) / 2;
    top.push(G.extrude(G.polyShape(G.slotRegionPts(Ri, a, prof, hw + 2.5, mid - 0.4, 0.55, false, 4)), -zc - 1, zc + 1, 2));
    bot.push(G.extrude(G.polyShape(G.slotRegionPts(Ri, a, prof, mid + 0.4, depth - 0.7, 0.55, false, 6)), -zc - 1, zc + 1, 2));
  }
  m.part({
    id: idPrefix + '-aislamiento', name: 'Aislamiento de ranura', cat: 'Estator', qty: Ns,
    desc: 'Láminas en "U" que separan el cobre del hierro (aislamiento a tierra). Sobresalen unos milímetros del paquete para aumentar la distancia de fuga.',
    mat: 'Nomex-Mylar-Nomex (NMN), clase térmica F (155 °C)',
    objects: [[G.merge(liner), mats.nomex]],
    explode: [0, 0, -40],
  });
  m.part({
    id: idPrefix + '-cunas', name: 'Cuñas de cierre de ranura', cat: 'Estator', qty: Ns,
    desc: 'Cierran la boca de cada ranura y retienen mecánicamente las bobinas contra las fuerzas electrodinámicas y la vibración.',
    mat: 'Laminado de fibra de vidrio-epoxi (clase F)',
    objects: [[G.merge(wedges), mats.cunaRanura]],
    explode: [0, 0, 60],
  });

  // cabezas de bobina (devanado imbricado de doble capa, paso acortado)
  const rT = Ri + (hw + 2.5 + (hw + 2.6 + depth - 0.6) / 2) / 2;
  const rB = Ri + ((hw + 2.6 + depth - 0.6) / 2 + depth) / 2;
  const ends = [];
  const tubeR = Math.min(3.6, prof[3][1] * 0.75);
  for (const dir of [1, -1]) {
    for (let k = 0; k < Ns; k++) {
      const a1 = (k * TAU) / Ns;
      const a2 = ((k + pitch) * TAU) / Ns;
      ends.push(G.endTurn(rT, a1, rB, a2, dir * zc, 5, o.overhang, rB + 3, tubeR, dir, 28));
    }
  }
  const slotCu = G.merge([...top, ...bot]);
  m.part({
    id: idPrefix + '-devanado', name: 'Devanado trifásico (bobinas de cobre)', cat: 'Estator',
    desc: `Devanado imbricado de doble capa, ${Ns} bobinas de paso acortado ${pitch}/${Ns / (o.poles || 4) | 0}, conexión en estrella o triángulo. Recibe la corriente de línea (devanado primario) y crea el campo magnético giratorio a la velocidad síncrona ns = 120·f/p.`,
    mat: 'Alambre de cobre esmaltado (poliéster-imida + poliamida-imida), clase H; impregnado en barniz',
    objects: [[slotCu, mats.cobre], [G.merge(ends), mats.cobreEsmalte]],
    explode: [0, 0, 0],
  });

  // amarres de cabezas de bobina
  const ties = [];
  const nTies = 12;
  for (const dir of [1, -1]) {
    for (let i = 0; i < nTies; i++) {
      const a = ((i + 0.5) * TAU) / nTies;
      const pos = G.polar((rT + rB) / 2 + 2, a, dir * (zc + 5 + o.overhang * 0.55));
      const tan = new V3(-Math.sin(a), Math.cos(a), 0);
      ties.push(G.placed(G.torus(tubeR * 2.8, 0.7, TAU, 24, 4), pos, tan));
    }
    const lace = G.torus((rT + rB) / 2 + 2, 0.9, TAU, 96, 4);
    lace.translate(0, 0, dir * (zc + 5 + o.overhang * 0.55));
    ties.push(lace);
  }
  m.part({
    id: idPrefix + '-amarres', name: 'Amarres de cabezas de bobina', cat: 'Estator', qty: 2 * nTies,
    desc: 'Cordón y cinta de poliéster que atan las cabezas de bobina para que soporten los esfuerzos del arranque directo.',
    mat: 'Cordón de poliéster/fibra de vidrio impregnado',
    objects: [[G.merge(ties), mats.nomex]],
    explode: [0, 0, 0],
  });

  // cables de salida hacia la caja de bornes
  if (o.leadsTo) {
    const { y: yb, z: zb } = o.leadsTo;
    const cols = [mats.cableNegro, mats.cableAzul, mats.cableRojo, mats.cableNegro, mats.cableAzul, mats.cableRojo];
    const objs = [];
    for (let i = 0; i < 6; i++) {
      const x = (i - 2.5) * 5;
      const zEnd = zLead * (zc + o.overhang * 0.7);
      const pts = [
        new V3(x * 0.6, rB + 1, zEnd), new V3(x * 0.7, Ro - 6, zEnd - zLead * 4),
        new V3(x * 0.8, Ri + (Ro - Ri) + 1, zb + zLead * 20), new V3(x, Ro + 6, zb + 4),
        new V3(x * 1.4, yb - 4, zb + (i < 3 ? -12 : 12)),
      ];
      objs.push([G.tubeThrough(pts, 1.7, 40), cols[i]]);
    }
    m.part({
      id: idPrefix + '-salidas', name: 'Cables de salida U1-V1-W1 / U2-V2-W2', cat: 'Conexiones', qty: 6,
      desc: 'Seis terminales de las tres fases (principios y finales) que salen del devanado hacia la placa de bornes, permitiendo la conexión Y/Δ.',
      mat: 'Cable flexible de cobre con aislamiento de silicona',
      objects: objs,
      explode: [0, 120, 0],
    });
  }
}

// ─────────────── escudo (tapa) con alojamiento de rodamiento ───────────────
export function addEndShield(m, mats, o) {
  const { s, zf, frameRi, flangeR, bear, shaftR, paint, side, nBolts = 4, boltR, boltD = 10 } = o;
  const bearR = bear.D / 2;
  const hubRo = bearR + 13;
  const uB = bear.B / 2 + 15.5;
  const u0 = uB - bear.B / 2 - 2, u1 = uB + bear.B / 2 + 2;
  const prof = [
    [frameRi - 1.5, -8], [frameRi, -8], [frameRi, 0], [flangeR, 0], [flangeR, 10], [frameRi - 12, 12],
    [hubRo + 4, u1 - 10], [hubRo, u1], [bearR, u1], [bearR, u0], [hubRo - 1, u0], [frameRi - 14, 2], [frameRi - 1.5, 2], [frameRi - 1.5, -8],
  ];
  const sign = (g) => {
    if (s < 0) g.scale(1, 1, -1);
    g.translate(0, 0, s * zf);
    return g;
  };
  const geos = [sign(G.lathe(prof, 96))];
  // nervios radiales
  const nR = 8;
  for (let i = 0; i < nR; i++) {
    const rib = new THREE.Shape([
      new V2(hubRo + 2, u1 - 2), new V2(frameRi - 10, 12), new V2(flangeR - 4, 10), new V2(flangeR - 4, 14),
      new V2(frameRi - 8, 18), new V2(hubRo + 3, u1 + 3),
    ]);
    const g = G.extrude(rib, -2.5, 2.5, 1);
    g.rotateX(Math.PI / 2);
    g.rotateZ(((i + 0.5) * TAU) / nR);
    geos.push(sign(g));
  }
  // orejas de los tornillos
  for (let i = 0; i < nBolts; i++) {
    const a = Math.PI / 4 + (i * TAU) / nBolts;
    const ear = G.cyl(boltD * 1.1, 0, 12, 24);
    ear.translate(boltR * Math.cos(a), boltR * Math.sin(a), 0);
    geos.push(sign(ear));
  }
  const label = side === 'LA' ? 'lado acoplamiento (LA)' : 'lado opuesto (LOA)';
  const ex = s * (o.explodeZ ?? 220);
  m.part({
    id: 'escudo-' + side, name: `Escudo / tapa ${label}`, cat: 'Carcasa y estructura',
    desc: 'Hierro inactivo: cierra la carcasa, centra el rotor mediante el encaje (espiga) mecanizado y aloja el rodamiento. Mantiene concéntrico el entrehierro.',
    mat: 'Hierro fundido gris FC-200, alojamiento de rodamiento mecanizado (tolerancia H7/J7)',
    objects: [[G.merge(geos), paint]],
    explode: [0, 0, ex],
  });

  // tornillos del escudo
  const bolts = [];
  for (let i = 0; i < nBolts; i++) {
    const a = Math.PI / 4 + (i * TAU) / nBolts;
    const pos = new V3(boltR * Math.cos(a), boltR * Math.sin(a), s * (zf + 12));
    bolts.push(G.placed(G.hexBolt(boltD, 30), pos, new V3(0, 0, s)));
    bolts.push(G.placed(G.washer(boltD), pos.clone().add(new V3(0, 0, -s * 0.0)), new V3(0, 0, s)).translate(0, 0, 0));
  }
  m.part({
    id: 'tornillos-escudo-' + side, name: `Tornillos del escudo ${side} (M${boltD})`, cat: 'Tornillería', qty: nBolts,
    desc: 'Tornillos hexagonales ISO 4017 con arandela que fijan el escudo a la brida de la carcasa.',
    mat: 'Acero clase 8.8 zincado',
    objects: [[G.merge(bolts), mats.zincado]],
    explode: [0, 0, ex * 1.5],
  });

  // rodamiento
  const brg = G.ballBearing(bear.d, bear.D, bear.B, mats);
  brg.position.z = s * (zf + uB);
  m.part({
    id: 'rodamiento-' + side, name: `Rodamiento ${side} (${bear.code})`, cat: 'Rodamientos',
    desc: `Cojinete antifricción de bolas, rígido de una hilera, con tapas de protección 2Z. Soporta la carga radial del rotor; ${s > 0 ? 'en el LA va libre axialmente' : 'en el LOA va fijo y absorbe la carga axial'}. Lubricado con grasa de litio.`,
    mat: 'Acero al cromo 100Cr6 templado; jaula de latón; tapas de acero',
    objects: [brg],
    explode: [0, 0, ex * 1.25],
  });

  // tapas de rodamiento interior y exterior + tornillos
  const capO = G.ring(shaftR + 0.8, hubRo, 0, 6, 72);
  const capI = G.ring(shaftR + 0.8, hubRo - 1, -6, 0, 72);
  const capBolts = [];
  const nC = 3;
  for (let i = 0; i < nC; i++) {
    const a = Math.PI / 2 + (i * TAU) / nC;
    const r = bearR + 6.5;
    const L = u1 + 6 - (u0 - 6) + 2;
    capBolts.push(G.placed(G.hexBolt(6, L, { socket: true }), new V3(r * Math.cos(a), r * Math.sin(a), s * (zf + u1 + 6)), new V3(0, 0, s)));
  }
  const placeZ = (g, u) => {
    if (s < 0) g.scale(1, 1, -1);
    g.translate(0, 0, s * (zf + u));
    return g;
  };
  m.part({
    id: 'tapas-rodamiento-' + side, name: `Tapas de rodamiento ${side} (interior y exterior)`, cat: 'Rodamientos', qty: 2,
    desc: 'Retienen axialmente el rodamiento, forman la cámara de grasa y llevan un sello (laberinto/retén) contra polvo y agua (IP55).',
    mat: 'Hierro fundido / acero estampado',
    objects: [[G.merge([placeZ(capO, u1), placeZ(capI, u0)]), paint]],
    explode: [0, 0, ex * 1.1],
  });
  m.part({
    id: 'tornillos-tapa-rod-' + side, name: `Tornillos de tapas de rodamiento ${side} (M6)`, cat: 'Tornillería', qty: nC,
    desc: 'Tornillos Allen DIN 912 pasantes que unen la tapa exterior, el escudo y la tapa interior.',
    mat: 'Acero clase 8.8 pavonado',
    objects: [[G.merge(capBolts), mats.pavonado]],
    explode: [0, 0, ex * 1.6],
  });
  // engrasador
  const gn = G.placed(G.greaseNipple(5), new V3(0, hubRo + 1, s * (zf + uB)), UP);
  m.part({
    id: 'engrasador-' + side, name: `Engrasador ${side}`, cat: 'Rodamientos',
    desc: 'Grasera DIN 71412 para relubricar el rodamiento sin desmontar el motor.',
    mat: 'Acero zincado',
    objects: [[gn, mats.laton]],
    explode: [0, 40, ex],
  });
  return { uB, u0, u1, hubRo };
}

// ─────────────── eje ───────────────
export function addShaft(m, mats, profile, o) {
  const geos = [G.lathe(profile, 64)];
  const objs = [];
  if (o.keyway) {
    const { r, z0, z1, b, t1 } = o.keyway;
    // extremo con chavetero: se dibuja como extrusión con ranura sobre el perfil
    const pts = [];
    const a0 = Math.asin(b / 2 / r);
    for (let i = 0; i <= 64; i++) {
      const a = Math.PI / 2 + a0 + ((TAU - 2 * a0) * i) / 64;
      pts.push(new V2(r * Math.cos(a), r * Math.sin(a)));
    }
    const yk = Math.sqrt(r * r - (b / 2) ** 2) - t1;
    pts.push(new V2(b / 2, yk), new V2(-b / 2, yk));
    geos.push(G.extrude(new THREE.Shape(pts), z0, z1 - 2, 64));
    geos.push(G.cone(r, r - 1.5, z1 - 2, z1, 64));
    m.part({
      id: 'chaveta', name: `Chaveta paralela ${b}×${o.keyway.h}×${o.keyway.L}`, cat: 'Rotor',
      desc: 'Transmite el par del eje al acoplamiento o polea (DIN 6885 forma A).',
      mat: 'Acero C45 estirado en frío',
      objects: [[G.parallelKey(b, o.keyway.h, o.keyway.L).rotateZ(Math.PI / 2).translate(0, yk + o.keyway.h / 2, z1 - 6 - o.keyway.L / 2), mats.eje]],
      explode: [0, 70, o.explodeZ + 60],
    });
  }
  m.part({
    id: 'eje', name: 'Eje (flecha)', cat: 'Rotor',
    desc: 'Transmite el par a la carga. Escalonado para los asientos del núcleo, rodamientos y ventilador; el extremo LA tiene chavetero y agujero de centro roscado (DIN 332).',
    mat: 'Acero al carbono C45 / AISI 1045 rectificado',
    objects: [[G.merge(geos), mats.eje], ...objs],
    explode: [0, 0, o.explodeZ],
  });
}

// ─────────────── ventilador externo y cubreventilador ───────────────
export function addFanAndCover(m, mats, o) {
  const { zStart, shaftR, fanR, coverR, coverLen, frameZ, finR, explodeZ = -360 } = o;
  const fan = G.radialFan({ rHub: shaftR + 8, rOut: fanR, bore: shaftR * 2, nBlades: 11, z0: zStart - 30, z1: zStart, hubLen: 34, bladeT: 3.5 });
  m.part({
    id: 'ventilador', name: 'Ventilador externo', cat: 'Refrigeración',
    desc: 'Ventilador radial bidireccional montado en el eje (LOA). Impulsa aire sobre las aletas de la carcasa (método IC411 de IEC 60034-6).',
    mat: 'Polipropileno reforzado con fibra de vidrio',
    objects: [[fan, mats.plasticoNegro]],
    explode: [0, 0, explodeZ],
  });
  const clip = G.circlip(shaftR, 2, 1.2).translate(0, 0, zStart - 36);
  m.part({
    id: 'seguro-ventilador', name: 'Anillo de retención del ventilador', cat: 'Tornillería',
    desc: 'Seguro elástico DIN 471 que fija axialmente el ventilador en el eje.',
    mat: 'Acero para muelles fosfatado',
    objects: [[clip, mats.pavonado]],
    explode: [0, 0, explodeZ * 1.15],
  });
  const z0 = -frameZ + 12;
  const zEnd = -frameZ - coverLen;
  const shell = G.ring(coverR, coverR + 1.5, zEnd, z0, 128);
  const grill = G.perforatedDisc(coverR + 1.5, 4.2, 12, 1.5, zEnd - 1.5, 8);
  const rim = G.torus(coverR + 0.8, 1.6, TAU, 128, 6).translate(0, 0, zEnd);
  const screws = [];
  const tabs = [];
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 2 + (i * TAU) / 3;
    const dir = new V3(Math.cos(a), Math.sin(a), 0);
    screws.push(G.placed(G.hexBolt(5, 10), dir.clone().multiplyScalar(coverR + 1.5).add(new V3(0, 0, -frameZ + 4)), dir));
    tabs.push(G.placed(G.box(14, 14, 1.5), dir.clone().multiplyScalar(coverR + 0.8).add(new V3(0, 0, -frameZ + 4)), dir));
  }
  m.part({
    id: 'cubreventilador', name: 'Cubreventilador (tapa deflectora)', cat: 'Refrigeración',
    desc: 'Protege contra contacto con el ventilador y canaliza el aire hacia las aletas. La rejilla perforada admite el aire sin permitir el paso de dedos (IP2X mínimo).',
    mat: 'Chapa de acero estampada y pintada',
    objects: [[G.merge([shell, grill, rim, ...tabs]), o.paint]],
    explode: [0, 0, explodeZ * 1.45],
  });
  m.part({
    id: 'tornillos-cubrevent', name: 'Tornillos del cubreventilador (M5)', cat: 'Tornillería', qty: 3,
    desc: 'Tornillos radiales que sujetan el cubreventilador a la brida de la carcasa.',
    mat: 'Acero zincado',
    objects: [[G.merge(screws), mats.zincado]],
    explode: [0, 0, explodeZ * 1.6],
  });
}

// ─────────────── caja de bornes ───────────────
export function addTerminalBox(m, mats, o) {
  const { y0, z, paint, w = 116, d = 116, h = 66, t = 6, connection = 'delta', nameplateLines } = o;
  const walls = [
    G.box(w, t, d, 0, y0 + t / 2, z), // fondo
    G.box(t, h, d, -w / 2 + t / 2, y0 + h / 2, z), G.box(t, h, d, w / 2 - t / 2, y0 + h / 2, z),
    G.box(w, h, t, 0, y0 + h / 2, z - d / 2 + t / 2), G.box(w, h, t, 0, y0 + h / 2, z + d / 2 - t / 2),
  ];
  // torretas de los tornillos de la tapa
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) walls.push(G.cyl(6, 0, h - 1).rotateX(-Math.PI / 2).translate(sx * (w / 2 - 9), y0, z + sz * (d / 2 - 9)));
  // entrada roscada para prensaestopas
  walls.push(G.cyl(15, 0, 6).rotateY(Math.PI / 2).translate(w / 2, y0 + h * 0.45, z));
  m.part({
    id: 'caja-bornes', name: 'Caja de bornes', cat: 'Conexiones',
    desc: 'Envolvente de conexiones. Puede girarse 4×90° para orientar la entrada de cables.',
    mat: 'Hierro fundido / aluminio inyectado, pintado',
    objects: [[G.merge(walls), paint]],
    explode: [0, 360, 0],
  });
  const lid = G.merge([G.box(w + 2, 6, d + 2, 0, y0 + h + 3, z), G.box(w - 30, 3, d - 30, 0, y0 + h + 7, z)]);
  const gasket = new THREE.Shape(G.roundedRectPts(w, d, 6));
  gasket.holes.push(new THREE.Path(G.roundedRectPts(w - 10, d - 10, 4).reverse()));
  const gk = G.extrude(gasket, 0, 1.5, 6).rotateX(Math.PI / 2).translate(0, y0 + h + 1.5, z);
  m.part({
    id: 'tapa-caja', name: 'Tapa de la caja de bornes', cat: 'Conexiones',
    desc: 'Cierra la caja; con su empaque mantiene el grado de protección IP55.',
    mat: 'Hierro fundido pintado',
    objects: [[lid, paint]],
    explode: [0, 520, 0],
  });
  m.part({
    id: 'empaque-caja', name: 'Empaque de la tapa', cat: 'Conexiones',
    desc: 'Junta de estanqueidad entre caja y tapa.',
    mat: 'Caucho nitrílico (NBR)',
    objects: [[gk, mats.caucho]],
    explode: [0, 450, 0],
  });
  const lidScrews = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) lidScrews.push(G.placed(G.hexBolt(5, 16, { socket: true }), new V3(sx * (w / 2 - 9), y0 + h + 6, z + sz * (d / 2 - 9)), UP));
  m.part({
    id: 'tornillos-tapa-caja', name: 'Tornillos de la tapa (M5)', cat: 'Tornillería', qty: 4,
    desc: 'Tornillos Allen que comprimen el empaque de la tapa.',
    mat: 'Acero inoxidable A2',
    objects: [[G.merge(lidScrews), mats.zincado]],
    explode: [0, 600, 0],
  });
  // placa de bornes con 6 espárragos y puentes
  const by = y0 + t;
  const board = G.merge([G.box(76, 12, 46, 0, by + 6, z), ...[-1, 0, 1].flatMap((i) => [G.box(4, 10, 46, i * 24 + 12, by + 17, z)]).slice(0, 2)]);
  m.part({
    id: 'placa-bornes', name: 'Placa de bornes', cat: 'Conexiones',
    desc: 'Bloque aislante con seis bornes U1-V1-W1 (arriba) y W2-U2-V2 (abajo), dispuestos para conectar en estrella o triángulo con puentes.',
    mat: 'Resina termoestable (DMC/baquelita), clase de inflamabilidad V0',
    objects: [[board, mats.baquelita]],
    explode: [0, 300, 0],
  });
  const studs = [], nuts = [], bridges = [];
  const sp = 22;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    const x = (i - 1) * sp, zz = z + (j ? 11 : -11);
    studs.push(G.stud(6, 22).rotateX(-Math.PI / 2).translate(x, by + 12, zz));
    nuts.push(G.placed(G.nut(6), new V3(x, by + 12 + 2.4, zz), UP), G.placed(G.washer(6), new V3(x, by + 12 + 1, zz), UP));
    nuts.push(G.placed(G.nut(6), new V3(x, by + 12 + 10, zz), UP));
  }
  if (connection === 'delta') {
    for (let i = 0; i < 3; i++) bridges.push(G.box(8, 2, 30, (i - 1) * sp, by + 12 + 7.6, z));
  } else if (connection === 'star') {
    bridges.push(G.box(2 * sp + 10, 2, 8, 0, by + 12 + 7.6, z + 11));
  }
  const conText = connection === 'delta' ? 'Los puentes se muestran en conexión triángulo (Δ).' : connection === 'star' ? 'Los puentes se muestran en conexión estrella (Y).' : o.terminalsText || '';
  m.part({
    id: 'bornes', name: bridges.length ? 'Bornes, tuercas y puentes' : 'Bornes y tuercas', cat: 'Conexiones', qty: 6,
    desc: `Espárragos M6 de latón con tuercas y arandelas. ${conText}`,
    mat: 'Latón CuZn39Pb3 / cobre estañado',
    objects: [[G.merge(studs), mats.laton], [G.merge(nuts), mats.laton], ...(bridges.length ? [[G.merge(bridges), mats.cobreDesnudo]] : [])],
    explode: [0, 380, 0],
  });
  // borne de tierra
  const earth = G.merge([G.placed(G.hexBolt(5, 10), new V3(-w / 2 + 16, by + 1, z + d / 2 - 18), UP), G.placed(G.washer(5, { od: 14 }), new V3(-w / 2 + 16, by + 0.5, z + d / 2 - 18), UP)]);
  m.part({
    id: 'borne-tierra', name: 'Borne de puesta a tierra', cat: 'Conexiones',
    desc: 'Conexión equipotencial obligatoria de la carcasa al conductor de protección (PE).',
    mat: 'Latón / acero zincado',
    objects: [[earth, mats.laton]],
    explode: [0, 330, 0],
  });
  // prensaestopas
  const gl = G.merge([
    G.extrude(new THREE.Shape(G.hexPts(30)), 0, 8, 1),
    G.cyl(13, 8, 20, 32), G.lathe([[13, 20], [13, 24], [9, 30], [7, 30]], 32),
    G.stud(20, 8).translate(0, 0, -8),
  ]).rotateY(Math.PI / 2).translate(w / 2 + 6, y0 + h * 0.45, z);
  m.part({
    id: 'prensaestopas', name: 'Prensaestopas (M32)', cat: 'Conexiones',
    desc: 'Entrada de cable con sello que garantiza la estanqueidad y alivia la tracción del cable de alimentación.',
    mat: 'Poliamida 6.6 / latón niquelado',
    objects: [[gl, mats.plasticoGris]],
    explode: [0, 360, 0],
  });
  // tornillos de fijación de la caja a la carcasa
  const bx = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx.push(G.placed(G.hexBolt(6, 14, { socket: true }), new V3(sx * (w / 2 - 22), by, z + sz * (d / 2 - 22)), UP));
  m.part({
    id: 'tornillos-caja', name: 'Tornillos de la caja de bornes (M6)', cat: 'Tornillería', qty: 4,
    desc: 'Fijan la caja de bornes a la plataforma de la carcasa.',
    mat: 'Acero clase 8.8 zincado',
    objects: [[G.merge(bx), mats.zincado]],
    explode: [0, 420, 0],
  });
  // placa de características (en la cara frontal de la caja)
  if (nameplateLines) {
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(84, 52), nameplateMaterial(nameplateLines, o.nameplateTitle));
    plate.rotation.y = -Math.PI / 2;
    plate.position.set(-w / 2 - 0.6, y0 + h / 2, z);
    const rivets = [];
    for (const sy of [-1, 1]) for (const sz of [-1, 1]) rivets.push(G.sphere(1.6, -w / 2 - 0.6, y0 + h / 2 + sy * 22, z + sz * 38, 8));
    m.part({
      id: 'placa-caracteristicas', name: 'Placa de características', cat: 'Carcasa y estructura',
      desc: 'Datos nominales exigidos por IEC 60034-1 / NEMA MG-1: potencia, tensión, corriente, velocidad, frecuencia, factor de potencia, clase de aislamiento, IP, factor de servicio.',
      mat: 'Aluminio anodizado grabado, fijado con remaches',
      objects: [plate, [G.merge(rivets), mats.aluminio]],
      explode: [0, 360, 0],
    });
  }
}

export function addEyeBolt(m, mats, y, z, d = 12) {
  const g = G.placed(G.eyeBolt(d), new V3(0, y, z), UP);
  m.part({
    id: 'cancamo', name: `Cáncamo de izaje (M${d})`, cat: 'Carcasa y estructura',
    desc: 'Argolla roscada para levantar el motor completo (no para levantar el motor con la carga acoplada).',
    mat: 'Acero C15 forjado y zincado (DIN 580)',
    objects: [[g, mats.zincado]],
    explode: [0, 520, 0],
  });
}
