// Motor de corriente continua de campo devanado (excitación compuesta), 4 polos principales
// + 4 polos auxiliares de conmutación. Partes según la constitución de la máquina de CC:
// 1 culata, 2 núcleo polar, 3 expansión polar, 4 núcleo del polo auxiliar, 5 expansión del polo auxiliar,
// 6 núcleo del inducido, 7 devanado inducido, 8 devanado de excitación, 9 devanado de conmutación,
// 10 colector, 11-12 escobillas.
import * as THREE from 'three';
import * as G from '../core/geo.js';
import { M } from '../core/materials.js';
import { MotorModel } from '../core/model.js';
import * as C from './common.js';

const { V2, V3, TAU } = G;
const DEG = Math.PI / 180;

export const info = {
  id: 'cc-campo-devanado',
  name: 'Motor de CC de campo devanado',
  short: 'Compound · 4 polos + 4 interpolos · 15 kW · 440 V',
  summary:
    'Máquina con colector: el inductor (polos con devanado de excitación sobre la culata) crea el campo; en el inducido giratorio se produce la conversión de energía y el colector con las escobillas rectifica mecánicamente la corriente. Los polos de conmutación mejoran la conmutación.',
  specs: [
    ['Tipo', 'CC compound aditivo (derivación + serie)'],
    ['Potencia', '15 kW · 440 V · 38 A'],
    ['Velocidad', '1750 r/min (regulación ≈ 8 %)'],
    ['Polos', '4 principales + 4 de conmutación'],
    ['Inducido', '28 ranuras abiertas, devanado imbricado, 56 delgas'],
    ['Entrehierro', '2.5 mm (polos principales) · 6 mm (interpolos)'],
    ['Escobillas', '4 brazos × 2 escobillas de electrografito'],
  ],
};

function sectorRing(rIn, rOut, z0, z1, a0, a1, seg = 24) {
  const g = new THREE.LatheGeometry([new V2(rIn, z0), new V2(rOut, z0), new V2(rOut, z1), new V2(rIn, z1), new V2(rIn, z0)], seg, a0 + Math.PI / 2, a1 - a0);
  g.rotateX(Math.PI / 2);
  return G.crease(g, 40);
}

// Transforma puntos locales del polo (x tangencial, y radial) al ángulo a
function poleToGlobal(pts, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return pts.map(([x, y]) => new V2(y * c - x * s, y * s + x * c));
}

function poleBasis(a, r) {
  const tan = new V3(-Math.sin(a), Math.cos(a), 0);
  const rad = new V3(Math.cos(a), Math.sin(a), 0);
  return new THREE.Matrix4().makeBasis(tan, new V3(0, 0, 1), rad).setPosition(rad.multiplyScalar(r));
}

