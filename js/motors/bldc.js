// Motor de CC sin escobillas (BLDC) de rotor interior, 12 ranuras / 8 polos,
// imanes de neodimio superficiales y sensores Hall. Brida cuadrada de 90 mm.
import * as THREE from 'three';
import * as G from '../core/geo.js';
import { M } from '../core/materials.js';
import { MotorModel } from '../core/model.js';

const { V2, V3, TAU } = G;
const DEG = Math.PI / 180;

export const info = {
  id: 'bldc',
  name: 'Motor de CC sin escobillas (BLDC)',
  short: 'Rotor interior · 12 ranuras / 8 polos · 48 V · 400 W',
  summary:
    'Construcción invertida respecto al motor de CC clásico: la armadura (devanado trifásico) es estacionaria y el campo (imanes permanentes) gira. La conmutación la hacen transistores guiados por sensores Hall en lugar del colector y las escobillas: mejor disipación de calor y menor inercia.',
  specs: [
    ['Tipo', 'BLDC / PMSM de imanes superficiales (SPM)'],
    ['Potencia', '400 W · 48 V CC (bus)'],
    ['Velocidad nominal', '3000 r/min'],
    ['Configuración', '12 ranuras / 8 polos, devanado concentrado'],
    ['Imanes', 'NdFeB N42SH, 8 arcos + zuncho de fibra de carbono'],
    ['Realimentación', '3 sensores Hall a 120° eléctricos (30° mecánicos)'],
    ['Rodamientos', '6001-2RS (delantero y trasero)'],
  ],
};

