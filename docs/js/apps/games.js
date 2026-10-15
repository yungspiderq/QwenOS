/* ==========================================================================
   QwenOS 3.0 — apps/games.js
   Змейка · Сапёр · 2048 · Арканоид · Qwen3D (рейкастинг)
   ========================================================================== */
(function (OS) {
  'use strict';

  /* общий помощник: клавиши + свайпы */
  function bindInput(win, el, onDir, onTap) {
    const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', ц: 'up', ы: 'left', ф: 'left', в: 'up' };
    const onKey = (e) => {
      if (!win.root.isConnected || OS.wm.active !== win) return;
      const ae = document.activeElement;
      if (ae && /INPUT|TEXTAREA/.test(ae.tagName) && !win.body.contains(ae)) return;
      const d = map[e.key] || map[e.key.toLowerCase()];
      if (d) { e.preventDefault(); onDir(d); }
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onTap && onTap('tap'); }
      else if (e.key === 'Escape') { onTap && onTap('esc'); }
    };
    document.addEventListener('keydown', onKey);
    let sx = 0, sy = 0, tracking = false;
    el.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; tracking = true; });
    el.addEventListener('pointerup', (e) => {
      if (!tracking) return; tracking = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) < 22 && Math.abs(dy) < 22) { onTap && onTap('tap'); return; }
      onDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    });
    return () => document.removeEventListener('keydown', onKey);
  }

  const best = (k, v) => {
    const prev = OS.store.get('best.' + k, 0) || 0;
    if (v == null) return prev;
    if (v > prev) { OS.store.set('best.' + k, v); return v; }
    return prev;
  };

  /* =======================================================================
     ЗМЕЙКА
     ======================================================================= */
  OS.Apps.register({
    id: 'snake',
    name: 'Змейка',
    icon: 'snake',
    color: '#22c55e', color2: '#166534',
    category: 'Игры',
    keywords: 'snake змейка игра arcade',
    width: 560, height: 620, minWidth: 340, minHeight: 420,
    mount(win) {
      const N = 20;
      let cell = 22, snake = [], dir = { x: 1, y: 0 }, nextDir = { x: 1, y: 0 }, food = null, score = 0, alive = true, paused = false, speed = 130, timer = null, bonus = null;
      win.body.innerHTML =
        '<div class="gm">' +
          '<div class="gm-hud"><span>Очки <b id="sn-s">0</b></span><span>Рекорд <b id="sn-b">0</b></span><span>Скорость <b id="sn-v">1</b></span>' +
          '<div class="gm-hud-btns"><button class="btn btn-sm" id="sn-p">Пауза</button><button class="btn btn-sm btn-accent" id="sn-r">Заново</button></div></div>' +
          '<div class="gm-stage"><canvas id="sn-cv"></canvas><div class="gm-over hidden" id="sn-o"></div></div>' +
          '<div class="gm-tip">Стрелки или WASD · пробел — пауза · на телефоне — свайпы</div>' +
        '</div>';
      const cv = win.body.querySelector('#sn-cv'), ctx = cv.getContext('2d');
      const over = win.body.querySelector('#sn-o');
      const sEl = win.body.querySelector('#sn-s'), bEl = win.body.querySelector('#sn-b'), vEl = win.body.querySelector('#sn-v');
      bEl.textContent = best('snake');

      function resize() {
        const st = win.body.querySelector('.gm-stage').getBoundingClientRect();
        cell = Math.max(10, Math.floor(Math.min(st.width, st.height) / N) - 1);
        cv.width = cell * N; cv.height = cell * N;
        draw();
      }
      function reset() {
        snake = [{ x: 5, y: 10 }, { x: 4, y: 10 }, { x: 3, y: 10 }];
        dir = nextDir = { x: 1, y: 0 }; score = 0; alive = true; paused = false; speed = 130; bonus = null;
        placeFood(); sEl.textContent = 0; vEl.textContent = 1;
        over.classList.add('hidden');
        clearInterval(timer); timer = setInterval(tick, speed);
        draw();
      }
      function placeFood() {
        let p;
        do { p = { x: OS.rndi(0, N - 1), y: OS.rndi(0, N - 1) }; } while (snake.some((s) => s.x === p.x && s.y === p.y));
        food = p;
      }
      function tick() {
        if (!alive || paused) return;
        dir = nextDir;
        const h = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
        if (h.x < 0 || h.y < 0 || h.x >= N || h.y >= N || snake.some((s) => s.x === h.x && s.y === h.y)) return die();
        snake.unshift(h);
        let ate = false;
        if (h.x === food.x && h.y === food.y) { score += 10; ate = true; placeFood(); if (Math.random() < .25 && !bonus) bonus = { x: OS.rndi(0, N - 1), y: OS.rndi(0, N - 1), t: 60 }; }
        if (bonus && h.x === bonus.x && h.y === bonus.y) { score += 50; bonus = null; ate = true; OS.toast('Бонус!', '+50 очков', { icon: 'coin', timeout: 1400 }); }
        if (bonus && --bonus.t <= 0) bonus = null;
        if (!ate) snake.pop();
        sEl.textContent = score;
        const lvl = 1 + Math.floor(score / 60);
        vEl.textContent = lvl;
        const ns = Math.max(55, 130 - (lvl - 1) * 9);
        if (ns !== speed) { speed = ns; clearInterval(timer); timer = setInterval(tick, speed); }
        draw();
      }
      function die() {
        alive = false; clearInterval(timer);
        const rec = best('snake', score);
        bEl.textContent = rec;
        OS.sfx.play('error');
        over.classList.remove('hidden');
        over.innerHTML = '<div><h3>Игра окончена</h3><p>Очки: <b>' + score + '</b></p><p class="dim">Рекорд: ' + rec + '</p><button class="btn btn-accent" id="sn-again">Ещё раз</button></div>';
        over.querySelector('#sn-again').onclick = reset;
      }
      function draw() {
        if (!food || !snake.length) return;
        const cs = getComputedStyle(document.documentElement);
        const ac = (cs.getPropertyValue('--accent') || '#8b5cf6').trim();
        const ac2 = (cs.getPropertyValue('--accent-2') || '#22d3ee').trim();
        ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.strokeStyle = 'rgba(255,255,255,.045)'; ctx.lineWidth = 1;
        for (let i = 1; i < N; i++) { ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, cv.height); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(cv.width, i * cell); ctx.stroke(); }
        // еда
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath(); ctx.arc(food.x * cell + cell / 2, food.y * cell + cell / 2, cell * .34, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.5)';
        ctx.beginPath(); ctx.arc(food.x * cell + cell * .42, food.y * cell + cell * .38, cell * .09, 0, 7); ctx.fill();
        if (bonus) {
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath(); ctx.arc(bonus.x * cell + cell / 2, bonus.y * cell + cell / 2, cell * .3, 0, 7); ctx.fill();
          ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.font = 'bold ' + Math.floor(cell * .4) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('★', bonus.x * cell + cell / 2, bonus.y * cell + cell / 2 + 1);
        }
        // змея
        snake.forEach((s, i) => {
          const t = i / Math.max(1, snake.length - 1);
          ctx.fillStyle = i === 0 ? ac2 : mix(ac, ac2, t);
          const pad = i === 0 ? 1 : 1.5;
          rr(ctx, s.x * cell + pad, s.y * cell + pad, cell - pad * 2, cell - pad * 2, cell * .28);
          if (i === 0) {
            ctx.fillStyle = '#04121a';
            const ex = dir.x, ey = dir.y;
            ctx.beginPath(); ctx.arc(s.x * cell + cell / 2 + ex * cell * .18 - ey * cell * .17, s.y * cell + cell / 2 + ey * cell * .18 - ex * cell * .17, cell * .08, 0, 7); ctx.fill();
            ctx.beginPath(); ctx.arc(s.x * cell + cell / 2 + ex * cell * .18 + ey * cell * .17, s.y * cell + cell / 2 + ey * cell * .18 + ex * cell * .17, cell * .08, 0, 7); ctx.fill();
          }
        });
        if (paused && alive) {
          ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, cv.width, cv.height);
          ctx.fillStyle = '#fff'; ctx.font = 'bold 20px system-ui'; ctx.textAlign = 'center';
          ctx.fillText('ПАУЗА', cv.width / 2, cv.height / 2);
        }
      }
      function mix(a, b, t) {
        const pa = hex(a), pb = hex(b);
        return 'rgb(' + Math.round(pa[0] + (pb[0] - pa[0]) * t) + ',' + Math.round(pa[1] + (pb[1] - pa[1]) * t) + ',' + Math.round(pa[2] + (pb[2] - pa[2]) * t) + ')';
      }
      function hex(h) {
        h = (h || '#888').trim();
        if (h[0] === '#') h = h.slice(1);
        if (h.length === 3) h = h.split('').map((c) => c + c).join('');
        const n = parseInt(h, 16);
        return isNaN(n) ? [136, 136, 136] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      }
      function rr(c, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        c.beginPath();
        if (c.roundRect) { c.roundRect(x, y, w, h, r); c.fill(); return; }
        c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
        c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); c.fill();
      }

      const un = bindInput(win, cv, (d) => {
        if (!alive) return;
        const m = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[d];
        if (m.x === -dir.x && m.y === -dir.y) return;
        nextDir = m;
      }, (t) => { if (t === 'tap' || t === 'esc') togglePause(); });
      function togglePause() { if (!alive) return; paused = !paused; win.body.querySelector('#sn-p').textContent = paused ? 'Продолжить' : 'Пауза'; draw(); }
      win.body.querySelector('#sn-p').onclick = togglePause;
      win.body.querySelector('#sn-r').onclick = reset;
      win.root.addEventListener('wm:resize', resize);
      addEventListener('resize', OS.debounce(resize, 150));
      resize(); reset();
      return () => { clearInterval(timer); un(); };
    }
  });

  /* =======================================================================
     САПЁР
     ======================================================================= */
  OS.Apps.register({
    id: 'mines',
    name: 'Сапёр',
    icon: 'bomb',
    color: '#ef4444', color2: '#7f1d1d',
    category: 'Игры',
    keywords: 'minesweeper сапёр мины игра',
    width: 620, height: 640, minWidth: 360, minHeight: 460,
    mount(win) {
      const LEVELS = { easy: { w: 9, h: 9, m: 10, name: 'Новичок' }, mid: { w: 16, h: 16, m: 40, name: 'Любитель' }, hard: { w: 22, h: 14, m: 62, name: 'Эксперт' } };
      let lv = OS.store.get('mines.lv', 'easy'), G = null;

      win.body.innerHTML =
        '<div class="gm">' +
          '<div class="gm-hud"><span>Мины <b id="ms-m">0</b></span><span>Время <b id="ms-t">0</b></span>' +
          '<div class="gm-hud-btns"><select class="field" id="ms-lv" style="width:auto;padding:5px 8px"></select><button class="btn btn-sm btn-accent" id="ms-r">Заново</button></div></div>' +
          '<div class="gm-stage ms-stage"><div class="ms-board" id="ms-b"></div><div class="gm-over hidden" id="ms-o"></div></div>' +
          '<div class="gm-tip">ЛКМ — открыть · ПКМ (или долгое нажатие) — флаг · первая клетка всегда безопасна</div>' +
        '</div>';
      const board = win.body.querySelector('#ms-b'), over = win.body.querySelector('#ms-o');
      const mEl = win.body.querySelector('#ms-m'), tEl = win.body.querySelector('#ms-t'), lvSel = win.body.querySelector('#ms-lv');
      lvSel.innerHTML = Object.keys(LEVELS).map((k) => '<option value="' + k + '">' + LEVELS[k].name + ' (' + LEVELS[k].w + '×' + LEVELS[k].h + ', ' + LEVELS[k].m + ' мин)</option>').join('');
      lvSel.value = lv;
      lvSel.onchange = () => { lv = lvSel.value; OS.store.set('mines.lv', lv); reset(); };
      win.body.querySelector('#ms-r').onclick = reset;

      let timer = null, secs = 0;

      function reset() {
        const L = LEVELS[lv];
        G = { w: L.w, h: L.h, m: L.m, cells: [], started: false, over: false, flags: 0, opened: 0 };
        for (let i = 0; i < L.w * L.h; i++) G.cells.push({ mine: false, open: false, flag: false, n: 0 });
        secs = 0; clearInterval(timer); timer = null;
        tEl.textContent = '0'; mEl.textContent = L.m;
        over.classList.add('hidden');
        render();
      }
      function neighbors(i) {
        const x = i % G.w, y = Math.floor(i / G.w), out = [];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < G.w && ny < G.h) out.push(ny * G.w + nx);
        }
        return out;
      }
      function place(safe) {
        const idx = [];
        for (let i = 0; i < G.cells.length; i++) if (!neighbors(safe).includes(i) && i !== safe) idx.push(i);
        for (let k = 0; k < G.m; k++) {
          const p = Math.floor(Math.random() * idx.length);
          const cell = idx.splice(p, 1)[0];
          if (cell == null) break;
          G.cells[cell].mine = true;
        }
        G.cells.forEach((c, i) => { c.n = neighbors(i).filter((n) => G.cells[n].mine).length; });
        G.started = true;
        timer = setInterval(() => { secs++; tEl.textContent = secs; }, 1000);
      }
      function open(i) {
        const c = G.cells[i];
        if (!c || c.open || c.flag || G.over) return;
        if (!G.started) place(i);
        c.open = true; G.opened++;
        if (c.mine) return boom(i);
        if (c.n === 0) neighbors(i).forEach((n) => open(n));
        checkWin();
      }
      function boom(i) {
        G.over = true; clearInterval(timer);
        G.cells[i].hit = true;
        G.cells.forEach((c) => { if (c.mine) c.open = true; });
        render();
        OS.sfx.play('error');
        over.classList.remove('hidden');
        over.innerHTML = '<div><h3>Взрыв!</h3><p class="dim">Вы продержались ' + secs + ' с</p><button class="btn btn-accent" id="ms-again">Ещё раз</button></div>';
        over.querySelector('#ms-again').onclick = reset;
      }
      function checkWin() {
        if (G.opened === G.cells.length - G.m) {
          G.over = true; clearInterval(timer);
          const rec = best('mines.' + lv, Math.max(1, 1000 - secs));
          render();
          OS.sfx.play('ok');
          over.classList.remove('hidden');
          over.innerHTML = '<div><h3>Поле разминировано! 🎉</h3><p>Время: <b>' + secs + ' с</b></p><p class="dim">Уровень: ' + LEVELS[lv].name + '</p><button class="btn btn-accent" id="ms-again">Ещё раз</button></div>';
          over.querySelector('#ms-again').onclick = reset;
          OS.toast('Победа!', 'Сапёр · ' + LEVELS[lv].name + ' за ' + secs + ' с', { icon: 'star' });
        } else render();
      }
      function flag(i) {
        const c = G.cells[i];
        if (!c || c.open || G.over) return;
        c.flag = !c.flag;
        G.flags += c.flag ? 1 : -1;
        mEl.textContent = G.m - G.flags;
        render();
      }
      function render() {
        board.style.gridTemplateColumns = 'repeat(' + G.w + ', 1fr)';
        board.innerHTML = '';
        G.cells.forEach((c, i) => {
          const d = OS.el('div', { class: 'ms-c' + (c.open ? ' open' : '') + (c.flag ? ' flag' : '') + (c.hit ? ' hit' : '') + (c.mine && c.open ? ' mine' : '') });
          if (c.open) {
            if (c.mine) d.textContent = '💣';
            else if (c.n) { d.textContent = c.n; d.classList.add('n' + c.n); }
          } else if (c.flag) d.textContent = '🚩';
          d.oncontextmenu = (e) => { e.preventDefault(); flag(i); };
          d.onclick = (e) => { e.preventDefault(); open(i); };
          let lt = null;
          d.addEventListener('pointerdown', () => { lt = setTimeout(() => { flag(i); lt = null; }, 420); });
          d.addEventListener('pointerup', () => { if (lt) clearTimeout(lt); });
          d.addEventListener('pointermove', () => { if (lt) { clearTimeout(lt); lt = null; } });
          board.append(d);
        });
      }
      reset();
      return () => clearInterval(timer);
    }
  });

  /* =======================================================================
     2048
     ======================================================================= */
  OS.Apps.register({
    id: 'game2048',
    name: '2048',
    icon: 'hash',
    color: '#f59e0b', color2: '#b91c1c',
    category: 'Игры',
    keywords: '2048 головоломка puzzle игра числа',
    width: 480, height: 620, minWidth: 330, minHeight: 460,
    mount(win) {
      const S = 4;
      let g = [], score = 0, prev = null, won = false, dead = false;
      win.body.innerHTML =
        '<div class="gm">' +
          '<div class="gm-hud"><span>Счёт <b id="g2-s">0</b></span><span>Рекорд <b id="g2-b">0</b></span>' +
          '<div class="gm-hud-btns"><button class="btn btn-sm" id="g2-u">Отменить</button><button class="btn btn-sm btn-accent" id="g2-r">Заново</button></div></div>' +
          '<div class="gm-stage g2-stage"><div class="g2-board" id="g2-b"></div><div class="gm-over hidden" id="g2-o"></div></div>' +
          '<div class="gm-tip">Стрелки / WASD / свайпы — сдвиг плиток. Соберите 2048!</div>' +
        '</div>';
      const board = win.body.querySelector('#g2-b'), over = win.body.querySelector('#g2-o');
      const sEl = win.body.querySelector('#g2-s'), bEl = win.body.querySelector('#g2-b');
      bEl.textContent = best('2048');

      function empty() { return Array.from({ length: S }, () => new Array(S).fill(0)); }
      function addRandom() {
        const free = [];
        g.forEach((r, y) => r.forEach((v, x) => { if (!v) free.push([x, y]); }));
        if (!free.length) return;
        const [x, y] = free[Math.floor(Math.random() * free.length)];
        g[y][x] = Math.random() < .9 ? 2 : 4;
      }
      function reset() { g = empty(); score = 0; won = dead = false; prev = null; addRandom(); addRandom(); render(); over.classList.add('hidden'); }
      function snapshot() { prev = { g: g.map((r) => r.slice()), score: score }; }
      function undo() { if (!prev) return; g = prev.g; score = prev.score; prev = null; dead = false; render(); }

      function slide(row) {
        const a = row.filter((v) => v);
        for (let i = 0; i < a.length - 1; i++) if (a[i] === a[i + 1]) { a[i] *= 2; score += a[i]; if (a[i] === 2048) won = true; a.splice(i + 1, 1); }
        while (a.length < S) a.push(0);
        return a;
      }
      function move(dir) {
        if (dead) return;
        snapshot();
        const before = JSON.stringify(g);
        const col = (x) => g.map((r) => r[x]);
        const setCol = (x, arr) => arr.forEach((v, y) => { g[y][x] = v; });
        if (dir === 'left') g = g.map((r) => slide(r));
        else if (dir === 'right') g = g.map((r) => slide(r.slice().reverse()).reverse());
        else if (dir === 'up') for (let x = 0; x < S; x++) setCol(x, slide(col(x)));
        else for (let x = 0; x < S; x++) setCol(x, slide(col(x).reverse()).reverse());
        if (JSON.stringify(g) === before) { prev = null; return; }
        addRandom();
        OS.sfx.play('click');
        render();
        if (won) { won = false; showOver('2048! 🎉', 'Вы собрали плитку 2048. Можно продолжать.', 'Продолжить'); }
        if (!canMove()) { dead = true; best('2048', score); showOver('Игра окончена', 'Счёт: ' + score + ' · рекорд: ' + best('2048'), 'Заново', true); }
      }
      function canMove() {
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          if (!g[y][x]) return true;
          if (x < S - 1 && g[y][x] === g[y][x + 1]) return true;
          if (y < S - 1 && g[y][x] === g[y + 1][x]) return true;
        }
        return false;
      }
      function showOver(title, text, btn, isDead) {
        over.classList.remove('hidden');
        over.innerHTML = '<div><h3>' + title + '</h3><p class="dim">' + text + '</p><button class="btn btn-accent" id="g2-a">' + btn + '</button></div>';
        over.querySelector('#g2-a').onclick = () => { over.classList.add('hidden'); if (isDead) reset(); };
      }
      function render() {
        sEl.textContent = score;
        bEl.textContent = best('2048', score);
        board.innerHTML = '';
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const v = g[y][x];
          const t = OS.el('div', { class: 'g2-t' + (v ? ' v' + v : '') });
          t.textContent = v || '';
          if (v >= 1024) t.classList.add('big');
          board.append(t);
        }
        win.setTitle('2048 — ' + score + ' очков');
      }
      const un = bindInput(win, board, (d) => move(d), (t) => { if (t === 'tap') undo(); });
      win.body.querySelector('#g2-r').onclick = reset;
      win.body.querySelector('#g2-u').onclick = undo;
      reset();
      return () => un();
    }
  });

  /* =======================================================================
     АРКАНОИД
     ======================================================================= */
  OS.Apps.register({
    id: 'breakout',
    name: 'Арканоид',
    icon: 'breakout',
    color: '#06b6d4', color2: '#1e3a8a',
    category: 'Игры',
    keywords: 'breakout арканоид кирпичи arcade игра',
    width: 700, height: 620, minWidth: 380, minHeight: 460,
    mount(win) {
      let W = 600, H = 420;
      const st = {
        px: 0, pw: 92, ph: 12, bx: 0, by: 0, vx: 3.4, vy: -3.4, r: 6,
        bricks: [], lives: 3, score: 0, level: 1, run: false, raf: 0, keys: {}
      };
      win.body.innerHTML =
        '<div class="gm">' +
          '<div class="gm-hud"><span>Очки <b id="bk-s">0</b></span><span>Уровень <b id="bk-l">1</b></span><span>Жизни <b id="bk-h">❤❤❤</b></span><span>Рекорд <b id="bk-b">0</b></span>' +
          '<div class="gm-hud-btns"><button class="btn btn-sm" id="bk-p">Пауза</button><button class="btn btn-sm btn-accent" id="bk-r">Заново</button></div></div>' +
          '<div class="gm-stage"><canvas id="bk-cv"></canvas><div class="gm-over hidden" id="bk-o"></div></div>' +
          '<div class="gm-tip">Мышь/палец или ← → · пробел — запуск мяча и пауза</div>' +
        '</div>';
      const cv = win.body.querySelector('#bk-cv'), ctx = cv.getContext('2d');
      const over = win.body.querySelector('#bk-o');
      const sEl = win.body.querySelector('#bk-s'), lEl = win.body.querySelector('#bk-l'), hEl = win.body.querySelector('#bk-h'), bEl = win.body.querySelector('#bk-b');
      bEl.textContent = best('breakout');

      function resize() {
        const r = win.body.querySelector('.gm-stage').getBoundingClientRect();
        W = Math.max(280, Math.floor(r.width)); H = Math.max(240, Math.floor(r.height));
        cv.width = W; cv.height = H;
        st.px = W / 2 - st.pw / 2;
        buildLevel();
      }
      function buildLevel() {
        st.bricks = [];
        const cols = Math.max(6, Math.min(12, Math.floor(W / 62)));
        const rows = Math.min(7, 3 + st.level);
        const bw = (W - 24) / cols, bh = Math.min(22, H / 16);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          if (st.level > 2 && (r + c) % 7 === 3) continue;
          st.bricks.push({ x: 12 + c * bw, y: 34 + r * (bh + 4), w: bw - 4, h: bh, hp: r < 1 && st.level > 1 ? 2 : 1, hue: 200 - r * 26 });
        }
        resetBall();
      }
      function resetBall() { st.bx = W / 2; st.by = H - 40; st.vx = (Math.random() < .5 ? -1 : 1) * (3 + st.level * .25); st.vy = -(3.4 + st.level * .25); st.run = false; }
      function reset() { st.score = 0; st.lives = 3; st.level = 1; over.classList.add('hidden'); buildLevel(); hud(); loop(); }
      function hud() { sEl.textContent = st.score; lEl.textContent = st.level; hEl.textContent = '❤'.repeat(Math.max(0, st.lives)) || '—'; }

      function loop() {
        cancelAnimationFrame(st.raf);
        const step = () => {
          st.raf = requestAnimationFrame(step);
          if (!win.root.isConnected) return;
          update(); draw();
        };
        st.raf = requestAnimationFrame(step);
      }
      function update() {
        if (st.keys.left) st.px = Math.max(0, st.px - 7);
        if (st.keys.right) st.px = Math.min(W - st.pw, st.px + 7);
        if (!st.run) { st.bx = st.px + st.pw / 2; st.by = H - 40; return; }
        st.bx += st.vx; st.by += st.vy;
        if (st.bx < st.r) { st.bx = st.r; st.vx *= -1; }
        if (st.bx > W - st.r) { st.bx = W - st.r; st.vx *= -1; }
        if (st.by < st.r) { st.by = st.r; st.vy *= -1; }
        // платформа
        if (st.vy > 0 && st.by + st.r >= H - 26 && st.by + st.r <= H - 26 + st.ph + 8 && st.bx >= st.px - st.r && st.bx <= st.px + st.pw + st.r) {
          const hit = (st.bx - (st.px + st.pw / 2)) / (st.pw / 2);
          st.vx = hit * 5.4; st.vy = -Math.abs(st.vy) * 1.005;
          st.by = H - 26 - st.r;
          OS.sfx.play('click');
        }
        // кирпичи
        for (let i = 0; i < st.bricks.length; i++) {
          const b = st.bricks[i];
          if (st.bx + st.r > b.x && st.bx - st.r < b.x + b.w && st.by + st.r > b.y && st.by - st.r < b.y + b.h) {
            const ox = Math.min(st.bx + st.r - b.x, b.x + b.w - (st.bx - st.r));
            const oy = Math.min(st.by + st.r - b.y, b.y + b.h - (st.by - st.r));
            if (ox < oy) st.vx *= -1; else st.vy *= -1;
            b.hp--;
            if (b.hp <= 0) { st.bricks.splice(i, 1); st.score += 10 * st.level; }
            else st.score += 4;
            hud(); OS.sfx.play('ok');
            break;
          }
        }
        if (!st.bricks.length) {
          st.level++; st.score += 100;
          if (st.level > 6) return gameOver(true);
          OS.toast('Уровень ' + st.level, 'Кирпичи восстановлены', { icon: 'layers', timeout: 1800 });
          buildLevel(); hud();
        }
        if (st.by > H + 20) {
          st.lives--; hud();
          if (st.lives <= 0) return gameOver(false);
          resetBall();
        }
        const sp = Math.hypot(st.vx, st.vy), max = 8.4;
        if (sp > max) { st.vx = st.vx / sp * max; st.vy = st.vy / sp * max; }
      }
      function draw() {
        const cs = getComputedStyle(document.documentElement);
        ctx.clearRect(0, 0, W, H);
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, 'rgba(10,14,30,.85)'); bg.addColorStop(1, 'rgba(4,6,14,.95)');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(255,255,255,.05)';
        for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        st.bricks.forEach((b) => {
          const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
          g.addColorStop(0, 'hsl(' + b.hue + ',85%,' + (b.hp > 1 ? 68 : 58) + '%)');
          g.addColorStop(1, 'hsl(' + (b.hue + 24) + ',80%,' + (b.hp > 1 ? 46 : 38) + '%)');
          ctx.fillStyle = g;
          ctx.beginPath();
          if (ctx.roundRect) { ctx.roundRect(b.x, b.y, b.w, b.h, 4); ctx.fill(); } else ctx.fillRect(b.x, b.y, b.w, b.h);
          ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(b.x + 2, b.y + 2, b.w - 4, 2);
        });
        const pg = ctx.createLinearGradient(st.px, 0, st.px + st.pw, 0);
        pg.addColorStop(0, (cs.getPropertyValue('--accent') || '#8b5cf6').trim());
        pg.addColorStop(1, (cs.getPropertyValue('--accent-2') || '#22d3ee').trim());
        ctx.fillStyle = pg;
        ctx.beginPath();
        if (ctx.roundRect) { ctx.roundRect(st.px, H - 26, st.pw, st.ph, 6); ctx.fill(); } else ctx.fillRect(st.px, H - 26, st.pw, st.ph);
        ctx.shadowColor = 'rgba(255,255,255,.7)'; ctx.shadowBlur = 14;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(st.bx, st.by, st.r, 0, 7); ctx.fill();
        ctx.shadowBlur = 0;
        if (!st.run) {
          ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = '13px system-ui'; ctx.textAlign = 'center';
          ctx.fillText('Пробел или клик — запуск мяча', W / 2, H / 2);
        }
      }
      function gameOver(winAll) {
        st.run = false; cancelAnimationFrame(st.raf);
        const rec = best('breakout', st.score);
        bEl.textContent = rec;
        OS.sfx.play(winAll ? 'ok' : 'error');
        over.classList.remove('hidden');
        over.innerHTML = '<div><h3>' + (winAll ? 'Все уровни пройдены! 🏆' : 'Игра окончена') + '</h3><p>Очки: <b>' + st.score + '</b></p><p class="dim">Рекорд: ' + rec + '</p><button class="btn btn-accent" id="bk-a">Ещё раз</button></div>';
        over.querySelector('#bk-a').onclick = reset;
      }

      cv.addEventListener('pointermove', (e) => { const r = cv.getBoundingClientRect(); st.px = OS.clamp(e.clientX - r.left - st.pw / 2, 0, W - st.pw); });
      cv.addEventListener('pointerdown', () => { st.run = true; });
      const un = bindInput(win, cv, (d) => {
        if (d === 'left') { st.px = Math.max(0, st.px - 26); }
        if (d === 'right') { st.px = Math.min(W - st.pw, st.px + 26); }
      }, () => { st.run = !st.run ? true : st.run; if (st.run === false) st.run = true; });
      document.addEventListener('keydown', (e) => {
        if (!win.root.isConnected || OS.wm.active !== win) return;
        if (e.key === 'ArrowLeft' || e.key === 'a') st.keys.left = true;
        if (e.key === 'ArrowRight' || e.key === 'd') st.keys.right = true;
        if (e.key === ' ') { e.preventDefault(); st.run = true; }
      });
      document.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'a') st.keys.left = false;
        if (e.key === 'ArrowRight' || e.key === 'd') st.keys.right = false;
      });
      win.body.querySelector('#bk-p').onclick = () => { st.run = !st.run; };
      win.body.querySelector('#bk-r').onclick = reset;
      win.root.addEventListener('wm:resize', OS.debounce(resize, 120));
      addEventListener('resize', OS.debounce(resize, 200));
      resize(); reset();
      return () => cancelAnimationFrame(st.raf);
    }
  });

  /* =======================================================================
     QWEN3D — рейкастинг от первого лица
     ======================================================================= */
  OS.Apps.register({
    id: 'qwen3d',
    name: 'Qwen3D',
    icon: 'cube',
    color: '#6366f1', color2: '#0f172a',
    category: 'Игры',
    keywords: '3d doom wolfenstein рейкастинг лабиринт шутер first person',
    width: 820, height: 580, minWidth: 380, minHeight: 340,
    mount(win) {
      const MAP = [
        '################',
        '#..............#',
        '#.####.#####.#.#',
        '#.#..#.....#.#.#',
        '#.#.#####..#.#.#',
        '#.#.....#..#...#',
        '#.#####.#.######',
        '#.....#.#......#',
        '#####.#.####.#.#',
        '#.....#....#.#.#',
        '#.########.#.#.#',
        '#.#........#...#',
        '#.#.##########.#',
        '#.#..........#.#',
        '#......####....#',
        '################'
      ].map((r) => r.split(''));
      const MW = MAP[0].length, MH = MAP.length;
      const P = { x: 1.5, y: 1.5, a: 0.6, steps: 0 };
      const st = { W: 640, H: 400, keys: {}, raf: 0, fpsT: 0, fps: 0, coins: [], score: 0, time: 0 };

      win.body.innerHTML =
        '<div class="gm">' +
          '<div class="gm-hud"><span>Монеты <b id="d3-s">0/0</b></span><span>FPS <b id="d3-f">0</b></span><span>Время <b id="d3-t">0:00</b></span>' +
          '<div class="gm-hud-btns"><button class="btn btn-sm" id="d3-m">Карта</button><button class="btn btn-sm btn-accent" id="d3-r">Заново</button></div></div>' +
          '<div class="gm-stage d3-stage"><canvas id="d3-cv"></canvas><div class="gm-over hidden" id="d3-o"></div></div>' +
          '<div class="gm-tip">WASD — движение · ← → или мышь — поворот · соберите все монеты</div>' +
        '</div>';
      const cv = win.body.querySelector('#d3-cv'), ctx = cv.getContext('2d');
      const over = win.body.querySelector('#d3-o');
      const sEl = win.body.querySelector('#d3-s'), fEl = win.body.querySelector('#d3-f'), tEl = win.body.querySelector('#d3-t');
      let showMap = true;

      function resize() {
        const r = win.body.querySelector('.d3-stage').getBoundingClientRect();
        st.W = Math.max(240, Math.min(900, Math.floor(r.width)));
        st.H = Math.max(180, Math.min(600, Math.floor(r.height)));
        cv.width = st.W; cv.height = st.H;
        cv.style.width = st.W + 'px'; cv.style.height = st.H + 'px';
      }
      function wall(x, y) {
        const mx = Math.floor(x), my = Math.floor(y);
        if (mx < 0 || my < 0 || mx >= MW || my >= MH) return true;
        return MAP[my][mx] === '#';
      }
      function placeCoins() {
        st.coins = [];
        const spots = [];
        for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) if (MAP[y][x] !== '#') spots.push([x + .5, y + .5]);
        for (let i = 0; i < 8 && spots.length; i++) {
          const k = Math.floor(Math.random() * spots.length);
          const s = spots.splice(k, 1)[0];
          if (Math.hypot(s[0] - P.x, s[1] - P.y) < 2) { i--; continue; }
          st.coins.push({ x: s[0], y: s[1], got: false, ph: Math.random() * 6 });
        }
        st.score = 0; st.time = 0;
        sEl.textContent = '0/' + st.coins.length;
      }
      function reset() { P.x = 1.5; P.y = 1.5; P.a = .6; over.classList.add('hidden'); placeCoins(); }

      function cast(col) {
        const camX = 2 * col / st.W - 1;
        const fov = .9;
        const rdx = Math.cos(P.a + Math.atan(camX * Math.tan(fov / 2)) ) ;
        const rdy = Math.sin(P.a + Math.atan(camX * Math.tan(fov / 2)) );
        let mx = Math.floor(P.x), my = Math.floor(P.y);
        const ddx = Math.abs(1 / (rdx || 1e-9)), ddy = Math.abs(1 / (rdy || 1e-9));
        let sx, sy, sideX, sideY;
        if (rdx < 0) { sx = -1; sideX = (P.x - mx) * ddx; } else { sx = 1; sideX = (mx + 1 - P.x) * ddx; }
        if (rdy < 0) { sy = -1; sideY = (P.y - my) * ddy; } else { sy = 1; sideY = (my + 1 - P.y) * ddy; }
        let side = 0, hit = false, guard = 0;
        while (!hit && guard++ < 128) {
          if (sideX < sideY) { sideX += ddx; mx += sx; side = 0; }
          else { sideY += ddy; my += sy; side = 1; }
          if (mx < 0 || my < 0 || mx >= MW || my >= MH) { hit = true; break; }
          if (MAP[my][mx] === '#') hit = true;
        }
        const dist = side === 0 ? (sideX - ddx) : (sideY - ddy);
        return { dist: Math.max(.05, dist), side: side, mx: mx, my: my };
      }

      function draw() {
        const H = st.H, W = st.W;
        // потолок и пол
        const cg = ctx.createLinearGradient(0, 0, 0, H / 2);
        cg.addColorStop(0, '#0a0d1c'); cg.addColorStop(1, '#252b4a');
        ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H / 2);
        const fg = ctx.createLinearGradient(0, H / 2, 0, H);
        fg.addColorStop(0, '#2b2440'); fg.addColorStop(1, '#0b0a14');
        ctx.fillStyle = fg; ctx.fillRect(0, H / 2, W, H / 2);

        const step = W > 520 ? 2 : 3;
        const zbuf = [];
        for (let x = 0; x < W; x += step) {
          const r = cast(x + step / 2);
          const corr = r.dist * Math.cos(Math.atan((2 * (x + step / 2) / W - 1) * Math.tan(.45)));
          const h = Math.min(H * 3, H / Math.max(.1, corr));
          const y0 = (H - h) / 2;
          const shade = Math.max(0, Math.min(1, 1 - corr / 12));
          const base = r.side === 1 ? .68 : 1;
          const hue = 250 + (r.mx * 7 + r.my * 13) % 40 - 20;
          ctx.fillStyle = 'hsl(' + hue + ',' + Math.round(45 * shade) + '%,' + Math.round((12 + 46 * shade) * base) + '%)';
          ctx.fillRect(x, y0, step, h);
          // «кирпичная» текстура: горизонтальные линии
          if (h > 40 && shade > .25) {
            ctx.fillStyle = 'rgba(0,0,0,.22)';
            const rows = Math.max(3, Math.floor(h / 26));
            for (let i = 1; i < rows; i++) ctx.fillRect(x, y0 + h / rows * i, step, 1);
            ctx.fillStyle = 'rgba(255,255,255,.07)';
            ctx.fillRect(x, y0, step, 1.6);
          }
          zbuf[x] = corr;
        }

        // монеты как спрайты
        const sorted = st.coins.filter((c) => !c.got).map((c) => {
          const dx = c.x - P.x, dy = c.y - P.y;
          return { c: c, d: Math.hypot(dx, dy), ang: Math.atan2(dy, dx) };
        }).sort((a, b) => b.d - a.d);
        sorted.forEach((s) => {
          let rel = s.ang - P.a;
          while (rel > Math.PI) rel -= Math.PI * 2;
          while (rel < -Math.PI) rel += Math.PI * 2;
          if (Math.abs(rel) > .9) return;
          const sx = (rel / .9 * .5 + .5) * W;
          const size = Math.min(H, H / Math.max(.2, s.d) * .5);
          const z = zbuf[Math.round(OS.clamp(sx, 0, W - 1))];
          if (z != null && s.d > z + .2) return;
          const bob = Math.sin(st.time / 300 + s.c.ph) * size * .06;
          const g = ctx.createRadialGradient(sx, H / 2 + bob, 0, sx, H / 2 + bob, size / 2);
          g.addColorStop(0, '#fff7cc'); g.addColorStop(.5, '#fbbf24'); g.addColorStop(1, 'rgba(180,110,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(sx, H / 2 + bob, size / 2, 0, 7); ctx.fill();
          ctx.fillStyle = 'rgba(120,70,0,.85)';
          ctx.font = 'bold ' + Math.max(8, size * .34) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('Q', sx, H / 2 + bob + 1);
        });

        // прицел
        ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(W / 2 - 7, H / 2); ctx.lineTo(W / 2 - 2, H / 2);
        ctx.moveTo(W / 2 + 2, H / 2); ctx.lineTo(W / 2 + 7, H / 2);
        ctx.moveTo(W / 2, H / 2 - 7); ctx.lineTo(W / 2, H / 2 - 2);
        ctx.moveTo(W / 2, H / 2 + 2); ctx.lineTo(W / 2, H / 2 + 7); ctx.stroke();

        // виньетка
        const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .75);
        vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
        ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

        if (showMap) drawMap();
      }
      function drawMap() {
        const s = Math.min(9, Math.max(5, st.W / 90));
        const mw = MW * s, mh = MH * s;
        const ox = st.W - mw - 12, oy = 12;
        ctx.fillStyle = 'rgba(4,6,14,.72)';
        ctx.beginPath();
        if (ctx.roundRect) { ctx.roundRect(ox - 5, oy - 5, mw + 10, mh + 10, 6); ctx.fill(); } else ctx.fillRect(ox - 5, oy - 5, mw + 10, mh + 10);
        for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
          if (MAP[y][x] === '#') { ctx.fillStyle = 'rgba(150,160,220,.55)'; ctx.fillRect(ox + x * s, oy + y * s, s - .6, s - .6); }
        }
        st.coins.forEach((c) => { if (c.got) return; ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(ox + c.x * s, oy + c.y * s, s * .28, 0, 7); ctx.fill(); });
        ctx.save();
        ctx.translate(ox + P.x * s, oy + P.y * s); ctx.rotate(P.a);
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath(); ctx.moveTo(s * .6, 0); ctx.lineTo(-s * .35, s * .35); ctx.lineTo(-s * .35, -s * .35); ctx.closePath(); ctx.fill();
        ctx.restore();
      }

      let last = performance.now();
      function frame(t) {
        st.raf = requestAnimationFrame(frame);
        if (!win.root.isConnected) return;
        const dt = Math.min(64, t - last); last = t;
        st.time += dt;
        move(dt);
        draw();
        st.fpsT += dt;
        if (st.fpsT > 400) { st.fps = Math.round(1000 / dt); fEl.textContent = st.fps; st.fpsT = 0; tEl.textContent = Math.floor(st.time / 60000) + ':' + OS.pad(Math.floor(st.time % 60000 / 1000)); }
      }
      function move(dt) {
        const sp = (st.keys.shift ? .0042 : .0026) * dt;
        const rot = .0026 * dt;
        if (st.keys.left) P.a -= rot;
        if (st.keys.right) P.a += rot;
        let dx = 0, dy = 0;
        if (st.keys.up) { dx += Math.cos(P.a) * sp; dy += Math.sin(P.a) * sp; }
        if (st.keys.down) { dx -= Math.cos(P.a) * sp; dy -= Math.sin(P.a) * sp; }
        if (st.keys.strafeL) { dx += Math.cos(P.a - Math.PI / 2) * sp * .8; dy += Math.sin(P.a - Math.PI / 2) * sp * .8; }
        if (st.keys.strafeR) { dx += Math.cos(P.a + Math.PI / 2) * sp * .8; dy += Math.sin(P.a + Math.PI / 2) * sp * .8; }
        const pad = .22;
        if (dx && !wall(P.x + dx + Math.sign(dx) * pad, P.y)) { P.x += dx; P.steps++; }
        if (dy && !wall(P.x, P.y + dy + Math.sign(dy) * pad)) { P.y += dy; P.steps++; }
        st.coins.forEach((c) => {
          if (!c.got && Math.hypot(c.x - P.x, c.y - P.y) < .45) {
            c.got = true; st.score++;
            sEl.textContent = st.score + '/' + st.coins.length;
            OS.sfx.play('ok');
            OS.toast('Монета найдена', st.score + ' из ' + st.coins.length, { icon: 'coin', timeout: 1200 });
            if (st.score === st.coins.length) finish();
          }
        });
      }
      function finish() {
        const secs = Math.round(st.time / 1000);
        const rec = best('qwen3d', Math.max(1, 3000 - secs * 10));
        over.classList.remove('hidden');
        over.innerHTML = '<div><h3>Лабиринт очищен! 🏆</h3><p>Все монеты собраны за <b>' + secs + ' с</b></p><p class="dim">Лучший результат: ' + rec + '</p><button class="btn btn-accent" id="d3-a">Играть снова</button></div>';
        over.querySelector('#d3-a').onclick = reset;
        OS.sfx.play('notify');
      }

      const onKey = (e) => {
        if (!win.root.isConnected || OS.wm.active !== win) return;
        const k = e.key.toLowerCase();
        const set = (v) => {
          if (e.type === 'keydown') {
            if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k) || ['w', 'a', 's', 'd', 'ц', 'ф', 'ы', 'в'].includes(k)) e.preventDefault();
          }
          if (k === 'w' || k === 'ц' || k === 'arrowup') st.keys.up = v;
          if (k === 's' || k === 'ы' || k === 'arrowdown') st.keys.down = v;
          if (k === 'arrowleft') st.keys.left = v;
          if (k === 'arrowright') st.keys.right = v;
          if (k === 'a' || k === 'ф') st.keys.strafeL = v;
          if (k === 'd' || k === 'в') st.keys.strafeR = v;
          if (k === 'shift') st.keys.shift = v;
        };
        set(e.type === 'keydown');
      };
      document.addEventListener('keydown', onKey);
      document.addEventListener('keyup', onKey);

      let dragging = false, lastX = 0;
      cv.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; cv.setPointerCapture && cv.setPointerCapture(e.pointerId); });
      cv.addEventListener('pointermove', (e) => { if (dragging) { P.a += (e.clientX - lastX) * .006; lastX = e.clientX; } });
      cv.addEventListener('pointerup', () => { dragging = false; });
      cv.addEventListener('pointercancel', () => { dragging = false; });

      win.body.querySelector('#d3-m').onclick = () => { showMap = !showMap; win.body.querySelector('#d3-m').classList.toggle('btn-accent', showMap); };
      win.body.querySelector('#d3-r').onclick = reset;
      win.body.querySelector('#d3-m').classList.add('btn-accent');
      win.root.addEventListener('wm:resize', OS.debounce(() => { resize(); }, 100));
      addEventListener('resize', OS.debounce(resize, 200));
      resize(); reset(); st.raf = requestAnimationFrame(frame);
      return () => { cancelAnimationFrame(st.raf); document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey); };
    }
  });
})(window.OS);
