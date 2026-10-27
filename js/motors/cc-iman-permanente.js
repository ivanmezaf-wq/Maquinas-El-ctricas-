// Motor de CC de imán permanente (PMDC) de fracción de caballo, tipo "can" (Ø38 mm).
// Inductor: dos imanes cerámicos arqueados; inducido de 5 dientes; colector de 5 delgas;
// escobillas de carbón en la tapa posterior de plástico.
import * as THREE from 'three';
import * as G from '../core/geo.js';
import { M } from '../core/materials.js';
import { MotorModel } from '../core/model.js';

const { V2, V3, TAU } = G;
const DEG = Math.PI / 180;

export const info = {
  id: 'cc-iman-permanente',
  name: 'Motor de CC de imán permanente',
  short: 'PMDC · Ø38 mm · 12 V · 5 ranuras',
  summary:
    'El campo lo suministran imanes permanentes cerámicos: no hay devanado de excitación ni pérdidas en él, el par crece casi linealmente con la corriente y es muy fiable. Usado en juguetes, automoción, cintas, cámaras y pequeños accionamientos.',
  specs: [
    ['Tipo', 'CC de imán permanente con escobillas'],
    ['Tensión', '12 V CC'],
    ['Velocidad en vacío', '≈ 5000 r/min'],
    ['Par de arranque', '≈ 0.25 N·m'],
    ['Inducido', '5 ranuras, 5 bobinas, colector de 5 delgas'],
    ['Imanes', '2 arcos de ferrita de estroncio (cerámicos)'],
    ['Cojinetes', 'Bujes de bronce sinterizado autolubricados'],
  ],
};

