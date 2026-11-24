import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from './config.js';

// ---------- Arena o'lchamlari (metr) ----------
// Maydon 60x30 m, burchak radiusi 8.5 m. Uzun o'q — X.
const SX = 21.5, SZ = 6.5, R = 8.5;
const LOWER = { rows: 15, d0: 3.2, depth: 0.85, h0: 1.3, rise: 0.40 };
const UPPER = { rows: 12, d0: 20.8, depth: 0.85, h0: 11.6, rise: 0.55 };
const CONC = { d0: LOWER.d0 + LOWER.rows * LOWER.depth, h: 7.3, glass: 16.3, back: 20.3, ceil: 10.5 };
const ROOF_Y = 24;
const SEAT_SPACING = 0.58, AISLE = 1.1;
const SUITES_PER_SIDE = 9;

// Sektor chegaralari "p" fazosida (0..9). Har bir butun son — perimetr bo'lagi:
// 0: yuqori to'g'ri (o'ng yarmi), 1: burchak, 2: o'ng uch, 3: burchak, 4: pastki to'g'ri,
// 5: burchak, 6: chap uch, 7: burchak, 8: yuqori to'g'ri (chap yarmi)
const BOUNDS = [0, 0.5, 1, 1.5, 2, 3, 3.5, 4, 4.25, 4.5, 4.75, 5, 5.5, 6, 7, 7.5, 8, 8.5];
const isCorner = (i) => i % 2 === 1;

function segLen(i, d) {
  const Rd = R + d;
  switch (i) {
    case 0: case 8: return SX;
    case 4: return 2 * SX;
    case 2: case 6: return 2 * SZ;
    default: return Rd * Math.PI / 2;
  }
}

// p -> (x, z) va tashqi normal
function pointAt(p, d) {
  p = ((p % 9) + 9) % 9;
  let i = Math.floor(p), f = p - i;
  if (i > 8) { i = 8; f = 1; }
  const Rd = R + d, B = SZ + Rd, E = SX + Rd;
  const corner = (cx, cz, a0, a1) => {
    const a = a0 + (a1 - a0) * f;
    return { x: cx + Rd * Math.cos(a), z: cz + Rd * Math.sin(a), nx: Math.cos(a), nz: Math.sin(a) };
  };
  switch (i) {
    case 0: return { x: SX * f, z: B, nx: 0, nz: 1 };
    case 1: return corner(SX, SZ, Math.PI / 2, 0);
    case 2: return { x: E, z: SZ - 2 * SZ * f, nx: 1, nz: 0 };
    case 3: return corner(SX, -SZ, 0, -Math.PI / 2);
    case 4: return { x: SX - 2 * SX * f, z: -B, nx: 0, nz: -1 };
    case 5: return corner(-SX, -SZ, -Math.PI / 2, -Math.PI);
    case 6: return { x: -E, z: -SZ + 2 * SZ * f, nx: -1, nz: 0 };
    case 7: return corner(-SX, SZ, -Math.PI, -1.5 * Math.PI);
    case 8: return { x: -SX + SX * f, z: B, nx: 0, nz: 1 };
  }
}

function perimeter(d) { let L = 0; for (let i = 0; i < 9; i++) L += segLen(i, d); return L; }
function sOf(p, d) {
  const i = Math.floor(p) % 9, f = p - Math.floor(p);
  let s = (Math.floor(p) >= 9) ? perimeter(d) : 0;
  for (let k = 0; k < i; k++) s += segLen(k, d);
  return s + f * segLen(i, d);
}
function pOf(s, d) {
  const L = perimeter(d); s = ((s % L) + L) % L;
  for (let i = 0; i < 9; i++) {
    const l = segLen(i, d);
    if (s <= l) return i + s / l;
    s -= l;
  }
  return 0;
}

