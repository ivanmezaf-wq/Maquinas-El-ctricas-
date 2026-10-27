// Tapas de sección: hacen que las piezas cortadas se vean macizas, no huecas.
// Técnica de buffer de stencil (paridad): para cada pieza y cada plano de corte se dibujan sus
// caras traseras (+1) y delanteras (−1) recortadas por el plano; donde el contador queda ≠ 0 el
// rayo de vista está "dentro" del sólido, y ahí se pinta una tapa plana del color de la pieza.
import * as THREE from 'three';

const noRay = () => {};

export class SectionCaps {
  constructor(scene, model, size) {
    this.scene = scene;
    this.model = model;
    this.size = size;
    this.group = new THREE.Group();
    this.group.name = 'tapas-seccion';
    scene.add(this.group);
    this.stencilMeshes = [];
    this.caps = [];
    this.planes = [];
    this.capMats = new Map();
  }

  clear() {
    for (const s of this.stencilMeshes) s.parent && s.parent.remove(s);
    for (const c of this.caps) this.group.remove(c);
    this.stencilMeshes = [];
    this.caps = [];
  }

  capMaterial(color, others, key) {
    if (!this.capMats.has(key)) {
      const c = new THREE.Color(color);
      const m = new THREE.MeshStandardMaterial({
        color: c,
        metalness: 0.25,
        roughness: 0.62,
        side: THREE.DoubleSide,
        stencilWrite: true,
        stencilRef: 0,
        stencilFunc: THREE.NotEqualStencilFunc,
        stencilFail: THREE.ReplaceStencilOp,
        stencilZFail: THREE.ReplaceStencilOp,
        stencilZPass: THREE.ReplaceStencilOp,
      });
      this.capMats.set(key, m);
    }
    const m = this.capMats.get(key);
    m.clippingPlanes = others;
    m.needsUpdate = true;
    return m;
  }

  // planes: lista de THREE.Plane activos (compartidos con los materiales del modelo).
  // intersect = true: solo se elimina la región que todos los planos recortan (p. ej. un cuarto);
  // entonces la tapa de cada plano se limita al lado que los demás planos eliminan (planos invertidos).
  rebuild(planes, intersect = false) {
    this.clear();
    this.planes = planes;
    this.intersect = intersect;
    this.inverted = new Map(planes.map((p) => [p, p.clone().negate()]));
    if (!planes.length) return;
    const meshes = [];
    this.model.root.traverse((o) => {
      if (o.isMesh && !o.userData.isStencil && o.geometry && o.geometry.attributes.position) meshes.push(o);
    });
    const base = new THREE.MeshBasicMaterial({ depthWrite: false, depthTest: false, colorWrite: false, stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc });
    const capGeo = new THREE.PlaneGeometry(this.size, this.size);
    let order = 1;
    planes.forEach((plane, pi) => {
      const back = base.clone();
      back.side = THREE.BackSide;
      back.clippingPlanes = [plane];
      back.stencilFail = back.stencilZFail = back.stencilZPass = THREE.IncrementWrapStencilOp;
      const front = base.clone();
      front.side = THREE.FrontSide;
      front.clippingPlanes = [plane];
      front.stencilFail = front.stencilZFail = front.stencilZPass = THREE.DecrementWrapStencilOp;
      const others = planes.filter((p) => p !== plane).map((p) => (intersect ? this.inverted.get(p) : p));
      for (const mesh of meshes) {
        const src = mesh.userData.baseMat || mesh.material;
        const mat0 = Array.isArray(src) ? src[0] : src;
        if (!mat0 || !mat0.color) continue;
        const sb = new THREE.Mesh(mesh.geometry, back);
        const sf = new THREE.Mesh(mesh.geometry, front);
        for (const s of [sb, sf]) {
          s.userData.isStencil = true;
          s.raycast = noRay;
          s.renderOrder = order;
          s.matrixAutoUpdate = false;
          mesh.add(s);
          this.stencilMeshes.push(s);
        }
        const hex = mat0.color.getHex();
        const cap = new THREE.Mesh(capGeo, this.capMaterial(hex, others, hex + ':' + pi + ':' + planes.length + ':' + intersect));
        cap.renderOrder = order + 1;
        cap.frustumCulled = false;
        cap.raycast = noRay;
        cap.userData.src = mesh;
        cap.userData.plane = plane;
        cap.onAfterRender = (r) => r.clearStencil();
        this.group.add(cap);
        this.caps.push(cap);
        order += 2;
      }
    });
    this.update();
  }

  // posición de las tapas sobre su plano y visibilidad según la pieza
  update() {
    if (!this.caps.length) return;
    for (const [p, inv] of this.inverted) inv.copy(p).negate();
    const z = new THREE.Vector3(0, 0, 1);
    for (const cap of this.caps) {
      const p = cap.userData.plane;
      cap.position.copy(p.normal).multiplyScalar(-p.constant);
      cap.quaternion.setFromUnitVectors(z, p.normal);
      let v = true;
      for (let o = cap.userData.src; o; o = o.parent) if (!o.visible) { v = false; break; }
      cap.visible = v;
    }
  }
}
