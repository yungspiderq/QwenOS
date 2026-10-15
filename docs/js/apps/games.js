/* ==========================================================================
   QwenOS 3.0 — apps/games.js
   Все игры на three.js (вендорится локально, работает офлайн):
   Змейка 3D · Сапёр 3D · 2048 3D · Арканоид 3D · Qwen3D (лабиринт от первого лица)
   ========================================================================== */
(function (OS) {
  'use strict';

  const FALLBACK = '<div class="gm-fallback">' + OS.svg('cube', 38) +
    '<p>WebGL недоступен в этом окружении.</p><p class="dim">Игры QwenOS требуют three.js + WebGL.</p></div>';

  /* --------------------------------------------------------- ввод ---------- */
  function bindInput(win, el, onDir, onTap) {
    const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', ц: 'up', ы: 'down', ф: 'left', в: 'right' };
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
    return () => document.removeEventListener('keydown', onKey);
  }

  const best = (k, v) => {
    const prev = OS.store.get('best.' + k, 0) || 0;
    if (v == null) return prev;
    if (v > prev) { OS.store.set('best.' + k, v); return v; }
    return prev;
  };

  /* --------------------------------------------------- общий 3D-набор ------ */
  const KIT = {
    ok() { return typeof THREE !== 'undefined'; },
    renderer(stage) {
      let r;
      try { r = new THREE.WebGLRenderer({ antialias: true, alpha: false }); }
      catch (e) { stage.innerHTML = FALLBACK; return null; }
      r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      r.setClearColor(0x070a14, 1);
      r.setSize(Math.max(80, stage.clientWidth), Math.max(80, stage.clientHeight), false);
      r.domElement.style.width = '100%';
      r.domElement.style.height = '100%';
      r.domElement.style.display = 'block';
      r.domElement.style.touchAction = 'none';
      stage.innerHTML = '';
      stage.append(r.domElement);
      return r;
    },
    lights(scene) {
      scene.add(new THREE.AmbientLight(0xc4d2ff, 0.72));
      const d = new THREE.DirectionalLight(0xffffff, 0.95);
      d.position.set(7, 14, 9);
      scene.add(d);
      const p = new THREE.PointLight(0x8b5cf6, 0.55, 60);
      p.position.set(-8, 9, -7);
      scene.add(p);
      return d;
    },
    accent() {
      const cs = getComputedStyle(document.documentElement);
      const hex = (v, d) => { v = (v || '').trim(); return /^#/.test(v) ? v : d; };
      return { a: hex(cs.getPropertyValue('--accent'), '#8b5cf6'), b: hex(cs.getPropertyValue('--accent-2'), '#06b6d4') };
    },
    label(text, bg, fg, font) {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const x = c.getContext('2d');
      if (bg) { x.fillStyle = bg; x.beginPath(); if (x.roundRect) { x.roundRect(4, 4, 120, 120, 22); x.fill(); } else x.fillRect(0, 0, 128, 128); }
      x.fillStyle = fg || '#ffffff';
      x.font = font || 'bold 62px system-ui, sans-serif';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(String(text), 64, 70);
      const t = new THREE.CanvasTexture(c);
      t.anisotropy = 4;
      return t;
    },
    loop(win, fn) {
      let raf = 0, last = performance.now();
      const step = (t) => {
        raf = requestAnimationFrame(step);
        if (!win.root.isConnected) return;
        const dt = Math.min(60, t - last); last = t;
        fn(dt, t);
      };
      raf = requestAnimationFrame(step);
      return () => cancelAnimationFrame(raf);
    },
    fit(renderer, stage, camera) {
      const w = Math.max(80, stage.clientWidth), h = Math.max(80, stage.clientHeight);
      renderer.setSize(w, h, false);
      if (camera) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
    }
  };

  /* =======================================================================
     ЗМЕЙКА 3D
     ======================================================================= */
  OS.Apps.register({
    id: 'snake',
    price: 30,
    name: 'Змейка 3D',
    icon: 'snake',
    color: '#22c55e', color2: '#166534',
    category: 'Игры',
    keywords: 'snake змейка 3d three.js игра arcade',
        storeOnly: true,
width: 640, height: 660, minWidth: 360, minHeight: 440,
    mount(win) {
      const N = 16;
      let snake = [], dir = { x: 1, y: 0 }, nextDir = { x: 1, y: 0 }, food = null, bonus = null;
      let score = 0, alive = true, paused = false, speed = 150, timer = null;

      win.body.innerHTML =
        '<div class="gm">' +
          '<div class="gm-hud"><span>Очки <b id="sn-s">0</b></span><span>Рекорд <b id="sn-b">0</b></span><span>Длина <b id="sn-l">3</b></span>' +
          '<div class="gm-hud-btns"><button class="btn btn-sm" id="sn-p">Пауза</button><button class="btn btn-sm btn-accent" id="sn-r">Заново</button></div></div>' +
          '<div class="gm-stage gm-3d"></div>' +
          '<div class="gm-tip">Стрелки / WASD · пробел — пауза · свайпы на телефоне</div>' +
        '</div>';
      win.body.querySelector('#sn-b').textContent = best('snake');
      const stage = win.body.querySelector('.gm-stage');
      const sEl = win.body.querySelector('#sn-s'), lEl = win.body.querySelector('#sn-l');

      if (!KIT.ok()) { stage.innerHTML = FALLBACK; return; }
      const renderer = KIT.renderer(stage);
      if (!renderer) return;
      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x070a14, 26, 46);
      const camera = new THREE.PerspectiveCamera(48, 1, .1, 200);
      camera.position.set(0, N * 1.02, N * .78);
      camera.lookAt(0, 0, -1);
      KIT.lights(scene);

      const ac = KIT.accent();
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(N, N), new THREE.MeshLambertMaterial({ color: 0x10141f }));
      ground.rotation.x = -Math.PI / 2;
      scene.add(ground);
      const grid = new THREE.GridHelper(N, N, new THREE.Color(ac.a).getHex(), 0x2a3350);
      grid.position.y = .01;
      scene.add(grid);
      const rim = new THREE.Mesh(new THREE.BoxGeometry(N + .8, .5, N + .8), new THREE.MeshLambertMaterial({ color: new THREE.Color(ac.a).multiplyScalar(.4).getHex() }));
      rim.position.y = -.26;
      scene.add(rim);

      const segGeo = new THREE.BoxGeometry(.9, .55, .9);
      const pool = [];
      const foodMesh = new THREE.Mesh(new THREE.SphereGeometry(.42, 20, 20), new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0x881122, roughness: .35 }));
      scene.add(foodMesh);
      const bonusMesh = new THREE.Mesh(new THREE.TorusGeometry(.34, .12, 10, 22), new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0x7a5200, metalness: .6, roughness: .3 }));
      bonusMesh.rotation.x = Math.PI / 2.4;
      bonusMesh.visible = false;
      scene.add(bonusMesh);

      const P = (v) => v - N / 2 + .5;
      function syncMeshes() {
        while (pool.length < snake.length) {
          const m = new THREE.Mesh(segGeo, new THREE.MeshLambertMaterial({ color: 0x22c55e }));
          scene.add(m); pool.push(m);
        }
        while (pool.length > snake.length) scene.remove(pool.pop());
        const ca = new THREE.Color(ac.b), cb = new THREE.Color(ac.a);
        snake.forEach((s, i) => {
          const m = pool[i];
          m.position.set(P(s.x), .3, P(s.y));
          const t = snake.length > 1 ? i / (snake.length - 1) : 0;
          m.material.color.copy(ca).lerp(cb, t);
          const sc = i === 0 ? 1.12 : 1 - t * .22;
          m.scale.setScalar(sc);
          m.rotation.y = i === 0 ? Math.atan2(dir.x, dir.y) * -1 : m.rotation.y;
        });
        if (food) foodMesh.position.set(P(food.x), .5, P(food.y));
        foodMesh.visible = !!food;
        if (bonus) { bonusMesh.position.set(P(bonus.x), .55, P(bonus.y)); bonusMesh.visible = true; }
        else bonusMesh.visible = false;
      }
      function placeFood() {
        let p;
        do { p = { x: OS.rndi(0, N - 1), y: OS.rndi(0, N - 1) }; } while (snake.some((s) => s.x === p.x && s.y === p.y));
        food = p;
      }
      function reset() {
        snake = [{ x: 4, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 8 }];
        dir = nextDir = { x: 1, y: 0 };
        score = 0; alive = true; paused = false; speed = 150; bonus = null;
        sEl.textContent = 0; lEl.textContent = 3;
        placeFood();
        over.classList.add('hidden');
        clearInterval(timer); timer = setInterval(tick, speed);
        syncMeshes();
      }
      function tick() {
        if (!alive || paused) return;
        dir = nextDir;
        const h = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
        if (h.x < 0 || h.y < 0 || h.x >= N || h.y >= N || snake.some((s) => s.x === h.x && s.y === h.y)) return die();
        snake.unshift(h);
        let ate = false;
        if (food && h.x === food.x && h.y === food.y) { score += 10; ate = true; placeFood(); if (!bonus && Math.random() < .22) bonus = { x: OS.rndi(0, N - 1), y: OS.rndi(0, N - 1), t: 70 }; }
        if (bonus && h.x === bonus.x && h.y === bonus.y) { score += 50; bonus = null; ate = true; OS.toast('Бонус!', '+50 очков', { icon: 'coin', timeout: 1400 }); }
        if (bonus && --bonus.t <= 0) bonus = null;
        if (!ate) snake.pop();
        sEl.textContent = score; lEl.textContent = snake.length;
        const lvl = 1 + Math.floor(score / 60);
        const ns = Math.max(65, 150 - (lvl - 1) * 9);
        if (ns !== speed) { speed = ns; clearInterval(timer); timer = setInterval(tick, speed); }
        syncMeshes();
      }
      function die() {
        alive = false; clearInterval(timer);
        const rec = best('snake', score);
        win.body.querySelector('#sn-b').textContent = rec;
        OS.sfx.play('error');
        over.classList.remove('hidden');
        const earned = OS.coins.add(Math.floor(score / 10));
        over.innerHTML = '<div><h3>Игра окончена</h3><p>Очки: <b>' + score + '</b> · длина ' + snake.length + '</p><p class="dim">Рекорд: ' + rec + ' · монет: ' + earned + ' (+' + Math.floor(score / 10) + ')</p><button class="btn btn-accent" id="sn-again">Ещё раз</button></div>';
        over.querySelector('#sn-again').onclick = reset;
      }
      const over = OS.el('div', { class: 'gm-over hidden' });
      stage.append(over);

      const un = bindInput(win, stage, (d) => {
        if (!alive) return;
        const m = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[d];
        if (m.x === -dir.x && m.y === -dir.y) return;
        nextDir = m;
      }, (t) => { if (t !== 'esc') togglePause(); });
      function togglePause() { if (!alive) return; paused = !paused; win.body.querySelector('#sn-p').textContent = paused ? 'Продолжить' : 'Пауза'; }
      win.body.querySelector('#sn-p').onclick = togglePause;
      win.body.querySelector('#sn-r').onclick = reset;

      const stop = KIT.loop(win, (dt, t) => {
        foodMesh.rotation.y += dt * .002;
        foodMesh.position.y = .5 + Math.sin(t * .004) * .08;
        if (bonusMesh.visible) { bonusMesh.rotation.z += dt * .004; bonusMesh.position.y = .55 + Math.sin(t * .005) * .1; }
        if (pool[0]) pool[0].position.y = .3 + Math.sin(t * .012) * .04;
        renderer.render(scene, camera);
      });
      const onRs = () => KIT.fit(renderer, stage, camera);
      win.root.addEventListener('wm:resize', onRs);
      addEventListener('resize', OS.debounce(onRs, 150));
      onRs(); reset();
      win.data.state = { get score() { return score; }, get len() { return snake.length; }, get alive() { return alive; } };
      return () => { clearInterval(timer); stop(); un(); removeEventListener('resize', onRs); renderer.dispose(); };
    }
  });

  /* =======================================================================
     САПЁР 3D
     ======================================================================= */
  OS.Apps.register({
    id: 'mines',
    price: 40,
    name: 'Сапёр 3D',
    icon: 'bomb',
    color: '#ef4444', color2: '#7f1d1d',
    category: 'Игры',
    keywords: 'minesweeper сапёр мины 3d three.js',
        storeOnly: true,
width: 700, height: 680, minWidth: 380, minHeight: 460,
    mount(win) {
      const LEVELS = { easy: { w: 9, h: 9, m: 10, name: 'Новичок' }, mid: { w: 12, h: 12, m: 26, name: 'Любитель' }, hard: { w: 14, h: 10, m: 38, name: 'Эксперт' } };
      let lv = OS.store.get('mines.lv', 'easy'), G = null, timer = null, secs = 0;

      win.body.innerHTML =
        '<div class="gm">' +
          '<div class="gm-hud"><span>Мины <b id="ms-m">0</b></span><span>Время <b id="ms-t">0</b></span>' +
          '<div class="gm-hud-btns"><select class="field" id="ms-lv" style="width:auto;padding:5px 8px"></select><button class="btn btn-sm btn-accent" id="ms-r">Заново</button></div></div>' +
          '<div class="gm-stage gm-3d"></div>' +
          '<div class="gm-tip">ЛКМ — открыть · ПКМ или долгое нажатие — флаг · первый клик всегда безопасен</div>' +
        '</div>';
      const stage = win.body.querySelector('.gm-stage');
      const mEl = win.body.querySelector('#ms-m'), tEl = win.body.querySelector('#ms-t'), lvSel = win.body.querySelector('#ms-lv');
      lvSel.innerHTML = Object.keys(LEVELS).map((k) => '<option value="' + k + '">' + LEVELS[k].name + ' (' + LEVELS[k].w + '×' + LEVELS[k].h + ', ' + LEVELS[k].m + ')</option>').join('');
      lvSel.value = lv;
      lvSel.onchange = () => { lv = lvSel.value; OS.store.set('mines.lv', lv); reset(); };
      win.body.querySelector('#ms-r').onclick = reset;

      if (!KIT.ok()) { stage.innerHTML = FALLBACK; return; }
      const renderer = KIT.renderer(stage);
      if (!renderer) return;
      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x070a14, 30, 60);
      const camera = new THREE.PerspectiveCamera(46, 1, .1, 200);
      KIT.lights(scene);
      const ac = KIT.accent();

      const over = OS.el('div', { class: 'gm-over hidden' });
      stage.append(over);

      const cellGeo = new THREE.BoxGeometry(.94, .34, .94);
      const NUMCOL = ['#ffffff', '#60a5fa', '#34d399', '#f87171', '#a78bfa', '#fbbf24', '#22d3ee', '#f472b6', '#e2e8f0'];
      let meshes = [], flagMeshes = [], mineMeshes = [], baseMesh = null;

      function buildScene() {
        while (scene.children.length) scene.remove(scene.children[0]);
        KIT.lights(scene);
        meshes = []; flagMeshes = []; mineMeshes = [];
        const L = LEVELS[lv];
        baseMesh = new THREE.Mesh(new THREE.BoxGeometry(L.w + .7, .3, L.h + .7), new THREE.MeshLambertMaterial({ color: 0x141a2a }));
        baseMesh.position.y = -.32;
        scene.add(baseMesh);
        const closedMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(ac.a).lerp(new THREE.Color(0x39415a), .45).getHex() });
        G.cells.forEach((c, i) => {
          const m = new THREE.Mesh(cellGeo, closedMat.clone());
          m.position.set(i % L.w - L.w / 2 + .5, 0, Math.floor(i / L.w) - L.h / 2 + .5);
          m.userData.i = i;
          scene.add(m); meshes.push(m);
        });
        const dist = Math.max(L.w, L.h) * 1.05;
        camera.position.set(0, dist * .98, dist * .74);
        camera.lookAt(0, 0, 0);
      }

      function openTex(n) {
        return KIT.label(n || '', '#232a3d', NUMCOL[n] || '#9aa4c0', 'bold 66px system-ui, sans-serif');
      }
      function revealCell(i, mine) {
        const m = meshes[i];
        if (!m) return;
        const c = G.cells[i];
        if (mine) {
          const s = new THREE.Mesh(new THREE.SphereGeometry(.34, 16, 16), new THREE.MeshStandardMaterial({ color: 0x111318, roughness: .4, emissive: c.hit ? 0xaa1111 : 0x221111 }));
          s.position.copy(m.position); s.position.y = .3;
          scene.add(s); mineMeshes.push(s);
          m.material.color.setHex(0x55222a);
          m.scale.y = .35;
        } else {
          m.scale.y = .28;
          m.position.y = -.06;
          const mats = m.material.clone();
          const top = new THREE.MeshBasicMaterial({ map: openTex(c.n) });
          m.material = [mats, mats, top, mats, mats, mats];
        }
      }
      function setFlag(i, on) {
        const old = flagMeshes.find((f) => f.userData.i === i);
        if (old) { scene.remove(old); flagMeshes = flagMeshes.filter((f) => f !== old); }
        if (on) {
          const g = new THREE.Group();
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .8, 8), new THREE.MeshLambertMaterial({ color: 0xd8dde8 }));
          pole.position.y = .5;
          const flag = new THREE.Mesh(new THREE.ConeGeometry(.26, .34, 4), new THREE.MeshLambertMaterial({ color: 0xef4444 }));
          flag.position.set(.12, .78, 0); flag.rotation.y = Math.PI / 4;
          g.add(pole, flag);
          g.position.copy(meshes[i].position); g.position.y = .18;
          g.userData.i = i;
          scene.add(g); flagMeshes.push(g);
        }
      }

      function reset() {
        const L = LEVELS[lv];
        G = { w: L.w, h: L.h, m: L.m, cells: [], started: false, over: false, flags: 0, opened: 0 };
        for (let i = 0; i < L.w * L.h; i++) G.cells.push({ mine: false, open: false, flag: false, n: 0 });
        secs = 0; clearInterval(timer); timer = null;
        tEl.textContent = '0'; mEl.textContent = L.m;
        over.classList.add('hidden');
        buildScene();
        win.data.state = G;
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
        for (let i = 0; i < G.cells.length; i++) if (i !== safe && !neighbors(safe).includes(i)) idx.push(i);
        for (let k = 0; k < G.m && idx.length; k++) {
          const p = Math.floor(Math.random() * idx.length);
          G.cells[idx.splice(p, 1)[0]].mine = true;
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
        else revealCell(i, false);
        if (c.n === 0) revealCell(i, false);
        checkWin();
      }
      function boom(i) {
        G.over = true; clearInterval(timer);
        G.cells[i].hit = true;
        G.cells.forEach((c, k) => { if (c.mine) { c.open = true; revealCell(k, true); } });
        OS.sfx.play('error');
        over.classList.remove('hidden');
        over.innerHTML = '<div><h3>Взрыв!</h3><p class="dim">Вы продержались ' + secs + ' с</p><button class="btn btn-accent" id="ms-again">Ещё раз</button></div>';
        over.querySelector('#ms-again').onclick = reset;
      }
      function checkWin() {
        if (G.opened === G.cells.length - G.m) {
          G.over = true; clearInterval(timer);
          best('mines.' + lv, Math.max(1, 1000 - secs));
          OS.sfx.play('ok');
          OS.coins.add(50);
          OS.toast('Победа! +50 монет', 'Сапёр 3D · ' + LEVELS[lv].name + ' за ' + secs + ' с · монеты доступны в Steam', { icon: 'coin' });
          over.classList.remove('hidden');
          over.innerHTML = '<div><h3>Поле разминировано! 🎉</h3><p>Время: <b>' + secs + ' с</b></p><button class="btn btn-accent" id="ms-again">Ещё раз</button></div>';
          over.querySelector('#ms-again').onclick = reset;
        }
      }
      function flag(i) {
        const c = G.cells[i];
        if (!c || c.open || G.over) return;
        c.flag = !c.flag;
        G.flags += c.flag ? 1 : -1;
        mEl.textContent = G.m - G.flags;
        setFlag(i, c.flag);
      }

      const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
      let lt = null, downAt = 0;
      renderer.domElement.addEventListener('pointerdown', (e) => {
        downAt = Date.now();
        lt = setTimeout(() => { const i = pick(e); if (i != null) flag(i); lt = null; }, 420);
      });
      renderer.domElement.addEventListener('pointermove', () => { if (lt && Date.now() - downAt > 60) { clearTimeout(lt); lt = null; } });
      renderer.domElement.addEventListener('pointerup', (e) => {
        if (lt) { clearTimeout(lt); lt = null; }
        if (e.button === 0 && Date.now() - downAt < 420) { const i = pick(e); if (i != null) open(i); }
      });
      renderer.domElement.addEventListener('contextmenu', (e) => {
        e.preventDefault(); e.stopPropagation();
        const i = pick(e); if (i != null) flag(i);
      });
      function pick(e) {
        const r = renderer.domElement.getBoundingClientRect();
        ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
        ray.setFromCamera(ptr, camera);
        const hit = ray.intersectObjects(meshes, false)[0];
        return hit ? hit.object.userData.i : null;
      }

      win.data.api = {
        get G() { return G; },
        get meshes() { return meshes; },
        camera: camera,
        renderer: renderer
      };
      const stop = KIT.loop(win, (dt, t) => {
        mineMeshes.forEach((m, i) => { m.position.y = .3 + Math.sin(t * .004 + i) * .05; });
        renderer.render(scene, camera);
      });
      const onRs = () => KIT.fit(renderer, stage, camera);
      win.root.addEventListener('wm:resize', onRs);
      addEventListener('resize', OS.debounce(onRs, 150));
      onRs(); reset();
      return () => { clearInterval(timer); stop(); removeEventListener('resize', onRs); renderer.dispose(); };
    }
  });

  /* =======================================================================
     2048 3D  (исправленная логика + анимации скольжения)
     ======================================================================= */
  OS.Apps.register({
    id: 'game2048',
    price: 50,
    name: '2048 3D',
    icon: 'hash',
    color: '#f59e0b', color2: '#b91c1c',
    category: 'Игры',
    keywords: '2048 3d three.js головоломка puzzle числа',
        storeOnly: true,
width: 560, height: 680, minWidth: 360, minHeight: 480,
    mount(win) {
      const S = 4;
      let grid = empty(), score = 0, bestV = best('2048'), dead = false, wonShown = false, busy = false;
      let nextId = 1, snapshot = null;
      const meshById = new Map();

      function empty() { return Array.from({ length: S }, () => new Array(S).fill(null)); }
      function cells() { let n = 0; grid.forEach((r) => r.forEach((c) => { if (c) n++; })); return n; }

      win.body.innerHTML =
        '<div class="gm">' +
          '<div class="gm-hud"><span>Счёт <b id="g2-s">0</b></span><span>Рекорд <b id="g2-best">0</b></span>' +
          '<div class="gm-hud-btns"><button class="btn btn-sm" id="g2-u">Отменить</button><button class="btn btn-sm btn-accent" id="g2-r">Заново</button></div></div>' +
          '<div class="gm-stage gm-3d"></div>' +
          '<div class="gm-tip">Стрелки / WASD / свайпы. Соберите плитку 2048!</div>' +
        '</div>';
      const sEl = win.body.querySelector('#g2-s'), bEl = win.body.querySelector('#g2-best');
      bEl.textContent = bestV;
      const stage = win.body.querySelector('.gm-stage');

      if (!KIT.ok()) { stage.innerHTML = FALLBACK; return; }
      const renderer = KIT.renderer(stage);
      if (!renderer) return;
      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x070a14, 22, 40);
      const camera = new THREE.PerspectiveCamera(42, 1, .1, 100);
      camera.position.set(0, 7.6, 6.2);
      camera.lookAt(0, 0, 0);
      KIT.lights(scene);

      const TILE = { 2: ['#eee4da', '#776e65'], 4: ['#ede0c8', '#776e65'], 8: ['#f2b179', '#fff'], 16: ['#f59563', '#fff'], 32: ['#f67c5f', '#fff'], 64: ['#f65e3b', '#fff'], 128: ['#edcf72', '#fff'], 256: ['#edcc61', '#fff'], 512: ['#edc850', '#fff'], 1024: ['#edc53f', '#fff'], 2048: ['#edc22e', '#fff'] };
      const colOf = (v) => TILE[v] || ['#3c3a32', '#f9f6f2'];
      const P = (i) => i - (S - 1) / 2;

      const base = new THREE.Mesh(new THREE.BoxGeometry(S + .5, .22, S + .5), new THREE.MeshLambertMaterial({ color: 0x1a2030 }));
      base.position.y = -.14;
      scene.add(base);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(.96, .08, .96), new THREE.MeshLambertMaterial({ color: 0x242c40 }));
        s.position.set(P(x), .02, P(y));
        scene.add(s);
      }

      function makeMesh(v, x, y) {
        const [bg, fg] = colOf(v);
        const top = new THREE.MeshBasicMaterial({ map: KIT.label(v, bg, fg, v >= 1024 ? 'bold 44px system-ui' : 'bold 58px system-ui') });
        const side = new THREE.MeshLambertMaterial({ color: new THREE.Color(bg).multiplyScalar(.72).getHex() });
        const m = new THREE.Mesh(new THREE.BoxGeometry(.9, .46, .9), [side, side, top, side, side, side]);
        m.position.set(P(x), .27, P(y));
        scene.add(m);
        return m;
      }
      function refreshMesh(m, v) {
        const [bg, fg] = colOf(v);
        m.material[2].map.dispose();
        m.material[2].map = KIT.label(v, bg, fg, v >= 1024 ? 'bold 44px system-ui' : 'bold 58px system-ui');
        m.material[2].needsUpdate = true;
        m.material[0].color.setHex(new THREE.Color(bg).multiplyScalar(.72).getHex());
        m.material[1].color.copy(m.material[0].color);
        m.material[3].color.copy(m.material[0].color);
        m.material[4].color.copy(m.material[0].color);
        m.material[5].color.copy(m.material[0].color);
      }
      function spawnMesh(v, x, y, pop) {
        const m = makeMesh(v, x, y);
        if (pop) { m.scale.setScalar(.01); m.userData.pop = 1; }
        return m;
      }

      /* --- логика со слежением за плитками --- */
      function slideLine(line) {
        const src = [];
        line.forEach((c, idx) => { if (c) src.push({ v: c.v, id: c.id, from: idx }); });
        const out = [], moves = [], merges = [];
        let i = 0;
        while (i < src.length) {
          const to = out.length;
          if (i + 1 < src.length && src[i].v === src[i + 1].v) {
            const nv = src[i].v * 2;
            out.push({ v: nv, id: src[i].id });
            moves.push({ id: src[i].id, to: to });
            moves.push({ id: src[i + 1].id, to: to, victim: true });
            merges.push({ id: src[i].id, v: nv });
            score += nv;
            i += 2;
          } else {
            out.push({ v: src[i].v, id: src[i].id });
            moves.push({ id: src[i].id, to: to });
            i++;
          }
        }
        while (out.length < S) out.push(null);
        return { out: out, moves: moves, merges: merges };
      }
      function lineAt(dir, k) {
        const arr = [];
        for (let j = 0; j < S; j++) {
          if (dir === 'left') arr.push(grid[k][j]);
          else if (dir === 'right') arr.push(grid[k][S - 1 - j]);
          else if (dir === 'up') arr.push(grid[j][k]);
          else arr.push(grid[S - 1 - j][k]);
        }
        return arr;
      }
      function setLine(dir, k, arr) {
        for (let j = 0; j < S; j++) {
          if (dir === 'left') grid[k][j] = arr[j];
          else if (dir === 'right') grid[k][S - 1 - j] = arr[j];
          else if (dir === 'up') grid[j][k] = arr[j];
          else grid[S - 1 - j][k] = arr[j];
        }
      }
      function posOf(dir, k, idx) {
        if (dir === 'left') return [idx, k];
        if (dir === 'right') return [S - 1 - idx, k];
        if (dir === 'up') return [k, idx];
        return [k, S - 1 - idx];
      }
      function move(dir) {
        if (dead || busy) return;
        snapshot = { grid: grid.map((r) => r.map((c) => (c ? { v: c.v, id: c.id } : null))), score: score };
        const allMoves = [], allMerges = [];
        let changed = false;
        for (let k = 0; k < S; k++) {
          const line = lineAt(dir, k);
          const before = line.map((c) => (c ? c.id : -1)).join(',');
          const res = slideLine(line);
          if (res.moves.some((m) => { const [x, y] = posOf(dir, k, m.to); const cur = meshById.get(m.id); return !cur || Math.round(cur.userData.gx) !== x || Math.round(cur.userData.gy) !== y; }) || res.merges.length) changed = true;
          setLine(dir, k, res.out);
          res.moves.forEach((m) => { const p = posOf(dir, k, m.to); allMoves.push({ id: m.id, x: p[0], y: p[1], victim: m.victim }); });
          res.merges.forEach((m) => allMerges.push(m));
          if (before !== res.out.map((c) => (c ? c.id : -1)).join(',')) changed = true;
        }
        if (!changed) { snapshot = null; return; }
        busy = true;
        OS.sfx.play('click');
        // анимация перемещения
        const t0 = performance.now(), DUR = 110;
        const start = allMoves.map((m) => { const mesh = meshById.get(m.id); return { m: m, mesh: mesh, fx: mesh ? mesh.userData.gx : m.x, fy: mesh ? mesh.userData.gy : m.y }; });
        const anim = (t) => {
          const k = Math.min(1, (t - t0) / DUR);
          start.forEach((s) => {
            if (!s.mesh) return;
            s.mesh.position.x = P(s.fx + (s.m.x - s.fx) * k);
            s.mesh.position.z = P(s.fy + (s.m.y - s.fy) * k);
          });
          if (k < 1) requestAnimationFrame(anim);
          else finish();
        };
        const finish = () => {
          start.forEach((s) => { if (s.mesh) { s.mesh.userData.gx = s.m.x; s.mesh.userData.gy = s.m.y; } });
          allMerges.forEach((mg) => {
            const victim = allMoves.find((m) => m.victim && m.id !== mg.id && meshById.get(m.id));
          });
          // удалить жертвы, обновить выживших
          const victims = new Set();
          allMoves.forEach((m) => { if (m.victim) victims.add(m.id); });
          victims.forEach((id) => {
            const mesh = meshById.get(id);
            if (mesh) { mesh.userData.die = 1; }
          });
          allMerges.forEach((mg) => {
            const mesh = meshById.get(mg.id);
            if (mesh) { refreshMesh(mesh, mg.v); mesh.userData.pop = 1; }
          });
          // новая плитка
          const freeList = [];
          grid.forEach((r, y) => r.forEach((c, x) => { if (!c) freeList.push([x, y]); }));
          if (freeList.length) {
            const [x, y] = freeList[Math.floor(Math.random() * freeList.length)];
            const v = Math.random() < .9 ? 2 : 4;
            const cell = { v: v, id: nextId++ };
            grid[y][x] = cell;
            const mesh = spawnMesh(v, x, y, true);
            mesh.userData.gx = x; mesh.userData.gy = y;
            meshById.set(cell.id, mesh);
          }
          // чистим жертв после кадра
          setTimeout(() => {
            victims.forEach((id) => { const mesh = meshById.get(id); if (mesh) { scene.remove(mesh); meshById.delete(id); } });
          }, 30);
          busy = false;
          hud();
          if (!wonShown && grid.some((r) => r.some((c) => c && c.v >= 2048))) { wonShown = true; showOver('2048! 🎉', 'Легендарная плитка собрана в 3D.', 'Продолжить', false); }
          if (!canMove()) { dead = true; bestV = best('2048', score); bEl.textContent = bestV; const add = Math.floor(score / 50); OS.coins.add(add); showOver('Игра окончена', 'Счёт: ' + score + ' · рекорд: ' + bestV + ' · +' + add + ' монет', 'Заново', true); }
        };
        requestAnimationFrame(anim);
      }
      function canMove() {
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const c = grid[y][x];
          if (!c) return true;
          const r = x < S - 1 ? grid[y][x + 1] : null, d = y < S - 1 ? grid[y + 1][x] : null;
          if (r && r.v === c.v) return true;
          if (d && d.v === c.v) return true;
        }
        return false;
      }
      function hud() {
        sEl.textContent = score;
        if (score > bestV) { bestV = best('2048', score); bEl.textContent = bestV; }
        win.setTitle('2048 3D — ' + score);
        win.data.state = { score: score, tiles: cells(), dead: dead };
      }
      function showOver(title, text, btn, isDead) {
        over.classList.remove('hidden');
        over.innerHTML = '<div><h3>' + title + '</h3><p class="dim">' + text + '</p><button class="btn btn-accent" id="g2-a">' + btn + '</button></div>';
        over.querySelector('#g2-a').onclick = () => { over.classList.add('hidden'); if (isDead) reset(); };
      }
      function reset() {
        meshById.forEach((m) => scene.remove(m));
        meshById.clear();
        grid = empty(); score = 0; dead = false; wonShown = false; snapshot = null;
        for (let i = 0; i < 2; i++) {
          const freeList = [];
          grid.forEach((r, y) => r.forEach((c, x) => { if (!c) freeList.push([x, y]); }));
          const [x, y] = freeList[Math.floor(Math.random() * freeList.length)];
          const cell = { v: 2, id: nextId++ };
          grid[y][x] = cell;
          const mesh = spawnMesh(2, x, y, true);
          mesh.userData.gx = x; mesh.userData.gy = y;
          meshById.set(cell.id, mesh);
        }
        over.classList.add('hidden');
        hud();
      }
      const over = OS.el('div', { class: 'gm-over hidden' });
      stage.append(over);

      const un = bindInput(win, stage, (d) => move(d), (t) => { if (t === 'tap') undo(); });
      function undo() {
        if (!snapshot || busy) return;
        meshById.forEach((m) => scene.remove(m));
        meshById.clear();
        grid = snapshot.grid; score = snapshot.score; snapshot = null; dead = false;
        grid.forEach((r, y) => r.forEach((c, x) => {
          if (!c) return;
          const mesh = spawnMesh(c.v, x, y, false);
          mesh.userData.gx = x; mesh.userData.gy = y;
          meshById.set(c.id, mesh);
        }));
        hud();
      }
      win.body.querySelector('#g2-r').onclick = reset;
      win.body.querySelector('#g2-u').onclick = undo;

      const stop = KIT.loop(win, (dt) => {
        meshById.forEach((m) => {
          if (m.userData.pop) { m.userData.pop = Math.max(0, m.userData.pop - dt / 140); m.scale.setScalar(1 - m.userData.pop * .9); }
          if (m.userData.die) { m.scale.multiplyScalar(.82); m.position.y -= dt * .004; }
        });
        renderer.render(scene, camera);
      });
      const onRs = () => KIT.fit(renderer, stage, camera);
      win.root.addEventListener('wm:resize', onRs);
      addEventListener('resize', OS.debounce(onRs, 150));
      onRs(); reset();
      win.data.state = { score: score, tiles: cells(), dead: dead };
      return () => { stop(); un(); removeEventListener('resize', onRs); renderer.dispose(); };
    }
  });

  /* =======================================================================
     АРКАНОИД 3D
     ======================================================================= */
  OS.Apps.register({
    id: 'breakout',
    price: 60,
    name: 'Арканоид 3D',
    icon: 'breakout',
    color: '#06b6d4', color2: '#1e3a8a',
    category: 'Игры',
    keywords: 'breakout арканоид 3d three.js кирпичи arcade',
        storeOnly: true,
width: 760, height: 660, minWidth: 400, minHeight: 460,
    mount(win) {
      const FW = 16, FH = 11;
      const st = { px: 0, bx: 0, by: -4, vx: 0, vy: 0, run: false, lives: 3, score: 0, level: 1, keys: {} };
      win.body.innerHTML =
        '<div class="gm">' +
          '<div class="gm-hud"><span>Очки <b id="bk-s">0</b></span><span>Уровень <b id="bk-l">1</b></span><span>Жизни <b id="bk-h">❤❤❤</b></span><span>Рекорд <b id="bk-b">0</b></span>' +
          '<div class="gm-hud-btns"><button class="btn btn-sm" id="bk-p">Пауза/пуск</button><button class="btn btn-sm btn-accent" id="bk-r">Заново</button></div></div>' +
          '<div class="gm-stage gm-3d"></div>' +
          '<div class="gm-tip">Мышь/палец или ← → · пробел — запуск мяча</div>' +
        '</div>';
      win.body.querySelector('#bk-b').textContent = best('breakout');
      const sEl = win.body.querySelector('#bk-s'), lEl = win.body.querySelector('#bk-l'), hEl = win.body.querySelector('#bk-h');
      const stage = win.body.querySelector('.gm-stage');

      if (!KIT.ok()) { stage.innerHTML = FALLBACK; return; }
      const renderer = KIT.renderer(stage);
      if (!renderer) return;
      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x05070f, 26, 44);
      const camera = new THREE.PerspectiveCamera(50, 1, .1, 100);
      camera.position.set(0, -3.4, 17.5);
      camera.lookAt(0, .6, 0);
      KIT.lights(scene);
      const ac = KIT.accent();

      const back = new THREE.Mesh(new THREE.PlaneGeometry(FW + 3, FH + 3), new THREE.MeshLambertMaterial({ color: 0x0c1120 }));
      back.position.z = -1.4;
      scene.add(back);
      const paddle = new THREE.Mesh(new THREE.BoxGeometry(3, .55, 1), new THREE.MeshStandardMaterial({ color: new THREE.Color(ac.a).getHex(), metalness: .5, roughness: .3, emissive: new THREE.Color(ac.a).multiplyScalar(.25).getHex() }));
      paddle.position.set(0, -FH / 2 + .6, 0);
      scene.add(paddle);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(.3, 20, 20), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x99aaff, roughness: .2 }));
      scene.add(ball);
      const ballLight = new THREE.PointLight(0x88aaff, .8, 9);
      ball.add(ballLight);

      let bricks = [];
      function buildLevel() {
        bricks.forEach((b) => scene.remove(b.mesh));
        bricks = [];
        const cols = 9, rows = Math.min(6, 2 + st.level);
        const bw = (FW - 2) / cols;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          if (st.level > 2 && (r + c) % 7 === 3) continue;
          const hue = (200 - r * 26) / 360;
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(bw - .18, .6, .9), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(hue, .75, .55).getHex(), metalness: .3, roughness: .4 }));
          mesh.position.set(-FW / 2 + 1 + bw * (c + .5), FH / 2 - 1 - r * .95, 0);
          scene.add(mesh);
          bricks.push({ mesh: mesh, hp: r === 0 && st.level > 1 ? 2 : 1, w: bw - .18, h: .6 });
        }
        resetBall();
      }
      function resetBall() { st.bx = st.px; st.by = -FH / 2 + 1.1; st.vx = 0; st.vy = 0; st.run = false; }
      function reset() { st.score = 0; st.lives = 3; st.level = 1; over.classList.add('hidden'); buildLevel(); hud(); }
      function hud() {
        sEl.textContent = st.score; lEl.textContent = st.level;
        hEl.textContent = '❤'.repeat(Math.max(0, st.lives)) || '—';
        win.data.state = st;
      }
      const over = OS.el('div', { class: 'gm-over hidden' });
      stage.append(over);
      function gameOver(winAll) {
        st.run = false;
        const add = Math.floor(st.score / 20) + (winAll ? 100 : 0);
        OS.coins.add(add);
        const rec = best('breakout', st.score);
        win.body.querySelector('#bk-b').textContent = rec;
        OS.sfx.play(winAll ? 'ok' : 'error');
        over.classList.remove('hidden');
        over.innerHTML = '<div><h3>' + (winAll ? 'Все уровни пройдены! 🏆' : 'Игра окончена') + '</h3><p>Очки: <b>' + st.score + '</b></p><p class="dim">Рекорд: ' + rec + ' · +' + add + ' монет</p><button class="btn btn-accent" id="bk-a">Ещё раз</button></div>';
        over.querySelector('#bk-a').onclick = reset;
      }
      function step(dt) {
        const k = dt / 16.6;
        if (st.keys.left) st.px = Math.max(-FW / 2 + 1.6, st.px - .28 * k);
        if (st.keys.right) st.px = Math.min(FW / 2 - 1.6, st.px + .28 * k);
        paddle.position.x = st.px;
        if (!st.run) { st.bx = st.px; st.by = -FH / 2 + 1.1; }
        else {
          st.bx += st.vx * k; st.by += st.vy * k;
          if (st.bx < -FW / 2 + .3) { st.bx = -FW / 2 + .3; st.vx *= -1; }
          if (st.bx > FW / 2 - .3) { st.bx = FW / 2 - .3; st.vx *= -1; }
          if (st.by > FH / 2 - .3) { st.by = FH / 2 - .3; st.vy *= -1; }
          if (st.vy < 0 && Math.abs(st.by - paddle.position.y) < .6 && Math.abs(st.bx - st.px) < 1.8) {
            const hit = (st.bx - st.px) / 1.8;
            st.vx = hit * .34; st.vy = Math.abs(st.vy) * 1.004;
            st.by = paddle.position.y + .62;
            OS.sfx.play('click');
          }
          for (let i = 0; i < bricks.length; i++) {
            const b = bricks[i], m = b.mesh.position;
            if (Math.abs(st.bx - m.x) < b.w / 2 + .3 && Math.abs(st.by - m.y) < b.h / 2 + .3) {
              const ox = b.w / 2 + .3 - Math.abs(st.bx - m.x), oy = b.h / 2 + .3 - Math.abs(st.by - m.y);
              if (ox < oy) st.vx *= -1; else st.vy *= -1;
              b.hp--;
              if (b.hp <= 0) { scene.remove(b.mesh); bricks.splice(i, 1); st.score += 10 * st.level; }
              else { b.mesh.material.color.multiplyScalar(.8); st.score += 4; }
              OS.sfx.play('ok'); hud();
              break;
            }
          }
          if (!bricks.length) {
            st.level++; st.score += 100;
            if (st.level > 6) return gameOver(true);
            OS.toast('Уровень ' + st.level, 'Кирпичи восстановлены', { icon: 'layers', timeout: 1600 });
            buildLevel(); hud();
          }
          if (st.by < -FH / 2 - 1) {
            st.lives--; hud();
            if (st.lives <= 0) return gameOver(false);
            resetBall();
          }
          const sp = Math.hypot(st.vx, st.vy), max = .52;
          if (sp > max) { st.vx = st.vx / sp * max; st.vy = st.vy / sp * max; }
        }
        ball.position.set(st.bx, st.by, 0);
      }
      renderer.domElement.addEventListener('pointermove', (e) => {
        const r = renderer.domElement.getBoundingClientRect();
        const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
        st.px = OS.clamp(nx * (FW / 2), -FW / 2 + 1.6, FW / 2 - 1.6);
      });
      renderer.domElement.addEventListener('pointerdown', () => { launch(); });
      function launch() { if (!st.run && st.lives > 0) { st.run = true; st.vx = (Math.random() < .5 ? -1 : 1) * .19; st.vy = .24 + st.level * .012; } }
      const un = bindInput(win, stage, (d) => { if (d === 'left') st.px = Math.max(-FW / 2 + 1.6, st.px - 1.4); if (d === 'right') st.px = Math.min(FW / 2 - 1.6, st.px + 1.4); }, (t) => { if (t === 'tap') launch(); });
      document.addEventListener('keydown', (e) => {
        if (!win.root.isConnected || OS.wm.active !== win) return;
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'ф') st.keys.left = true;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'в') st.keys.right = true;
        if (e.key === ' ') { e.preventDefault(); launch(); }
      });
      document.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'ф') st.keys.left = false;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'в') st.keys.right = false;
      });
      win.body.querySelector('#bk-p').onclick = () => { st.run = !st.run; if (st.run && !st.vx) launch(); };
      win.body.querySelector('#bk-r').onclick = reset;

      const stop = KIT.loop(win, (dt) => { step(dt); renderer.render(scene, camera); });
      const onRs = () => KIT.fit(renderer, stage, camera);
      win.root.addEventListener('wm:resize', onRs);
      addEventListener('resize', OS.debounce(onRs, 150));
      onRs(); reset();
      return () => { stop(); un(); removeEventListener('resize', onRs); renderer.dispose(); };
    }
  });

  /* =======================================================================
     QWEN3D — лабиринт от первого лица на three.js
     ======================================================================= */
  OS.Apps.register({
    id: 'qwen3d',
    price: 100,
    name: 'Qwen3D',
    icon: 'cube',
    color: '#6366f1', color2: '#0f172a',
    category: 'Игры',
    keywords: '3d doom three.js лабиринт шутер first person рейкастинг',
        storeOnly: true,
width: 860, height: 620, minWidth: 400, minHeight: 360,
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
      ];
      const MW = MAP[0].length, MH = MAP.length;
      // yaw = camera.rotation.y; вперёд = (-sin yaw, -cos yaw), вправо = (cos yaw, -sin yaw)
      const P = { x: 1.5, y: 1.5, yaw: -Math.PI / 2, pitch: 0 };
      const st = { keys: {}, coins: [], got: 0, time: 0, showMap: true };

      win.body.innerHTML =
        '<div class="gm">' +
          '<div class="gm-hud"><span>Монеты <b id="d3-s">0/0</b></span><span>Время <b id="d3-t">0:00</b></span>' +
          '<div class="gm-hud-btns"><button class="btn btn-sm btn-accent" id="d3-m">Карта</button><button class="btn btn-sm" id="d3-r">Заново</button></div></div>' +
          '<div class="gm-stage gm-3d"></div>' +
          '<div class="gm-tip">WASD — движение · ← → или перетаскивание мышью — обзор · соберите все монеты · E — ускорение</div>' +
        '</div>';
      const sEl = win.body.querySelector('#d3-s'), tEl = win.body.querySelector('#d3-t');
      const stage = win.body.querySelector('.gm-stage');

      if (!KIT.ok()) { stage.innerHTML = FALLBACK; return; }
      const renderer = KIT.renderer(stage);
      if (!renderer) return;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x05070f);
      scene.fog = new THREE.Fog(0x05070f, 5, 15);
      const camera = new THREE.PerspectiveCamera(72, 1, .05, 80);
      camera.rotation.order = 'YXZ';

      scene.add(new THREE.AmbientLight(0x8899cc, .55));
      const torch = new THREE.PointLight(0xbfd4ff, .95, 7.5);
      camera.add(torch);
      scene.add(camera);

      // текстуры процедурные
      function wallTex() {
        const c = document.createElement('canvas'); c.width = c.height = 128;
        const x = c.getContext('2d');
        x.fillStyle = '#2a3050'; x.fillRect(0, 0, 128, 128);
        x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 4;
        for (let y = 0; y < 128; y += 32) { x.beginPath(); x.moveTo(0, y); x.lineTo(128, y); x.stroke(); }
        for (let y = 0; y < 128; y += 32) for (let xx = ((y / 32) % 2) * 32; xx < 128; xx += 64) { x.beginPath(); x.moveTo(xx, y); x.lineTo(xx, y + 32); x.stroke(); }
        x.fillStyle = 'rgba(255,255,255,.05)';
        for (let i = 0; i < 140; i++) x.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
        const t = new THREE.CanvasTexture(c);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        return t;
      }
      function floorTex() {
        const c = document.createElement('canvas'); c.width = c.height = 128;
        const x = c.getContext('2d');
        x.fillStyle = '#161b2b'; x.fillRect(0, 0, 128, 128);
        x.strokeStyle = 'rgba(120,140,220,.16)'; x.lineWidth = 3;
        x.strokeRect(0, 0, 128, 128);
        x.fillStyle = 'rgba(255,255,255,.03)';
        for (let i = 0; i < 90; i++) x.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
        const t = new THREE.CanvasTexture(c);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(MW, MH);
        return t;
      }
      const wtex = wallTex();
      const wallMat = new THREE.MeshLambertMaterial({ map: wtex });
      const wallGeo = new THREE.BoxGeometry(1, 1, 1);
      for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
        if (MAP[y][x] !== '#') continue;
        const m = new THREE.Mesh(wallGeo, wallMat);
        m.position.set(x + .5, .5, y + .5);
        scene.add(m);
      }
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(MW, MH), new THREE.MeshLambertMaterial({ map: floorTex() }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(MW / 2, 0, MH / 2);
      scene.add(floor);
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(MW, MH), new THREE.MeshBasicMaterial({ color: 0x0a0d18 }));
      ceil.rotation.x = Math.PI / 2;
      ceil.position.set(MW / 2, 1, MH / 2);
      scene.add(ceil);

      const coinGeo = new THREE.CylinderGeometry(.26, .26, .07, 22);
      const coinMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: .8, roughness: .25, emissive: 0x6b4a00 });
      function placeCoins() {
        st.coins.forEach((c) => scene.remove(c.mesh));
        st.coins = []; st.got = 0; st.time = 0;
        const spots = [];
        for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) if (MAP[y][x] !== '#') spots.push([x + .5, y + .5]);
        for (let i = 0; i < 8 && spots.length; i++) {
          const k = Math.floor(Math.random() * spots.length);
          const s = spots.splice(k, 1)[0];
          if (Math.hypot(s[0] - P.x, s[1] - P.y) < 2.2) { i--; continue; }
          const mesh = new THREE.Mesh(coinGeo, coinMat);
          mesh.position.set(s[0], .5, s[1]);
          mesh.rotation.x = Math.PI / 2;
          scene.add(mesh);
          st.coins.push({ x: s[0], y: s[1], mesh: mesh, got: false });
        }
        sEl.textContent = '0/' + st.coins.length;
      }
      function reset() { P.x = 1.5; P.y = 1.5; P.yaw = -Math.PI / 2; P.pitch = 0; over.classList.add('hidden'); placeCoins(); }
      const over = OS.el('div', { class: 'gm-over hidden' });
      stage.append(over);

      // миникарта
      const mm = document.createElement('canvas');
      mm.className = 'gm-minimap';
      mm.width = MW * 7; mm.height = MH * 7;
      stage.append(mm);
      const mctx = mm.getContext('2d');
      function drawMap() {
        if (!st.showMap) { mm.style.display = 'none'; return; }
        mm.style.display = '';
        mctx.clearRect(0, 0, mm.width, mm.height);
        mctx.fillStyle = 'rgba(4,6,14,.66)';
        mctx.fillRect(0, 0, mm.width, mm.height);
        for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
          if (MAP[y][x] === '#') { mctx.fillStyle = 'rgba(150,165,230,.6)'; mctx.fillRect(x * 7, y * 7, 6.2, 6.2); }
        }
        st.coins.forEach((c) => { if (c.got) return; mctx.fillStyle = '#fbbf24'; mctx.beginPath(); mctx.arc(c.x * 7, c.y * 7, 2.2, 0, 7); mctx.fill(); });
        mctx.save();
        mctx.translate(P.x * 7, P.y * 7); mctx.rotate(Math.atan2(-Math.cos(P.yaw), -Math.sin(P.yaw)));
        mctx.fillStyle = '#22d3ee';
        mctx.beginPath(); mctx.moveTo(4.6, 0); mctx.lineTo(-3, 3); mctx.lineTo(-3, -3); mctx.closePath(); mctx.fill();
        mctx.restore();
      }

      function solid(x, y) {
        const mx = Math.floor(x), my = Math.floor(y);
        if (mx < 0 || my < 0 || mx >= MW || my >= MH) return true;
        return MAP[my][mx] === '#';
      }
      function move(dt) {
        const run = st.keys.shift ? 2.1 : 1.3;
        const sp = run * dt / 1000;
        const rot = 2.4 * dt / 1000;
        if (st.keys.left) P.yaw += rot;
        if (st.keys.right) P.yaw -= rot;
        let fx = 0, fy = 0;
        const fx0 = -Math.sin(P.yaw), fz0 = -Math.cos(P.yaw);   // вперёд
        const rx0 = Math.cos(P.yaw), rz0 = -Math.sin(P.yaw);     // вправо
        if (st.keys.up) { fx += fx0; fy += fz0; }
        if (st.keys.down) { fx -= fx0; fy -= fz0; }
        if (st.keys.strafeR) { fx += rx0; fy += rz0; }
        if (st.keys.strafeL) { fx -= rx0; fy -= rz0; }
        const len = Math.hypot(fx, fy);
        if (len) {
          fx = fx / len * sp; fy = fy / len * sp;
          const pad = .26;
          if (!solid(P.x + fx + Math.sign(fx) * pad, P.y)) P.x += fx;
          if (!solid(P.x, P.y + fy + Math.sign(fy) * pad)) P.y += fy;
          st.bob = (st.bob || 0) + dt * .012 * (st.keys.shift ? 1.5 : 1);
        }
        st.coins.forEach((c) => {
          if (!c.got && Math.hypot(c.x - P.x, c.y - P.y) < .5) {
            c.got = true; scene.remove(c.mesh); st.got++;
            sEl.textContent = st.got + '/' + st.coins.length;
            OS.sfx.play('ok');
            OS.toast('Монета найдена', st.got + ' из ' + st.coins.length, { icon: 'coin', timeout: 1200 });
            if (st.got === st.coins.length) finish();
          }
        });
      }
      function finish() {
        const secs = Math.round(st.time / 1000);
        OS.coins.add(100);
        const rec = best('qwen3d', Math.max(1, 3000 - secs * 10));
        over.classList.remove('hidden');
        over.innerHTML = '<div><h3>Лабиринт очищен! 🏆</h3><p>Все монеты собраны за <b>' + secs + ' с</b></p><p class="dim">Лучший результат: ' + rec + '</p><button class="btn btn-accent" id="d3-a">Играть снова</button></div>';
        over.querySelector('#d3-a').onclick = reset;
        OS.sfx.play('notify');
      }

      const onKey = (e) => {
        if (!win.root.isConnected || OS.wm.active !== win) return;
        const k = e.key.toLowerCase();
        const v = e.type === 'keydown';
        if (v && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
        if (k === 'w' || k === 'ц' || k === 'arrowup') st.keys.up = v;
        if (k === 's' || k === 'ы' || k === 'arrowdown') st.keys.down = v;
        if (k === 'arrowleft') st.keys.left = v;
        if (k === 'arrowright') st.keys.right = v;
        if (k === 'a' || k === 'ф') st.keys.strafeL = v;
        if (k === 'd' || k === 'в') st.keys.strafeR = v;
        if (k === 'shift') st.keys.shift = v;
      };
      document.addEventListener('keydown', onKey);
      document.addEventListener('keyup', onKey);
      let drag = false, lx = 0, ly = 0;
      renderer.domElement.addEventListener('pointerdown', (e) => { drag = true; lx = e.clientX; ly = e.clientY; });
      renderer.domElement.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const inv = OS.settings.get('invertMouse') ? -1 : 1;
        P.yaw -= (e.clientX - lx) * .005 * inv;   // тянем мышь вправо — смотрим вправо
        P.pitch = OS.clamp(P.pitch - (e.clientY - ly) * .003 * inv, -.6, .6);
        lx = e.clientX; ly = e.clientY;
      });
      addEventListener('pointerup', () => { drag = false; });
      win.body.querySelector('#d3-m').onclick = () => { st.showMap = !st.showMap; win.body.querySelector('#d3-m').classList.toggle('btn-accent', st.showMap); };
      win.body.querySelector('#d3-r').onclick = reset;

      const stop = KIT.loop(win, (dt, t) => {
        st.time += dt;
        move(dt);
        camera.position.set(P.x, .58 + Math.sin(st.bob || 0) * .035, P.y);
        camera.rotation.y = P.yaw;
        camera.rotation.x = P.pitch;
        st.coins.forEach((c) => { if (!c.got) { c.mesh.rotation.z += dt * .002; c.mesh.position.y = .5 + Math.sin(t * .003 + c.x) * .08; } });
        st.pos = [P.x, P.y];
        if (t - (st._mt || 0) > 120) { st._mt = t; drawMap(); tEl.textContent = Math.floor(st.time / 60000) + ':' + OS.pad(Math.floor(st.time % 60000 / 1000)); }
        renderer.render(scene, camera);
      });
      const onRs = () => KIT.fit(renderer, stage, camera);
      win.root.addEventListener('wm:resize', onRs);
      addEventListener('resize', OS.debounce(onRs, 150));
      onRs(); reset();
      win.data.state = st;
      win.data.api = { get P() { return P; }, camera: camera };
      return () => { stop(); document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey); removeEventListener('resize', onRs); renderer.dispose(); };
    }
  });

  /* =======================================================================
     COUNTER-STRIKE: QWEN OFFENSIVE — полноценный матчевый FPS на three.js
     Экономика денег, закупочная фаза (B), 5 стволов с разными ТТХ, броня,
     прыжки, скоуп AWP, киллфид, раунды до 8 побед, ИИ противников.
     ======================================================================= */
  OS.Apps.register({
    id: 'cs',
    name: 'Counter-Strike',
    icon: 'cross',
    color: '#d97706', color2: '#3f3f46',
    category: 'Игры',
    storeOnly: true,
    price: 150,
    keywords: 'counter strike cs кс шутер fps shooter стрельба раунды закуп',
    width: 1000, height: 680, minWidth: 520, minHeight: 420,
    mount(win) {
      const WEAPONS = {
        glock: { name: 'Glock-18', price: 0, dmg: 26, hs: 3.2, rpm: 400, mag: 20, res: 120, rl: 1.8, spread: .013, auto: false, rec: .004, mov: 1.7 },
        mp9: { name: 'MP9', price: 1250, dmg: 21, hs: 3.0, rpm: 850, mag: 30, res: 120, rl: 2.0, spread: .024, auto: true, rec: .005, mov: 1.35 },
        ak47: { name: 'AK-47', price: 2700, dmg: 36, hs: 4.1, mag: 30, res: 90, rl: 2.4, spread: .015, auto: true, rec: .016, mov: 1.5 },
        m4a1: { name: 'M4A1-S', price: 3100, dmg: 32, hs: 4.0, mag: 30, res: 90, rl: 2.2, spread: .011, auto: true, rec: .011, mov: 1.45 },
        awp: { name: 'AWP', price: 4750, dmg: 115, hs: 2.2, rpm: 41, mag: 10, res: 30, rl: 3.4, spread: .0025, auto: false, rec: .05, mov: 2.6 }
      };
      const M = { money: 800, hp: 100, armor: 0, round: 1, sp: 0, se: 0, loss: 0, time: 90, alive: true, matchOver: false, kills: 0, deaths: 0 };
      let owned = ['glock'], gun = 'glock', mag = {}, res = {};
      const resetAmmo = () => { owned.forEach((w) => { mag[w] = WEAPONS[w].mag; if (res[w] == null) res[w] = WEAPONS[w].res; }); };
      resetAmmo();
      let reloading = false, firing = false, scoped = false, recoil = 0, spreadNow = 0, lastShot = 0;
      let roundState = 'live';

      win.body.innerHTML =
        '<div class="gm">' +
          '<div class="gm-hud cs-top">' +
            '<span class="cs-score"><b class="cs-sp">0</b>:<b class="cs-se">0</b></span>' +
            '<span class="cs-time">1:30</span>' +
            '<span class="cs-round">Раунд 1</span>' +
            '<span class="cs-killfeed"></span>' +
          '</div>' +
          '<div class="gm-stage gm-3d cs-stage"></div>' +
          '<div class="gm-hud cs-bot">' +
            '<span class="cs-hp">' + OS.svg('shield', 14) + '<i></i><b>100</b></span>' +
            '<span class="cs-money">$800</span>' +
            '<span class="cs-gun">Glock-18</span>' +
            '<span class="cs-ammo">20/120</span>' +
          '</div>' +
          '<div class="gm-tip">WASD · Shift — тихо · Space — прыжок · ЛКМ — огонь · ПКМ (AWP) — прицел · B — закуп · R — перезарядка · 1…5 — смена ствола</div>' +
        '</div>';
      const stage = win.body.querySelector('.cs-stage');
      const el = (q) => win.body.querySelector(q);
      const hudHp = el('.cs-hp b'), hudHpBar = el('.cs-hp i'), hudMoney = el('.cs-money'), hudGun = el('.cs-gun'), hudAmmo = el('.cs-ammo');
      const hudTime = el('.cs-time'), hudRound = el('.cs-round'), hudSp = el('.cs-sp'), hudSe = el('.cs-se'), feed = el('.cs-killfeed');

      if (!KIT.ok()) { stage.innerHTML = FALLBACK; return; }
      const renderer = KIT.renderer(stage);
      if (!renderer) return;
      // оверлеи создаём после рендерера (KIT.renderer очищает stage)
      const cross = OS.el('div', { class: 'cs-cross', html: '<i></i><i></i><i></i><i></i>' });
      const scopeEl = OS.el('div', { class: 'cs-scope hidden' });
      const msg = OS.el('div', { class: 'cs-msg', text: 'Клик — захват мыши · B — закупка' });
      const buyEl = OS.el('div', { class: 'cs-buy hidden' });
      const overEl = OS.el('div', { class: 'cs-over hidden' });
      stage.append(cross, scopeEl, msg, buyEl, overEl);
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xc9b189);
      scene.fog = new THREE.Fog(0xc9b189, 26, 70);
      const camera = new THREE.PerspectiveCamera(75, 1, .05, 150);
      camera.rotation.order = 'YXZ';
      scene.add(new THREE.AmbientLight(0xfff2dd, .85));
      const sun = new THREE.DirectionalLight(0xffe2b0, 1.05); sun.position.set(18, 26, 8); scene.add(sun);

      /* ---------- карта ---------- */
      const ARENA = 34;
      const gt = (() => {
        const c = document.createElement('canvas'); c.width = c.height = 256;
        const x = c.getContext('2d');
        x.fillStyle = '#b09a72'; x.fillRect(0, 0, 256, 256);
        x.fillStyle = 'rgba(120,100,70,.35)';
        for (let i = 0; i < 300; i++) x.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
        x.strokeStyle = 'rgba(90,75,50,.35)'; x.lineWidth = 2;
        for (let i = 0; i <= 256; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(256, i); x.stroke(); }
        const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 10); return t;
      })();
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(ARENA, ARENA), new THREE.MeshLambertMaterial({ map: gt }));
      ground.rotation.x = -Math.PI / 2; scene.add(ground);
      const wallMat = new THREE.MeshLambertMaterial({ color: 0xa08a63 });
      const solids = [];
      const addBox = (w, h, d, x, z, mat) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || wallMat);
        m.position.set(x, h / 2, z); scene.add(m);
        solids.push({ x: x, z: z, hw: w / 2 + .35, hd: d / 2 + .35, h: h });
        return m;
      };
      addBox(ARENA, 5, 1, 0, -ARENA / 2); addBox(ARENA, 5, 1, 0, ARENA / 2);
      addBox(1, 5, ARENA, -ARENA / 2, 0); addBox(1, 5, ARENA, ARENA / 2, 0);
      const crateMat = new THREE.MeshLambertMaterial({ color: 0x8a6a3d });
      const crateMat2 = new THREE.MeshLambertMaterial({ color: 0x6f5530 });
      [[-7, -7, 2], [7, -7, 2], [-7, 7, 2], [7, 7, 2], [0, -11, 1.6], [0, 11, 1.6], [-11, 0, 1.6], [11, 0, 1.6], [-3.5, -3.5, 1.4], [3.5, 3.5, 1.4], [3.5, -3.5, 1.4], [-3.5, 3.5, 1.4], [0, 0, 2.2]].forEach((c, i) => {
        addBox(c[2], c[2] > 2 ? 2.4 : 1.5, c[2], c[0], c[1], i % 2 ? crateMat : crateMat2);
      });
      addBox(8, 2.6, .8, -6, 3.5); addBox(.8, 2.6, 8, 6, -3.5);

      /* ---------- оружейная моделька ---------- */
      const gunG = new THREE.Group();
      const gbody = new THREE.Mesh(new THREE.BoxGeometry(.09, .14, .66), new THREE.MeshLambertMaterial({ color: 0x23272e }));
      const gbar = new THREE.Mesh(new THREE.CylinderGeometry(.026, .03, .55, 10), new THREE.MeshLambertMaterial({ color: 0x181b20 }));
      gbar.rotation.x = Math.PI / 2; gbar.position.set(0, .035, -.55);
      const gmag = new THREE.Mesh(new THREE.BoxGeometry(.07, .22, .13), new THREE.MeshLambertMaterial({ color: 0x2c3138 }));
      gmag.position.set(0, -.15, -.1); gmag.rotation.x = .32;
      const gscope = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .22, 10), new THREE.MeshLambertMaterial({ color: 0x111418 }));
      gscope.rotation.x = Math.PI / 2; gscope.position.set(0, .12, -.2); gscope.visible = false;
      gunG.add(gbody, gbar, gmag, gscope);
      gunG.position.set(.3, -.26, -.6);
      camera.add(gunG); scene.add(camera);
      const flash = new THREE.PointLight(0xffc36a, 0, 7); flash.position.set(.3, -.1, -1.3); camera.add(flash);

      /* ---------- враги ---------- */
      let enemies = [];
      function makeEnemy(x, z) {
        const g = new THREE.Group();
        const torso = new THREE.Mesh(new THREE.BoxGeometry(.64, .95, .36), new THREE.MeshLambertMaterial({ color: 0x8a4b32 }));
        torso.position.y = 1.08;
        const vest = new THREE.Mesh(new THREE.BoxGeometry(.68, .5, .4), new THREE.MeshLambertMaterial({ color: 0x37414f }));
        vest.position.y = 1.15;
        const head = new THREE.Mesh(new THREE.SphereGeometry(.24, 14, 14), new THREE.MeshLambertMaterial({ color: 0xd9b48f }));
        head.position.y = 1.78;
        const legs = new THREE.Mesh(new THREE.BoxGeometry(.52, .78, .32), new THREE.MeshLambertMaterial({ color: 0x2f3640 }));
        legs.position.y = .39;
        const rifle = new THREE.Mesh(new THREE.BoxGeometry(.08, .1, .75), new THREE.MeshLambertMaterial({ color: 0x14171c }));
        rifle.position.set(.22, 1.18, .34);
        g.add(torso, vest, head, legs, rifle);
        g.position.set(x, 0, z);
        [torso, vest, head, legs].forEach((m) => { m.userData.enemy = g; m.userData.part = m === head ? 'head' : 'body'; });
        g.userData = { hp: 100, alive: true, cd: 1 + Math.random(), burst: 0, burstT: 0, state: 'patrol', wander: new THREE.Vector2(OS.rnd(-12, 12), OS.rnd(-12, 12)), parts: [torso, vest, head, legs], strafe: Math.random() < .5 ? 1 : -1 };
        scene.add(g); enemies.push(g);
      }
      function spawnRound() {
        enemies.forEach((g) => scene.remove(g)); enemies = [];
        const n = Math.min(6, 1 + M.round);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + OS.rnd(-.4, .4);
          makeEnemy(Math.cos(a) * 13, Math.sin(a) * 13);
        }
      }

      /* ---------- HUD ---------- */
      function hud() {
        hudHp.textContent = Math.max(0, Math.round(M.hp));
        hudHpBar.style.width = Math.max(0, M.hp) + '%';
        hudHpBar.style.background = M.hp > 50 ? 'linear-gradient(90deg,#22c55e,#84cc16)' : M.hp > 25 ? '#f59e0b' : '#ef4444';
        hudMoney.textContent = '$' + M.money;
        hudGun.textContent = WEAPONS[gun].name + (scoped ? ' (скоуп)' : '');
        hudAmmo.textContent = mag[gun] + '/' + res[gun];
        hudTime.textContent = Math.floor(M.time / 60) + ':' + OS.pad(Math.floor(M.time % 60));
        hudRound.textContent = 'Раунд ' + M.round;
        hudSp.textContent = M.sp; hudSe.textContent = M.se;
        cross.style.opacity = scoped ? '0' : '1';
        const gap = 4 + spreadNow * 260;
        cross.style.setProperty('--gap', gap + 'px');
        win.data.state = M;
      }
      function feedKill(killer, victim, head) {
        const d = OS.el('div', { class: 'cs-fk' });
        d.innerHTML = '<b>' + OS.esc(killer) + '</b> ' + (head ? '✸ ' : '› ') + '<i>' + OS.esc(victim) + '</i>';
        feed.append(d);
        setTimeout(() => d.remove(), 4200);
      }

      /* ---------- закупка ---------- */
      const SPAWN = { x: 0, z: 13 };
      function canBuy() { return M.alive && roundState === 'live' && (M.time > 82 || Math.hypot(P.x - SPAWN.x, P.z - SPAWN.z) < 5); }
      function renderBuy() {
        const items = Object.keys(WEAPONS).map((id) => {
          const w = WEAPONS[id];
          const has = owned.includes(id);
          return '<button class="cs-bi' + (has ? ' owned' : '') + '" data-w="' + id + '"' + (has || M.money < w.price ? ' disabled' : '') + '>' +
            '<span>' + w.name + '</span><b>' + (has ? 'куплено' : '$' + w.price) + '</b></button>';
        }).join('') +
          '<button class="cs-bi" data-w="kevlar"' + (M.armor >= 100 || M.money < 650 ? ' disabled' : '') + '><span>Бронежилет</span><b>$650</b></button>';
        buyEl.innerHTML = '<div class="cs-buy-panel"><div class="cs-buy-h"><b>Закупка · $' + M.money + '</b><button class="btn btn-sm" data-close>B — закрыть</button></div>' +
          '<div class="cs-buy-g">' + items + '</div></div>';
      }
      function toggleBuy(force) {
        const show = force != null ? force : buyEl.classList.contains('hidden');
        if (show && !canBuy()) { OS.toast('Закупка закрыта', 'Покупать можно в начале раунда или в зоне респауна', { icon: 'x', timeout: 2600 }); return; }
        buyEl.classList.toggle('hidden', !show);
        if (show) renderBuy();
      }
      buyEl.addEventListener('click', (e) => {
        if (e.target.closest('[data-close]')) { toggleBuy(false); return; }
        const b = e.target.closest('[data-w]'); if (!b || b.disabled) return;
        const id = b.dataset.w;
        if (id === 'kevlar') {
          if (M.money < 650) return;
          M.money -= 650; M.armor = 100;
          OS.sfx.play('ok'); OS.toast('Бронежилет', 'Входящий урон снижен наполовину', { icon: 'shield', timeout: 2200 });
        } else {
          const w = WEAPONS[id];
          if (M.money < w.price || owned.includes(id)) return;
          M.money -= w.price; owned.push(id); mag[id] = w.mag; res[id] = w.res; gun = id;
          OS.sfx.play('ok');
        }
        renderBuy(); hud();
      });

      /* ---------- стрельба ---------- */
      const ray = new THREE.Raycaster();
      let tracers = [];
      function shoot() {
        if (!M.alive || roundState !== 'live' || reloading || !buyEl.classList.contains('hidden')) return;
        const w = WEAPONS[gun];
        const now = performance.now();
        if (now - lastShot < 60000 / w.rpm) return;
        if (mag[gun] <= 0) { OS.sfx.play('error'); reload(); return; }
        lastShot = now;
        mag[gun]--; hud();
        OS.sfx.play('shot');
        flash.intensity = 2.6; setTimeout(() => { flash.intensity = 0; }, 50);
        gunG.position.z = -.5; setTimeout(() => { gunG.position.z = -.6; }, 70);
        recoil += w.rec * (scoped ? .5 : 1);
        spreadNow = Math.min(.14, spreadNow + w.spread * .8 + (moving ? .02 : 0) + (airborne ? .05 : 0));
        const dir = new THREE.Vector3(
          (Math.random() - .5) * spreadNow, (Math.random() - .5) * spreadNow + recoil * .6, -1
        ).normalize().applyQuaternion(camera.quaternion);
        ray.set(camera.position, dir);
        const parts = [];
        enemies.forEach((g) => { if (g.userData.alive) g.userData.parts.forEach((m) => parts.push(m)); });
        const hit = ray.intersectObjects(parts, false)[0];
        const from = new THREE.Vector3(); gunG.getWorldPosition(from);
        const to = hit ? hit.point : ray.ray.at(80, new THREE.Vector3());
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from, to]), new THREE.LineBasicMaterial({ color: 0xffe0a3, transparent: true, opacity: .8 }));
        scene.add(line); tracers.push({ line: line, t: 0 });
        if (hit) {
          const g = hit.object.userData.enemy;
          const head = hit.object.userData.part === 'head';
          const dmg = head ? w.dmg * w.hs : w.dmg;
          g.userData.hp -= dmg;
          OS.sfx.play('hit');
          g.userData.parts.forEach((m) => { m.material.emissive.setHex(head ? 0x662222 : 0x441111); setTimeout(() => m.material.emissive.setHex(0x000000), 80); });
          if (g.userData.hp <= 0 && g.userData.alive) {
            g.userData.alive = false;
            M.kills++;
            const reward = gun === 'awp' ? 100 : 300;
            M.money += reward;
            feedKill('вы', 'Terrorist #' + (enemies.indexOf(g) + 1), head);
            g.rotation.x = -Math.PI / 2; g.position.y = .3;
            setTimeout(() => scene.remove(g), 2600);
            if (!enemies.some((e2) => e2.userData.alive)) winRound();
          }
        }
        hud();
      }
      function reload() {
        if (reloading || mag[gun] === WEAPONS[gun].mag || res[gun] <= 0) return;
        reloading = true; OS.sfx.play('reload');
        msg.classList.remove('hidden'); msg.textContent = 'Перезарядка…';
        setTimeout(() => {
          const need = WEAPONS[gun].mag - mag[gun], take = Math.min(need, res[gun]);
          mag[gun] += take; res[gun] -= take; reloading = false; hud();
          if (locked) msg.classList.add('hidden'); else msg.textContent = 'Клик — захват мыши · B — закупка';
        }, WEAPONS[gun].rl * 1000);
      }

      /* ---------- раунды ---------- */
      function winRound() {
        roundState = 'end';
        M.sp++; M.money += 3250; M.loss = 0;
        showOver('Раунд за вами', 'Противники уничтожены. Призовые +$3250', M.sp >= 8);
      }
      function loseRound(why) {
        roundState = 'end';
        M.se++;
        const bonus = Math.min(3400, 1400 + M.loss * 500);
        M.loss++;
        M.money += bonus;
        showOver('Раунд потерян', why + ' Серийный бонус +$' + bonus, M.se >= 8);
      }
      function showOver(title, text, matchEnd) {
        if (matchEnd) {
          M.matchOver = true;
          const winM = M.sp > M.se;
          const coins = M.kills * 2 + M.sp * 5;
          OS.coins.add(coins);
          const rec = best('cs', M.kills);
          overEl.classList.remove('hidden');
          overEl.innerHTML = '<div><h3>' + (winM ? 'Матч выигран! 🏆' : 'Матч проигран') + '</h3>' +
            '<p>Счёт ' + M.sp + ':' + M.se + ' · фраги ' + M.kills + ' · смерти ' + M.deaths + '</p>' +
            '<p class="dim">Рекорд фрагов: ' + rec + ' · +' + coins + ' монет</p>' +
            '<button class="btn btn-accent" data-restart>Новый матч</button></div>';
          overEl.querySelector('[data-restart]').onclick = () => {
            Object.assign(M, { money: 800, hp: 100, armor: 0, round: 1, sp: 0, se: 0, loss: 0, time: 90, alive: true, matchOver: false, kills: 0, deaths: 0 });
            owned = ['glock']; gun = 'glock'; mag = {}; res = {}; resetAmmo(); scoped = false; camera.fov = 75; camera.updateProjectionMatrix(); scopeEl.classList.add('hidden'); gunG.visible = true;
            overEl.classList.add('hidden'); nextRound(true);
          };
          if (document.pointerLockElement) document.exitPointerLock();
          return;
        }
        overEl.classList.remove('hidden');
        overEl.innerHTML = '<div><h3>' + title + '</h3><p class="dim">' + text + '</p><p>Следующий раунд через несколько секунд…</p></div>';
        setTimeout(() => { overEl.classList.add('hidden'); nextRound(false); }, 3200);
      }
      function nextRound(first) {
        if (!first) M.round++;
        M.time = 90; M.hp = 100; M.alive = true; roundState = 'live';
        P.x = SPAWN.x; P.z = SPAWN.z; P.y = 1.62; vy = 0; P.yaw = Math.PI; P.pitch = 0;
        resetAmmo();
        spawnRound();
        hud();
        OS.toast('Раунд ' + M.round, 'Закупка: B в зоне респауна или первые 8 секунд', { icon: 'cross', timeout: 3200 });
      }

      /* ---------- игрок ---------- */
      const P = { x: SPAWN.x, z: SPAWN.z, y: 1.62, yaw: Math.PI, pitch: 0 };
      let vy = 0, airborne = false, moving = false;
      const keys = {};
      let locked = false, drag = false, lx = 0, ly = 0;
      const cv = renderer.domElement;
      cv.addEventListener('click', () => { if (!M.matchOver && buyEl.classList.contains('hidden')) cv.requestPointerLock && cv.requestPointerLock(); });
      document.addEventListener('pointerlockchange', () => {
        locked = document.pointerLockElement === cv;
        msg.classList.toggle('hidden', locked || M.matchOver);
        if (!locked) firing = false;
      });
      document.addEventListener('mousemove', (e) => {
        if (!locked || !M.alive) return;
        P.yaw -= e.movementX * .0021;
        P.pitch = OS.clamp(P.pitch - e.movementY * .0021, -1.25, 1.25);
      });
      cv.addEventListener('pointerdown', (e) => {
        if (!locked) { drag = true; lx = e.clientX; ly = e.clientY; return; }
        if (e.button === 0) { firing = true; if (!WEAPONS[gun].auto) shoot(); }
        if (e.button === 2 && gun === 'awp') { scoped = !scoped; camera.fov = scoped ? 26 : 75; camera.updateProjectionMatrix(); gscope.visible = scoped; scopeEl.classList.toggle('hidden', !scoped); gunG.visible = !scoped; OS.sfx.play('click'); hud(); }
      });
      cv.addEventListener('pointermove', (e) => {
        if (!drag || locked) return;
        P.yaw -= (e.clientX - lx) * .004; P.pitch = OS.clamp(P.pitch - (e.clientY - ly) * .003, -1.25, 1.25);
        lx = e.clientX; ly = e.clientY;
      });
      addEventListener('pointerup', () => { drag = false; });

      const onKey = (e) => {
        if (!win.root.isConnected || OS.wm.active !== win) return;
        const k = e.key.toLowerCase();
        const v = e.type === 'keydown';
        if (v && !e.repeat) {
          if (k === 'r') reload();
          if (k === 'b' || k === 'и') toggleBuy();
          if (k === ' ') { if (!airborne && M.alive) { vy = 4.6; airborne = true; } e.preventDefault(); }
          if (/^[1-5]$/.test(k)) { const id = owned[+k - 1]; if (id) { gun = id; scoped = false; camera.fov = 75; camera.updateProjectionMatrix(); scopeEl.classList.add('hidden'); gunG.visible = true; OS.sfx.play('click'); hud(); } }
        }
        if (k === 'w' || k === 'ц') keys.up = v;
        if (k === 's' || k === 'ы') keys.down = v;
        if (k === 'a' || k === 'ф') keys.left = v;
        if (k === 'd' || k === 'в') keys.right = v;
        if (k === 'shift') keys.walk = v;
      };
      document.addEventListener('keydown', onKey);
      document.addEventListener('keyup', onKey);

      /* ---------- ИИ ---------- */
      function enemyUpdate(g, dt) {
        const u = g.userData;
        if (!u.alive) return;
        const dx = P.x - g.position.x, dz = P.z - g.position.z;
        const dist = Math.hypot(dx, dz);
        g.rotation.y = Math.atan2(dx, dz);
        if (dist < 20 && M.alive) u.state = 'chase';
        if (u.state === 'chase' && M.alive) {
          const sp = 2.1 * dt / 1000;
          if (dist > 8) { g.position.x += dx / dist * sp; g.position.z += dz / dist * sp; }
          else if (dist < 4.5) { g.position.x -= dx / dist * sp * .7; g.position.z -= dz / dist * sp * .7; }
          else {
            const sx = -dz / dist, sz = dx / dist;
            g.position.x += sx * sp * .5 * u.strafe; g.position.z += sz * sp * .5 * u.strafe;
            if (Math.random() < .005) u.strafe *= -1;
          }
          u.cd -= dt / 1000;
          if (u.cd <= 0 && dist < 17) { u.burst = 3 + OS.rndi(0, 2); u.burstT = 0; u.cd = 1.1 + Math.random() * 1.1; }
          if (u.burst > 0) {
            u.burstT -= dt / 1000;
            if (u.burstT <= 0) {
              u.burstT = .11; u.burst--;
              OS.sfx.play('shot');
              const acc = OS.clamp(.46 - dist * .018 - (moving ? .14 : 0) - (airborne ? .2 : 0), .06, .5);
              if (Math.random() < acc && M.alive) {
                let dmg = 7 + Math.random() * 8;
                if (M.armor > 0) { const abs = dmg * .5; M.armor = Math.max(0, M.armor - abs); dmg -= abs * .8; }
                M.hp -= dmg;
                stage.classList.add('cs-hurt'); setTimeout(() => stage.classList.remove('cs-hurt'), 130);
                hud();
                if (M.hp <= 0 && M.alive) {
                  M.alive = false; M.deaths++;
                  feedKill('Terrorist #' + (enemies.indexOf(g) + 1), 'вы', false);
                  if (document.pointerLockElement) document.exitPointerLock();
                  loseRound('Вы погибли.');
                }
              }
            }
          }
        } else {
          const wx = u.wander.x - g.position.x, wz = u.wander.y - g.position.z;
          const wd = Math.hypot(wx, wz);
          if (wd < 1) u.wander.set(OS.rnd(-13, 13), OS.rnd(-13, 13));
          else { const sp = 1.2 * dt / 1000; g.position.x += wx / wd * sp; g.position.z += wz / wd * sp; }
        }
        g.position.x = OS.clamp(g.position.x, -ARENA / 2 + 1, ARENA / 2 - 1);
        g.position.z = OS.clamp(g.position.z, -ARENA / 2 + 1, ARENA / 2 - 1);
      }

      /* ---------- цикл ---------- */
      let secAcc = 0;
      const stop = KIT.loop(win, (dt) => {
        if (!M.matchOver) {
          secAcc += dt;
          if (secAcc > 1000) {
            secAcc = 0;
            if (roundState === 'live' && M.alive) {
              M.time--;
              hud();
              if (M.time <= 0) loseRound('Время раунда вышло.');
            }
          }
          if (M.alive) {
            const walk = keys.walk ? 1.7 : 4.3;
            const sp = walk * dt / 1000;
            const fx0 = -Math.sin(P.yaw), fz0 = -Math.cos(P.yaw);
            const rx0 = Math.cos(P.yaw), rz0 = -Math.sin(P.yaw);
            let fx = 0, fz = 0;
            if (keys.up) { fx += fx0; fz += fz0; }
            if (keys.down) { fx -= fx0; fz -= fz0; }
            if (keys.left) { fx -= rx0; fz -= rz0; }
            if (keys.right) { fx += rx0; fz += rz0; }
            const len = Math.hypot(fx, fz);
            moving = len > 0;
            if (len) {
              fx = fx / len * sp; fz = fz / len * sp;
              let nx = OS.clamp(P.x + fx, -ARENA / 2 + 1, ARENA / 2 - 1);
              let nz = OS.clamp(P.z + fz, -ARENA / 2 + 1, ARENA / 2 - 1);
              const hitC = (x, z) => solids.some((c) => c.h > 1.2 && Math.abs(x - c.x) < c.hw && Math.abs(z - c.z) < c.hd);
              if (!hitC(nx, P.z)) P.x = nx;
              if (!hitC(P.x, nz)) P.z = nz;
            }
            vy -= 9.8 * dt / 1000;
            P.y = Math.max(1.62, P.y + vy * dt / 1000);
            if (P.y <= 1.62) { vy = 0; airborne = false; }
            spreadNow = Math.max(WEAPONS[gun].spread * (scoped ? .35 : 1) + (moving ? WEAPONS[gun].spread * WEAPONS[gun].mov : 0), spreadNow - dt * .0004);
            recoil = Math.max(0, recoil - dt * .00012);
            if (firing && WEAPONS[gun].auto) shoot();
            camera.position.set(P.x, P.y, P.z);
            camera.rotation.y = P.yaw;
            camera.rotation.x = P.pitch + recoil;
          }
          enemies.forEach((g) => enemyUpdate(g, dt));
        }
        tracers = tracers.filter((t) => {
          t.t += dt;
          t.line.material.opacity = Math.max(0, .8 - t.t / 80);
          if (t.t > 80) { scene.remove(t.line); return false; }
          return true;
        });
        renderer.render(scene, camera);
      });
      const onRs = () => KIT.fit(renderer, stage, camera);
      win.root.addEventListener('wm:resize', onRs);
      addEventListener('resize', OS.debounce(onRs, 150));
      onRs(); nextRound(true);
      win.data.api = { get M() { return M; }, toggleBuy: toggleBuy, get gun() { return gun; }, get owned() { return owned; } };
      return () => { stop(); document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey); removeEventListener('resize', onRs); renderer.dispose(); };
    }
  });

})(window.OS);