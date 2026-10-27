// Panel de simulación: controles, lecturas, tabla de cálculos y gráficas par–velocidad / velocidad–tiempo.
import { Simulator, rpm } from './sim.js';

export const TIME_SCALES = [
  { v: 1, label: 'Tiempo real (×1)' },
  { v: 0.25, label: 'Cámara lenta ×1/4' },
  { v: 0.1, label: 'Cámara lenta ×1/10' },
  { v: 0.05, label: 'Cámara lenta ×1/20' },
  { v: 0.02, label: 'Cámara lenta ×1/50' },
  { v: 0.01, label: 'Cámara lenta ×1/100' },
];

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function createSimPanel(root, model, motorInfo) {
  const sim = new Simulator(model);
  const ui = { timeScale: 0.02 };
  const isAC = model.freq;
  const ctl = model.controls
    .map(
      (c) => `
      <div class="sim-field">
        <label>${c.label} <b data-out="${c.id}">${c.value} ${c.unit}</b></label>
        <input type="range" data-ctl="${c.id}" min="${c.min}" max="${c.max}" step="${c.step}" value="${c.value}" />
      </div>`,
    )
    .join('');
  root.innerHTML = `
    <div class="sim-run">
      <button class="run" data-act="start">▶ Arrancar</button>
      <button class="stop" data-act="stop">■ Parar</button>
      <span class="sim-state" data-out="state">Detenido</span>
    </div>
    <div class="sim-gauges">
      <div><span data-out="n">0</span><small>r/min</small></div>
      <div><span data-out="I">0.0</span><small>A línea</small></div>
      <div><span data-out="T">0.0</span><small>${model.Trated < 1 ? 'mN·m' : 'N·m'}</small></div>
    </div>
    <div class="sim-field">
      <label>Frecuencia de alimentación</label>
      <div class="seg" ${isAC ? '' : 'data-off'}>
        <button data-f="50">50 Hz</button><button data-f="60" class="on">60 Hz</button>
      </div>
      ${isAC ? '<p class="note">50 Hz → 380 V · 60 Hz → 440 V (V/f constante)</p>' : '<p class="note">Motor de corriente continua: la frecuencia de red no aplica.</p>'}
    </div>
    <div class="sim-field">
      <label>Carga en el eje <b data-out="load">0 % (vacío)</b></label>
      <input type="range" data-load min="0" max="150" step="1" value="0" />
      <div class="quick"><button data-loadset="0">Vacío</button><button data-loadset="50">50 %</button><button data-loadset="100">Nominal</button><button data-loadset="125">Sobrecarga 125 %</button></div>
      <select data-loadtype>
        <option value="const">Par constante (banda, grúa, compresor)</option>
        <option value="quad">Par cuadrático ∝ n² (bomba, ventilador)</option>
      </select>
    </div>
    ${ctl}
    <div class="sim-field">
      <label>Escala de tiempo del giro 3D</label>
      <select data-ts>${TIME_SCALES.map((t) => `<option value="${t.v}" ${t.v === ui.timeScale ? 'selected' : ''}>${t.label}</option>`).join('')}</select>
      <p class="note" data-out="visual"></p>
    </div>
    <div class="sim-charts">
      <p class="chart-t">Curva par–velocidad y punto de operación</p>
      <canvas data-chart="ts" height="170"></canvas>
      <p class="chart-t">Velocidad en el tiempo (arranque / frenado)</p>
      <canvas data-chart="nt" height="120"></canvas>
    </div>
    <div class="sim-table" data-out="table"></div>
    <p class="note">Polos: <b>${model.poles}</b>. Modelo: ${motorInfo}</p>`;

  const q = (s) => root.querySelector(s);
  const qa = (s) => [...root.querySelectorAll(s)];
  const out = (k) => q(`[data-out="${k}"]`);

  q('[data-act="start"]').addEventListener('click', () => sim.start());
  q('[data-act="stop"]').addEventListener('click', () => sim.stop());
  if (isAC) {
    qa('[data-f]').forEach((b) =>
      b.addEventListener('click', () => {
        sim.params.f = +b.dataset.f;
        qa('[data-f]').forEach((x) => x.classList.toggle('on', x === b));
        sim.refresh();
        curveKey = '';
      }),
    );
  }
  const loadIn = q('[data-load]');
  const setLoad = (pc) => {
    sim.params.load = pc / 100;
    loadIn.value = pc;
    const T = sim.params.load * model.Trated;
    out('load').textContent = pc === 0 ? '0 % (vacío)' : `${pc} % · ${model.Trated < 1 ? (T * 1000).toFixed(1) + ' mN·m' : T.toFixed(1) + ' N·m'}`;
    curveKey = '';
  };
  loadIn.addEventListener('input', () => setLoad(+loadIn.value));
  qa('[data-loadset]').forEach((b) => b.addEventListener('click', () => setLoad(+b.dataset.loadset)));
  q('[data-loadtype]').addEventListener('change', (e) => {
    sim.params.loadType = e.target.value;
    curveKey = '';
  });
  qa('[data-ctl]').forEach((inp) =>
    inp.addEventListener('input', () => {
      const c = model.controls.find((x) => x.id === inp.dataset.ctl);
      sim.params[c.id] = +inp.value;
      out(c.id).textContent = `${inp.value} ${c.unit}`;
      sim.refresh();
      curveKey = '';
    }),
  );
  q('[data-ts]').addEventListener('change', (e) => (ui.timeScale = +e.target.value));

  // ───── gráficas ─────
  let curveKey = '';
  let curve = null;
  function computeCurve() {
    const env = sim.env;
    const nMax = Math.max(rpm(model.syncSpeed(env)) * 1.08, 100);
    const pts = [];
    let tMax = 0;
    for (let i = 0; i <= 140; i++) {
      const n = (nMax * i) / 140;
      const w = (n * Math.PI * 2) / 60;
      const Te = model.torque(w, env);
      const TL = sim.loadTorque(w) + model.friction(w);
      pts.push([n, Te, TL]);
      tMax = Math.max(tMax, Te, TL);
    }
    if (model.sync) tMax = Math.max(tMax, model.pullOut(env));
    curve = { pts, nMax, tMax: tMax * 1.12 || 1 };
  }
  function setupCanvas(cv) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth;
    const h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    return { g, w, h };
  }
  function axes(g, w, h, pad, xLab, yLab, xMax, yMax, yScale = 1) {
    g.strokeStyle = css('--line2');
    g.fillStyle = css('--muted');
    g.lineWidth = 1;
    g.font = '10px IBM Plex Mono, monospace';
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + ((h - pad.t - pad.b) * i) / 4;
      g.globalAlpha = 0.5;
      g.beginPath();
      g.moveTo(pad.l, y);
      g.lineTo(w - pad.r, y);
      g.stroke();
      g.globalAlpha = 1;
      g.fillText(((yMax * (4 - i)) / 4 * yScale).toFixed(yMax * yScale < 10 ? 1 : 0), 2, y + 3);
    }
    for (let i = 0; i <= 4; i++) {
      const x = pad.l + ((w - pad.l - pad.r) * i) / 4;
      g.fillText(((xMax * i) / 4).toFixed(xMax < 10 ? 2 : 0), x - 8, h - pad.b + 12);
    }
    g.fillText(xLab, w - pad.r - g.measureText(xLab).width, h - 2);
    g.fillText(yLab, pad.l + 4, pad.t - 3);
  }
  function drawTS() {
    const cv = q('[data-chart="ts"]');
    const { g, w, h } = setupCanvas(cv);
    const key = JSON.stringify(sim.params) + sim.on;
    if (key !== curveKey) {
      computeCurve();
      curveKey = key;
    }
    const pad = { l: 34, r: 8, t: 12, b: 18 };
    const sc = model.Trated < 1 ? 1000 : 1;
    const X = (n) => pad.l + ((w - pad.l - pad.r) * n) / curve.nMax;
    const Y = (T) => h - pad.b - ((h - pad.t - pad.b) * Math.max(0, Math.min(T, curve.tMax))) / curve.tMax;
    axes(g, w, h, pad, 'n [r/min]', model.Trated < 1 ? 'T [mN·m]' : 'T [N·m]', curve.nMax, curve.tMax, sc);
    const line = (idx, color, wdt) => {
      g.strokeStyle = color;
      g.lineWidth = wdt;
      g.beginPath();
      curve.pts.forEach((p, i) => (i ? g.lineTo(X(p[0]), Y(p[idx])) : g.moveTo(X(p[0]), Y(p[idx]))));
      g.stroke();
    };
    line(1, css('--accent'), 2);
    line(2, css('--accent2'), 1.5);
    if (model.sync) {
      const ns = rpm(sim.env.ws);
      g.strokeStyle = '#1f9d55';
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(X(ns), Y(0));
      g.lineTo(X(ns), Y(model.pullOut(sim.env)));
      g.stroke();
    }
    // punto de operación
    const r = lastReport;
    if (r) {
      const n = lastN;
      g.fillStyle = '#d63b2f';
      g.beginPath();
      g.arc(X(n), Y(r.Te), 4.5, 0, Math.PI * 2);
      g.fill();
    }
    g.font = '10px IBM Plex Sans, sans-serif';
    const lx = Math.max(pad.l + 6, w - pad.r - 150);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillRect(lx - 4, pad.t + 2, 150, model.sync ? 40 : 28);
    g.fillStyle = css('--accent');
    g.fillText(model.sync ? '— par asíncrono (amortiguador)' : '— par motor Te(n)', lx, pad.t + 12);
    g.fillStyle = css('--accent2');
    g.fillText('— par de carga + fricción', lx, pad.t + 24);
    if (model.sync) {
      g.fillStyle = '#1f9d55';
      g.fillText('│ sincronismo (hasta Pmax)', lx, pad.t + 36);
    }
    g.fillStyle = '#d63b2f';
    g.fillText('● punto de operación', pad.l + 6, h - pad.b - 6);
  }
  function drawNT() {
    const cv = q('[data-chart="nt"]');
    const { g, w, h } = setupCanvas(cv);
    const tr = sim.trace;
    const pad = { l: 34, r: 8, t: 12, b: 18 };
    const t0 = tr.length ? tr[0][0] : 0;
    const tSpan = Math.max(0.05, tr.length ? tr[tr.length - 1][0] - t0 : 1);
    const nMax = Math.max(rpm(model.syncSpeed(sim.env)) * 1.1, ...tr.map((p) => p[1] * 1.05), 10);
    axes(g, w, h, pad, 't [s]', 'n [r/min]', tSpan, nMax);
    g.strokeStyle = css('--accent');
    g.lineWidth = 2;
    g.beginPath();
    tr.forEach(([t, n], i) => {
      const x = pad.l + ((w - pad.l - pad.r) * (t - t0)) / tSpan;
      const y = h - pad.b - ((h - pad.t - pad.b) * n) / nMax;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    });
    g.stroke();
  }

  // ───── tabla ─────
  let lastReport = null;
  let lastN = 0;
  function renderTable(r) {
    out('table').innerHTML = r.rows
      .map((row) => {
        if (row.h) return `<h4>${row.h}</h4>`;
        const use =
          row.use !== undefined
            ? `<div class="use ${row.use > 1 ? 'bad' : row.use > 0.85 ? 'warn' : ''}"><i style="width:${Math.min(100, row.use * 100)}%"></i><span>${(row.use * 100).toFixed(0)} % de ${row.cap}</span></div>`
            : '';
        return `<div class="r ${row.strong ? 'strong' : ''}"><span class="k">${row.label}</span><span class="v">${row.value}</span>${use}${row.note ? `<span class="n">${row.note}</span>` : ''}</div>`;
      })
      .join('');
  }

  let acc = 0;
  let accChart = 0;
  return {
    sim,
    ui,
    // dtReal en segundos de reloj; devuelve el ángulo físico avanzado (rad)
    tick(dtReal, visible) {
      const dtPhys = dtReal * ui.timeScale;
      const w0 = sim.w;
      sim.step(dtPhys);
      const dAng = ((w0 + sim.w) / 2) * dtPhys;
      acc += dtReal;
      accChart += dtReal;
      if (acc > 0.12) {
        acc = 0;
        lastReport = sim.report();
        lastN = rpm(sim.w);
        const big = model.Trated < 1;
        out('n').textContent = Math.round(rpm(sim.w)).toLocaleString('es-CO');
        out('I').textContent = Math.abs(lastReport.I).toFixed(1);
        out('T').textContent = big ? (lastReport.Te * 1000).toFixed(1) : lastReport.Te.toFixed(1);
        const ns = rpm(model.syncSpeed(sim.env));
        const steady = sim.on && sim.trace.length > 5 && Math.abs(sim.trace[sim.trace.length - 1][1] - sim.trace[Math.max(0, sim.trace.length - 6)][1]) < Math.max(0.5, ns * 0.0005);
        out('state').textContent = !sim.on ? (sim.w > 0.5 ? 'Frenando (sin alimentación)' : 'Detenido') : model.sync && sim.locked ? 'En sincronismo' : steady ? 'Régimen estable' : 'Arrancando…';
        out('state').className = 'sim-state ' + (sim.on ? (steady || sim.locked ? 'ok' : 'busy') : '');
        const vis = rpm(sim.w) * ui.timeScale;
        out('visual').textContent = `Giro mostrado en pantalla: ${vis.toFixed(1)} r/min (${(vis / 60).toFixed(2)} vueltas/s)` + (vis > 400 ? ' · a esta escala aparece el efecto estroboscópico' : '');
        if (visible) renderTable(lastReport);
      }
      if (visible && accChart > 0.06) {
        accChart = 0;
        drawTS();
        drawNT();
      }
      return dAng;
    },
    redraw() {
      curveKey = '';
      lastReport = sim.report();
      lastN = rpm(sim.w);
      renderTable(lastReport);
      drawTS();
      drawNT();
    },
  };
}
