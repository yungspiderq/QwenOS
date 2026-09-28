/* ================= WebOS — ядро и оболочка ================= */
const OS = (() => {
  const $ = s => document.querySelector(s);
  let zIndex = 100;
  const windows = new Map(); // id -> win object
  let focusedWin = null;
  let soundOn = localStorage.getItem('webos_sound') === '1';

  /* ---------- Звук ---------- */
  function beep(freq = 660, dur = 0.12) {
    if (!soundOn) return;
    try {
      const ac = beep.ac || (beep.ac = new (window.AudioContext || window.webkitAudioContext)());
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = freq; o.type = 'sine';
      g.gain.setValueAtTime(0.08, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
      o.connect(g).connect(ac.destination);
      o.start(); o.stop(ac.currentTime + dur);
    } catch(e){}
  }
  function setSound(on) { soundOn = on; localStorage.setItem('webos_sound', on ? '1' : '0'); if (on) beep(); }

  /* ---------- Уведомления ---------- */
  function notify(title, text, timeout = 4500) {
    const n = document.createElement('div');
    n.className = 'notification';
    n.innerHTML = `<b>${title}</b>${text}`;
    $('#notifications').appendChild(n);
    beep(880, 0.09);
    setTimeout(() => { n.classList.add('out'); setTimeout(() => n.remove(), 350); }, timeout);
  }

  /* ---------- Оконный менеджер ---------- */
  let winCounter = 0;
  function createWindow(appId, def, params) {
    const id = ++winCounter;
    const el = document.createElement('div');
    el.className = 'window';
    el.style.width = (def.width || 500) + 'px';
    el.style.height = (def.height || 380) + 'px';
    el.style.zIndex = ++zIndex;
    // каскадное размещение
    const offset = (id % 8) * 28;
    const maxLeft = Math.max(20, window.innerWidth - (def.width||500) - 20);
    const maxTop = Math.max(20, window.innerHeight - (def.height||380) - 80);
    el.style.left = Math.min(60 + offset, maxLeft) + 'px';
    el.style.top = Math.min(50 + offset, maxTop) + 'px';

    el.innerHTML = `
      <div class="win-titlebar">
        <div class="win-title"><span class="wt-icon">${def.icon}</span><span class="wt-text">${def.name}</span></div>
        <div class="win-controls">
          <button class="btn-min" title="Свернуть">—</button>
          <button class="btn-max" title="Развернуть">▢</button>
          <button class="btn-close" title="Закрыть">✕</button>
        </div>
      </div>
      <div class="win-body"></div>
      ${def.resizable === false ? '' : '<div class="resizer"></div>'}`;
    $('#windows').appendChild(el);

    const win = {
      id, appId, el, body: el.querySelector('.win-body'), titleEl: el.querySelector('.wt-text'),
      def, minimized: false, maximized: false, restore: null, shortcuts: null, onClose: null, params
    };
    windows.set(id, win);
    focusWindow(win);

    /* Запуск приложения */
    try { def.open(win, params || {}); }
    catch (e) { win.body.innerHTML = `<div class="app-pad">Ошибка запуска приложения: ${e.message}</div>`; }

    /* Управление окном */
    el.addEventListener('pointerdown', () => focusWindow(win), true);
    el.querySelector('.btn-close').onclick = (e) => { e.stopPropagation(); closeWindow(win); };
    el.querySelector('.btn-min').onclick = (e) => { e.stopPropagation(); minimizeWindow(win); };
    el.querySelector('.btn-max').onclick = (e) => { e.stopPropagation(); toggleMaximize(win); };
    el.querySelector('.win-titlebar').addEventListener('dblclick', () => toggleMaximize(win));

    /* Перетаскивание */
    const bar = el.querySelector('.win-titlebar');
    bar.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.win-controls') || win.maximized) return;
      const startX = e.clientX, startY = e.clientY;
      const ox = el.offsetLeft, oy = el.offsetTop;
      const move = ev => {
        el.style.left = Math.max(-el.offsetWidth + 120, Math.min(window.innerWidth - 40, ox + ev.clientX - startX)) + 'px';
        el.style.top = Math.max(0, Math.min(window.innerHeight - 70, oy + ev.clientY - startY)) + 'px';
      };
      const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    });

    /* Ресайз */
    const rz = el.querySelector('.resizer');
    if (rz) rz.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const startX = e.clientX, startY = e.clientY;
      const ow = el.offsetWidth, oh = el.offsetHeight;
      const move = ev => {
        el.style.width = Math.max(320, ow + ev.clientX - startX) + 'px';
        el.style.height = Math.max(200, oh + ev.clientY - startY) + 'px';
      };
      const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    });

    addTaskbarItem(win);
    return win;
  }

  function focusWindow(win) {
    if (!win) return;
    document.querySelectorAll('.window').forEach(w => w.classList.remove('focused'));
    win.el.classList.add('focused');
    win.el.style.zIndex = ++zIndex;
    focusedWin = win;
    updateTaskbarActive();
  }

  function minimizeWindow(win) {
    win.minimized = true;
    win.el.classList.add('minimized');
    updateTaskbarActive();
  }

  function toggleMaximize(win) {
    if (!win.maximized) {
      win.restore = { l: win.el.style.left, t: win.el.style.top, w: win.el.style.width, h: win.el.style.height };
      win.el.style.left = '0'; win.el.style.top = '0';
      win.el.style.width = '100%';
      win.el.style.height = 'calc(100% - 52px)';
      win.maximized = true;
      win.el.querySelector('.btn-max').textContent = '❐';
    } else {
      Object.assign(win.el.style, { left: win.restore.l, top: win.restore.t, width: win.restore.w, height: win.restore.h });
      win.maximized = false;
      win.el.querySelector('.btn-max').textContent = '▢';
    }
  }

  function closeWindow(win) {
    win.el.classList.add('closing');
    setTimeout(() => {
      try { if (win.onClose) win.onClose(); } catch(e){}
      win.el.remove();
      windows.delete(win.id);
      removeTaskbarItem(win.id);
      if (focusedWin === win) focusedWin = null;
    }, 150);
  }

  function openApp(appId, params) {
    const def = Apps[appId];
    if (!def) { notify('QwenOS', 'Приложение не найдено: ' + appId); return; }
    hideStartMenu();
    createWindow(appId, def, params);
  }

  /* ---------- Панель задач ---------- */
  function addTaskbarItem(win) {
    const btn = document.createElement('button');
    btn.className = 'tb-item';
    btn.dataset.win = win.id;
    btn.title = win.def.name;
    btn.innerHTML = `<span>${win.def.icon}</span><span class="tb-label">${win.def.name}</span>`;
    btn.onclick = () => {
      if (win.minimized) { win.minimized = false; win.el.classList.remove('minimized'); focusWindow(win); }
      else if (focusedWin === win && win.el.classList.contains('focused')) minimizeWindow(win);
      else focusWindow(win);
      updateTaskbarActive();
    };
    $('#taskbar-items').appendChild(btn);
  }
  function removeTaskbarItem(id) {
    const b = document.querySelector(`.tb-item[data-win="${id}"]`);
    if (b) b.remove();
    updateTaskbarActive();
  }
  function updateTaskbarActive() {
    document.querySelectorAll('.tb-item').forEach(b => {
      const w = windows.get(+b.dataset.win);
      b.classList.toggle('active', !!w && !w.minimized && focusedWin === w);
    });
  }

  /* ---------- Меню Пуск ---------- */
  function renderStartMenu(filter = '') {
    const box = $('#start-apps');
    box.innerHTML = '';
    const list = Object.entries(Apps)
      .filter(([_, a]) => a.name.toLowerCase().includes(filter.toLowerCase()))
      .sort((a,b) => a[1].name.localeCompare(b[1].name));
    for (const [id, a] of list) {
      const d = document.createElement('div');
      d.className = 'start-app';
      d.innerHTML = `<div class="sa-icon">${a.icon}</div><div class="sa-name">${a.name}</div>`;
      d.onclick = () => openApp(id);
      box.appendChild(d);
    }
    if (!list.length) box.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#99a;padding:20px">Ничего не найдено</div>';
  }
  function toggleStartMenu() {
    const m = $('#start-menu');
    const open = m.classList.toggle('hidden');
    $('#start-btn').classList.toggle('active', !open);
    if (!open) { renderStartMenu(); $('#start-search').value=''; setTimeout(()=>$('#start-search').focus(), 30); }
    hideContextMenu();
  }
  function hideStartMenu() { $('#start-menu').classList.add('hidden'); $('#start-btn').classList.remove('active'); }

  /* ---------- Контекстное меню ---------- */
  function contextMenu(x, y, items) {
    const m = $('#context-menu');
    m.innerHTML = '';
    for (const it of items) {
      if (it.sep) { const s = document.createElement('div'); s.className='ctx-sep'; m.appendChild(s); continue; }
      const d = document.createElement('div');
      d.className = 'ctx-item';
      d.innerHTML = `<span>${it.label}</span>${it.sub ? `<span class="ctx-sub">${it.sub}</span>`:''}`;
      d.onclick = () => { hideContextMenu(); it.fn && it.fn(); };
      m.appendChild(d);
    }
    m.classList.remove('hidden');
    m.style.left = Math.min(x, window.innerWidth - m.offsetWidth - 10) + 'px';
    m.style.top = Math.min(y, window.innerHeight - m.offsetHeight - 10) + 'px';
  }
  function hideContextMenu() { $('#context-menu').classList.add('hidden'); }

  function desktopContextMenu(e) {
    contextMenu(e.clientX, e.clientY, [
      { label: '🔄 Обновить', fn: () => location.reload() },
      { label: '📁 Открыть проводник', fn: () => openApp('explorer') },
      { label: '💻 Открыть терминал', fn: () => openApp('terminal') },
      { sep: true },
      { label: '🖼 Сменить обои', sub: '▸', fn: () => openApp('settings') },
      { label: '⚙️ Настройки', fn: () => openApp('settings') },
      { sep: true },
      { label: 'ℹ️ О системе', fn: () => openApp('about') },
    ]);
  }

  /* ---------- Обои / виджет ---------- */
  function setWallpaper(wp) {
    const w = $('#wallpaper');
    w.className = wp;
    localStorage.setItem('webos_wp', wp);
  }
  function setWidget(on) {
    localStorage.setItem('webos_widget', on ? '1' : '0');
    const ex = document.getElementById('desk-widget');
    if (on && !ex) buildWidget();
    if (!on && ex) ex.remove();
  }
  const quotes = [
    '«Любой код лучше его отсутствия.»',
    '«Простота — высшая форма изощрённости.»',
    '«Sudo make me a sandwich.»',
    '«В браузере тоже можно жить.»',
    '«HTML — это тоже операционная система... почти.»',
  ];
  function buildWidget() {
    if (document.getElementById('desk-widget')) return;
    const d = document.createElement('div');
    d.className = 'widget'; d.id = 'desk-widget';
    d.innerHTML = `<div class="w-time"></div><div class="w-date"></div><div class="w-quote">${quotes[Math.floor(Math.random()*quotes.length)]}</div>`;
    $('#desktop').insertBefore(d, $('#taskbar'));
    const upd = () => {
      if (!document.body.contains(d)) return clearInterval(iv);
      const now = new Date();
      d.querySelector('.w-time').textContent = now.toLocaleTimeString('ru-RU');
      d.querySelector('.w-date').textContent = now.toLocaleDateString('ru-RU', {weekday:'long', day:'numeric', month:'long'});
    };
    upd(); const iv = setInterval(upd, 1000);
  }

  /* ---------- Иконки рабочего стола ---------- */
  const desktopIcons = ['explorer', 'notepad', 'terminal', 'browser', 'music', 'weather', 'notes', 'timer', 'arcade', 'shop', 'doom', 'store', 'paint', 'calc', 'mines', 'snake', 'settings', 'trash'];
  function buildDesktopIcons() {
    const box = $('#icons');
    box.innerHTML = '';
    for (const id of desktopIcons) {
      const a = Apps[id];
      if (!a) continue;
      const d = document.createElement('div');
      d.className = 'desktop-icon';
      d.tabIndex = 0;
      d.innerHTML = `<div class="icon-img">${a.icon}</div><div class="icon-label">${a.name}</div>`;
      d.onclick = () => { document.querySelectorAll('.desktop-icon.selected').forEach(x=>x.classList.remove('selected')); d.classList.add('selected'); };
      d.ondblclick = () => openApp(id);
      box.appendChild(d);
    }
  }

  /* ---------- Кошелёк в трее ---------- */
  function addMoneyWidget() {
    if (document.getElementById('tray-money')) return;
    const tray = $('#tray');
    const span = document.createElement('span');
    span.id = 'tray-money'; span.className = 'money-hud'; span.title = 'Баланс Steam-монет — кликни, чтобы открыть Steam';
    span.style.cursor = 'pointer';
    span.onclick = () => openApp('shop');
    tray.insertBefore(span, tray.firstChild);
    if (window.Money && document.getElementById("tray-money")) Money.renderHUD();
  }

  /* ---------- Часы ---------- */
  function tickClock() {
    const now = new Date();
    $('#taskbar-time').textContent = now.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
    $('#taskbar-date').textContent = now.toLocaleDateString('ru-RU');
    const lt = $('#login-time'), ld = $('#login-date');
    if (lt) { lt.textContent = now.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
              ld.textContent = now.toLocaleDateString('ru-RU', {weekday:'long', day:'numeric', month:'long'}); }
    if (window.Money && document.getElementById("tray-money")) Money.renderHUD();
  }

  /* ---------- Батарея ---------- */
  function initBattery() {
    if (!navigator.getBattery) return;
    navigator.getBattery().then(b => {
      const upd = () => {
        const el = $('#tray-battery');
        el.textContent = (b.charging ? '⚡' : '🔋') + ' ' + Math.round(b.level * 100) + '%';
      };
      upd();
      b.addEventListener('levelchange', upd);
      b.addEventListener('chargingchange', upd);
    }).catch(()=>{});
  }

  /* ---------- Завершение работы ---------- */
  function shutdown() {
    fsSave();
    hideStartMenu();
    $('#desktop').classList.add('hidden');
    const scr = $('#shutdown-screen');
    const txt = $('#shutdown-text');
    const back = $('#shutdown-back');
    if (!scr) return;
    scr.classList.remove('hidden');
    back.classList.add('hidden');
    txt.textContent = 'Завершение работы...';
    setTimeout(() => {
      txt.textContent = 'Питание отключено';
      back.classList.remove('hidden');
    }, 1800);
  }

  /* ---------- BSOD ---------- */
  function bsod() {
    $('#bsod').classList.remove('hidden');
  }

  /* ---------- Экран блокировки ---------- */
  function lock() {
    hideStartMenu();
    $('#desktop').classList.add('hidden');
    $('#login-screen').classList.remove('hidden');
    $('#login-input').value = '';
  }

  /* ---------- Загрузка ---------- */
  function boot() {
    fsLoad();
    tickClock();
    setInterval(tickClock, 1000);

    // прогресс загрузки
    let p = 0;
    const iv = setInterval(() => {
      p += 12 + Math.random() * 16;
      $('#boot-bar').style.width = Math.min(p, 100) + '%';
      if (p >= 100) {
        clearInterval(iv);
        setTimeout(() => {
          $('#boot-screen').classList.add('hidden');
          $('#login-screen').classList.remove('hidden');
          $('#login-input').focus();
        }, 350);
      }
    }, 180);

    // вход
    const doLogin = () => {
      $('#login-screen').classList.add('hidden');
      $('#desktop').classList.remove('hidden');
      setWallpaper(localStorage.getItem('webos_wp') || 'wp1');
      if (window.Skins) Skins.apply(Skins.current()); // восстановить скин из Магазина
      addMoneyWidget();
      buildDesktopIcons();
      if (localStorage.getItem('webos_widget') !== '0') buildWidget();
      initBattery();
            setTimeout(() => notify('QwenOS 2.1 Aurora', `Добро пожаловать! 🎆 Новинки: Steam 🎮 (игры за 🪙), DOOM 👹, Аркада, Музыка, Погода. Зарабатывай монеты в «💼 Заработать»!`, 7000), 600);
    };
    $('#login-btn').onclick = doLogin;
    $('#login-input').onkeydown = e => { if (e.key === 'Enter') doLogin(); };

    // панель задач / пуск
    $('#start-btn').onclick = toggleStartMenu;
    $('#start-search').oninput = e => renderStartMenu(e.target.value);
    $('#btn-lock').onclick = lock;
    $('#btn-restart').onclick = () => location.reload();
    const btnShut = $('#btn-shutdown');
    if (btnShut) btnShut.onclick = shutdown;
    const shutBack = $('#shutdown-back');
    if (shutBack) shutBack.onclick = () => { $('#shutdown-screen').classList.add('hidden'); $('#desktop').classList.remove('hidden'); };
    $('#bsod-ok').onclick = () => { $('#bsod').classList.add('hidden'); notify('Система', 'BSOD пережит успешно 😄'); };
    $('#tray-volume').onclick = () => { setSound(!soundOn); $('#tray-volume').textContent = soundOn ? '🔊' : '🔇'; notify('Звук', soundOn ? 'Звуки включены' : 'Звуки отключены'); };

    // контекстные меню
    $('#desktop').addEventListener('contextmenu', e => {
      if (e.target.closest('.window') || e.target.closest('#taskbar')) return;
      e.preventDefault();
      desktopContextMenu(e);
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('#context-menu')) hideContextMenu();
      if (!e.target.closest('#start-menu') && !e.target.closest('#start-btn')) hideStartMenu();
      if (!e.target.closest('.desktop-icon')) document.querySelectorAll('.desktop-icon.selected').forEach(x=>x.classList.remove('selected'));
    });

    // клавиатура
    document.addEventListener('keydown', e => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 't') { e.preventDefault(); openApp('terminal'); }
      if (e.key === 'Escape') { hideStartMenu(); hideContextMenu(); }
      if (focusedWin && focusedWin.shortcuts && document.activeElement.tagName !== 'TEXTAREA' && document.activeElement.tagName !== 'INPUT') {
        focusedWin.shortcuts(e);
      }
    });

    // закрытие последнего окна через Alt+F4-подобное поведение невозможно в браузере — но предупредим при уходе
    window.addEventListener('beforeunload', fsSave);

    // PWA: офлайн-режим
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(()=>{}));
    }
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', boot)
    : boot();

  // ---- темы оформления (тёмная/светлая) ----
  function setTheme(t) {
    document.body.classList.toggle('light', t === 'light');
    localStorage.setItem('webos_theme', t);
    const tt = $('#tray-theme'); if (tt) tt.textContent = t === 'light' ? '☀️' : '🌙';
  }
  function getTheme() { return localStorage.getItem('webos_theme') || 'dark'; }

  // применяем тему сразу (не дожидаясь boot)
  if (getTheme() === 'light') document.body.classList.add('light');
  { const tt = $('#tray-theme'); if (tt) tt.textContent = getTheme() === 'light' ? '☀️' : '🌙'; }

  // переключатель темы в трее
  document.addEventListener('click', e => {
    if (e.target.closest('#tray-theme')) {
      setTheme(getTheme() === 'dark' ? 'light' : 'dark');
      notify('Оформление', getTheme() === 'light' ? 'Светлая тема ☀️' : 'Тёмная тема 🌙');
    }
  });

  return { openApp, notify, contextMenu, bsod, lock, setWallpaper, setWidget, setSound, setTheme, getTheme, get soundOn(){return soundOn;}, windows };
})();