// p oralig'ini tekis namunalash (burchaklar mayda bo'linadi)
function sampleRange(p0, p1) {
  const out = [];
  const step = 1 / 14;
  let p = p0;
  out.push(p);
  while (p < p1 - 1e-6) {
    const seg = Math.floor(p + 1e-6);
    const next = isCorner(seg % 9) ? Math.min(p + step, seg + 1, p1) : Math.min(seg + 1, p1);
    p = next <= p + 1e-6 ? Math.min(p + step, p1) : next;
    out.push(p);
  }
  return out;
}
const FULL = sampleRange(0, 9);

// Ikki konsentrik chiziq orasidagi lenta (zinapoya, devor, ship)
function strip(pos, ps, dA, hA, dB, hB) {
  for (let j = 0; j < ps.length - 1; j++) {
    const a1 = pointAt(ps[j], dA), a2 = pointAt(ps[j + 1], dA);
    const b1 = pointAt(ps[j], dB), b2 = pointAt(ps[j + 1], dB);
    pos.push(a1.x, hA, a1.z, b1.x, hB, b1.z, a2.x, hA, a2.z);
    pos.push(a2.x, hA, a2.z, b1.x, hB, b1.z, b2.x, hB, b2.z);
  }
}
function meshFromPositions(pos, mat) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

function tierMesh(T, mat) {
  const pos = [];
  for (let i = 0; i < T.rows; i++) {
    const d = T.d0 + i * T.depth, h = T.h0 + i * T.rise;
    const hPrev = i === 0 ? (T === LOWER ? 0 : CONC.ceil) : h - T.rise;
    strip(pos, FULL, d, hPrev, d, h);              // riser
    strip(pos, FULL, d, h, d + T.depth, h);        // tread
  }
  return meshFromPositions(pos, mat);
}

