/* ============ DOOM (Qwen Edition) — raycaster на canvas ============ */
/* Управление: WASD/стрелки — движение, мышь или Q/E — поворот, ЛКМ/Space — огонь */

registerGame('doom', {
  name: 'DOOM', icon: '👹', desc: 'Ретро-шутер от первого лица (raycasting)',
  open(win, params = {}) {
    /* --- проверка покупки через Steam --- */
    if (!Money.owned()['doom']) {
      win.body.innerHTML = `
        <div class="doom-lock">
          <div class="dl-icon">🔒</div>
          <h2>DOOM (Qwen Edition)</h2>
          <p>Эта игра куплена не была. Приобрети её в <b>Steam</b> за ${Money.fmt(500)}.</p>
          <button class="dl-buy">🎮 Открыть Steam</button>
        </div>`;
      win.body.querySelector('.dl-buy').onclick = () => OS.openApp('shop');
      return;
    }

    const MW = 24, MH = 24;
    const map = [
      '########################',
      '#......#........#......#',
      '#..e...#...g....#...e..#',
      '#......#........#......#',
      '#..............s.......#',
      '#......#...#....#......#',
      '###.####...#....####.###',
      '#..........#...........#',
      '#..g.......#.....g.....#',
      '#..........######......#',
      '####.#####....#..#######',
      '#.............#........#',
      '#..e....######...###...#',
      '#.......#....#..#.#..g.#',
      '#####.###.##.#..#.####.#',
      '#...........#...#......#',
      '#..g...e....#...#...e..#',
      '####.####...#...#..#####',
      '#.........###...###....#',
      '#...s..................#',
      '###.####.####.####.####.',
      '#........#....#........#',
      '#..e.....#..g.#.....e..#',
      '########################',
    ];

    function cellAt(x, y) {
      if (x < 0 || y < 0 || x >= MW || y >= MH) return '#';
      return map[Math.floor(y)][Math.floor(x)];
    }
    function solid(x, y) { return cellAt(x, y) === '#'; }

    /* враги и предметы из карты */
    let mobs = [], pickups = [];
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const c = map[y][x];
      if (c === 'e') mobs.push({ x: x + .5, y: y + .5, hp: 3, dead: false, hitT: 0, anim: Math.random() * 6 });
      if (c === 'g') pickups.push({ x: x + .5, y: y + .5, type: 'health' });
      if (c === 's') pickups.push({ x: x + .5, y: y + .5, type: 'shot' });
    }

    const P = { x: 2.5, y: 2.5, a: 0.7, hp: 100, armor: 0, ammo: 24, kills: 0, shots: 0 };
    let zbuf = new Array(320), raf = null, last = performance.now(), keys = {};
    let muzzle = 0, hurtT = 0, msg = '', msgT = 0, paused = false, deadState = false, won = false;

    win.body.innerHTML = `
      <div class="doom">
        <div class="dm-hud">
          <span class="dm-face" id="dmface">😠</span>
          <span>❤️ <b class="dm-hp">100</b></span>
          <span>🛡️ <b class="dm-ar">0</b></span>
          <span>🔫 <b class="dm-am">24</b></span>
          <span>💀 <b class="dm-kl">0</b>/<b>${mobs.length}</b></span>
          <span class="money-hud dm-coins"></span>
          <span class="dm-msg"></span>
        </div>
        <canvas class="dm-canvas"></canvas>
        <div class="dm-help">WASD — движение · мышь / ← → — поворот · ЛКМ / Space — огонь · Esc — пауза</div>
      </div>`;
    const cv = win.body.querySelector('.dm-canvas'), ctx = cv.getContext('2d');
    const CW = 320, CH = 200; cv.width = CW; cv.height = CH;
    ctx.imageSmoothingEnabled = false;
    win.el.tabIndex = 0;

    function showMsg(t) { msg = t; msgT = 2.5; win.body.querySelector('.dm-msg').textContent = t; }
    function updHUD() {
      const b = win.body.querySelector.bind(win.body);
      b('.dm-hp').textContent = Math.max(0, P.hp);
      b('.dm-ar').textContent = P.armor;
      b('.dm-am').textContent = P.ammo;
      b('.dm-kl').textContent = P.kills;
      Money.renderHUD();
      const faces = ['💀','😵','😫','😨','😐','🙂','😠','😎'];
      b('#dmface').textContent = deadState ? '💀' : faces[Math.min(7, Math.floor(P.hp / 15))];
    }

    /* ---------- движение ---------- */
    function tryMove(nx, ny) {
      const r = 0.22;
      if (!solid(nx + r, P.y) && !solid(nx - r, P.y)) P.x = nx;
      if (!solid(P.x, ny + r) && !solid(P.x, ny - r)) P.y = ny;
    }
    function update(dt) {
      if (paused || deadState) return;
      const sp = 3.2 * dt, rot = 2.6 * dt;
      if (keys['q'] || keys['ArrowLeft']) P.a -= rot;
      if (keys['e'] || keys['ArrowRight']) P.a += rot;
      const cs = Math.cos(P.a), sn = Math.sin(P.a);
      let dx = 0, dy = 0;
      if (keys['w'] || keys['ArrowUp'])   { dx += cs; dy += sn; }
      if (keys['s'] || keys['ArrowDown']) { dx -= cs; dy -= sn; }
      if (keys['a']) { dx += sn; dy -= cs; }
      if (keys['d']) { dx -= sn; dy += cs; }
      const len = Math.hypot(dx, dy);
      if (len > 0.01) tryMove(P.x + dx / len * sp, P.y + dy / len * sp);

      /* подбор предметов */
      for (let i = pickups.length - 1; i >= 0; i--) {
        const it = pickups[i];
        if (Math.hypot(it.x - P.x, it.y - P.y) < 0.5) {
          pickups.splice(i, 1);
          if (it.type === 'health') { P.hp = Math.min(100, P.hp + 25); showMsg('+25 HP 🍖'); }
          else { P.ammo += 15; P.armor = Math.min(100, P.armor + 10); showMsg('+15 боеприпасов, +10 брони 🔫'); }
          updHUD();
        }
      }
      /* ИИ мобов */
      for (const m of mobs) {
        if (m.dead) continue;
        m.anim += dt * 6;
        const dist = Math.hypot(m.x - P.x, m.y - P.y);
        if (dist < 9) {
          const ux = (P.x - m.x) / dist, uy = (P.y - m.y) / dist;
          if (dist > 0.8) {
            const nx = m.x + ux * 1.1 * dt, ny = m.y + uy * 1.1 * dt;
            if (!solid(nx, m.y)) m.x = nx;
            if (!solid(m.x, ny)) m.y = ny;
          } else if (Math.random() < dt * 0.8) { // атака
            const dmg = 5 + Math.floor(Math.random() * 8);
            const absorbed = Math.min(P.armor, Math.ceil(dmg / 2));
            P.armor -= absorbed; P.hp -= (dmg - absorbed);
            hurtT = 0.35; updHUD();
            if (P.hp <= 0) die();
          }
        }
      }
      if (hurtT > 0) hurtT -= dt;
      if (muzzle > 0) muzzle -= dt * 6;
      if (msgT > 0) { msgT -= dt; if (msgT <= 0) win.body.querySelector('.dm-msg').textContent = ''; }
    }

    function die() {
      deadState = true; updHUD();
      Money.bump('doom_deaths');
      showMsg('Вы погибли! Нажми R — рестарт.');
    }

    /* ---------- стрельба ---------- */
    function shoot() {
      if (deadState || paused) return;
      if (P.ammo <= 0) { showMsg('НЕТ ПАТРОНОВ! 🔫'); return; }
      P.ammo--; P.shots++; muzzle = 1; updHUD();
      /* рейкаст до стены */
      const cs = Math.cos(P.a), sn = Math.sin(P.a);
      let wallDist = 30;
      for (let t = 0; t < 30; t += 0.05) {
        if (solid(P.x + cs * t, P.y + sn * t)) { wallDist = t; break; }
      }
      let best = null, bestD = Infinity;
      for (const m of mobs) {
        if (m.dead) continue;
        const mx = m.x - P.x, my = m.y - P.y;
        const d = Math.hypot(mx, my);
        if (d > wallDist || d > 20) continue;
        const ang = Math.abs(Math.atan2(my, mx) - P.a);
        const norm = Math.min(ang, Math.PI * 2 - ang);
        if (norm < (0.35 / d) && d < bestD) { best = m; bestD = d; }
      }
      if (best) {
        best.hp--; best.hitT = 0.25;
        if (best.hp <= 0) {
          best.dead = true; P.kills++;
          const reward = 15;
          Money.add(reward);
          showMsg(`💀 Фраг! +${reward} 🪙`);
          OS.notify('👹 DOOM', `Фраг №${P.kills}! Начислено ${Money.fmt(reward)} — деньги капают за убийства демонов 💰`);
          if (mobs.every(m => m.dead)) {
            won = true; Money.add(300);
            showMsg('🏉 УРОВЕНЬ ОЧИЩЕН! Бонус +300 🪙');
            OS.notify('👹 DOOM', 'Все демоны уничтожены! Бонус +300 🪙');
          }
        }
      }
      updHUD();
    }

    /* ---------- рендер (raycasting DDA) ---------- */
    function render() {
      /* потолок/пол с лёгким градиентом */
      const gTop = ctx.createLinearGradient(0, 0, 0, CH / 2);
      gTop.addColorStop(0, '#2a2333'); gTop.addColorStop(1, '#453a52');
      ctx.fillStyle = gTop; ctx.fillRect(0, 0, CW, CH / 2);
      const gBot = ctx.createLinearGradient(0, CH / 2, 0, CH);
      gBot.addColorStop(0, '#3f3a35'); gBot.addColorStop(1, '#6b6157');
      ctx.fillStyle = gBot; ctx.fillRect(0, CH / 2, CW, CH / 2);

      /* стены */
      for (let col = 0; col < CW; col++) {
        const camX = 2 * col / CW - 1;
        const ra = P.a + camX * 0.66;
        const cs = Math.cos(ra), sn = Math.sin(ra);
        let mapX = Math.floor(P.x), mapY = Math.floor(P.y);
        const ddx = Math.abs(1 / (cs || 1e-9)), ddy = Math.abs(1 / (sn || 1e-9));
        let stepX, stepY, sdx, sdy;
        if (cs < 0) { stepX = -1; sdx = (P.x - mapX) * ddx; } else { stepX = 1; sdx = (mapX + 1 - P.x) * ddx; }
        if (sn < 0) { stepY = -1; sdy = (P.y - mapY) * ddy; } else { stepY = 1; sdy = (mapY + 1 - P.y) * ddy; }
        let side = 0, hit = 0, guard = 0;
        while (!hit && guard++ < 64) {
          if (sdx < sdy) { sdx += ddx; mapX += stepX; side = 0; }
          else { sdy += ddy; mapY += stepY; side = 1; }
          if (mapX < 0 || mapY < 0 || mapX >= MW || mapY >= MH) { hit = 2; break; }
          if (map[mapY][mapX] === '#') hit = 1;
        }
        const dist = Math.max(0.01, side === 0 ? sdx - ddx : sdy - ddy);
        const corr = dist * Math.cos(ra - P.a);
        zbuf[col] = corr;
        const lh = Math.min(CH * 3, CH / corr);
        const y0 = CH / 2 - lh / 2;
        let wallX = side === 0 ? P.y + dist * sn : P.x + dist * cs;
        wallX -= Math.floor(wallX);
        const shade = Math.max(0.25, Math.min(1, 1.6 / (1 + corr * 0.55))) * (side ? 0.75 : 1);
        const stripe = Math.floor(wallX * 6);
        const base = (mapY * MW + mapX) % 3; // вариация кирпичей
        const rr = Math.floor((base === 0 ? 150 : base === 1 ? 130 : 110) * shade) - (stripe % 3 ? 0 : 18);
        const gg = Math.floor((base === 0 ? 80 : base === 1 ? 95 : 70) * shade) - (stripe % 3 ? 0 : 12);
        const bb = Math.floor((base === 0 ? 70 : base === 1 ? 85 : 95) * shade) - (stripe % 3 ? 0 : 10);
        ctx.fillStyle = `rgb(${Math.max(0,rr)},${Math.max(0,gg)},${Math.max(0,bb)})`;
        ctx.fillRect(col, y0, 1, lh);
      }

      /* спрайты (мобы и предметы), сортировка от дальних к ближним */
      const sprites = [
        ...mobs.map(m => ({ ...m, kind: 'mob' })),
        ...pickups.map(p => ({ ...p, kind: p.type }))
      ].map(s => ({ s, d: (s.x - P.x) ** 2 + (s.y - P.y) ** 2 }))
       .sort((a, b) => b.d - a.d);
      for (const { s } of sprites) {
        const sx = s.x - P.x, sy = s.y - P.y;
        // простая проекция: угол до объекта
        let rel = Math.atan2(sy, sx) - P.a;
        while (rel > Math.PI) rel -= 2 * Math.PI; while (rel < -Math.PI) rel += 2 * Math.PI;
        if (Math.abs(rel) > 1.1) continue;
        const dist = Math.hypot(sx, sy);
        const screenX = CW / 2 * (1 + Math.tan(rel) / Math.tan(0.66));
        const size = Math.min(CH * 2, (CH / (dist * Math.cos(rel))) * (s.kind === 'mob' ? 0.62 : 0.3));
        const y = CH / 2 + size * (s.kind === 'mob' ? 0.2 : 0.42);
        const x0 = Math.floor(screenX - size / 2), x1 = Math.floor(screenX + size / 2);
        for (let col = Math.max(0, x0); col < Math.min(CW, x1); col++) {
          if (zbuf[col] < dist) continue; // перекрыт стеной
          const u = (col - x0) / size;
          drawSpriteCol(s, col, u, y - size, size);
        }
      }

      /* оружие */
      drawGun();

      /* эффекты поверх */
      if (muzzle > 0.5) { ctx.fillStyle = 'rgba(255,220,120,.25)'; ctx.fillRect(0, 0, CW, CH); }
      if (hurtT > 0) { ctx.fillStyle = `rgba(200,30,30,${hurtT})`; ctx.fillRect(0, 0, CW, CH); }
      if (paused) overlay('ПАУЗА', 'нажми Esc');
      if (deadState) overlay('ТЫ ПОГИБ', 'нажми R — рестарт');
      if (won && !deadState) overlay('УРОВЕНЬ ПРОЙДЕН 🏆', '+300 🪙 · R — заново');
    }

    function drawSpriteCol(s, col, u, top, size) {
      const px = 1, w = size;
      if (s.kind === 'mob') {
        const dead = s.dead;
        const bodyH = dead ? w * 0.3 : w * 0.8;
        const bob = dead ? 0 : Math.sin(s.anim) * w * 0.03;
        const yy = top + w - bodyH + bob;
        const hue = s.hitT > 0 ? '#fff' : dead ? '#5a2b2b' : (u > 0.25 && u < 0.75 ? '#8a3324' : '#6e2a1e');
        ctx.fillStyle = hue;
        ctx.fillRect(col, yy, px, bodyH); // тело колонкой
        if (!dead) {
          // голова
          if (u > 0.3 && u < 0.7) { ctx.fillStyle = s.hitT > 0 ? '#fff' : '#a04030'; ctx.fillRect(col, yy - w * 0.22, px, w * 0.24); }
          // глаза
          if ((u > 0.38 && u < 0.44) || (u > 0.56 && u < 0.62)) { ctx.fillStyle = '#ffe14d'; ctx.fillRect(col, yy - w * 0.16, px, w * 0.06); }
          // рога
          if ((u > 0.28 && u < 0.34) || (u > 0.66 && u < 0.72)) { ctx.fillStyle = '#ddd'; ctx.fillRect(col, yy - w * 0.34, px, w * 0.14); }
        }
        if (s.hitT > 0) s.hitT -= 0.016;
      } else {
        const pulse = Math.sin(performance.now() / 300) * w * 0.06;
        const yy = top + w * 0.55 + pulse;
        ctx.fillStyle = s.kind === 'health' ? '#e8564d' : '#ffd166';
        if (u > 0.15 && u < 0.85) ctx.fillRect(col, yy, px, w * 0.3);
        if (u > 0.3 && u < 0.7) { ctx.fillStyle = s.kind === 'health' ? '#fff' : '#333'; ctx.fillRect(col, yy + w * 0.1, px, w * 0.08); }
      }
    }

    function drawGun() {
      const gx = CW / 2 - 26, gy = CH - 58 + (muzzle > 0.5 ? -6 : Math.sin(performance.now() / 250) * 2);
      ctx.fillStyle = '#3a3f4a'; ctx.fillRect(gx + 14, gy, 24, 40); // ствол
      ctx.fillStyle = '#22262e'; ctx.fillRect(gx, gy + 22, 52, 36); // корпус
      ctx.fillStyle = '#5a6272'; ctx.fillRect(gx + 18, gy + 4, 16, 18);
      if (muzzle > 0.4) { ctx.fillStyle = '#ffdd77'; ctx.beginPath(); ctx.arc(gx + 26, gy - 4, 10, 0, 7); ctx.fill(); }
    }
    function overlay(t, sub) {
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, CW, CH);
      ctx.fillStyle = '#ffcf5e'; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center';
      ctx.fillText(t, CW / 2, CH / 2 - 6);
      ctx.fillStyle = '#ccc'; ctx.font = '11px monospace';
      ctx.fillText(sub, CW / 2, CH / 2 + 14);
      ctx.textAlign = 'left';
    }

    /* ---------- ввод ---------- */
    win.el.addEventListener('keydown', e => {
      keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = true;
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
      if (e.key === ' ') shoot();
      if (e.key === 'Escape') { paused = !paused; }
      if (e.key.toLowerCase() === 'r' && (deadState || won)) restart();
      win.el.focus();
    });
    win.el.addEventListener('keyup', e => { keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false; });
    cv.addEventListener('mousedown', e => { if (e.button === 0) { shoot(); win.el.focus(); } });
    cv.addEventListener('mousemove', e => { if (!deadState && !paused && document.pointerLockElement === cv) P.a += e.movementX * 0.0026; });
    cv.addEventListener('click', () => { if (cv.requestPointerLock) cv.requestPointerLock().catch(()=>{}); });

    function restart() {
      P.x = 2.5; P.y = 2.5; P.hp = 100; P.armor = 0; P.ammo = 24; P.kills = 0;
      mobs.forEach((m, i) => Object.assign(m, initialMobs[i]));
      pickups.length = 0; initialPickups.forEach(p => pickups.push({ ...p }));
      deadState = false; won = false; updHUD();
    }
    const initialMobs = mobs.map(m => ({ ...m }));
    const initialPickups = pickups.map(p => ({ ...p }));

    /* ---------- цикл ---------- */
    function loop(now) {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      update(dt); render();
    }
    updHUD(); showMsg('Очисти уровень от демонов! За фраг — 🪙');
    loop(last);
    setTimeout(() => win.el.focus(), 50);
    win.onClose = () => { cancelAnimationFrame(raf); if (document.pointerLockElement) document.exitPointerLock(); };
  }
});

/* DOOM доступен и как приложение (иконка на рабочем столе / Пуск) — та же проверка покупки внутри open() */
// 'doom' уже зарегистрирован в Apps через registerGame (см. games.js)
