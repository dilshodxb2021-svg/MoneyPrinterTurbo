import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CONFIG } from './config.js';
import { STR } from './i18n.js';
import { buildArena } from './arena.js';

// ---------- Holat ----------
const params = new URLSearchParams(location.search);
const state = {
  lang: STR[params.get('lang')] ? params.get('lang') : (localStorage.getItem('ha_lang') || 'uz'),
  event: null,
  sold: new Set(),
  cart: new Set(),     // seat indekslari
  view: -1,            // ko'rilayotgan o'rindiq indeksi
  mode: 'overview',
  hoverSec: null,
  filterCat: null,
};
const t = (k) => (STR[state.lang] && STR[state.lang][k]) || STR.uz[k] || k;
const $ = (id) => document.getElementById(id);
const fmt = (n) => new Intl.NumberFormat('ru-RU').format(n) + ' ' + (CONFIG.currency[state.lang] || CONFIG.currency.uz);
const UZ_M = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const UZ_D = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];
function fmtDate(iso) {
  const d = new Date(iso), hm = iso.slice(11, 16);
  if (state.lang === 'uz') return `${d.getDate()}-${UZ_M[d.getMonth()]} ${d.getFullYear()}, ${UZ_D[d.getDay()]}, ${hm}`;
  return d.toLocaleDateString(state.lang === 'ru' ? 'ru-RU' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ', ' + hm;
}
const catName = (c) => CONFIG.categories[c].name[state.lang] || CONFIG.categories[c].name.uz;
const priceOf = (cat) => Math.round(CONFIG.categories[cat].price * (state.event?.priceMultiplier || 1) / 1000) * 1000;
const isEmbedded = window.parent !== window;
const emit = (type, payload) => { if (isEmbedded) window.parent.postMessage({ type: 'humo:' + type, ...payload }, '*'); };

// ---------- Three.js ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07080d);
scene.fog = new THREE.Fog(0x07080d, 120, 260);
scene.add(new THREE.HemisphereLight(0xc8d8ff, 0x1a1c28, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(10, 40, 15); scene.add(sun);
const fill = new THREE.DirectionalLight(0x8fb4ff, 0.5); fill.position.set(-20, 15, -25); scene.add(fill);
const rinkLight = new THREE.PointLight(0xffffff, 600, 60, 1.6); rinkLight.position.set(0, 18, 0); scene.add(rinkLight);

const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 600);
camera.position.set(0, 140, 160);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false;

const arena = buildArena(scene);
const { seats, sections, seatMesh } = arena;
document.title = `${CONFIG.venueName} 3D`;
$('venueName').textContent = CONFIG.venueName;

// ---------- Ranglar ----------
const COL = {
  sold: new THREE.Color(0x2a2d35), cart: new THREE.Color(0x22d07a), view: new THREE.Color(0xffd24a), white: new THREE.Color(0xffffff),
};
const catColor = {};
for (const [k, c] of Object.entries(CONFIG.categories)) catColor[k] = new THREE.Color(c.color);
const tmpC = new THREE.Color();
function colorFor(i) {
  const s = seats[i];
  if (state.cart.has(i)) return COL.cart;
  if (i === state.view) return COL.view;
  if (state.sold.has(s.id)) return COL.sold;
  tmpC.copy(catColor[s.cat]);
  if (state.filterCat && state.filterCat !== s.cat) return tmpC.multiplyScalar(0.22);
  if (state.hoverSec === s.sec) tmpC.lerp(COL.white, 0.45);
  return tmpC;
}
function paint(i) { seatMesh.setColorAt(i, colorFor(i)); seatMesh.instanceColor.needsUpdate = true; }
function paintSection(id) { if (!id) return; for (const i of sections.get(id).seatIdx) seatMesh.setColorAt(i, colorFor(i)); seatMesh.instanceColor.needsUpdate = true; }
function paintAll() { for (let i = 0; i < seats.length; i++) seatMesh.setColorAt(i, colorFor(i)); seatMesh.instanceColor.needsUpdate = true; }

// ---------- Kamera animatsiyasi ----------
const OVERVIEW = { pos: new THREE.Vector3(0, 68, 72), target: new THREE.Vector3(0, 2, 0), fov: 42 };
let tween = null;
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
function flyTo(pos, target, fov, dur, onDone) {
  controls.enabled = false;
  const from = { pos: camera.position.clone(), target: controls.target.clone(), fov: camera.fov };
  const lift = Math.min(16, from.pos.distanceTo(pos) * 0.22);
  tween = { from, to: { pos, target, fov }, t0: performance.now(), dur, lift, onDone };
}
function stepTween(now) {
  if (!tween) return;
  const k = Math.min(1, (now - tween.t0) / tween.dur), e = ease(k);
  camera.position.lerpVectors(tween.from.pos, tween.to.pos, e);
  camera.position.y += Math.sin(Math.PI * e) * tween.lift;
  controls.target.lerpVectors(tween.from.target, tween.to.target, e);
  camera.fov = tween.from.fov + (tween.to.fov - tween.from.fov) * e; camera.updateProjectionMatrix();
  camera.lookAt(controls.target);
  if (k >= 1) { const cb = tween.onDone; tween = null; controls.enabled = true; cb && cb(); }
}
function setControlsOverview() {
  Object.assign(controls, { minDistance: 28, maxDistance: 150, enableZoom: true, rotateSpeed: 0.6, minPolarAngle: 0.15, maxPolarAngle: 1.32 });
}
function setControlsSeat() {
  Object.assign(controls, { minDistance: 0.5, maxDistance: 0.5, enableZoom: false, rotateSpeed: -0.28, minPolarAngle: 0.5, maxPolarAngle: 2.2 });
}

function goOverview() {
  const prev = state.view; state.view = -1; if (prev >= 0) paint(prev);
  state.mode = 'overview'; document.body.classList.remove('seat-mode');
  $('seatCard').classList.add('hidden'); $('backBtn').classList.add('hidden');
  $('hint').textContent = t('hint'); $('hint').classList.remove('hidden');
  controls.minDistance = 0; controls.maxDistance = Infinity;
  flyTo(OVERVIEW.pos.clone(), OVERVIEW.target.clone(), OVERVIEW.fov, 1500, setControlsOverview);
}

function viewSeat(i) {
  const s = seats[i];
  const prev = state.view; state.view = i; if (prev >= 0) paint(prev); paint(i);
  state.mode = 'seat'; document.body.classList.add('seat-mode');
  if (state.hoverSec) { const h = state.hoverSec; state.hoverSec = null; paintSection(h); }
  const eye = new THREE.Vector3(s.x - s.nx * 0.08, s.y + 1.15 * s.scale, s.z - s.nz * 0.08);
  const focus = new THREE.Vector3(0, 0.8, 0);
  const near = eye.clone().add(focus.clone().sub(eye).normalize().multiplyScalar(0.5));
  controls.minDistance = 0; controls.maxDistance = Infinity;
  flyTo(eye, focus, 62, prev >= 0 ? 1100 : 1800, () => { controls.target.copy(near); setControlsSeat(); controls.update(); });
  $('backBtn').classList.remove('hidden');
  $('hint').textContent = t('seatHint');
  renderSeatCard();
  $('tooltip').classList.add('hidden');
  emit('seatView', { seat: seatInfo(i) });
}

function seatInfo(i) {
  const s = seats[i];
  return { id: s.id, section: s.sec, row: s.row, seat: s.num, category: s.cat, price: priceOf(s.cat) };
}

// Sektordagi eng yaxshi bo'sh joy: sektor markaziga eng yaqini
function bestSeat(secId, near) {
  const sec = sections.get(secId);
  const ref = near || sec.anchor;
  let best = -1, bd = Infinity;
  for (const i of sec.seatIdx) {
    const s = seats[i]; if (state.sold.has(s.id)) continue;
    const d = (s.x - ref.x) ** 2 + (s.z - ref.z) ** 2 + (near ? (s.y - ref.y) ** 2 : 0);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

// ---------- UI ----------
function applyI18n() {
  document.documentElement.lang = state.lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
  $('hint').textContent = state.mode === 'seat' ? t('seatHint') : t('hint');
  document.querySelectorAll('#langs button').forEach((b) => b.classList.toggle('on', b.dataset.lang === state.lang));
  renderEvents(); renderCats(); renderSections(); renderCart(); if (state.view >= 0) renderSeatCard();
  updateScoreboard();
}

function renderEvents() {
  const sel = $('eventSel');
  sel.innerHTML = CONFIG.events.map((e) => `<option value="${e.id}">${e.title[state.lang] || e.title.uz}</option>`).join('');
  if (state.event) sel.value = state.event.id;
  if (state.event) {
    $('eventDate').textContent = `${fmtDate(state.event.date)} · ${CONFIG.city}`;
  }
}

function freeCount(secId) {
  let n = 0; for (const i of sections.get(secId).seatIdx) if (!state.sold.has(seats[i].id) && !state.cart.has(i)) n++; return n;
}

function renderCats() {
  $('cats').innerHTML = Object.keys(CONFIG.categories).map((k) => `
    <div class="cat ${state.filterCat === k ? 'on' : ''}" data-cat="${k}">
      <span class="sw" style="background:${CONFIG.categories[k].color}"></span>
      <span class="nm">${catName(k)}</span>
      <span class="pr">${fmt(priceOf(k))}</span>
    </div>`).join('') + `
    <div class="legend"><span><i style="background:#3b8fd6"></i>${t('available')}</span>
      <span><i style="background:#2a2d35;border:1px solid #444"></i>${t('sold')}</span>
      <span><i style="background:#22d07a"></i>${t('selected')}</span></div>`;
}

function renderSections() {
  const order = [...sections.values()].sort((a, b) => ({ lower: 0, suite: 1, upper: 2 }[a.tier] - { lower: 0, suite: 1, upper: 2 }[b.tier]) || a.id.localeCompare(b.id));
  $('secList').innerHTML = order.map((s) => {
    const f = freeCount(s.id);
    return `<button class="sec-btn ${f ? '' : 'full'}" data-sec="${s.id}" style="border-left-color:${CONFIG.categories[s.cat].color}">${s.label}<small>${f} ${t('free')}</small></button>`;
  }).join('');
}

function renderCart() {
  const items = [...state.cart];
  $('cartCount').textContent = items.length;
  $('cartItems').innerHTML = items.length ? items.map((i) => {
    const s = seats[i];
    return `<div class="cart-item" data-seat="${i}"><div class="ci-main"><b>${t('section')} ${s.sec}</b> · ${t('row')} ${s.row} · ${t('seat')} ${s.num}<small>${catName(s.cat)}</small></div>
      <b>${fmt(priceOf(s.cat))}</b><button class="x" data-remove="${i}" title="${t('remove')}">×</button></div>`;
  }).join('') : `<div class="muted">${t('empty')}</div>`;
  $('cartTotal').textContent = fmt(cartTotal());
  $('checkoutBtn').disabled = !items.length;
}
const cartTotal = () => [...state.cart].reduce((a, i) => a + priceOf(seats[i].cat), 0);

function renderSeatCard() {
  const i = state.view; if (i < 0) return;
  const s = seats[i], c = CONFIG.categories[s.cat];
  $('seatCard').classList.remove('hidden');
  $('scCat').textContent = catName(s.cat);
  $('scCat').style.background = c.color + '33'; $('scCat').style.color = c.color;
  $('scSec').textContent = s.cat === 'vip' ? `${t('vipBox')} ${s.sec.slice(1)}` : s.sec;
  $('scRow').textContent = s.row; $('scSeat').textContent = s.num;
  $('scPrice').textContent = fmt(priceOf(s.cat));
  const inCart = state.cart.has(i), sold = state.sold.has(s.id);
  const b = $('scBtn');
  b.disabled = sold; b.textContent = sold ? t('sold') : inCart ? t('remove') : t('add');
  b.className = 'btn ' + (inCart ? 'danger' : 'primary');
}

function toast(msg) {
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
  document.body.appendChild(el); setTimeout(() => el.remove(), 2600);
}

function toggleCart(i) {
  if (state.sold.has(seats[i].id)) return;
  if (state.cart.has(i)) state.cart.delete(i);
  else {
    if (state.cart.size >= CONFIG.maxSeatsPerOrder) return toast(t('limit').replace('{n}', CONFIG.maxSeatsPerOrder));
    state.cart.add(i);
  }
  paint(i); renderCart(); renderSections(); renderSeatCard();
  emit('cart', { eventId: state.event.id, seats: [...state.cart].map(seatInfo), total: cartTotal() });
}

// ---------- Sektor yorliqlari ----------
const labelEls = new Map();
for (const s of sections.values()) {
  const el = document.createElement('div');
  el.className = 'sec-label' + (s.cat === 'vip' ? ' vip' : '');
  el.textContent = s.label; $('labels').appendChild(el); labelEls.set(s.id, el);
}
const pv = new THREE.Vector3();
function updateLabels() {
  const show = state.mode === 'overview' && !tween;
  $('labels').style.display = show ? '' : 'none';
  if (!show) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  for (const s of sections.values()) {
    pv.copy(s.anchor).project(camera);
    const el = labelEls.get(s.id);
    if (pv.z > 1) { el.style.display = 'none'; continue; }
    el.style.display = '';
    el.style.left = ((pv.x + 1) / 2 * w) + 'px'; el.style.top = ((1 - pv.y) / 2 * h) + 'px';
  }
}

// ---------- Sichqoncha / sensor ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let pointer = null, needHover = false, downAt = null;
function pick(x, y) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObject(seatMesh, false)[0];
  return hit ? hit.instanceId : -1;
}
canvas.addEventListener('pointermove', (e) => { pointer = { x: e.clientX, y: e.clientY, type: e.pointerType }; needHover = true; });
canvas.addEventListener('pointerleave', () => { pointer = null; setHover(null); $('tooltip').classList.add('hidden'); });
canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener('pointerup', (e) => {
  if (!downAt || tween) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved > 6) return;
  const i = pick(e.clientX, e.clientY);
  if (i < 0) return;
  const s = seats[i];
  if (state.mode === 'overview') {
    const target = state.sold.has(s.id) ? bestSeat(s.sec, s) : i;
    if (target < 0) return toast(t('sold'));
    viewSeat(target);
  } else {
    if (i === state.view) return toggleCart(i);
    if (state.sold.has(s.id)) return toast(`${t('section')} ${s.sec}, ${t('row')} ${s.row}, ${t('seat')} ${s.num} — ${t('sold')}`);
    viewSeat(i);
  }
});

function setHover(secId) {
  if (secId === state.hoverSec) return;
  const old = state.hoverSec; state.hoverSec = secId;
  paintSection(old); paintSection(secId);
  canvas.style.cursor = secId ? 'pointer' : '';
}
function processHover() {
  if (!needHover || !pointer || tween) return;
  needHover = false;
  if (pointer.type === 'touch') return;
  const i = pick(pointer.x, pointer.y);
  const tip = $('tooltip');
  if (i < 0) { setHover(null); tip.classList.add('hidden'); return; }
  const s = seats[i];
  const r = canvas.getBoundingClientRect();
  tip.style.left = (pointer.x - r.left) + 'px'; tip.style.top = (pointer.y - r.top) + 'px';
  tip.classList.remove('hidden');
  if (state.mode === 'overview') {
    setHover(s.sec);
    const secName = s.cat === 'vip' ? `${t('vipBox')} ${s.sec.slice(1)}` : `${t('section')} ${s.sec}`;
    tip.innerHTML = `<b>${secName}</b><div class="muted">${catName(s.cat)}</div><div>${t('from')} <b>${fmt(priceOf(s.cat))}</b></div><div class="muted">${freeCount(s.sec)} ${t('free')}</div>`;
  } else {
    canvas.style.cursor = 'pointer';
    const sold = state.sold.has(s.id);
    tip.innerHTML = `<b>${t('row')} ${s.row} · ${t('seat')} ${s.num}</b><div class="muted">${t('section')} ${s.sec}</div><div>${sold ? t('sold') : fmt(priceOf(s.cat))}</div>`;
  }
}

// ---------- Panel hodisalari ----------
$('langs').addEventListener('click', (e) => {
  const l = e.target.dataset.lang; if (!l) return;
  state.lang = l; localStorage.setItem('ha_lang', l); applyI18n();
});
$('eventSel').addEventListener('change', (e) => loadEvent(e.target.value));
$('cats').addEventListener('click', (e) => {
  const c = e.target.closest('.cat'); if (!c) return;
  state.filterCat = state.filterCat === c.dataset.cat ? null : c.dataset.cat;
  paintAll(); renderCats();
});
$('secList').addEventListener('click', (e) => {
  const b = e.target.closest('.sec-btn'); if (!b) return;
  const i = bestSeat(b.dataset.sec); if (i < 0) return toast(t('sold'));
  viewSeat(i);
});
$('cartItems').addEventListener('click', (e) => {
  const rm = e.target.dataset.remove;
  if (rm !== undefined) { toggleCart(+rm); return; }
  const it = e.target.closest('.cart-item'); if (it) viewSeat(+it.dataset.seat);
});
$('backBtn').addEventListener('click', goOverview);
$('scBtn').addEventListener('click', () => toggleCart(state.view));
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.mode === 'seat') goOverview(); });