export function build() {
  const mats = M();
  const m = new MotorModel(info);
  const paint = mats.fundicionGris;
  const yRi = 128, yRo = 146;
  const zDE = 110, zNDE = 175;
  const H = 160;
  const mainA = [0, 90, 180, 270].map((d) => d * DEG);
  const interA = [45, 135, 225, 315].map((d) => d * DEG);

  // ───── culata (yugo) con patas y ventanas de inspección ─────
  const yoke = [G.ring(yRi, yRo, -100, zDE - 8, 128), G.ring(yRi, yRo + 4, zDE - 8, zDE, 128), G.ring(yRi, yRo + 4, -zNDE, -zNDE + 8, 128)];
  for (let k = 0; k < 4; k++) {
    const a0 = (k * 90 + 24) * DEG, a1 = (k * 90 + 66) * DEG;
    yoke.push(sectorRing(yRi, yRo, -zNDE + 8, -100, a0, a1, 24));
  }
  const A = 254, B = 210;
  const footShape = G.roundedRectShape(A + 54, 50, 4);
  for (const sx of [-1, 1]) footShape.holes.push(new THREE.Path(G.roundedRectPts(14, 22, 6.9, (sx * A) / 2, 0).reverse()));
  for (const s of [-1, 1]) {
    const f = G.extrude(footShape, 0, 20, 16);
    f.rotateX(Math.PI / 2);
    f.translate(0, -H + 20, (s * B) / 2 - 20);
    yoke.push(f);
    yoke.push(G.extrude(new THREE.Shape([new V2(-A / 2 - 12, -H + 19), new V2(A / 2 + 12, -H + 19), new V2(95, -110), new V2(-95, -110)]), (s * B) / 2 - 32, (s * B) / 2 - 8, 1));
  }
  yoke.push(G.box(120, 12, 120, 0, yRo + 4, 30));
  yoke.push(G.cyl(16, 0, 14).rotateX(-Math.PI / 2).translate(0, yRo - 4, -60));
  m.part({
    id: 'culata', name: 'Culata (yugo) con patas', cat: 'Inductor (estator)',
    desc: 'Pieza de material ferromagnético, no rodeada por devanados, que une los polos de la máquina y cierra el circuito magnético entre ellos. Al llevar flujo constante suele ser maciza; también es la carcasa mecánica. En el extremo del colector tiene ventanas para inspeccionar las escobillas.',
    mat: 'Acero laminado en caliente / acero fundido (antes hierro fundido)',
    objects: [[G.merge(yoke), paint]],
    explode: [0, 300, 0],
  });

  // ───── polos principales (pieza polar = núcleo + expansión polar) ─────
  const shoeA = 31 * DEG, rGap = 72.5, wCore = 56;
  const poleLocal = [];
  for (let i = 0; i <= 24; i++) {
    const t = -shoeA + (2 * shoeA * i) / 24;
    poleLocal.push([rGap * Math.sin(t) * 1.0, rGap * Math.cos(t)]);
  }
  poleLocal.push([80 * Math.sin(shoeA), 80 * Math.cos(shoeA) + 2], [wCore / 2, 92]);
  const yTop = Math.sqrt(yRi * yRi - (wCore / 2) ** 2);
  poleLocal.push([wCore / 2, yTop]);
  for (let i = 1; i < 8; i++) {
    const x = wCore / 2 - (wCore * i) / 8;
    poleLocal.push([x, Math.sqrt(yRi * yRi - x * x)]);
  }
  poleLocal.push([-wCore / 2, yTop], [-wCore / 2, 92], [-80 * Math.sin(shoeA), 80 * Math.cos(shoeA) + 2]);
  const ordered = poleLocal.reverse();
  const poles = mainA.map((a) => G.lamStack(new THREE.Shape(poleToGlobal(ordered, a)), -75, 75, mats.chapa, mats.chapaLado, 4));
  m.part({
    id: 'polos-principales', name: 'Piezas polares: núcleo + expansión polar', cat: 'Inductor (estator)', qty: 4,
    desc: 'Parte del circuito magnético entre la culata y el entrehierro. El núcleo polar está rodeado por el devanado inductor; la expansión polar (zapata) es la parte próxima al inducido que bordea el entrehierro y reparte el flujo. Sus puntas se separan un poco más para suavizar la conmutación. Laminadas para reducir pérdidas por pulsación de flujo en los dientes.',
    mat: 'Chapa de acero de 1–2 mm remachada (zapata laminada)',
    objects: poles,
    explode: [0, 0, 0],
  });
  const coils = mainA.map((a) => G.poleCoil(wCore, 150, 14, 25, 6).applyMatrix4(poleBasis(a, 94)));
  m.part({
    id: 'devanado-excitacion', name: 'Devanado inductor (excitación derivación + serie)', cat: 'Inductor (estator)', qty: 4,
    desc: 'Conjunto de espiras que produce el flujo magnético al ser recorrido por la corriente de excitación. En el compound cada bobina tiene una sección en derivación (muchas espiras de hilo fino) y una sección serie (pocas espiras de pletina gruesa). Se arrolla en forma de hélice alrededor de los núcleos polares.',
    mat: 'Hilo de cobre esmaltado (derivación) y pletina de cobre (serie), aislamiento clase F, impregnado',
    objects: [[G.merge(coils), mats.cobreEsmalte]],
    explode: [0, 0, 0],
  });

  // ───── polos auxiliares (de conmutación) ─────
  const wI = 20;
  const iLocal = [[-wI / 2 - 3, 76], [wI / 2 + 3, 76], [wI / 2 + 3, 79], [wI / 2, 82], [wI / 2, Math.sqrt(yRi * yRi - (wI / 2) ** 2)], [-wI / 2, Math.sqrt(yRi * yRi - (wI / 2) ** 2)], [-wI / 2, 82], [-wI / 2 - 3, 79]];
  const ipoles = interA.map((a) => G.lamStack(new THREE.Shape(poleToGlobal(iLocal, a)), -70, 70, mats.chapaOscura, mats.chapaOscuraLado, 2));
  m.part({
    id: 'polos-conmutacion', name: 'Polos auxiliares (de conmutación)', cat: 'Inductor (estator)', qty: 4,
    desc: 'Polos suplementarios situados entre los principales (en la línea neutra) que inducen en la bobina que conmuta una f.e.m. que anula la de reactancia: eliminan el chisporroteo en las escobillas. Se emplean en máquinas de mediana y gran potencia. Entrehierro mayor que el de los polos principales.',
    mat: 'Acero macizo o chapa gruesa',
    objects: ipoles,
    explode: [0, 0, 0],
  });
  const icoils = interA.map((a) => G.poleCoil(wI, 140, 9, 32, 3).applyMatrix4(poleBasis(a, 86)));
  m.part({
    id: 'devanado-conmutacion', name: 'Devanado de conmutación', cat: 'Inductor (estator)', qty: 4,
    desc: 'Pocas espiras de pletina conectadas en serie con el inducido: su f.m.m. es proporcional a la corriente de carga y compensa también la reacción del inducido en la zona neutra.',
    mat: 'Pletina de cobre desnuda con separadores aislantes',
    objects: [[G.merge(icoils), mats.cobre]],
    explode: [0, 0, 0],
  });

  // tornillos de polo
  const pb = [];
  for (const a of [...mainA, ...interA]) {
    const dir = new V3(Math.cos(a), Math.sin(a), 0);
    const zs = mainA.includes(a) ? [-45, 45] : [-30, 30];
    const d = mainA.includes(a) ? 12 : 10;
    for (const z of zs) {
      pb.push(G.placed(G.hexBolt(d, 40), dir.clone().multiplyScalar(yRo).add(new V3(0, 0, z)), dir));
      pb.push(G.placed(G.washer(d), dir.clone().multiplyScalar(yRo - 0.1).add(new V3(0, 0, z)), dir));
    }
  }
  m.part({
    id: 'tornillos-polos', name: 'Tornillos de fijación de polos', cat: 'Tornillería', qty: 16,
    desc: 'Tornillos radiales que atraviesan la culata y se roscan en los núcleos polares; permiten desmontar los polos y ajustar el entrehierro con calzas.',
    mat: 'Acero clase 8.8 pavonado',
    objects: [[G.merge(pb), mats.pavonado]],
    explode: [0, 300, 0],
  });

  // conexiones entre bobinas del inductor
  const jumpers = [];
  const allA = [...mainA, ...interA].sort((p, q) => p - q);
  for (let i = 0; i < allA.length; i++) {
    const a0 = allA[i], a1 = allA[(i + 1) % allA.length] + (i === allA.length - 1 ? TAU : 0);
    jumpers.push(G.tubeThrough([G.polar(118, a0 + 0.12, 88), G.polar(122, (a0 + a1) / 2, 96), G.polar(118, a1 - 0.12, 88)], 1.6, 16));
  }
  m.part({
    id: 'conexiones-inductor', name: 'Conexiones entre bobinas polares', cat: 'Inductor (estator)', qty: 8,
    desc: 'Puentes que conectan en serie las bobinas de polos alternos (N-S-N-S) y las de conmutación.',
    mat: 'Cable de cobre con aislamiento de silicona',
    objects: [[G.merge(jumpers), mats.cableNegro]],
    explode: [0, 300, 0],
  });

  // ───── inducido ─────
  const Ra = 70, La = 150, Na = 28;
  const prof = G.slotProfile({ w0: 7, h0: 0.1, h1: 0.1, wTop: 7, wBot: 7, depth: 20, round: false });
  const aShape = new THREE.Shape(G.slottedCirclePts(Ra, Na, prof, true, 0, 5));
  aShape.holes.push(G.circlePath(38, 64, false));
  for (let i = 0; i < 10; i++) {
    const a = ((i + 0.5) / 10) * TAU;
    aShape.holes.push(G.circlePath(3.6, 14, false, 44 * Math.cos(a), 44 * Math.sin(a)));
  }
  m.part({
    id: 'inducido-nucleo', name: 'Núcleo del inducido', cat: 'Inducido (rotor)',
    desc: 'Pieza cilíndrica de chapas magnéticas montada sobre el cuerpo (estrella) fijado al eje. Las chapas tienen 28 ranuras abiertas para alojar el devanado inducido y canales axiales de ventilación. Laminado fino porque su flujo se invierte p/2 veces por vuelta.',
    mat: 'Chapa de acero al silicio 0.5 mm (0.017–0.025 in) barnizada',
    objects: [G.lamStack(aShape, -La / 2, La / 2, mats.chapa, mats.chapaLado, 64)],
    explode: [0, 0, 460],
  });
  const spider = [G.ring(27, 32, -La / 2 - 4, La / 2 + 4, 48), G.ring(36, 38, -La / 2, La / 2, 64)];
  for (let i = 0; i < 6; i++) {
    const b = G.box(6, 8, La);
    b.translate(34.5, 0, 0);
    b.rotateZ((i / 6) * TAU);
    spider.push(b);
  }
  m.part({
    id: 'estrella', name: 'Cuerpo o estrella del inducido', cat: 'Inducido (rotor)',
    desc: 'Cubo con brazos (estrella) calado al eje sobre el que se apila el núcleo del inducido; deja canales de aire bajo las chapas.',
    mat: 'Acero fundido / soldado',
    objects: [[G.merge(spider), mats.aceroForjado]],
    explode: [0, 0, 460],
  });
  const cuA = [], wedA = [];
  for (let k = 0; k < Na; k++) {
    const a = (k * TAU) / Na;
    wedA.push(G.extrude(G.polyShape(G.slotRegionPts(Ra, a, prof, 0.4, 2.3, 0.2, true, 2)), -La / 2 - 2, La / 2 + 2, 1));
    cuA.push(G.extrude(G.polyShape(G.slotRegionPts(Ra, a, prof, 2.6, 10.6, 0.6, true, 2)), -La / 2 - 1, La / 2 + 1, 1));
    cuA.push(G.extrude(G.polyShape(G.slotRegionPts(Ra, a, prof, 11.2, 19.4, 0.6, true, 2)), -La / 2 - 1, La / 2 + 1, 1));
  }
  const endsA = [];
  const rT = Ra - 6.6, rB = Ra - 15.3;
  for (const dir of [1, -1]) for (let k = 0; k < Na; k++) endsA.push(G.endTurn(rT, (k * TAU) / Na, rB, ((k + 7) * TAU) / Na, (dir * La) / 2, 4, 15, rB - 1, 2.8, dir, 24));
  // conexiones bobina-delga (dos por ranura)
  const toBars = [];
  for (let k = 0; k < 56; k++) {
    const a = ((k + 0.5) * TAU) / 56;
    toBars.push(G.tubeThrough([G.polar(rT, a, -La / 2 - 2), G.polar(rT - 2, a + 0.03, -La / 2 - 12), G.polar(54, a + 0.05, -98.5)], 0.9, 8, false, 5));
  }
  m.part({
    id: 'devanado-inducido', name: 'Devanado inducido', cat: 'Inducido (rotor)',
    desc: 'Devanado imbricado de doble capa conectado al circuito exterior; en él tiene lugar la conversión principal de energía. Cada bobina abarca un paso polar (7 ranuras) y sus extremos se sueldan a las banderolas de dos delgas contiguas.',
    mat: 'Pletina de cobre aislada con cinta de mica-vidrio, clase F',
    objects: [[G.merge(cuA), mats.cobre], [G.merge(endsA), mats.cobreEsmalte], [G.merge(toBars), mats.cobreDesnudo]],
    explode: [0, 0, 460],
  });
  const bands = [];
  for (const dir of [1, -1]) for (const off of [6, 13]) bands.push(G.ring(rT + 2.8, rT + 4.4, dir * (La / 2 + off) - 2.5, dir * (La / 2 + off) + 2.5, 96));
  m.part({
    id: 'cunas-zunchos-inducido', name: 'Cuñas y zunchos del inducido', cat: 'Inducido (rotor)', qty: 32,
    desc: 'Las cuñas cierran las ranuras abiertas y los zunchos de alambre sujetan las cabezas de bobina contra la fuerza centrífuga.',
    mat: 'Cuñas de vidrio-epoxi / alambre de acero no magnético',
    objects: [[G.merge(wedA), mats.cunaRanura], [G.merge(bands), mats.zincado]],
    explode: [0, 0, 460],
  });

  // ───── colector ─────
  const com = G.commutator(56, 34, 50, -150, -104, 8, 6);
  m.part({
    id: 'colector', name: 'Colector (delgas de cobre)', cat: 'Inducido (rotor)', qty: 56,
    desc: 'Conjunto de 56 láminas conductoras (delgas) aisladas entre sí, conectadas a las secciones del devanado y sobre las que frotan las escobillas. Convierte mecánicamente la tensión alterna inducida en tensión continua en los bornes (por eso se llaman máquinas con colector).',
    mat: 'Cobre electrolítico estirado con plata (CuAg 0.1)',
    objects: [[com.delgas, mats.cobreDesnudo], [com.risers, mats.cobre]],
    explode: [0, 0, 460],
  });
  const vRings = G.merge([
    G.lathe([[27, -160], [44, -160], [46, -156], [37, -150], [30, -150], [30, -158], [27, -158]], 72),
    G.lathe([[27, -104], [30, -104], [37, -104], [44, -100], [42, -98], [27, -98]], 72),
    G.ring(27, 34, -160, -98, 48),
  ]);
  const nutG = G.merge([G.extrude((() => { const s = new THREE.Shape(G.hexPts(80)); s.holes.push(G.circlePath(27.5, 48, false)); return s; })(), -168, -160, 48)]);
  m.part({
    id: 'colector-aislamiento', name: 'Micas, anillos en V y casquillo del colector', cat: 'Inducido (rotor)',
    desc: 'Las delgas se separan con láminas de mica y se sujetan por sus colas en "cola de milano" con dos anillos en V aislados con conos de micanita, apretados sobre el casquillo por una tuerca.',
    mat: 'Mica / micanita; anillos y casquillo de acero',
    objects: [[com.mica, mats.mica], [vRings, mats.aceroForjado], [nutG, mats.pavonado]],
    explode: [0, 0, 460],
  });

  // ───── escobillas y portaescobillas ─────
  const holders = [], brushes = [], springs = [], pig = [], studs = [], sleeves = [];
  for (const a of mainA) {
    const rot = new THREE.Matrix4().makeRotationZ(a - Math.PI / 2);
    for (const zc of [-118, -136]) {
      brushes.push(G.box(16, 30, 12, 0, 50.6 + 15, zc).applyMatrix4(rot));
      holders.push(G.merge([G.box(2, 32, 15, -9, 72, zc), G.box(2, 32, 15, 9, 72, zc), G.box(20, 32, 2, 0, 72, zc - 7.5), G.box(20, 32, 2, 0, 72, zc + 7.5), G.box(12, 8, 10, 0, 92, zc)]).applyMatrix4(rot));
      springs.push(G.helix(4, 1.2, 5, 0.7).rotateX(-Math.PI / 2).translate(0, 81, zc).applyMatrix4(rot));
      pig.push(G.tubeThrough([[3, 81, zc], [10, 86, zc + 3], [8, 93, zc + 5], [3, 95, zc + 4]], 1.1, 16).applyMatrix4(rot));
    }
    studs.push(G.cyl(4.5, -172, -110, 16).translate(0, 96, 0).applyMatrix4(rot));
    sleeves.push(G.cyl(6.5, -165, -146, 16).translate(0, 96, 0).applyMatrix4(rot), G.cyl(6.5, -129, -125, 16).translate(0, 96, 0).applyMatrix4(rot));
  }
  m.part({
    id: 'escobillas', name: 'Escobillas', cat: 'Escobillas', qty: 8,
    desc: 'Piezas conductoras que aseguran, por contacto deslizante, la conexión eléctrica entre el colector (órgano móvil) y el circuito exterior (órgano fijo). Se colocan en la línea neutra. Caída de contacto ≈ 1 V por escobilla.',
    mat: 'Electrografito (carbón grafitado)',
    objects: [[G.merge(brushes), mats.carbon]],
    explode: [0, 0, -330],
  });
  m.part({
    id: 'portaescobillas', name: 'Portaescobillas tipo caja', cat: 'Escobillas', qty: 8,
    desc: 'Cajas guía de latón que mantienen la escobilla perpendicular al colector a 2–3 mm de su superficie. Van sujetas a pernos aislados del balancín.',
    mat: 'Latón fundido',
    objects: [[G.merge(holders), mats.laton]],
    explode: [0, 0, -360],
  });
  m.part({
    id: 'resortes-escobillas', name: 'Resortes y conductores flexibles (pigtails)', cat: 'Escobillas', qty: 16,
    desc: 'El resorte aplica una presión de ≈ 2.5 lb/in² sobre la escobilla; el conductor flexible de cobre trenzado lleva la corriente de la escobilla al portaescobillas.',
    mat: 'Acero inoxidable para resortes / trenza de cobre',
    objects: [[G.merge(springs), mats.resorteAcero], [G.merge(pig), mats.cobreDesnudo]],
    explode: [0, 0, -400],
  });
  const rocker = [G.ring(88, 106, -176 + 4, -164, 96)];
  for (const a of [Math.PI / 4, (5 * Math.PI) / 4]) {
    const b = G.box(24, 12, 8);
    b.translate(117, 0, -168);
    b.rotateZ(a);
    rocker.push(b);
  }
  m.part({
    id: 'balancin', name: 'Balancín (anillo portaescobillas) y pernos aislados', cat: 'Escobillas',
    desc: 'Anillo que soporta los cuatro brazos de escobillas; puede girarse para ajustar las escobillas a la línea neutra y luego se bloquea. Los pernos van aislados con manguitos.',
    mat: 'Acero fundido / pernos de acero con manguitos de resina',
    objects: [[G.merge([...rocker, ...studs]), mats.aceroForjado], [G.merge(sleeves), mats.baquelita]],
    explode: [0, 0, -440],
  });
  // anillos de conexión de escobillas
  const conn = [G.torus(112, 2.2, TAU, 128, 8).translate(0, 0, -169), G.torus(119, 2.2, TAU, 128, 8).translate(0, 0, -169)];
  mainA.forEach((a, i) => conn.push(G.tubeThrough([G.polar(96, a, -170), G.polar(i % 2 ? 119 : 112, a + 0.1, -169)], 1.8, 8)));
  conn.push(G.tubeThrough([[-30, 119, -169], [-34, 124, -140], [-34, 124, 0], [-30, 150, 20], [-20, 160, 30]], 2.4, 40));
  conn.push(G.tubeThrough([[30, 112, -169], [34, 124, -140], [34, 124, 0], [30, 150, 20], [20, 160, 30]], 2.4, 40));
  m.part({
    id: 'conexiones-escobillas', name: 'Anillos de conexión y cables A1-A2', cat: 'Conexiones',
    desc: 'Unen en paralelo los brazos de igual polaridad (+ con +, − con −) y llevan la corriente del inducido a la caja de bornes.',
    mat: 'Cable de cobre flexible',
    objects: [[G.merge(conn), mats.cableRojo]],
    explode: [0, 0, -440],
  });

  // tapas de ventanas de inspección
  const covers = [], cScrews = [];
  for (let k = 0; k < 4; k++) {
    const ac = k * 90 * DEG;
    covers.push(sectorRing(yRo, yRo + 2, -zNDE + 10, -102, ac - 27 * DEG, ac + 27 * DEG, 16));
    for (let j = 0; j < 4; j++) {
      const b = G.box(30, 2, 4);
      b.translate(0, yRo + 2.5, -160 + j * 14);
      b.rotateZ(ac - Math.PI / 2);
      covers.push(b);
    }
    for (const sgn of [-1, 1]) {
      const a = ac + sgn * 22 * DEG;
      const dir = new V3(Math.cos(a), Math.sin(a), 0);
      cScrews.push(G.placed(G.panScrew(5, 10), dir.clone().multiplyScalar(yRo + 2).add(new V3(0, 0, -138)), dir));
    }
  }
  m.part({
    id: 'tapas-inspeccion', name: 'Tapas de las ventanas de inspección', cat: 'Carcasa y estructura', qty: 4,
    desc: 'Cubiertas con persianas que permiten revisar el desgaste de escobillas y el estado del colector sin desmontar la máquina.',
    mat: 'Chapa de acero estampada',
    objects: [[G.merge(covers), paint], [G.merge(cScrews), mats.zincado]],
    explode: [0, 180, -60],
  });

  // ventilador interno
  m.part({
    id: 'ventilador', name: 'Ventilador interno (LA)', cat: 'Refrigeración',
    desc: 'Ventilador centrífugo calado al eje: aspira aire por las ventanas del lado colector y lo expulsa por el lado de acoplamiento, refrigerando polos, inducido y colector.',
    mat: 'Aluminio fundido',
    objects: [[G.radialFan({ rHub: 30, rOut: 66, bore: 50, nBlades: 10, z0: 100, z1: 112, hubLen: 14, bladeT: 3 }), mats.aluminioFundido]],
    explode: [0, 0, 460],
  });

  // ───── eje, escudos y rodamientos ─────
  const sp = [
    [0, -226], [16.5, -226], [17.5, -225], [17.5, -186], [22, -186], [24, -184], [24, -172], [27, -170], [27, 100], [25, 102], [25, 118],
    [22.5, 120], [22.5, 158], [21.5, 159], [21.5, 160], [0, 160],
  ];
  C.addShaft(m, mats, sp, { explodeZ: 460, keyway: { r: 21.5, z0: 160, z1: 270, b: 12, t1: 5, h: 8, L: 90 } });
  C.addEndShield(m, mats, { s: 1, zf: zDE, frameRi: yRi, flangeR: 150, bear: { d: 45, D: 100, B: 25, code: '6309-2Z' }, shaftR: 22.5, paint, side: 'LA', boltR: 138, boltD: 10, nBolts: 6, explodeZ: 680 });
  C.addEndShield(m, mats, { s: -1, zf: zNDE, frameRi: yRi, flangeR: 150, bear: { d: 35, D: 80, B: 21, code: '6307-2Z' }, shaftR: 17.5, paint, side: 'LOA', boltR: 138, boltD: 10, nBolts: 6, explodeZ: 300 });

  C.addTerminalBox(m, mats, {
    y0: yRo + 10, z: 30, paint, connection: 'none', nameplateTitle: 'MOTOR DE CC',
    terminalsText: 'Bornes A1-A2 (inducido), E1-E2 (excitación derivación) y D1-D2 (excitación serie), según IEC 60034-8.',
    nameplateLines: ['CC compound  4 polos + interpolos', '15 kW   440 V   38 A', '1750 r/min   regulación 8 %', 'Exc. deriv. 440 V  1.2 A', 'IP23  IC01  Aisl. F  S1', 'Colector 56 delgas  Escob. 4×2'],
  });
  C.addEyeBolt(m, mats, yRo + 10, -60, 16);

  m.markRotating(['inducido-nucleo', 'estrella', 'devanado-inducido', 'cunas-zunchos-inducido', 'colector', 'colector-aislamiento', 'ventilador', 'eje', 'chaveta']);
  return m;
}
