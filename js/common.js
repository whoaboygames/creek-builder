/* Bush Drift: Creek Builder. Shared by the three pages: the title, the game's data, the pieces kept in this browser,
 * the checks on a piece that came from outside (a link or a file), the share link's code, and a piece written out as
 * the game reads it. Nothing here talks to anything but this site's own files. */
(function (root) {
'use strict';
const BD = {};

BD.TITLE = 'Bush Drift: Creek Builder';      // the one place the name lives: every page takes it from here

// The builder's own limits. A piece from a link or a file is held to exactly these.
BD.MAX_OBJECTS = 200;
BD.MAX_GATES = 7;
BD.MAX_NAME = 80;
BD.MAX_NOTES = 4000;
BD.MAX_ORDER = 99;
BD.MAX_LOOSE = 16;            // loose logs a piece (the game's own limit)
BD.LOOSE_MIN = 0.4;           // a loose log can be made smaller than a fixed one
BD.canLoose = id => id === 'log0' || id === 'log1';      // only the two small logs can be loose so far
BD.MAX_CODE = 30000;        // characters of a share link's code (a full piece with long notes is far under this)
BD.MAX_BYTES = 20000;       // bytes of a piece once unpacked

// The six stretches of creek a piece can sit on (the game's own six, in its order), by plain name.
BD.PLACES = ['Wide and flat', 'Easy bend', 'Gentle run', 'Straight run', 'Steep and narrow', 'The drop'];
BD.placeName = slot => BD.PLACES[slot] || 'Stretch of creek';

// Every rock and log a share link can name, by number. ONLY EVER ADD TO THE END: a link made last year must still mean
// the same rocks. (make-site.py says so when the game has a rock that is not listed here.)
BD.SHARE_IDS = ['stone0', 'stone1', 'stone2', 'boulder0', 'boulder1', 'boulder2', 'rkslab0', 'rkslab1', 'rkslab2',
  'rkpad0', 'rkpad1', 'rkpad2', 'rkblock0', 'rkblock1', 'rkblock2', 'rkwedge0', 'rkwedge1', 'rkwedge2',
  'rkstep0', 'rkstep1', 'rkstep2', 'rkstair0', 'rkstair1', 'rkspine', 'rkledge', 'log0', 'log1', 'stump0', 'stump1',
  'tree0', 'tree1'];
BD.SHARE_GRADES = ['green', 'blue', 'black'];

class Bad extends Error {}      // a piece that can't be used; its message is written for the person looking at the page
BD.Bad = Bad;

const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
const r2 = v => Math.round(v * 100) / 100 + 0, r1 = v => Math.round(v * 10) / 10 + 0;      // (+ 0: never a minus zero)
BD.normYaw = y => { y = ((y + 180) % 360 + 360) % 360 - 180; if (y === -180) y = 180; return r1(y); };

// ---------- the game's data (this site's own two files) ----------
BD.A = null; BD.CV = null; BD.assetById = Object.create(null); BD.spotBySlot = Object.create(null);
BD.base = '';      // where the site's top folder is from the page ('' or '../'); the page sets it
BD.loadData = async function () {
  const get = async f => { const r = await fetch(BD.base + 'data/' + f); if (!r.ok) throw new Error('missing ' + f); return r.json(); };
  const [A, CV] = await Promise.all([get('assets.json'), get('canvas.json')]);
  A.assets = A.assets || []; A.gates = A.gates || {};
  BD.A = A; BD.CV = CV;
  for (const a of A.assets) BD.assetById[a.id] = a;
  for (const s of CV.spots || []) BD.spotBySlot[s.slot] = s;
  return {A, CV};
};

// ---------- the checks: a piece from a link, a file or this browser's own storage ----------
// Strict: anything that is not exactly what the builder itself could have made is refused, never repaired. Returns a
// fresh piece holding only the known fields. (Text is only ever put on a page as text, never as HTML.)
function num(v, lo, hi, what) {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Bad('One of its ' + what + ' is not a number.');
  if (v < lo - 1e-9 || v > hi + 1e-9) throw new Bad('One of its ' + what + ' is outside what the builder allows.');
  return Math.min(hi, Math.max(lo, v));
}
BD.cleanName = function (v) {
  if (typeof v !== 'string') throw new Bad('Its name is not text.');
  if (v.length > BD.MAX_NAME * 4) throw new Bad('Its name is too long.');
  const s = v.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ').split(/\s+/).filter(Boolean).join(' ');
  if (s.length > BD.MAX_NAME) throw new Bad('Its name is too long.');
  return s || 'A piece with no name';
};
BD.cleanNotes = function (v) {
  if (v == null) return '';
  if (typeof v !== 'string') throw new Bad('Its notes are not text.');
  if (v.length > BD.MAX_NOTES) throw new Bad('Its notes are too long.');
  return v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u2028\u2029]/g, ' ');
};
BD.check = function (p) {
  if (!BD.A || !BD.CV) throw new Error('data not loaded');
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Bad('That is not a creek piece.');
  if (p.format != null && p.format !== 1) throw new Bad('That piece was made with a newer builder than this one.');
  const slot = p.slot;
  if (!Number.isInteger(slot) || slot < 0 || slot > 5 || !BD.spotBySlot[slot]) throw new Bad('It sits on a stretch of creek this builder does not have.');
  const sp = BD.spotBySlot[slot], L = sp.length, lo = Math.min.apply(null, sp.offs), hi = Math.max.apply(null, sp.offs);
  const objs = p.objects == null ? [] : p.objects, gates = p.gates == null ? [] : p.gates;
  if (!Array.isArray(objs) || !Array.isArray(gates)) throw new Bad('That is not a creek piece.');
  if (objs.length > BD.MAX_OBJECTS) throw new Bad('It has more rocks and logs than a piece can hold (' + BD.MAX_OBJECTS + ').');
  if (gates.length > BD.MAX_GATES) throw new Bad('It has more gates than a piece can hold (' + BD.MAX_GATES + ').');
  const out = {format: 1, name: BD.cleanName(p.name == null ? '' : p.name), notes: BD.cleanNotes(p.notes), slot, objects: [], gates: []};
  let nloose = 0;
  for (const o of objs) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Bad('That is not a creek piece.');
    if (!own(BD.assetById, o.asset)) throw new Bad('It uses a rock or log this builder does not have.');
    const a = BD.assetById[o.asset], sc = a.scale || {min: 1, max: 1, def: 1};
    if (o.loose != null && typeof o.loose !== 'boolean') throw new Bad('That is not a creek piece.');
    const loose = o.loose === true && BD.canLoose(a.id);      // (a loose log: the ute can push it, roll it and run over it)
    if (loose && ++nloose > BD.MAX_LOOSE) throw new Bad('It has more loose logs than a piece can hold (' + BD.MAX_LOOSE + ').');
    const q = {asset: a.id, ds: r2(num(o.ds, 0, L, 'positions')), off: r2(num(o.off, lo, hi, 'positions')),
      yaw: BD.normYaw(num(o.yaw == null ? 0 : o.yaw, -360, 360, 'angles')), scale: r2(num(o.scale == null ? sc.def : o.scale, loose ? Math.min(sc.min, BD.LOOSE_MIN) : sc.min, sc.max, 'sizes'))};
    if (loose) q.loose = true;
    if (o.order != null && o.order !== 0) {
      if (!Number.isInteger(o.order) || o.order < 0 || o.order > BD.MAX_ORDER) throw new Bad('One of its stacking levels is outside what the builder allows.');
      q.order = o.order;
    }
    out.objects.push(q);
  }
  for (const g of gates) {
    if (!g || typeof g !== 'object' || Array.isArray(g)) throw new Bad('That is not a creek piece.');
    if (!own(BD.A.gates, g.grade)) throw new Bad('It has a kind of gate this builder does not have.');
    const gd = BD.A.gates[g.grade];
    out.gates.push({grade: g.grade, ds: r2(num(g.ds, 0, L, 'positions')), off: r2(num(g.off, lo, hi, 'positions')),
      width: r2(num(g.width == null ? gd.width : g.width, gd.min, gd.max, 'gate widths'))});
  }
  if (p.ute != null) {
    const u = p.ute;
    if (typeof u !== 'object' || Array.isArray(u)) throw new Bad('That is not a creek piece.');
    out.ute = {ds: r2(num(u.ds, 0, L, 'positions')), off: r2(num(u.off, lo, hi, 'positions')), yaw: BD.normYaw(num(u.yaw == null ? 0 : u.yaw, -360, 360, 'angles'))};
  }
  return out;
};

