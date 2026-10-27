// Motor de inducción trifásico de rotor devanado (anillos rozantes), carcasa IEC 132.
// El rotor lleva un devanado trifásico en estrella cuyos extremos salen a tres anillos rozantes;
// a través de escobillas se conecta un reóstato externo para el arranque y control de velocidad.
import * as THREE from 'three';
import * as G from '../core/geo.js';
import { M } from '../core/materials.js';
import { MotorModel } from '../core/model.js';
import * as C from './common.js';

const { V3, TAU } = G;
const UP = new V3(0, 1, 0);

export const info = {
  id: 'induccion-rotor-devanado',
  name: 'Motor de inducción de rotor devanado',
  short: 'Trifásico · anillos rozantes · 5.5 kW · 4 polos',
  summary:
    'El rotor no es una jaula sino un devanado trifásico aislado, conectado en estrella, cuyos tres extremos llegan a anillos rozantes. Con escobillas se inserta resistencia externa en el rotor: alto par de arranque con baja corriente y control de deslizamiento.',
  specs: [
    ['Tipo', 'Asíncrono, rotor bobinado (anillos rozantes)'],
    ['Potencia', '5.5 kW'],
    ['Estator', '440 V Y, 60 Hz, 36 ranuras'],
    ['Rotor', '24 ranuras semicerradas, devanado en Y, 3 anillos K-L-M'],
    ['Tensión de rotor a rotor bloqueado', '≈ 160 V entre anillos'],
    ['Arranque', 'Reóstato rotórico (curva 2, Fig. 3 NEMA)'],
    ['Aplicaciones', 'Grúas, malacates, transportadores, molinos'],
  ],
};

