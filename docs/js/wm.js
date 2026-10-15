/* ==========================================================================
   QwenOS 3.0 — wm.js
   Оконный менеджер: создание, перетаскивание, ресайз, снаппинг, фокус, z-index
   ========================================================================== */
(function (OS) {
  'use strict';

  const clamp = OS.clamp;
  const MAX_WIN = 22;
  let zTop = 100;
  let counter = 0;

  const WM = {
    windows: [],
    active: null,
    layer: null,

    init() { this.layer = OS.$('#windows'); },

    /* ------------------------------------------------------------ открытие */
    open(appId, params) {
      const app = OS.Apps.get(appId);
      if (!app) { OS.toast('Ошибка', 'Приложение «' + appId + '» не найдено', { icon: 'x', color: 'linear-gradient(135deg,#ef4444,#f97316)' }); return null; }
      if (!OS.Apps.installed(appId)) { OS.Apps.install(appId); }

      if (app.singleton) {
        const ex = this.windows.find((w) => w.appId === appId);
        if (ex) { this.restore(ex); this.focus(ex); if (app.onReuse) app.onReuse(ex, params); return ex; }
      }
      if (this.windows.length >= MAX_WIN) {
        OS.toast('Слишком много окон', 'Закройте одно из окон (' + MAX_WIN + ' макс.)', { icon: 'layers' });
        return null;
      }

      const id = 'w' + (++counter) + '_' + appId;
      const host = OS.$('#desktop').parentElement;
      const area = this.layer.getBoundingClientRect();
      const mob = innerWidth < 720;

      let w = Math.min(app.width || 760, Math.max(240, area.width - 24));
      let h = Math.min(app.height || 480, Math.max(180, area.height - 24));
      if (mob) { w = area.width - 8; h = area.height - 8; }

      const off = (this.windows.length % 7) * 26;
      let x = Math.round((area.width - w) / 2 + off - 78);
      let y = Math.round((area.height - h) / 2 + off - 60);
      // никогда не выпускаем окно за пределы рабочей области
      x = clamp(x, 4, Math.max(4, area.width - w - 4));
      y = clamp(y, 4, Math.max(4, area.height - h - 4));
      if (mob) { x = 4; y = 4; }

      const root = OS.el('div', { class: 'win', id: id, role: 'dialog', 'aria-label': app.name });
      root.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;z-index:' + (++zTop);
      if (mob) root.classList.add('max');

      root.innerHTML =
        '<div class="win-tb">' +
          '<div class="win-ico" style="' + OS.Apps.tileStyle(app) + '">' + OS.svg(app.icon, 12) + '</div>' +
          '<div class="win-title">' + OS.esc(app.name) + '</div>' +
          '<div class="win-btns">' +
            '<button data-act="min" title="Свернуть" aria-label="Свернуть">' + OS.svg('minimize', 12) + '</button>' +
            '<button data-act="max" title="Развернуть" aria-label="Развернуть">' + OS.svg('maximize', 12) + '</button>' +
            '<button data-act="close" class="close" title="Закрыть" aria-label="Закрыть">' + OS.svg('x', 12) + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="win-body"></div>' +
        (app.resizable === false ? '' : ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map((d) => '<div class="rz" data-d="' + d + '"></div>').join(''));

      const win = {
        id: id, appId: appId, app: app, root: root,
        titleEl: root.querySelector('.win-title'),
        body: root.querySelector('.win-body'),
        tb: root.querySelector('.win-tb'),
        minimized: false, maximized: !!mob, prevRect: null, data: {}, params: params || {},
        openedAt: Date.now(), z: zTop,
        setTitle(t) { this.title = t; this.titleEl.textContent = t; OS.bus.emit('wm:change', this); },
        setIcon(name) { root.querySelector('.win-ico').innerHTML = OS.svg(name || app.icon, 12); },
        focus() { WM.focus(this); },
        minimize() { WM.minimize(this); },
        toggleMax() { WM.toggleMax(this); },
        close() { WM.close(this); },
        rect() { const r = root.getBoundingClientRect(); const a = WM.layer.getBoundingClientRect(); return { x: r.left - a.left, y: r.top - a.top, w: r.width, h: r.height }; }
      };
      win.title = app.name;

      this.windows.push(win);
      this.layer.append(root);

      /* кнопки заголовка */
      root.querySelectorAll('.win-btns button').forEach((b) => {
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          const a = b.dataset.act;
          if (a === 'min') this.minimize(win);
          else if (a === 'max') this.toggleMax(win);
          else this.close(win);
        });
      });
      root.addEventListener('pointerdown', () => this.focus(win), true);
      this.tbDrag(win);
      this.resizeDrag(win);
      win.tb.addEventListener('dblclick', (e) => { if (!e.target.closest('button')) this.toggleMax(win); });

      /* монтирование приложения */
      try {
        const api = this.makeApi(win);
        const cleanup = app.mount ? app.mount(win, api) : null;
        win._cleanup = typeof cleanup === 'function' ? cleanup : null;
      } catch (err) {
        console.error('[wm] mount failed for ' + appId, err);
        win.body.innerHTML = '<div style="padding:24px;font-family:var(--font-mono);font-size:13px">' +
          '<b style="color:var(--err)">Сбой запуска приложения «' + OS.esc(app.name) + '»</b><br><br>' +
          OS.esc(String(err && err.message || err)) + '</div>';
      }

      this.focus(win);
      OS.sfx.play('open');
      OS.bus.emit('wm:open', win);
      OS.bus.emit('wm:change', win);
      return win;
    },

    makeApi(win) {
      return {
        win: win,
        open: (id, p) => WM.open(id, p),
        notify: OS.toast,
        fs: OS.fs,
        settings: OS.settings,
        bus: OS.bus,
        wm: WM,
        sfx: OS.sfx,
        params: win.params,
        close: () => WM.close(win)
      };
    },

    /* ------------------------------------------------------------- фокус */
    focus(win) {
      if (!win || !win.root.isConnected) return;
      if (win.minimized) this.restore(win);
      this.windows.forEach((w) => {
        if (w === win) { w.root.classList.add('focused'); w.root.classList.remove('blurred'); }
        else { w.root.classList.remove('focused'); w.root.classList.add('blurred'); }
      });
      win.root.style.zIndex = ++zTop;
      win.z = zTop;
      if (this.active !== win) { this.active = win; OS.bus.emit('wm:focus', win); }
      OS.bus.emit('wm:change', win);
    },

    /* --------------------------------------------------------- сворачивание */
    minimize(win) {
      if (win.minimized) return;
      win.minimized = true;
      win.root.classList.add('minimizing');
      setTimeout(() => { win.root.style.display = 'none'; win.root.classList.remove('minimizing'); }, OS.settings.get('motion') ? 210 : 0);
      if (this.active === win) {
        const next = this.windows.filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0];
        this.active = next || null;
        if (next) this.focus(next); else OS.bus.emit('wm:focus', null);
      }
      OS.sfx.play('close');
      OS.bus.emit('wm:change', win);
    },
    restore(win) {
      if (!win.minimized) return;
      win.minimized = false;
      win.root.style.display = '';
      win.root.classList.add('restoring');
      setTimeout(() => win.root.classList.remove('restoring'), 220);
      OS.bus.emit('wm:change', win);
    },

    /* --------------------------------------------------------- максимизация */
    toggleMax(win) {
      const area = this.layer.getBoundingClientRect();
      if (!win.maximized) {
        win.prevRect = { left: win.root.style.left, top: win.root.style.top, width: win.root.style.width, height: win.root.style.height };
        win.maximized = true;
        win.root.classList.add('max');
        win.root.style.cssText += ';left:0;top:0;width:' + area.width + 'px;height:' + area.height + 'px';
        win.root.querySelector('[data-act="max"]').innerHTML = OS.svg('restore', 12);
      } else {
        win.maximized = false;
        win.root.classList.remove('max');
        const p = win.prevRect || { left: '40px', top: '40px', width: '760px', height: '480px' };
        Object.assign(win.root.style, p);
        win.root.querySelector('[data-act="max"]').innerHTML = OS.svg('maximize', 12);
      }
      win.root.dispatchEvent(new Event('wm:resize'));
      OS.bus.emit('wm:resize', win);
      OS.bus.emit('wm:change', win);
    },

    snap(win, zone) {
      const a = this.layer.getBoundingClientRect();
      if (!win.maximized) win.prevRect = { left: win.root.style.left, top: win.root.style.top, width: win.root.style.width, height: win.root.style.height };
      win.maximized = zone === 'max';
      win.root.classList.toggle('max', zone === 'max');
      const geo = {
        left: zone === 'left' ? 0 : zone === 'right' ? a.width / 2 : 0,
        top: 0,
        width: zone === 'max' ? a.width : a.width / 2,
        height: a.height
      };
      Object.assign(win.root.style, { left: geo.left + 'px', top: geo.top + 'px', width: geo.width + 'px', height: geo.height + 'px' });
      win.root.querySelector('[data-act="max"]').innerHTML = OS.svg(zone === 'max' ? 'restore' : 'maximize', 12);
      win.root.dispatchEvent(new Event('wm:resize'));
      OS.bus.emit('wm:resize', win);
      OS.bus.emit('wm:change', win);
    },

    /* -------------------------------------------------------------- закрытие */
    close(win) {
      if (!win || win._closed) return;
      win._closed = true;
      try { if (win._cleanup) win._cleanup(); } catch (e) { console.warn('[wm] cleanup', e); }
      const fin = () => {
        win.root.remove();
        this.windows = this.windows.filter((w) => w !== win);
        if (this.active === win) {
          const next = this.windows.filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0];
          this.active = next || null;
          if (next) { next.root.classList.add('focused'); next.root.classList.remove('blurred'); }
          OS.bus.emit('wm:focus', this.active);
        }
        OS.bus.emit('wm:close', win);
        OS.bus.emit('wm:change', win);
      };
      if (OS.settings.get('motion')) { win.root.classList.add('closing'); setTimeout(fin, 170); } else fin();
      OS.sfx.play('close');
    },
    closeApp(appId) { this.windows.filter((w) => w.appId === appId).forEach((w) => this.close(w)); },
    closeAll() { this.windows.slice().forEach((w) => this.close(w)); },
    minimizeAll() { this.windows.forEach((w) => this.minimize(w)); },
    byApp(appId) { return this.windows.filter((w) => w.appId === appId); },
    get(id) { return this.windows.find((w) => w.id === id); },

    /* ------------------------------------------------- перетаскивание окон */
    tbDrag(win) {
      const tb = win.tb;
      let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false, hint = null, zone = null, pid = null, pending = null;
      const area = () => this.layer.getBoundingClientRect();

      const onDown = (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        if (e.target.closest('button')) return;
        dragging = true; pid = e.pointerId;
        const a = area(); const r = win.root.getBoundingClientRect();
        sx = e.clientX; sy = e.clientY; ox = r.left - a.left; oy = r.top - a.top;
        // развернутое окно «отлипает» только после реального движения,
        // иначе двойной клик (свернуть/развернуть) не сработает
        pending = win.maximized ? { ratio: (e.clientX - r.left) / Math.max(1, r.width) } : null;
        if (!pending) win.root.classList.add('dragging');
        this.focus(win);
        try { tb.setPointerCapture(pid); } catch (err) { /* noop */ }
        e.preventDefault();
      };
      const onMove = (e) => {
        if (!dragging) return;
        const a = area();
        if (pending) {
          if (Math.hypot(e.clientX - sx, e.clientY - sy) < 5) return;
          const ratio = pending.ratio; pending = null;
          win.maximized = false; win.root.classList.remove('max');
          const w = Math.min(win.app.width || 760, a.width - 24), h = Math.min(win.app.height || 480, a.height - 24);
          Object.assign(win.root.style, { width: w + 'px', height: h + 'px', left: '0px', top: '0px' });
          ox = clamp(e.clientX - a.left - w * ratio, 0, Math.max(0, a.width - w));
          oy = clamp(e.clientY - a.top - 18, 0, Math.max(0, a.height - 40));
          sx = e.clientX; sy = e.clientY;
          win.root.classList.add('dragging');
          win.root.querySelector('[data-act="max"]').innerHTML = OS.svg('maximize', 12);
          win.root.dispatchEvent(new Event('wm:resize'));
          OS.bus.emit('wm:resize', win);
        }
        let nx = ox + (e.clientX - sx), ny = oy + (e.clientY - sy);
        nx = clamp(nx, -win.root.offsetWidth + 90, a.width - 90);
        ny = clamp(ny, 0, Math.max(0, a.height - 40));
        win.root.style.left = nx + 'px'; win.root.style.top = ny + 'px';

        // зоны снаппинга
        const edge = 26;
        let z = null;
        if (e.clientY - a.top <= edge) z = 'max';
        else if (e.clientX - a.left <= edge) z = 'left';
        else if (a.right - e.clientX <= edge) z = 'right';
        if (z !== zone) {
          zone = z;
          if (hint) { hint.remove(); hint = null; }
          if (z && innerWidth >= 720) {
            hint = OS.el('div', { class: 'snap-hint' });
            Object.assign(hint.style, {
              left: (z === 'right' ? a.width / 2 : 0) + 'px', top: '0px',
              width: (z === 'max' ? a.width : a.width / 2) + 'px', height: a.height + 'px'
            });
            this.layer.append(hint);
          }
        }
      };
      const onUp = () => {
        if (!dragging) return;
        dragging = false; pending = null;
        win.root.classList.remove('dragging');
        if (hint) { hint.remove(); hint = null; }
        if (zone) { this.snap(win, zone); zone = null; }
        try { tb.releasePointerCapture(pid); } catch (err) { /* noop */ }
      };
      tb.addEventListener('pointerdown', onDown);
      tb.addEventListener('pointermove', onMove);
      tb.addEventListener('pointerup', onUp);
      tb.addEventListener('pointercancel', onUp);
    },

    /* ------------------------------------------------------- ресайз окон */
    resizeDrag(win) {
      const handles = win.root.querySelectorAll('.rz');
      handles.forEach((hz) => {
        let sx = 0, sy = 0, geo = null, active = false, pid = null;
        const dir = hz.dataset.d;
        hz.addEventListener('pointerdown', (e) => {
          if (win.maximized) return;
          e.preventDefault(); e.stopPropagation();
          active = true; pid = e.pointerId;
          sx = e.clientX; sy = e.clientY;
          const r = win.root.getBoundingClientRect(); const a = this.layer.getBoundingClientRect();
          geo = { x: r.left - a.left, y: r.top - a.top, w: r.width, h: r.height };
          win.root.classList.add('resizing');
          this.focus(win);
          try { hz.setPointerCapture(pid); } catch (err) { /* noop */ }
        });
        hz.addEventListener('pointermove', (e) => {
          if (!active) return;
          const dx = e.clientX - sx, dy = e.clientY - sy;
          const minW = win.app.minWidth || 300, minH = win.app.minHeight || 180;
          const a = this.layer.getBoundingClientRect();
          let { x, y, w, h } = geo;
          if (dir.includes('e')) w = clamp(geo.w + dx, minW, a.width - geo.x);
          if (dir.includes('s')) h = clamp(geo.h + dy, minH, a.height - geo.y);
          if (dir.includes('w')) { const nw = clamp(geo.w - dx, minW, geo.x + geo.w); x = geo.x + geo.w - nw; w = nw; }
          if (dir.includes('n')) { const nh = clamp(geo.h - dy, minH, geo.y + geo.h); y = geo.y + geo.h - nh; h = nh; }
          Object.assign(win.root.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
        });
        const end = () => {
          if (!active) return;
          active = false; win.root.classList.remove('resizing');
          win.root.dispatchEvent(new Event('wm:resize'));
          OS.bus.emit('wm:resize', win);
          try { hz.releasePointerCapture(pid); } catch (err) { /* noop */ }
        };
        hz.addEventListener('pointerup', end);
        hz.addEventListener('pointercancel', end);
      });
    },

    /* ------------------------------------------------------ Alt+Tab цикл */
    cycle(dir) {
      const list = this.windows.filter((w) => !w._closed);
      if (!list.length) return null;
      list.sort((a, b) => b.z - a.z);
      const i = list.indexOf(this.active);
      const next = list[(i + (dir < 0 ? 1 : list.length - 1)) % list.length];
      this.restore(next); this.focus(next);
      return next;
    },

    /* --------------------------------------------- открытие файлов из ФС */
    openPath(path) {
      const fs = OS.fs;
      if (!fs.exists(path)) { OS.toast('Файл не найден', path, { icon: 'x' }); return; }
      if (fs.isDir(path)) return this.open('files', { path: path });
      const ext = fs.ext(path);
      if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return this.open('photos', { path: path });
      if (['mp3', 'wav', 'ogg'].includes(ext)) return this.open('music', { path: path });
      return this.open('notes', { path: path });
    }
  };

  OS.wm = WM;
})(window.OS);
