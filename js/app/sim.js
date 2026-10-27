// Modelos físicos de cada motor (régimen cuasi-estacionario eléctrico + dinámica mecánica).
// Ecuación mecánica común:  J·dω/dt = Te(ω) − TL(ω) − Tf(ω)
// Todas las magnitudes en SI (V, A, Ω, N·m, rad/s). n [r/min] = 60·ω/2π.

const TAU = Math.PI * 2;
export const rpm = (w) => (w * 60) / TAU;
export const rad = (n) => (n * TAU) / 60;

// ───── aritmética compleja mínima ─────
const C = (re, im = 0) => ({ re, im });
const add = (a, b) => C(a.re + b.re, a.im + b.im);
const mul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const div = (a, b) => {
  const d = b.re * b.re + b.im * b.im;
  return C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
};
const abs = (a) => Math.hypot(a.re, a.im);
const arg = (a) => Math.atan2(a.im, a.re);
const par = (a, b) => div(mul(a, b), add(a, b));

const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');

// Fila de corriente de un conductor: valor, capacidad térmica y % de uso
function coilRow(label, I, area, Jmax, note) {
  const cap = area * Jmax;
  return { label, value: `${fmt(I, 2)} A`, cap: `${fmt(cap, 1)} A`, use: I / cap, note: note || `S = ${fmt(area, 2)} mm² · J = ${fmt(I / area, 2)} A/mm² (máx ${Jmax})` };
}

// ═════════════════════════ máquina de inducción (circuito equivalente) ═════════════════════════
function inductionCircuit(cfg, env, s, Rext = 0) {
  const sa = Math.max(Math.abs(s), 1e-5) * Math.sign(s || 1);
  const R2 = cfg.R2 * (1 + (cfg.deepR || 0) * Math.min(1, Math.abs(s))) + Rext;
  const X2 = env.k * cfg.X2 * (1 - (cfg.deepX || 0) * Math.min(1, Math.abs(s)));
  const Z2 = C(R2 / sa, X2);
  const Zm = C(0, env.k * cfg.Xm);
  const Zin = add(C(cfg.R1, env.k * cfg.X1), par(Zm, Z2));
  const I1 = div(C(env.V), Zin);
  const I2 = mul(I1, div(Zm, add(Zm, Z2)));
  const Pag = 3 * abs(I2) ** 2 * (R2 / sa);
  return { I1, I2, Zin, Te: Pag / env.ws, Pag, R2, pf: Math.cos(arg(Zin)) };
}

