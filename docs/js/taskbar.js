/* ==========================================================================
   QwenOS 3.0 — taskbar.js
   Панель задач, меню «Пуск», трей, быстрые настройки, часы
   ========================================================================== */
(function (OS) {
  'use strict';
  const S = OS.settings;

  const TB = {
    el: null, appsEl: null, clockEl: null, startEl: null, quickEl: null,
    brightness: 1, bat: { level: 0.86, charging: true },
    startOpen: false, quickOpen: false,

    init() {
      this.el = OS.$('#taskbar');
      this.appsEl = OS.$('#tb-apps');
      this.clockEl = OS.$('#tb-clock');
      this.startEl = OS.$('#start-menu');
      this.quickEl = OS.$('#quick-panel');

      // оверлей яркости
      const br = OS.el('div', { id: 'brightness-overlay' });
      br.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:9999;transition:opacity .18s';
      document.body.append(br);
      this.brEl = br;
      this.brightness = OS.store.get('brightness', 1);
      this.applyBrightness();

      this.bindStart();
      this.bindTray();
      this.bindClock();
      this.render();
      this.tickClock();
      setInterval(() => this.tickClock(), 1000);
      setInterval(() => this.readBattery(), 20000);
      this.readBattery();

      OS.bus.on('wm:change', () => this.renderApps());
      OS.bus.on('wm:open', () => this.renderApps());
      OS.bus.on('wm:close', () => this.renderApps());
      OS.bus.on('apps:changed', () => this.render());
      OS.bus.on('taskbar:render', () => this.render());
      OS.bus.on('settings', () => { this.render(); this.renderQuick(); });
      return this;
    },

    /* ------------------------------------------------------- часы и трей */
    tickClock() {
      const d = new Date();
      const t = S.get('clock24') ? OS.pad(d.getHours()) + ':' + OS.pad(d.getMinutes()) : ((d.getHours() % 12) || 12) + ':' + OS.pad(d.getMinutes());
      this.clockEl.innerHTML = '<b>' + t + '</b><span>' + OS.pad(d.getDate()) + '.' + OS.pad(d.getMonth() + 1) + '.' + d.getFullYear() + '</span>';
      const lt = OS.$('#lock-time'), ld = OS.$('#lock-date');
      if (lt) lt.textContent = OS.pad(d.getHours()) + ':' + OS.pad(d.getMinutes());
      if (ld) ld.textContent = OS.fmtDate(d);
    },
    readBattery() {
      const set = (l, c) => { this.bat.level = l; this.bat.charging = c; this.renderTray(); };
      if (navigator.getBattery) {
        navigator.getBattery().then((b) => {
          set(b.level, b.charging);
          b.addEventListener('levelchange', () => set(b.level, b.charging));
          b.addEventListener('chargingchange', () => set(b.level, b.charging));
        }).catch(() => set(this.bat.level, this.bat.charging));
      } else {
        // симуляция: медленный разряд
        const lvl = Math.max(.18, .86 - (OS.uptime() / 3600000) * .12);
        set(lvl, false);
      }
    },
    bindClock() {
      this.clockEl.onclick = (e) => { e.stopPropagation(); this.toggleQuick(); };
      this.clockEl.oncontextmenu = (e) => {
        e.preventDefault();
        OS.menu(e.clientX, e.clientY, [
          { head: OS.fmtDate() },
          { label: 'Формат ' + (S.get('clock24') ? '24 часа' : '12 часов'), icon: 'clock', onClick: () => S.set('clock24', !S.get('clock24')) },
          { label: 'Открыть «Таймер»', icon: 'target', onClick: () => { if (!OS.Apps.installed('timer')) OS.Apps.install('timer'); OS.wm.open('timer'); } },
          { sep: true },
          { label: 'Заблокировать экран', icon: 'lock', onClick: () => OS.power.lock() }
        ]);
      };
    },
    bindTray() {
      const net = OS.$('#tray-net'), vol = OS.$('#tray-vol'), bat = OS.$('#tray-bat'), th = OS.$('#tray-theme');
      [net, vol, bat].forEach((b) => { b.onclick = (e) => { e.stopPropagation(); this.toggleQuick(); }; });
      th.onclick = (e) => {
        e.stopPropagation();
        const order = ['dark', 'light', 'aurora', 'neon', 'mono'];
        const i = order.indexOf(S.get('theme'));
        const next = order[(i + 1) % order.length];
        S.set('theme', next);
        OS.toast('Тема изменена', ({ dark: 'Тёмная', light: 'Светлая', aurora: 'Aurora', neon: 'Неон', mono: 'Графит' })[next], { icon: 'palette', timeout: 1800 });
      };
      th.oncontextmenu = (e) => {
        e.preventDefault();
        OS.menu(e.clientX, e.clientY, [{ head: 'Тема' }].concat(['dark', 'light', 'aurora', 'neon', 'mono'].map((t) => ({
          label: ({ dark: 'Тёмная', light: 'Светлая', aurora: 'Aurora', neon: 'Неон', mono: 'Графит' })[t] + (S.get('theme') === t ? '  ✓' : ''),
          icon: t === 'light' ? 'sun' : 'moon', onClick: () => S.set('theme', t)
        }))));
      };
    },
    renderTray() {
      const net = OS.$('#tray-net'), vol = OS.$('#tray-vol'), bat = OS.$('#tray-bat');
      if (net) { net.innerHTML = OS.svg('wifi', 17); net.title = 'QwenNet · подключено'; }
      if (vol) {
        const m = S.get('muted') || S.get('volume') === 0;
        vol.innerHTML = OS.svg(m ? 'volumeOff' : 'volume', 17);
        vol.title = m ? 'Звук выключен' : 'Громкость ' + Math.round(S.get('volume') * 100) + '%';
      }
      if (bat) {
        const p = Math.round(this.bat.level * 100);
        bat.innerHTML = '<span style="position:relative;display:grid;place-items:center">' + OS.svg('battery', 17) +
          '<b style="position:absolute;font:600 7.5px system-ui;color:var(--text);transform:translateY(-.5px)">' + (p > 22 ? p : '') + '</b></span>';
        bat.title = 'Заряд ' + p + '%' + (this.bat.charging ? ' · от сети' : '');
      }
    },

    /* ------------------------------------------------------- приложения */
    render() { this.renderApps(); this.renderTray(); },

    renderApps() {
      if (!this.appsEl) return;
      const pinned = (S.get('pinned') || []).filter((id) => OS.Apps.get(id) && OS.Apps.installed(id));
      const running = {};
      OS.wm.windows.forEach((w) => { (running[w.appId] = running[w.appId] || []).push(w); });
      const ids = pinned.slice();
      Object.keys(running).forEach((id) => { if (!ids.includes(id)) ids.push(id); });

      const activeId = OS.wm.active && !OS.wm.active.minimized ? OS.wm.active.appId : null;
      this.appsEl.innerHTML = '';
      ids.forEach((id) => {
        const app = OS.Apps.get(id);
        const wins = running[id] || [];
        const b = OS.el('button', {
          class: 'tb-app' + (wins.length ? ' running' : '') + (activeId === id ? ' active' : '') +
            (wins.length && wins.every((w) => w.minimized) ? ' min' : ''),
          title: app.name + (wins.length ? ' — ' + wins.length + ' окн.' : ' — закрепить/запустить')
        });
        b.innerHTML = '<i class="ic" style="' + OS.Apps.tileStyle(app) + '">' + OS.svg(app.icon, 15) + '</i>' +
          '<span class="nm">' + OS.esc(app.name) + '</span>' +
          (wins.length > 1 ? '<span class="cnt">' + wins.length + '</span>' : '');
        b.onclick = (e) => {
          e.stopPropagation();
          if (!wins.length) return OS.wm.open(id);
          const act = OS.wm.active;
          if (wins.length === 1) {
            const w = wins[0];
            if (act === w && !w.minimized) OS.wm.minimize(w);
            else { OS.wm.restore(w); OS.wm.focus(w); }
          } else {
            // показываем мини-меню окон приложения
            const r = b.getBoundingClientRect();
            OS.menu(r.left, r.top - 8 - wins.length * 38, [
              { head: app.name + ' — ' + wins.length + ' окон' }
            ].concat(wins.map((w) => ({
              label: (w.title || app.name).slice(0, 34), icon: w.minimized ? 'eye' : 'layout',
              onClick: () => { OS.wm.restore(w); OS.wm.focus(w); }
            }))).concat([
              { sep: true },
              { label: 'Новое окно', icon: 'plus', onClick: () => OS.wm.open(id) },
              { label: 'Закрыть все', icon: 'x', danger: true, onClick: () => OS.wm.closeApp(id) }
            ]));
          }
        };
        b.oncontextmenu = (e) => {
          e.preventDefault(); e.stopPropagation();
          const isPinned = pinned.includes(id);
          OS.menu(e.clientX, e.clientY, [
            { head: app.name },
            { label: 'Открыть', icon: 'ext', onClick: () => OS.wm.open(id) },
            { label: isPinned ? 'Убрать из панели задач' : 'Закрепить в панели задач', icon: 'pin', onClick: () => {
              let p = S.get('pinned') || [];
              p = isPinned ? p.filter((x) => x !== id) : p.concat(id);
              S.set('pinned', p);
            } },
            wins.length ? { label: 'Закрыть все окна (' + wins.length + ')', icon: 'x', danger: true, onClick: () => OS.wm.closeApp(id) } : null,
            { sep: true },
            { label: 'Настройки приложения', icon: 'gear', onClick: () => OS.wm.open('settings', { section: 'desktop' }) }
          ]);
        };
        this.appsEl.append(b);
      });
    },

    /* ------------------------------------------------------------- «Пуск» */
    bindStart() {
      const btn = OS.$('#start-btn');
      btn.onclick = (e) => { e.stopPropagation(); this.toggleStart(); };
      OS.$('#tb-search').onclick = (e) => { e.stopPropagation(); this.toggleStart(true); };
      document.addEventListener('pointerdown', (e) => {
        if (!this.startOpen && !this.quickOpen) return;
        if (e.target.closest('#start-menu, #start-btn, #tb-search')) return;
        if (this.startOpen) this.closeStart();
        if (e.target.closest('#quick-panel, .tb-tray')) return;
        if (this.quickOpen) this.closeQuick();
      });
    },

    toggleStart(focusSearch) {
      this.closeQuick();
      if (this.startOpen) return this.closeStart();
      this.openStart();
      if (focusSearch) setTimeout(() => { const i = this.startEl.querySelector('input'); if (i) i.focus(); }, 60);
    },
    openStart() {
      this.renderStart('');
      this.startEl.classList.remove('hidden', 'out');
      this.startOpen = true;
      OS.$('#start-btn').classList.add('on');
      OS.sfx.play('open');
    },
    closeStart() {
      if (!this.startOpen) return;
      this.startEl.classList.add('out');
      this.startOpen = false;
      OS.$('#start-btn').classList.remove('on');
      setTimeout(() => { if (!this.startOpen) { this.startEl.classList.add('hidden'); this.startEl.classList.remove('out'); } }, 160);
    },

    renderStart(query) {
      const user = S.get('user') || 'user';
      const av = S.get('avatarText') || user[0].toUpperCase();
      const results = OS.Apps.search(query).filter((a) => OS.Apps.installed(a.id) || !a.storeOnly);
      const cats = new Map();
      results.forEach((a) => { if (!cats.has(a.category)) cats.set(a.category, []); cats.get(a.category).push(a); });

      const recent = (OS.store.get('recent', []) || []).map((id) => OS.Apps.get(id)).filter((a) => a && OS.Apps.installed(a.id)).slice(0, 6);

      this.startEl.innerHTML =
        '<div class="sm-head"><div class="sm-search">' + OS.svg('search', 16) + '<input placeholder="Поиск приложений и команд…" spellcheck="false" value="' + OS.esc(query) + '"></div></div>' +
        '<div class="sm-body">' +
          (query ? '' : (recent.length ? '<div class="sm-title">Недавние</div><div class="sm-list">' + recent.map((a) =>
            '<button class="sm-item" data-app="' + a.id + '"><i class="ic" style="' + OS.Apps.tileStyle(a) + '">' + OS.svg(a.icon, 16) + '</i><span class="tx"><b>' + OS.esc(a.name) + '</b><span>' + OS.esc(a.category) + '</span></span>' + OS.svg('right', 14) + '</button>').join('') + '</div>' : '')) +
          (results.length ? Array.from(cats.entries()).map((g) =>
            '<div class="sm-title">' + OS.esc(query ? 'Результаты: ' + g[0] : g[0]) + '</div><div class="sm-grid">' +
            g[1].map((a) => '<button class="sm-app" data-app="' + a.id + '" title="' + OS.esc(a.name) + '"><i class="ic" style="' + OS.Apps.tileStyle(a) + '">' + OS.svg(a.icon, 21) + '</i><span class="nm">' + OS.esc(a.name) + '</span></button>').join('') +
            '</div>').join('') : '<div class="sm-empty">' + OS.svg('search', 30) + '<p>Ничего не найдено по «' + OS.esc(query) + '»</p></div>') +
        '</div>' +
        '<div class="sm-foot">' +
          '<button class="sm-user" data-a="user"><i class="av">' + OS.esc(av) + '</i><span class="un">' + OS.esc(user) + '</span></button>' +
          '<button class="sm-pow" data-a="store" title="QwenStore">' + OS.svg('bag', 17) + '</button>' +
          '<button class="sm-pow" data-a="settings" title="Настройки">' + OS.svg('gear', 17) + '</button>' +
          '<button class="sm-pow" data-a="lock" title="Заблокировать">' + OS.svg('lock', 17) + '</button>' +
          '<button class="sm-pow" data-a="power" title="Питание">' + OS.svg('power', 17) + '</button>' +
        '</div>';

      const inp = this.startEl.querySelector('input');
      inp.oninput = OS.debounce(() => {
        const v = inp.value;
        this.renderStart(v);
        const n = this.startEl.querySelector('input');
        n.focus(); n.setSelectionRange(v.length, v.length);
      }, 130);
      inp.onkeydown = (e) => {
        if (e.key === 'Enter') {
          const first = this.startEl.querySelector('[data-app]');
          if (first) { this.launch(first.dataset.app); }
          else if (inp.value.trim()) { this.launch('browser', { url: 'qwen://search?q=' + encodeURIComponent(inp.value.trim()) }); }
        }
        if (e.key === 'Escape') this.closeStart();
      };
      this.startEl.onclick = (e) => {
        const app = e.target.closest('[data-app]');
        if (app) return this.launch(app.dataset.app);
        const a = e.target.closest('[data-a]');
        if (!a) return;
        const act = a.dataset.a;
        if (act === 'user') { this.closeStart(); OS.wm.open('settings', { section: 'account' }); }
        else if (act === 'settings') { this.closeStart(); OS.wm.open('settings'); }
        else if (act === 'store') { this.closeStart(); OS.wm.open('store'); }
        else if (act === 'lock') { this.closeStart(); OS.power.lock(); }
        else if (act === 'power') { this.closeStart(); this.powerMenu(a); }
      };
    },

    powerMenu(anchor) {
      const r = anchor.getBoundingClientRect();
      OS.menu(r.left - 150, r.top - 150, [
        { head: 'Питание' },
        { label: 'Заблокировать', icon: 'lock', onClick: () => OS.power.lock() },
        { label: 'Перезагрузка', icon: 'refresh', onClick: () => OS.power.reboot() },
        { label: 'Выключить', icon: 'power', danger: true, onClick: () => OS.power.shutdown() },
        { sep: true },
        { label: 'Свернуть все окна', icon: 'minimize', onClick: () => OS.wm.minimizeAll() },
        { label: 'Закрыть все окна', icon: 'x', onClick: () => OS.wm.closeAll() }
      ]);
    },

    launch(id, params) {
      this.closeStart();
      const rec = (OS.store.get('recent', []) || []).filter((x) => x !== id);
      rec.unshift(id);
      OS.store.set('recent', rec.slice(0, 12));
      OS.wm.open(id, params);
    },

    /* ------------------------------------------------ быстрые настройки */
    toggleQuick() { this.closeStart(); this.quickOpen ? this.closeQuick() : this.openQuick(); },
    openQuick() { this.renderQuick(); this.quickEl.classList.remove('hidden'); this.quickOpen = true; },
    closeQuick() { if (!this.quickOpen) return; this.quickEl.classList.add('hidden'); this.quickOpen = false; },

    renderQuick() {
      const tiles = [
        { id: 'wifi', name: 'QwenNet', icon: 'wifi', on: true, hint: 'Локальная сеть' },
        { id: 'sound', name: 'Звук', icon: S.get('muted') ? 'volumeOff' : 'volume', on: S.get('sound') && !S.get('muted') },
        { id: 'motion', name: 'Анимации', icon: 'zap', on: S.get('motion') },
        { id: 'fx', name: 'Эффекты обоев', icon: 'palette', on: S.get('wallpaperFx') },
        { id: 'icons', name: 'Иконки стола', icon: 'grid', on: S.get('desktopIcons') },
        { id: 'dnd', name: 'Не беспокоить', icon: 'bell', on: !!S.get('dnd') }
      ];
      this.quickEl.innerHTML =
        '<div class="qp-grid">' + tiles.map((t) =>
          '<button class="qp-tile' + (t.on ? ' on' : '') + '" data-q="' + t.id + '" title="' + OS.esc(t.hint || t.name) + '">' + OS.svg(t.icon, 18) + '<span>' + t.name + '</span></button>').join('') + '</div>' +
        '<div class="qp-slider">' + OS.svg('sun', 17) + '<input type="range" min="35" max="100" value="' + Math.round(this.brightness * 100) + '" data-s="bright"></div>' +
        '<div class="qp-slider">' + OS.svg(S.get('muted') ? 'volumeOff' : 'volume', 17) + '<input type="range" min="0" max="100" value="' + Math.round((S.get('muted') ? 0 : S.get('volume')) * 100) + '" data-s="vol"></div>' +
        '<div class="qp-foot"><span>' + OS.svg('battery', 13) + ' ' + Math.round(this.bat.level * 100) + '%' + (this.bat.charging ? ' · зарядка' : '') + '</span>' +
        '<span class="row" style="gap:6px"><button class="btn btn-sm btn-ghost" data-a="theme">Тема</button><button class="btn btn-sm" data-a="settings">Все настройки</button></span></div>';

      this.quickEl.onclick = (e) => {
        const t = e.target.closest('[data-q]');
        if (t) {
          const id = t.dataset.q;
          if (id === 'wifi') { OS.toast('QwenNet', 'Локальная сеть всегда активна — внешний доступ отключён политикой песочницы', { icon: 'wifi' }); return; }
          if (id === 'sound') { S.set('sound', !S.get('sound')); if (S.get('sound')) { S.set('muted', false); OS.sfx.play('ok'); } }
          else if (id === 'motion') S.set('motion', !S.get('motion'));
          else if (id === 'fx') S.set('wallpaperFx', !S.get('wallpaperFx'));
          else if (id === 'icons') S.set('desktopIcons', !S.get('desktopIcons'));
          else if (id === 'dnd') { S.set('dnd', !S.get('dnd')); OS.toast(S.get('dnd') ? 'Режим «Не беспокоить» включён' : 'Уведомления снова видны', '', { icon: 'bell' }); }
          this.renderQuick(); this.renderTray();
          return;
        }
        const a = e.target.closest('[data-a]');
        if (a) {
          if (a.dataset.a === 'settings') { this.closeQuick(); OS.wm.open('settings'); }
          else if (a.dataset.a === 'theme') {
            const r = this.quickEl.getBoundingClientRect();
            OS.Desktop.themeMenu(r.left, r.top - 8);
          }
        }
      };
      this.quickEl.oninput = (e) => {
        const r = e.target.closest('[data-s]'); if (!r) return;
        const v = parseInt(r.value, 10);
        if (r.dataset.s === 'bright') { this.brightness = v / 100; OS.store.set('brightness', this.brightness); this.applyBrightness(); }
        else { S.set('volume', v / 100, true); S.set('muted', v === 0, true); if (OS.audio) OS.audio.setVolume(v / 100); this.renderTray(); OS.bus.emit('volume', v / 100); }
      };
    },
    applyBrightness() { this.brEl.style.opacity = String(Math.max(0, Math.min(.72, 1 - this.brightness))); },
    closeAll() { this.closeStart(); this.closeQuick(); OS.menuClose(); }
  };

  OS.taskbar = TB;
})(window.OS);
