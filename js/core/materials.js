// Biblioteca de materiales PBR usados en la construcción de los motores.
// Todas las unidades del proyecto están en milímetros.
import * as THREE from 'three';

function stripeTexture(lines = 1, dark = 0.55) {
  // Textura de franjas finas para simular el apilado de chapas magnéticas
  const c = document.createElement('canvas');
  c.width = 4; c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 4, 32);
  const v = Math.round(255 * dark);
  g.fillStyle = `rgb(${v},${v},${v})`;
  for (let i = 0; i < lines; i++) g.fillRect(0, Math.floor((i * 32) / lines), 4, 4);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  return t;
}

function std(params) {
  // DoubleSide: las piezas de revolución quedan bien iluminadas sin importar el sentido del perfil
  return new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, ...params });
}

const cache = {};

export function M() {
  if (cache.ready) return cache;
  const lamTex = stripeTexture(1, 0.45);
  lamTex.repeat.set(0.02, 1 / 0.5); // una chapa cada 0.5 mm

  Object.assign(cache, {
    ready: true,
    // Hierro activo: acero al silicio laminado (cara de chapa / costado del paquete)
    chapa: std({ color: 0x8c949c, metalness: 0.85, roughness: 0.38 }),
    chapaLado: std({ color: 0x9aa2aa, metalness: 0.8, roughness: 0.5, map: lamTex }),
    chapaOscura: std({ color: 0x5d646b, metalness: 0.8, roughness: 0.45 }),
    chapaOscuraLado: std({ color: 0x666e75, metalness: 0.75, roughness: 0.5, map: lamTex }),
    // Hierro inactivo
    fundicionAzul: std({ color: 0x2f4f6f, metalness: 0.25, roughness: 0.55 }),
    fundicionVerde: std({ color: 0x3f5f4a, metalness: 0.25, roughness: 0.55 }),
    fundicionGris: std({ color: 0x5a6068, metalness: 0.3, roughness: 0.55 }),
    fundicionRoja: std({ color: 0x7a2f2a, metalness: 0.25, roughness: 0.55 }),
    aceroForjado: std({ color: 0x6e737a, metalness: 0.7, roughness: 0.45 }),
    aluminio: std({ color: 0xc4c8cc, metalness: 0.85, roughness: 0.35 }),
    aluminioFundido: std({ color: 0xb2b6ba, metalness: 0.7, roughness: 0.55 }),
    aluminioAnodizado: std({ color: 0x2b2e33, metalness: 0.6, roughness: 0.4 }),
    // Conductores
    cobre: std({ color: 0xb8642e, metalness: 0.95, roughness: 0.32 }),
    cobreEsmalte: std({ color: 0xa8521f, metalness: 0.8, roughness: 0.28 }),
    cobreDesnudo: std({ color: 0xd4865a, metalness: 1.0, roughness: 0.22 }),
    bronce: std({ color: 0xb08d57, metalness: 1.0, roughness: 0.3 }),
    laton: std({ color: 0xc9a54a, metalness: 1.0, roughness: 0.3 }),
    carbon: std({ color: 0x262626, metalness: 0.1, roughness: 0.85 }),
    // Ejes, tornillería, rodamientos
    eje: std({ color: 0xa7adb3, metalness: 1.0, roughness: 0.22 }),
    aceroRodamiento: std({ color: 0xc8ccd0, metalness: 1.0, roughness: 0.15 }),
    zincado: std({ color: 0xcfd2cf, metalness: 0.95, roughness: 0.3 }),
    pavonado: std({ color: 0x2e3033, metalness: 0.8, roughness: 0.4 }),
    resorteAcero: std({ color: 0x9da3a8, metalness: 1.0, roughness: 0.25 }),
    // Aislantes y otros
    mica: std({ color: 0x5b3b22, metalness: 0.1, roughness: 0.5 }),
    nomex: std({ color: 0xe6d6a2, metalness: 0.0, roughness: 0.7 }),
    cunaRanura: std({ color: 0x8b6f3a, metalness: 0.0, roughness: 0.6 }),
    barnizRojo: std({ color: 0x8a2b20, metalness: 0.1, roughness: 0.5 }),
    caucho: std({ color: 0x151515, metalness: 0.0, roughness: 0.9 }),
    plasticoNegro: std({ color: 0x1c1d1f, metalness: 0.0, roughness: 0.6 }),
    plasticoGris: std({ color: 0x8d9196, metalness: 0.0, roughness: 0.55 }),
    baquelita: std({ color: 0x3b2418, metalness: 0.05, roughness: 0.5 }),
    pcb: std({ color: 0x1f5e33, metalness: 0.1, roughness: 0.55 }),
    chipNegro: std({ color: 0x111214, metalness: 0.2, roughness: 0.4 }),
    cableRojo: std({ color: 0xb3261e, roughness: 0.6 }),
    cableNegro: std({ color: 0x18191b, roughness: 0.6 }),
    cableAzul: std({ color: 0x1d4fa3, roughness: 0.6 }),
    cableAmarillo: std({ color: 0xd6b21e, roughness: 0.6 }),
    cableVerde: std({ color: 0x2c8a3e, roughness: 0.6 }),
    ferrita: std({ color: 0x3a3b3d, metalness: 0.2, roughness: 0.75 }),
    neodimioN: std({ color: 0xc9a8a8, metalness: 0.9, roughness: 0.25 }),
    neodimioS: std({ color: 0xa8b4c9, metalness: 0.9, roughness: 0.25 }),
    fibraCarbono: std({ color: 0x232527, metalness: 0.4, roughness: 0.35 }),
  });
  return cache;
}

// Material de la placa de características, con texto dibujado en canvas
export function nameplateMaterial(lines, title = 'MOTOR') {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 320;
  const g = c.getContext('2d');
  g.fillStyle = '#d9dcdf';
  g.fillRect(0, 0, 512, 320);
  g.strokeStyle = '#1b1b1b';
  g.lineWidth = 6;
  g.strokeRect(10, 10, 492, 300);
  g.fillStyle = '#1b1b1b';
  g.font = 'bold 34px Arial';
  g.fillText(title, 28, 56);
  g.fillRect(24, 68, 464, 3);
  g.font = '24px Arial';
  lines.forEach((l, i) => g.fillText(l, 28, 104 + i * 32));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map: t, metalness: 0.6, roughness: 0.4 });
}
