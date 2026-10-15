/* ==========================================================================
   QwenOS 3.0 — boot.js
   Последовательность загрузки, экран входа, питание, горячие клавиши, PWA
   ========================================================================== */
(function (OS) {
  'use strict';
  const S = OS.settings;

  /* ============================================== питание / блокировка ==== */
  const Power = {
    locked: true,

    lock() {
      const lock = OS.$('#lock');
      const os = OS.$('#os');
      OS.$('#lock-user').textContent = S.get('user');
      OS.$('#lock-avatar').textContent = S.get('avatarText') || (S.get('user') || 'U')[0].toUpperCase();
      OS.$('#lock-pass').value = '';
      OS.$('#lock-hint').textContent = S.get('password') ? 'Введите пароль и нажмите Enter' : 'Нажмите «Войти» или Enter';
      lock.classList.remove('hidden');
      os.style.filter = 'blur(6px)';
      os.style.pointerEvents = 'none';
      this.locked = true;
      OS.taskbar && OS.taskbar.closeAll();
      setTimeout(() => OS.$('#lock-pass').focus(), 120);
    },

    unlock(pass) {
      const want = S.get('password') || '';
      if (want && pass !== want) {
        const lock = OS.$('#lock');
        lock.classList.add('shake');
        setTimeout(() => lock.classList.remove('shake'), 420);
        OS.$('#lock-hint').textContent = 'Неверный пароль. Попробуйте ещё раз.';
        OS.$('#lock-pass').value = '';
        OS.sfx.play('error');
        return false;
      }
      OS.$('#lock').classList.add('hidden');
      const os = OS.$('#os');
      os.style.filter = ''; os.style.pointerEvents = '';
      this.locked = false;
      OS.sfx.resume();
      OS.sfx.play('ok');
      this.greet();
      return true;
    },

    greet() {
      const h = new Date().getHours();
      const part = h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
      OS.toast(part + ', ' + (S.get('user') || 'user') + '!', 'QwenOS ' + OS.version + ' готова к работе', { icon: 'zap', timeout: 5200 });
      if (!OS.store.get('firstrun')) {
        OS.store.set('firstrun', Date.now());
        setTimeout(() => OS.wm.open('welcome'), 700);
      } else if (S.get('tips')) {
        const tips = [
          'Совет: Ctrl+Alt+T — мгновенно открыть терминал.',
          'Совет: потяните окно к краю экрана, чтобы прикрепить его к половине.',
          'Совет: в терминале работает автодополнение по Tab и история по ↑.',
          'Совет: правый клик по рабочему столу — смена обоев и темы в два клика.',
          'Совет: сохраните рисунок из Paint — он появится в галерее «Фото».',
          'Совет: Win+Tab показывает все открытые окна с миниатюрами.'
        ];
        setTimeout(() => OS.toast('QwenOS', OS.pick(tips), { icon: 'info', timeout: 7000 }), 2600);
      }
    },

    screen(titleText, sub, onClick) {
      const ps = OS.$('#power-screen');
      ps.innerHTML = '<div class="ps-in"><div class="ps-spin"></div><div style="font-size:15px">' + OS.esc(titleText) + '</div>' +
        (sub ? '<div style="font-size:12px;opacity:.6;margin-top:8px">' + OS.esc(sub) + '</div>' : '') + '</div>';
      ps.classList.remove('hidden');
      ps.style.cursor = onClick ? 'pointer' : 'default';
      ps.onclick = onClick || null;
      OS.fs.saveNow();
      return ps;
    },

    reboot() {
      OS.wm.closeAll();
      this.screen('Перезагрузка…', 'Сохраняем файлы и настройки');
      setTimeout(() => location.reload(), 900);
    },

    shutdown() {
      OS.wm.closeAll();
      const ps = this.screen('Завершение работы…', 'Все данные сохранены');
      setTimeout(() => {
        ps.innerHTML = '<div class="ps-in">' +
          '<div style="font-size:44px;opacity:.85;margin-bottom:14px">⏻</div>' +
          '<div style="font-size:15px">Питание отключено</div>' +
          '<div style="font-size:12px;opacity:.55;margin:10px auto 22px;max-width:340px;line-height:1.6">За окном темнеет. Вы остаётесь в квартире — ' +
          'можно пройтись по комнате и посмотреть на погасший монитор со стороны.</div>' +
          '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
          '<button class="btn btn-accent" id="ps-on">Включить компьютер</button>' +
          '<button class="btn" id="ps-walk">Осмотреть квартиру</button></div></div>';
        ps.onclick = null;
        ps.querySelector('#ps-on').onclick = () => location.reload();
        ps.querySelector('#ps-walk').onclick = () => {
          ps.classList.add('hidden');
          OS.apartment.enter(() => { ps.classList.remove('hidden'); });
        };
      }, 1400);
    }
  };
  OS.power = Power;

  /* ============================================== загрузка (POST/BIOS) ==== */
  const BOOT_LINES = [
    ['QwenBIOS v3.0 · (C) ' + new Date().getFullYear() + ' QwenOS Project', 'dim'],
    ['Проверка контрольной суммы ядра…', 'ok'],
    ['CPU: Virtual CPU × ' + (navigator.hardwareConcurrency || 4) + ' потоков', 'ok'],
    ['Память: ' + OS.fmtBytes((navigator.deviceMemory || 4) * 1024 * 1024 * 1024) + ' обнаружено', 'ok'],
    ['Инициализация композитора DOM…', 'ok'],
    ['Монтирование виртуальной файловой системы /dev/localstorage', 'ok'],
    ['Загрузка драйвера WebAudio…', 'ok'],
    ['Запуск оконного менеджера QwenWM', 'ok'],
    ['Регистрация приложений: ' + OS.Apps.list().length + ' найдено', 'ok'],
    ['Проверка хранилища настроек…', 'ok'],
    ['Сетевой интерфейс qwenet0: ' + (navigator.onLine ? 'link up' : 'offline') + ' (песочница)', 'ok'],
    ['QwenOS ' + OS.version + ' «' + OS.codename + '» · ядро ' + OS.kernel, 'dim'],
    ['Сеанс готов. Добро пожаловать!', 'ok']
  ];

  async function runBoot() {
    const boot = OS.$('#boot');
    const log = OS.$('#boot-log');
    const fill = OS.$('#boot-fill');
    const fast = S.get('bootFast') || OS.store.get('skipBoot');

    if (fast) {
      boot.classList.add('out');
      setTimeout(() => { boot.remove(); showLock(); }, 60);
      return;
    }

    OS.sfx.play('boot');
    for (let i = 0; i < BOOT_LINES.length; i++) {
      const [txt, cls] = BOOT_LINES[i];
      const line = OS.el('div');
      line.innerHTML = (cls === 'ok' ? '<b>[ OK ]</b> ' : '<i>[ .. ]</i> ') + OS.esc(txt);
      log.append(line);
      while (log.children.length > 14) log.removeChild(log.firstChild);
      log.scrollTop = log.scrollHeight;
      fill.style.width = Math.round((i + 1) / BOOT_LINES.length * 100) + '%';
      await OS.sleep(i < 2 ? 190 : 110 + Math.random() * 110);
    }
    await OS.sleep(320);
    boot.classList.add('out');
    await OS.sleep(520);
    boot.remove();
    showLock();
  }

  function showLock() {
    const lock = OS.$('#lock');
    lock.classList.remove('hidden');
    OS.$('#lock-user').textContent = S.get('user');
    OS.$('#lock-avatar').textContent = S.get('avatarText') || (S.get('user') || 'U')[0].toUpperCase();
    OS.$('#lock-hint').textContent = S.get('password') ? 'Введите пароль и нажмите Enter' : 'Нажмите «Войти» или Enter';
    setTimeout(() => OS.$('#lock-pass').focus(), 200);
  }

  function enterDesktop() {
    OS.$('#os').classList.remove('hidden');
    OS.wm.init();
    OS.Desktop.init();
    OS.taskbar.init();
    OS.perf.start();
    bindShortcuts();
    bindMisc();
    if (OS.updater) OS.updater.init();
    OS.bus.emit('os:ready');

    // глубокая ссылка: index.html?app=terminal
    try {
      const app = new URLSearchParams(location.search).get('app');
      if (app && OS.Apps.has(app)) {
        if (!OS.Apps.installed(app)) OS.Apps.install(app);
        setTimeout(() => OS.wm.open(app), 420);
      }
    } catch (e) { /* noop */ }
  }

  /* ============================================== горячие клавиши ========= */
  function bindShortcuts() {
    let metaAlone = false;
    document.addEventListener('keydown', (e) => {
      if (Power.locked) return;
      const k = e.key;

      if (k === 'Meta') { metaAlone = true; }
      if (k === 'Escape') {
        if (OS.overview.el) { OS.overview.close(); e.preventDefault(); return; }
        if (OS.taskbar.startOpen || OS.taskbar.quickOpen) { OS.taskbar.closeAll(); e.preventDefault(); return; }
        OS.menuClose();
        return;
      }
      // Ctrl+Alt+T / F
      if (e.ctrlKey && e.altKey && (k === 't' || k === 'T' || k === 'е')) { e.preventDefault(); OS.wm.open('terminal'); return; }
      if (e.ctrlKey && e.altKey && (k === 'f' || k === 'F' || k === 'а')) { e.preventDefault(); OS.wm.open('files'); return; }
      if (e.ctrlKey && e.altKey && (k === 'l' || k === 'L' || k === 'д')) { e.preventDefault(); Power.lock(); return; }
      if (e.ctrlKey && e.altKey && (k === 'm' || k === 'M' || k === 'ь')) { e.preventDefault(); OS.wm.open('monitor'); return; }
      // «Пуск»
      if ((e.ctrlKey && k === 'Escape') || (metaAlone && k === 'Meta' && e.repeat === false && false)) { /* обрабатывается в keyup */ }
      if (e.ctrlKey && k === 'Escape') { e.preventDefault(); OS.taskbar.toggleStart(); return; }
      // Alt+Tab — переключение окон
      if (e.altKey && k === 'Tab') {
        e.preventDefault();
        const w = OS.wm.cycle(e.shiftKey ? -1 : 1);
        if (w) OS.toast(w.app.name, w.title || '', { icon: w.app.icon, color: OS.Apps.tileStyle(w.app), timeout: 1100 });
        return;
      }
      // Win+Tab / Ctrl+Alt+Tab — обзор
      if ((e.metaKey && k === 'Tab') || (e.ctrlKey && e.altKey && k === 'Tab')) { e.preventDefault(); OS.overview.toggle(); return; }
      // F11-ish: развернуть активное окно
      if (k === 'F10' && OS.wm.active) { e.preventDefault(); OS.wm.toggleMax(OS.wm.active); return; }
    });
    document.addEventListener('keyup', (e) => {
      if (e.key === 'Meta' && metaAlone) { metaAlone = false; if (!Power.locked) OS.taskbar.toggleStart(); }
      if (e.key !== 'Meta') metaAlone = false;
    });
  }

  /* ============================================== прочее ================== */
  function bindMisc() {
    // отключаем системное контекстное меню внутри ОС (кроме полей ввода)
    document.addEventListener('contextmenu', (e) => {
      if (Power.locked) return;
      const t = e.target;
      if (t.closest('input, textarea, [contenteditable="true"]')) return;
      e.preventDefault();
    });

    // сохранение при закрытии
    addEventListener('beforeunload', () => { fs0.saveNow(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) fs0.saveNow(); });

    // корректировка окон при изменении размера окна браузера
    const onResize = OS.debounce(() => {
      OS.isMobile = innerWidth < 720;
      const area = OS.wm.layer.getBoundingClientRect();
      OS.wm.windows.forEach((w) => {
        if (OS.isMobile && !w.maximized) {
          // на телефоне окна всегда занимают всю рабочую область
          Object.assign(w.root.style, { left: '4px', top: '4px', width: (area.width - 8) + 'px', height: (area.height - 8) + 'px' });
        } else if (w.maximized) {
          w.root.style.width = area.width + 'px';
          w.root.style.height = area.height + 'px';
        } else {
          const r = w.root;
          const ww = Math.min(r.offsetWidth, area.width - 8);
          const hh = Math.min(r.offsetHeight, area.height - 8);
          if (ww !== r.offsetWidth) r.style.width = ww + 'px';
          if (hh !== r.offsetHeight) r.style.height = hh + 'px';
          const maxX = Math.max(4, area.width - r.offsetWidth - 4);
          const maxY = Math.max(4, area.height - r.offsetHeight - 4);
          r.style.left = OS.clamp(parseFloat(r.style.left) || 0, -r.offsetWidth + 90, Math.max(maxX, -r.offsetWidth + 90)) + 'px';
          r.style.top = OS.clamp(parseFloat(r.style.top) || 0, 0, maxY) + 'px';
        }
        w.root.dispatchEvent(new Event('wm:resize'));
      });
      OS.bus.emit('os:resize');
    }, 180);
    addEventListener('resize', onResize);
    addEventListener('orientationchange', onResize);

    // первый жест пользователя — включаем звук
    const wake = () => { OS.sfx.resume(); document.removeEventListener('pointerdown', wake); };
    document.addEventListener('pointerdown', wake);

    // онлайн/офлайн
    addEventListener('online', () => OS.toast('Сеть появилась', 'QwenNet снова на связи', { icon: 'wifi', timeout: 3000 }));
    addEventListener('offline', () => OS.toast('Нет сети', 'QwenOS полностью работает офлайн', { icon: 'wifi', timeout: 3000 }));

    // service worker (только по http/https — на file:// недоступен)
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then((reg) => {
          reg.addEventListener('updatefound', () => {
            const nw = reg.installing;
            if (!nw) return;
            nw.addEventListener('statechange', () => {
              if (nw.state === 'installed' && navigator.serviceWorker.controller && OS.updater) OS.updater.swUpdate();
            });
          });
        }).catch(() => { /* офлайн режим — не критично */ });
      });
    }

    // логирование в ФС
    const log = OS.fs;
    const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
    log.write('/var/log/system.log', (log.read('/var/log/system.log') || '') + '[' + stamp() + '] wm: session started, ' + OS.Apps.list().length + ' apps registered\n');
    OS.bus.on('wm:open', (w) => log.write('/var/log/system.log', (log.read('/var/log/system.log') || '') + '[' + stamp() + '] wm: launched ' + w.appId + '\n'));
  }
  const fs0 = OS.fs;

  /* ============================================== старт ================== */
  S.apply();
  // восстановление пользовательских обоев
  const customWall = OS.store.get('wall.custom', null);
  if (customWall) S.set('wallpaperReset', false, true);

  /* Если index.html свежий (навигация всегда из сети), а скрипты приехали из
     старого кэша service worker — версии не совпадут. Убиваем древний SW и
     перезагружаемся начисто, чтобы рассинхрон не мог жить вечно. */
  function healStaleAssets() {
    const meta = document.querySelector('meta[name="qwenos-build"]');
    const want = meta && String(meta.getAttribute('content') || '').trim();
    if (!want) return;
    if (want === String(OS.buildNumber)) {
      try { sessionStorage.removeItem('qwenos.healed'); } catch (e) { /* noop */ }
      return;
    }
    let flag = '';
    try { flag = sessionStorage.getItem('qwenos.healed') || ''; } catch (e) { /* noop */ }
    if (flag === want) {
      console.warn('[QwenOS] кэш рассинхронизирован даже после сброса SW: обновите принудительно (Ctrl+Shift+R)');
      return;
    }
    try { sessionStorage.setItem('qwenos.healed', want); } catch (e) { /* noop */ }
    console.warn('[QwenOS] обнаружен устаревший кэш (' + OS.buildNumber + ' != ' + want + ') — сброс service worker и перезагрузка');
    const done = () => location.reload();
    try {
      if (navigator.serviceWorker) {
        navigator.serviceWorker.getRegistration().then((r) => (r ? r.unregister() : null)).then(done, done);
        return;
      }
    } catch (e) { /* noop */ }
    done();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    healStaleAssets();
    OS.$('#lock-btn').addEventListener('click', () => {
      const ok = Power.unlock(OS.$('#lock-pass').value);
      if (ok) enterDesktopOnce();
    });
    OS.$('#lock-pass').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { const ok = Power.unlock(OS.$('#lock-pass').value); if (ok) enterDesktopOnce(); }
    });
    await runBoot();
  });

  let entered = false;
  function enterDesktopOnce() {
    if (entered) return;
    entered = true;
    enterDesktop();
  }

  // экспорт для отладки в консоли
  globalThis.QwenOS = OS;
  console.log('%c QwenOS ' + OS.version + ' «' + OS.codename + '» ', 'background:linear-gradient(135deg,#8b5cf6,#06b6d4);color:#fff;font-weight:700;border-radius:6px;padding:4px 8px');
  console.log('%cОтладка: window.QwenOS — ядро, QwenOS.wm, QwenOS.fs, QwenOS.Apps.list()', 'color:#8b93a6');
})(window.OS);