function inductionModel(cfg) {
  return {
    kind: 'ac',
    freq: true,
    J: cfg.J,
    hmax: 2e-4,
    Trated: cfg.Trated,
    poles: cfg.p,
    controls: cfg.controls || [],
    env(params) {
      const f = params.f;
      const k = f / 60;
      return { f, k, V: f === 60 ? cfg.V60 : cfg.V50, VL: f === 60 ? cfg.VL60 : cfg.VL50, ws: (2 * TAU * f) / cfg.p, Pfe: cfg.Pfe * Math.pow(k, 1.3), params };
    },
    syncSpeed: (env) => env.ws,
    torque(w, env) {
      const s = (env.ws - w) / env.ws;
      if (Math.abs(s) < 1e-7) return 0;
      return inductionCircuit(cfg, env, s, cfg.rext ? cfg.rext(env.params) : 0).Te;
    },
    friction: (w) => cfg.Tf0 * Math.sign(w) + cfg.kw * w * w,
    report(w, env, TL) {
      const s = (env.ws - w) / env.ws;
      const Rx = cfg.rext ? cfg.rext(env.params) : 0;
      const r = inductionCircuit(cfg, env, Math.abs(s) < 1e-7 ? 1e-7 : s, Rx);
      const I1 = abs(r.I1), I2 = abs(r.I2);
      const Pin = 3 * env.V * I1 * r.pf + env.Pfe;
      const Pout = Math.max(0, TL * w);
      const nS = rpm(env.ws);
      const rows = [
        { h: 'Velocidad' },
        { label: 'Velocidad síncrona  ns = 120·f / p', value: `${fmt(nS, 0)} r/min`, note: `120 × ${env.f} / ${cfg.p}` },
        { label: 'Velocidad del rotor  n = ns·(1 − s)', value: `${fmt(rpm(w), 0)} r/min`, strong: true },
        { label: 'Deslizamiento  s = (ns − n) / ns', value: `${fmt(s * 100, 2)} %` },
        { label: 'Frecuencia rotórica  f₂ = s·f', value: `${fmt(s * env.f, 2)} Hz` },
        { h: 'Par y potencia' },
        { label: 'Par electromagnético  Te = Pag / ωs', value: `${fmt(r.Te, 1)} N·m` },
        { label: 'Par de carga', value: `${fmt(TL, 1)} N·m (${fmt((TL / cfg.Trated) * 100, 0)} % nominal)` },
        { label: 'Potencia de entrehierro  Pag = 3·I₂²·R₂/s', value: `${fmt(r.Pag / 1000, 2)} kW` },
        { label: 'Potencia de entrada', value: `${fmt(Pin / 1000, 2)} kW` },
        { label: 'Potencia útil  P = T·ω', value: `${fmt(Pout / 1000, 2)} kW` },
        { label: 'Rendimiento  η', value: Pin > 0 && Pout > 0 ? `${fmt((Pout / Pin) * 100, 1)} %` : '—' },
        { label: 'Factor de potencia  cos φ', value: fmt(r.pf, 3) },
        { h: 'Corrientes' },
        { label: `Corriente de línea (${env.VL} V, Y)`, value: `${fmt(I1, 2)} A`, strong: true },
        coilRow('Corriente por bobina del estator', I1 / cfg.a, cfg.coilArea, cfg.Jcu, `${cfg.a} rama(s) en paralelo · S = ${fmt(cfg.coilArea, 2)} mm²`),
        ...cfg.rotorRows(I2, s, env, Rx),
      ];
      return { rows, s, I: I1, Te: r.Te };
    },
  };
}

// ───── jaula de ardilla 7.5 kW, 4 polos ─────
const jaula = inductionModel({
  V60: 440 / Math.sqrt(3), V50: 380 / Math.sqrt(3), VL60: 440, VL50: 380,
  R1: 0.62, X1: 1.5, Xm: 38, R2: 0.4, X2: 2.2, deepR: 2.5, deepX: 0.35,
  p: 4, Pfe: 190, Tf0: 0.35, kw: 4e-6, J: 0.04, Trated: 40.8, a: 1, coilArea: 2 * 0.985, Jcu: 7,
  rotorRows(I2, s) {
    const Ibar = I2 * 14.2; // relación de transformación estator→barra (6·N·kw / Qr)
    return [
      coilRow('Corriente por barra de la jaula (aprox.)', Ibar, 58, 5, '28 barras de aluminio · S ≈ 58 mm²'),
      { label: 'Corriente en el anillo de cortocircuito', value: `${fmt(Ibar / (2 * Math.sin(Math.PI * 2 / 28)), 0)} A`, note: 'I_anillo = I_barra / (2·sen(π·p/Qr))' },
    ];
  },
});

// ───── rotor devanado 5.5 kW, 4 polos, con reóstato rotórico ─────
const aRot = (440 / Math.sqrt(3)) / (160 / Math.sqrt(3)); // relación estator/rotor
const devanado = inductionModel({
  V60: 440 / Math.sqrt(3), V50: 380 / Math.sqrt(3), VL60: 440, VL50: 380,
  R1: 0.95, X1: 2.0, Xm: 46, R2: 0.85, X2: 2.4,
  p: 4, Pfe: 160, Tf0: 0.4, kw: 4e-6, J: 0.05, Trated: 30.5, a: 1, coilArea: 1.54, Jcu: 7,
  controls: [{ id: 'rext', label: 'Reóstato rotórico (por fase, lado rotor)', min: 0, max: 2, step: 0.05, value: 0, unit: 'Ω' }],
  rext: (p) => (p.rext || 0) * aRot * aRot,
  rotorRows(I2, s, env, Rx) {
    const Ir = I2 * aRot;
    return [
      coilRow('Corriente por bobina del rotor = corriente en anillos', Ir, 4.5, 6, `Relación a = ${fmt(aRot, 2)} · R ext referida = ${fmt(Rx, 2)} Ω`),
      coilRow('Corriente por escobilla', Ir, 1.6, 12, 'Densidad admisible en escobilla metal-grafito ≈ 12 A/cm² (S = 1.6 cm²)'),
      { label: 'Tensión entre anillos  Er = s·Er0', value: `${fmt(Math.abs(s) * 160, 1)} V` },
    ];
  },
});

