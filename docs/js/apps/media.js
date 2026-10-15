/* ==========================================================================
   QwenOS 3.0 — apps/media.js
   Paint · Синтезатор музыки · Фото · Браузер QwenNet · Заставка «Матрица»
   ========================================================================== */
(function (OS) {
  'use strict';
  const fs = OS.fs;

  /* =======================================================================
     PAINT
     ======================================================================= */
  OS.Apps.register({
    id: 'paint',
    name: 'Paint',
    icon: 'brush',
    color: '#ec4899', color2: '#7c3aed',
    category: 'Мультимедиа',
    keywords: 'рисование графика paint canvas кисть drawing',
    width: 900, height: 620, minWidth: 420, minHeight: 360,
    mount(win, api) {
      const st = {
        tool: OS.store.get('paint.tool', 'brush'), color: OS.store.get('paint.color', '#8b5cf6'),
        size: OS.store.get('paint.size', 6), drawing: false, sx: 0, sy: 0,
        undo: [], redo: [], snapshot: null, path: win.params.path || null
      };
      win.body.innerHTML =
        '<div class="pt">' +
          '<div class="pt-tools"></div>' +
          '<div class="pt-stage"><div class="pt-canvas-wrap"><canvas class="pt-cv"></canvas></div></div>' +
          '<div class="pt-status"><span class="pt-pos">0, 0</span><span class="pt-info"></span></div>' +
        '</div>';
      const cv = win.body.querySelector('.pt-cv');
      const ctx = cv.getContext('2d');
      const toolsEl = win.body.querySelector('.pt-tools');
      const posEl = win.body.querySelector('.pt-pos');
      const infoEl = win.body.querySelector('.pt-info');

      const TOOLS = [
        { id: 'brush', icon: 'brush', name: 'Кисть' },
        { id: 'eraser', icon: 'archive', name: 'Ластик' },
        { id: 'line', icon: 'minus', name: 'Линия' },
        { id: 'rect', icon: 'maximize', name: 'Прямоугольник' },
        { id: 'circle', icon: 'target', name: 'Круг' },
        { id: 'spray', icon: 'wave', name: 'Аэрограф' },
        { id: 'fill', icon: 'download', name: 'Заливка фона' }
      ];
      const PALETTE = ['#ffffff', '#0f172a', '#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#a3a3a3', '#78350f'];

      toolsEl.innerHTML =
        '<div class="pt-group">' + TOOLS.map((t) => '<button class="pt-t' + (t.id === st.tool ? ' on' : '') + '" data-t="' + t.id + '" title="' + t.name + '">' + OS.svg(t.icon, 16) + '</button>').join('') + '</div>' +
        '<div class="pt-group pt-colors">' + PALETTE.map((c) => '<button class="pt-c" data-c="' + c + '" style="background:' + c + '" title="' + c + '"></button>').join('') + '<input type="color" class="pt-custom" value="' + st.color + '" title="Свой цвет"></div>' +
        '<div class="pt-group pt-size"><span>' + OS.svg('target', 14) + '</span><input type="range" min="1" max="60" value="' + st.size + '"><b class="pt-size-v">' + st.size + 'px</b></div>' +
        '<div class="pt-group">' +
          '<button class="pt-a" data-a="undo" title="Отменить (Ctrl+Z)">' + OS.svg('back', 15) + '</button>' +
          '<button class="pt-a" data-a="redo" title="Повторить (Ctrl+Y)">' + OS.svg('fwd', 15) + '</button>' +
          '<button class="pt-a" data-a="clear" title="Очистить">' + OS.svg('trash', 15) + '</button>' +
          '<button class="pt-a" data-a="save" title="Сохранить в ФС">' + OS.svg('save', 15) + '</button>' +
          '<button class="pt-a" data-a="dl" title="Скачать PNG">' + OS.svg('download', 15) + '</button>' +
        '</div>';

      function fit() {
        const wrap = win.body.querySelector('.pt-canvas-wrap');
        const r = wrap.getBoundingClientRect();
        const w = Math.max(200, Math.floor(r.width)), h = Math.max(150, Math.floor(r.height));
        const old = cv.width ? ctx.getImageData(0, 0, cv.width, cv.height) : null;
        cv.width = w; cv.height = h;
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
        if (old) { try { ctx.putImageData(old, 0, 0); } catch (e) { /* noop */ } }
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        infoEl.textContent = w + '×' + h + ' px · ' + (st.path ? fs.basename(st.path) : 'без имени');
        win.setTitle('Paint — ' + (st.path ? fs.basename(st.path) : 'новый рисунок'));
      }

      function pushUndo() {
        try {
          st.undo.push(cv.toDataURL('image/png'));
          if (st.undo.length > 14) st.undo.shift();
          st.redo.length = 0;
        } catch (e) { /* noop */ }
      }
      function restore(url) {
        const img = new Image();
        img.onload = () => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(img, 0, 0); };
        img.src = url;
      }
      const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * (cv.width / r.width), y: (e.clientY - r.top) * (cv.height / r.height) }; };

      function strokeStyle() { ctx.strokeStyle = st.tool === 'eraser' ? '#ffffff' : st.color; ctx.fillStyle = st.color; ctx.lineWidth = st.tool === 'eraser' ? st.size * 1.6 : st.size; }

      cv.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const p = pos(e);
        if (st.tool === 'fill') { pushUndo(); ctx.fillStyle = st.color; ctx.fillRect(0, 0, cv.width, cv.height); return; }
        st.drawing = true; st.sx = p.x; st.sy = p.y;
        pushUndo();
        strokeStyle();
        try { cv.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
        if (st.tool === 'brush' || st.tool === 'eraser') { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + .01, p.y); ctx.stroke(); }
        if (['line', 'rect', 'circle'].includes(st.tool)) st.snapshot = ctx.getImageData(0, 0, cv.width, cv.height);
      });
      cv.addEventListener('pointermove', (e) => {
        const p = pos(e);
        posEl.textContent = Math.round(p.x) + ', ' + Math.round(p.y);
        if (!st.drawing) return;
        strokeStyle();
        if (st.tool === 'brush' || st.tool === 'eraser') { ctx.lineTo(p.x, p.y); ctx.stroke(); }
        else if (st.tool === 'spray') {
          for (let i = 0; i < 22; i++) {
            const a = Math.random() * Math.PI * 2, rr = Math.random() * st.size * 1.6;
            ctx.fillStyle = st.color;
            ctx.fillRect(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr, 1.4, 1.4);
          }
        } else if (st.snapshot) {
          ctx.putImageData(st.snapshot, 0, 0);
          ctx.beginPath();
          if (st.tool === 'line') { ctx.moveTo(st.sx, st.sy); ctx.lineTo(p.x, p.y); }
          else if (st.tool === 'rect') ctx.rect(st.sx, st.sy, p.x - st.sx, p.y - st.sy);
          else { const rx = Math.abs(p.x - st.sx) / 2, ry = Math.abs(p.y - st.sy) / 2; ctx.ellipse(st.sx + (p.x - st.sx) / 2, st.sy + (p.y - st.sy) / 2, rx, ry, 0, 0, 7); }
          ctx.stroke();
        }
      });
      const up = () => { st.drawing = false; st.snapshot = null; };
      cv.addEventListener('pointerup', up);
      cv.addEventListener('pointercancel', up);
      cv.addEventListener('pointerleave', () => { posEl.textContent = '—'; });

      toolsEl.addEventListener('click', (e) => {
        const t = e.target.closest('[data-t]');
        if (t) { st.tool = t.dataset.t; OS.store.set('paint.tool', st.tool); toolsEl.querySelectorAll('[data-t]').forEach((x) => x.classList.toggle('on', x === t)); return; }
        const cEl = e.target.closest('[data-c]');
        if (cEl) { st.color = cEl.dataset.c; OS.store.set('paint.color', st.color); toolsEl.querySelector('.pt-custom').value = st.color; return; }
        const a = e.target.closest('[data-a]');
        if (!a) return;
        const act = a.dataset.a;
        if (act === 'undo') { if (st.undo.length) { st.redo.push(cv.toDataURL()); restore(st.undo.pop()); } }
        else if (act === 'redo') { if (st.redo.length) { st.undo.push(cv.toDataURL()); restore(st.redo.pop()); } }
        else if (act === 'clear') { if (confirm('Очистить холст?')) { pushUndo(); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); } }
        else if (act === 'save') save();
        else if (act === 'dl') OS.download('qwenos-paint-' + Date.now() + '.png', dataURLtoBlob(cv.toDataURL('image/png')), 'image/png');
      });
      toolsEl.querySelector('.pt-custom').addEventListener('input', (e) => { st.color = e.target.value; OS.store.set('paint.color', st.color); });
      toolsEl.querySelector('.pt-size input').addEventListener('input', (e) => {
        st.size = parseInt(e.target.value, 10); OS.store.set('paint.size', st.size);
        toolsEl.querySelector('.pt-size-v').textContent = st.size + 'px';
      });

      function dataURLtoBlob(u) {
        const p = u.split(','), mime = p[0].match(/:(.*?);/)[1], bstr = atob(p[1]);
        let n = bstr.length; const arr = new Uint8Array(n);
        while (n--) arr[n] = bstr.charCodeAt(n);
        return new Blob([arr], { type: mime });
      }
      function save() {
        // уменьшаем тяжёлые рисунки, чтобы уложиться в квоту localStorage
        const maxW = 1000;
        let out = cv;
        if (cv.width > maxW) {
          const tmp = document.createElement('canvas');
          tmp.width = maxW; tmp.height = Math.round(cv.height * maxW / cv.width);
          tmp.getContext('2d').drawImage(cv, 0, 0, tmp.width, tmp.height);
          out = tmp;
        }
        const url = out.toDataURL('image/png');
        if (!st.path) {
          const name = prompt('Сохранить рисунок как:', 'рисунок-' + new Date().toISOString().slice(11, 16).replace(':', '') + '.png');
          if (!name) return;
          st.path = fs.join(fs.home() + '/Pictures', /\.png$/i.test(name) ? name : name + '.png');
        }
        const r = fs.write(st.path, url);
        if (!r.ok) return OS.toast('Не удалось сохранить', r.error, { icon: 'x' });
        OS.bus.emit('fs:changed', st.path);
        infoEl.textContent = cv.width + '×' + cv.height + ' px · ' + fs.basename(st.path);
        win.setTitle('Paint — ' + fs.basename(st.path));
        OS.toast('Рисунок сохранён', st.path + ' · ' + OS.fmtBytes(url.length), { icon: 'save', onClick: () => api.open('photos', { path: st.path }) });
      }

      const onKey = (e) => {
        if (!win.root.isConnected || OS.wm.active !== win) return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); toolsEl.querySelector('[data-a="undo"]').click(); }
        else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); toolsEl.querySelector('[data-a="redo"]').click(); }
        else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
      };
      document.addEventListener('keydown', onKey);

      if (st.path && fs.isFile(st.path)) {
        const img = new Image();
        img.onload = () => { fit(); ctx.drawImage(img, 0, 0); infoEl.textContent = cv.width + '×' + cv.height + ' px · ' + fs.basename(st.path); };
        img.src = fs.read(st.path);
      } else fit();

      const onRs = () => { if (win.root.isConnected) fit(); };
      win.root.addEventListener('wm:resize', onRs);
      addEventListener('resize', OS.debounce(onRs, 200));
      return () => { document.removeEventListener('keydown', onKey); removeEventListener('resize', onRs); };
    }
  });

  /* =======================================================================
     СИНТЕЗАТОР МУЗЫКИ (WebAudio, процедурные треки)
     ======================================================================= */
  const Audio = (function () {
    let ctx = null, master = null, analyser = null;
    function ensure() {
      if (ctx) return ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = OS.settings.get('muted') ? 0 : OS.settings.get('volume');
      analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      master.connect(analyser);
      analyser.connect(ctx.destination);
      return ctx;
    }
    function setVolume(v) { if (master) master.gain.value = v; }
    function note(freq, t0, dur, type, vol, dest) {
      const c = ensure(); if (!c) return;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || 'triangle';
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime((vol == null ? .18 : vol), t0 + .012);
      g.gain.exponentialRampToValueAtTime(.0008, t0 + dur);
      o.connect(g); g.connect(dest || master);
      o.start(t0); o.stop(t0 + dur + .03);
    }
    function noise(t0, dur, vol, hp) {
      const c = ensure(); if (!c) return;
      const len = Math.max(1, Math.floor(c.sampleRate * dur));
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const s = c.createBufferSource(); s.buffer = buf;
      const f = c.createBiquadFilter(); f.type = hp ? 'highpass' : 'lowpass'; f.frequency.value = hp ? 6000 : 220;
      const g = c.createGain(); g.gain.value = vol == null ? .12 : vol;
      s.connect(f); f.connect(g); g.connect(master);
      s.start(t0);
    }
    return { ensure, note, noise, setVolume, get ctx() { return ctx; }, get analyser() { return analyser; }, get master() { return master; } };
  })();
  OS.audio = Audio;

  OS.Apps.register({
    id: 'music',
    name: 'Синтезатор',
    icon: 'music',
    color: '#a855f7', color2: '#4f46e5',
    category: 'Мультимедиа',
    keywords: 'музыка плеер аудио chiptune synth player visualizer',
    width: 620, height: 560, minWidth: 380, minHeight: 420,
    mount(win) {
      const N = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
      const freq = (name) => {
        const m = /^([A-G]#?)(\d)$/.exec(name); if (!m) return 0;
        const semi = N[m[1]] + (parseInt(m[2], 10) - 4) * 12;
        return 440 * Math.pow(2, (semi - 9) / 12);
      };
      const TRACKS = [
        { id: 'aurora', name: 'Aurora Drift', artist: 'QwenOS Audio', bpm: 92, wave: 'triangle', bass: 'sine', prog: [['A2', 'C3', 'E3', 'A3'], ['F2', 'A2', 'C3', 'F3'], ['G2', 'B2', 'D3', 'G3'], ['E2', 'G#2', 'B2', 'E3']], drums: true },
        { id: 'neon', name: 'Neon Highway', artist: 'QwenOS Audio', bpm: 124, wave: 'sawtooth', bass: 'square', prog: [['D2', 'F2', 'A2', 'D3'], ['A#1', 'D2', 'F2', 'A#2'], ['C2', 'E2', 'G2', 'C3'], ['G1', 'B1', 'D2', 'G2']], drums: true },
        { id: 'calm', name: 'Тихий сад', artist: 'QwenOS Audio', bpm: 68, wave: 'sine', bass: 'triangle', prog: [['F2', 'A2', 'C3', 'F3'], ['D2', 'F2', 'A2', 'D3'], ['A#1', 'D2', 'F2', 'A#2'], ['C2', 'E2', 'G2', 'C3']], drums: false },
        { id: 'chip', name: '8-Bit Quest', artist: 'QwenOS Audio', bpm: 148, wave: 'square', bass: 'square', prog: [['E2', 'G2', 'B2', 'E3'], ['C2', 'E2', 'G2', 'C3'], ['D2', 'F#2', 'A2', 'D3'], ['B1', 'D#2', 'F#2', 'B2']], drums: true }
      ];
      const st = { i: 0, playing: false, step: 0, nextTime: 0, timer: null, bars: 0 };

      win.body.innerHTML =
        '<div class="mu">' +
          '<canvas class="mu-vis"></canvas>' +
          '<div class="mu-now"><div class="mu-cover">' + OS.svg('music', 30) + '</div><div class="mu-meta"><b></b><span></span></div></div>' +
          '<div class="mu-prog"><span class="mu-t">0:00</span><div class="mu-bar"><i></i></div><span class="mu-t2">∞</span></div>' +
          '<div class="mu-ctrl">' +
            '<button class="mu-b" data-a="prev">' + OS.svg('prev', 18) + '</button>' +
            '<button class="mu-b mu-play" data-a="play">' + OS.svg('play', 22) + '</button>' +
            '<button class="mu-b" data-a="next">' + OS.svg('next', 18) + '</button>' +
            '<div class="mu-vol">' + OS.svg('volume', 15) + '<input type="range" min="0" max="1" step="0.02"></div>' +
          '</div>' +
          '<div class="mu-list-t">Плейлист</div>' +
          '<div class="mu-list"></div>' +
        '</div>';
      const cv = win.body.querySelector('.mu-vis'), vctx = cv.getContext('2d');
      const nameEl = win.body.querySelector('.mu-meta b'), artEl = win.body.querySelector('.mu-meta span');
      const barFill = win.body.querySelector('.mu-bar i'), tEl = win.body.querySelector('.mu-t');
      const listEl = win.body.querySelector('.mu-list'), volEl = win.body.querySelector('.mu-vol input');
      const playBtn = win.body.querySelector('[data-a="play"]');

      volEl.value = OS.settings.get('muted') ? 0 : OS.settings.get('volume');
      volEl.addEventListener('input', () => {
        const v = parseFloat(volEl.value);
        OS.settings.set('volume', v, true); OS.settings.set('muted', v === 0, true);
        Audio.setVolume(v);
        OS.bus.emit('volume', v);
      });

      function renderList() {
        listEl.innerHTML = TRACKS.map((t, i) =>
          '<button class="mu-tr' + (i === st.i ? ' on' : '') + '" data-i="' + i + '">' +
            '<i class="mu-tr-ic">' + OS.svg(i === st.i && st.playing ? 'wave' : 'music', 14) + '</i>' +
            '<span><b>' + t.name + '</b><small>' + t.artist + ' · ' + t.bpm + ' BPM</small></span>' +
            '<em>' + (i === st.i && st.playing ? 'играет' : '') + '</em></button>').join('');
      }
      function renderNow() {
        const t = TRACKS[st.i];
        nameEl.textContent = t.name; artEl.textContent = t.artist + ' · ' + t.bpm + ' BPM · ' + t.wave;
        win.setTitle('Синтезатор — ' + t.name);
        playBtn.innerHTML = OS.svg(st.playing ? 'pause' : 'play', 22);
        renderList();
      }
      function sizeVis() { const r = cv.getBoundingClientRect(); cv.width = Math.max(120, r.width) * devicePixelRatio; cv.height = 130 * devicePixelRatio; }

      function schedule() {
        const c = Audio.ensure(); if (!c) return;
        const t = TRACKS[st.i];
        const spb = 60 / t.bpm / 2; // восьмые
        while (st.nextTime < c.currentTime + .25) {
          const s = st.step % 16;
          const chord = t.prog[Math.floor(st.step / 16) % t.prog.length];
          const tt = st.nextTime;
          // бас
          if (s % 4 === 0) Audio.note(freq(chord[0]), tt, spb * 3.4, t.bass, .16);
          // арпеджио
          const n = chord[(s % 4) + (Math.floor(s / 4) % 2 === 0 ? 0 : 0)];
          Audio.note(freq(chord[1 + (s % 3)]) * (s % 8 === 7 ? 2 : 1), tt, spb * .9, t.wave, .085);
          if (s % 8 === 0) Audio.note(freq(n) * 2, tt + spb * .5, spb * .5, t.wave, .05);
          // ударные
          if (t.drums) {
            if (s % 4 === 0) Audio.noise(tt, .13, .2, false);
            if (s % 2 === 1) Audio.noise(tt, .04, .05, true);
          }
          st.nextTime += spb;
          st.step++;
        }
      }
      function play() {
        const c = Audio.ensure(); if (!c) return OS.toast('Аудио недоступно', 'Браузер не поддерживает WebAudio', { icon: 'x' });
        if (c.state === 'suspended') c.resume();
        Audio.setVolume(OS.settings.get('muted') ? 0 : parseFloat(volEl.value || OS.settings.get('volume')));
        st.playing = true; st.step = 0; st.bars = 0;
        st.nextTime = c.currentTime + .06;
        st.timer = setInterval(schedule, 40);
        renderNow();
      }
      function pause() { st.playing = false; clearInterval(st.timer); st.timer = null; renderNow(); }
      function select(i) { st.i = (i + TRACKS.length) % TRACKS.length; st.step = 0; if (st.playing) { clearInterval(st.timer); st.timer = setInterval(schedule, 40); const c = Audio.ensure(); st.nextTime = c.currentTime + .05; } renderNow(); }

      win.body.addEventListener('click', (e) => {
        const tr = e.target.closest('[data-i]');
        if (tr) { const i = +tr.dataset.i; if (i === st.i && st.playing) pause(); else { select(i); if (!st.playing) play(); } return; }
        const b = e.target.closest('[data-a]'); if (!b) return;
        const a = b.dataset.a;
        if (a === 'play') st.playing ? pause() : play();
        else if (a === 'next') select(st.i + 1);
        else if (a === 'prev') select(st.i - 1);
      });

      const data = new Uint8Array(64);
      let raf = 0, elapsed = 0, lastT = Date.now();
      function loop() {
        raf = requestAnimationFrame(loop);
        if (!win.root.isConnected) return;
        if (cv.width < 20) sizeVis();
        const w = cv.width, hh = cv.height;
        vctx.clearRect(0, 0, w, hh);
        const an = Audio.analyser;
        if (an && st.playing) an.getByteFrequencyData(data);
        else for (let i = 0; i < data.length; i++) data[i] = Math.max(0, data[i] - 6);
        const bars = data.length;
        const bw = w / bars;
        const cs = getComputedStyle(document.documentElement);
        const c1 = cs.getPropertyValue('--accent').trim() || '#8b5cf6';
        const c2 = cs.getPropertyValue('--accent-2').trim() || '#06b6d4';
        for (let i = 0; i < bars; i++) {
          const v = data[i] / 255;
          const bh = Math.max(2 * devicePixelRatio, v * hh * .92);
          const g = vctx.createLinearGradient(0, hh, 0, hh - bh);
          g.addColorStop(0, c2); g.addColorStop(1, c1);
          vctx.fillStyle = g;
          const x = i * bw + bw * .18, bww = bw * .64;
          vctx.beginPath();
          if (vctx.roundRect) { vctx.roundRect(x, hh - bh, bww, bh, 3 * devicePixelRatio); vctx.fill(); }
          else vctx.fillRect(x, hh - bh, bww, bh);
        }
        // отражение
        vctx.globalAlpha = .16;
        for (let i = 0; i < bars; i++) {
          const v = data[i] / 255, bh = Math.max(1, v * hh * .3);
          vctx.fillStyle = c1;
          vctx.fillRect(i * bw + bw * .18, hh - 1, bw * .64, bh * .3);
        }
        vctx.globalAlpha = 1;

        const now = Date.now();
        if (st.playing) { elapsed += (now - lastT) / 1000; st.bars = Math.floor(st.step / 16); }
        lastT = now;
        tEl.textContent = Math.floor(elapsed / 60) + ':' + OS.pad(Math.floor(elapsed % 60));
        barFill.style.width = ((st.step % 64) / 64 * 100).toFixed(1) + '%';
      }
      sizeVis(); loop(); renderNow();
      const onRs = () => sizeVis();
      win.root.addEventListener('wm:resize', onRs);
      addEventListener('resize', OS.debounce(onRs, 200));
      const u1 = OS.bus.on('settings', () => { volEl.value = OS.settings.get('muted') ? 0 : OS.settings.get('volume'); Audio.setVolume(OS.settings.get('muted') ? 0 : OS.settings.get('volume')); });

      return () => { cancelAnimationFrame(raf); clearInterval(st.timer); removeEventListener('resize', onRs); u1(); };
    }
  });

  /* =======================================================================
     ФОТО
     ======================================================================= */
  OS.Apps.register({
    id: 'photos',
    name: 'Фото',
    icon: 'image',
    color: '#22c55e', color2: '#0f766e',
    category: 'Мультимедиа',
    keywords: 'изображения картинки галерея обои photos gallery images',
    width: 860, height: 580, minWidth: 400, minHeight: 320,
    mount(win, api) {
      const st = { tab: 'all', items: [], cur: -1, gen: null };
      win.body.innerHTML =
        '<div class="ph">' +
          '<div class="ph-bar"><div class="ph-tabs"><button data-t="all" class="on">Все</button><button data-t="files">Мои файлы</button><button data-t="art">Генеративное искусство</button></div>' +
          '<div class="ph-act"><button class="btn btn-sm" data-b="gen">Сгенерировать</button><button class="btn btn-sm" data-b="paint">Открыть Paint</button></div></div>' +
          '<div class="ph-grid"></div>' +
          '<div class="ph-view hidden"><div class="ph-view-bg"></div><img class="ph-img" alt=""><div class="ph-view-bar">' +
            '<button class="btn btn-sm" data-a="prev">← Пред.</button><span class="ph-view-name"></span>' +
            '<button class="btn btn-sm" data-a="next">След. →</button><button class="btn btn-sm" data-a="wall">На обои</button>' +
            '<button class="btn btn-sm" data-a="dl">Скачать</button><button class="btn btn-sm" data-a="del">Удалить</button>' +
            '<button class="btn btn-sm btn-accent" data-a="close">Закрыть</button></div></div>' +
        '</div>';
      const grid = win.body.querySelector('.ph-grid');
      const view = win.body.querySelector('.ph-view');
      const img = win.body.querySelector('.ph-img');
      const vname = win.body.querySelector('.ph-view-name');

      /* генеративные картинки на canvas */
      function genArt(seed) {
        let s = seed || Math.floor(Math.random() * 1e9);
        const rr = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
        const c = document.createElement('canvas'); c.width = 420; c.height = 300;
        const x = c.getContext('2d');
        const h1 = Math.floor(rr() * 360), h2 = (h1 + 40 + rr() * 180) % 360;
        const g = x.createLinearGradient(0, 0, c.width, c.height);
        g.addColorStop(0, 'hsl(' + h1 + ',70%,' + (14 + rr() * 22) + '%)');
        g.addColorStop(1, 'hsl(' + h2 + ',70%,' + (10 + rr() * 20) + '%)');
        x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
        const mode = Math.floor(rr() * 4);
        x.globalAlpha = .55;
        if (mode === 0) {
          for (let i = 0; i < 26; i++) {
            const rg = x.createRadialGradient(rr() * c.width, rr() * c.height, 0, rr() * c.width, rr() * c.height, 40 + rr() * 130);
            rg.addColorStop(0, 'hsla(' + ((h1 + rr() * 120) % 360) + ',90%,65%,.75)');
            rg.addColorStop(1, 'transparent');
            x.fillStyle = rg; x.beginPath(); x.arc(rr() * c.width, rr() * c.height, 150, 0, 7); x.fill();
          }
        } else if (mode === 1) {
          for (let i = 0; i < 60; i++) {
            x.strokeStyle = 'hsla(' + ((h2 + rr() * 90) % 360) + ',90%,' + (55 + rr() * 30) + '%,.6)';
            x.lineWidth = .6 + rr() * 2.4;
            x.beginPath();
            const y0 = rr() * c.height;
            x.moveTo(0, y0);
            for (let px = 0; px <= c.width; px += 12) x.lineTo(px, y0 + Math.sin(px / (18 + rr() * 40) + i) * (10 + rr() * 34));
            x.stroke();
          }
        } else if (mode === 2) {
          const step = 16 + Math.floor(rr() * 14);
          for (let py = 0; py < c.height; py += step) for (let px = 0; px < c.width; px += step) {
            x.fillStyle = 'hsla(' + ((h1 + (px + py) / 6 + rr() * 60) % 360) + ',85%,' + (40 + rr() * 35) + '%,' + (.25 + rr() * .6) + ')';
            if (rr() > .5) { x.beginPath(); x.arc(px + step / 2, py + step / 2, step * (.2 + rr() * .35), 0, 7); x.fill(); }
            else x.fillRect(px + 1, py + 1, step - 2, step - 2);
          }
        } else {
          for (let i = 0; i < 14; i++) {
            x.beginPath();
            const cx = rr() * c.width, cy = rr() * c.height, r = 30 + rr() * 110;
            x.moveTo(cx + r, cy);
            for (let a = 0; a < 7; a++) x.lineTo(cx + Math.cos(a) * r * (0.6 + rr()), cy + Math.sin(a) * r * (0.6 + rr()));
            x.closePath();
            x.fillStyle = 'hsla(' + ((h2 + i * 14) % 360) + ',85%,60%,.4)'; x.fill();
            x.strokeStyle = 'hsla(' + ((h2 + i * 14) % 360) + ',95%,80%,.5)'; x.lineWidth = 1.4; x.stroke();
          }
        }
        x.globalAlpha = 1;
        return c.toDataURL('image/png');
      }

      function collect() {
        const files = [];
        const walk = (d) => fs.list(d).forEach((it) => { if (it.type === 'dir') walk(it.path); else if (/^(png|jpe?g|gif|webp|svg|bmp)$/i.test(it.ext)) files.push({ name: it.name, url: fs.read(it.path), path: it.path, kind: 'file', modified: it.modified, size: it.size }); });
        walk('/');
        const arts = (st.gen || []).map((a, i) => ({ name: 'Арт #' + (i + 1), url: a.url, kind: 'art', seed: a.seed, modified: a.at }));
        st.items = (st.tab === 'files' ? files : st.tab === 'art' ? arts : files.concat(arts)).sort((a, b) => (b.modified || 0) - (a.modified || 0));
        return st.items;
      }
      function render() {
        collect();
        grid.innerHTML = '';
        if (!st.items.length) {
          grid.innerHTML = '<div class="ph-empty">' + OS.svg('image', 40) + '<p>Изображений пока нет.</p><p class="dim">Нарисуйте что-нибудь в Paint и сохраните — или нажмите «Сгенерировать».</p></div>';
          return;
        }
        st.items.forEach((it, i) => {
          const d = OS.el('button', { class: 'ph-card', title: it.name });
          d.innerHTML = '<div class="ph-th" style="background-image:url(' + (it.url || '').replace(/"/g, '%22') + ')"></div><div class="ph-nm">' + OS.esc(it.name) + '<span>' + (it.kind === 'art' ? 'генеративное' : OS.fmtBytes(it.size)) + '</span></div>';
          d.onclick = () => open(i);
          grid.append(d);
        });
      }
      function open(i) {
        st.cur = i;
        const it = st.items[i]; if (!it) return;
        img.src = it.url || '';
        vname.textContent = it.name + (it.path ? ' · ' + it.path : '');
        view.classList.remove('hidden');
        win.body.querySelector('[data-a="del"]').disabled = it.kind !== 'file';
      }
      function close() { view.classList.add('hidden'); st.cur = -1; }

      win.body.querySelector('.ph-bar').addEventListener('click', (e) => {
        const t = e.target.closest('[data-t]');
        if (t) { st.tab = t.dataset.t; win.body.querySelectorAll('.ph-tabs button').forEach((x) => x.classList.toggle('on', x === t)); render(); return; }
      });
      view.addEventListener('click', (e) => {
        const a = e.target.closest('[data-a]');
        if (e.target.classList.contains('ph-view-bg')) return close();
        if (!a) return;
        const act = a.dataset.a;
        if (act === 'close') close();
        else if (act === 'prev') open((st.cur - 1 + st.items.length) % st.items.length);
        else if (act === 'next') open((st.cur + 1) % st.items.length);
        else if (act === 'dl') { const it = st.items[st.cur]; if (it) OS.download(it.name, it.url); }
        else if (act === 'wall') {
          const it = st.items[st.cur]; if (!it) return;
          document.documentElement.style.setProperty('--wall-custom', 'url(' + it.url + ') center/cover no-repeat');
          const wp = OS.$('#wallpaper');
          wp.style.backgroundImage = 'url(' + it.url + ')';
          wp.style.backgroundSize = 'cover'; wp.style.backgroundPosition = 'center';
          OS.store.set('wall.custom', it.url);
          OS.settings.set('wallpaperReset', false, true);
          OS.bus.emit('wallpaper', { id: 'custom', css: 'url(' + it.url + ')', fx: 'none' });
          OS.toast('Обои установлены', it.name, { icon: 'image' });
        } else if (act === 'del') {
          const it = st.items[st.cur]; if (!it || it.kind !== 'file') return;
          if (!confirm('Удалить «' + it.name + '»?')) return;
          fs.rm(it.path); OS.bus.emit('fs:changed'); close(); render();
        }
      });
      win.body.querySelector('.ph-act [data-b="gen"]').onclick = () => {
        st.gen = st.gen || [];
        st.gen.unshift({ url: genArt(), seed: Date.now(), at: Date.now() });
        if (st.gen.length > 12) st.gen.pop();
        st.tab = 'art'; win.body.querySelectorAll('.ph-tabs button').forEach((x) => x.classList.toggle('on', x.dataset.t === 'art'));
        render();
      };
      win.body.querySelector('.ph-act [data-b="paint"]').onclick = () => api.open('paint');

      const onKey = (e) => {
        if (!win.root.isConnected || st.cur < 0) return;
        if (e.key === 'Escape') close();
        else if (e.key === 'ArrowLeft') view.querySelector('[data-a="prev"]').click();
        else if (e.key === 'ArrowRight') view.querySelector('[data-a="next"]').click();
      };
      document.addEventListener('keydown', onKey);
      const u = OS.bus.on('fs:changed', () => { if (win.root.isConnected && st.cur < 0) render(); });

      // стартовое наполнение: несколько артов, чтобы галерея не была пустой
      st.gen = Array.from({ length: 6 }, () => ({ url: genArt(), seed: Math.random(), at: Date.now() }));
      if (win.params.path) { st.tab = 'files'; render(); const i = st.items.findIndex((x) => x.path === win.params.path); if (i >= 0) open(i); }
      else render();
      return () => { document.removeEventListener('keydown', onKey); u(); };
    }
  });

  /* =======================================================================
     БРАУЗЕР QWENNET
     ======================================================================= */
  const PAGES = {
    'qwen://home': {
      title: 'QwenNet — Главная',
      text: 'Портал QwenNet',
      html: () => '<div class="nw-hero"><h1>Добро пожаловать в <span>QwenNet</span></h1><p>Локальная сеть QwenOS. Работает без интернета — все страницы хранятся внутри системы.</p>' +
        '<div class="nw-search-big"><input id="nw-q" placeholder="Поиск по QwenNet…"><button id="nw-go">Найти</button></div></div>' +
        '<div class="nw-grid">' + CARDS() + '</div>'
    },
    'qwen://docs': {
      title: 'Документация QwenOS',
      text: 'документация справочник руководство help docs man',
      html: () => '<article class="nw-art"><h1>Документация QwenOS ' + OS.version + '</h1>' + OS.md(DOCS_MD()) + '</article>'
    },
    'qwen://news': {
      title: 'QwenNews — новости системы',
      text: 'новости лог события news',
      html: () => '<article class="nw-art"><h1>Лента событий</h1>' + NEWS().map((n) =>
        '<div class="nw-news"><time>' + n.t + '</time><h3>' + n.h + '</h3><p>' + n.p + '</p></div>').join('') + '</article>'
    },
    'qwen://games': {
      title: 'Каталог игр',
      text: 'игры games каталог',
      html: () => {
        const games = OS.Apps.list().filter((a) => a.category === 'Игры');
        return '<article class="nw-art"><h1>Игровой зал</h1><p class="dim">Нажмите, чтобы запустить игру прямо в браузере QwenNet.</p><div class="nw-games">' +
          games.map((g) => '<button class="nw-game" data-app="' + g.id + '"><i style="' + OS.Apps.tileStyle(g) + '">' + OS.svg(g.icon, 20) + '</i><b>' + OS.esc(g.name) + '</b><span>' + OS.esc(g.category) + '</span></button>').join('') +
          '</div></article>';
      }
    },
    'qwen://apps': {
      title: 'Реестр приложений',
      text: 'приложения apps реестр список',
      html: () => {
        const rows = OS.Apps.list().map((a) => '| ' + a.name + ' | `' + a.id + '` | ' + a.category + ' | ' + (OS.Apps.installed(a.id) ? '✅ установлено' : '⬇ в магазине') + ' |').join('\n');
        return '<article class="nw-art"><h1>Реестр приложений</h1>' + OS.md('| Приложение | ID | Категория | Статус |\n|---|---|---|---|\n' + rows) + '</article>';
      }
    },
    'qwen://sysinfo': {
      title: 'Сведения о системе',
      text: 'система информация system info',
      html: () => {
        const mem = OS.memInfo(), cc = fs.count('/');
        return '<article class="nw-art"><h1>Сведения о системе</h1><pre class="nw-pre">' + OS.esc([
          'QwenOS ' + OS.version + ' «' + OS.codename + '»',
          'Ядро:        ' + OS.kernel,
          'Сборка:      ' + OS.build,
          'Аптайм:      ' + OS.fmtDur(OS.uptime()),
          'Окон открыто:' + ' '.repeat(1) + OS.wm.windows.length,
          'Приложений:  ' + OS.Apps.list().length + ' (' + OS.Apps.list().filter((a) => OS.Apps.installed(a.id)).length + ' установлено)',
          'Файлов в ФС: ' + cc.files + ' файлов, ' + cc.dirs + ' каталогов',
          'Размер ФС:   ' + OS.fmtBytes(fs.du('/')),
          'Память JS:   ' + OS.fmtBytes(mem.used) + ' / ' + OS.fmtBytes(mem.limit),
          'localStorage:' + OS.fmtBytes(OS.store.usage()) + (OS.store.available ? '' : ' (недоступно)'),
          'Экран:       ' + innerWidth + '×' + innerHeight + ' @' + devicePixelRatio + 'x',
          'Платформа:   ' + navigator.platform,
          'Потоков ЦП:  ' + (navigator.hardwareConcurrency || '?'),
          'Язык:        ' + navigator.language,
          'Тач-ввод:    ' + (OS.isTouch ? 'да' : 'нет'),
          'FPS:         ' + OS.perf.fps
        ].join('\n')) + '</pre></article>';
      }
    },
    'qwen://about': {
      title: 'О проекте',
      text: 'о проекте about github автор',
      html: () => '<article class="nw-art"><h1>О проекте</h1>' + OS.md([
        '**QwenOS** — учебная операционная система, полностью собранная на веб-технологиях.',
        '',
        '- Ни одной внешней зависимости: только HTML, CSS и JavaScript',
        '- Не требует сборки: откройте `index.html` — и система запустится',
        '- Работает офлайн и устанавливается как PWA',
        '- Все данные (файлы, настройки, рекорды) хранятся в localStorage',
        '',
        '> «Лучший способ понять, как работает операционная система — написать её на JavaScript»',
        '',
        'Исходный код: [github.com/yungspiderq/QwenOS](https://github.com/yungspiderq/QwenOS)'
      ].join('\n')) + '</article>'
    }
  };

  function CARDS() {
    return [
      ['qwen://docs', 'book', 'Документация', 'Команды терминала, горячие клавиши и устройство системы'],
      ['qwen://news', 'mail', 'QwenNews', 'События и журнал системы в реальном времени'],
      ['qwen://games', 'gamepad', 'Игровой зал', 'Пять игр, запускаемых прямо из браузера'],
      ['qwen://apps', 'grid', 'Реестр приложений', 'Всё, что установлено в этой копии QwenOS'],
      ['qwen://sysinfo', 'cpu', 'Сведения о системе', 'Ядро, память, файлы, FPS и платформа'],
      ['qwen://about', 'heart', 'О проекте', 'Как это сделано и зачем']
    ].map((c) => '<button class="nw-card" data-go="' + c[0] + '"><i>' + OS.svg(c[1], 20) + '</i><b>' + c[2] + '</b><span>' + c[3] + '</span></button>').join('');
  }
  function DOCS_MD() {
    return [
      '## Горячие клавиши',
      '',
      '| Сочетание | Действие |',
      '|---|---|',
      '| `Ctrl+Alt+T` | Открыть терминал |',
      '| `Ctrl+Alt+F` | Открыть файловый менеджер |',
      '| `Meta` / `Ctrl+Esc` | Меню «Пуск» |',
      '| `Alt+Tab` | Переключение между окнами |',
      '| `Meta+Tab` | Обзор всех окон |',
      '| `Esc` | Закрыть меню, диалог или обзор |',
      '| `Ctrl+S` | Сохранить в блокноте и Paint |',
      '',
      '## Команды терминала',
      '',
      '```',
      'ls -l, cd, pwd, cat, write, mkdir, touch, rm -r, mv, cp,',
      'tree, find, grep, wc, du, echo (с перенаправлением >),',
      'neofetch, uname -a, ps, kill, free, df, history, clear,',
      'apps, open, theme, accent, wallpaper, notify, say, store,',
      'cowsay, fortune, matrix, calc, colors, ping, curl, sudo,',
      'reboot, shutdown, lock, exit',
      '```',
      '',
      '## Файловая система',
      '',
      'Корень `/` содержит `home`, `etc`, `var/log`, `tmp`, `bin`, `usr`, `proc`.',
      'Домашний каталог — `/home/<имя>` с папками `Desktop`, `Documents`, `Pictures`, `Music`, `Downloads`, `Projects`.',
      'Всё содержимое сохраняется в localStorage браузера, поэтому переживает перезагрузку страницы.',
      '',
      '## Окна',
      '',
      '- Перетаскивание за заголовок, ресайз за любые края и углы',
      '- Прилипание: потяните окно к левому/правому краю или к верхнему',
      '- Двойной клик по заголовку — развернуть/восстановить',
      '- На телефоне окна открываются на весь экран',
      '',
      '## Установка как приложение (PWA)',
      '',
      'В Chrome/Edge нажмите «Установить приложение» в адресной строке — QwenOS появится в списке программ и будет работать офлайн.'
    ].join('\n');
  }
  function NEWS() {
    const t = new Date().toISOString().slice(11, 16);
    return [
      { t: t, h: 'QwenOS ' + OS.version + ' «' + OS.codename + '» доступна', p: 'Новый оконный менеджер, пять тем оформления, рейкастинг-движок Qwen3D и процедурный синтезатор музыки. Всё на чистом JavaScript без зависимостей.' },
      { t: t, h: 'QwenStore открыт', p: 'Из магазина можно установить «Погоду», «Таймер» и заставку «Матрица». Установка мгновенная — приложения уже находятся внутри системы.' },
      { t: t, h: 'Файловая система стала постоянной', p: 'Документы, рисунки из Paint и настройки теперь переживают перезагрузку страницы благодаря localStorage.' },
      { t: t, h: 'Системный монитор обновлён', p: 'Добавлены живые графики FPS и загрузки ЦП, а также список окон-процессов с возможностью принудительного завершения.' },
      { t: t, h: 'Поддержка мобильных устройств', p: 'На небольших экранах окна разворачиваются автоматически, а панель задач скрывает второстепенные элементы.' }
    ];
  }
  OS.webPages = () => {
    const o = {};
    for (const k in PAGES) o[k] = { title: PAGES[k].title, text: PAGES[k].text };
    return o;
  };

  OS.Apps.register({
    id: 'browser',
    name: 'QwenNet',
    icon: 'globe',
    color: '#3b82f6', color2: '#1e3a8a',
    category: 'Сеть',
    keywords: 'браузер интернет веб browser web net страницы',
    width: 940, height: 620, minWidth: 420, minHeight: 320,
    mount(win, api) {
      const st = { hist: [], hi: -1, url: win.params.url || 'qwen://home' };
      win.body.innerHTML =
        '<div class="nw">' +
          '<div class="nw-bar">' +
            '<button class="ib" data-a="back" title="Назад"></button>' +
            '<button class="ib" data-a="fwd" title="Вперёд"></button>' +
            '<button class="ib" data-a="reload" title="Обновить"></button>' +
            '<button class="ib" data-a="home" title="Домой"></button>' +
            '<div class="nw-addr">' + OS.svg('lock', 13) + '<input spellcheck="false" value="qwen://home" aria-label="Адресная строка"></div>' +
            '<button class="ib" data-a="go" title="Перейти"></button>' +
          '</div>' +
          '<div class="nw-body"><div class="nw-tabs">' +
            '<button data-go="qwen://home">Главная</button><button data-go="qwen://docs">Документация</button>' +
            '<button data-go="qwen://news">Новости</button><button data-go="qwen://games">Игры</button>' +
            '<button data-go="qwen://apps">Приложения</button><button data-go="qwen://sysinfo">Система</button>' +
          '</div><div class="nw-page"></div></div>' +
        '</div>';
      const bar = win.body.querySelector('.nw-bar');
      const addr = bar.querySelector('input');
      const page = win.body.querySelector('.nw-page');
      bar.querySelector('[data-a="back"]').innerHTML = OS.svg('back', 16);
      bar.querySelector('[data-a="fwd"]').innerHTML = OS.svg('fwd', 16);
      bar.querySelector('[data-a="reload"]').innerHTML = OS.svg('refresh', 16);
      bar.querySelector('[data-a="home"]').innerHTML = OS.svg('home', 16);
      bar.querySelector('[data-a="go"]').innerHTML = OS.svg('fwd', 16);

      function norm(u) {
        u = String(u || '').trim();
        if (!u) return 'qwen://home';
        if (PAGES[u]) return u;
        if (/^qwen:\/\//.test(u)) return u;
        if (/^(https?:)?\/\//.test(u)) return u;
        // поисковый запрос
        return 'qwen://search?q=' + encodeURIComponent(u);
      }
      function searchPage(q) {
        q = q.toLowerCase();
        const res = Object.keys(PAGES).filter((k) => (PAGES[k].title + ' ' + (PAGES[k].text || '')).toLowerCase().includes(q));
        return '<article class="nw-art"><h1>Результаты поиска: «' + OS.esc(q) + '»</h1>' +
          (res.length ? '<div class="nw-res">' + res.map((k) => '<button class="nw-card" data-go="' + k + '"><i>' + OS.svg('globe', 18) + '</i><b>' + OS.esc(PAGES[k].title) + '</b><span>' + k + '</span></button>').join('') + '</div>'
            : '<p class="dim">Ничего не найдено. QwenNet — замкнутая сеть: внешний интернет из песочницы недоступен.</p><p><button class="nw-card" data-go="qwen://home"><i>' + OS.svg('home', 18) + '</i><b>На главную</b><span>qwen://home</span></button></p>') +
          '</article>';
      }
      function render(push) {
        const url = st.url;
        addr.value = url;
        let html;
        if (PAGES[url]) html = PAGES[url].html();
        else if (url.startsWith('qwen://search')) {
          const q = decodeURIComponent((url.split('q=')[1] || ''));
          html = searchPage(q);
        } else if (/^https?:/.test(url)) {
          html = '<article class="nw-art nw-blocked"><h1>' + OS.svg('shield', 22) + ' Внешний доступ заблокирован</h1>' +
            '<p>QwenOS работает в песочнице браузера и не обращается к внешним серверам — это сделано специально, чтобы система оставалась автономной и мгновенной.</p>' +
            '<p class="dim">Запрошенный адрес: <code>' + OS.esc(url) + '</code></p>' +
            '<p>Внутренние страницы QwenNet: <code>qwen://home</code>, <code>qwen://docs</code>, <code>qwen://news</code>, <code>qwen://games</code>, <code>qwen://apps</code>, <code>qwen://sysinfo</code>, <code>qwen://about</code>.</p>' +
            '<button class="btn btn-accent btn-sm" data-go="qwen://home">Вернуться на главную</button></article>';
        } else {
          html = '<article class="nw-art"><h1>404 — страница не найдена</h1><p class="dim">Адрес <code>' + OS.esc(url) + '</code> не существует в QwenNet.</p><button class="btn btn-accent btn-sm" data-go="qwen://home">На главную</button></article>';
        }
        page.innerHTML = html;
        page.scrollTop = 0;
        win.setTitle('QwenNet — ' + (PAGES[url] ? PAGES[url].title : url));
        if (push !== false) { st.hist = st.hist.slice(0, st.hi + 1); st.hist.push(url); st.hi = st.hist.length - 1; }
        bar.querySelector('[data-a="back"]').disabled = st.hi <= 0;
        bar.querySelector('[data-a="fwd"]').disabled = st.hi >= st.hist.length - 1;
      }
      function go(u, push) { st.url = norm(u); render(push); }

      bar.addEventListener('click', (e) => {
        const b = e.target.closest('[data-a]'); if (!b) return;
        const a = b.dataset.a;
        if (a === 'back' && st.hi > 0) { st.hi--; st.url = st.hist[st.hi]; render(false); }
        else if (a === 'fwd' && st.hi < st.hist.length - 1) { st.hi++; st.url = st.hist[st.hi]; render(false); }
        else if (a === 'reload') render(false);
        else if (a === 'home') go('qwen://home');
        else if (a === 'go') go(addr.value);
      });
      addr.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(addr.value); });
      page.addEventListener('click', (e) => {
        const g = e.target.closest('[data-go]');
        if (g) { go(g.dataset.go); return; }
        const app = e.target.closest('[data-app]');
        if (app) { api.open(app.dataset.app); OS.toast('Запуск', 'Приложение открыто из QwenNet', { icon: 'rocket', timeout: 2000 }); return; }
        const link = e.target.closest('a[href]');
        if (link) {
          e.preventDefault();
          const href = link.getAttribute('href');
          if (/^https?:/.test(href)) window.open(href, '_blank', 'noopener');
          else go(href);
        }
      });
      win.body.querySelector('.nw-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });

      // поисковая форма на главной
      const wireSearch = () => {
        const q = page.querySelector('#nw-q'), b = page.querySelector('#nw-go');
        if (!q || !b) return;
        const act = () => go('qwen://search?q=' + encodeURIComponent(q.value));
        b.onclick = act;
        q.addEventListener('keydown', (e) => { if (e.key === 'Enter') act(); });
      };
      const origRender = render;
      render = function (push) { origRender(push); wireSearch(); };
      render();
      return () => { };
    }
  });

  /* =======================================================================
     ЗАСТАВКА «МАТРИЦА» (устанавливается из QwenStore)
     ======================================================================= */
  OS.Apps.register({
    id: 'matrix',
    name: 'Матрица',
    icon: 'code',
    color: '#16a34a', color2: '#052e16',
    category: 'Развлечения',
    keywords: 'заставка screensaver matrix дождь код',
    width: 700, height: 460, minWidth: 320, minHeight: 240,
    storeOnly: true,
    mount(win) {
      win.body.innerHTML = '<div class="mx"><canvas></canvas><div class="mx-hint">Нажмите Esc или закройте окно, чтобы выйти</div></div>';
      const cv = win.body.querySelector('canvas'), ctx = cv.getContext('2d');
      const size = 15; let drops = [], raf = 0;
      const chars = 'アカサタナハマヤラワイキシチニヒミリウグズブヅプ0123456789QWENOS█▓▒░<>{}[]$#@%&*+=';
      function resize() {
        const r = win.body.getBoundingClientRect();
        cv.width = Math.max(100, r.width); cv.height = Math.max(80, r.height);
        drops = new Array(Math.ceil(cv.width / size)).fill(0).map(() => Math.random() * -60);
      }
      function draw() {
        raf = requestAnimationFrame(draw);
        if (!win.root.isConnected) return;
        ctx.fillStyle = 'rgba(0,5,2,.085)'; ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.font = size + 'px monospace';
        for (let i = 0; i < drops.length; i++) {
          const ch = chars[Math.floor(Math.random() * chars.length)];
          const y = drops[i] * size;
          ctx.fillStyle = Math.random() > .97 ? '#e6ffe6' : (Math.random() > .6 ? '#22c55e' : '#15803d');
          ctx.fillText(ch, i * size, y);
          if (y > cv.height && Math.random() > .975) drops[i] = 0;
          drops[i] += .6 + Math.random() * .7;
        }
      }
      resize(); draw();
      win.root.addEventListener('wm:resize', resize);
      addEventListener('resize', OS.debounce(resize, 200));
      const onKey = (e) => { if (e.key === 'Escape' && OS.wm.active === win) win.close(); };
      document.addEventListener('keydown', onKey);
      return () => { cancelAnimationFrame(raf); document.removeEventListener('keydown', onKey); };
    }
  });
})(window.OS);