// ---------- Buyurtma ----------
function summaryHTML(idx) {
  return idx.map((i) => { const s = seats[i];
    return `<div><span>${t('section')} ${s.sec} · ${t('row')} ${s.row} · ${t('seat')} ${s.num}</span><b>${fmt(priceOf(s.cat))}</b></div>`; }).join('')
    + `<div class="sum"><span>${t('total')}</span><span>${fmt(idx.reduce((a, i) => a + priceOf(seats[i].cat), 0))}</span></div>`;
}
$('checkoutBtn').addEventListener('click', () => {
  $('orderSummary').innerHTML = summaryHTML([...state.cart]);
  $('orderForm').classList.remove('hidden'); $('doneBox').classList.add('hidden'); $('modal').classList.remove('hidden');
});
$('cancelBtn').addEventListener('click', () => $('modal').classList.add('hidden'));
$('doneBtn').addEventListener('click', () => $('modal').classList.add('hidden'));
$('orderForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const idx = [...state.cart];
  const order = { eventId: state.event.id, seats: idx.map(seatInfo), total: cartTotal(), currency: 'UZS',
    customer: { name: fd.get('name'), phone: fd.get('phone') }, lang: state.lang };
  let orderId = 'HA-' + Date.now().toString(36).toUpperCase().slice(-6), paymentUrl = null;
  if (CONFIG.checkoutUrl) {
    try {
      const r = await fetch(CONFIG.checkoutUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order) });
      const j = await r.json(); orderId = j.orderId || orderId; paymentUrl = j.paymentUrl || null;
    } catch (err) { toast('Xatolik: ' + err.message); return; }
  }
  emit('checkout', { order: { ...order, orderId } });
  if (paymentUrl) { (isEmbedded ? window.top : window).location.href = paymentUrl; return; }
  for (const i of idx) state.sold.add(seats[i].id);
  state.cart.clear();
  $('orderNo').textContent = orderId; $('doneSummary').innerHTML = summaryHTML(idx);
  $('orderForm').classList.add('hidden'); $('doneBox').classList.remove('hidden');
  e.target.reset();
  paintAll(); renderCart(); renderSections(); renderSeatCard();
});

