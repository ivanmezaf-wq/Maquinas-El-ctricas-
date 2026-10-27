// Ensamble de un motor: registro de piezas, categorías y vectores de despiece.
import * as THREE from 'three';
import { mesh } from './geo.js';

export class MotorModel {
  constructor(info) {
    this.info = info;
    this.root = new THREE.Group();
    // El eje del motor se modela sobre Z; se gira para que quede horizontal sobre X en pantalla.
    this.inner = new THREE.Group();
    this.inner.rotation.y = Math.PI / 2;
    this.root.add(this.inner);
    this.parts = [];
    this.byId = new Map();
    this.categories = [];
  }

  /**
   * Agrega una pieza al ensamble.
   * @param {object} p
   *  id, name, cat (categoría del menú), desc (función), mat (material constructivo),
   *  explode [x,y,z] desplazamiento a despiece completo (mm, coordenadas del motor),
   *  objects: lista de Object3D o pares [geometría, material]
   */
  part(p) {
    const g = new THREE.Group();
    g.name = p.name;
    for (const o of p.objects) {
      const obj = Array.isArray(o) ? mesh(o[0], o[1]) : o;
      g.add(obj);
    }
    if (p.position) g.position.set(...p.position);
    const part = {
      id: p.id,
      name: p.name,
      cat: p.cat,
      desc: p.desc || '',
      mat: p.mat || '',
      qty: p.qty || 1,
      group: g,
      base: g.position.clone(),
      explode: new THREE.Vector3(...(p.explode || [0, 0, 0])),
    };
    g.traverse((o) => {
      o.userData.partId = p.id;
    });
    if (!this.categories.includes(p.cat)) this.categories.push(p.cat);
    this.inner.add(g);
    this.parts.push(part);
    this.byId.set(p.id, part);
    return part;
  }

  setExplode(t) {
    for (const p of this.parts) p.group.position.copy(p.base).addScaledVector(p.explode, t);
  }

  setRotation(angle) {
    // Gira las piezas rotatorias alrededor del eje Z del motor
    for (const p of this.parts) if (p.rotates) p.group.rotation.z = angle;
  }

  markRotating(ids) {
    for (const id of ids) {
      const p = this.byId.get(id);
      if (p) p.rotates = true;
    }
  }
}
