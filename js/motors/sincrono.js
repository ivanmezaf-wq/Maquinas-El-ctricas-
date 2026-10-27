// Motor síncrono trifásico de polos salientes (6 polos, 1200 r/min) con devanado amortiguador
// y excitación en CC por anillos rozantes.
import * as THREE from 'three';
import * as G from '../core/geo.js';
import { M } from '../core/materials.js';
import { MotorModel } from '../core/model.js';
import * as C from './common.js';

const { V2, V3, TAU } = G;
const DEG = Math.PI / 180;

export const info = {
  id: 'sincrono-polos-salientes',
  name: 'Motor síncrono de polos salientes',
  short: 'Trifásico · 6 polos · 1200 r/min · 30 kW · excitación CC',
  summary:
    'Gira exactamente a la velocidad síncrona ns = 120 f / p. El estator es igual al de un motor de inducción; el rotor tiene polos salientes con devanado de campo alimentado en CC por anillos rozantes. Arranca como motor de inducción gracias al devanado amortiguador; ajustando la excitación se controla el factor de potencia.',
  specs: [
    ['Tipo', 'Síncrono de polos salientes, excitación por anillos'],
    ['Potencia', '30 kW · 440 V · 60 Hz'],
    ['Velocidad', '1200 r/min (constante)'],
    ['Factor de potencia', '0.8 en adelanto (sobreexcitado)'],
    ['Estator', '48 ranuras, devanado imbricado de doble capa'],
    ['Rotor', '6 polos laminados, 4 barras amortiguadoras por polo'],
    ['Excitación', '60 V CC · 8 A a través de 2 anillos rozantes'],
  ],
};

function poleToGlobal(pts, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return pts.map(([x, y]) => new V2(y * c - x * s, y * s + x * c));
}

