/* ==========================================================================
   QwenOS 3.0 — apps/system-ui.js
   Настройки · Диспетчер задач · QwenStore · Приветствие · Диалог свойств
   ========================================================================== */
(function (OS) {
  'use strict';
  const S = OS.settings, fs = OS.fs;

  /* =======================================================================
     НАСТРОЙКИ
     ======================================================================= */
  OS.Apps.register({
    id: 'settings',
    name: 'Настройки',
    icon: 'gear',
    color: '#64748b', color2: '#334155',
    category: 'Система',
    keywords: 'параметры конфигурация тема обои оформление settings preferences',
        desktop: false,
width: 880, height: 580, minWidth: 460, minHeight: 340,
    mount(win, api) {
      const SECTIONS = [
        { id: 'look', name: 'Оформление', icon: 'palette' },
        { id: 'desktop', name: 'Рабочий стол', icon: 'monitor' },
        { id: 'sound', name: 'Звук', icon: 'volume' },
        { id: 'account', name: 'Аккаунт', icon: 'user' },
        { id: 'update', name: 'Обновления', icon: 'refresh' },
        { id: 'system', name: 'Система', icon: 'cpu' },
        { id: 'about', name: 'О системе', icon: 'info' }
      ];
      let cur = win.params.section || 'look';

      win.body.innerHTML = '<div class="set"><aside class="set-side"></aside><main class="set-main"></main></div>';
      const side = win.body.querySelector('.set-side');
      const main = win.body.querySelector('.set-main');

      side.innerHTML = '<div class="set-brand"><div class="set-logo">' + OS.svg('zap', 16) + '</div><div><b>QwenOS</b><span>' + OS.version + '</span></div></div>';
      SECTIONS.forEach((s) => {
        const b = OS.el('button', { class: 'set-nav', 'data-s': s.id });
        b.innerHTML = OS.svg(s.icon, 16) + '<span>' + s.name + '</span>';
        b.onclick = () => { cur = s.id; render(); };
        side.append(b);
      });

      const h = (t) => '<div class="set-h">' + t + '</div>';
      const row = (title, desc, controlHtml) =>
        '<div class="set-row"><div class="set-row-t"><b>' + title + '</b>' + (desc ? '<span>' + desc + '</span>' : '') + '</div><div class="set-row-c">' + controlHtml + '</div></div>';
      const sw = (key) => '<div class="switch' + (S.get(key) ? ' on' : '') + '" data-toggle="' + key + '" role="switch" tabindex="0"></div>';

      function render() {
        side.querySelectorAll('.set-nav').forEach((b) => b.classList.toggle('on', b.dataset.s === cur));
        const sec = SECTIONS.find((x) => x.id === cur);
        win.setTitle('Настройки — ' + sec.name);
        main.innerHTML = '';
        main.scrollTop = 0;
        const wrap = OS.el('div', { class: 'set-sec' });
        wrap.innerHTML = '<div class="set-title">' + OS.svg(sec.icon, 20) + '<h2>' + sec.name + '</h2></div>';
        main.append(wrap);
        builders[cur](wrap);
      }

      const builders = {
        look(w) {
          w.insertAdjacentHTML('beforeend', h('Тема оформления'));
          const themes = [
            { id: 'dark', name: 'Тёмная' }, { id: 'light', name: 'Светлая' }, { id: 'aurora', name: 'Aurora' },
            { id: 'neon', name: 'Неон' }, { id: 'mono', name: 'Графит' }
          ];
          const tg = OS.el('div', { class: 'set-tiles' });
          themes.forEach((t) => {
            const d = OS.el('button', { class: 'set-tile theme-tile' + (S.get('theme') === t.id ? ' on' : '') });
            d.innerHTML = '<div class="tt-prev" data-th="' + t.id + '"><i></i><i></i><i></i></div><span>' + t.name + '</span>';
            d.onclick = () => { S.set('theme', t.id); render(); OS.toast('Тема изменена', t.name, { icon: 'palette' }); };
            tg.append(d);
          });
          w.append(tg);

          w.insertAdjacentHTML('beforeend', h('Акцентный цвет'));
          const ag = OS.el('div', { class: 'set-swatches' });
          OS.accents.forEach((a) => {
            const b = OS.el('button', {
              class: 'sw' + (S.get('accent') === a.id ? ' on' : ''),
              title: a.name,
              style: { background: 'linear-gradient(135deg,' + a.a + ',' + a.b + ')' }
            });
            b.onclick = () => { S.set('accent', a.id); render(); };
            ag.append(b);
          });
          w.append(ag);

          w.insertAdjacentHTML('beforeend', h('Обои рабочего стола'));
          const wg = OS.el('div', { class: 'set-walls' });
          OS.wallpapers.forEach((wp) => {
            const b = OS.el('button', { class: 'wall' + (S.get('wallpaper') === wp.id ? ' on' : ''), title: wp.name });
            b.innerHTML = '<div class="wall-prev" style="background:' + wp.css + '"></div><span>' + OS.esc(wp.name) + '</span>';
            b.onclick = () => { S.set('wallpaper', wp.id); render(); };
            wg.append(b);
          });
          w.append(wg);

          w.insertAdjacentHTML('beforeend', h('Эффекты'));
          const box = OS.el('div', { class: 'set-box' });
          box.innerHTML =
            row('Анимация обоев', 'Плавающие световые пятна, звёзды, зернистость', sw('wallpaperFx')) +
            row('Анимации интерфейса', 'Отключите для максимальной отзывчивости', sw('motion')) +
            row('Масштаб интерфейса', 'Размер шрифтов и элементов: <b class="scale-v">' + Math.round(S.get('uiScale') * 100) + '%</b>',
              '<input type="range" min="0.85" max="1.3" step="0.05" value="' + S.get('uiScale') + '" data-range="uiScale">');
          w.append(box);
        },

        desktop(w) {
          w.insertAdjacentHTML('beforeend', h('Рабочий стол'));
          const box = OS.el('div', { class: 'set-box' });
          box.innerHTML =
            row('Иконки на рабочем столе', 'Показывать ярлыки установленных приложений', sw('desktopIcons')) +
            row('Виджет «Часы»', 'Крупные часы в правом верхнем углу', '<div class="switch' + ((S.get('widgets') || []).includes('clock') ? ' on' : '') + '" data-widget="clock" role="switch" tabindex="0"></div>') +
            row('Виджет «Погода»', 'Прогноз в реальном времени (симуляция)', '<div class="switch' + ((S.get('widgets') || []).includes('weather') ? ' on' : '') + '" data-widget="weather" role="switch" tabindex="0"></div>') +
            row('Виджет «Система»', 'Загрузка ЦП, память, FPS', '<div class="switch' + ((S.get('widgets') || []).includes('system') ? ' on' : '') + '" data-widget="system" role="switch" tabindex="0"></div>') +
            row('Подсказки для новичков', 'Показывать советы после входа', sw('tips'));
          w.append(box);

          w.insertAdjacentHTML('beforeend', h('Панель задач — закреплённые приложения'));
          const pin = OS.el('div', { class: 'set-pins' });
          OS.Apps.list().filter((a) => OS.Apps.installed(a.id)).forEach((a) => {
            const on = (S.get('pinned') || []).includes(a.id);
            const b = OS.el('button', { class: 'pin-item' + (on ? ' on' : '') });
            b.innerHTML = '<i style="' + OS.Apps.tileStyle(a) + '">' + OS.svg(a.icon, 14) + '</i><span>' + OS.esc(a.name) + '</span>' + (on ? OS.svg('pin', 13) : '');
            b.onclick = () => {
              let p = S.get('pinned') || [];
              p = on ? p.filter((x) => x !== a.id) : p.concat(a.id);
              S.set('pinned', p); render();
            };
            pin.append(b);
          });
          w.append(pin);
        },

        sound(w) {
          w.insertAdjacentHTML('beforeend', h('Звук'));
          const box = OS.el('div', { class: 'set-box' });
          box.innerHTML =
            row('Звуки интерфейса', 'Щелчки, открытие окон, уведомления', sw('sound')) +
            row('Громкость', '<b class="vol-v">' + Math.round(S.get('volume') * 100) + '%</b>',
              '<div class="row" style="gap:10px"><button class="btn btn-sm" data-act="mute">' + (S.get('muted') ? 'Включить' : 'Выключить') + '</button><input type="range" min="0" max="1" step="0.05" value="' + S.get('volume') + '" data-range="volume" style="width:150px"></div>') +
            row('Проверка', 'Проиграть тестовый сигнал', '<button class="btn btn-sm" data-act="test">Проверить</button>');
          w.append(box);
          box.querySelector('[data-act="test"]').onclick = () => { OS.sfx.resume(); OS.sfx.play('notify'); };
          box.querySelector('[data-act="mute"]').onclick = () => { S.set('muted', !S.get('muted')); render(); };
        },

        account(w) {
          w.insertAdjacentHTML('beforeend', h('Пользователь'));
          const box = OS.el('div', { class: 'set-box' });
          box.innerHTML =
            row('Имя пользователя', 'Используется в терминале и на экране входа', '<input class="field" style="max-width:220px" data-inp="user" value="' + OS.esc(S.get('user')) + '" maxlength="20">') +
            row('Аватар', 'Одна буква или эмодзи на аватаре', '<input class="field" style="max-width:80px;text-align:center" data-inp="avatarText" value="' + OS.esc(S.get('avatarText')) + '" maxlength="2">') +
            row('Пароль экрана блокировки', S.get('password') ? 'Пароль установлен' : 'Не установлен — вход по нажатию кнопки',
              '<div class="row" style="gap:8px"><input class="field" type="password" style="max-width:170px" data-inp="password" placeholder="Новый пароль" autocomplete="new-password"><button class="btn btn-sm" data-act="clearpass">Снять</button></div>');
          w.append(box);

          const box2 = OS.el('div', { class: 'set-box', style: { marginTop: '12px' } });
          box2.innerHTML = row('Действия сеанса', 'Блокировка, перезагрузка, выключение',
            '<div class="row" style="gap:8px"><button class="btn btn-sm" data-act="lock">Заблокировать</button><button class="btn btn-sm" data-act="reboot">Перезагрузка</button><button class="btn btn-danger btn-sm" data-act="off">Выключить</button></div>');
          w.append(box2);
          box2.querySelector('[data-act="lock"]').onclick = () => OS.power.lock();
          box2.querySelector('[data-act="reboot"]').onclick = () => OS.power.reboot();
          box2.querySelector('[data-act="off"]').onclick = () => OS.power.shutdown();

          box.querySelector('[data-act="clearpass"]').onclick = () => { S.set('password', ''); render(); OS.toast('Пароль снят', 'Вход теперь без пароля', { icon: 'lock' }); };
        },

        update(w) {
          const U = OS.updater;
          const isFile = location.protocol === 'file:';
          w.insertAdjacentHTML('beforeend', h('Центр обновлений'));
          if (isFile) {
            w.insertAdjacentHTML('beforeend', '<div class="set-note" style="border-color:color-mix(in srgb, var(--warn) 45%, transparent);background:color-mix(in srgb, var(--warn) 12%, transparent)">' + OS.svg('info', 14) + '<div>Копия открыта с диска (<code>file://</code>): браузер запрещает запросы обновлений и service worker. Система работает, но новые версии сюда не прилетят. Откройте онлайн-версию или поднимите локальный сервер: <code>python3 -m http.server</code> в папке <code>docs/</code>.</div></div>');
          }
          const box = OS.el('div', { class: 'set-box' });
          const last = U.lastCheck ? OS.fmtDateTime(U.lastCheck) : 'ещё не выполнялась';
          box.innerHTML =
            row('Способ запуска', isFile ? 'Локальный файл file:// — обновления и SW недоступны' : 'Веб-сервер: ' + location.origin,
              isFile ? '<button class="btn btn-sm btn-accent" data-act="online">Открыть онлайн</button>' : '<span class="chip">' + OS.svg('shield', 12) + ' http(s)</span>') +
            row('Текущая сборка', 'QwenOS ' + OS.version + ' · канал ' + ((U.remote && U.remote.channel) || 'stable'), '<b>' + U.current.build + '</b>') +
            row('Последняя проверка', last, U.checking ? '<span class="chip">идёт…</span>' : '<button class="btn btn-sm" data-act="chk">' + OS.svg('refresh', 14) + ' Проверить</button>') +
            row('Доступно обновление', U.pending ? ('сборка ' + U.pending.build) : 'нет', U.pending ? '<button class="btn btn-sm btn-accent" data-act="inst">Установить</button>' : '<span class="chip">' + OS.svg('shield', 12) + ' всё актуально</span>') +
            row('Автопроверка', 'Каждые 5 минут, при возврате во вкладку и при запуске', '<span class="switch on" title="включено"></span>') +
            row('Демонстрация', 'Показать экран установки с анимацией без перезапуска', '<button class="btn btn-sm" data-act="demo">' + OS.svg('play', 14) + ' Демо</button>');
          w.append(box);
          box.querySelector('[data-act="chk"]').onclick = async (e) => {
            e.target.disabled = true;
            const r = await U.check({});
            e.target.disabled = false;
            render();
            if (r) OS.toast('Найдено обновление', 'Сборка ' + r.build, { icon: 'download' });
          };
          const ib = box.querySelector('[data-act="inst"]');
          if (ib) ib.onclick = () => U.install(U.pending);
          box.querySelector('[data-act="demo"]').onclick = () => U.demo();
          const on = box.querySelector('[data-act="online"]');
          if (on) on.onclick = () => window.open(U.liveUrl, '_blank', 'noopener');
          w.insertAdjacentHTML('beforeend', '<div class="set-note">' + OS.svg('info', 14) + ' Обновления распространяются через GitHub Pages: система сравнивает номер сборки в <code>version.json</code> и, если он больше текущего, предлагает установку. Файлы предварительно загружаются в кэш service worker, поэтому перезапуск почти мгновенный.</div>');
        },

        system(w) {
          const mem = OS.memInfo();
          w.insertAdjacentHTML('beforeend', h('Хранилище'));
          const box = OS.el('div', { class: 'set-box' });
          const vfsUsed = fs.du('/'), cc = fs.count('/'), lsUsed = OS.store.usage();
          box.innerHTML =
            row('Виртуальная ФС', cc.files + ' файлов, ' + cc.dirs + ' каталогов', '<b>' + OS.fmtBytes(vfsUsed) + '</b>') +
            row('localStorage', 'Занято браузером под данные QwenOS', '<b>' + OS.fmtBytes(lsUsed) + '</b>') +
            row('Доступность хранилища', OS.store.available ? 'localStorage доступен' : 'Режим памяти (данные не сохранятся после закрытия)', '<span class="chip">' + (OS.store.available ? 'OK' : 'memory') + '</span>') +
            row('Куча JavaScript', 'Используется движком', '<b>' + OS.fmtBytes(mem.used) + ' / ' + OS.fmtBytes(mem.limit) + '</b>');
          w.append(box);

          w.insertAdjacentHTML('beforeend', h('Резервная копия'));
          const box2 = OS.el('div', { class: 'set-box' });
          box2.innerHTML =
            row('Экспорт', 'Скачать настройки и файлы одним JSON', '<button class="btn btn-sm" data-act="exp">' + OS.svg('download', 14) + ' Экспорт</button>') +
            row('Импорт', 'Восстановить систему из JSON-файла', '<button class="btn btn-sm" data-act="imp">' + OS.svg('upload', 14) + ' Импорт</button>') +
            row('Сброс настроек', 'Вернуть оформление и параметры по умолчанию', '<button class="btn btn-sm" data-act="reset">Сбросить</button>') +
            row('Полная переустановка', 'Удалить все данные и файлы QwenOS', '<button class="btn btn-danger btn-sm" data-act="nuke">Форматировать</button>');
          w.append(box2);

          box2.querySelector('[data-act="exp"]').onclick = () => {
            fs.saveNow();
            const dump = { app: 'QwenOS', version: OS.version, exported: new Date().toISOString(), settings: S.data, fs: fs.root };
            OS.download('qwenos-backup-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(dump, null, 2), 'application/json');
            OS.toast('Экспорт готов', 'Файл резервной копии скачан', { icon: 'download' });
          };
          box2.querySelector('[data-act="imp"]').onclick = () => {
            const inp = OS.el('input', { type: 'file', accept: '.json,application/json' });
            inp.onchange = () => {
              const f = inp.files && inp.files[0]; if (!f) return;
              const rd = new FileReader();
              rd.onload = () => {
                try {
                  const d = JSON.parse(rd.result);
                  if (d.settings) S.patch(d.settings);
                  if (d.fs && d.fs.t === 'd') { fs.root = d.fs; fs.saveNow(); }
                  OS.toast('Импорт выполнен', 'Система восстановлена из копии', { icon: 'upload' });
                  OS.bus.emit('fs:changed'); OS.bus.emit('apps:changed');
                } catch (e) { OS.toast('Ошибка импорта', String(e.message || e), { icon: 'x' }); }
              };
              rd.readAsText(f);
            };
            inp.click();
          };
          box2.querySelector('[data-act="reset"]').onclick = () => { if (confirm('Сбросить все настройки к значениям по умолчанию?')) { S.reset(); render(); OS.toast('Настройки сброшены', '', { icon: 'refresh' }); } };
          box2.querySelector('[data-act="nuke"]').onclick = () => {
            if (!confirm('Полностью удалить все данные QwenOS (файлы, настройки, прогресс игр)?')) return;
            if (!confirm('Точно? Это действие необратимо.')) return;
            OS.store.clearAll();
            location.reload();
          };
        },

        about(w) {
          const ac = S.accentPair();
          w.insertAdjacentHTML('beforeend',
            '<div class="about-hero">' +
              '<div class="about-logo">' + OS.svg('zap', 34) + '</div>' +
              '<h2>QwenOS <span>' + OS.version + '</span></h2>' +
              '<p>Операционная система, живущая во вкладке браузера</p>' +
              '<div class="about-badges"><span class="chip">' + OS.svg('layers', 12) + ' «' + OS.codename + '»</span>' +
              '<span class="chip">' + OS.svg('cpu', 12) + ' ' + OS.kernel + '</span>' +
              '<span class="chip">' + OS.svg('palette', 12) + ' ' + S.get('theme') + ' / ' + ac.name + '</span></div>' +
            '</div>');
          const box = OS.el('div', { class: 'set-box' });
          box.innerHTML =
            row('Версия', 'Сборка от ' + OS.build, '<b>' + OS.version + '</b>') +
            row('Ядро', 'Компоновщик на чистом DOM', '<b>' + OS.kernel + '</b>') +
            row('Приложений установлено', 'Включая загруженные из QwenStore', '<b>' + OS.Apps.list().filter((a) => OS.Apps.installed(a.id)).length + '</b>') +
            row('Время работы', 'С момента загрузки страницы', '<b>' + OS.fmtDur(OS.uptime()) + '</b>') +
            row('Разрешение', 'Окно браузера', '<b>' + innerWidth + '×' + innerHeight + '</b>') +
            row('Платформа', navigator.platform + ' · ' + (navigator.hardwareConcurrency || '?') + ' потоков', '<b>' + (OS.isTouch ? 'touch' : 'pointer') + '</b>') +
            row('Исходный код', 'github.com/yungspiderq/QwenOS', '<button class="btn btn-sm" data-act="gh">Открыть</button>');
          w.append(box);
          box.querySelector('[data-act="gh"]').onclick = () => window.open('https://github.com/yungspiderq/QwenOS', '_blank', 'noopener');
          w.insertAdjacentHTML('beforeend', '<div class="set-note">' + OS.svg('heart', 14) + '<div>Сделано на чистом HTML, CSS и JavaScript — без единой внешней зависимости, без сборки и без серверной части. Откройте <code>index.html</code> — и система запустится.</div></div>');
        }
      };

      /* -------------------------------------------------- общие обработчики */
      main.addEventListener('click', (e) => {
        const t = e.target.closest('[data-toggle]');
        if (t) { const k = t.dataset.toggle; S.set(k, !S.get(k)); t.classList.toggle('on', S.get(k)); OS.sfx.play('click'); return; }
        const wg = e.target.closest('[data-widget]');
        if (wg) {
          const id = wg.dataset.widget;
          let list = S.get('widgets') || [];
          list = list.includes(id) ? list.filter((x) => x !== id) : list.concat(id);
          S.set('widgets', list); wg.classList.toggle('on', list.includes(id));
          return;
        }
      });
      main.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-toggle],[data-widget]')) { e.preventDefault(); e.target.click(); }
      });
      main.addEventListener('input', (e) => {
        const r = e.target.closest('[data-range]');
        if (r) {
          const k = r.dataset.range;
          S.set(k, parseFloat(r.value));
          const lab = main.querySelector(k === 'uiScale' ? '.scale-v' : '.vol-v');
          if (lab) lab.textContent = Math.round(parseFloat(r.value) * 100) + '%';
          return;
        }
        const i = e.target.closest('[data-inp]');
        if (i) S.set(i.dataset.inp, i.value, true);
      });
      main.addEventListener('change', (e) => {
        const i = e.target.closest('[data-inp]');
        if (i) {
          S.set(i.dataset.inp, i.value);
          if (i.dataset.inp === 'user') { OS.bus.emit('user:changed'); OS.toast('Имя изменено', 'Теперь вы — ' + i.value, { icon: 'user' }); }
        }
      });

      render();
    }
  });

  /* =======================================================================
     ДИСПЕТЧЕР ЗАДАЧ
     ======================================================================= */
  OS.Apps.register({
    id: 'monitor',
    name: 'Диспетчер задач',
    icon: 'activity',
    color: '#0ea5e9', color2: '#1e40af',
    category: 'Система',
    keywords: 'процессы задачи память cpu fps task manager performance',
        desktop: false,
width: 780, height: 540, minWidth: 420, minHeight: 320,
    mount(win) {
      win.body.innerHTML =
        '<div class="mon">' +
          '<div class="mon-graphs">' +
            '<div class="mon-g"><div class="mon-g-t">Частота кадров <b id="mfps">60</b> fps</div><canvas class="mon-cv" id="mcv-fps"></canvas></div>' +
            '<div class="mon-g"><div class="mon-g-t">Загрузка ЦП <b id="mcpu">0</b>%</div><canvas class="mon-cv" id="mcv-cpu"></canvas></div>' +
          '</div>' +
          '<div class="mon-stats"></div>' +
          '<div class="mon-list-t">Процессы <span class="chip" id="mon-count">0</span></div>' +
          '<div class="mon-list"></div>' +
        '</div>';
      const list = win.body.querySelector('.mon-list');
      const stats = win.body.querySelector('.mon-stats');
      const cvF = win.body.querySelector('#mcv-fps'), cvC = win.body.querySelector('#mcv-cpu');
      const mfps = win.body.querySelector('#mfps'), mcpu = win.body.querySelector('#mcpu');
      const hist = { fps: [], cpu: [] };

      function sizeCv(cv) { const r = cv.getBoundingClientRect(); cv.width = Math.max(60, r.width * devicePixelRatio); cv.height = Math.max(30, r.height * devicePixelRatio); return cv.getContext('2d'); }
      let ctxF = sizeCv(cvF), ctxC = sizeCv(cvC);
      const onRs = () => { ctxF = sizeCv(cvF); ctxC = sizeCv(cvC); };
      win.root.addEventListener('wm:resize', onRs);
      addEventListener('resize', onRs);

      function drawGraph(ctx, cv, data, color, max) {
        const w = cv.width, hh = cv.height;
        ctx.clearRect(0, 0, w, hh);
        ctx.strokeStyle = 'rgba(128,140,180,.16)'; ctx.lineWidth = 1 * devicePixelRatio;
        for (let i = 1; i < 4; i++) { const y = hh / 4 * i; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
        if (data.length < 2) return;
        const step = w / (data.length - 1);
        ctx.beginPath();
        data.forEach((v, i) => { const y = hh - (Math.min(v, max) / max) * hh * .92 - hh * .04; i ? ctx.lineTo(i * step, y) : ctx.moveTo(0, y); });
        ctx.strokeStyle = color; ctx.lineWidth = 2 * devicePixelRatio; ctx.lineJoin = 'round'; ctx.stroke();
        ctx.lineTo(w, hh); ctx.lineTo(0, hh); ctx.closePath();
        const g = ctx.createLinearGradient(0, 0, 0, hh);
        g.addColorStop(0, color.replace('rgb', 'rgba').replace(')', ',.35)'));
        g.addColorStop(1, color.replace('rgb', 'rgba').replace(')', ',0)'));
        ctx.fillStyle = g; ctx.fill();
      }

      function renderStats() {
        const mem = OS.memInfo(), cc = fs.count('/');
        const vfs = fs.du('/'), total = 5 * 1024 * 1024;
        stats.innerHTML = [
          ['Память (куча)', OS.fmtBytes(mem.used) + ' / ' + OS.fmtBytes(mem.total), mem.used / mem.total],
          ['Виртуальный диск', OS.fmtBytes(vfs) + ' / ' + OS.fmtBytes(total), vfs / total],
          ['localStorage', OS.fmtBytes(OS.store.usage()), OS.store.usage() / (5 * 1024 * 1024)],
          ['Файлов в системе', cc.files + ' файлов · ' + cc.dirs + ' каталогов', Math.min(1, cc.files / 200)]
        ].map((r) => '<div class="mon-st"><div class="mon-st-t"><span>' + r[0] + '</span><b>' + r[1] + '</b></div><div class="mon-bar"><i style="width:' + Math.round(Math.min(1, r[2]) * 100) + '%"></i></div></div>').join('');
      }

      function renderList() {
        const ws = OS.wm.windows.slice();
        win.body.querySelector('#mon-count').textContent = ws.length + 1;
        list.innerHTML = '';
        const head = OS.el('div', { class: 'mon-row mon-head' });
        head.innerHTML = '<span>PID</span><span>Приложение</span><span>Окно</span><span>Время</span><span>Состояние</span><span></span>';
        list.append(head);
        const self = OS.el('div', { class: 'mon-row' });
        self.innerHTML = '<span class="mono">1000</span><span class="row" style="gap:7px"><i class="mon-ic" style="' + OS.Apps.tileStyle(OS.Apps.get('monitor')) + '">' + OS.svg('activity', 11) + '</i>Системный монитор</span><span class="dim">' + OS.esc(win.title) + '</span><span>' + OS.fmtDur(Date.now() - win.openedAt) + '</span><span class="chip">работает</span><span></span>';
        list.append(self);
        ws.forEach((w, i) => {
          const r = OS.el('div', { class: 'mon-row' + (OS.wm.active === w ? ' on' : '') });
          r.innerHTML = '<span class="mono">' + (1001 + i) + '</span>' +
            '<span class="row" style="gap:7px;min-width:0"><i class="mon-ic" style="' + OS.Apps.tileStyle(w.app) + '">' + OS.svg(w.app.icon, 11) + '</i><b class="nowrap">' + OS.esc(w.app.name) + '</b></span>' +
            '<span class="dim nowrap">' + OS.esc((w.title || '').slice(0, 28)) + '</span>' +
            '<span>' + OS.fmtDur(Date.now() - w.openedAt) + '</span>' +
            '<span class="chip">' + (w.minimized ? 'свёрнуто' : OS.wm.active === w ? 'активно' : 'работает') + '</span>' +
            '<span class="row" style="gap:5px"><button class="btn btn-sm" data-act="show">Показать</button><button class="btn btn-danger btn-sm" data-act="kill">Завершить</button></span>';
          r.querySelector('[data-act="show"]').onclick = () => { OS.wm.restore(w); OS.wm.focus(w); };
          r.querySelector('[data-act="kill"]').onclick = () => { OS.wm.close(w); };
          list.append(r);
        });
      }

      let t = 0;
      const tick = setInterval(() => {
        if (!win.root.isConnected) return;
        t++;
        hist.fps.push(OS.perf.fps); if (hist.fps.length > 70) hist.fps.shift();
        const load = Math.round(Math.min(99, OS.wm.windows.length * 6 + (60 - Math.min(60, OS.perf.fps)) * 1.4 + Math.random() * 8));
        hist.cpu.push(load); if (hist.cpu.length > 70) hist.cpu.shift();
        mfps.textContent = OS.perf.fps; mcpu.textContent = load;
        drawGraph(ctxF, cvF, hist.fps, 'rgb(34,211,238)', 75);
        drawGraph(ctxC, cvC, hist.cpu, 'rgb(139,92,246)', 100);
        if (t % 2 === 0) { renderStats(); renderList(); }
      }, 500);
      renderStats(); renderList();
      const u1 = OS.bus.on('wm:change', renderList);
      const u2 = OS.bus.on('wm:open', renderList);
      const u3 = OS.bus.on('wm:close', renderList);
      return () => { clearInterval(tick); removeEventListener('resize', onRs); u1(); u2(); u3(); };
    }
  });

  /* =======================================================================
     QWENSTORE
     ======================================================================= */
  OS.Apps.register({
    id: 'store',
    name: 'QwenStore',
    icon: 'bag',
    color: '#8b5cf6', color2: '#ec4899',
    category: 'Система',
    keywords: 'магазин приложения install store market',
        desktop: false,
width: 900, height: 600, minWidth: 420, minHeight: 340,
    mount(win, api) {
      const cats = ['Все', 'Игры', 'Мультимедиа', 'Продуктивность', 'Система', 'Сеть'];
      let cat = 'Все', q = '';

      win.body.innerHTML =
        '<div class="st">' +
          '<div class="st-hero"><div><h2>QwenStore</h2><p>Приложения устанавливаются мгновенно и работают офлайн — всё живёт в вашем браузере.</p></div>' +
          '<div class="st-hero-ic">' + OS.svg('bag', 30) + '</div></div>' +
          '<div class="st-bar"><div class="st-search">' + OS.svg('search', 15) + '<input placeholder="Поиск приложений" spellcheck="false"></div><div class="st-cats"></div></div>' +
          '<div class="st-grid"></div>' +
        '</div>';
      const grid = win.body.querySelector('.st-grid');
      const catsEl = win.body.querySelector('.st-cats');
      const searchEl = win.body.querySelector('.st-search input');

      catsEl.innerHTML = cats.map((c) => '<button class="st-cat' + (c === cat ? ' on' : '') + '" data-c="' + c + '">' + c + '</button>').join('');
      catsEl.onclick = (e) => { const b = e.target.closest('[data-c]'); if (!b) return; cat = b.dataset.c; catsEl.querySelectorAll('.st-cat').forEach((x) => x.classList.toggle('on', x === b)); render(); };
      searchEl.addEventListener('input', OS.debounce(() => { q = searchEl.value.toLowerCase().trim(); render(); }, 150));

      const desc = {
        terminal: 'Полноценная оболочка qsh с 40+ командами, автодополнением по Tab и историей.',
        files: 'Проводник по виртуальной файловой системе с сеткой, поиском и контекстным меню.',
        notes: 'Редактор текста с сохранением в VFS, счётчиком слов и темой.',
        calculator: 'Калькулятор с историей вычислений и поддержкой клавиатуры.',
        settings: 'Темы, обои, акценты, звук, аккаунт, резервные копии и сброс.',
        paint: 'Рисование на canvas: кисти, палитра, слои-отмена и сохранение в ФС.',
        music: 'Процедурный синтезатор на WebAudio: 4 трека, визуализатор и плейлист.',
        photos: 'Просмотр изображений из ФС и генеративных обоев, слайд-шоу.',
        browser: 'QwenNet — внутренний браузер с собственными страницами и поиском.',
        snake: 'Классическая «Змейка» с ростом сложности и таблицей рекордов.',
        mines: '«Сапёр» на трёх уровнях сложности с флагами и первым безопасным ходом.',
        game2048: 'Головоломка 2048 с отменой хода и лучшим счётом.',
        breakout: 'Арканоид на canvas: платформы, бонусы и уровни.',
        qwen3d: 'Рейкастинг-движок: лабиринт от первого лица на чистом JS.',
        monitor: 'Диспетчер задач: процессы, FPS, загрузка ЦП и память.',
        welcome: 'Короткий тур по возможностям QwenOS.',
        weather: 'Прогноз на пять дней с графиками температуры (симуляция).',
        timer: 'Секундомер и таймер обратного отсчёта с сигналами.',
        matrix: 'Заставка «Матрица» на весь экран — классика 1999 года.'
      };

      function render() {
        const apps = OS.Apps.list().filter((a) => !a.premium && (cat === 'Все' || a.category === cat) && (!q || (a.name + a.id + (a.keywords || '')).toLowerCase().includes(q)));
        grid.innerHTML = '';
        if (!apps.length) { grid.innerHTML = '<div class="st-empty">Ничего не найдено</div>'; return; }
        apps.forEach((a) => {
          const inst = OS.Apps.installed(a.id);
          const card = OS.el('div', { class: 'st-card' });
          card.innerHTML =
            '<div class="st-ic" style="' + OS.Apps.tileStyle(a) + '">' + OS.svg(a.icon, 24) + '</div>' +
            '<div class="st-info"><b>' + OS.esc(a.name) + '</b><span>' + OS.esc(a.category) + ' · ' + (a.storeOnly ? 'бесплатно' : 'в системе') + '</span>' +
            '<p>' + OS.esc(desc[a.id] || 'Приложение QwenOS.') + '</p></div>' +
            '<div class="st-act"></div>';
          const act = card.querySelector('.st-act');
          if (inst) {
            act.innerHTML = '<button class="btn btn-sm btn-accent">Открыть</button>' + (a.storeOnly ? '<button class="btn btn-sm btn-danger">Удалить</button>' : '');
            act.querySelector('.btn-accent').onclick = () => api.open(a.id);
            const un = act.querySelector('.btn-danger');
            if (un) un.onclick = () => {
              OS.Apps.uninstall(a.id); OS.wm.closeApp(a.id);
              OS.toast('Удалено', '«' + a.name + '» больше не установлено', { icon: 'trash' });
              render();
            };
          } else {
            act.innerHTML = '<button class="btn btn-sm">' + OS.svg('download', 14) + ' Установить</button><div class="st-prog hidden"><i></i></div>';
            act.querySelector('button').onclick = function () {
              const btn = this; btn.disabled = true;
              const prog = act.querySelector('.st-prog'); prog.classList.remove('hidden');
              const bar = prog.querySelector('i');
              let p = 0;
              const iv = setInterval(() => {
                p += Math.random() * 22 + 8; bar.style.width = Math.min(100, p) + '%';
                if (p >= 100) {
                  clearInterval(iv);
                  setTimeout(() => {
                    OS.Apps.install(a.id);
                    OS.toast('Установлено', '«' + a.name + '» добавлено в меню «Пуск» и на рабочий стол', { icon: 'bag', onClick: () => api.open(a.id) });
                    render();
                  }, 220);
                }
              }, 130);
            };
          }
          grid.append(card);
        });
      }
      render();
      const u = OS.bus.on('apps:changed', render);
      return () => u();
    }
  });

  /* =======================================================================
     ПРИВЕТСТВИЕ / ТУР
     ======================================================================= */
  OS.Apps.register({
    id: 'welcome',
    name: 'Добро пожаловать',
    icon: 'rocket',
    color: '#f97316', color2: '#db2777',
    category: 'Система',
    keywords: 'тур помощь старт welcome help guide',
        storeOnly: true,
    desktop: false,
    noStart: true,
width: 760, height: 520, minWidth: 380, minHeight: 320,
    mount(win, api) {
      const slides = [
        { icon: 'monitor', title: 'Это настоящая ОС… почти', text: 'Оконный менеджер с перетаскиванием, ресайзом, снаппингом к краям, сворачиванием и Alt+Tab. Всё на чистом DOM — без единой библиотеки.' },
        { icon: 'terminal', title: 'Терминал qsh', text: 'Более 40 команд: ls, cd, cat, tree, grep, neofetch, matrix, cowsay. Работает автодополнение по Tab, история по ↑/↓ и перенаправление вывода через >.' },
        { icon: 'folder', title: 'Файловая система', text: 'Каталоги и файлы живут в localStorage. Создавайте, переименовывйте, перемещайте — всё сохраняется между перезагрузками.' },
        { icon: 'gamepad', title: 'Игры и демо', text: 'Змейка, Сапёр, 2048, Арканоид и Qwen3D — рейкастинг-лабиринт от первого лица, написанный с нуля.' },
        { icon: 'palette', title: 'Оформление под себя', text: '5 тем, 8 акцентов, 12 обоев, анимированные эффекты, масштаб интерфейса и живой звук на WebAudio.' },
        { icon: 'zap', title: 'Горячие клавиши', text: 'Ctrl+Alt+T — терминал · Ctrl+Alt+F — файлы · Meta — «Пуск» · Alt+Tab — окна · Win+Tab — обзор · Esc — закрыть.' }
      ];
      let i = 0;
      win.body.innerHTML = '<div class="wc"><div class="wc-body"></div><div class="wc-nav"><button class="btn btn-sm" data-a="prev">Назад</button><div class="wc-dots"></div><button class="btn btn-sm btn-accent" data-a="next">Далее</button></div></div>';
      const body = win.body.querySelector('.wc-body'), dots = win.body.querySelector('.wc-dots');
      function render() {
        const s = slides[i];
        body.innerHTML = '<div class="wc-ic">' + OS.svg(s.icon, 40) + '</div><h2>' + s.title + '</h2><p>' + s.text + '</p>';
        dots.innerHTML = slides.map((_, k) => '<i class="' + (k === i ? 'on' : '') + '"></i>').join('');
        win.body.querySelector('[data-a="prev"]').disabled = i === 0;
        win.body.querySelector('[data-a="next"]').textContent = i === slides.length - 1 ? 'Начать работу' : 'Далее';
      }
      win.body.querySelector('[data-a="prev"]').onclick = () => { if (i > 0) { i--; render(); } };
      win.body.querySelector('[data-a="next"]').onclick = () => { if (i < slides.length - 1) { i++; render(); } else { S.set('tips', false); api.close(); OS.Desktop && OS.Desktop.renderAll(); } };
      dots.onclick = (e) => { const k = Array.from(dots.children).indexOf(e.target); if (k >= 0) { i = k; render(); } };
      render();
    }
  });

  /* =======================================================================
     ДИАЛОГ (скрытое служебное приложение)
     ======================================================================= */
  OS.Apps.register({
    id: 'dialog',
    name: 'Свойства',
    icon: 'info',
    color: '#475569', color2: '#1e293b',
    category: 'Система',
    hidden: true, desktop: false, resizable: false,
    width: 420, height: 360, minWidth: 340, minHeight: 220,
    mount(win) {
      const p = win.params || {};
      win.setTitle(p.title || 'Информация');
      win.body.innerHTML =
        '<div class="dlg">' +
          '<div class="dlg-ic" style="background:linear-gradient(135deg,var(--accent),var(--accent-2))">' + OS.svg(p.icon || 'info', 26) + '</div>' +
          '<div class="dlg-rows">' + (p.rows || []).map((r) => '<div class="dlg-row"><span>' + OS.esc(r[0]) + '</span><b>' + OS.esc(String(r[1])) + '</b></div>').join('') + '</div>' +
          '<div class="dlg-foot"><button class="btn btn-accent btn-sm" data-a="ok">Закрыть</button></div>' +
        '</div>';
      win.body.querySelector('[data-a="ok"]').onclick = () => win.close();
    }
  });
})(window.OS);
