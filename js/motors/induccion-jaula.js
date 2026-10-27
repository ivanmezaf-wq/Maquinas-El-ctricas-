// Motor de inducción trifásico de jaula de ardilla, cerrado con ventilación externa (TEFC),
// carcasa IEC 132M, 7.5 kW, 4 polos, 60 Hz. Diseño NEMA B.
import * as THREE from 'three';
import * as G from '../core/geo.js';
import { M } from '../core/materials.js';
import { MotorModel } from '../core/model.js';
import * as C from './common.js';

const { V3, TAU } = G;

export const info = {
  id: 'induccion-jaula',
  name: 'Motor de inducción jaula de ardilla',
  short: 'Trifásico TEFC · IEC 132M · 7.5 kW · 4 polos',
  summary:
    'El motor más usado en la industria. El estator recibe la corriente trifásica y crea un campo giratorio; en las barras de aluminio cortocircuitadas del rotor se inducen corrientes que producen el par. Gira con un pequeño deslizamiento respecto a la velocidad síncrona.',
  specs: [
    ['Tipo', 'Asíncrono, rotor en jaula (NEMA diseño B)'],
    ['Potencia', '7.5 kW (10 HP)'],
    ['Tensión', '220/440 V Δ/Y, 60 Hz'],
    ['Velocidad', '1800 r/min síncrona · 1755 r/min nominal'],
    ['Carcasa', 'IEC 132M (H = 132 mm), montaje B3'],
    ['Protección / enfriamiento', 'IP55 / IC411 (TEFC)'],
    ['Ranuras estator / rotor', '36 / 28 (barras inclinadas 1 paso)'],
  ],
};