// ═════════════════════════ máquina síncrona de polos salientes ═════════════════════════
const syncCfg = {
  V60: 440 / Math.sqrt(3), V50: 380 / Math.sqrt(3), VL60: 440, VL50: 380,
  Xs: 4.5, E0: 330, IfR: 8, Rf: 7.5, p: 6, J: 1.2, Trated: 238.7,
  // circuito del devanado amortiguador (arranque asíncrono)
  R1: 0.2, X1: 0.8, Xm: 30, R2: 0.12, X2: 1.2, deepR: 6, deepX: 0,
  Tf0: 1.5, kw: 2e-5, Pfe: 650,
};
const sincrono = {
  kind: 'ac',
  freq: true,
  sync: true,
  J: syncCfg.J,
  hmax: 2e-4,
  Trated: syncCfg.Trated,
  poles: syncCfg.p,
  controls: [{ id: 'If', label: 'Corriente de excitación If', min: 0, max: 12, step: 0.1, value: 8, unit: 'A' }],
  env(params) {
    const f = params.f, k = f / 60;
    return { f, k, V: f === 60 ? syncCfg.V60 : syncCfg.V50, VL: f === 60 ? syncCfg.VL60 : syncCfg.VL50, ws: (2 * TAU * f) / syncCfg.p, E: syncCfg.E0 * k * (params.If / syncCfg.IfR), Xs: syncCfg.Xs * k, Pfe: syncCfg.Pfe * Math.pow(k, 1.3), params };
  },
  syncSpeed: (env) => env.ws,
  torque(w, env) {
    const s = (env.ws - w) / env.ws;
    if (Math.abs(s) < 1e-7) return 0;
    return inductionCircuit(syncCfg, env, s).Te;
  },
  pullOut: (env) => (3 * env.V * env.E) / env.Xs / env.ws,
  friction: (w) => syncCfg.Tf0 * Math.sign(w) + syncCfg.kw * w * w,
  report(w, env, TL, st) {
    const nS = rpm(env.ws);
    const rows = [{ h: 'Velocidad' }, { label: 'Velocidad síncrona  ns = 120·f / p', value: `${fmt(nS, 0)} r/min`, note: `120 × ${env.f} / ${syncCfg.p}` }];
    let I, pf, Te, lead = '';
    const Tm = TL + this.friction(w);
    if (st.locked) {
      const P = Tm * env.ws;
      const sd = (P * env.Xs) / (3 * env.V * env.E);
      const d = Math.asin(Math.max(-1, Math.min(1, sd)));
      // I = (V − E∠−δ) / jXs
      const Iph = div(add(C(env.V), C(-env.E * Math.cos(-d), -env.E * Math.sin(-d))), C(0, env.Xs));
      I = abs(Iph);
      const phi = arg(Iph);
      pf = Math.cos(phi);
      lead = phi > 0.001 ? ' (adelanto, sobreexcitado)' : phi < -0.001 ? ' (atraso, subexcitado)' : ' (unitario)';
      Te = Tm;
      rows.push(
        { label: 'Velocidad del rotor', value: `${fmt(rpm(w), 0)} r/min — en sincronismo`, strong: true },
        { label: 'Ángulo de carga  δ = asen(P·Xs / 3·V·E)', value: `${fmt((d * 180) / Math.PI, 1)}°` },
      );
    } else {
      const s = (env.ws - w) / env.ws;
      const r = inductionCircuit(syncCfg, env, Math.abs(s) < 1e-7 ? 1e-7 : s);
      I = abs(r.I1);
      pf = r.pf;
      Te = r.Te;
      rows.push(
        { label: 'Velocidad del rotor', value: `${fmt(rpm(w), 0)} r/min — arranque asíncrono`, strong: true },
        { label: 'Deslizamiento', value: `${fmt(s * 100, 2)} %` },
        { label: 'Corriente en barras amortiguadoras', value: `${fmt(abs(r.I2) * 9, 0)} A`, note: 'Solo circula fuera de sincronismo' },
      );
    }
    const Pmax = (3 * env.V * env.E) / env.Xs;
    const Pcu = st.locked ? 3 * I * I * syncCfg.R1 : 0; // fuera de sincronismo ya está en 3·V·I·cosφ
    const Pin = (st.locked ? Te * env.ws + Pcu : 3 * env.V * I * pf) + env.Pfe + env.params.If ** 2 * syncCfg.Rf;
    const Pout = Math.max(0, TL * w);
    rows.push(
      { h: 'Par y potencia' },
      { label: 'Par de carga', value: `${fmt(TL, 1)} N·m (${fmt((TL / syncCfg.Trated) * 100, 0)} % nominal)` },
      { label: 'f.e.m. interna  E ∝ f·If', value: `${fmt(env.E, 0)} V por fase` },
      { label: 'Potencia máxima  Pmax = 3·V·E / Xs', value: `${fmt(Pmax / 1000, 1)} kW (par de desenganche ${fmt(Pmax / env.ws, 0)} N·m)` },
      { label: 'Potencia útil', value: `${fmt(Pout / 1000, 2)} kW` },
      { label: 'Rendimiento  η', value: Pin > 0 && Pout > 0 ? `${fmt((Pout / Pin) * 100, 1)} %` : '—' },
      { label: 'Factor de potencia', value: fmt(Math.abs(pf), 3) + lead },
      { h: 'Corrientes' },
      { label: `Corriente de línea (${env.VL} V, Y)`, value: `${fmt(I, 2)} A`, strong: true },
      coilRow('Corriente por bobina del estator', I / 2, 2 * 2.0, 6, '2 ramas en paralelo · S = 4 mm²'),
      coilRow('Corriente por bobina de campo (CC)', env.params.If, 2.5, 4, `6 bobinas en serie · Vf = If·Rf = ${fmt(env.params.If * syncCfg.Rf, 1)} V`),
    );
    return { rows, I, Te };
  },
};