// ---------- Tadbir va bandlik ----------
function hashStr(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
function demoSold(ev) {
  const r = rng(hashStr(ev.id)), out = new Set();
  const factor = { vip: 0.8, parter_a: 1.25, parter_b: 1, tribuna_a: 0.95, tribuna_b: 0.75 };
  // Qatorlar bo'yicha "to'lqin" — haqiqiy sotuvga o'xshash guruhlangan band joylar
  for (const s of seats) {
    const wave = 0.5 + 0.5 * Math.sin(s.num * 0.35 + s.row * 0.9 + hashStr(s.sec) % 7);
    if (r() < ev.soldRatio * factor[s.cat] * (0.55 + wave * 0.9)) out.add(s.id);
  }
  return out;
}
async function loadEvent(id) {
  const ev = CONFIG.events.find((e) => e.id === id) || CONFIG.events[0];
  state.event = ev; state.cart.clear();
  state.sold = demoSold(ev);
  if (CONFIG.availabilityUrl) {
    try { const j = await (await fetch(CONFIG.availabilityUrl.replace('{event}', encodeURIComponent(ev.id)))).json(); state.sold = new Set(j.sold || []); }
    catch (err) { console.warn('availability', err); }
  }
  arena.setEventKind(ev.kind);
  paintAll(); applyI18n();
  if (state.mode === 'seat') goOverview();
  emit('event', { eventId: ev.id });
}
function updateScoreboard() {
  if (!state.event) return;
  arena.setScoreboard(state.event.title[state.lang] || state.event.title.uz, fmtDate(state.event.date));
}

// Tashqi sayt bilan aloqa (iframe ichida)
window.addEventListener('message', (e) => {
  const m = e.data || {};
  if (m.type === 'humo:setSold') { state.sold = new Set(m.sold || []); for (const i of [...state.cart]) if (state.sold.has(seats[i].id)) state.cart.delete(i); paintAll(); renderSections(); renderCart(); renderSeatCard(); }
  if (m.type === 'humo:setEvent') loadEvent(m.eventId);
  if (m.type === 'humo:setLang' && STR[m.lang]) { state.lang = m.lang; applyI18n(); }
});

// ---------- O'lcham va kadr sikli ----------
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  OVERVIEW.pos.set(0, 68, 72).multiplyScalar(w / h < 1 ? 1.75 : w / h < 1.4 ? 1.25 : 1);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);
resize();

function frame(now) {
  stepTween(now);
  arena.ceiling.visible = camera.position.y < arena.roofY - 1;
  if (!tween) controls.update();
  processHover();
  updateLabels();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

loadEvent(params.get('event') || CONFIG.events[0].id).then(() => {
  $('loading').classList.add('hidden');
  controls.target.set(0, 0, 0);
  flyTo(OVERVIEW.pos.clone(), OVERVIEW.target.clone(), OVERVIEW.fov, 2200, setControlsOverview);
  requestAnimationFrame(frame);
  emit('ready', { seats: seats.length, sections: sections.size });
  window.__arena = { state, seats, sections, viewSeat, goOverview, toggleCart };
});