export function build() {
  const mats = M();
  const m = new MotorModel(info);
  const paint = mats.fundicionAzul;
  const zf = 110; // semilongitud de la carcasa
  const H = 132;

  C.addFrame(m, mats, { Ri: 105, Ro: 116, finR: 132, zf, H, paint, A: 216, B: 178, K: 12, eyeZ: 75 });

  const prof = G.slotProfile({ w0: 3, h0: 0.8, h1: 2, wTop: 6, wBot: 8.5, depth: 22 });
  C.addACStator(m, mats, { Ri: 68, Ro: 105, L: 140, Ns: 36, prof, pitch: 8, overhang: 22, poles: 4, leadsTo: { y: 138, z: -10 }, zLead: 1 });

  // ───── rotor de jaula ─────
  const Rr = 67.6, Lr = 140, nb = 28;
  const skewA = TAU / 36;
  const barPts = (a) => G.teardropPts(a, 63.4, 2.4, 50.5, 1.3, 8);
  const rotorShape = G.circleShape(Rr);
  for (let k = 0; k < nb; k++) rotorShape.holes.push(new THREE.Path(barPts((k * TAU) / nb)));
  rotorShape.holes.push(new THREE.Path(G.shaftHolePts(26, 8, 3.3)));
  const rg = new THREE.ExtrudeGeometry(rotorShape, { depth: Lr, bevelEnabled: false, curveSegments: 96 });
  rg.translate(0, 0, -Lr / 2);
  const rotorCore = G.mesh(G.skew(G.crease(rg, 30), skewA, -Lr / 2, Lr / 2), [mats.chapa, mats.chapaLado]);
  m.part({
    id: 'rotor-nucleo', name: 'Núcleo del rotor (paquete de chapas)', cat: 'Rotor',
    desc: 'Hierro activo del rotor: chapas troqueladas con 28 ranuras cerradas (forma de gota, ver Fig. 4 de troquelados), apiladas con inclinación (skew) de un paso de ranura del estator para reducir ruido magnético y pares parásitos.',
    mat: 'Acero eléctrico Fe-Si 0.5 mm (troquelado junto con el estator)',
    objects: [rotorCore],
    explode: [0, 0, 430],
  });

  const bars = [];
  for (let k = 0; k < nb; k++) bars.push(G.extrude(G.polyShape(barPts((k * TAU) / nb)), -Lr / 2 - 2, Lr / 2 + 2, 1));
  const barsG = G.skew(G.merge(bars), skewA, -Lr / 2, Lr / 2);
  const rings = [];
  for (const s of [1, -1]) {
    rings.push(G.ring(46, 66.6, s > 0 ? Lr / 2 : -Lr / 2 - 14, s > 0 ? Lr / 2 + 14 : -Lr / 2, 96));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const b = G.box(14, 2.6, 13);
      b.translate(57, 0, s * (Lr / 2 + 14 + 6.5));
      b.rotateZ(a);
      rings.push(b);
    }
  }
  m.part({
    id: 'jaula', name: 'Jaula de ardilla (barras + anillos)', cat: 'Rotor',
    desc: 'Devanado secundario del motor: 28 barras sin aislar cortocircuitadas en ambos extremos por anillos. Se funde a presión en una sola pieza junto con las aletas de ventilación interna de los anillos. Las corrientes inducidas en las barras producen el par.',
    mat: 'Aluminio inyectado a presión (Al 99.5 %)',
    objects: [[G.merge([barsG, ...rings]), mats.aluminioFundido]],
    explode: [0, 0, 430],
  });
  const pins = [];
  for (const [s, a] of [[1, 0.4], [1, 2.6], [-1, 1.3], [-1, 4.4]]) {
    pins.push(G.cyl(2.2, 0, 5).translate(54 * Math.cos(a), 54 * Math.sin(a), s * (Lr / 2 + 14) + (s > 0 ? 0 : -5)));
  }
  m.part({
    id: 'balanceo', name: 'Pesos de balanceo', cat: 'Rotor', qty: 4,
    desc: 'Remaches/pesos fijados en los anillos de cortocircuito para el balanceo dinámico del rotor (grado G2.5, ISO 21940).',
    mat: 'Acero / latón',
    objects: [[G.merge(pins), mats.laton]],
    explode: [0, 0, 430],
  });

  // ───── eje ─────
  const prof2 = [
    [0, -208], [13, -208], [14, -207], [14, -155], [18, -155], [20, -153], [20, -122], [23, -122], [24, -118],
    [24, -74], [26, -72], [26, 72], [24, 74], [24, 118], [23, 122], [20, 122], [20, 157], [19, 158], [19, 159], [0, 159],
  ];
  C.addShaft(m, mats, prof2, { explodeZ: 430, keyway: { r: 19, z0: 159, z1: 239, b: 10, t1: 5, h: 8, L: 63 } });
  m.markRotating(['rotor-nucleo', 'jaula', 'balanceo', 'eje', 'chaveta', 'ventilador', 'seguro-ventilador', 'reten-LA']);

  // ───── escudos y rodamientos ─────
  C.addEndShield(m, mats, { s: 1, zf, frameRi: 105, flangeR: 128, bear: { d: 40, D: 90, B: 23, code: '6308-2Z' }, shaftR: 20, paint, side: 'LA', boltR: 120, boltD: 10, explodeZ: 640 });
  C.addEndShield(m, mats, { s: -1, zf, frameRi: 105, flangeR: 128, bear: { d: 40, D: 80, B: 18, code: '6208-2Z' }, shaftR: 20, paint, side: 'LOA', boltR: 120, boltD: 10 });

  const wave = G.merge([G.torus(36, 0.6, TAU, 96, 4).translate(0, 0, -zf - 24.5 + 9 + 1.5)]);
  const wp = wave.attributes.position;
  for (let i = 0; i < wp.count; i++) {
    const a = Math.atan2(wp.getY(i), wp.getX(i));
    wp.setZ(i, wp.getZ(i) + 1.2 * Math.sin(3 * a));
  }
  m.part({
    id: 'arandela-ondulada', name: 'Arandela ondulada de precarga', cat: 'Rodamientos',
    desc: 'Resorte de precarga axial del rodamiento LOA: elimina el juego axial y reduce el ruido de los rodamientos.',
    mat: 'Acero para muelles',
    objects: [[wave, mats.resorteAcero]],
    explode: [0, 0, -300],
  });
  m.part({
    id: 'reten-LA', name: 'Anillo V (V-ring) LA', cat: 'Rodamientos',
    desc: 'Sello rotativo de caucho que gira con el eje y roza contra la tapa exterior, impidiendo la entrada de polvo y agua al rodamiento (IP55).',
    mat: 'Caucho nitrílico NBR',
    objects: [[G.lathe([[19.6, 157.2], [24, 157.2], [27, 161], [25, 162.5], [19.6, 162]], 64), mats.caucho]],
    explode: [0, 0, 330],
  });

  // ───── refrigeración ─────
  C.addFanAndCover(m, mats, { zStart: -166, shaftR: 14, fanR: 110, coverR: 134, coverLen: 100, frameZ: zf, finR: 132, paint });

  // ───── conexiones y accesorios ─────
  C.addTerminalBox(m, mats, {
    y0: 132, z: -10, paint, connection: 'delta', nameplateTitle: 'MOTOR TRIFÁSICO',
    nameplateLines: ['3~ Inducción jaula   IEC 132M  B3', '7.5 kW (10 HP)  60 Hz  4 polos', '220/440 V Δ/Y   26.0/13.0 A', '1755 r/min  cos φ 0.84  η 90.4 %', 'IP55  IC411  Aisl. F (ΔT B)  FS 1.15', 'Diseño NEMA B  Rod. 6308/6208-2Z'],
  });
  C.addEyeBolt(m, mats, 138, 75, 12);
  return m;
}