export function build() {
  const mats = M();
  const m = new MotorModel(info);
  const paint = mats.fundicionRoja;
  const zf = 130;
  const P = 6;
  const poleA = Array.from({ length: P }, (_, i) => Math.PI / 2 + (i * TAU) / P);

  C.addFrame(m, mats, { Ri: 150, Ro: 162, finR: 178, zf, H: 200, paint, A: 318, B: 305, K: 18, nFins: 52, footT: 22, footW: 60, eyeZ: 90 });
  const prof = G.slotProfile({ w0: 3.5, h0: 1, h1: 2, wTop: 7, wBot: 9.5, depth: 26 });
  C.addACStator(m, mats, { Ri: 105, Ro: 150, L: 180, Ns: 48, prof, pitch: 7, overhang: 24, poles: P, leadsTo: { y: 184, z: -10 }, zLead: 1 });

  // ───── rueda polar (cubo) ─────
  const Lr = 180;
  const hubShape = new THREE.Shape();
  const hp = [];
  for (let i = 0; i < 360; i++) hp.push(new V2(55 * Math.cos(i * DEG), 55 * Math.sin(i * DEG)));
  hubShape.setFromPoints(hp);
  hubShape.holes.push(new THREE.Path(G.shaftHolePts(32, 14, 4.5)));
  m.part({
    id: 'rueda-polar', name: 'Rueda polar (cubo del rotor)', cat: 'Rotor (inductor)',
    desc: 'Cuerpo de acero calado al eje sobre el que se fijan los polos. Forma parte del circuito magnético entre polos adyacentes.',
    mat: 'Acero forjado AISI 1020',
    objects: [[G.extrude(hubShape, -Lr / 2, Lr / 2, 96), mats.aceroForjado]],
    explode: [0, 0, 520],
  });

  // ───── polos salientes ─────
  const shoeA = 23 * DEG, rG = 103.5, w = 36;
  const loc = [];
  for (let i = 0; i <= 20; i++) {
    const t = -shoeA + (2 * shoeA * i) / 20;
    // entrehierro mayor en las puntas (zapata excéntrica) para flujo sinusoidal
    const r = rG - 2.5 * Math.pow(Math.abs(t) / shoeA, 2);
    loc.push([r * Math.sin(t), r * Math.cos(t)]);
  }
  loc.push([92 * Math.sin(shoeA), 92 * Math.cos(shoeA)], [w / 2, 86.5], [w / 2, Math.sqrt(55.2 ** 2 - (w / 2) ** 2)], [-w / 2, Math.sqrt(55.2 ** 2 - (w / 2) ** 2)], [-w / 2, 86.5], [-92 * Math.sin(shoeA), 92 * Math.cos(shoeA)]);
  const barAng = [-18, -9, 9, 18].map((d) => d * DEG);
  const poles = [], bars = [], segs = [], plates = [], rivets = [];
  for (const a of poleA) {
    const sh = new THREE.Shape(poleToGlobal(loc, a - Math.PI / 2).reverse());
    for (const b of barAng) sh.holes.push(G.circlePath(2.6, 14, false, 98 * Math.cos(a + b), 98 * Math.sin(a + b)));
    poles.push(G.lamStack(sh, -Lr / 2, Lr / 2, mats.chapa, mats.chapaLado, 16));
    for (const b of barAng) bars.push(G.cyl(2.5, -Lr / 2 - 9, Lr / 2 + 9, 12).translate(98 * Math.cos(a + b), 98 * Math.sin(a + b), 0));
    for (const s of [1, -1]) {
      const seg = new THREE.Shape();
      seg.absarc(0, 0, 102, a - shoeA + 0.02, a + shoeA - 0.02, false);
      seg.absarc(0, 0, 93.5, a + shoeA - 0.02, a - shoeA + 0.02, true);
      segs.push(G.extrude(seg, s > 0 ? Lr / 2 + 4 : -Lr / 2 - 9, s > 0 ? Lr / 2 + 9 : -Lr / 2 - 4, 16));
      const pl = new THREE.Shape(poleToGlobal(loc, a - Math.PI / 2).reverse());
      plates.push(G.extrude(pl, s > 0 ? Lr / 2 : -Lr / 2 - 4, s > 0 ? Lr / 2 + 4 : -Lr / 2, 16));
      for (const [x, y] of [[-10, 66], [10, 66], [-10, 80], [10, 80]]) {
        const p = poleToGlobal([[x, y]], a - Math.PI / 2)[0];
        rivets.push(G.sphere(3.4, p.x, p.y, s * (Lr / 2 + 4), 10));
      }
    }
  }
  m.part({
    id: 'polos', name: 'Polos salientes (núcleo + zapata polar)', cat: 'Rotor (inductor)', qty: P,
    desc: 'Seis polos laminados que se proyectan desde la rueda polar. La zapata (expansión polar) tiene un entrehierro creciente hacia las puntas para que la onda de flujo sea sinusoidal. Típicos de máquinas de baja velocidad y muchos polos (hidrogeneradores, motores lentos).',
    mat: 'Chapa de acero 1.5 mm remachada',
    objects: poles,
    explode: [0, 0, 520],
  });
  m.part({
    id: 'placas-polares', name: 'Placas de presión y remaches de los polos', cat: 'Rotor (inductor)', qty: 2 * P,
    desc: 'Placas extremas gruesas que comprimen las chapas de cada polo mediante remaches/espárragos pasantes.',
    mat: 'Acero estructural',
    objects: [[G.merge(plates), mats.aceroForjado], [G.merge(rivets), mats.pavonado]],
    explode: [0, 0, 520],
  });
  m.part({
    id: 'amortiguador', name: 'Devanado amortiguador (barras + segmentos)', cat: 'Rotor (inductor)', qty: 4 * P,
    desc: 'Barras de cobre alojadas en agujeros de las zapatas polares y cortocircuitadas en ambos lados: forman una jaula de ardilla incompleta. Permiten el arranque asíncrono del motor y amortiguan las oscilaciones del rotor (penduleo) durante transitorios y cargas desequilibradas.',
    mat: 'Barras de cobre / latón; segmentos de cobre soldados con plata',
    objects: [[G.merge(bars), mats.cobreDesnudo], [G.merge(segs), mats.cobre]],
    explode: [0, 0, 520],
  });
  const coils = [];
  for (const a of poleA) {
    const tan = new V3(-Math.sin(a), Math.cos(a), 0);
    const rad = new V3(Math.cos(a), Math.sin(a), 0);
    coils.push(G.poleCoil(w, Lr + 8, 8, 21, 4).applyMatrix4(new THREE.Matrix4().makeBasis(tan, new V3(0, 0, 1), rad).setPosition(rad.clone().multiplyScalar(61))));
  }
  m.part({
    id: 'devanado-campo', name: 'Devanado de campo (excitación)', cat: 'Rotor (inductor)', qty: P,
    desc: 'Bobinas de pletina de cobre arrolladas de canto alrededor de cada polo y conectadas en serie con polaridades alternas (N-S-N…). Alimentadas con corriente continua, crean el campo del rotor que se "engancha" al campo giratorio del estator.',
    mat: 'Pletina de cobre arrollada de canto, aislamiento entre espiras de Nomex, clase F',
    objects: [[G.merge(coils), mats.cobre]],
    explode: [0, 0, 520],
  });
  const wedges = [];
  for (const a of poleA) {
    const am = a + Math.PI / P;
    const sh = new THREE.Shape([new V2(-4, 64), new V2(4, 64), new V2(12, 82), new V2(-12, 82)].map((p) => poleToGlobal([[p.x, p.y]], am - Math.PI / 2)[0]));
    wedges.push(G.extrude(sh, -Lr / 2 + 10, Lr / 2 - 10, 1));
  }
  m.part({
    id: 'cunas-interpolares', name: 'Cuñas interpolares (soportes de bobina)', cat: 'Rotor (inductor)', qty: P,
    desc: 'Bloques en "V" entre bobinas vecinas que las sujetan contra la fuerza centrífuga.',
    mat: 'Laminado de vidrio-epoxi / aluminio',
    objects: [[G.merge(wedges), mats.cunaRanura]],
    explode: [0, 0, 520],
  });
  // conexiones entre bobinas de campo
  const jumpers = [];
  for (let i = 0; i < P - 1; i++) {
    const a0 = poleA[i] + 0.3, a1 = poleA[i + 1] - 0.3;
    jumpers.push(G.tubeThrough([G.polar(78, a0, -Lr / 2 - 10), G.polar(74, (a0 + a1) / 2, -Lr / 2 - 16), G.polar(78, a1, -Lr / 2 - 10)], 1.6, 16));
  }
  for (const [i, k] of [[0, 0], [P - 1, 1]]) {
    const a = poleA[i] + (k ? 0.3 : -0.3);
    jumpers.push(G.tubeThrough([G.polar(78, a, -Lr / 2 - 10), G.polar(44, a, -Lr / 2 - 18), G.polar(14, a, -Lr / 2 - 26), G.polar(14, a, -195), G.polar(28, a, -204 - k * 18), G.polar(34, a, -205 - k * 18)], 2, 50));
  }
  m.part({
    id: 'conexiones-campo', name: 'Conexiones del campo hacia los anillos', cat: 'Rotor (inductor)', qty: 7,
    desc: 'Puentes entre bobinas polares y los dos conductores (F+ / F−) que viajan por el interior del eje hasta los anillos rozantes.',
    mat: 'Cable de cobre con aislamiento de silicona',
    objects: [[G.merge(jumpers), mats.cableRojo]],
    explode: [0, 0, 520],
  });
  // ventiladores internos
  const fans = G.merge([
    G.radialFan({ rHub: 40, rOut: 92, bore: 64, nBlades: 12, z0: Lr / 2 + 14, z1: Lr / 2 + 26, hubLen: 12, bladeT: 3 }),
    G.radialFan({ rHub: 40, rOut: 92, bore: 64, nBlades: 12, z0: -Lr / 2 - 26, z1: -Lr / 2 - 14, hubLen: 12, bladeT: 3 }),
  ]);
  m.part({
    id: 'ventiladores', name: 'Ventiladores internos', cat: 'Refrigeración', qty: 2,
    desc: 'Ventiladores montados en el eje a ambos lados del rotor que recirculan el aire interior y lo llevan hacia la carcasa aleteada.',
    mat: 'Aluminio fundido',
    objects: [[fans, mats.aluminioFundido]],
    explode: [0, 0, 520],
  });

  // ───── eje ─────
  const sp = [
    [0, -262], [24, -262], [25, -261], [25, -140], [30, -138], [30, -112], [32, -110], [32, 110], [30, 112], [30, 184], [28.5, 185.5], [27.5, 186], [0, 186],
  ];
  C.addShaft(m, mats, sp, { explodeZ: 520, keyway: { r: 27.5, z0: 186, z1: 296, b: 16, t1: 6, h: 10, L: 90 } });
  C.addEndShield(m, mats, { s: 1, zf, frameRi: 150, flangeR: 174, bear: { d: 60, D: 130, B: 31, code: '6312-C3' }, shaftR: 30, paint, side: 'LA', boltR: 164, boltD: 12, nBolts: 6, explodeZ: 760 });
  C.addEndShield(m, mats, { s: -1, zf, frameRi: 150, flangeR: 174, bear: { d: 50, D: 110, B: 27, code: '6310-C3' }, shaftR: 25, paint, side: 'LOA', boltR: 164, boltD: 12, nBolts: 6, explodeZ: 260 });

  // ───── anillos rozantes y escobillas de excitación ─────
  const rings = [], ins = [G.ring(25, 33, -238, -196, 64)];
  for (let i = 0; i < 2; i++) {
    const zc = -205 - i * 18;
    rings.push(G.lathe([[33, zc - 6], [45.5, zc - 6], [46, zc - 5.5], [46, zc + 5.5], [45.5, zc + 6], [33, zc + 6]], 96));
  }
  for (const zb of [-197, -214, -232]) ins.push(G.ring(33, 40, zb - 1.5, zb + 1.5, 64));
  m.part({
    id: 'anillos-rozantes', name: 'Anillos rozantes F+ / F−', cat: 'Excitación',
    desc: 'Dos anillos aislados del eje por los que entra la corriente continua de excitación al devanado de campo.',
    mat: 'Acero inoxidable / bronce',
    objects: [[G.merge(rings), mats.bronce], [G.merge(ins), mats.baquelita]],
    explode: [0, 0, -380],
  });
  const holders = [], brushes = [], springs = [];
  for (let i = 0; i < 2; i++) {
    const zc = -205 - i * 18;
    for (const ang of [90, 270]) {
      const rot = new THREE.Matrix4().makeRotationZ((ang - 90) * DEG);
      brushes.push(G.box(16, 22, 10, 0, 57.5, zc).applyMatrix4(rot));
      holders.push(G.merge([G.box(2, 24, 13, -9.5, 64, zc), G.box(2, 24, 13, 9.5, 64, zc), G.box(21, 2, 13, 0, 77, zc), G.box(8, 14, 8, 0, 84, zc)]).applyMatrix4(rot));
      springs.push(G.helix(4, 1.6, 4, 0.7).rotateX(-Math.PI / 2).translate(0, 68.6, zc).applyMatrix4(rot));
    }
  }
  const bars2 = [];
  for (const ang of [90, 270]) {
    const rot = new THREE.Matrix4().makeRotationZ((ang - 90) * DEG);
    bars2.push(G.box(14, 10, 70, 0, 95, -212).applyMatrix4(rot), G.box(10, 10, 40, 0, 95, -160).applyMatrix4(rot));
  }
  m.part({
    id: 'escobillas', name: 'Escobillas de excitación', cat: 'Excitación', qty: 4,
    desc: 'Dos escobillas por anillo, diametralmente opuestas, deslizan sobre los anillos y conectan la fuente de CC (excitatriz o rectificador) con el campo giratorio.',
    mat: 'Grafito metalizado',
    objects: [[G.merge(brushes), mats.carbon]],
    explode: [0, 0, -430],
  });
  m.part({
    id: 'portaescobillas', name: 'Portaescobillas, resortes y barras soporte', cat: 'Excitación', qty: 4,
    desc: 'Cajas guía con resorte de presión sobre barras aisladas fijadas al escudo LOA.',
    mat: 'Latón / acero para resortes / resina aislante',
    objects: [[G.merge(holders), mats.laton], [G.merge(springs), mats.resorteAcero], [G.merge(bars2), mats.baquelita]],
    explode: [0, 0, -470],
  });
  const cover = G.merge([G.ring(126, 129, -268, -148, 128), G.ring(100, 129, -148, -142, 128), G.perforatedDisc(129, 4.5, 12, 2, -271, 34)]);
  m.part({
    id: 'cubierta-anillos', name: 'Cubierta de anillos rozantes', cat: 'Carcasa y estructura',
    desc: 'Protege los anillos y escobillas y permite el acceso para inspección.',
    mat: 'Chapa de acero pintada',
    objects: [[cover, paint]],
    explode: [0, 0, -700],
  });

  C.addTerminalBox(m, mats, {
    y0: 178, z: -10, paint, connection: 'star', w: 130, d: 130, nameplateTitle: 'MOTOR SÍNCRONO',
    nameplateLines: ['3~ Síncrono polos salientes  6 p', '30 kW   440 V Y   44 A   60 Hz', '1200 r/min   cos φ 0.8 adelanto', 'Excitación 60 V CC  8 A (F1-F2)', 'IP44  Aisl. F  Arranque asíncrono', 'Rod. 6312-C3 / 6310-C3'],
  });
  C.addEyeBolt(m, mats, 184, 90, 16);

  m.markRotating(['rueda-polar', 'polos', 'placas-polares', 'amortiguador', 'devanado-campo', 'cunas-interpolares', 'conexiones-campo', 'ventiladores', 'eje', 'chaveta', 'anillos-rozantes']);
  return m;
}
