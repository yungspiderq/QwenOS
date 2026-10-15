/* ==========================================================================
   QwenOS 3.0 — work.js
   Рабочие смены в 3D: смена начинается в квартире — нужно дойти до входной
   двери и нажать E, затем отработать смену на объекте (город / офис) и
   вернуться с зарплатой на счёт QwenBank.
   ========================================================================== */
(function (OS) {
  'use strict';

  const META = {
    courier: { name: 'Курьер QwenExpress', len: 60, rate: 3, place: 'city', hint: 'Подбирайте заказы: жёлтые коробки — E рядом' },
    typist: { name: 'Оператор набора', len: 45, rate: 2, place: 'office', hint: 'Подойдите к своему столу и нажмите E' },
    qa: { name: 'Тестировщик QwenOS', len: 0, rounds: 5, rate: 5, place: 'office', hint: 'Подойдите к своему столу и нажмите E' }
  };
  const WORDS = ['qwen', 'терминал', 'обои', 'курсор', 'память', 'диск', 'поток', 'кэш', 'массив', 'цикл', 'байт', 'фрейм', 'шейдер', 'вектор', 'полигон', 'кошелёк', 'монета', 'смена', 'заказ', 'релиз'];
  const QA = [
    { lines: ['for (let i = 0; i < 10; i++) {', '  sum += i;', '}', 'return sum;;'], bug: 3 },
    { lines: ['const a = [1, 2, 3];', 'a.lenght = 4;', 'a.push(5);', 'return a;'], bug: 1 },
    { lines: ['if (x = 5) {', '  open();', '}', 'close();'], bug: 0 },
    { lines: ['function f() {', '  retrun 42;', '}', 'f();'], bug: 1 },
    { lines: ['let i = 0;', 'while (i < 5) {', '  log(i);', '  i++;'], bug: 3 },
    { lines: ['const s = "привет";', 's = s.toUpperCase();', 'print(s);', '// ok'], bug: 1 },
    { lines: ['arr.forEach(x => {', '  total += x;', '});', 'return total # готово'], bug: 3 },
    { lines: ['if (ready === true)', '  launch();', 'else', '  wait()'], bug: 3 }
  ];

  function tex(draw, rx, ry) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    draw(c.getContext('2d'));
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (rx) t.repeat.set(rx, ry || rx);
    return t;
  }

  /* --------------------------------------------------------- город курьера */
  function buildCity(scene) {
    const collide = [];
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshLambertMaterial({
      map: tex((x) => {
        x.fillStyle = '#20242c'; x.fillRect(0, 0, 128, 128);
        x.fillStyle = 'rgba(255,255,255,.05)';
        for (let i = 0; i < 200; i++) x.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
        x.strokeStyle = 'rgba(255,255,255,.16)'; x.lineWidth = 3; x.setLineDash([10, 12]);
        x.beginPath(); x.moveTo(64, 0); x.lineTo(64, 128); x.stroke();
      }, 10, 10)
    }));
    ground.rotation.x = -Math.PI / 2; scene.add(ground);
    scene.add(new THREE.AmbientLight(0x9aa6c8, 1.05));
    scene.add(new THREE.HemisphereLight(0x8fa8ff, 0x1a1c24, .55));
    const moon = new THREE.DirectionalLight(0xbfd0ff, .95); moon.position.set(10, 20, 6); scene.add(moon);
    const winT = tex((x) => {
      x.fillStyle = '#1a2233'; x.fillRect(0, 0, 128, 128);
      for (let r = 0; r < 8; r++) for (let c = 0; c < 6; c++) {
        x.fillStyle = Math.random() < .4 ? 'rgba(255,214,140,.85)' : 'rgba(90,120,180,.25)';
        x.fillRect(8 + c * 20, 6 + r * 16, 12, 9);
      }
    }, 2, 3);
    for (let gx = -2; gx <= 2; gx++) for (let gz = -2; gz <= 2; gz++) {
      if (Math.abs(gx) <= 0 && Math.abs(gz) <= 0) continue; // площадь в центре
      const w = 7 + Math.random() * 3, d = 7 + Math.random() * 3, h = 5 + Math.random() * 12;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ map: winT.clone() }));
      b.position.set(gx * 13, h / 2, gz * 13);
      scene.add(b);
      collide.push({ x: gx * 13, z: gz * 13, hw: w / 2 + .4, hd: d / 2 + .4 });
    }
    // фонари
    for (let i = -2; i <= 2; i++) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, 4.4, 8), new THREE.MeshLambertMaterial({ color: 0x39404d }));
      pole.position.set(i * 9, 2.2, 4.5); scene.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(.22, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffe0a3 }));
      head.position.set(i * 9, 4.4, 4.5); scene.add(head);
      const pl = new THREE.PointLight(0xffd28a, .5, 10); pl.position.set(i * 9, 4.2, 4.5); scene.add(pl);
    }
    const spots = [];
    for (let i = 0; i < 14; i++) spots.push([OS.rnd(-30, 30), OS.rnd(-30, 30)]);
    return { collide: collide, spots: spots, bounds: 33 };
  }

  /* ------------------------------------------------------------- офис */
  function buildOffice(scene) {
    const collide = [];
    const OW = 12, OD = 9, OH = 2.9;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(OW, OD), new THREE.MeshLambertMaterial({ color: 0x2b3242 }));
    floor.rotation.x = -Math.PI / 2; scene.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(OW, OD), new THREE.MeshBasicMaterial({ color: 0xdfe6f2 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = OH; scene.add(ceil);
    for (let i = -1; i <= 1; i++) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.4, .5), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      panel.rotation.x = Math.PI / 2; panel.position.set(i * 3.4, OH - .02, 0); scene.add(panel);
    }
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x93a1b8 });
    [[OW, 0, -OD / 2, 0], [OW, 0, OD / 2, Math.PI], [OD, -OW / 2, 0, Math.PI / 2], [OD, OW / 2, 0, -Math.PI / 2]].forEach((w) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w[0], OH), wallMat);
      m.position.set(w[1], OH / 2, w[2]); m.rotation.y = w[3]; scene.add(m);
    });
    scene.add(new THREE.AmbientLight(0xdfe8ff, .95));
    const dl = new THREE.DirectionalLight(0xffffff, .5); dl.position.set(4, 8, 3); scene.add(dl);
    // ряды столов с мониторами
    const deskMat = new THREE.MeshLambertMaterial({ color: 0xb9c2d0 });
    const desks = [];
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
      const x = -3.6 + c * 3.6, z = -2.2 + r * 3.4;
      const d = new THREE.Mesh(new THREE.BoxGeometry(2.4, .72, 1.1), deskMat);
      d.position.set(x, .36, z); scene.add(d);
      collide.push({ x: x, z: z, hw: 1.4, hd: .8 });
      const mon = new THREE.Mesh(new THREE.BoxGeometry(.8, .5, .06), new THREE.MeshBasicMaterial({ color: 0x1a2434 }));
      mon.position.set(x, .98, z - .2); scene.add(mon);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(.72, .42), new THREE.MeshBasicMaterial({ color: 0x2f4d7a }));
      scr.position.set(x, .98, z - .165); scene.add(scr);
      const ch = new THREE.Mesh(new THREE.BoxGeometry(.55, .1, .55), new THREE.MeshLambertMaterial({ color: 0x39404d }));
      ch.position.set(x, .45, z + .85); scene.add(ch);
      desks.push({ x: x, z: z + .95 });
    }
    // кулер и растение для уюта
    const cooler = new THREE.Mesh(new THREE.CylinderGeometry(.25, .25, 1.1, 12), new THREE.MeshLambertMaterial({ color: 0x7fb2e5 }));
    cooler.position.set(OW / 2 - .8, .55, -OD / 2 + .8); scene.add(cooler);
    collide.push({ x: OW / 2 - .8, z: -OD / 2 + .8, hw: .5, hd: .5 });
    return { collide: collide, desks: desks, myDesk: desks[1], bounds: { w: OW / 2 - .5, d: OD / 2 - .5 } };
  }

  /* ------------------------------------------------------------- смены */
  const Work = {
    active: false,
    debug: null,

    start(jobId, onDone) {
      if (this.active) return;
      const meta = META[jobId];
      if (!meta) { onDone && onDone(0); return; }
      if (typeof THREE === 'undefined' || !OS.apartment || !OS.apartment.buildWorld) { onDone && onDone(0); return; }
      this.active = true;

      const wrap = OS.el('div', { class: 'apt work' });
      wrap.innerHTML =
        '<div class="apt-hud work-hud">' +
          '<b class="work-title">' + meta.name + ' · смена</b><br>' +
          '<span class="work-line">Выйдите через дверь: подойдите и нажмите <span class="k">E</span></span><br>' +
          '<span>заработано: <b class="work-earn plus">0</b> · <span class="work-timer"></span></span>' +
        '</div>' +
        '<button class="btn btn-sm apt-exit">Прервать смену (Esc)</button>' +
        '<div class="apt-cross"></div>' +
        '<div class="apt-hint hidden"><span class="k">E</span> <span class="work-act"></span></div>' +
        '<div class="work-panel hidden"></div>' +
        '<div class="work-result hidden"></div>';
      document.body.append(wrap);
      const lineEl = wrap.querySelector('.work-line');
      const earnEl = wrap.querySelector('.work-earn');
      const timerEl = wrap.querySelector('.work-timer');
      const hint = wrap.querySelector('.apt-hint');
      const hintAct = wrap.querySelector('.work-act');
      const panel = wrap.querySelector('.work-panel');
      const result = wrap.querySelector('.work-result');

      let renderer;
      try { renderer = new THREE.WebGLRenderer({ antialias: true }); }
      catch (e) { wrap.remove(); this.active = false; onDone && onDone(0); return; }
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(innerWidth, innerHeight, false);
      renderer.setClearColor(0x05070d, 1);
      wrap.prepend(renderer.domElement);

      const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, .05, 120);
      camera.rotation.order = 'YXZ';
      let scene = null, world = null, phase = 'home';
      let earned = 0, left = meta.len || 0, round = 0, seated = false, finishing = false;
      const P = { x: -.4, z: 1.15, yaw: -.7, pitch: -.05, bob: 0 };
      const keys = {};
      let parcels = [], parcelTimer = 0, raf = 0, last = performance.now(), shiftTimer = null;

      const setLine = (t) => { lineEl.innerHTML = t; };
      const setEarn = () => { earnEl.textContent = earned; };

      /* -------- фазы -------- */
      function loadHome() {
        phase = 'home';
        scene = new THREE.Scene();
        scene.fog = new THREE.Fog(0x05070d, 9, 22);
        world = OS.apartment.buildWorld(scene);
        world.doorMat.color.setHex(0x3d4a63);
        P.x = -.4; P.z = 1.15; P.yaw = -.7; P.pitch = -.05;
        setLine('Выйдите через дверь: подойдите и нажмите <span class="k">E</span>');
      }
      function loadSite() {
        phase = 'site';
        scene = new THREE.Scene();
        if (meta.place === 'city') {
          scene.fog = new THREE.Fog(0x0a0e1a, 18, 60);
          scene.background = new THREE.Color(0x0a0e1a);
          world = buildCity(scene);
          P.x = 0; P.z = 0; P.yaw = Math.PI * .25; P.pitch = -.04;
          setLine(meta.hint);
          spawnParcel(); spawnParcel();
          parcelTimer = setInterval(spawnParcel, 4200);
          startTimer();
        } else {
          scene.fog = new THREE.Fog(0xdfe6f2, 12, 30);
          world = buildOffice(scene);
          P.x = 0; P.z = world.bounds.d - .8; P.yaw = Math.PI; P.pitch = -.02;
          setLine(meta.hint);
          if (meta.rounds) left = 0; else startTimer();
        }
      }
      function startTimer() {
        clearInterval(shiftTimer);
        shiftTimer = setInterval(() => {
          left--;
          timerEl.textContent = left + ' с';
          if (left <= 0) finish();
        }, 1000);
        timerEl.textContent = left + ' с';
      }
      function spawnParcel() {
        if (parcels.length >= 3 || !world || !world.spots) return;
        const s = OS.pick(world.spots);
        const m = new THREE.Mesh(new THREE.BoxGeometry(.55, .55, .55), new THREE.MeshStandardMaterial({ color: 0xe7c540, emissive: 0x6b5200, roughness: .5 }));
        m.position.set(s[0], .35, s[1]);
        scene.add(m);
        const glow = new THREE.PointLight(0xffd76a, .7, 5);
        glow.position.set(s[0], 1.1, s[1]);
        scene.add(glow);
        parcels.push({ mesh: m, glow: glow, x: s[0], z: s[1] });
      }

      /* -------- рабочие панели (офис) -------- */
      function sitDown() {
        seated = true;
        panel.classList.remove('hidden');
        hint.classList.add('hidden');
        camera.position.set(world.myDesk.x, 1.25, world.myDesk.z - .1);
        camera.rotation.y = Math.PI;
        camera.rotation.x = -.12;
        if (jobId === 'typist') typistPanel();
        else qaPanel();
      }
      function typistPanel() {
        let word = OS.pick(WORDS), done = 0;
        panel.innerHTML = '<div class="bnk-type"><div class="bnk-word"></div><input class="field" placeholder="печатайте и Enter…" autocomplete="off" spellcheck="false"><div class="bnk-type-st"></div></div>';
        const wEl = panel.querySelector('.bnk-word'), inp = panel.querySelector('input'), stEl = panel.querySelector('.bnk-type-st');
        const next = () => { word = OS.pick(WORDS); wEl.textContent = word; inp.value = ''; stEl.textContent = 'слов за смену: ' + done + ' · ' + left + ' с'; };
        next();
        setTimeout(() => inp.focus(), 60);
        inp.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter') return;
          e.stopPropagation();
          if (inp.value.trim().toLowerCase() === word) { done++; earned += meta.rate; setEarn(); OS.sfx.play('ok'); next(); }
          else { OS.sfx.play('error'); inp.classList.add('err'); setTimeout(() => inp.classList.remove('err'), 240); }
        });
      }
      function qaPanel() {
        const nextRound = () => {
          if (round >= meta.rounds) return finish();
          const r = QA[(round * 3 + OS.rndi(0, 2)) % QA.length];
          panel.innerHTML = '<div class="bnk-qa"><p class="dim">Раунд ' + (round + 1) + '/' + meta.rounds + ' — найдите строку с ошибкой:</p><pre>' +
            r.lines.map((l, i) => '<button class="bnk-qa-l" data-i="' + i + '">' + (i + 1) + '  ' + OS.esc(l) + '</button>').join('') + '</pre></div>';
          panel.querySelectorAll('[data-i]').forEach((b) => {
            b.onclick = () => {
              if (+b.dataset.i === r.bug) { earned += meta.rate; setEarn(); b.classList.add('good'); OS.sfx.play('ok'); }
              else { b.classList.add('bad'); OS.sfx.play('error'); }
              round++;
              setTimeout(nextRound, 380);
            };
          });
        };
        nextRound();
      }

      /* -------- завершение -------- */
      function finish() {
        if (finishing) return;
        finishing = true;
        clearInterval(shiftTimer); clearInterval(parcelTimer);
        panel.classList.add('hidden');
        hint.classList.add('hidden');
        result.classList.remove('hidden');
        result.innerHTML = '<div><h3>Смена окончена</h3><p>' + meta.name + ' · заработано <b class="plus">' + earned + '</b> монет</p>' +
          '<p class="dim">Зарплата упадёт на счёт QwenBank</p><button class="btn btn-accent" data-back>Вернуться в систему</button></div>';
        result.querySelector('[data-back]').onclick = () => { cleanup(); onDone && onDone(earned); };
      }
      function abort() {
        if (finishing) return;
        finishing = true;
        clearInterval(shiftTimer); clearInterval(parcelTimer);
        cleanup();
        onDone && onDone(earned);
      }
      function cleanup() {
        Work.active = false; Work.debug = null;
        document.removeEventListener('keydown', onKey);
        document.removeEventListener('keyup', onKey);
        cancelAnimationFrame(raf);
        removeEventListener('resize', onRs);
        clearInterval(shiftTimer); clearInterval(parcelTimer);
        wrap.remove();
        renderer.dispose();
      }

      /* -------- ввод -------- */
      const onKey = (e) => {
        const k = e.key.toLowerCase();
        if (e.type === 'keydown') {
          if (seated) return; // панель сама обрабатывает ввод
          if (['w', 'a', 's', 'd', 'ц', 'ф', 'ы', 'в', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
          if (k === 'escape') return abort();
          if (k === 'e' || k === 'у') return interact();
        }
        if (seated) return;
        const v = e.type === 'keydown';
        if (k === 'w' || k === 'ц' || k === 'arrowup') keys.up = v;
        if (k === 's' || k === 'ы' || k === 'arrowdown') keys.down = v;
        if (k === 'a' || k === 'ф') keys.strafeL = v;
        if (k === 'd' || k === 'в') keys.strafeR = v;
        if (k === 'arrowleft') keys.left = v;
        if (k === 'arrowright') keys.right = v;
      };
      document.addEventListener('keydown', onKey);
      document.addEventListener('keyup', onKey);
      let drag = false, lx = 0, ly = 0;
      renderer.domElement.addEventListener('pointerdown', (e) => { drag = true; lx = e.clientX; ly = e.clientY; });
      renderer.domElement.addEventListener('pointermove', (e) => {
        if (!drag || seated) return;
        const inv = OS.settings.get('invertMouse') ? -1 : 1;
        P.yaw -= (e.clientX - lx) * .0042 * inv;
        P.pitch = OS.clamp(P.pitch - (e.clientY - ly) * .0026 * inv, -.7, .7);
        lx = e.clientX; ly = e.clientY;
      });
      addEventListener('pointerup', () => { drag = false; });
      wrap.querySelector('.apt-exit').onclick = () => abort();

      function nearDoor() { return phase === 'home' && Math.hypot(P.x - world.door.x, P.z - world.door.z) < 1.5; }
      function nearParcel() {
        if (phase !== 'site' || meta.place !== 'city') return -1;
        for (let i = 0; i < parcels.length; i++) if (Math.hypot(P.x - parcels[i].x, P.z - parcels[i].z) < 1.3) return i;
        return -1;
      }
      function nearDesk() { return phase === 'site' && meta.place === 'office' && !seated && Math.hypot(P.x - world.myDesk.x, P.z - world.myDesk.z) < 1.4; }
      function interact() {
        if (finishing) return;
        if (nearDoor()) {
          OS.sfx.play('open');
          const f = OS.el('div', { style: { position: 'absolute', inset: '0', background: '#000', opacity: '0', transition: 'opacity .5s', zIndex: 5 } });
          wrap.append(f);
          setTimeout(() => { f.style.opacity = '1'; }, 30);
          setTimeout(() => { f.remove(); loadSite(); OS.toast('Вы на работе', meta.name + ': ' + meta.hint, { icon: 'bag', timeout: 4200 }); }, 620);
          return;
        }
        const pi = nearParcel();
        if (pi >= 0) {
          const p = parcels[pi];
          scene.remove(p.mesh); scene.remove(p.glow);
          parcels.splice(pi, 1);
          earned += meta.rate; setEarn();
          OS.sfx.play('ok');
          OS.toast('Доставка!', '+' + meta.rate + ' монет', { icon: 'send', timeout: 1200 });
          return;
        }
        if (nearDesk()) { sitDown(); return; }
      }
      function onRs() {
        renderer.setSize(innerWidth, innerHeight, false);
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
      }
      addEventListener('resize', onRs);

      /* -------- цикл -------- */
      const step = (t) => {
        raf = requestAnimationFrame(step);
        const dt = Math.min(60, t - last); last = t;
        if (!seated && !finishing) {
          const sp = 2.6 * dt / 1000, rot = 2.2 * dt / 1000;
          if (keys.left) P.yaw += rot;
          if (keys.right) P.yaw -= rot;
          let fx = 0, fz = 0;
          const fx0 = -Math.sin(P.yaw), fz0 = -Math.cos(P.yaw);
          const rx0 = Math.cos(P.yaw), rz0 = -Math.sin(P.yaw);
          if (keys.up) { fx += fx0; fz += fz0; }
          if (keys.down) { fx -= fx0; fz -= fz0; }
          if (keys.strafeR) { fx += rx0; fz += rz0; }
          if (keys.strafeL) { fx -= rx0; fz -= rz0; }
          const len = Math.hypot(fx, fz);
          if (len) {
            fx = fx / len * sp; fz = fz / len * sp;
            let nx = P.x + fx, nz = P.z + fz;
            if (phase === 'home') {
              nx = OS.clamp(nx, -world.RW / 2 + .4, world.RW / 2 - .4);
              nz = OS.clamp(nz, -world.RD / 2 + .4, world.RD / 2 - .4);
            } else if (phase === 'site' && world.bounds) {
              if (typeof world.bounds === 'number') { nx = OS.clamp(nx, -world.bounds, world.bounds); nz = OS.clamp(nz, -world.bounds, world.bounds); }
              else { nx = OS.clamp(nx, -world.bounds.w, world.bounds.w); nz = OS.clamp(nz, -world.bounds.d, world.bounds.d); }
            }
            const hit = (x, z) => world.collide.some((c) => Math.abs(x - c.x) < c.hw && Math.abs(z - c.z) < c.hd);
            if (!hit(nx, P.z)) P.x = nx;
            if (!hit(P.x, nz)) P.z = nz;
            P.bob += dt * .009;
          }
          camera.position.set(P.x, (phase === 'home' ? 1.62 : 1.66) + Math.sin(P.bob) * .03, P.z);
          camera.rotation.y = P.yaw;
          camera.rotation.x = P.pitch;
        }
        // подсказки
        if (!seated && !finishing) {
          const pi = nearParcel();
          if (nearDoor()) { hint.classList.remove('hidden'); hintAct.textContent = 'выйти на работу'; }
          else if (pi >= 0) { hint.classList.remove('hidden'); hintAct.textContent = 'забрать заказ (+' + meta.rate + ')'; }
          else if (nearDesk()) { hint.classList.remove('hidden'); hintAct.textContent = 'сесть за работу'; }
          else hint.classList.add('hidden');
        }
        parcels.forEach((p) => { p.mesh.rotation.y += dt * .002; p.mesh.position.y = .35 + Math.sin(t * .004 + p.x) * .08; });
        renderer.render(scene, camera);
      };

      loadHome();
      raf = requestAnimationFrame(step);
      OS.sfx.play('open');
      OS.toast('Смена началась', meta.name + ': вы дома. Выйдите через дверь, чтобы приступить к работе', { icon: 'bag', timeout: 5200 });

      Work.debug = {
        get phase() { return phase; },
        get P() { return P; },
        get camera() { return camera; },
        teleportDoor() { P.x = world.door.x + .8; P.z = world.door.z; },
        teleportDesk() { if (world && world.myDesk) { P.x = world.myDesk.x; P.z = world.myDesk.z + .6; } },
        finish: finish
      };
    }
  };

  OS.work = Work;
})(window.OS);