// ---------- the pieces kept in this browser ----------
const KEY = 'bdcb:piece:';
const ID_OK = /^[a-z0-9][a-z0-9-]{0,40}$/;
const store = BD.store = {};
store.ok = function () { try { const k = 'bdcb:probe'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; } catch (e) { return false; } };
store.newId = function () { return 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1679616).toString(36).padStart(4, '0'); };
store.get = function (id) {      // a kept piece, checked; null when it is not there or no longer makes sense
  if (!ID_OK.test(String(id || ''))) return null;
  let raw = null; try { raw = localStorage.getItem(KEY + id); } catch (e) { return null; }
  if (!raw) return null;
  try { const j = JSON.parse(raw), p = BD.check(j); p.id = id; p.updated = typeof j.updated === 'number' && Number.isFinite(j.updated) ? j.updated : 0; return p; } catch (e) { return null; }
};
store.put = function (id, piece) {      // (throws when the browser will not keep it: the page says so)
  const p = BD.check(piece); p.id = id; p.updated = Date.now();
  localStorage.setItem(KEY + id, JSON.stringify(p));
  return p;
};
store.add = function (piece) { return store.put(store.newId(), piece); };
store.remove = function (id) { try { localStorage.removeItem(KEY + id); } catch (e) {} };
store.list = function () {      // newest first
  const out = [];
  let keys = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(KEY)) keys.push(k.slice(KEY.length)); } } catch (e) {}
  for (const id of keys) { const p = store.get(id); if (p) out.push(p); }
  return out.sort((a, b) => b.updated - a.updated);
};
store.key = id => KEY + id;
BD.blank = (name, slot) => ({format: 1, name, notes: '', slot, objects: [], gates: []});

