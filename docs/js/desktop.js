/* ==========================================================================
   QwenOS 3.0 — desktop.js
   Обои, иконки рабочего стола, виджеты, контекстные меню, обзор окон
   ========================================================================== */
(function (OS) {
  'use strict';
  const fs = OS.fs, S = OS.settings;

  /* =============================== глобальное контекстное меню ============ */
  const Menu = {
    el: null,
    show(x, y, items) {
      this.close();
      const m = OS.$('#ctx-menu');
      m.innerHTML = '';
      m.setAttribute('role', 'menu');
      items.forEach((it) => {
        if (!it) return;
        if (it.sep) { m.append(OS.el('div', { class: 'ctx-sep' })); return; }
        if (it.head) { m.append(OS.el('div', { class: 'ctx-head' }, it.head)); return; }
        const b = OS.el('button', { class: 'ctx-item' + (it.danger ? ' danger' : ''), role: 'menuitem' });
        if (it.disabled) b.disabled = true;
        b.innerHTML = OS.svg(it.icon || 'right', 15) + '<span>' + OS.esc(it.label) + '</span>' + (it.key ? '<span class="k">' + OS.esc(it.key) + '</span>' : '');
        b.addEventListener('click', () => { this.close(); if (!it.disabled && it.onClick) it.onClick(); });
        m.append(b);
      });
      m.classList.remove('hidden');
      m.style.animation = 'none';
      void m.offsetWidth;
      m.style.animation = '';
      const r = m.getBoundingClientRect();
      const px = Math.min(x, innerWidth - r.width - 8);
      const py = Math.min(y, innerHeight - r.height - 8);
      m.style.left = Math.max(4, px) + 'px';
      m.style.top = Math.max(4, py) + 'px';
      this.el = m;
      OS.sfx.play('click');
      setTimeout(() => {
        const off = (e) => { if (!m.contains(e.target)) { this.close(); document.removeEventListener('pointerdown', off); } };
        document.addEventListener('pointerdown', off);
      }, 0);
      return m;
    },
    close() { if (this.el) { this.el.classList.add('hidden'); this.el.innerHTML = ''; this.el = null; } }
  };
  OS.menu = (x, y, items) => Menu.show(x, y, items);
  OS.menuClose = () => Menu.close();

  /* ============================================== рабочий стол ============ */
  const Desktop = {
    iconsEl: null, wallEl: null, fxEls: null, widgetsEl: null,
    selected: new Set(),

    init() {
      this.iconsEl = OS.$('#desktop-icons');
      this.wallEl = OS.$('#wallpaper');
      this.fxEls = OS.$('#wallpaper-fx');
      this.widgetsEl = OS.$('#widgets');
      this.applyWallpaper();
      this.renderIcons();
      this.renderWidgets();
      this.bindDesktop();
      // единый тикер виджетов (переживает перерисовку)
      setInterval(() => {
        if (this._wClockUpd) this._wClockUpd();
      }, 1000);
      setInterval(() => {
        if (this._wSysUpd) this._wSysUpd();
      }, 1200);
      OS.bus.on('settings', () => { this.applyWallpaper(); this.renderWidgets(); });
      OS.bus.on('wallpaper', () => this.applyWallpaper());
      OS.bus.on('apps:changed', () => this.renderIcons());
      OS.bus.on('fs:changed', () => this.renderWidgets());
      OS.bus.on('user:changed', () => { this.renderIcons(); });
      return this;
    },

    renderAll() { this.renderIcons(); this.renderWidgets(); this.applyWallpaper(); },

    /* ---------------------------------------------------------- обои */
    applyWallpaper() {
      const custom = OS.store.get('wall.custom', null);
      const wp = OS.wallpapers.find((w) => w.id === S.get('wallpaper')) || OS.wallpapers[0];
      if (custom && !S.get('wallpaperReset')) {
        this.wallEl.style.background = '';
        this.wallEl.style.backgroundImage = 'url(' + custom + ')';
        this.wallEl.style.backgroundSize = 'cover';
        this.wallEl.style.backgroundPosition = 'center';
      } else {
        this.wallEl.style.backgroundImage = '';
        this.wallEl.style.background = wp.css;
      }
      document.documentElement.style.setProperty('--lock-wp', wp.css);
      // эффекты
      this.fxEls.innerHTML = '';
      if (!S.get('wallpaperFx')) { this.fxEls.innerHTML = '<div class="grain"></div>'; return; }
      const fx = custom ? 'none' : wp.fx;
      if (fx === 'blobs' || fx === 'none') {
        const cs = getComputedStyle(document.documentElement);
        const a = (cs.getPropertyValue('--accent') || '#8b5cf6').trim();
        const b = (cs.getPropertyValue('--accent-2') || '#06b6d4').trim();
        [[a, '12%', '10%', '46vmax', '0s'], [b, '62%', '52%', '40vmax', '-8s'], [a, '35%', '78%', '34vmax', '-15s']].forEach((c) => {
          const d = OS.el('div', { class: 'blob' });
          d.style.cssText = 'left:' + c[1] + ';top:' + c[2] + ';width:' + c[3] + ';height:' + c[3] + ';background:' + c[0] + ';animation-delay:' + c[4];
          if (fx === 'none') d.style.opacity = '.22';
          this.fxEls.append(d);
        });
      }
      if (fx === 'stars') {
        const s = OS.el('div', { class: 'stars' });
        for (let i = 0; i < 90; i++) {
          const st = OS.el('i');
          st.style.cssText = 'left:' + (Math.random() * 100) + '%;top:' + (Math.random() * 100) + '%;animation-delay:' + (Math.random() * 4) + 's;opacity:' + (.2 + Math.random() * .7) + ';transform:scale(' + (.6 + Math.random()) + ')';
          s.append(st);
        }
        this.fxEls.append(s);
      }
      if (fx === 'grid') {
        const g = OS.el('div');
        g.style.cssText = 'position:absolute;inset:0;background-image:linear-gradient(rgba(140,160,255,.14) 1px,transparent 1px),linear-gradient(90deg,rgba(140,160,255,.14) 1px,transparent 1px);background-size:44px 44px;mask-image:radial-gradient(circle at 50% 120%,#000,transparent 72%);-webkit-mask-image:radial-gradient(circle at 50% 120%,#000,transparent 72%)';
        this.fxEls.append(g);
      }
      this.fxEls.append(OS.el('div', { class: 'grain' }));
    },

    /* --------------------------------------------------------- иконки */
    renderIcons() {
      if (!this.iconsEl) return;
      this.iconsEl.innerHTML = '';
      this.iconsEl.style.display = S.get('desktopIcons') ? '' : 'none';
      if (!S.get('desktopIcons')) return;

      const apps = OS.Apps.list().filter((a) => a.desktop !== false && OS.Apps.installed(a.id));
      apps.forEach((a) => {
        const d = OS.el('div', { class: 'dicon', tabindex: '0', 'data-app': a.id, title: a.name });
        d.innerHTML = '<div class="dicon-ico" style="' + OS.Apps.tileStyle(a) + '">' + OS.svg(a.icon, 25) + '</div><div class="dicon-label">' + OS.esc(a.name) + '</div>';
        this.wireIcon(d, { kind: 'app', id: a.id, name: a.name });
        this.iconsEl.append(d);
      });

      // файлы из папки «Рабочий стол»
      const desk = fs.home() + '/Desktop';
      if (fs.isDir(desk)) {
        fs.list(desk).forEach((it) => {
          const d = OS.el('div', { class: 'dicon', tabindex: '0', 'data-file': it.path, title: it.name });
          const isDir = it.type === 'dir';
          const grad = isDir ? 'linear-gradient(135deg,#fbbf24,#d97706)' : 'linear-gradient(135deg,#94a3b8,#475569)';
          d.innerHTML = '<div class="dicon-ico" style="background:' + grad + '">' + OS.svg(isDir ? 'folder' : (/^(png|jpe?g|gif|svg|webp)$/i.test(it.ext) ? 'image' : 'file'), 25) + '</div><div class="dicon-label">' + OS.esc(it.name) + '</div>';
          this.wireIcon(d, { kind: 'file', path: it.path, name: it.name });
          this.iconsEl.append(d);
        });
      }
    },

    wireIcon(node, target) {
      let lastClick = 0;
      const openIt = () => {
        if (target.kind === 'app') OS.wm.open(target.id);
        else OS.wm.openPath(target.path);
      };
      node.addEventListener('pointerdown', (e) => {
        if (e.button === 2) return;
        if (!e.ctrlKey && !e.metaKey) this.clearSel();
        node.classList.add('sel');
        this.selected.add(node);
      });
      node.addEventListener('click', (e) => {
        e.stopPropagation();
        const now = Date.now();
        if (now - lastClick < 420) { openIt(); lastClick = 0; } else lastClick = now;
      });
      node.addEventListener('dblclick', (e) => { e.stopPropagation(); openIt(); });
      node.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') openIt();
        if (e.key === 'F2' && target.kind === 'file') this.renameFile(target.path, node);
      });
      node.addEventListener('contextmenu', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (!node.classList.contains('sel')) { this.clearSel(); node.classList.add('sel'); this.selected.add(node); }
        this.iconMenu(e.clientX, e.clientY, target, node);
      });
    },

    iconMenu(x, y, target, node) {
      const items = [{ head: target.name }];
      if (target.kind === 'app') {
        const pinned = (S.get('pinned') || []).includes(target.id);
        items.push(
          { label: 'Открыть', icon: 'ext', onClick: () => OS.wm.open(target.id) },
          { label: pinned ? 'Убрать из панели задач' : 'Закрепить в панели задач', icon: 'pin', onClick: () => {
            let p = S.get('pinned') || [];
            p = pinned ? p.filter((z) => z !== target.id) : p.concat(target.id);
            S.set('pinned', p); OS.bus.emit('taskbar:render');
          } },
          { sep: true },
          { label: 'О приложении', icon: 'info', onClick: () => {
            const a = OS.Apps.get(target.id);
            OS.wm.open('dialog', { title: a.name, icon: a.icon, rows: [['Название', a.name], ['ID', a.id], ['Категория', a.category], ['Размер окна', a.width + '×' + a.height], ['Статус', OS.Apps.installed(a.id) ? 'установлено' : 'в магазине']] });
          } }
        );
      } else {
        items.push(
          { label: 'Открыть', icon: 'ext', onClick: () => OS.wm.openPath(target.path) },
          { label: 'Переименовать', icon: 'pencil', key: 'F2', onClick: () => this.renameFile(target.path, node) },
          { label: 'Показать в «Файлах»', icon: 'folder', onClick: () => OS.wm.open('files', { path: fs.dirname(target.path) }) },
          { sep: true },
          { label: 'Удалить', icon: 'trash', danger: true, key: 'Del', onClick: () => {
            if (!confirm('Удалить «' + target.name + '»?')) return;
            fs.rm(target.path, true); OS.bus.emit('fs:changed'); this.renderIcons();
          } }
        );
      }
      OS.menu(x, y, items);
    },

    renameFile(path, node) {
      const name = prompt('Новое имя:', fs.basename(path));
      if (!name) return;
      const r = fs.rename(path, name.trim());
      if (!r.ok) OS.toast('Ошибка', r.error, { icon: 'x' });
      OS.bus.emit('fs:changed');
      this.renderIcons();
    },

    clearSel() { this.selected.forEach((n) => n.classList.remove('sel')); this.selected.clear(); },

    /* --------------------------------------------------- область стола */
    bindDesktop() {
      const desk = OS.$('#desktop');
      const marquee = OS.$('#marquee');

      desk.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.dicon') || e.target.closest('.widget') || e.button === 2) return;
        OS.menuClose();
        this.clearSel();
        // рамка выделения
        const start = { x: e.clientX, y: e.clientY };
        let active = false;
        const move = (ev) => {
          const x = Math.min(start.x, ev.clientX), y = Math.min(start.y, ev.clientY);
          const w = Math.abs(ev.clientX - start.x), h = Math.abs(ev.clientY - start.y);
          if (!active && (w > 6 || h > 6)) { active = true; marquee.classList.remove('hidden'); }
          if (!active) return;
          Object.assign(marquee.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
          const r = { l: x, t: y, r: x + w, b: y + h };
          OS.$$('.dicon', this.iconsEl).forEach((ic) => {
            const b = ic.getBoundingClientRect();
            const hit = !(b.right < r.l || b.left > r.r || b.bottom < r.t || b.top > r.b);
            ic.classList.toggle('sel', hit);
            if (hit) this.selected.add(ic); else this.selected.delete(ic);
          });
        };
        const up = () => {
          marquee.classList.add('hidden');
          document.removeEventListener('pointermove', move);
          document.removeEventListener('pointerup', up);
        };
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
      });

      desk.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.dicon')) return;
        e.preventDefault();
        this.desktopMenu(e.clientX, e.clientY);
      });
      desk.addEventListener('dblclick', (e) => { if (!e.target.closest('.dicon,.widget')) OS.menuClose(); });
    },

    desktopMenu(x, y) {
      OS.menu(x, y, [
        { label: 'Обновить', icon: 'refresh', onClick: () => { this.renderAll(); OS.toast('Рабочий стол обновлён', '', { icon: 'refresh', timeout: 1400 }); } },
        { label: 'Новая папка', icon: 'folder', onClick: () => {
          const name = prompt('Имя папки на рабочем столе:', 'Новая папка');
          if (!name) return;
          const r = fs.mkdir(fs.join(fs.home() + '/Desktop', name.trim()), true);
          if (!r.ok) OS.toast('Ошибка', r.error, { icon: 'x' });
          OS.bus.emit('fs:changed'); this.renderIcons();
        } },
        { label: 'Новый файл', icon: 'file', onClick: () => {
          const name = prompt('Имя файла:', 'заметка.txt');
          if (!name) return;
          fs.write(fs.join(fs.home() + '/Desktop', name.trim()), '');
          OS.bus.emit('fs:changed'); this.renderIcons();
        } },
        { sep: true },
        { label: 'Открыть терминал', icon: 'terminal', key: 'Ctrl+Alt+T', onClick: () => OS.wm.open('terminal') },
        { label: 'Файлы', icon: 'folder', key: 'Ctrl+Alt+F', onClick: () => OS.wm.open('files') },
        { label: 'Настройки', icon: 'gear', onClick: () => OS.wm.open('settings') },
        { sep: true },
        { label: 'Сменить обои', icon: 'image', onClick: () => this.wallpaperMenu(x, y) },
        { label: 'Сменить тему', icon: 'palette', onClick: () => this.themeMenu(x, y) },
        { label: 'Показать все окна', icon: 'layout', key: 'Win+Tab', onClick: () => Overview.toggle() },
        { label: 'Свернуть все окна', icon: 'minimize', onClick: () => OS.wm.minimizeAll() },
        { sep: true },
        { label: 'Заблокировать', icon: 'lock', onClick: () => OS.power.lock() },
        { label: 'О системе', icon: 'info', onClick: () => OS.wm.open('settings', { section: 'about' }) }
      ]);
    },

    wallpaperMenu(x, y) {
      const items = [{ head: 'Обои' }].concat(OS.wallpapers.map((w) => ({
        label: w.name + (S.get('wallpaper') === w.id ? '  ✓' : ''), icon: 'image',
        onClick: () => { S.set('wallpaperReset', true); S.set('wallpaper', w.id); }
      })));
      items.push({ sep: true }, { label: 'Выбрать из «Фото»…', icon: 'brush', onClick: () => OS.wm.open('photos') });
      OS.menu(x, y, items);
    },

    themeMenu(x, y) {
      OS.menu(x, y, [{ head: 'Тема' }].concat(['dark', 'light', 'aurora', 'neon', 'mono'].map((t) => ({
        label: ({ dark: 'Тёмная', light: 'Светлая', aurora: 'Aurora', neon: 'Неон', mono: 'Графит' })[t] + (S.get('theme') === t ? '  ✓' : ''),
        icon: t === 'light' ? 'sun' : 'moon', onClick: () => S.set('theme', t)
      }))));
    },

    /* -------------------------------------------------------- виджеты */
    renderWidgets() {
      if (!this.widgetsEl) return;
      const list = S.get('widgets') || [];
      this.widgetsEl.innerHTML = '';
      this._wClockUpd = null; this._wSysUpd = null;
      if (list.includes('clock')) {
        const w = OS.el('div', { class: 'widget widget-clock' });
        w.innerHTML = '<b>--:--</b><span></span>';
        this.widgetsEl.append(w);
        const upd = () => {
          const d = new Date();
          w.querySelector('b').textContent = S.get('clock24') ? OS.pad(d.getHours()) + ':' + OS.pad(d.getMinutes()) : ((d.getHours() % 12) || 12) + ':' + OS.pad(d.getMinutes());
          w.querySelector('span').textContent = OS.fmtDate(d);
        };
        upd();
        this._wClockUpd = upd;
        w.style.cursor = 'pointer';
        w.title = 'Календарь и часы';
      }
      if (list.includes('weather')) {
        const w = OS.el('div', { class: 'widget widget-wx' });
        this.widgetsEl.append(w);
        const city = OS.store.get('wx.city', 'Москва');
        let h = 0; for (let i = 0; i < city.length; i++) h = (h * 31 + city.charCodeAt(i)) >>> 0;
        const r = (n) => { h = (h * 1103515245 + 12345) >>> 0; return (h >>> 8) % n; };
        const t = 5 + r(26), kinds = [['sun', 'Ясно'], ['cloud', 'Облачно'], ['download', 'Дождь'], ['zap', 'Гроза'], ['star', 'Снег']];
        const k = kinds[r(kinds.length)];
        w.innerHTML = '<div style="font-size:26px">' + OS.svg(k[0], 30) + '</div><div><div class="t">' + t + '°C</div><div class="c">' + k[1] + ' · ' + OS.esc(city) + '</div></div>';
        w.style.cursor = 'pointer';
        w.title = 'Открыть «Погоду»';
        w.onclick = () => { if (OS.Apps.installed('weather')) OS.wm.open('weather'); else OS.wm.open('store'); };
      }
      if (list.includes('system')) {
        const w = OS.el('div', { class: 'widget widget-sys' });
        w.innerHTML = '<div>ЦП <b class="ws-cpu">0%</b></div><div class="bar"><i class="ws-bar" style="width:0%"></i></div>' +
          '<div>Память <b class="ws-mem">—</b></div><div class="bar"><i class="ws-mbar" style="width:0%"></i></div>' +
          '<div>FPS <b class="ws-fps">60</b> · окон <b class="ws-win">0</b></div>';
        this.widgetsEl.append(w);
        const upd = () => {
          const cpu = Math.round(Math.min(99, OS.wm.windows.length * 7 + (60 - Math.min(60, OS.perf.fps)) * 1.3 + Math.random() * 7));
          const m = OS.memInfo();
          w.querySelector('.ws-cpu').textContent = cpu + '%';
          w.querySelector('.ws-bar').style.width = cpu + '%';
          w.querySelector('.ws-mem').textContent = OS.fmtBytes(m.used);
          w.querySelector('.ws-mbar').style.width = Math.min(100, m.used / m.total * 100).toFixed(0) + '%';
          w.querySelector('.ws-fps').textContent = OS.perf.fps;
          w.querySelector('.ws-win').textContent = OS.wm.windows.length;
        };
        upd();
        this._wSysUpd = upd;
        w.style.cursor = 'pointer';
        w.title = 'Открыть диспетчер задач';
        w.onclick = () => OS.wm.open('monitor');
      }
      if (!list.length) this.widgetsEl.innerHTML = '';
    }
  };
  OS.Desktop = Desktop;

  /* ============================================== обзор окон ============ */
  const Overview = {
    el: null,
    open() {
      if (this.el) return;
      const o = OS.$('#overview');
      o.innerHTML = '';
      const ws = OS.wm.windows.slice();
      if (!ws.length) {
        o.innerHTML = '<div class="ov-empty">' + OS.svg('layout', 44) + '<p>Открытых окон нет.<br><span class="dim">Запустите приложение из меню «Пуск» или с рабочего стола.</span></p></div>';
      } else {
        const grid = OS.el('div', { class: 'ov-grid' });
        ws.forEach((w) => {
          const card = OS.el('div', { class: 'ov-card' });
          const prev = OS.el('div', { class: 'ov-prev' });
          // миниатюра реального окна через клонирование
          try {
            const clone = w.root.cloneNode(true);
            clone.classList.remove('focused', 'minimizing', 'closing');
            clone.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;transform-origin:top left';
            const cw = w.root.offsetWidth, ch = w.root.offsetHeight;
            const sc = Math.min(prev.clientWidth || 230, 230) / Math.max(1, cw);
            clone.style.transform = 'scale(' + sc + ')';
            clone.style.width = cw + 'px'; clone.style.height = ch + 'px';
            const sc2 = OS.el('div', { class: 'sc' });
            sc2.append(clone);
            prev.append(sc2);
          } catch (e) {
            prev.innerHTML = '<div style="color:var(--text-dim);font-size:12px">предпросмотр недоступен</div>';
          }
          const meta = OS.el('div', { class: 'ov-meta' });
          meta.innerHTML = '<i class="ic" style="' + OS.Apps.tileStyle(w.app) + '">' + OS.svg(w.app.icon, 13) + '</i><b>' + OS.esc(w.title || w.app.name) + '</b>';
          card.append(prev, meta);
          card.onclick = () => { this.close(); OS.wm.restore(w); OS.wm.focus(w); };
          card.oncontextmenu = (e) => {
            e.preventDefault();
            OS.menu(e.clientX, e.clientY, [
              { head: w.title || w.app.name },
              { label: 'Показать', icon: 'eye', onClick: () => { this.close(); OS.wm.restore(w); OS.wm.focus(w); } },
              { label: 'Свернуть', icon: 'minimize', onClick: () => OS.wm.minimize(w) },
              { sep: true },
              { label: 'Закрыть окно', icon: 'x', danger: true, onClick: () => { OS.wm.close(w); this.close(); } }
            ]);
          };
          grid.append(card);
        });
        o.append(grid);
      }
      o.classList.remove('hidden');
      this.el = o;
      o.onclick = (e) => { if (e.target === o) this.close(); };
    },
    close() { if (this.el) { this.el.classList.add('hidden'); this.el.innerHTML = ''; this.el = null; } },
    toggle() { this.el ? this.close() : this.open(); }
  };
  OS.overview = Overview;
})(window.OS);