export function build() {
  const mats = M();
  const m = new MotorModel(info);
  const paint = mats.fundicionVerde;
  const zf = 110;

  C.addFrame(m, mats, { Ri: 105, Ro: 116, finR: 132, zf, H: 132, paint, A: 216, B: 178, K: 12, eyeZ: 75 });
  const prof = G.slotProfile({ w0: 3, h0: 0.8, h1: 2, wTop: 6, wBot: 8.5, depth: 22 });
  C.addACStator(m, mats, { Ri: 68, Ro: 105, L: 140, Ns: 36, prof, pitch: 8, overhang: 22, poles: 4, leadsTo: { y: 138, z: -10 }, zLead: 1 });

  // ───── rotor bobinado ─────
  const Rr = 67.5, Lr = 140, Nr = 24;
  const rp = G.slotProfile({ w0: 2.2, h0: 1, h1: 1.6, wTop: 6.4, wBot: 4.6, depth: 19 });
  const outer = new THREE.Shape(G.slottedCirclePts(Rr, Nr, rp, true, 0, 6));
  outer.holes.push(new THREE.Path(G.shaftHolePts(26, 8, 3.3)));
  // agujeros axiales de ventilación del rotor
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * TAU;
    outer.holes.push(G.circlePath(5, 16, true, 37 * Math.cos(a), 37 * Math.sin(a)));
  }
  m.part({
    id: 'rotor-nucleo', name: 'Núcleo del rotor (paquete de chapas)', cat: 'Rotor',
    desc: 'Chapas magnéticas con 24 ranuras semicerradas que alojan el devanado trifásico del rotor y 8 canales axiales de ventilación.',
    mat: 'Acero eléctrico Fe-Si 0.5 mm',
    objects: [G.lamStack(outer, -Lr / 2, Lr / 2, mats.chapa, mats.chapaLado, 64)],
    explode: [0, 0, 430],
  });
  const depth = rp[rp.length - 1][0];
  const liner = [], wedges = [], cu = [];
  for (let k = 0; k < Nr; k++) {
    const a = (k * TAU) / Nr;
    const o = G.polyShape(G.slotRegionPts(Rr, a, rp, 2.7, depth - 0.1, 0, true));
    o.holes.push(G.polyPath(G.slotRegionPts(Rr, a, rp, 3.1, depth - 0.5, 0.4, true).reverse()));
    liner.push(G.extrude(o, -Lr / 2 - 4, Lr / 2 + 4, 2));
    wedges.push(G.extrude(G.polyShape(G.slotRegionPts(Rr, a, rp, 2.65, 4.4, 0.15, true)), -Lr / 2 - 2, Lr / 2 + 2, 2));
    const mid = (4.6 + depth - 0.6) / 2;
    cu.push(G.extrude(G.polyShape(G.slotRegionPts(Rr, a, rp, 4.6, mid - 0.4, 0.55, true, 4)), -Lr / 2 - 1, Lr / 2 + 1, 2));
    cu.push(G.extrude(G.polyShape(G.slotRegionPts(Rr, a, rp, mid + 0.4, depth - 0.7, 0.55, true, 6)), -Lr / 2 - 1, Lr / 2 + 1, 2));
  }
  const rT = Rr - 8.5, rB = Rr - 15.5;
  const ends = [];
  for (const dir of [1, -1]) {
    for (let k = 0; k < Nr; k++) ends.push(G.endTurn(rT, (k * TAU) / Nr, rB, ((k + 6) * TAU) / Nr, dir * Lr / 2, 5, 18, rB - 4, 2.9, dir, 24));
  }
  m.part({
    id: 'rotor-devanado', name: 'Devanado trifásico del rotor', cat: 'Rotor',
    desc: 'Devanado secundario aislado de doble capa (paso 6/6, conexión en estrella). Sus tres fases salen a los anillos rozantes, lo que permite intercalar resistencias externas durante el arranque.',
    mat: 'Cobre esmaltado / pletina de cobre con cinta de mica-vidrio, clase F',
    objects: [[G.merge(cu), mats.cobre], [G.merge(ends), mats.cobreEsmalte]],
    explode: [0, 0, 430],
  });
  m.part({
    id: 'rotor-aislamiento', name: 'Aislamiento y cuñas de ranura del rotor', cat: 'Rotor', qty: 48,
    desc: 'Aislamiento a tierra de las ranuras y cuñas de cierre que retienen las bobinas contra la fuerza centrífuga.',
    mat: 'Nomex-Mylar (NMN) / cuñas de vidrio-epoxi',
    objects: [[G.merge(liner), mats.nomex], [G.merge(wedges), mats.cunaRanura]],
    explode: [0, 0, 430],
  });
  const bands = [];
  for (const dir of [1, -1]) {
    for (const off of [8, 14, 20]) bands.push(G.ring(rT + 2.6, rT + 4.4, dir * (Lr / 2 + off) - 2, dir * (Lr / 2 + off) + 2, 96));
    bands.push(G.ring(rB - 9, rB - 5, dir > 0 ? Lr / 2 + 2 : -Lr / 2 - 26, dir > 0 ? Lr / 2 + 26 : -Lr / 2 - 2, 64));
  }
  m.part({
    id: 'zunchos', name: 'Zunchos y anillos soporte de cabezas', cat: 'Rotor', qty: 8,
    desc: 'Bandas de alambre de acero (o fibra de vidrio) que sujetan las cabezas de bobina del rotor contra la fuerza centrífuga, y anillos soporte interiores.',
    mat: 'Alambre de acero estañado / cinta de vidrio-poliéster',
    objects: [[G.merge(bands), mats.zincado]],
    explode: [0, 0, 430],
  });

  // ventilador interno (LA)
  const fan = G.radialFan({ rHub: 30, rOut: 62, bore: 48, nBlades: 9, z0: 98, z1: 110, hubLen: 14, bladeT: 3, disc: true });
  m.part({
    id: 'ventilador-interno', name: 'Ventilador interno', cat: 'Refrigeración',
    desc: 'Hace circular el aire interior a través de los canales axiales del rotor y de las cabezas de bobina.',
    mat: 'Aluminio fundido',
    objects: [[fan, mats.aluminioFundido]],
    explode: [0, 0, 430],
  });

  // ───── eje con conductos para las salidas del rotor ─────
  const prof2 = [
    [0, -232], [19, -232], [20, -231], [20, -122], [23, -122], [24, -118], [24, -74], [26, -72], [26, 72], [24, 74], [24, 96],
    [24, 118], [23, 122], [20, 122], [20, 157], [19, 158], [19, 159], [0, 159],
  ];
  C.addShaft(m, mats, prof2, { explodeZ: 430, keyway: { r: 19, z0: 159, z1: 239, b: 10, t1: 5, h: 8, L: 63 } });

  // salidas del devanado hacia los anillos (por el agujero del eje)
  const leads = [];
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 2 + (i * TAU) / 3;
    const rr = 8;
    const zr = -176 - i * 16;
    leads.push(G.tubeThrough([
      G.polar(rB, a, -Lr / 2 - 16), G.polar(32, a, -Lr / 2 - 22), G.polar(rr, a, -Lr / 2 - 30), G.polar(rr, a, -150),
      G.polar(rr, a, zr + 6), G.polar(24, a, zr + 2), G.polar(31, a, zr),
    ], 2.2, 60));
  }
  m.part({
    id: 'salidas-rotor', name: 'Conductores de salida del rotor', cat: 'Rotor', qty: 3,
    desc: 'Llevan las tres fases del devanado rotórico por el interior hueco del eje hasta cada anillo rozante.',
    mat: 'Cable de cobre con aislamiento de silicona',
    objects: [[G.merge(leads), mats.cableRojo]],
    explode: [0, 0, 430],
  });

  // anillos rozantes
  const sleeve = G.ring(20, 29, -222, -162, 64);
  const rings = [], barriers = [], studs = [];
  for (let i = 0; i < 3; i++) {
    const zc = -176 - i * 16;
    rings.push(G.lathe([[29, zc - 5], [41.5, zc - 5], [42, zc - 4.5], [42, zc + 4.5], [41.5, zc + 5], [29, zc + 5]], 96));
    for (let j = 0; j < 3; j++) {
      const a = (j / 3) * TAU + i * 0.5;
      studs.push(G.cyl(1.6, zc, zc + 46 + i * 16).translate(26 * Math.cos(a), 26 * Math.sin(a), 0));
    }
  }
  for (const zb of [-166, -184, -200, -218]) barriers.push(G.ring(29, 36, zb - 1.5, zb + 1.5, 64));
  m.part({
    id: 'anillos-rozantes', name: 'Anillos rozantes K-L-M', cat: 'Escobillas y anillos', qty: 3,
    desc: 'Tres anillos metálicos aislados entre sí y del eje, cada uno unido a una fase del rotor. Las escobillas deslizan sobre ellos para conectar el reóstato externo.',
    mat: 'Bronce fosforoso / acero inoxidable',
    objects: [[G.merge(rings), mats.bronce]],
    explode: [0, 0, -360],
  });
  m.part({
    id: 'buje-anillos', name: 'Buje aislante y separadores de anillos', cat: 'Escobillas y anillos',
    desc: 'Casquillo moldeado que aísla los anillos del eje; las barreras evitan arcos entre anillos.',
    mat: 'Resina epoxi con fibra de vidrio / mica',
    objects: [[G.merge([sleeve, ...barriers]), mats.baquelita], [G.merge(studs), mats.cobreDesnudo]],
    explode: [0, 0, -330],
  });

  // portaescobillas con escobillas, resortes y conductores flexibles
  const holders = [], brushes = [], springs = [], pig = [];
  const bar = G.box(14, 10, 92, 0, 86, -192);
  const arm = G.box(10, 10, 26, 0, 88, -134);
  for (let i = 0; i < 3; i++) {
    const zc = -176 - i * 16;
    const hb = G.merge([G.box(2, 22, 12, -8.5, 0, 0), G.box(2, 22, 12, 8.5, 0, 0), G.box(19, 2, 12, 0, 11, 0)]);
    holders.push(hb.clone().translate(0, 60, zc), G.box(8, 18, 8, 0, 75, zc));
    brushes.push(G.box(14.4, 20, 9.4, 0, 52.5, zc));
    springs.push(G.helix(3.4, 1.4, 6, 0.6).rotateX(-Math.PI / 2).translate(0, 62.5, zc));
    pig.push(G.tubeThrough([[3, 62, zc], [10, 70, zc + 2], [12, 79, zc - 1], [6, 82, zc - 3]], 1.1, 20));
  }
  m.part({
    id: 'portaescobillas', name: 'Portaescobillas y barra soporte', cat: 'Escobillas y anillos',
    desc: 'Cajas guía de latón que posicionan cada escobilla sobre su anillo, montadas en una barra aislada sujeta al escudo LOA.',
    mat: 'Latón fundido / barra de resina aislante',
    objects: [[G.merge(holders), mats.laton], [G.merge([bar, arm]), mats.baquelita]],
    explode: [0, 220, -330],
  });
  m.part({
    id: 'escobillas', name: 'Escobillas', cat: 'Escobillas y anillos', qty: 3,
    desc: 'Contactos deslizantes que aseguran la conexión eléctrica entre los anillos que giran y el circuito externo fijo.',
    mat: 'Grafito metalizado (cobre-grafito)',
    objects: [[G.merge(brushes), mats.carbon]],
    explode: [0, 260, -330],
  });
  m.part({
    id: 'resortes-escobillas', name: 'Resortes de presión', cat: 'Escobillas y anillos', qty: 3,
    desc: 'Mantienen una presión constante (≈ 15–20 kPa) de la escobilla sobre el anillo.',
    mat: 'Acero inoxidable para resortes',
    objects: [[G.merge(springs), mats.resorteAcero], [G.merge(pig), mats.cobreDesnudo]],
    explode: [0, 300, -330],
  });

  // escudos y rodamientos
  C.addEndShield(m, mats, { s: 1, zf, frameRi: 105, flangeR: 128, bear: { d: 40, D: 90, B: 23, code: '6308-2Z' }, shaftR: 20, paint, side: 'LA', boltR: 120, boltD: 10, explodeZ: 640 });
  C.addEndShield(m, mats, { s: -1, zf, frameRi: 105, flangeR: 128, bear: { d: 40, D: 80, B: 18, code: '6208-2Z' }, shaftR: 20, paint, side: 'LOA', boltR: 120, boltD: 10, explodeZ: 220 });

  // cubierta de anillos rozantes con caja de bornes del rotor
  const cover = G.merge([
    G.ring(118, 121, -250, -128, 128), G.ring(100, 121, -128, -122, 128),
    G.perforatedDisc(121, 4, 11, 2, -253, 30),
    G.box(70, 8, 60, 0, 124, -190),
  ]);
  m.part({
    id: 'cubierta-anillos', name: 'Cubierta de anillos rozantes', cat: 'Carcasa y estructura',
    desc: 'Envolvente que protege anillos y escobillas, recoge el polvo de carbón y permite la inspección del desgaste de escobillas.',
    mat: 'Chapa de acero pintada',
    objects: [[cover, paint]],
    explode: [0, 0, -620],
  });
  const kbox = G.merge([G.box(70, 40, 60, 0, 148, -190)]);
  const kstuds = [];
  for (let i = 0; i < 3; i++) kstuds.push(G.stud(5, 12).rotateX(-Math.PI / 2).translate((i - 1) * 18, 168, -190));
  m.part({
    id: 'bornes-rotor', name: 'Caja de bornes del rotor (K-L-M)', cat: 'Conexiones', qty: 3,
    desc: 'Bornes de salida del circuito rotórico hacia el reóstato de arranque externo.',
    mat: 'Fundición de aluminio / bornes de latón',
    objects: [[kbox, paint], [G.merge(kstuds), mats.laton]],
    explode: [0, 200, -620],
  });

  C.addTerminalBox(m, mats, {
    y0: 132, z: -10, paint, connection: 'star', nameplateTitle: 'MOTOR ROTOR DEVANADO',
    nameplateLines: ['3~ Inducción rotor bobinado  IEC 132', '5.5 kW  60 Hz  4 polos  1720 r/min', 'Estator 440 V Y   10.4 A', 'Rotor 160 V   22 A  (K-L-M)', 'IP54  Aisl. F  Servicio S3 40 %', 'Rod. 6308-2Z / 6208-2Z'],
  });
  C.addEyeBolt(m, mats, 138, 75, 12);

  m.markRotating(['rotor-nucleo', 'rotor-devanado', 'rotor-aislamiento', 'zunchos', 'ventilador-interno', 'eje', 'chaveta', 'salidas-rotor', 'anillos-rozantes', 'buje-anillos']);
  return m;
}