export function build() {
  const mats = M();
  const m = new MotorModel(info);
  const Ns = 12, Ri = 22, Ro = 40, Ls = 20;

  // ───── estator de dientes con devanado concentrado ─────
  const prof = G.slotProfile({ w0: 2.6, h0: 0.9, h1: 1.6, wTop: 6.4, wBot: 10.4, depth: 11.5 });
  const st = new THREE.Shape();
  st.absarc(0, 0, Ro, 0, TAU, false);
  st.holes.push(new THREE.Path(G.slottedCirclePts(Ri, Ns, prof, false, Math.PI / Ns, 5)));
  m.part({
    id: 'estator-nucleo', name: 'Núcleo del estator (12 dientes)', cat: 'Estator (armadura)',
    desc: 'Armadura estacionaria: paquete de chapas finas con 12 dientes. Cada diente lleva su propia bobina (devanado concentrado de paso fraccionario 12/8), lo que acorta las cabezas de bobina y las pérdidas en el cobre.',
    mat: 'Acero eléctrico de bajas pérdidas 0.35 mm (M270-35A)',
    objects: [G.lamStack(st, -Ls, Ls, mats.chapa, mats.chapaLado, 96)],
    explode: [0, 0, 0],
  });
  const liners = [], coils = [], phases = [[], [], []];
  for (let k = 0; k < Ns; k++) {
    const a = Math.PI / Ns + (k * TAU) / Ns;
    const o = G.polyShape(G.slotRegionPts(Ri, a, prof, 2.6, 11.4, 0, false));
    o.holes.push(G.polyPath(G.slotRegionPts(Ri, a, prof, 2.9, 11.1, 0.3, false).reverse()));
    liners.push(G.extrude(o, -Ls - 1.5, Ls + 1.5, 2));
    // bobina alrededor del diente k (centrado en k·30°)
    const c = (k * TAU) / Ns;
    const tan = new V3(-Math.sin(c), Math.cos(c), 0);
    const rad = new V3(Math.cos(c), Math.sin(c), 0);
    const coil = G.poleCoil(7.2, 2 * Ls, 2.0, 7.4, 1).applyMatrix4(new THREE.Matrix4().makeBasis(tan, new V3(0, 0, 1), rad).setPosition(rad.clone().multiplyScalar(25.2)));
    phases[k % 3].push(coil);
  }
  m.part({
    id: 'aislamiento', name: 'Aislamiento de ranura', cat: 'Estator (armadura)', qty: 12,
    desc: 'Lámina aislante en cada ranura entre el cobre y el hierro.',
    mat: 'Nomex 410, 0.18 mm',
    objects: [[G.merge(liners), mats.nomex]],
    explode: [0, 0, 0],
  });
  const phaseNames = ['A', 'B', 'C'];
  phases.forEach((list, i) => {
    m.part({
      id: 'bobinas-' + phaseNames[i], name: `Bobinas de la fase ${phaseNames[i]}`, cat: 'Estator (armadura)', qty: 4,
      desc: `Cuatro bobinas concentradas (dientes ${i + 1}, ${i + 4}, ${i + 7} y ${i + 10}) conectadas en serie formando la fase ${phaseNames[i]}. Las tres fases se conectan en estrella y el controlador las energiza por pares según la posición del rotor.`,
      mat: 'Alambre de cobre esmaltado clase H (200 °C)',
      objects: [[G.merge(list), mats.cobreEsmalte]],
      explode: [0, 0, 0],
    });
  });

  // ───── rotor de imanes superficiales ─────
  const Rc = 17.4;
  const core = new THREE.Shape();
  core.absarc(0, 0, Rc, 0, TAU, false);
  core.holes.push(new THREE.Path(G.shaftHolePts(6, 4, 1.8)));
  for (let i = 0; i < 6; i++) core.holes.push(G.circlePath(2.2, 12, false, 11 * Math.cos((i * TAU) / 6), 11 * Math.sin((i * TAU) / 6)));
  m.part({
    id: 'rotor-nucleo', name: 'Núcleo del rotor (yugo rotórico)', cat: 'Rotor (campo)',
    desc: 'Paquete de chapas que sirve de retorno al flujo de los imanes; los agujeros reducen la inercia del rotor.',
    mat: 'Acero eléctrico 0.5 mm',
    objects: [G.lamStack(core, -Ls - 2, Ls + 2, mats.chapaOscura, mats.chapaOscuraLado, 64)],
    explode: [0, 0, 150],
  });
  const magN = [], magS = [];
  for (let i = 0; i < 8; i++) {
    const c = (i * TAU) / 8;
    const s = new THREE.Shape();
    s.absarc(0, 0, 20.8, c - 20 * DEG, c + 20 * DEG, false);
    s.absarc(0, 0, Rc, c + 20 * DEG, c - 20 * DEG, true);
    (i % 2 ? magS : magN).push(G.extrude(s, -Ls - 2, Ls + 2, 20));
  }
  m.part({
    id: 'imanes', name: 'Imanes permanentes N-S (8 polos)', cat: 'Rotor (campo)', qty: 8,
    desc: 'Arcos magnetizados radialmente con polaridad alterna (rojizo = N, azulado = S, colores ilustrativos). Montados en superficie (SPM): entrehierro magnético grande y flujo casi constante. Sobresalen 2 mm del estator para que los sensores Hall lean su campo.',
    mat: 'Neodimio-hierro-boro sinterizado N42SH, recubierto de níquel',
    objects: [[G.merge(magN), mats.neodimioN], [G.merge(magS), mats.neodimioS]],
    explode: [0, 0, 150],
  });
  m.part({
    id: 'zuncho', name: 'Zuncho de retención de imanes', cat: 'Rotor (campo)',
    desc: 'Manga delgada que retiene los imanes contra la fuerza centrífuga a alta velocidad.',
    mat: 'Fibra de carbono / epoxi (no magnética, no conductora)',
    objects: [[G.ring(20.85, 21.3, -Ls - 2, Ls + 2, 96), mats.fibraCarbono]],
    explode: [0, 0, 190],
  });
  m.part({
    id: 'discos-rotor', name: 'Discos extremos de balanceo', cat: 'Rotor (campo)', qty: 2,
    desc: 'Discos de aluminio que aprietan el paquete y donde se taladra material para el balanceo dinámico.',
    mat: 'Aluminio 6061',
    objects: [[G.merge([G.ring(6, 16.6, Ls + 2, Ls + 4, 64), G.ring(6, 16.6, -Ls - 4, -Ls - 2, 64)]), mats.aluminio]],
    explode: [0, 0, 150],
  });
  m.part({
    id: 'eje', name: 'Eje con chaveta', cat: 'Rotor (campo)',
    desc: 'Eje Ø12 mm rectificado con chavetero en el extremo de salida.',
    mat: 'Acero inoxidable 17-4PH',
    objects: [[G.merge([G.lathe([[0, -44], [5.6, -44], [6, -43.6], [6, 70], [5.5, 70.5], [0, 70.5]], 48)]), mats.eje], [G.parallelKey(4, 4, 18).rotateZ(Math.PI / 2).translate(0, 6, 58), mats.eje]],
    explode: [0, 0, 150],
  });

  // ───── carcasa y bridas ─────
  const hz0 = -30, hz1 = 26;
  const housing = new THREE.Shape();
  const hp = [];
  for (let i = 0; i < 360; i += 2) {
    const a = i * DEG;
    const fin = Math.abs(Math.sin(a * 12)) > 0.85 ? 3.5 : 0;
    const boss = [45, 135, 225, 315].some((b) => Math.abs(((i - b + 540) % 360) - 180) < 9) ? 4.5 : 0;
    hp.push(new V2((46 + Math.max(fin, boss)) * Math.cos(a), (46 + Math.max(fin, boss)) * Math.sin(a)));
  }
  housing.setFromPoints(hp);
  housing.holes.push(G.circlePath(Ro, 96, false));
  m.part({
    id: 'carcasa', name: 'Carcasa de aluminio con aletas', cat: 'Carcasa y estructura',
    desc: 'Tubo de aluminio extruido en el que se encaja a presión (o por contracción térmica) el estator; el calor del devanado se evacua directamente por conducción a la carcasa.',
    mat: 'Aluminio extruido 6063-T5 anodizado negro',
    objects: [[G.extrude(housing, hz0, hz1, 96), mats.aluminioAnodizado]],
    explode: [0, 120, 0],
  });
  const fl = new THREE.Shape(G.roundedRectPts(90, 90, 8));
  fl.holes.push(G.circlePath(14, 48, false));
  for (const [x, y] of [[35, 35], [-35, 35], [-35, -35], [35, -35]]) fl.holes.push(G.circlePath(3.3, 16, false, x, y));
  for (const a of [45, 135, 225, 315]) fl.holes.push(G.circlePath(2.2, 12, false, 48 * Math.cos(a * DEG) * 0.93, 48 * Math.sin(a * DEG) * 0.93));
  const flange = G.merge([G.extrude(fl, hz1, hz1 + 10, 32), G.ring(14, 35, hz1 + 10, hz1 + 13, 96), G.ring(14, 16, hz1 + 13, hz1 + 15, 48)]);
  m.part({
    id: 'brida', name: 'Brida delantera cuadrada (90 mm)', cat: 'Carcasa y estructura',
    desc: 'Brida de montaje con centraje Ø70 h7 y 4 agujeros pasantes; aloja el rodamiento delantero.',
    mat: 'Aluminio fundido A356 mecanizado',
    objects: [[flange, mats.aluminio]],
    explode: [0, 0, 260],
  });
  const rc = G.merge([G.lathe([[14, hz0], [50, hz0], [50, hz0 - 10], [8, hz0 - 10], [8, hz0 - 8], [14, hz0 - 8]], 96), G.cyl(9, hz0 - 18, hz0 - 10, 32).translate(0, 30, 0)]);
  m.part({
    id: 'tapa-trasera', name: 'Tapa trasera', cat: 'Carcasa y estructura',
    desc: 'Cierra el motor, aloja el rodamiento trasero y la entrada de cables de potencia y de señal.',
    mat: 'Aluminio fundido A356',
    objects: [[rc, mats.aluminio]],
    explode: [0, 0, -120],
  });
  const tie = [];
  for (const a of [45, 135, 225, 315]) {
    const p = new V3(48 * Math.cos(a * DEG) * 0.93, 48 * Math.sin(a * DEG) * 0.93, 0);
    tie.push(G.placed(G.hexBolt(4, hz1 - hz0 + 8, { socket: true }), p.clone().setZ(hz1 + 10), new V3(0, 0, 1)));
    tie.push(G.placed(G.hexBolt(4, 14, { socket: true }), p.clone().setZ(hz0 - 10), new V3(0, 0, -1)));
  }
  m.part({
    id: 'tornillos', name: 'Tornillos de la brida y de la tapa (M4)', cat: 'Tornillería', qty: 8,
    desc: 'Tornillos Allen DIN 912 que unen brida y tapa trasera a las torretas de la carcasa.',
    mat: 'Acero inoxidable A2-70',
    objects: [[G.merge(tie), mats.zincado]],
    explode: [0, 0, 340],
  });

  // rodamientos
  const b1 = G.ballBearing(12, 28, 8, mats);
  b1.position.z = hz1 + 6;
  const b2 = G.ballBearing(12, 28, 8, mats);
  b2.position.z = hz0 - 4.5;
  m.part({ id: 'rodamiento-del', name: 'Rodamiento delantero 6001-2RS', cat: 'Rodamientos', desc: 'Rodamiento rígido de bolas sellado, lubricado de por vida.', mat: 'Acero 100Cr6', objects: [b1], explode: [0, 0, 220] });
  m.part({ id: 'rodamiento-tras', name: 'Rodamiento trasero 6001-2RS', cat: 'Rodamientos', desc: 'Rodamiento rígido de bolas sellado; el aro exterior queda flotante con arandela ondulada de precarga.', mat: 'Acero 100Cr6', objects: [b2], explode: [0, 0, -170] });
  m.part({
    id: 'arandela-ondulada', name: 'Arandela ondulada', cat: 'Rodamientos',
    desc: 'Precarga axial del rodamiento trasero.',
    mat: 'Acero para muelles',
    objects: [[G.torus(11.5, 0.4, TAU, 64, 4).translate(0, 0, hz0 - 9), mats.resorteAcero]],
    explode: [0, 0, -190],
  });

  // ───── electrónica de realimentación ─────
  const pcb = new THREE.Shape();
  pcb.absarc(0, 0, 37, 0, TAU, false);
  pcb.holes.push(G.circlePath(9, 32, false));
  const pcbG = G.extrude(pcb, -Ls - 6.5, -Ls - 5, 64);
  const halls = [], comps = [];
  for (let i = 0; i < 3; i++) {
    const a = (90 + i * 30) * DEG;
    const h = G.box(3, 4, 1.5, 0, 0, 0);
    h.rotateZ(a);
    h.translate(19 * Math.cos(a), 19 * Math.sin(a), -Ls - 4.25);
    halls.push(h);
  }
  for (let i = 0; i < 10; i++) {
    const a = (200 + i * 14) * DEG;
    comps.push(G.box(2, 1.2, 0.8, 30 * Math.cos(a), 30 * Math.sin(a), -Ls - 4.6));
  }
  m.part({
    id: 'pcb-hall', name: 'Tarjeta de sensores Hall', cat: 'Electrónica',
    desc: 'Circuito impreso anular con tres sensores de efecto Hall separados 30° mecánicos (= 120° eléctricos con 4 pares de polos). Indican al controlador la posición del rotor para energizar las bobinas en la secuencia correcta (conmutación electrónica de 6 pasos).',
    mat: 'FR-4 con sensores Hall bipolares tipo latch (SOT-23)',
    objects: [[pcbG, mats.pcb], [G.merge(halls), mats.chipNegro], [G.merge(comps), mats.chipNegro]],
    explode: [0, 0, -80],
  });
  const wires = [mats.cableRojo, mats.cableAmarillo, mats.cableAzul].map((mat, i) => {
    const a = (90 + (i - 1) * 7) * DEG;
    return [G.tubeThrough([G.polar(30, (i * 120 + 10) * DEG, -Ls - 2), G.polar(34, a, -Ls - 8), G.polar(28, a, hz0 - 4), new V3((i - 1) * 2.4, 30, hz0 - 18), new V3((i - 1) * 2.4, 30, hz0 - 40)], 0.9, 40), mat];
  });
  m.part({
    id: 'cables-fase', name: 'Cables de fase U-V-W y de señal', cat: 'Electrónica', qty: 8,
    desc: 'Tres conductores de potencia (U, V, W) hacia el controlador (inversor) y un cable de señal con alimentación y salidas de los sensores Hall.',
    mat: 'Cable de cobre con aislamiento de PTFE',
    objects: [...wires, [G.cyl(3, hz0 - 60, hz0 - 18).translate(0, 30, 0), mats.cableNegro], [G.merge([G.cyl(5, hz0 - 30, hz0 - 18, 24), G.extrude(new THREE.Shape(G.hexPts(12)), hz0 - 22, hz0 - 18, 1)]).translate(0, 30, 0), mats.plasticoNegro]],
    explode: [0, 0, -200],
  });

  m.markRotating(['rotor-nucleo', 'imanes', 'zuncho', 'discos-rotor', 'eje']);
  return m;
}
