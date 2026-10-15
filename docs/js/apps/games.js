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
     COUNTER-STRIKE — FPS на three.js: раунды, враги, отдача, трейсеры
     ======================================================================= */
  OS.Apps.register({
    id: 'cs',
    name: 'Counter-Strike',
    icon: 'cross',
    color: '#d97706', color2: '#3f3f46',
    category: 'Игры',
    storeOnly: true,
    price: 150,
    keywords: 'counter strike cs кс шутер fps shooter стрельба',
    width: 940, height: 640, minWidth: 480, minHeight: 400,
    mount(win) {
      const st = { hp: 100, ammo: 30, reserve: 90, round: 1, kills: 0, reloading: false, over: false };
      win.body.innerHTML =
        '<div class="gm">' +
          '<div class="gm-hud cs-hud">' +
            '<span class="cs-hp"><i></i><b>100</b></span>' +
            '<span>Патроны <b id="cs-a">30/90</b></span>' +
            '<span>Раунд <b id="cs-r">1</b></span>' +
            '<span>Фраги <b id="cs-k">0</b></span>' +
            '<div class="gm-hud-btns"><button class="btn btn-sm" id="cs-reload">R</button><button class="btn btn-sm btn-accent" id="cs-rst">Заново</button></div>' +
          '</div>' +
          '<div class="gm-stage gm-3d cs-stage"><div class="cs-cross"></div><div class="cs-msg">Кликните, чтобы захватить мышь</div></div>' +
          '<div class="gm-tip">WASD — движение · мышь — прицел (pointer lock) · ЛКМ — огонь · R — перезарядка · Esc — отпустить мышь</div>' +
        '</div>';
      const stage = win.body.querySelector('.gm-stage');
      const hpBar = win.body.querySelector('.cs-hp i'), hpEl = win.body.querySelector('.cs-hp b');
      const aEl = win.body.querySelector('#cs-a'), rEl = win.body.querySelector('#cs-r'), kEl = win.body.querySelector('#cs-k');
      const msg = win.body.querySelector('.cs-msg');
      if (!KIT.ok()) { stage.innerHTML = FALLBACK; return; }
      const renderer = KIT.renderer(stage);
      if (!renderer) return;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1a1712);
      scene.fog = new THREE.Fog(0x1a1712, 18, 55);
      const camera = new THREE.PerspectiveCamera(75, 1, .05, 120);
      camera.rotation.order = 'YXZ';
      scene.add(new THREE.AmbientLight(0xd8c9a8, .8));
      const sun = new THREE.DirectionalLight(0xffe0b0, .9); sun.position.set(12, 18, 6); scene.add(sun);

      // арена
      const ARENA = 26;
      const groundT = KIT.label('', null, null); // заглушка не нужна; рисуем свою
      const gt = (function () {
        const c = document.createElement('canvas'); c.width = c.height = 256;
        const x = c.getContext('2d');
        x.fillStyle = '#8a7a5f'; x.fillRect(0, 0, 256, 256);
        x.fillStyle = 'rgba(0,0,0,.12)';
        for (let i = 0; i < 260; i++) x.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
        x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 2;
        for (let i = 0; i <= 256; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(256, i); x.stroke(); }
        const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 8); return t;
      })();
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(ARENA, ARENA), new THREE.MeshLambertMaterial({ map: gt }));
      ground.rotation.x = -Math.PI / 2; scene.add(ground);
      const wallMat = new THREE.MeshLambertMaterial({ color: 0x6b5b45 });
      [[0, -ARENA / 2, 0], [0, ARENA / 2, Math.PI], [-ARENA / 2, 0, Math.PI / 2], [ARENA / 2, 0, -Math.PI / 2]].forEach((w) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(ARENA, 4, .8), wallMat);
        m.position.set(w[0], 2, w[1]); m.rotation.y = w[2]; scene.add(m);
      });
      const crates = [];
      const crateMat = new THREE.MeshLambertMaterial({ color: 0x7a5a33 });
      const cratePos = [[-6, -6], [6, -6], [-6, 6], [6, 6], [0, -9], [0, 9], [-9, 0], [9, 0], [-3, 0], [3, 0]];
      cratePos.forEach((c) => {
        const h = 1.2 + Math.random() * .9;
        const m = new THREE.Mesh(new THREE.BoxGeometry(1.6, h, 1.6), crateMat);
        m.position.set(c[0], h / 2, c[1]); scene.add(m);
        crates.push({ x: c[0], z: c[1], hw: 1.1 });
      });

      // оружейная моделька
      const gun = new THREE.Group();
      const gbody = new THREE.Mesh(new THREE.BoxGeometry(.09, .13, .62), new THREE.MeshLambertMaterial({ color: 0x23272e }));
      const gbar = new THREE.Mesh(new THREE.CylinderGeometry(.028, .032, .5, 10), new THREE.MeshLambertMaterial({ color: 0x181b20 }));
      gbar.rotation.x = Math.PI / 2; gbar.position.set(0, .03, -.5);
      const gmag = new THREE.Mesh(new THREE.BoxGeometry(.07, .2, .12), new THREE.MeshLambertMaterial({ color: 0x2c3138 }));
      gmag.position.set(0, -.14, -.08); gmag.rotation.x = .3;
      gun.add(gbody, gbar, gmag);
      gun.position.set(.28, -.24, -.55);
      camera.add(gun);
      scene.add(camera);
      const flash = new THREE.PointLight(0xffc36a, 0, 6);
      flash.position.set(.28, -.1, -1.1);
      camera.add(flash);

      // враги
      let enemies = [];
      function makeEnemy(x, z) {
        const g = new THREE.Group();
        const torso = new THREE.Mesh(new THREE.BoxGeometry(.62, .95, .34), new THREE.MeshLambertMaterial({ color: 0x7a3b2e }));
        torso.position.y = 1.05;
        const head = new THREE.Mesh(new THREE.SphereGeometry(.24, 14, 14), new THREE.MeshLambertMaterial({ color: 0xd9b48f }));
        head.position.y = 1.75;
        const legs = new THREE.Mesh(new THREE.BoxGeometry(.5, .75, .3), new THREE.MeshLambertMaterial({ color: 0x2f3640 }));
        legs.position.y = .38;
        const rifle = new THREE.Mesh(new THREE.BoxGeometry(.08, .1, .7), new THREE.MeshLambertMaterial({ color: 0x14171c }));
        rifle.position.set(.2, 1.15, .3);
        g.add(torso, head, legs, rifle);
        g.position.set(x, 0, z);
        [torso, head, legs].forEach((m) => { m.userData.enemy = g; m.userData.part = m === head ? 'head' : 'body'; });
        g.userData = { hp: 100, cd: 1 + Math.random() * 1.5, parts: [torso, head, legs], alive: true };
        scene.add(g);
        enemies.push(g);
      }
      function spawnRound() {
        enemies.forEach((g) => scene.remove(g));
        enemies = [];
        const n = Math.min(8, 1 + st.round);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + Math.random() * .6;
          makeEnemy(Math.cos(a) * 10, Math.sin(a) * 10);
        }
        rEl.textContent = st.round;
      }

      // игрок
      const P = { x: 0, z: 0, yaw: 0, pitch: 0 };
      const keys = {};
      let locked = false, drag = false, lx = 0, ly = 0;
      const cv = renderer.domElement;
      cv.addEventListener('click', () => { if (!st.over && cv.requestPointerLock) cv.requestPointerLock(); });
      document.addEventListener('pointerlockchange', () => {
        locked = document.pointerLockElement === cv;
        msg.classList.toggle('hidden', locked || st.over);
      });
      document.addEventListener('mousemove', (e) => {
        if (!locked || st.over) return;
        P.yaw -= e.movementX * .0022;
        P.pitch = OS.clamp(P.pitch - e.movementY * .0022, -1.2, 1.2);
      });
      cv.addEventListener('pointerdown', (e) => { if (!locked) { drag = true; lx = e.clientX; ly = e.clientY; } else if (e.button === 0) shoot(); });
      cv.addEventListener('pointermove', (e) => {
        if (!drag || locked) return;
        P.yaw -= (e.clientX - lx) * .004; P.pitch = OS.clamp(P.pitch - (e.clientY - ly) * .003, -1.2, 1.2);
        lx = e.clientX; ly = e.clientY;
      });
      addEventListener('pointerup', () => { drag = false; });

      const ray = new THREE.Raycaster();
      let tracers = [];
      function shoot() {
        if (st.over || st.reloading) return;
        if (st.ammo <= 0) { OS.sfx.play('error'); msg.classList.remove('hidden'); msg.textContent = 'Перезарядка — R'; setTimeout(() => { if (!locked) msg.textContent = 'Кликните, чтобы захватить мышь'; }, 900); return; }
        st.ammo--; hud();
        OS.sfx.play('shot');
        flash.intensity = 2.4; setTimeout(() => { flash.intensity = 0; }, 55);
        gun.position.z = -.47; setTimeout(() => { gun.position.z = -.55; }, 60);
        ray.setFromCamera({ x: 0, y: 0 }, camera);
        const parts = [];
        enemies.forEach((g) => { if (g.userData.alive) g.userData.parts.forEach((m) => parts.push(m)); });
        const hit = ray.intersectObjects(parts, false)[0];
        const from = new THREE.Vector3(); gun.getWorldPosition(from);
        const to = hit ? hit.point : ray.ray.at(60, new THREE.Vector3());
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from, to]), new THREE.LineBasicMaterial({ color: 0xffd789, transparent: true, opacity: .85 }));
        scene.add(line); tracers.push({ line: line, t: 0 });
        if (hit) {
          const g = hit.object.userData.enemy;
          const dmg = hit.object.userData.part === 'head' ? 100 : 34;
          g.userData.hp -= dmg;
          OS.sfx.play('hit');
          g.userData.parts.forEach((m) => { m.material.emissive && m.material.emissive.setHex(0x551111); setTimeout(() => m.material.emissive && m.material.emissive.setHex(0x000000), 90); });
          if (g.userData.hp <= 0) {
            g.userData.alive = false;
            st.kills++; kEl.textContent = st.kills;
            OS.coins.add(0); // монеты начисляются в конце матча
            g.rotation.x = -Math.PI / 2; g.position.y = .3;
            setTimeout(() => scene.remove(g), 2400);
            enemies = enemies.filter((x) => x !== g);
            if (!enemies.some((e2) => e2.userData.alive)) {
              st.round++; st.hp = Math.min(100, st.hp + 25);
              OS.toast('Раунд ' + st.round, 'Противники уничтожены. +25 HP', { icon: 'cross', timeout: 2600 });
              spawnRound();
            }
          }
        }
      }
      function reload() {
        if (st.reloading || st.ammo === 30 || st.reserve <= 0) return;
        st.reloading = true; OS.sfx.play('reload');
        msg.classList.remove('hidden'); msg.textContent = 'Перезарядка…';
        setTimeout(() => {
          const need = 30 - st.ammo, take = Math.min(need, st.reserve);
          st.ammo += take; st.reserve -= take; st.reloading = false;
          hud();
          if (!locked) msg.textContent = 'Кликните, чтобы захватить мышь'; else msg.classList.add('hidden');
        }, 1100);
      }
      function hud() {
        aEl.textContent = st.ammo + '/' + st.reserve;
        hpEl.textContent = Math.max(0, Math.round(st.hp));
        hpBar.style.width = Math.max(0, st.hp) + '%';
        hpBar.style.background = st.hp > 50 ? 'linear-gradient(90deg,#22c55e,#84cc16)' : st.hp > 25 ? '#f59e0b' : '#ef4444';
        win.data.state = st;
      }
      function gameOver() {
        st.over = true;
        const coins = st.kills * 2;
        OS.coins.add(coins);
        const rec = best('cs', st.kills);
        OS.sfx.play('error');
        overEl.classList.remove('hidden');
        overEl.innerHTML = '<div><h3>Матч окончен</h3><p>Фраги: <b>' + st.kills + '</b> · раунд ' + st.round + '</p><p class="dim">Рекорд: ' + rec + ' · +' + coins + ' монет</p><button class="btn btn-accent" id="cs-again">В бой</button></div>';
        overEl.querySelector('#cs-again').onclick = () => { st.hp = 100; st.ammo = 30; st.reserve = 90; st.round = 1; st.kills = 0; st.over = false; P.x = 0; P.z = 0; P.yaw = 0; P.pitch = 0; overEl.classList.add('hidden'); spawnRound(); hud(); };
        if (document.pointerLockElement) document.exitPointerLock();
      }
      const overEl = OS.el('div', { class: 'gm-over hidden' });
      stage.append(overEl);

      const onKey = (e) => {
        if (!win.root.isConnected || OS.wm.active !== win) return;
        const k = e.key.toLowerCase();
        const v = e.type === 'keydown';
        if (v && k === 'r') return reload();
        if (k === 'w' || k === 'ц') keys.up = v;
        if (k === 's' || k === 'ы') keys.down = v;
        if (k === 'a' || k === 'ф') keys.left = v;
        if (k === 'd' || k === 'в') keys.right = v;
      };
      document.addEventListener('keydown', onKey);
      document.addEventListener('keyup', onKey);
      win.body.querySelector('#cs-reload').onclick = reload;
      win.body.querySelector('#cs-rst').onclick = () => { st.hp = 100; st.ammo = 30; st.reserve = 90; st.round = 1; st.kills = 0; st.over = false; overEl.classList.add('hidden'); spawnRound(); hud(); };

      const stop = KIT.loop(win, (dt) => {
        if (!st.over) {
          const sp = 4.2 * dt / 1000;
          const fx0 = -Math.sin(P.yaw), fz0 = -Math.cos(P.yaw);
          const rx0 = Math.cos(P.yaw), rz0 = -Math.sin(P.yaw);
          let fx = 0, fz = 0;
          if (keys.up) { fx += fx0; fz += fz0; }
          if (keys.down) { fx -= fx0; fz -= fz0; }
          if (keys.right) { fx += rx0; fz += rz0; }
          if (keys.left) { fx -= rx0; fz -= rz0; }
          const len = Math.hypot(fx, fz);
          if (len) {
            fx = fx / len * sp; fz = fz / len * sp;
            let nx = OS.clamp(P.x + fx, -ARENA / 2 + 1, ARENA / 2 - 1);
            let nz = OS.clamp(P.z + fz, -ARENA / 2 + 1, ARENA / 2 - 1);
            const hitC = (x, z) => crates.some((c) => Math.abs(x - c.x) < c.hw && Math.abs(z - c.z) < c.hw);
            if (!hitC(nx, P.z)) P.x = nx;
            if (!hitC(P.x, nz)) P.z = nz;
          }
          camera.position.set(P.x, 1.62, P.z);
          camera.rotation.y = P.yaw;
          camera.rotation.x = P.pitch;
          // ИИ противников
          enemies.forEach((g) => {
            if (!g.userData.alive) return;
            const dx = P.x - g.position.x, dz = P.z - g.position.z;
            const dist = Math.hypot(dx, dz);
            g.rotation.y = Math.atan2(dx, dz);
            if (dist > 5.5) {
              const s2 = 1.7 * dt / 1000;
              g.position.x += dx / dist * s2;
              g.position.z += dz / dist * s2;
            }
            g.userData.cd -= dt / 1000;
            if (g.userData.cd <= 0 && dist < 13) {
              g.userData.cd = 1.15 + Math.random() * .9;
              OS.sfx.play('shot');
              if (Math.random() < .42) {
                st.hp -= 6 + Math.random() * 7;
                hud();
                stage.classList.add('cs-hurt');
                setTimeout(() => stage.classList.remove('cs-hurt'), 140);
                if (st.hp <= 0) gameOver();
              }
            }
          });
        }
        tracers = tracers.filter((t) => {
          t.t += dt;
          t.line.material.opacity = Math.max(0, .85 - t.t / 90);
          if (t.t > 90) { scene.remove(t.line); return false; }
          return true;
        });
        renderer.render(scene, camera);
      });
      const onRs = () => KIT.fit(renderer, stage, camera);
      win.root.addEventListener('wm:resize', onRs);
      addEventListener('resize', OS.debounce(onRs, 150));
      onRs(); spawnRound(); hud();
      return () => { stop(); document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey); removeEventListener('resize', onRs); renderer.dispose(); };
    }
  });

})(window.OS);