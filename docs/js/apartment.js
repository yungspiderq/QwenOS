/* ==========================================================================
   QwenOS 3.0 — apartment.js
   «После выключения»: вы оказываетесь в квартире от первого лица.
   Можно ходить (WASD), осматриваться (мышь/стрелки), подойти к компьютеру
   и нажать E — система включится снова. Esc — выход к экрану питания.
   ========================================================================== */
(function (OS) {
  'use strict';

  const Apt = {
    active: false,

    enter(onExit) {
      if (this.active) return;
      if (typeof THREE === 'undefined') {
        OS.toast('Режим прогулки недоступен', 'three.js не загрузился', { icon: 'x' });
        onExit && onExit();
        return;
      }
      this.active = true;
      const wrap = OS.el('div', { class: 'apt' });
      wrap.innerHTML =
        '<div class="apt-hud">' +
          '<b>Квартира · 23:47</b><br>' +
          'Компьютер выключен. В комнате тихо гудит холодильник.<br><br>' +
          '<span class="k">W A S D</span> ходить · <span class="k">мышь</span> осматриваться<br>' +
          '<span class="k">E</span> взаимодействовать · <span class="k">Esc</span> выход' +
        '</div>' +
        '<button class="btn btn-sm apt-exit">Выйти (Esc)</button>' +
        '<div class="apt-cross"></div>' +
        '<div class="apt-hint hidden"><span class="k">E</span> включить компьютер</div>';
      document.body.append(wrap);
      const hint = wrap.querySelector('.apt-hint');

      let renderer;
      try { renderer = new THREE.WebGLRenderer({ antialias: true }); }
      catch (e) { wrap.remove(); this.active = false; onExit && onExit(); return; }
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(innerWidth, innerHeight, false);
      renderer.setClearColor(0x05070d, 1);
      wrap.prepend(renderer.domElement);

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x05070d, 9, 22);
      const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, .05, 60);
      camera.rotation.order = 'YXZ';

      /* ------------------------------------------------- помещение */
      const RW = 11, RD = 8.4, H = 2.75;
      const tex = (draw, rx, ry) => {
        const c = document.createElement('canvas'); c.width = c.height = 256;
        draw(c.getContext('2d'));
        const t = new THREE.CanvasTexture(c);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        if (rx) t.repeat.set(rx, ry || rx);
        return t;
      };
      const floorT = tex((x) => {
        x.fillStyle = '#6b4a2f'; x.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 8; i++) {
          x.fillStyle = i % 2 ? '#7a563а'.replace('а', 'a') : '#66452c';
          x.fillRect(0, i * 32, 256, 30);
          x.strokeStyle = 'rgba(0,0,0,.28)'; x.lineWidth = 2;
          x.beginPath(); x.moveTo(0, i * 32); x.lineTo(256, i * 32); x.stroke();
        }
        x.fillStyle = 'rgba(255,255,255,.05)';
        for (let i = 0; i < 240; i++) x.fillRect(Math.random() * 256, Math.random() * 256, 2, 1);
      }, 5, 4);
      const wallT = tex((x) => {
        x.fillStyle = '#3a4157'; x.fillRect(0, 0, 256, 256);
        x.fillStyle = 'rgba(255,255,255,.045)';
        for (let i = 0; i < 256; i += 16) x.fillRect(0, i, 256, 8);
        x.fillStyle = 'rgba(0,0,0,.12)';
        for (let i = 0; i < 160; i++) x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
      }, 4, 1.4);

      const floor = new THREE.Mesh(new THREE.PlaneGeometry(RW, RD), new THREE.MeshLambertMaterial({ map: floorT }));
      floor.rotation.x = -Math.PI / 2; scene.add(floor);
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(RW, RD), new THREE.MeshLambertMaterial({ color: 0x20242f }));
      ceil.rotation.x = Math.PI / 2; ceil.position.y = H; scene.add(ceil);
      const wallMat = new THREE.MeshLambertMaterial({ map: wallT });
      const mkWall = (w, h, x, y, z, ry) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
        m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m;
      };
      mkWall(RW, H, 0, H / 2, -RD / 2, 0);
      mkWall(RW, H, 0, H / 2, RD / 2, Math.PI);
      mkWall(RD, H, -RW / 2, H / 2, 0, Math.PI / 2);
      mkWall(RD, H, RW / 2, H / 2, 0, -Math.PI / 2);

      /* свет: вечерняя лампа + окно */
      scene.add(new THREE.AmbientLight(0x6a7396, .95));
      const lamp = new THREE.PointLight(0xffc37a, 1.05, 12);
      lamp.position.set(-2.6, 2.1, 2.4); scene.add(lamp);
      const ceilL = new THREE.PointLight(0xbfd0ff, .62, 14);
      ceilL.position.set(0, 2.6, 0); scene.add(ceilL);
      const winL = new THREE.PointLight(0x7aa7ff, .6, 9);
      winL.position.set(RW / 2 - .6, 1.7, -1.4); scene.add(winL);

      /* окно на правой стене */
      const winFrame = new THREE.Mesh(new THREE.BoxGeometry(.12, 1.7, 2.6), new THREE.MeshLambertMaterial({ color: 0x11141c }));
      winFrame.position.set(RW / 2 - .06, 1.55, -1.4); scene.add(winFrame);
      const sky = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5), new THREE.MeshBasicMaterial({
        map: tex((x) => {
          const g = x.createLinearGradient(0, 0, 0, 256);
          g.addColorStop(0, '#0b1030'); g.addColorStop(.55, '#27356b'); g.addColorStop(1, '#7a4a86');
          x.fillStyle = g; x.fillRect(0, 0, 256, 256);
          x.fillStyle = '#fff';
          for (let i = 0; i < 70; i++) x.fillRect(Math.random() * 256, Math.random() * 150, 1.6, 1.6);
          x.fillStyle = '#0a0d1c';
          for (let i = 0; i < 9; i++) { const bw = 18 + Math.random() * 26, bh = 40 + Math.random() * 70; x.fillRect(i * 29, 256 - bh, bw, bh); }
          x.fillStyle = 'rgba(255,220,140,.8)';
          for (let i = 0; i < 40; i++) x.fillRect(Math.random() * 256, 180 + Math.random() * 70, 2, 2);
        })
      }));
      sky.rotation.y = -Math.PI / 2;
      sky.position.set(RW / 2 - .13, 1.55, -1.4); scene.add(sky);

      /* ------------------------------------------------- мебель */
      const box = (w, h, d, color, x, y, z, mat) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || new THREE.MeshLambertMaterial({ color: color }));
        m.position.set(x, y, z); scene.add(m); return m;
      };
      const collide = [];
      const furn = (w, h, d, color, x, y, z) => { const m = box(w, h, d, color, x, y, z); collide.push({ x: x, z: z, hw: w / 2 + .28, hd: d / 2 + .28 }); return m; };

      // стол с компьютером (у дальней стены справа)
      const DX = 3.4, DZ = -RD / 2 + .75;
      furn(2.4, .74, 1.0, 0x4a3524, DX, .37, DZ);
      box(.12, .7, .8, 0x3a2a1c, DX - 1.05, .35, DZ);
      box(.12, .7, .8, 0x3a2a1c, DX + 1.05, .35, DZ);
      const monBody = box(.9, .62, .08, 0x0c0f16, DX, 1.12, DZ - .28);
      const screenMat = new THREE.MeshBasicMaterial({ color: 0x05070c });
      const monScreen = new THREE.Mesh(new THREE.PlaneGeometry(.84, .54), screenMat);
      monScreen.position.set(DX, 1.12, DZ - .235); scene.add(monScreen);
      const led = new THREE.Mesh(new THREE.SphereGeometry(.015, 8, 8), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
      led.position.set(DX + .38, .86, DZ - .23); scene.add(led);
      box(.5, .04, .18, 0x1a1f2b, DX, .77, DZ + .05);           // клавиатура
      const chair = furn(.62, .12, .62, 0x2b3145, DX, .48, DZ + 1.05);
      box(.6, .7, .1, 0x2b3145, DX, .85, DZ + 1.34);
      // кровать слева
      furn(2.0, .42, 3.1, 0x33415e, -RW / 2 + 1.35, .21, -RD / 2 + 1.9);
      box(1.9, .16, 2.9, 0x8aa0c8, -RW / 2 + 1.35, .5, -RD / 2 + 1.9);
      box(1.5, .14, .5, 0xe6ecf7, -RW / 2 + 1.35, .6, -RD / 2 + .75);
      // диван у входа
      furn(2.6, .5, .95, 0x503a63, -1.6, .25, RD / 2 - .8);
      box(2.6, .8, .22, 0x503a63, -1.6, .65, RD / 2 - .38);
      box(.24, .62, .95, 0x5b4370, -2.85, .55, RD / 2 - .8);
      box(.24, .62, .95, 0x5b4370, -.35, .55, RD / 2 - .8);
      // журнальный столик + ковёр
      furn(1.1, .34, .7, 0x3a2a1c, -1.6, .17, RD / 2 - 2.1);
      const rug = new THREE.Mesh(new THREE.CircleGeometry(1.5, 28), new THREE.MeshLambertMaterial({ color: 0x6d3b4f }));
      rug.rotation.x = -Math.PI / 2; rug.position.set(-1.4, .012, RD / 2 - 2.1); scene.add(rug);
      // полка с книгами
      furn(.4, 1.9, 2.4, 0x4a3524, -RW / 2 + .35, .95, 1.2);
      for (let i = 0; i < 14; i++) {
        const bh = .26 + Math.random() * .1;
        box(.22, bh, .12, new THREE.Color().setHSL(Math.random(), .5, .45).getHex(), -RW / 2 + .38, .55 + Math.floor(i / 5) * .62 + bh / 2, .35 + (i % 5) * .42);
      }
      // торшер и растение
      furn(.34, .06, .34, 0x22262f, -2.6, .03, 2.4);
      box(.05, 1.5, .05, 0x22262f, -2.6, .78, 2.4);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(.34, .42, 18, 1, true), new THREE.MeshLambertMaterial({ color: 0xffd9a0, side: THREE.DoubleSide }));
      shade.position.set(-2.6, 1.62, 2.4); scene.add(shade);
      furn(.4, .5, .4, 0x7a4a2c, RW / 2 - .8, .25, RD / 2 - .8);
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(.42, 1.1, 8), new THREE.MeshLambertMaterial({ color: 0x2f7a44 }));
      leaf.position.set(RW / 2 - .8, 1.0, RD / 2 - .8); scene.add(leaf);
      // дверь
      box(.1, 2.05, .95, 0x2a2f3d, -RW / 2 + .06, 1.02, -2.2);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 10), new THREE.MeshStandardMaterial({ color: 0xd8b45a, metalness: .8, roughness: .3 }));
      knob.position.set(-RW / 2 + .14, 1.0, -1.85); scene.add(knob);

      /* ------------------------------------------------- игрок */
      const P = { x: -.4, z: 1.15, yaw: 2.4, pitch: -.05, bob: 0 };
      const keys = {};
      let drag = false, lx = 0, ly = 0, fading = false;

      const onKey = (e) => {
        const k = e.key.toLowerCase();
        if (e.type === 'keydown') {
          if (['w', 'a', 's', 'd', 'ц', 'ф', 'ы', 'в', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
          if (k === 'escape') return exit();
          if (k === 'e' || k === 'у') return interact();
        }
        const v = e.type === 'keydown';
        if (k === 'w' || k === 'ц' || k === 'arrowup') keys.up = v;
        if (k === 's' || k === 'ы' || k === 'arrowdown') keys.down = v;
        if (k === 'a' || k === 'ф' || k === 'arrowleft') keys.left = v;
        if (k === 'd' || k === 'в' || k === 'arrowright') keys.right = v;
      };
      document.addEventListener('keydown', onKey);
      document.addEventListener('keyup', onKey);
      const cv = renderer.domElement;
      cv.addEventListener('pointerdown', (e) => { drag = true; lx = e.clientX; ly = e.clientY; });
      cv.addEventListener('pointermove', (e) => {
        if (!drag) return;
        P.yaw -= (e.clientX - lx) * .0042;
        P.pitch = OS.clamp(P.pitch - (e.clientY - ly) * .0026, -.7, .7);
        lx = e.clientX; ly = e.clientY;
      });
      addEventListener('pointerup', () => { drag = false; });
      wrap.querySelector('.apt-exit').onclick = () => exit();

      function nearPC() { return Math.hypot(P.x - DX, P.z - (DZ + 1.0)) < 1.9; }
      function interact() {
        if (fading) return;
        if (!nearPC()) { OS.toast('Здесь ничего нет', 'Подойдите к столу с компьютером', { icon: 'info', timeout: 2200 }); return; }
        fading = true;
        screenMat.color.setHex(0x8b5cf6);
        led.material.color.setHex(0x22d3ee);
        OS.sfx.play('boot');
        hint.classList.add('hidden');
        const f = OS.el('div', { style: { position: 'absolute', inset: '0', background: '#fff', opacity: '0', transition: 'opacity .9s', zIndex: 5 } });
        wrap.append(f);
        setTimeout(() => { f.style.opacity = '1'; }, 60);
        setTimeout(() => location.reload(), 1150);
      }
      function exit() {
        if (fading) return;
        cleanup();
        onExit && onExit();
      }
      function cleanup() {
        Apt.active = false;
        document.removeEventListener('keydown', onKey);
        document.removeEventListener('keyup', onKey);
        cancelAnimationFrame(raf);
        removeEventListener('resize', onRs);
        wrap.remove();
        renderer.dispose();
      }
      function onRs() {
        renderer.setSize(innerWidth, innerHeight, false);
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
      }
      addEventListener('resize', onRs);

      let raf = 0, last = performance.now();
      const step = (t) => {
        raf = requestAnimationFrame(step);
        const dt = Math.min(60, t - last); last = t;
        const sp = 2.4 * dt / 1000;
        const rot = 2.2 * dt / 1000;
        if (keys.left) P.yaw += rot;
        if (keys.right) P.yaw -= rot;
        let fx = 0, fz = 0;
        const dx0 = Math.sin(P.yaw), dz0 = Math.cos(P.yaw);
        if (keys.up) { fx += dx0; fz += dz0; }
        if (keys.down) { fx -= dx0; fz -= dz0; }
        const len = Math.hypot(fx, fz);
        if (len && !fading) {
          fx = fx / len * sp; fz = fz / len * sp;
          let nx = P.x + fx, nz = P.z + fz;
          // стены
          nx = OS.clamp(nx, -RW / 2 + .4, RW / 2 - .4);
          nz = OS.clamp(nz, -RD / 2 + .4, RD / 2 - .4);
          // мебель (по осям раздельно)
          const hit = (x, z) => collide.some((c) => Math.abs(x - c.x) < c.hw && Math.abs(z - c.z) < c.hd);
          if (!hit(nx, P.z)) P.x = nx;
          if (!hit(P.x, nz)) P.z = nz;
          P.bob += dt * .008;
        }
        camera.position.set(P.x, 1.62 + Math.sin(P.bob) * .028, P.z);
        camera.rotation.y = -P.yaw + Math.PI;
        camera.rotation.x = P.pitch;
        hint.classList.toggle('hidden', !nearPC() || fading);
        led.material.color.setHex(Math.sin(t * .004) > 0 ? 0x22c55e : 0x14532d);
        renderer.render(scene, camera);
      };
      raf = requestAnimationFrame(step);
      OS.sfx.play('open');
    }
  };

  OS.apartment = Apt;
})(window.OS);