export function build() {
  const mats = M();
  const m = new MotorModel(info);
  const Ri = 17.8, Ro = 19;

  // ───── carcasa (culata) ─────
  const can = [G.ring(Ri, Ro, -28, 26, 96)];
  const front = new THREE.Shape();
  front.absarc(0, 0, Ro, 0, TAU, false);
  front.holes.push(G.circlePath(4.6, 32, false));
  for (const a of [0, 180]) front.holes.push(G.circlePath(1.5, 12, false, 12.5 * Math.cos(a * DEG), 12.5 * Math.sin(a * DEG)));
  for (const a of [60, 120, 240, 300]) front.holes.push(G.circlePath(2.6, 16, false, 9 * Math.cos(a * DEG), 9 * Math.sin(a * DEG)));
  can.push(G.extrude(front, 26, 27.2, 48));
  can.push(G.lathe([[4.6, 27.2], [7, 27.2], [6.5, 31], [4.6, 31]], 48));
  for (const a of [90, 270]) {
    const t = G.box(4, 1.2, 3);
    t.translate(0, Ri - 0.3, -28.5);
    t.rotateZ((a - 90) * DEG);
    can.push(t);
  }
  m.part({
    id: 'carcasa', name: 'Carcasa / culata (tubo de acero)', cat: 'Inductor (estator)',
    desc: 'Tubo de acero embutido que, además de envolvente, es la culata: cierra el circuito magnético entre los dos imanes. El fondo lleva el alojamiento del buje delantero, agujeros roscados de montaje y ventilación.',
    mat: 'Acero de bajo carbono (DC04) embutido y niquelado',
    objects: [[G.merge(can), mats.zincado]],
    explode: [0, 70, 0],
  });

  // ───── imanes y clips ─────
  const mags = [];
  for (const a of [0, 180]) {
    const s = new THREE.Shape();
    const a0 = (a - 62) * DEG, a1 = (a + 62) * DEG;
    s.absarc(0, 0, Ri, a0, a1, false);
    s.absarc(0, 0, 13.3, a1, a0, true);
    mags.push(G.extrude(s, -16, 16, 40));
  }
  m.part({
    id: 'imanes', name: 'Imanes permanentes (inductor)', cat: 'Inductor (estator)', qty: 2,
    desc: 'Dos segmentos arqueados magnetizados radialmente (un polo N y un polo S). Sustituyen a los polos y al devanado de excitación: no requieren corriente de excitación. Las sobrecargas fuertes pueden desmagnetizarlos parcialmente.',
    mat: 'Ferrita de estroncio anisótropa (cerámica, grado Y30)',
    objects: [[G.merge(mags), mats.ferrita]],
    explode: [0, 0, 0],
  });
  const clips = [];
  for (const a of [90, 270]) {
    const s = new THREE.Shape();
    s.absarc(0, 0, Ri, (a - 28) * DEG, (a + 28) * DEG, false);
    s.absarc(0, 0, Ri - 0.4, (a + 28) * DEG, (a - 28) * DEG, true);
    clips.push(G.extrude(s, -15, 15, 16));
    for (const sg of [-1, 1]) {
      const leaf = G.box(0.4, 3, 30);
      leaf.translate(0, Ri - 1.6, 0);
      leaf.rotateZ((a - 90 + sg * 27) * DEG);
      clips.push(leaf);
    }
  }
  m.part({
    id: 'clips-imanes', name: 'Resortes de retención de imanes', cat: 'Inductor (estator)', qty: 2,
    desc: 'Flejes en "U" que empujan los imanes contra la carcasa y los mantienen en su posición angular (además del adhesivo).',
    mat: 'Acero inoxidable para resortes',
    objects: [[G.merge(clips), mats.resorteAcero]],
    explode: [0, 0, 0],
  });

  // ───── inducido de 5 dientes ─────
  const N = 5, Rr = 12.8, Rt = 10.8, hw = 2, rYoke = 4.8, tipA = 29 * DEG;
  const pts = [];
  for (let k = 0; k < N; k++) {
    const c = (k * TAU) / N;
    for (let i = 0; i <= 10; i++) {
      const a = c - tipA + (2 * tipA * i) / 10;
      pts.push(new V2(Rr * Math.cos(a), Rr * Math.sin(a)));
    }
    const tip = (r, a) => new V2(r * Math.cos(a), r * Math.sin(a));
    pts.push(tip(Rt, c + tipA));
    const toG = (x, y) => new V2(y * Math.cos(c) - x * Math.sin(c), y * Math.sin(c) + x * Math.cos(c));
    pts.push(toG(hw, Rt - 0.6), toG(hw, rYoke + 0.6));
    const cNext = c + TAU / N;
    const toGn = (x, y) => new V2(y * Math.cos(cNext) - x * Math.sin(cNext), y * Math.sin(cNext) + x * Math.cos(cNext));
    const aStart = Math.atan2(toG(hw, rYoke + 0.6).y, toG(hw, rYoke + 0.6).x);
    for (let i = 1; i < 4; i++) pts.push(tip(rYoke, c + 0.45 + ((TAU / N - 0.9) * i) / 4));
    pts.push(toGn(-hw, rYoke + 0.6), toGn(-hw, Rt - 0.6), tip(Rt, cNext - tipA));
    void aStart;
  }
  const arm = new THREE.Shape(pts);
  arm.holes.push(G.circlePath(1.6, 24, false));
  m.part({
    id: 'inducido-nucleo', name: 'Núcleo del inducido (5 dientes)', cat: 'Inducido (rotor)',
    desc: 'Paquete de chapas con 5 dientes en "T". Un número impar de ranuras reduce el par de reluctancia (cogging) y garantiza el arranque en cualquier posición.',
    mat: 'Acero eléctrico 0.5 mm',
    objects: [G.lamStack(arm, -11, 11, mats.chapa, mats.chapaLado, 24)],
    explode: [0, 0, -70],
  });
  const coilsG = [];
  for (let k = 0; k < N; k++) {
    const c = (k * TAU) / N;
    const tan = new V3(-Math.sin(c), Math.cos(c), 0);
    const rad = new V3(Math.cos(c), Math.sin(c), 0);
    coilsG.push(G.poleCoil(2 * hw, 22, 1.5, 3.8, 0.8).applyMatrix4(new THREE.Matrix4().makeBasis(tan, new V3(0, 0, 1), rad).setPosition(rad.multiplyScalar(6.3))));
  }
  const leads = [];
  for (let k = 0; k < N; k++) {
    const c = (k * TAU) / N + 0.5;
    leads.push(G.tubeThrough([G.polar(7, c, -12.5), G.polar(5.6, c + 0.15, -15), G.polar(4.9, c + 0.25, -16.2)], 0.3, 8, false, 4));
  }
  m.part({
    id: 'devanado-inducido', name: 'Bobinas del inducido', cat: 'Inducido (rotor)', qty: 5,
    desc: 'Cinco bobinas de alambre esmaltado fino conectadas en polígono cerrado; sus uniones se sueldan (fusionan) a los ganchos de las delgas del colector.',
    mat: 'Alambre de cobre esmaltado Ø0.4 mm, clase F',
    objects: [[G.merge(coilsG), mats.cobreEsmalte], [G.merge(leads), mats.cobre]],
    explode: [0, 0, -70],
  });
  const ins = [];
  for (const z of [-11.6, 11]) ins.push(G.extrude(arm, z, z + 0.6, 8));
  m.part({
    id: 'aislamiento-inducido', name: 'Arandelas aislantes del inducido', cat: 'Inducido (rotor)', qty: 2,
    desc: 'Láminas de fibra con la forma de la chapa en ambos extremos del paquete: protegen el esmalte del alambre en las aristas.',
    mat: 'Papel aislante / poliéster',
    objects: [[G.merge(ins), mats.nomex]],
    explode: [0, 0, -70],
  });
  const com = G.commutator(5, 2.2, 4.3, -21, -15.5, 1.3, 0.8);
  m.part({
    id: 'colector', name: 'Colector de 5 delgas', cat: 'Inducido (rotor)', qty: 5,
    desc: 'Cinco delgas de cobre sobre un cubo de resina; invierten la corriente en cada bobina al pasar bajo las escobillas.',
    mat: 'Cobre / cubo de resina fenólica',
    objects: [[com.delgas, mats.cobreDesnudo], [G.merge([com.risers]), mats.cobre], [G.ring(1.6, 2.2, -21.5, -15, 24), mats.baquelita]],
    explode: [0, 0, -70],
  });
  m.part({
    id: 'varistor', name: 'Anillo varistor (supresor)', cat: 'Inducido (rotor)',
    desc: 'Anillo cerámico con 5 contactos soldados a las delgas: absorbe los picos de tensión de conmutación, reduce chispas e interferencias (EMI).',
    mat: 'Óxido de zinc (ZnO) cerámico',
    objects: [[G.ring(3.4, 5.6, -15.4, -14.6, 32), mats.plasticoGris]],
    explode: [0, 0, -70],
  });

  // eje y arandelas
  m.part({
    id: 'eje', name: 'Eje', cat: 'Inducido (rotor)',
    desc: 'Eje rectificado sobre el que se calan a presión el paquete del inducido y el colector. Gira en dos bujes de bronce.',
    mat: 'Acero inoxidable rectificado Ø3.17 mm',
    objects: [[G.merge([G.cyl(1.585, -38, 45, 24), G.cone(1.585, 1.1, 45, 45.5, 24)]), mats.eje]],
    explode: [0, 0, -70],
  });
  m.part({
    id: 'arandelas', name: 'Arandelas de empuje', cat: 'Rodamientos', qty: 4,
    desc: 'Arandelas de fibra y acero que limitan el juego axial del inducido y reducen el roce contra los bujes.',
    mat: 'Fibra vulcanizada / acero',
    objects: [[G.merge([G.ring(1.7, 3.6, 24.2, 24.8, 24), G.ring(1.7, 3.6, -27.5, -26.9, 24)]), mats.nomex], [G.merge([G.ring(1.7, 3.2, 23.6, 24.2, 24), G.ring(1.7, 3.2, -26.9, -26.3, 24)]), mats.zincado]],
    explode: [0, 0, -60],
  });
  m.part({
    id: 'buje-delantero', name: 'Buje delantero (bronce sinterizado)', cat: 'Rodamientos',
    desc: 'Cojinete de manguito poroso impregnado en aceite (autolubricado).',
    mat: 'Bronce sinterizado (Cu-Sn 89/11) impregnado',
    objects: [G.sleeveBearing(3.18, 9, 4, mats.bronce).translateZ(28.5)],
    explode: [0, 70, 30],
  });

  // ───── tapa porta-escobillas ─────
  const cap = [G.lathe([[0.01, -34], [Ro, -34], [Ro, -28], [Ri - 0.05, -28], [Ri - 0.05, -25], [Ri - 1.2, -25], [Ri - 1.2, -32.5], [4.5, -32.5], [4.5, -36.5], [6.5, -36.5], [6.5, -34]], 72)];
  for (const sx of [-1, 1]) {
    cap.push(G.box(5.5, 5.5, 7, sx * 9.5, 0, -29));
  }
  m.part({
    id: 'tapa-escobillas', name: 'Tapa posterior porta-escobillas', cat: 'Escobillas',
    desc: 'Tapa de plástico que cierra la carcasa (se fija con pestañas engatilladas), aloja el buje trasero y sostiene las escobillas con sus guías y terminales.',
    mat: 'Nylon PA66 reforzado con vidrio',
    objects: [[G.merge(cap), mats.plasticoNegro]],
    explode: [0, 0, -150],
  });
  m.part({
    id: 'buje-trasero', name: 'Buje trasero (bronce sinterizado)', cat: 'Rodamientos',
    desc: 'Cojinete de manguito autolubricado alojado en la tapa posterior.',
    mat: 'Bronce sinterizado impregnado',
    objects: [G.sleeveBearing(3.18, 8, 4, mats.bronce).translateZ(-33)],
    explode: [0, 0, -150],
  });
  const brushes = [], tubes = [], springs = [], terms = [];
  for (const sx of [-1, 1]) {
    brushes.push(G.box(7, 3.4, 3.4, sx * (4.3 + 3.5), 0, -18.2));
    tubes.push(G.merge([G.box(8, 0.4, 4.2, sx * 9.2, 2, -18.2), G.box(8, 0.4, 4.2, sx * 9.2, -2, -18.2), G.box(8, 4.2, 0.4, sx * 9.2, 0, -16.1), G.box(8, 4.2, 0.4, sx * 9.2, 0, -20.3), G.box(0.4, 4.2, 12, sx * 13.4, 0, -24)]));
    springs.push(G.helix(1.3, 0.8, 3, 0.25).rotateY((sx * Math.PI) / 2).translate(sx * 11.4, 0, -18.2));
    terms.push(G.merge([G.box(0.6, 4, 14, sx * 13.4, 0, -33), G.box(0.6, 6, 6, sx * 13.4, 0, -41)]));
  }
  m.part({
    id: 'escobillas', name: 'Escobillas de carbón', cat: 'Escobillas', qty: 2,
    desc: 'Bloques de grafito que frotan sobre el colector, diametralmente opuestos (línea neutra), y llevan la corriente al inducido.',
    mat: 'Grafito con cobre (metal-grafito)',
    objects: [[G.merge(brushes), mats.carbon]],
    explode: [0, 0, -110],
  });
  m.part({
    id: 'portaescobillas', name: 'Guías, resortes y terminales', cat: 'Escobillas', qty: 2,
    desc: 'Guías de latón donde deslizan las escobillas empujadas por resortes helicoidales; los terminales tipo faston salen de la tapa (+ marcado con punto rojo).',
    mat: 'Latón estañado / acero para resortes',
    objects: [[G.merge(tubes), mats.laton], [G.merge(springs), mats.resorteAcero], [G.merge(terms), mats.laton], [G.sphere(1, 13.4, 3.5, -34.6, 10), mats.cableRojo]],
    explode: [0, 0, -130],
  });

  // tornillos de montaje
  const scr = [];
  for (const a of [0, 180]) scr.push(G.placed(G.panScrew(3, 5), new V3(12.5 * Math.cos(a * DEG), 12.5 * Math.sin(a * DEG), 31), new V3(0, 0, 1)));
  m.part({
    id: 'tornillos-montaje', name: 'Tornillos de montaje M3', cat: 'Tornillería', qty: 2,
    desc: 'Fijan el motor a su soporte por la cara frontal (agujeros roscados en el fondo de la carcasa).',
    mat: 'Acero zincado',
    objects: [[G.merge(scr), mats.zincado]],
    explode: [0, 70, 45],
  });

  m.markRotating(['inducido-nucleo', 'devanado-inducido', 'aislamiento-inducido', 'colector', 'varistor', 'eje']);
  return m;
}