// ---------- Matn teksturalari ----------
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function rinkTexture() {
  const k = 20; // px / m
  return canvasTex(60 * k, 30 * k, (g, W, H) => {
    g.fillStyle = '#eef4f8'; g.fillRect(0, 0, W, H);
    const X = (m) => W / 2 + m * k, Y = (m) => H / 2 + m * k;
    const line = (x, color, w) => { g.fillStyle = color; g.fillRect(X(x) - w * k / 2, 0, w * k, H); };
    line(0, '#d0262f', 0.3); line(-8.5, '#1f4fb8', 0.3); line(8.5, '#1f4fb8', 0.3);
    line(-26, '#d0262f', 0.08); line(26, '#d0262f', 0.08);
    const circle = (x, y, r, color, w = 0.08) => { g.strokeStyle = color; g.lineWidth = w * k; g.beginPath(); g.arc(X(x), Y(y), r * k, 0, 7); g.stroke(); };
    const dot = (x, y, r, color) => { g.fillStyle = color; g.beginPath(); g.arc(X(x), Y(y), r * k, 0, 7); g.fill(); };
    circle(0, 0, 4.5, '#1f4fb8'); dot(0, 0, 0.3, '#1f4fb8');
    for (const sx of [-20, 20]) for (const sy of [-7, 7]) { circle(sx, sy, 4.5, '#d0262f'); dot(sx, sy, 0.3, '#d0262f'); }
    for (const sx of [-5, 5]) for (const sy of [-7, 7]) dot(sx, sy, 0.3, '#d0262f');
    for (const s of [-1, 1]) {
      g.fillStyle = 'rgba(80,150,230,0.55)'; g.beginPath();
      g.arc(X(26 * s), Y(0), 1.8 * k, s > 0 ? Math.PI / 2 : -Math.PI / 2, s > 0 ? 1.5 * Math.PI : Math.PI / 2); g.fill();
    }
    g.save(); g.translate(W / 2, H / 2); g.globalAlpha = 0.18; g.fillStyle = '#123a7a';
    g.font = `900 ${2.2 * k}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(CONFIG.venueName, 0, 0); g.restore();
  });
}

function roundedRectShape(a, b, r) {
  const s = new THREE.Shape();
  s.moveTo(-a + r, -b); s.lineTo(a - r, -b); s.absarc(a - r, -b + r, r, -Math.PI / 2, 0);
  s.lineTo(a, b - r); s.absarc(a - r, b - r, r, 0, Math.PI / 2);
  s.lineTo(-a + r, b); s.absarc(-a + r, b - r, r, Math.PI / 2, Math.PI);
  s.lineTo(-a, -b + r); s.absarc(-a + r, -b + r, r, Math.PI, 1.5 * Math.PI);
  return s;
}

// ---------- Asosiy qurilish ----------
export function buildArena(scene) {
  const M = {
    concrete: new THREE.MeshStandardMaterial({ color: 0x1b1e26, roughness: 0.9, side: THREE.DoubleSide }),
    concreteUp: new THREE.MeshStandardMaterial({ color: 0x15171e, roughness: 0.9, side: THREE.DoubleSide }),
    wall: new THREE.MeshStandardMaterial({ color: 0x0e1016, roughness: 1, side: THREE.DoubleSide }),
    floor: new THREE.MeshStandardMaterial({ color: 0x23262e, roughness: 0.8 }),
    board: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5, side: THREE.DoubleSide }),
    boardCap: new THREE.MeshStandardMaterial({ color: 0xd0262f, roughness: 0.5, side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardMaterial({ color: 0xbfdfff, transparent: true, opacity: 0.12, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false }),
    led: new THREE.MeshStandardMaterial({ color: 0x0a2a80, emissive: 0x1a5cff, emissiveIntensity: 1.6, side: THREE.DoubleSide }),
    suiteWall: new THREE.MeshStandardMaterial({ color: 0x8a4b2c, roughness: 0.6 }),
    suiteWood: new THREE.MeshStandardMaterial({ color: 0xc9a27a, roughness: 0.5 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x0b0c11, roughness: 1 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3dc, emissiveIntensity: 2 }),
  };
  const root = new THREE.Group(); scene.add(root);

  // Pol
  const floor = new THREE.Mesh(new THREE.ShapeGeometry(roundedRectShape(SX + R + 3.3, SZ + R + 3.3, R + 3.3), 24), M.floor);
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.02; root.add(floor);

  // Muz maydoni
  const rinkGeo = new THREE.ShapeGeometry(roundedRectShape(30, 15, R), 24);
  const uv = rinkGeo.attributes.uv, pp = rinkGeo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pp.getX(i) + 30) / 60, (pp.getY(i) + 15) / 30);
  const rink = new THREE.Mesh(rinkGeo, new THREE.MeshStandardMaterial({ map: rinkTexture(), roughness: 0.15, metalness: 0.05 }));
  rink.rotation.x = -Math.PI / 2;

  // Bortlar va himoya oynasi
  const hockeyGroup = new THREE.Group(); root.add(hockeyGroup);
  hockeyGroup.add(rink);
  { const p = []; strip(p, FULL, 0, 0, 0, 1.07); hockeyGroup.add(meshFromPositions(p, M.board)); }
  { const p = []; strip(p, FULL, 0, 1.07, 0.25, 1.07); strip(p, FULL, 0, 0.9, 0, 1.07); hockeyGroup.add(meshFromPositions(p, M.boardCap)); }
  { const p = []; strip(p, FULL, 0.02, 1.07, 0.02, 2.9); hockeyGroup.add(meshFromPositions(p, M.glass)); }
  // Darvozalar
  const goalMat = new THREE.MeshStandardMaterial({ color: 0xd0262f });
  for (const s of [-1, 1]) {
    const gg = new THREE.Group();
    const post = new THREE.BoxGeometry(0.08, 1.22, 0.08);
    for (const z of [-0.915, 0.915]) { const m = new THREE.Mesh(post, goalMat); m.position.set(0, 0.61, z); gg.add(m); }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.9), goalMat); bar.position.y = 1.22; gg.add(bar);
    const net = new THREE.Mesh(new THREE.BoxGeometry(1, 1.2, 1.8), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
    net.position.set(0.5 * s, 0.6, 0); gg.add(net);
    gg.position.x = 26 * s; hockeyGroup.add(gg);
  }

  // Konsert sahnasi
  const concertGroup = new THREE.Group(); root.add(concertGroup);
  {
    const fl = new THREE.Mesh(new THREE.ShapeGeometry(roundedRectShape(30, 15, R), 24), new THREE.MeshStandardMaterial({ color: 0x1a1c24, roughness: 0.7 }));
    fl.rotation.x = -Math.PI / 2; fl.position.y = 0.01; concertGroup.add(fl);
    const stage = new THREE.Mesh(new THREE.BoxGeometry(12, 1.6, 24), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 }));
    stage.position.set(-23, 0.8, 0); concertGroup.add(stage);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(20, 8), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x7a3cff, emissiveIntensity: 1.2 }));
    screen.position.set(-28.5, 7, 0); screen.rotation.y = Math.PI / 2; concertGroup.add(screen);
    const runway = new THREE.Mesh(new THREE.BoxGeometry(16, 1.2, 3), stage.material); runway.position.set(-9, 0.6, 0); concertGroup.add(runway);
  }
  // Boks ringi
  const boxingGroup = new THREE.Group(); root.add(boxingGroup);
  {
    const fl = new THREE.Mesh(new THREE.ShapeGeometry(roundedRectShape(30, 15, R), 24), new THREE.MeshStandardMaterial({ color: 0x1a1c24, roughness: 0.7 }));
    fl.rotation.x = -Math.PI / 2; fl.position.y = 0.01; boxingGroup.add(fl);
    const ring = new THREE.Mesh(new THREE.BoxGeometry(7.3, 1.2, 7.3), new THREE.MeshStandardMaterial({ color: 0x1d4fd6, roughness: 0.6 }));
    ring.position.y = 0.6; boxingGroup.add(ring);
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    for (const h of [1.6, 2.0, 2.4]) for (let k = 0; k < 4; k++) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(7.1, 0.04, 0.04), ropeMat);
      r.position.y = h; r.rotation.y = k * Math.PI / 2; r.translateZ(3.55); boxingGroup.add(r);
    }
    for (const x of [-3.6, 3.6]) for (const z of [-3.6, 3.6]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.5), new THREE.MeshStandardMaterial({ color: 0xd0262f }));
      post.position.set(x, 1.95, z); boxingGroup.add(post);
    }
  }

  // Tribunalar
  root.add(tierMesh(LOWER, M.concrete));
  root.add(tierMesh(UPPER, M.concreteUp));
  { const p = []; strip(p, FULL, CONC.d0, CONC.h, CONC.back, CONC.h); strip(p, FULL, CONC.d0, CONC.h - 0.4, CONC.d0, CONC.h); root.add(meshFromPositions(p, M.concrete)); }
  { const p = []; strip(p, FULL, CONC.back, CONC.h, CONC.back, CONC.ceil); strip(p, FULL, CONC.glass, CONC.ceil, UPPER.d0, CONC.ceil); root.add(meshFromPositions(p, M.wall)); }
  { const p = []; strip(p, FULL, CONC.glass, CONC.ceil - 0.7, CONC.glass, CONC.ceil); root.add(meshFromPositions(p, M.led)); }
  { const p = []; strip(p, FULL, UPPER.d0 - 0.05, CONC.ceil + 0.15, UPPER.d0 - 0.05, UPPER.h0 - 0.05); root.add(meshFromPositions(p, M.led)); }
  const upTop = UPPER.h0 + (UPPER.rows - 1) * UPPER.rise, upBack = UPPER.d0 + UPPER.rows * UPPER.depth;
  { const p = []; strip(p, FULL, upBack, upTop, upBack, ROOF_Y); root.add(meshFromPositions(p, M.wall)); }
  const roof = new THREE.Mesh(new THREE.ShapeGeometry(roundedRectShape(SX + R + upBack, SZ + R + upBack, R + upBack), 24), M.roof);
  roof.rotation.x = Math.PI / 2; roof.position.y = ROOF_Y;
  const ceiling = new THREE.Group(); root.add(ceiling); ceiling.add(roof);
  // Shift chiroqlari
  const lampGeo = new THREE.BoxGeometry(1.4, 0.2, 0.6);
  const lamps = new THREE.InstancedMesh(lampGeo, M.lamp, 64);
  { let n = 0; const m = new THREE.Matrix4();
    for (let i = 0; i < 16; i++) for (const z of [-10, -4, 4, 10]) { m.makeTranslation(-30 + i * 4, ROOF_Y - 0.5, z); lamps.setMatrixAt(n++, m); } }
  ceiling.add(lamps);

  // ---------- Lojalar (suites) ----------
  const suiteSides = [{ p0: 8, p1: 10, z: 1 }, { p0: 4, p1: 5, z: -1 }];
  const suiteW = (2 * SX) / SUITES_PER_SIDE;
  const zFront = (d) => SZ + R + d;
  for (const side of suiteSides) {
    { const p = []; strip(p, sampleRange(side.p0, side.p1), CONC.glass, CONC.h, CONC.glass, CONC.ceil - 0.7); root.add(meshFromPositions(p, M.glass)); }
    for (let k = 0; k <= SUITES_PER_SIDE; k++) {
      const x = -SX + k * suiteW;
      const div = new THREE.Mesh(new THREE.BoxGeometry(0.12, CONC.ceil - CONC.h, CONC.back - CONC.glass), M.suiteWood);
      div.position.set(x, (CONC.h + CONC.ceil) / 2, side.z * zFront((CONC.glass + CONC.back) / 2)); root.add(div);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(2 * SX, CONC.ceil - CONC.h, 0.1), M.suiteWall);
    back.position.set(0, (CONC.h + CONC.ceil) / 2, side.z * zFront(CONC.back - 0.1)); root.add(back);
    const plat = new THREE.Mesh(new THREE.BoxGeometry(2 * SX, 0.35, CONC.back - 17.5), M.suiteWood);
    plat.position.set(0, CONC.h + 0.175, side.z * zFront((17.5 + CONC.back) / 2)); root.add(plat);
  }

  // ---------- O'rindiqlar ----------
  const seats = [];
  const sections = new Map();
  const addSection = (id, cat, tier, label) => {
    if (!sections.has(id)) sections.set(id, { id, cat, tier, label, seatIdx: [], anchor: new THREE.Vector3() });
    return sections.get(id);
  };
  const catFor = (tier, p0) => {
    const straight = (p0 >= 8 || p0 < 1) || (p0 >= 4 && p0 < 5);
    if (tier === 'lower') return straight ? 'parter_a' : 'parter_b';
    return straight ? 'tribuna_a' : 'tribuna_b';
  };
  for (const [tierName, T, base] of [['lower', LOWER, 101], ['upper', UPPER, 201]]) {
    for (let k = 0; k < BOUNDS.length; k++) {
      const p0 = BOUNDS[k], p1 = k + 1 < BOUNDS.length ? BOUNDS[k + 1] : 9;
      const secId = String(base + k);
      const sec = addSection(secId, catFor(tierName, p0), tierName, secId);
      for (let r = 0; r < T.rows; r++) {
        const d = T.d0 + r * T.depth + T.depth * 0.55, h = T.h0 + r * T.rise;
        const s0 = sOf(p0, d), s1 = sOf(p1, d);
        const n = Math.floor((s1 - s0 - AISLE) / SEAT_SPACING) + 1;
        const start = s0 + (s1 - s0 - (n - 1) * SEAT_SPACING) / 2;
        for (let j = 0; j < n; j++) {
          const pt = pointAt(pOf(start + j * SEAT_SPACING, d), d);
          sec.seatIdx.push(seats.length);
          seats.push({ id: `${secId}-${r + 1}-${j + 1}`, sec: secId, row: r + 1, num: j + 1, cat: sec.cat,
            x: pt.x, y: h, z: pt.z, nx: pt.nx, nz: pt.nz, scale: 1 });
        }
      }
      const mid = pointAt((p0 + p1) / 2, T.d0 + T.rows * T.depth / 2);
      sec.anchor.set(mid.x, T.h0 + T.rows * T.rise / 2 + 1.5, mid.z);
    }
  }
  // Loja o'rindiqlari
  let suiteNo = 1;
  for (const side of suiteSides) {
    for (let k = 0; k < SUITES_PER_SIDE; k++) {
      const id = 'L' + String(suiteNo++).padStart(2, '0');
      const sec = addSection(id, 'vip', 'suite', id);
      const cx = -SX + (k + 0.5) * suiteW;
      const xs = side.z > 0 ? [-1.5, -0.5, 0.5, 1.5] : [1.5, 0.5, -0.5, -1.5];
      [[16.9, CONC.h], [18.1, CONC.h + 0.35]].forEach(([d, h], r) => {
        xs.forEach((dx, j) => {
          sec.seatIdx.push(seats.length);
          seats.push({ id: `${id}-${r + 1}-${j + 1}`, sec: id, row: r + 1, num: j + 1, cat: 'vip',
            x: cx + dx * 0.95, y: h, z: side.z * zFront(d), nx: 0, nz: side.z, scale: 1.3 });
        });
      });
      sec.anchor.set(cx, CONC.ceil + 0.6, side.z * zFront(17.5));
    }
  }

  // Bitta geometriya: o'tirg'ich + suyanchiq + oyoq
  const seatGeo = mergeGeometries([
    new THREE.BoxGeometry(0.46, 0.07, 0.40).translate(0, 0.42, 0),
    new THREE.BoxGeometry(0.46, 0.44, 0.05).translate(0, 0.66, -0.2).rotateX(-0.12),
    new THREE.BoxGeometry(0.06, 0.4, 0.06).translate(0, 0.2, -0.05),
  ]);
  const seatMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });
  const seatMesh = new THREE.InstancedMesh(seatGeo, seatMat, seats.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sc = new THREE.Vector3();
  seats.forEach((s, i) => {
    q.setFromAxisAngle(up, Math.atan2(-s.nx, -s.nz));
    m4.compose(v.set(s.x, s.y, s.z), q, sc.setScalar(s.scale));
    seatMesh.setMatrixAt(i, m4);
    seatMesh.setColorAt(i, new THREE.Color(0xffffff));
  });
  seatMesh.computeBoundingSphere();
  root.add(seatMesh);

  // ---------- Tablo (kub ekran) ----------
  const cube = new THREE.Group(); cube.position.y = 17; ceiling.add(cube);
  const boardMats = [];
  const drawBoard = (title, sub) => canvasTex(512, 320, (g, W, H) => {
    const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#06123a'); grd.addColorStop(1, '#0b2c8a');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffffff'; g.textAlign = 'center';
    g.font = '900 64px Arial'; g.fillText(CONFIG.venueName, W / 2, 110);
    g.font = '700 30px Arial'; g.fillStyle = '#9fc2ff'; g.fillText(title, W / 2, 190);
    g.font = '500 26px Arial'; g.fillStyle = '#ffffff'; g.fillText(sub, W / 2, 240);
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(7, 4.6, 7), new THREE.MeshStandardMaterial({ color: 0x050505 }));
  cube.add(body);
  for (let k = 0; k < 4; k++) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 1 });
    boardMats.push(mat);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 4.25), mat);
    pl.rotation.y = k * Math.PI / 2; pl.translateZ(3.52);
    cube.add(pl);
  }
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.5, 48, 1, true), M.led); ring.position.y = -2.7; cube.add(ring);

  function setScoreboard(title, sub) {
    const t = drawBoard(title, sub);
    boardMats.forEach((m) => { if (m.emissiveMap) m.emissiveMap.dispose(); m.emissiveMap = t; m.needsUpdate = true; });
  }
  function setEventKind(kind) {
    hockeyGroup.visible = kind === 'hockey';
    concertGroup.visible = kind === 'concert';
    boxingGroup.visible = kind === 'boxing';
  }

  return { seats, sections, seatMesh, setScoreboard, setEventKind, ceiling, roofY: ROOF_Y };
}