// ═════════════════════════ CC compound con arrancador ═════════════════════════
const dcCfg = { V: 440, Ra: 0.55, Rs: 0.05, Vb: 2, ksh: 1.829, kse: 0.002, Rf: 367, IaR: 36.8, J: 0.35, Trated: 81.8, Tf0: 0.9, kw: 3e-6 };
function dcArmature(w, If) {
  const Rmin = dcCfg.Ra + dcCfg.Rs;
  let Ia = (dcCfg.V - dcCfg.Vb - dcCfg.ksh * If * w) / (Rmin + dcCfg.kse * w);
  let Rst = 0;
  const Ilim = 2 * dcCfg.IaR;
  if (Ia > Ilim) {
    // arrancador ideal: inserta la resistencia justa para limitar Ia a 2·Ia nominal
    Ia = Ilim;
    const E = (dcCfg.ksh * If + dcCfg.kse * Ia) * w;
    Rst = (dcCfg.V - dcCfg.Vb - E) / Ia - Rmin;
  }
  const kphi = dcCfg.ksh * If + dcCfg.kse * Math.max(0, Ia);
  return { Ia, kphi, Te: kphi * Ia, E: kphi * w, Rst };
}
const ccCampo = {
  kind: 'dc',
  freq: false,
  J: dcCfg.J,
  hmax: 1e-3,
  Trated: dcCfg.Trated,
  poles: 4,
  controls: [{ id: 'If', label: 'Corriente de campo derivación If (reóstato de campo)', min: 0.6, max: 1.3, step: 0.01, value: 1.2, unit: 'A' }],
  env: (params) => ({ params, ws: dcCfg.V / (dcCfg.ksh * params.If) }),
  syncSpeed: (env) => env.ws,
  torque: (w, env) => dcArmature(w, env.params.If).Te,
  friction: (w) => dcCfg.Tf0 * Math.sign(w) + dcCfg.kw * w * w,
  report(w, env, TL) {
    const If = env.params.If;
    const a = dcArmature(w, If);
    const IL = a.Ia + If;
    const Pin = dcCfg.V * IL;
    const Pout = Math.max(0, TL * w);
    const rows = [
      { h: 'Velocidad' },
      { label: 'Velocidad en vacío  n₀ ≈ V / (k·Φsh)', value: `${fmt(rpm(env.ws), 0)} r/min` },
      { label: 'Velocidad  n = (V − Ia·(Ra+Rs) − 2Vb) / k·Φ', value: `${fmt(rpm(w), 0)} r/min`, strong: true },
      { label: 'f.c.e.m.  Eb = k·Φ·ω', value: `${fmt(a.E, 1)} V` },
      { label: 'Flujo  k·Φ = ksh·If + kse·Ia', value: `${fmt(a.kphi, 3)} V·s` },
      { label: 'Resistencia del arrancador insertada', value: a.Rst > 0.001 ? `${fmt(a.Rst, 2)} Ω (arrancando)` : '0 Ω (cortocircuitada)' },
      { label: 'Reóstato de campo  Rrh = V/If − Rf', value: `${fmt(Math.max(0, dcCfg.V / If - dcCfg.Rf), 0)} Ω` },
      { h: 'Par y potencia' },
      { label: 'Par  T = k·Φ·Ia', value: `${fmt(a.Te, 1)} N·m` },
      { label: 'Par de carga', value: `${fmt(TL, 1)} N·m (${fmt((TL / dcCfg.Trated) * 100, 0)} % nominal)` },
      { label: 'Potencia absorbida  P = V·IL', value: `${fmt(Pin / 1000, 2)} kW` },
      { label: 'Potencia útil', value: `${fmt(Pout / 1000, 2)} kW` },
      { label: 'Rendimiento  η', value: Pout > 0 ? `${fmt((Pout / Pin) * 100, 1)} %` : '—' },
      { h: 'Corrientes' },
      { label: 'Corriente de línea  IL = Ia + If', value: `${fmt(IL, 2)} A`, strong: true },
      coilRow('Corriente por bobina del inducido  Ia / 2a', a.Ia / 4, 2.24, 6, 'Imbricado: 2a = 4 trayectorias en paralelo'),
      coilRow('Bobina de campo derivación', If, 0.5, 3.5, '4 bobinas en serie · hilo Ø0.8 mm'),
      coilRow('Bobina de campo serie (= Ia)', a.Ia, 16, 3.5, 'Pletina 2 × 8 mm'),
      coilRow('Bobina de polo de conmutación (= Ia)', a.Ia, 16, 3.5, 'Pletina 2 × 8 mm, en serie con el inducido'),
      coilRow('Corriente por escobilla  Ia / 4', a.Ia / 4, 1.92, 10, '8 escobillas, 2 por brazo · S = 1.92 cm², 10 A/cm²'),
    ];
    return { rows, I: IL, Te: a.Te };
  },
};

