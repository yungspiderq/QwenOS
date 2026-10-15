/* ==========================================================================
   QwenOS 3.0 — updater.js
   Центр обновлений в стиле Windows:
   автопроверка → всплывающее уведомление → экран установки с анимацией
   (крутящиеся точки, процент, «не выключайте компьютер») → перезапуск →
   карточка «что нового» после входа.
   ========================================================================== */
(function (OS) {
  'use strict';
  const store = OS.store;

  const CORE_ASSETS = [
    'version.json', 'index.html', 'manifest.webmanifest', 'sw.js',
    'css/base.css', 'css/desktop.css', 'css/windows.css', 'css/apps.css',
    'js/core.js', 'js/fs.js', 'js/wm.js', 'js/updater.js', 'js/desktop.js', 'js/taskbar.js', 'js/boot.js',
    'js/apps/system.js', 'js/apps/system-ui.js', 'js/apps/productivity.js', 'js/apps/media.js', 'js/apps/games.js'
  ];

  const LIVE_URL = 'https://yungspiderq.github.io/QwenOS/';

  const Updater = {
    liveUrl: LIVE_URL,
    current: { version: OS.version, build: OS.buildNumber || 0 },
    remote: null,
    pending: null,
    checking: false,
    lastCheck: 0,
    popup: null,
    screen: null,
    busy: false,

    /* ------------------------------------------------------------ старт */
    init() {
      OS.bus.on('os:ready', () => {
        setTimeout(() => this.check({ silent: true }), 9000);
        setInterval(() => this.check({ silent: true }), 5 * 60 * 1000);
        this.whatNew();
      });
      const soft = OS.throttle(() => this.check({ silent: true }), 10 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) soft(); });
      addEventListener('focus', soft);
      return this;
    },

    /* -------------------------------------------------- проверка версии */
    async fetchRemote() {
      const res = await fetch('version.json?cb=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    },

    async check(opts) {
      opts = opts || {};
      if (this.checking) return null;
      this.checking = true;
      this.lastCheck = Date.now();
      try {
        const r = await this.fetchRemote();
        this.remote = r;
        if ((r.build || 0) > this.current.build) {
          this.pending = r;
          this.showPopup(r);
          return r;
        }
        if (!opts.silent) {
          OS.toast('Обновлений нет', 'Установлена последняя версия: QwenOS ' + this.current.version + ' (сборка ' + this.current.build + ')', { icon: 'shield', timeout: 4200 });
          OS.sfx.play('ok');
        }
        return null;
      } catch (e) {
        const d = this.diagnose(e);
        const show = (t) => OS.toast(t.title, t.text, {
          icon: t.icon, timeout: 7000,
          onClick: t.url ? () => window.open(t.url, '_blank', 'noopener') : undefined
        });
        if (!opts.silent) show(d);
        else if (d.severe && !this._warned) { this._warned = true; show(d); }
        return null;
      } finally {
        this.checking = false;
      }
    },

    /* почему не удалось провериться: file://, офлайн или сервер недоступен */
    diagnose(e) {
      if (location.protocol === 'file:') {
        return {
          severe: true, icon: 'info', url: LIVE_URL,
          title: 'Обновления с диска недоступны (file://)',
          text: 'Копия открыта локальным файлом: браузер запрещает fetch и service worker. Нажмите, чтобы открыть онлайн-версию, или запустите папку через локальный сервер (python3 -m http.server), или обновите копию: git pull'
        };
      }
      if (!navigator.onLine) {
        return { severe: false, icon: 'wifi', title: 'Нет сети', text: 'QwenOS работает офлайн, но проверить обновления невозможно' };
      }
      return { severe: false, icon: 'x', title: 'Проверка не удалась', text: 'Не удалось связаться с сервером обновлений: ' + String(e.message || e) };
    },

    /* сигнал от service worker: появился новый SW */
    swUpdate() {
      if (this.pending) return;
      this.pending = this.remote || { version: OS.version, build: this.current.build + 1, notes: ['Обнаружена новая сборка оболочки (service worker).'] };
      this.showPopup(this.pending);
    },

    /* ------------------------------------------- всплывающее уведомление */
    showPopup(r) {
      if (this.popup || this.screen) return;
      const note = (r.notes && r.notes[0]) || 'Улучшения производительности и исправления.';
      const p = OS.el('div', { class: 'upd-popup', role: 'alertdialog', 'aria-label': 'Доступно обновление' });
      p.innerHTML =
        '<div class="upd-head"><div class="upd-ic">' + OS.svg('refresh', 20) + '</div>' +
        '<div><div class="upd-title">Доступны обновления</div>' +
        '<div class="dim" style="font-size:11.5px">Центр обновлений QwenOS</div></div></div>' +
        '<div class="upd-text"><b>QwenOS ' + OS.esc(r.version || OS.version) + '</b> (сборка ' + OS.esc(String(r.build || '?')) + ')<br>' + OS.esc(note) + '</div>' +
        '<div class="upd-btns"><button class="btn btn-sm btn-ghost" data-a="later">Позже</button>' +
        '<button class="btn btn-sm btn-accent" data-a="install">' + OS.svg('download', 14) + ' Установить и перезапустить</button></div>';
      document.body.append(p);
      this.popup = p;
      OS.sfx.play('notify');
      p.querySelector('[data-a="install"]').onclick = () => { this.closePopup(); this.install(r); };
      p.querySelector('[data-a="later"]').onclick = () => {
        this.closePopup();
        OS.toast('Обновление отложено', 'Напомню через 15 минут или при следующей проверке', { icon: 'clock', timeout: 2600 });
        setTimeout(() => { if (this.pending && !this.screen) this.showPopup(this.pending); }, 15 * 60 * 1000);
      };
      OS.bus.emit('update:available', r);
    },
    closePopup() {
      if (!this.popup) return;
      const p = this.popup;
      this.popup = null;
      p.classList.add('out');
      setTimeout(() => p.remove(), 300);
    },

    /* ------------------------------------------------- экран установки */
    async install(r, opts) {
      opts = opts || {};
      if (this.busy) return;
      this.busy = true;
      this.closePopup();
      OS.wm.minimizeAll();
      OS.taskbar && OS.taskbar.closeAll();

      const sc = OS.el('div', { class: 'upd-screen', role: 'alertdialog', 'aria-label': 'Установка обновлений' });
      sc.innerHTML =
        '<div class="upd-in">' +
          '<div class="upd-dots">' + '<i></i>'.repeat(6) + '</div>' +
          '<div class="upd-pct">0%</div>' +
          '<div class="upd-msg">Подготовка…</div>' +
          '<div class="upd-bar"><i></i></div>' +
          '<div class="upd-sub">' + (opts.demo ? 'Демонстрация анимации обновления — перезапуск не выполняется' : 'Не выключайте и не перезагружайте компьютер') + '</div>' +
        '</div>';
      document.body.append(sc);
      this.screen = sc;
      OS.sfx.play('open');

      const pct = sc.querySelector('.upd-pct');
      const msg = sc.querySelector('.upd-msg');
      const bar = sc.querySelector('.upd-bar i');
      const set = (p, m) => { pct.textContent = Math.round(p) + '%'; if (m) msg.textContent = m; bar.style.width = Math.min(100, p) + '%'; };

      try {
        /* 1. реальная предзагрузка новых файлов (греет кэш SW) */
        set(1, 'Загрузка обновлений…');
        let done = 0;
        for (const a of CORE_ASSETS) {
          try { await fetch(a + '?cb=' + Date.now(), { cache: 'no-store' }); } catch (e) { /* офлайн — не страшно */ }
          done++;
          set(2 + (done / CORE_ASSETS.length) * 56, 'Загрузка обновлений… ' + done + ' из ' + CORE_ASSETS.length);
          await OS.sleep(opts.demo ? 40 : 55 + Math.random() * 85);
        }

        /* 2. установка */
        let p = 60;
        const steps = ['Установка обновлений…', 'Применение изменений ядра…', 'Обновление компонентов интерфейса…', 'Проверка целостности…'];
        let si = 0;
        while (p < 99) {
          p = Math.min(99, p + Math.random() * 3.4 + .8);
          if (Math.random() < .18) si = (si + 1) % steps.length;
          set(p, steps[si]);
          await OS.sleep(opts.demo ? 55 : 80 + Math.random() * 150);
        }
        set(99, 'Подготовка к перезапуску…');
        store.set('justUpdated', {
          build: (r && r.build) || this.current.build,
          version: (r && r.version) || OS.version,
          notes: (r && r.notes) || [],
          at: Date.now()
        });
        OS.fs.saveNow();
        await OS.sleep(650);

        /* 3. финал */
        if (opts.demo) {
          set(100, 'Готово! Это была демонстрация анимации обновления');
          OS.sfx.play('ok');
          await OS.sleep(1500);
          sc.classList.add('out');
          setTimeout(() => sc.remove(), 420);
          this.screen = null;
          this.busy = false;
          OS.toast('Демо завершено', 'Настоящее обновление применится так же: с перезапуском системы', { icon: 'refresh', timeout: 4200 });
          return;
        }

        set(100, 'Завершено. Перезапуск…');
        OS.sfx.play('ok');
        await OS.sleep(700);
        /* активируем новый service worker и перезагружаемся */
        try {
          if (navigator.serviceWorker) {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg && reg.waiting) {
              reg.waiting.postMessage('skipWaiting');
              await new Promise((res) => {
                navigator.serviceWorker.addEventListener('controllerchange', () => res(), { once: true });
                setTimeout(res, 4000);
              });
            }
          }
        } catch (e) { /* noop */ }
        await OS.sleep(350);
        location.reload();
      } catch (e) {
        this.busy = false;
        sc.classList.add('out');
        setTimeout(() => sc.remove(), 400);
        this.screen = null;
        OS.toast('Сбой обновления', String(e.message || e), { icon: 'x' });
      }
    },

    /* демо-режим без перезапуска (для витрины и тестов) */
    demo() {
      return this.install({ version: OS.version, build: this.current.build, notes: [] }, { demo: true });
    },

    /* ---------------------------------- «что нового» после обновления */
    whatNew() {
      const ju = store.get('justUpdated', null);
      if (!ju || ju.build !== this.current.build) return;
      if (store.get('notesShown', null) === ju.build) return;
      store.set('notesShown', ju.build);
      const notes = (ju.notes && ju.notes.length) ? ju.notes : ['Улучшения и исправления стабильности.'];
      setTimeout(() => {
        OS.toast('Обновление установлено ✔', 'QwenOS ' + (ju.version || OS.version) + ' (сборка ' + ju.build + '): ' + notes[0], {
          icon: 'zap', timeout: 9000,
          onClick: () => OS.wm.open('dialog', {
            title: 'Что нового в сборке ' + ju.build, icon: 'zap',
            rows: [['Версия', ju.version || OS.version], ['Сборка', String(ju.build)], ['Дата', OS.fmtDateTime(ju.at || Date.now())]]
              .concat(notes.map((n, i) => ['Изменение ' + (i + 1), n]))
          })
        });
      }, 1800);
    }
  };

  OS.updater = Updater;
})(window.OS);