// ---------- a piece as a small file (a backup, or to hand to someone) ----------
BD.slug = function (name) {
  const s = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36).replace(/-+$/, '');
  return s || 'piece';
};
BD.toFile = function (piece) {
  const p = BD.check(piece);
  return JSON.stringify(Object.assign({app: 'bush-drift-creek-builder'}, p), null, 1) + '\n';
};
BD.fromFile = function (text) {
  if (typeof text !== 'string' || text.length > 2000000) throw new Bad('That file is too big to be a creek piece.');
  let j; try { j = JSON.parse(text); } catch (e) { throw new Bad('That file is not a creek piece.'); }
  return BD.check(j);
};

// ---------- the share link: the whole piece in the part of the address after the #, which browsers never send anywhere ----------
// The piece is packed into a few bytes (below), squeezed when that makes it shorter, and written in the web-safe
// alphabet. First letter: 'a' packed only, 'b' packed and squeezed.
const b64 = {
  to(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 3000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 3000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  from(s) {
    if (!/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) throw new Bad('The link is damaged.');
    let bin; try { bin = atob(s.replace(/-/g, '+').replace(/_/g, '/')); } catch (e) { throw new Bad('The link is damaged.'); }
    const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
};
async function through(bytes, stream, cap) {
  const reader = new Blob([bytes]).stream().pipeThrough(stream).getReader(), parts = []; let n = 0;
  for (;;) {
    const {done, value} = await reader.read(); if (done) break;
    n += value.length; if (cap && n > cap) { try { reader.cancel(); } catch (e) {} throw new Bad('The link holds more than a creek piece can.'); }
    parts.push(value);
  }
  const out = new Uint8Array(n); let at = 0; for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
// The bytes: 1 (the version), the stretch of creek, 1 when the ute's outline is kept, how many rocks, how many gates,
// the name and the notes (each a two-byte length then UTF-8), then per rock: its number in SHARE_IDS, cm down the creek,
// cm across, tenths of a degree, size in hundredths, stacking level (plus 128 for a loose log); per gate: grade, cm down, cm across, cm wide; the ute.
BD.pack = function (piece) {
  const p = BD.check(piece), enc = new TextEncoder(), name = enc.encode(p.name), notes = enc.encode(p.notes);
  const buf = new DataView(new ArrayBuffer(9 + name.length + notes.length + 9 * p.objects.length + 7 * p.gates.length + (p.ute ? 6 : 0)));
  let k = 0; const u8 = v => { buf.setUint8(k, v); k += 1; }, u16 = v => { buf.setUint16(k, v); k += 2; }, i16 = v => { buf.setInt16(k, v); k += 2; };
  const txt = b => { u16(b.length); new Uint8Array(buf.buffer).set(b, k); k += b.length; };
  u8(1); u8(p.slot); u8(p.ute ? 1 : 0); u8(p.objects.length); u8(p.gates.length); txt(name); txt(notes);
  for (const o of p.objects) {
    const n = BD.SHARE_IDS.indexOf(o.asset), sc = Math.round(o.scale * 100);
    if (n < 0 || sc > 255) throw new Bad('This piece uses something a link cannot carry yet. Save it as a file instead.');
    u8(n); u16(Math.round(o.ds * 100)); i16(Math.round(o.off * 100)); i16(Math.round(o.yaw * 10)); u8(sc); u8((o.order || 0) + (o.loose ? 128 : 0));
  }
  for (const g of p.gates) { u8(BD.SHARE_GRADES.indexOf(g.grade)); u16(Math.round(g.ds * 100)); i16(Math.round(g.off * 100)); u16(Math.round(g.width * 100)); }
  if (p.ute) { u16(Math.round(p.ute.ds * 100)); i16(Math.round(p.ute.off * 100)); i16(Math.round(p.ute.yaw * 10)); }
  return new Uint8Array(buf.buffer);
};
BD.unpack = function (bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 9 || bytes.length > BD.MAX_BYTES) throw new Bad('The link is damaged or cut short.');
  const buf = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), dec = new TextDecoder('utf-8', {fatal: true});
  let k = 0;
  try {
    const u8 = () => { const v = buf.getUint8(k); k += 1; return v; }, u16 = () => { const v = buf.getUint16(k); k += 2; return v; }, i16 = () => { const v = buf.getInt16(k); k += 2; return v; };
    const txt = () => { const n = u16(); if (k + n > bytes.length) throw new RangeError('short'); const s = dec.decode(bytes.subarray(k, k + n)); k += n; return s; };
    if (u8() !== 1) throw new Bad('That link was made with a newer builder than this one.');
    const slot = u8(), hasUte = u8(), no = u8(), ng = u8();
    if (hasUte > 1) throw new Bad('The link is damaged.');
    if (no > BD.MAX_OBJECTS) throw new Bad('It has more rocks and logs than a piece can hold (' + BD.MAX_OBJECTS + ').');
    if (ng > BD.MAX_GATES) throw new Bad('It has more gates than a piece can hold (' + BD.MAX_GATES + ').');
    const p = {format: 1, slot, name: txt(), notes: txt(), objects: [], gates: []};
    for (let i = 0; i < no; i++) {
      const n = u8(); if (n >= BD.SHARE_IDS.length) throw new Bad('It uses a rock or log this builder does not have.');
      const o = {asset: BD.SHARE_IDS[n], ds: u16() / 100, off: i16() / 100, yaw: i16() / 10, scale: u8() / 100}, ob = u8(), ord = ob & 127;
      if (ord) o.order = ord;
      if (ob & 128) { if (!BD.canLoose(o.asset)) throw new Bad('The link is damaged.'); o.loose = true; }
      p.objects.push(o);
    }
    for (let i = 0; i < ng; i++) {
      const n = u8(); if (n >= BD.SHARE_GRADES.length) throw new Bad('It has a kind of gate this builder does not have.');
      p.gates.push({grade: BD.SHARE_GRADES[n], ds: u16() / 100, off: i16() / 100, width: u16() / 100});
    }
    if (hasUte) p.ute = {ds: u16() / 100, off: i16() / 100, yaw: i16() / 10};
    if (k !== bytes.length) throw new Bad('The link is damaged.');
    return BD.check(p);      // every number against the builder's own ranges
  } catch (e) {
    if (e instanceof Bad) throw e;
    throw new Bad('The link is damaged or cut short.');      // (ran off the end, or text that is not text)
  }
};
BD.encode = async function (piece) {      // -> the code for after the #
  const raw = BD.pack(piece); let code = 'a' + b64.to(raw);
  if (typeof CompressionStream === 'function') {
    try { const z = 'b' + b64.to(await through(raw, new CompressionStream('deflate-raw'))); if (z.length < code.length) code = z; } catch (e) {}
  }
  return code;
};
BD.decode = async function (code) {      // the code from after the # -> a checked piece, or a Bad with a plain message
  if (typeof code !== 'string' || !code) throw new Bad('There is no piece in that link.');
  if (code.length > BD.MAX_CODE) throw new Bad('The link holds more than a creek piece can.');
  const kind = code[0]; let bytes = b64.from(code.slice(1));
  if (kind === 'b') {
    if (typeof DecompressionStream !== 'function') throw new Bad('This browser is too old to open that link. Try a newer one.');
    try { bytes = await through(bytes, new DecompressionStream('deflate-raw'), BD.MAX_BYTES); }
    catch (e) { if (e instanceof Bad) throw e; throw new Bad('The link is damaged or cut short.'); }
  } else if (kind !== 'a') throw new Bad('That link was made with a newer builder than this one, or it is damaged.');
  return BD.unpack(bytes);
};
BD.shareUrl = async function (piece) { return new URL(BD.base + 'play/', location.href).href.split('#')[0].split('?')[0] + '#' + await BD.encode(piece); };

// ---------- a piece as the game reads it: the same text, to the letter, as the game's own tools/setpiece_import.py ----------
// Python's "%.2f": a number written to d places, a half going to the even digit (JavaScript's toFixed sends it up).
function pyf(x, d) {
  if (!Number.isFinite(x)) return Number.isNaN(x) ? 'nan' : x < 0 ? '-inf' : 'inf';
  const neg = x < 0 || Object.is(x, -0), m = Math.abs(x), long = m.toFixed(d + 40), tail = long.slice(-40);
  let s = m.toFixed(d);
  if (tail === '5' + '0'.repeat(39)) { const down = long.slice(0, -40); if ('02468'.includes(down[down.length - 1])) s = down; }
  return (neg ? '-' : '') + s;
}
BD.pyf = pyf;
const T_STONE = 0, T_STUMP = 1, T_SMALLLOG = 3, T_MOSSY = 4, T_BOULDER = 5;
function thing(a, scale) {      // (type, var, l, r, h) as the game's generators would give it: setpiece_assets.py's thing()
  const typ = a.thing[0], v = a.thing[1], half = a.thing[2], s = Math.max(a.scale.min, Math.min(a.scale.max, scale));
  if (typ === T_STONE) { const r = s * [0.35, 0.5, 0.7][v] / 1.1; return [typ, v, 0.0, r, r * 0.6]; }
  if (typ === T_BOULDER) { const r = s * (v === 0 ? 0.7 : 1.0); return [typ, v, 0.0, r, r * 0.75]; }
  if (typ === T_STUMP) { const r = s * 0.4; return [typ, v, 0.0, r, r * 1.5]; }
  if (typ === T_SMALLLOG) { const r = s * (v ? 0.16 : 0.2); return [typ, v, half * s, r, 2.0 * r]; }
  if (typ === T_MOSSY) return [typ, v, half * s, 0.5 * s, s];
  return [typ, v, 0.0, s, 0.0];
}
const gclean = (s, n) => String(s || '').replace(/[^ -~]/g, '').replace(/"/g, "'").replace(/\\/g, '/').replace(/\s+/g, ' ').trim().slice(0, n);
const KIND = {blue: 0, black: 1, green: 2};
BD.gameText = function (p, id) {      // p: a checked piece (or a layout file as the game's tool takes it)
  const pid = String(id || p.id || 'piece').replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 40) || 'piece';
  const name = gclean(p.name, 60) || pid, lines = ['piece ' + Math.trunc(p.slot) + ' ' + pid + ' ' + name];
  let n = 0, gates = 0, nloose = 0;
  for (const o of p.objects || []) {
    if (!own(BD.assetById, o.asset)) continue;
    if (n >= 200) break;
    const a = BD.assetById[o.asset], sc = o.scale == null ? 1.0 : +o.scale, t = thing(a, sc);
    let loose = !!o.loose && t[0] === T_SMALLLOG;
    if (loose && nloose >= BD.MAX_LOOSE) loose = false;      // (any more stay fixed, as the game's tool has it)
    if (loose) { nloose++; if (sc < a.scale.min) { const k = Math.max(BD.LOOSE_MIN, sc) / a.scale.min; t[2] *= k; t[3] *= k; t[4] *= k; } }
    const ds = Math.max(-4.0, Math.min(62.0, +(o.ds || 0))), off = Math.max(-12.0, Math.min(12.0, +(o.off || 0)));
    let order = Math.trunc(+(o.order || 0)); order = Number.isFinite(order) ? Math.max(0, Math.min(99, order)) : 0;
    lines.push('thing ' + t[0] + ' ' + t[1] + ' ' + pyf(ds, 2) + ' ' + pyf(off, 2) + ' ' + pyf(+(o.yaw || 0), 1) + ' ' + pyf(t[2], 3) + ' ' + pyf(t[3], 3) + ' ' + pyf(t[4], 3) + (order > 0 || loose ? ' ' + order : '') + (loose ? ' loose' : ''));
    n++;
  }
  for (const g of p.gates || []) {
    if (gates >= 7) break;
    const k = own(KIND, String(g.grade == null ? 'blue' : g.grade).toLowerCase()) ? KIND[String(g.grade == null ? 'blue' : g.grade).toLowerCase()] : 0;
    const hw = Math.max(1.0, Math.min(4.0, 0.5 * +(g.width == null ? 3.5 : g.width)));
    lines.push('gate ' + k + ' ' + pyf(+(g.ds || 0), 2) + ' ' + pyf(+(g.off || 0), 2) + ' ' + pyf(hw, 2));
    gates++;
  }
  return lines.join('\n') + '\n';
};

// ---------- small things for the pages ----------
BD.el = function (tag, props, kids) {      // an element with text children only: nothing from a piece is ever parsed as HTML
  const e = document.createElement(tag);
  if (props) for (const k of Object.keys(props)) { if (k === 'class') e.className = props[k]; else if (k === 'text') e.textContent = props[k]; else if (k.startsWith('data-')) e.setAttribute(k, props[k]); else e[k] = props[k]; }
  for (const c of kids || []) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  return e;
};
BD.titles = function (page) {      // the name into the tab and wherever the page shows it
  document.title = (page ? page + ' - ' : '') + BD.TITLE;
  document.querySelectorAll('[data-title]').forEach(e => { e.textContent = BD.TITLE; });
};
BD.download = function (blob, name) {
  const a = document.createElement('a'), url = URL.createObjectURL(blob);
  a.href = url; a.download = name; a.style.display = 'none'; document.body.appendChild(a); a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 4000);
};
BD.copy = async function (text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
  try { const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return ok; } catch (e) { return false; }
};

root.BD = BD;
})(typeof window !== 'undefined' ? window : globalThis);