// ═════════════════════════ CC de imán permanente ═════════════════════════
const pm = { K: 0.022, R: 0.9, J: 3e-6, Trated: 0.07, Tf0: 0.004, kw: 1.5e-9 };
const ccIman = {
  kind: 'dc',
  freq: false,
  J: pm.J,
  hmax: 2e-5,
  Trated: pm.Trated,
  poles: 2,
  controls: [{ id: 'V', label: 'Tensión aplicada (PWM)', min: 0, max: 12, step: 0.1, value: 12, unit: 'V' }],
  env: (params) => ({ params, ws: params.V / pm.K }),
  syncSpeed: (env) => Math.max(env.ws, 1),
  torque: (w, env) => (pm.K * (env.params.V - pm.K * w)) / pm.R,
  friction: (w) => pm.Tf0 * Math.sign(w) + pm.kw * w * w,
  report(w, env, TL) {
    const V = env.params.V;
    const I = (V - pm.K * w) / pm.R;
    const Pin = V * I, Pout = Math.max(0, TL * w);
    const rows = [
      { h: 'Velocidad' },
      { label: 'Velocidad en vacío ideal  n₀ = V / Ke', value: `${fmt(rpm(V / pm.K), 0)} r/min` },
      { label: 'Velocidad  n = (V − I·R) / Ke', value: `${fmt(rpm(w), 0)} r/min`, strong: true },
      { label: 'f.c.e.m.  Eb = Ke·ω', value: `${fmt(pm.K * w, 2)} V`, note: `Ke = Kt = ${pm.K} V·s/rad (flujo de imanes constante)` },
      { h: 'Par y potencia' },
      { label: 'Par  T = Kt·I', value: `${fmt(pm.K * I * 1000, 1)} mN·m` },
      { label: 'Par de arranque  Tarr = Kt·V / R', value: `${fmt(((pm.K * V) / pm.R) * 1000, 0)} mN·m` },
      { label: 'Par de carga', value: `${fmt(TL * 1000, 1)} mN·m (${fmt((TL / pm.Trated) * 100, 0)} % nominal)` },
      { label: 'Potencia absorbida / útil', value: `${fmt(Pin, 1)} W / ${fmt(Pout, 1)} W` },
      { label: 'Rendimiento  η', value: Pout > 0 && Pin > 0 ? `${fmt((Pout / Pin) * 100, 1)} %` : '—' },
      { h: 'Corrientes' },
      { label: 'Corriente del inducido', value: `${fmt(I, 2)} A`, strong: true },
      coilRow('Corriente por bobina  I / 2', I / 2, 0.196, 10, '2 trayectorias en paralelo · alambre Ø0.5 mm'),
      { label: 'Frecuencia de red', value: 'No aplica (alimentación en CC)' },
    ];
    return { rows, I, Te: pm.K * I };
  },
};

