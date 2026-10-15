/* ==========================================================================
   QwenOS 3.0 — core.js
   Ядро: утилиты, шина событий, хранилище, настройки, иконки, реестр приложений
   ========================================================================== */
(function (global) {
  'use strict';

  const OS = {
    version: '3.0.0',
    codename: 'Aurora',
    kernel: 'qwen-kernel 6.1.0-web',
    build: new Date().toISOString().slice(0, 10),
    buildNumber: 3023,
    startedAt: Date.now()
  };
  global.OS = OS;

  /* ---------------------------------------------------------------- utils */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const uid = (p) => (p || 'id') + '_' + Math.random().toString(36).slice(2, 9);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rndi = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const pad = (n, l) => String(n).padStart(l || 2, '0');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function el(tag, attrs, kids) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    if (kids) (Array.isArray(kids) ? kids : [kids]).forEach((c) => { if (c != null) n.append(c.nodeType ? c : document.createTextNode(c)); });
    return n;
  }

  function debounce(fn, ms) { let t; return function () { clearTimeout(t); const a = arguments, s = this; t = setTimeout(() => fn.apply(s, a), ms || 200); }; }
  function throttle(fn, ms) { let last = 0, t; return function () { const a = arguments, s = this, now = Date.now(); const run = () => { last = Date.now(); fn.apply(s, a); }; if (now - last >= (ms || 100)) run(); else { clearTimeout(t); t = setTimeout(run, ms - (now - last)); } }; }

  const fmtBytes = (b) => {
    if (b == null || isNaN(b)) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; let n = Number(b);
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return (i === 0 ? n : n.toFixed(n < 10 ? 2 : 1)) + ' ' + u[i];
  };
  const fmtDur = (ms) => {
    const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    if (d) return d + 'д ' + h + 'ч';
    if (h) return h + 'ч ' + m + 'м';
    if (m) return m + 'м ' + (s % 60) + 'с';
    return s + 'с';
  };
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const DAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const fmtDate = (d) => { d = d || new Date(); return DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); };
  const fmtDateTime = (t) => { const d = new Date(t); return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };

  function download(name, data, mime) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'text/plain;charset=utf-8' });
    const a = el('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function copyText(txt) {
    try {
      if (navigator.clipboard && global.isSecureContext) return navigator.clipboard.writeText(txt);
    } catch (e) { /* fallthrough */ }
    return new Promise((res) => {
      const ta = el('textarea', { style: { position: 'fixed', left: '-9999px' } });
      ta.value = txt; document.body.append(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) { /* noop */ }
      ta.remove(); res();
    });
  }

  OS.$ = $; OS.$$ = $$; OS.el = el; OS.uid = uid; OS.clamp = clamp; OS.rnd = rnd; OS.rndi = rndi;
  OS.pick = pick; OS.pad = pad; OS.esc = esc; OS.sleep = sleep; OS.debounce = debounce; OS.throttle = throttle;
  OS.fmtBytes = fmtBytes; OS.fmtDur = fmtDur; OS.fmtDate = fmtDate; OS.fmtDateTime = fmtDateTime;
  OS.download = download; OS.copyText = copyText; OS.MONTHS = MONTHS; OS.DAYS = DAYS;
  OS.isTouch = typeof global.matchMedia === 'function'
    ? global.matchMedia('(pointer: coarse)').matches
    : ('ontouchstart' in global || (global.navigator && navigator.maxTouchPoints > 0));
  OS.isMobile = global.innerWidth < 720;

  /* ------------------------------------------------------------------ bus */
  const Bus = {
    _m: new Map(),
    on(ev, fn) { if (!this._m.has(ev)) this._m.set(ev, new Set()); this._m.get(ev).add(fn); return () => this.off(ev, fn); },
    off(ev, fn) { const s = this._m.get(ev); if (s) s.delete(fn); },
    emit(ev, data) { const s = this._m.get(ev); if (s) s.forEach((f) => { try { f(data); } catch (e) { console.error('[bus:' + ev + ']', e); } }); const w = this._m.get('*'); if (w) w.forEach((f) => f(ev, data)); }
  };
  OS.bus = Bus;

  /* ---------------------------------------------------------------- store */
  const mem = new Map();
  let lsOK = true;
  try { localStorage.setItem('__qwen_probe', '1'); localStorage.removeItem('__qwen_probe'); } catch (e) { lsOK = false; }

  const Store = {
    available: lsOK,
    key: (k) => 'qwenos.v3.' + k,
    get(k, dflt) {
      try {
        const raw = lsOK ? localStorage.getItem(this.key(k)) : mem.get(this.key(k));
        if (raw == null) return dflt;
        return JSON.parse(raw);
      } catch (e) { return dflt; }
    },
    set(k, v) {
      const raw = JSON.stringify(v);
      try { if (lsOK) localStorage.setItem(this.key(k), raw); else mem.set(this.key(k), raw); }
      catch (e) { mem.set(this.key(k), raw); console.warn('[store] quota/err, using memory', e); }
      return v;
    },
    del(k) { try { if (lsOK) localStorage.removeItem(this.key(k)); mem.delete(this.key(k)); } catch (e) { /* noop */ } },
    usage() {
      let total = 0;
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf('qwenos') === 0) total += (localStorage.getItem(k) || '').length + k.length; } } catch (e) { /* noop */ }
      return total;
    },
    clearAll() {
      try { const ks = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf('qwenos') === 0) ks.push(k); } ks.forEach((k) => localStorage.removeItem(k)); } catch (e) { /* noop */ }
      mem.clear();
    }
  };
  OS.store = Store;

  /* ------------------------------------------------------------- settings */
  const WALLS = [
    { id: 'aurora', name: 'Aurora', css: 'radial-gradient(1100px 700px at 18% 12%, #4c1d95 0%, transparent 55%), radial-gradient(900px 600px at 82% 22%, #0e7490 0%, transparent 52%), radial-gradient(1000px 800px at 60% 95%, #312e81 0%, transparent 60%), linear-gradient(160deg,#0a0a1f,#05060d 70%)', fx: 'blobs' },
    { id: 'sunset', name: 'Закат', css: 'radial-gradient(900px 620px at 50% 108%, #ff7a45 0%, transparent 60%), radial-gradient(700px 500px at 20% 10%, #7c2d92 0%, transparent 55%), linear-gradient(180deg,#2b1055,#7597de 55%,#ff9a6b)', fx: 'none' },
    { id: 'ocean', name: 'Океан', css: 'radial-gradient(1000px 700px at 30% 0%, #0ea5e9 0%, transparent 55%), radial-gradient(900px 700px at 90% 100%, #164e63 0%, transparent 60%), linear-gradient(180deg,#04121f,#06263a 60%,#04121f)', fx: 'blobs' },
    { id: 'forest', name: 'Лес', css: 'radial-gradient(900px 600px at 25% 15%, #14532d 0%, transparent 55%), radial-gradient(800px 700px at 85% 85%, #064e3b 0%, transparent 58%), linear-gradient(150deg,#04140e,#0a2a1c 60%,#03100b)', fx: 'none' },
    { id: 'neon', name: 'Неон-сити', css: 'linear-gradient(180deg,#12002b 0%,#2a0a4a 40%,#0a0620 100%), repeating-linear-gradient(90deg, rgba(255,0,200,.07) 0 2px, transparent 2px 60px)', fx: 'grid' },
    { id: 'cosmos', name: 'Космос', css: 'radial-gradient(700px 500px at 70% 30%, #1e1b4b 0%, transparent 60%), linear-gradient(180deg,#01010a,#0a0620 70%,#01010a)', fx: 'stars' },
    { id: 'candy', name: 'Карамель', css: 'radial-gradient(800px 600px at 20% 20%, #fbcfe8 0%, transparent 55%), radial-gradient(800px 600px at 80% 30%, #c7d2fe 0%, transparent 55%), linear-gradient(160deg,#fdf2f8,#eef2ff 60%,#ecfeff)', fx: 'none' },
    { id: 'sand', name: 'Дюны', css: 'radial-gradient(900px 600px at 30% 100%, #fbbf24 0%, transparent 55%), linear-gradient(160deg,#7c2d12,#b45309 45%,#fcd34d)', fx: 'none' },
    { id: 'mono', name: 'Графит', css: 'radial-gradient(900px 700px at 50% 0%, #2a2a2a 0%, transparent 60%), linear-gradient(180deg,#111,#1c1c1c 60%,#0a0a0a)', fx: 'none' },
    { id: 'mint', name: 'Мята', css: 'radial-gradient(900px 650px at 75% 15%, #5eead4 0%, transparent 55%), radial-gradient(800px 600px at 15% 85%, #0f766e 0%, transparent 55%), linear-gradient(160deg,#042f2e,#0f766e 60%,#ccfbf1)', fx: 'blobs' },
    { id: 'rose', name: 'Роза', css: 'radial-gradient(900px 700px at 25% 20%, #9f1239 0%, transparent 55%), radial-gradient(800px 600px at 85% 80%, #4c0519 0%, transparent 60%), linear-gradient(160deg,#1a0410,#4c0519 60%,#1a0410)', fx: 'blobs' },
    { id: 'blueprint', name: 'Чертёж', css: 'linear-gradient(180deg,#0b2545,#13315c 60%,#0b2545), repeating-linear-gradient(0deg, rgba(255,255,255,.06) 0 1px, transparent 1px 32px), repeating-linear-gradient(90deg, rgba(255,255,255,.06) 0 1px, transparent 1px 32px)', fx: 'grid' }
  ];
  OS.wallpapers = WALLS;

  const ACCENTS = [
    { id: 'violet', name: 'Фиолет', a: '#8b5cf6', b: '#06b6d4' },
    { id: 'blue', name: 'Синий', a: '#3b82f6', b: '#22d3ee' },
    { id: 'green', name: 'Зелёный', a: '#22c55e', b: '#84cc16' },
    { id: 'amber', name: 'Янтарь', a: '#f59e0b', b: '#ef4444' },
    { id: 'pink', name: 'Розовый', a: '#ec4899', b: '#8b5cf6' },
    { id: 'red', name: 'Красный', a: '#ef4444', b: '#f97316' },
    { id: 'teal', name: 'Бирюза', a: '#14b8a6', b: '#3b82f6' },
    { id: 'mono', name: 'Графит', a: '#e5e5e5', b: '#9ca3af' }
  ];
  OS.accents = ACCENTS;

  const DEFAULTS = {
    theme: 'aurora', accent: 'violet', wallpaper: 'aurora', wallpaperFx: true,
    uiScale: 1, motion: true, sound: true, volume: 0.5, muted: false,
    user: 'user', avatarText: 'Q', clock24: true, widgets: ['clock', 'weather'],
    installed: [], pinned: ['browser', 'steam'],
    desktopIcons: true, tips: true, bootFast: false
  };

  const Settings = {
    data: Object.assign({}, DEFAULTS, Store.get('settings', {}) || {}),
    get(k, d) { return k in this.data ? this.data[k] : d; },
    set(k, v, silent) {
      this.data[k] = v; Store.set('settings', this.data);
      if (!silent) { this.apply(); Bus.emit('settings:' + k, v); Bus.emit('settings', this.data); }
      return v;
    },
    patch(obj) { Object.assign(this.data, obj); Store.set('settings', this.data); this.apply(); Bus.emit('settings', this.data); },
    reset() { this.data = Object.assign({}, DEFAULTS); Store.set('settings', this.data); this.apply(); Bus.emit('settings', this.data); },
    accentPair() { const a = ACCENTS.find((x) => x.id === this.data.accent) || ACCENTS[0]; return a; },
    apply() {
      const d = this.data, root = document.documentElement;
      root.setAttribute('data-theme', d.theme);
      root.setAttribute('data-motion', d.motion ? 'on' : 'off');
      const ac = this.accentPair();
      root.style.setProperty('--accent', ac.a);
      root.style.setProperty('--accent-2', ac.b);
      root.style.setProperty('--ui-scale', String(d.uiScale));
      const w = WALLS.find((x) => x.id === d.wallpaper) || WALLS[0];
      root.style.setProperty('--wall', w.css);
      Bus.emit('wallpaper', w);
    }
  };
  OS.settings = Settings;

  /* ---------------------------------------------------------------- icons */
  const I = {
    terminal: '<path d="M4 17l6-5-6-5"/><path d="M12.5 19H20"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h3.6l2 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    folderOpen: '<path d="M3 8V6a2 2 0 0 1 2-2h3.6l2 2H17a2 2 0 0 1 2 2v1H3z"/><path d="M3 9h18l-2.2 9.2a2 2 0 0 1-1.9 1.5H6.6a2 2 0 0 1-2-1.6z"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    note: '<path d="M5 3h9l5 5v13H5z"/><path d="M8.5 12h7M8.5 16h4.5"/>',
    calculator: '<rect x="4.5" y="2.5" width="15" height="19" rx="2.5"/><path d="M8 6.5h8M8 11h.01M12 11h.01M16 11h.01M8 14.5h.01M12 14.5h.01M8 18h.01M12 18h.01M16 14.5V18"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.6v2.2M12 19.2v2.2M4.4 7.3l1.9 1.1M17.7 15.6l1.9 1.1M2.6 12h2.2M19.2 12h2.2M4.4 16.7l1.9-1.1M17.7 8.4l1.9-1.1"/>',
    brush: '<path d="M4 20.2c2.6.6 4.2-.7 4.6-2.8.3-1.7-.7-3-2.2-3.2-1.7-.2-2.8.9-2.4 6z"/><path d="M9.6 14.4L19 5a2.1 2.1 0 0 0-3-3L6.6 11.4"/>',
    music: '<path d="M9 18V6.2l10-2.2v12"/><circle cx="6.4" cy="18" r="2.6"/><circle cx="16.4" cy="16" r="2.6"/>',
    image: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="8.6" cy="10" r="1.8"/><path d="M21 15.5l-4.6-4.2L7 20"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3.2 12h17.6M12 3c2.6 3 2.6 15 0 18M12 3c-2.6 3-2.6 15 0 18"/>',
    gamepad: '<rect x="2.5" y="7" width="19" height="11" rx="5"/><path d="M7 10.5v3.5M5.2 12.3h3.6"/><circle cx="16" cy="11.4" r="1.1" fill="currentColor" stroke="none"/><circle cx="18.3" cy="14" r="1.1" fill="currentColor" stroke="none"/>',
    snake: '<path d="M5 5.5h8.5a3.2 3.2 0 0 1 0 6.4H9.5a3.2 3.2 0 0 0 0 6.4H19"/><circle cx="19.6" cy="18.3" r="1.4" fill="currentColor" stroke="none"/><circle cx="5.4" cy="5.5" r="1.3" fill="currentColor" stroke="none"/>',
    bomb: '<circle cx="10.5" cy="14.5" r="6"/><path d="M15 10l2.4-2.4M17.4 7.6l2.2-1M17.4 7.6l1 2.2"/><path d="M8 12.5a3 3 0 0 1 2.4-1.6"/>',
    hash: '<path d="M9.5 3L7.5 21M17.5 3l-2 18M4 8.5h16.5M3 15.5h16.5"/>',
    breakout: '<rect x="3" y="3.5" width="5" height="3" rx="1"/><rect x="9.5" y="3.5" width="5" height="3" rx="1"/><rect x="16" y="3.5" width="5" height="3" rx="1"/><rect x="6.2" y="8.5" width="5" height="3" rx="1"/><rect x="12.8" y="8.5" width="5" height="3" rx="1"/><circle cx="12" cy="15" r="1.6"/><path d="M8.5 20.5h7"/>',
    cube: '<path d="M12 2.8l8.6 4.7v9L12 21.2 3.4 16.5v-9z"/><path d="M3.4 7.5L12 12.2l8.6-4.7M12 12.2v9"/>',
    activity: '<path d="M3 12.5h4L9.6 5l4.2 14 2.6-6.5H21"/>',
    bag: '<path d="M5 8h14l-1.1 12.2H6.1z"/><path d="M9 8V6.2a3 3 0 0 1 6 0V8"/>',
    cloud: '<path d="M7.2 18.5a4.2 4.2 0 0 1-.4-8.4 5.6 5.6 0 0 1 10.6-1.2 3.8 3.8 0 0 1-.6 7.6z"/><path d="M15.5 8.2a2.6 2.6 0 1 1 3.6-2.4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11.2v5M12 7.6h.01"/>',
    power: '<path d="M12 3.2v8.6"/><path d="M6.6 6.9a8 8 0 1 0 10.8 0"/>',
    lock: '<rect x="4.5" y="10" width="15" height="10.5" rx="2.6"/><path d="M8 10V7.4a4 4 0 0 1 8 0V10"/>',
    wifi: '<path d="M2.6 8.6a15 15 0 0 1 18.8 0M5.8 12.2a10.4 10.4 0 0 1 12.4 0M9 15.7a5.6 5.6 0 0 1 6 0"/><circle cx="12" cy="19.2" r="1.2" fill="currentColor" stroke="none"/>',
    volume: '<path d="M11 4.8L6.6 8.8H3.2v6.4h3.4L11 19.2z"/><path d="M15.4 9.4a4 4 0 0 1 0 5.2M18 6.8a7.6 7.6 0 0 1 0 10.4"/>',
    volumeOff: '<path d="M11 4.8L6.6 8.8H3.2v6.4h3.4L11 19.2z"/><path d="M16 9.8l4.5 4.4M20.5 9.8L16 14.2"/>',
    battery: '<rect x="2.5" y="7.5" width="17" height="9" rx="2.6"/><path d="M22 10.8v2.4"/><rect x="4.6" y="9.6" width="10" height="4.8" rx="1.2" fill="currentColor" stroke="none"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.2v2.4M12 19.4v2.4M2.2 12h2.4M19.4 12h2.4M5 5l1.7 1.7M17.3 17.3L19 19M19 5l-1.7 1.7M6.7 17.3L5 19"/>',
    moon: '<path d="M20.2 14.6A8.6 8.6 0 0 1 9.4 3.8a8.6 8.6 0 1 0 10.8 10.8z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20.2 20.2l-4.1-4.1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M6.2 6.2l11.6 11.6M17.8 6.2L6.2 17.8"/>',
    trash: '<path d="M4 6.8h16M9.4 6.8V4.6h5.2v2.2M6.2 6.8l1 13.4h9.6l1-13.4"/><path d="M10.2 10.6v6M13.8 10.6v6"/>',
    pencil: '<path d="M4 20.2h4.2L20.3 8.1a2.9 2.9 0 0 0-4.1-4.1L4 16z"/><path d="M14.8 5.4l4.1 4.1"/>',
    save: '<path d="M5 3.4h11l3.6 3.6v13.6H5z"/><path d="M8.4 3.4v5.8h7.2V3.4M8.4 20.6v-6h7.2v6"/>',
    copy: '<rect x="9" y="9" width="11.6" height="11.6" rx="2.4"/><path d="M5.4 15H4.4A1.4 1.4 0 0 1 3 13.6V4.4A1.4 1.4 0 0 1 4.4 3h9.2A1.4 1.4 0 0 1 15 4.4v1"/>',
    refresh: '<path d="M20.4 11.4A8.4 8.4 0 1 0 18 18"/><path d="M20.6 5v6.4h-6.4"/>',
    home: '<path d="M3.8 11L12 3.8 20.2 11"/><path d="M6.2 9.4V20.2h11.6V9.4"/>',
    star: '<path d="M12 3.4l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.9l6.1-.9z"/>',
    play: '<path d="M7.2 4.6l11.6 7.4-11.6 7.4z"/>',
    pause: '<path d="M9 4.8v14.4M15 4.8v14.4"/>',
    next: '<path d="M6.4 5l9 7-9 7zM18.2 5v14"/>',
    prev: '<path d="M17.6 5l-9 7 9 7zM5.8 5v14"/>',
    maximize: '<rect x="4" y="4" width="16" height="16" rx="2.4"/>',
    restore: '<rect x="4" y="8.4" width="11.6" height="11.6" rx="2.2"/><path d="M8.4 8.4V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.4"/>',
    minimize: '<rect x="5" y="14.6" width="14" height="2" rx="1" fill="currentColor" stroke="none"/>',
    grid: '<rect x="3.4" y="3.4" width="7.2" height="7.2" rx="2"/><rect x="13.4" y="3.4" width="7.2" height="7.2" rx="2"/><rect x="3.4" y="13.4" width="7.2" height="7.2" rx="2"/><rect x="13.4" y="13.4" width="7.2" height="7.2" rx="2"/>',
    list: '<path d="M8.4 6.2H21M8.4 12H21M8.4 17.8H21M3.4 6.2h.01M3.4 12h.01M3.4 17.8h.01"/>',
    cpu: '<rect x="6.4" y="6.4" width="11.2" height="11.2" rx="2"/><rect x="9.8" y="9.8" width="4.4" height="4.4" rx="1"/><path d="M9.4 3v3.4M14.6 3v3.4M9.4 17.6V21M14.6 17.6V21M3 9.4h3.4M3 14.6h3.4M17.6 9.4H21M17.6 14.6H21"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6.8v5.4l3.6 2.1"/>',
    user: '<circle cx="12" cy="8.2" r="4"/><path d="M4.6 20.4a7.6 7.6 0 0 1 14.8 0"/>',
    zap: '<path d="M13.2 2.4L5 13.4h5.8l-1 8.2L18.2 10h-6z"/>',
    code: '<path d="M8.6 6.8L3.6 12l5 5.2M15.4 6.8l5 5.2-5 5.2M13.6 3.6l-3.2 16.8"/>',
    book: '<path d="M4 5.2A2.2 2.2 0 0 1 6.2 3H19v14.4H6.2A2.2 2.2 0 0 0 4 19.6z"/><path d="M4 19.6A2.2 2.2 0 0 1 6.2 17.4H19V21H6.2A2.2 2.2 0 0 1 4 19.6z"/>',
    camera: '<path d="M4 8h3.2L8.8 5.4h6.4L16.8 8H20a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.4" r="3.4"/>',
    mail: '<rect x="3" y="5.2" width="18" height="13.6" rx="2.6"/><path d="M3.6 7.2l8.4 5.8 8.4-5.8"/>',
    chart: '<path d="M4 3.6V20.4h16.4"/><rect x="7.4" y="11.4" width="3" height="6" rx="1"/><rect x="13" y="7" width="3" height="10.4" rx="1"/>',
    layers: '<path d="M12 3l9 4.8-9 4.8-9-4.8z"/><path d="M3 12.6L12 17.4l9-4.8"/><path d="M3 17L12 21.8 21 17"/>',
    shield: '<path d="M12 3l7.6 3v6c0 4.6-3.2 8.3-7.6 9.6C7.6 20.3 4.4 16.6 4.4 12V6z"/><path d="M9 12.2l2.2 2.2L15.4 10"/>',
    rocket: '<path d="M12 2.4c3.6 2.7 5.4 6.6 5.4 10.7L14.2 18H9.8L6.6 13.1C6.6 9 8.4 5.1 12 2.4z"/><circle cx="12" cy="9.4" r="1.8"/><path d="M9.8 18l-1.6 3.6L12 20l3.8 1.6L14.2 18"/>',
    coin: '<circle cx="12" cy="12" r="8.6"/><path d="M14.6 8.6H11a1.9 1.9 0 0 0 0 3.8h2a1.9 1.9 0 0 1 0 3.8H9.4M12 6.8v10.4"/>',
    box: '<path d="M3.4 7.4L12 3l8.6 4.4v9.2L12 21l-8.6-4.4z"/><path d="M3.4 7.4L12 11.8l8.6-4.4M12 11.8V21"/>',
    eye: '<path d="M2.6 12S6.2 5.6 12 5.6 21.4 12 21.4 12 17.8 18.4 12 18.4 2.6 12 2.6 12z"/><circle cx="12" cy="12" r="3"/>',
    download: '<path d="M12 3.4v11.8M7.4 10.8L12 15.4l4.6-4.6M4 19.6h16"/>',
    upload: '<path d="M12 15.4V3.6M7.4 8.2L12 3.6l4.6 4.6M4 19.6h16"/>',
    palette: '<path d="M12 3a9 9 0 0 0 0 18c1.5 0 2.1-1.1 1.6-2.1-.5-1.3.4-2.4 1.9-2.4h2.4A3.4 3.4 0 0 0 21.3 13C21.3 7.4 17.1 3 12 3z"/><circle cx="7.8" cy="12.2" r="1.2" fill="currentColor" stroke="none"/><circle cx="10.2" cy="8" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="8.2" r="1.2" fill="currentColor" stroke="none"/>',
    bell: '<path d="M6.4 10.2a5.6 5.6 0 0 1 11.2 0c0 4.2 1.6 5.6 1.6 5.6H4.8s1.6-1.4 1.6-5.6z"/><path d="M10 19a2.2 2.2 0 0 0 4 0"/>',
    right: '<path d="M9.2 5.2l6.8 6.8-6.8 6.8"/>',
    left: '<path d="M14.8 5.2L8 12l6.8 6.8"/>',
    up: '<path d="M5.2 14.8L12 8l6.8 6.8"/>',
    down: '<path d="M5.2 9.2L12 16l6.8-6.8"/>',
    back: '<path d="M20 12H4.4M10.4 5.6L4 12l6.4 6.4"/>',
    fwd: '<path d="M4 12h15.6M13.6 5.6L20 12l-6.4 6.4"/>',
    ext: '<path d="M14 4h6v6"/><path d="M20 4l-8.6 8.6"/><path d="M18 14.4V19a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 19V8.2A1.6 1.6 0 0 1 5.6 6.6h4.6"/>',
    logout: '<path d="M14.6 4h3.2A2.2 2.2 0 0 1 20 6.2v11.6a2.2 2.2 0 0 1-2.2 2.2h-3.2"/><path d="M10 8.2L6 12l4 3.8M6 12h9.4"/>',
    monitor: '<rect x="2.6" y="4" width="18.8" height="12.6" rx="2.4"/><path d="M8.6 20.6h6.8M12 16.6v4"/>',
    disk: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.6"/><path d="M12 3v6.4"/>',
    keyboard: '<rect x="2.6" y="6" width="18.8" height="12" rx="2.4"/><path d="M6.4 10h.01M9.8 10h.01M13.2 10h.01M16.6 10h.01M8.4 14h7.2"/>',
    layout: '<rect x="3" y="4.2" width="18" height="15.6" rx="2.4"/><path d="M3 9h18M9 9v10.8"/>',
    text: '<path d="M5 6.4V4.2h14v2.2M12 4.2v15.6M9 19.8h6"/>',
    pin: '<path d="M9 3.4h6l-.8 5.2 3.2 3.2H6.6l3.2-3.2z"/><path d="M12 11.8v8.8"/>',
    filter: '<path d="M3.4 5.4h17.2l-6.6 7.6v6.4l-4 1.8V13z"/>',
    heart: '<path d="M12 20.4S3.6 15.2 3.6 9.4A4.6 4.6 0 0 1 12 6.9a4.6 4.6 0 0 1 8.4 2.5c0 5.8-8.4 11-8.4 11z"/>',
    flag: '<path d="M5.4 21V3.6M5.4 4.6h11.4l-2 3.6 2 3.6H5.4"/>',
    target: '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
    wave: '<path d="M2.6 12c1.6-4 3.2-4 4.8 0s3.2 4 4.8 0 3.2-4 4.8 0 2.4 3 2.4 3"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.4 8.6l-2 4.8-4.8 2 2-4.8z"/>',
    puzzle: '<path d="M10 3.4h4v2.2a2 2 0 1 0 4 0V3.4h2.6v4.2h-2.2a2 2 0 1 0 0 4h2.2v9.2H3.4v-4.2a2 2 0 1 1 0-4V3.4H10z"/>',
    steam: '<circle cx="12" cy="12" r="8.8"/><circle cx="9.6" cy="9.8" r="2.9"/><circle cx="15.4" cy="14.6" r="1.9"/><path d="M12.2 11.9l-1.5 1.6M3.4 14.2l3.6 1.4M14.2 3.6l1.5 3.5"/>',
    qr: '<rect x="3.4" y="3.4" width="6.6" height="6.6" rx="1.4"/><rect x="14" y="3.4" width="6.6" height="6.6" rx="1.4"/><rect x="3.4" y="14" width="6.6" height="6.6" rx="1.4"/><path d="M14 14h2.6v2.6H14zM18 18h2.6v2.6H18zM14 20.6h1.4M20.6 14v1.4"/>',
    scan: '<path d="M4 8.4V5.6A1.6 1.6 0 0 1 5.6 4h2.8M15.6 4h2.8A1.6 1.6 0 0 1 20 5.6v2.8M20 15.6v2.8a1.6 1.6 0 0 1-1.6 1.6h-2.8M8.4 20H5.6A1.6 1.6 0 0 1 4 18.4v-2.8"/><path d="M4 12h16"/>',
    archive: '<rect x="3" y="4" width="18" height="4.6" rx="1.6"/><path d="M4.8 8.6v10a1.6 1.6 0 0 0 1.6 1.6h11.2a1.6 1.6 0 0 0 1.6-1.6v-10"/><path d="M10 12.4h4"/>',
    send: '<path d="M21 3L10.4 13.6M21 3l-6.8 18-3.8-7.4L3 9.8z"/>'
  };
  OS.rawIcons = I;

  OS.svg = function (name, size, extra) {
    const body = I[name] || I.file;
    const s = size || 24;
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"' + (extra || '') + '>' + body + '</svg>';
  };
  OS.icon = OS.svg;

  /* --------------------------------------------------------------- toasts */
  function toast(title, text, opts) {
    opts = opts || {};
    const host = $('#toasts');
    if (!host) return null;
    const color = opts.color || 'linear-gradient(135deg,var(--accent),var(--accent-2))';
    const t = el('div', { class: 'toast', role: 'status' });
    t.innerHTML =
      '<div class="toast-ico" style="background:' + color + '">' + OS.svg(opts.icon || 'bell', 17) + '</div>' +
      '<div class="toast-body"><div class="toast-title">' + esc(title) + '</div>' +
      (text ? '<div class="toast-text">' + esc(text) + '</div>' : '') + '</div>' +
      '<button class="toast-x" aria-label="Закрыть">&times;</button>';
    host.append(t);
    const kill = () => { if (!t.isConnected) return; t.classList.add('out'); setTimeout(() => t.remove(), 280); };
    $('.toast-x', t).addEventListener('click', kill);
    t.addEventListener('click', () => { if (opts.onClick) { opts.onClick(); kill(); } });
    const ms = opts.timeout == null ? 4600 : opts.timeout;
    if (ms > 0) setTimeout(kill, ms);
    Sfx.play('notify');
    return { el: t, close: kill };
  }
  OS.toast = toast;
  OS.notify = toast;

  /* ------------------------------------------------------------------ sfx */
  const Sfx = {
    ctx: null,
    ensure() {
      if (this.ctx) return this.ctx;
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      try { this.ctx = new AC(); } catch (e) { return null; }
      return this.ctx;
    },
    resume() { const c = this.ensure(); if (c && c.state === 'suspended') c.resume().catch(() => {}); },
    play(kind) {
      if (!Settings.get('sound') || Settings.get('muted')) return;
      const c = this.ensure(); if (!c) return;
      const now = c.currentTime;
      const g = c.createGain(); g.connect(c.destination);
      const vol = clamp(Settings.get('volume', .5), 0, 1);
      const o = c.createOscillator(); o.connect(g);
      const map = {
        click: [720, .035, .05, 'sine'], open: [520, .09, .07, 'triangle'], close: [330, .08, .06, 'sine'],
        notify: [880, .13, .09, 'sine'], error: [170, .18, .1, 'sawtooth'], ok: [660, .1, .07, 'triangle'],
        boot: [420, .5, .06, 'sine']
      };
      const m = map[kind] || map.click;
      o.type = m[3]; o.frequency.setValueAtTime(m[0], now);
      if (kind === 'notify') o.frequency.exponentialRampToValueAtTime(m[0] * 1.5, now + m[1]);
      if (kind === 'open') o.frequency.exponentialRampToValueAtTime(m[0] * 1.6, now + m[1]);
      if (kind === 'close') o.frequency.exponentialRampToValueAtTime(m[0] * .6, now + m[1]);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(m[2] * vol, now + .008);
      g.gain.exponentialRampToValueAtTime(.0001, now + m[1]);
      o.start(now); o.stop(now + m[1] + .02);
    }
  };
  OS.sfx = Sfx;

  /* ---------------------------------------------------------------- монеты */
  const Coins = {
    get() { return Store.get('coins', 0) || 0; },
    earned() { return Store.get('coinsEarned', 0) || 0; },
    add(n) {
      n = Math.floor(n || 0);
      if (!n) return this.get();
      const v = Math.max(0, this.get() + n);
      Store.set('coins', v);
      if (n > 0) Store.set('coinsEarned', this.earned() + n);
      Bus.emit('coins', v);
      return v;
    },
    spend(n) {
      if (this.get() < n) return false;
      Store.set('coins', this.get() - n);
      Bus.emit('coins', this.get());
      return true;
    },
    level() { return 1 + Math.floor(Math.sqrt(this.earned() / 60)); }
  };
  OS.coins = Coins;

  /* ------------------------------------------------------------ app registry */
  const Apps = {
    _list: new Map(),
    register(def) {
      if (!def || !def.id) return;
      const prev = this._list.get(def.id);
      this._list.set(def.id, Object.assign({
        name: def.id, icon: 'box', color: '#7c5cff', color2: '#22d3ee',
        width: 760, height: 480, minWidth: 320, minHeight: 200,
        desktop: true, category: 'Прочее', singleton: false, resizable: true, keywords: '',
        storeOnly: false, premium: 0, noStart: false
      }, def));
      if (prev) Bus.emit('app:updated', def.id);
      Bus.emit('app:registered', def.id);
      return this._list.get(def.id);
    },
    get(id) { return this._list.get(id); },
    has(id) { return this._list.has(id); },
    all() { return Array.from(this._list.values()); },
    list() { return this.all().filter((a) => !a.hidden); },
    byCategory() {
      const m = new Map();
      this.list().forEach((a) => { if (!m.has(a.category)) m.set(a.category, []); m.get(a.category).push(a); });
      return m;
    },
    search(q) {
      q = String(q || '').toLowerCase().trim();
      if (!q) return this.list();
      return this.list().filter((a) => (a.name + ' ' + a.id + ' ' + (a.keywords || '') + ' ' + a.category).toLowerCase().includes(q));
    },
    installed(id) {
      const extra = Settings.get('installed') || [];
      const a = this.get(id);
      if (!a) return false;
      return !a.storeOnly || extra.includes(id);
    },
    install(id) {
      const extra = Settings.get('installed') || [];
      if (!extra.includes(id)) { extra.push(id); Settings.set('installed', extra); }
      Bus.emit('apps:changed');
    },
    uninstall(id) {
      const extra = (Settings.get('installed') || []).filter((x) => x !== id);
      Settings.set('installed', extra);
      Settings.set('pinned', (Settings.get('pinned') || []).filter((x) => x !== id));
      Bus.emit('apps:changed');
    },
    tileStyle(app) {
      const c2 = app.color2 || app.color;
      return 'background:linear-gradient(135deg,' + app.color + ',' + c2 + ')';
    }
  };
  OS.Apps = Apps;

  /* --------------------------------------------------------------- perf/fps */
  const Perf = {
    fps: 60, frames: 0, last: performance.now(), samples: [],
    start() {
      const tick = (t) => {
        this.frames++;
        if (t - this.last >= 500) {
          this.fps = Math.round((this.frames * 1000) / (t - this.last));
          this.frames = 0; this.last = t;
          this.samples.push(this.fps); if (this.samples.length > 90) this.samples.shift();
          Bus.emit('fps', this.fps);
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  };
  OS.perf = Perf;

  OS.uptime = () => Date.now() - OS.startedAt;
  OS.memInfo = () => {
    const m = global.performance && performance.memory;
    if (m) return { used: m.usedJSHeapSize, total: m.totalJSHeapSize, limit: m.jsHeapSizeLimit };
    return { used: Store.usage() * 24 + 8e6, total: 64e6, limit: 512e6 };
  };
})(window);