// ═════════════════════════ BLDC (conmutación de 6 pasos) ═════════════════════════
const bl = { Ke: 0.13, R: 0.25, Vbus: 48, Ilim: 25, J: 1.5e-4, Trated: 1.27, Tf0: 0.02, kw: 2e-8, pp: 4 };
const bldc = {
  kind: 'dc',
  freq: false,
  J: bl.J,
  hmax: 1e-4,
  Trated: bl.Trated,
  poles: 8,
  controls: [{ id: 'duty', label: 'Ciclo de trabajo PWM del inversor', min: 0, max: 100, step: 1, value: 92, unit: '%' }],
  env: (params) => ({ params, ws: ((params.duty / 100) * bl.Vbus) / bl.Ke }),
  syncSpeed: (env) => Math.max(env.ws, 1),
  current(w, env) {
    const V = (env.params.duty / 100) * bl.Vbus;
    return Math.max(-bl.Ilim, Math.min(bl.Ilim, (V - bl.Ke * w) / bl.R));
  },
  torque(w, env) {
    return bl.Ke * this.current(w, env);
  },
  friction: (w) => bl.Tf0 * Math.sign(w) + bl.kw * w * w,
  report(w, env, TL) {
    const V = (env.params.duty / 100) * bl.Vbus;
    const I = this.current(w, env);
    const n = rpm(w);
    const fe = (bl.pp * n) / 60;
    const Pin = V * I, Pout = Math.max(0, TL * w);
    const rows = [
      { h: 'Velocidad' },
      { label: 'Tensión media aplicada  V = D·Vbus', value: `${fmt(V, 1)} V` },
      { label: 'Velocidad  n = (V − I·R) / Ke', value: `${fmt(n, 0)} r/min`, strong: true },
      { label: 'Frecuencia eléctrica  fe = p·n / 120', value: `${fmt(fe, 1)} Hz`, note: '8 polos → 4 pares de polos' },
      { label: 'Conmutaciones por segundo  6·fe', value: `${fmt(6 * fe, 0)} /s` },
      { label: 'f.c.e.m. de línea  E = Ke·ω', value: `${fmt(bl.Ke * w, 1)} V` },
      { h: 'Par y potencia' },
      { label: 'Par  T = Kt·I', value: `${fmt(bl.Ke * I, 2)} N·m` },
      { label: 'Par de carga', value: `${fmt(TL, 2)} N·m (${fmt((TL / bl.Trated) * 100, 0)} % nominal)` },
      { label: 'Potencia absorbida / útil', value: `${fmt(Pin, 0)} W / ${fmt(Pout, 0)} W` },
      { label: 'Rendimiento  η', value: Pout > 0 && Pin > 0 ? `${fmt((Pout / Pin) * 100, 1)} %` : '—' },
      { h: 'Corrientes' },
      { label: 'Corriente de fase (2 fases conducen)', value: `${fmt(I, 2)} A${Math.abs(I) >= bl.Ilim - 0.01 ? ' — limitada por el controlador' : ''}`, strong: true },
      coilRow('Corriente por bobina (4 bobinas en serie por fase)', Math.abs(I), 1.91, 6, '3 hilos Ø0.9 mm en paralelo'),
      { label: 'Frecuencia de red', value: 'No aplica: el inversor genera fe' },
    ];
    return { rows, I, Te: bl.Ke * I };
  },
};

export const SIMS = {
  'induccion-jaula': jaula,
  'induccion-rotor-devanado': devanado,
  'sincrono-polos-salientes': sincrono,
  'cc-campo-devanado': ccCampo,
  'cc-iman-permanente': ccIman,
  bldc,
};

jaula.desc = 'circuito equivalente por fase (R₁, X₁, Xm, R₂/s, X₂) con efecto de barra profunda; J = 0.04 kg·m².';
devanado.desc = 'circuito equivalente por fase con resistencia externa rotórica referida al estator (R₂ + a²·Rext); J = 0.05 kg·m².';
sincrono.desc = 'arranque asíncrono por el devanado amortiguador y, en sincronismo, P = 3·V·E·sen δ / Xs; J = 1.2 kg·m².';
ccCampo.desc = 'Eb = k·Φ·ω, Ia = (V − Eb − 2Vb)/(Ra+Rs), Φ = Φsh + Φse (compound aditivo) y arrancador que limita Ia a 2·In; J = 0.35 kg·m².';
ccIman.desc = 'V = I·R + Ke·ω, T = Kt·I con flujo constante de los imanes; J = 3·10⁻⁶ kg·m².';
bldc.desc = 'conmutación trapezoidal de 6 pasos: V = D·Vbus = I·R + Ke·ω, límite de corriente del controlador 25 A; J = 1.5·10⁻⁴ kg·m².';

// ═════════════════════════ integrador dinámico ═════════════════════════
export class Simulator {
  constructor(model) {
    this.m = model;
    this.params = { f: 60, load: 0, loadType: 'const' };
    for (const c of model.controls) this.params[c.id] = c.value;
    this.w = 0;
    this.t = 0;
    this.on = false;
    this.locked = false;
    this.trace = [];
    this.refresh();
  }
  refresh() {
    this.env = this.m.env(this.params);
  }
  loadTorque(w) {
    const T = this.params.load * this.m.Trated;
    if (this.params.loadType === 'quad') {
      const wr = this.m.syncSpeed(this.env) || 1;
      return T * Math.min(1.5, (w / wr) ** 2);
    }
    return w > 1e-3 || this.on ? T : 0;
  }
  start() {
    this.on = true;
    this.t = 0;
    this.trace = [];
  }
  stop() {
    this.on = false;
    this.locked = false;
  }
  // avanza dtPhys segundos de tiempo físico
  step(dtPhys) {
    const m = this.m;
    let left = dtPhys;
    while (left > 1e-12) {
      const h = Math.min(left, m.hmax);
      left -= h;
      const w = this.w;
      const TL = this.loadTorque(w);
      const Tf = m.friction(w);
      if (m.sync && this.on) {
        const ws = this.env.ws;
        if (this.locked) {
          if (TL + Tf > m.pullOut(this.env) || this.params.If <= 0.05) this.locked = false;
          else {
            this.w = ws;
            continue;
          }
        } else if (Math.abs(ws - w) / ws < 0.05 && this.params.If > 0.05 && TL + Tf < m.pullOut(this.env) * 0.9) {
          this.locked = true; // enganche (pull-in)
          this.w = ws;
          continue;
        }
      }
      const Te = this.on ? m.torque(w, this.env) : 0;
      let acc = (Te - TL - Tf) / m.J;
      let wn = w + acc * h;
      // la carga y la fricción no hacen girar el eje hacia atrás
      if (!this.on && wn < 0) wn = 0;
      if (this.on && w >= 0 && wn < 0 && Te < TL + Tf) wn = 0;
      this.w = wn;
    }
    this.t += dtPhys;
    if (this.on || this.w > 0) {
      if (!this.trace.length || this.t - this.trace[this.trace.length - 1][0] > 0.002) this.trace.push([this.t, rpm(this.w)]);
      if (this.trace.length > 1500) this.trace.splice(0, this.trace.length - 1500);
    }
  }
  report() {
    return this.m.report(this.w, this.env, this.loadTorque(this.w), { locked: this.locked });
  }
}
