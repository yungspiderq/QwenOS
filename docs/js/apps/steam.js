/* ==========================================================================
   QwenOS 3.0 — apps/steam.js
   Steam: магазин (монеты зарабатываются в играх), библиотека и профиль
   ========================================================================== */
(function (OS) {
  'use strict';

  const PLAYED_KEY = 'steam.played';

  OS.Apps.register({
    id: 'steam',
    name: 'Steam',
    icon: 'steam',
    color: '#1b2838', color2: '#2a475e',
    category: 'Игры',
    keywords: 'steam стим магазин игр библиотека библиотека игр launcher store',
    width: 960, height: 640, minWidth: 480, minHeight: 400,
    mount(win, api) {
      if (!OS.coins) {
        win.body.innerHTML = '<div class="gm-fallback" style="height:100%">' + OS.svg('steam', 40) +
          '<p><b>Кэш браузера рассинхронизирован</b></p>' +
          '<p class="dim">Часть файлов QwenOS приехала из старого кэша service worker.<br>Нажмите кнопку — система сбросит кэш и перезагрузится.</p>' +
          '<button class="btn btn-accent btn-sm" data-a="heal">Сбросить кэш и перезагрузить</button></div>';
        win.body.querySelector('[data-a="heal"]').onclick = () => {
          const done = () => location.reload();
          if (navigator.serviceWorker) navigator.serviceWorker.getRegistration().then((r) => (r ? r.unregister() : null)).then(done, done);
          else done();
        };
        return;
      }
      let tab = 'store';
      win.body.innerHTML =
        '<div class="stm">' +
          '<div class="stm-head">' +
            '<div class="stm-logo">' + OS.svg('steam', 22) + '<b>STEAM<span>OS</span></b></div>' +
            '<div class="stm-tabs">' +
              '<button data-t="store" class="on">Магазин</button>' +
              '<button data-t="lib">Библиотека</button>' +
              '<button data-t="prof">Профиль</button>' +
            '</div>' +
            '<div class="stm-wallet" title="Монеты зарабатываются в играх QwenOS">' + OS.svg('coin', 15) + '<b class="stm-coins">0</b></div>' +
          '</div>' +
          '<div class="stm-body"></div>' +
        '</div>';
      const body = win.body.querySelector('.stm-body');
      const coinsEl = win.body.querySelector('.stm-coins');

      const GAMES = () => OS.Apps.list().filter((a) => a.category === 'Игры' && a.id !== 'steam');
      const PREMIUM = () => OS.Apps.list().filter((a) => a.premium);
      const played = (id) => (OS.store.get(PLAYED_KEY, {}) || {})[id] || 0;
      const bumpPlayed = (id) => { const m = OS.store.get(PLAYED_KEY, {}) || {}; m[id] = (m[id] || 0) + 1; OS.store.set(PLAYED_KEY, m); };

      const priceTag = (a) => a.premium ? a.premium + ' монет' : 'Бесплатно';

      function card(a, extraBtn) {
        const inst = OS.Apps.installed(a.id);
        const d = OS.el('div', { class: 'stm-card' + (inst ? ' owned' : '') });
        d.innerHTML =
          '<div class="stm-cap" style="background:linear-gradient(135deg,' + a.color + ',' + (a.color2 || a.color) + ')">' + OS.svg(a.icon, 30) + '</div>' +
          '<div class="stm-ci"><b>' + OS.esc(a.name) + '</b><span>' + OS.esc(a.category) + (a.premium ? ' · премиум' : '') + '</span>' +
          '<p>' + OS.esc(DESC[a.id] || 'Приложение QwenOS.') + '</p></div>' +
          '<div class="stm-ca">' + (extraBtn || '') + '<span class="stm-price' + (a.premium ? '' : ' free') + '">' + (inst ? 'В библиотеке' : priceTag(a)) + '</span></div>';
        return d;
      }
      const DESC = {
        snake: 'Объёмная змейка на three.js: растёт, ускоряется, собирает бонусы.',
        mines: 'Сапёр в 3D: клики рейкастом, флаги, три уровня сложности.',
        game2048: 'Легендарная головоломка со скольжением плиток в 3D.',
        breakout: 'Арканоид с физикой отскока, шестью уровнями и жизнями.',
        qwen3d: 'Лабиринт от первого лица: туман, факел, монеты, миникарта.',
        matrix: 'Заставка «Матрица»: цифровой дождь на весь экран.',
        weather: 'Погода с графиками температуры (симуляция).',
        timer: 'Секундомер и таймер обратного отсчёта.'
      };

      function buyOrPlay(a, d) {
        const act = OS.el('button', { class: 'btn btn-sm ' + (OS.Apps.installed(a.id) ? '' : 'btn-accent') });
        act.textContent = OS.Apps.installed(a.id) ? 'Играть' : (a.premium ? 'Купить' : 'Установить');
        act.onclick = () => {
          if (OS.Apps.installed(a.id)) {
            bumpPlayed(a.id);
            api.open(a.id);
            OS.toast('Steam', 'Запуск «' + a.name + '»', { icon: 'play', timeout: 1800 });
            return;
          }
          if (a.premium) {
            if (!OS.coins.spend(a.premium)) {
              OS.sfx.play('error');
              return OS.toast('Недостаточно монет', 'Нужно ' + a.premium + ', у вас ' + OS.coins.get() + '. Играйте в игры QwenOS, чтобы заработать: змейка, сапёр, 2048, арканоид, Qwen3D', { icon: 'coin', timeout: 6500 });
            }
            OS.Apps.install(a.id);
            OS.sfx.play('ok');
            OS.toast('Покупка совершена', '«' + a.name + '» добавлено в библиотеку за ' + a.premium + ' монет', { icon: 'steam' });
          } else {
            OS.Apps.install(a.id);
            OS.toast('Установлено', '«' + a.name + '» уже в библиотеке', { icon: 'download' });
          }
          render();
        };
        d.querySelector('.stm-ca').prepend(act);
      }

      function render() {
        coinsEl.textContent = OS.coins.get();
        win.body.querySelectorAll('.stm-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
        body.innerHTML = '';
        body.scrollTop = 0;

        if (tab === 'store') {
          const feat = OS.Apps.get('qwen3d');
          const hero = OS.el('div', { class: 'stm-hero' });
          hero.innerHTML =
            '<div class="stm-hero-art">' + OS.svg('cube', 54) + '</div>' +
            '<div class="stm-hero-tx"><span class="chip">Рекомендуемое</span><h2>' + OS.esc(feat.name) + '</h2>' +
            '<p>Настоящий 3D от первого лица на three.js: блуждайте по лабиринту с факелом, собирайте монеты и побейте рекорд скорости. За прохождение — <b>100 монет</b>.</p>' +
            '<div class="row" style="gap:8px;margin-top:10px"><button class="btn btn-accent btn-sm" data-feat="1">' + (OS.Apps.installed('qwen3d') ? 'Играть' : 'Установить бесплатно') + '</button>' +
            '<span class="stm-price free">Бесплатно</span></div></div>';
          hero.querySelector('[data-feat]').onclick = () => {
            if (!OS.Apps.installed('qwen3d')) OS.Apps.install('qwen3d');
            else bumpPlayed('qwen3d');
            api.open('qwen3d'); render();
          };
          body.append(hero);

          body.insertAdjacentHTML('beforeend', '<div class="stm-h">Игры QwenOS — бесплатно в библиотеку</div>');
          const g = OS.el('div', { class: 'stm-grid' });
          GAMES().forEach((a) => { const d = card(a); buyOrPlay(a, d); g.append(d); });
          body.append(g);

          body.insertAdjacentHTML('beforeend', '<div class="stm-h">Премиум — за монеты ' + OS.svg('coin', 12) + '</div>');
          const pg = OS.el('div', { class: 'stm-grid' });
          PREMIUM().forEach((a) => { const d = card(a); buyOrPlay(a, d); pg.append(d); });
          body.append(pg);
          body.insertAdjacentHTML('beforeend', '<div class="stm-note">' + OS.svg('info', 13) + '<div>Монеты начисляются за игровые результаты: змейка (' + '1 монета за 10 очков' + '), сапёр (+50 за победу), 2048, арканоид и Qwen3D (+100). Потратить их можно только здесь.</div></div>');
        }

        if (tab === 'lib') {
          const owned = OS.Apps.list().filter((a) => OS.Apps.installed(a.id) && (a.category === 'Игры' || a.premium));
          if (!owned.length) {
            body.innerHTML = '<div class="stm-empty">' + OS.svg('archive', 42) + '<p>Библиотека пуста</p><p class="dim">Загляните в магазин — игры QwenOS бесплатны.</p><button class="btn btn-accent btn-sm" data-go="store">В магазин</button></div>';
            body.querySelector('[data-go]').onclick = () => { tab = 'store'; render(); };
            return;
          }
          body.insertAdjacentHTML('beforeend', '<div class="stm-h">Моя библиотека · ' + owned.length + '</div>');
          const list = OS.el('div', { class: 'stm-lib' });
          owned.forEach((a) => {
            const row = OS.el('div', { class: 'stm-li' });
            row.innerHTML = '<i style="background:linear-gradient(135deg,' + a.color + ',' + (a.color2 || a.color) + ')">' + OS.svg(a.icon, 17) + '</i>' +
              '<div class="tx"><b>' + OS.esc(a.name) + '</b><span>запусков: ' + played(a.id) + (a.premium ? ' · премиум' : '') + '</span></div>' +
              '<button class="btn btn-sm btn-accent">Играть</button>';
            row.querySelector('button').onclick = () => { bumpPlayed(a.id); api.open(a.id); OS.toast('Steam', 'Запуск «' + a.name + '»', { icon: 'play', timeout: 1600 }); render(); };
            list.append(row);
          });
          body.append(list);
        }

        if (tab === 'prof') {
          const user = OS.settings.get('user');
          const total = Object.values(OS.store.get(PLAYED_KEY, {}) || {}).reduce((s, v) => s + v, 0);
          const achs = [
            ['Первый запуск', total > 0, 'Запустить игру из Steam'],
            ['Змеевод', (OS.store.get('best.snake', 0) || 0) >= 100, 'Набрать 100 очков в змейке'],
            ['Сапёр-про', (OS.store.get('best.mines.mid', 0) || 0) > 0, 'Пройти сапёра на «Любителе»'],
            ['Архитектор 2048', (OS.store.get('best.2048', 0) || 0) >= 2048, 'Собрать плитку 2048'],
            ['Стена-breaking', (OS.store.get('best.breakout', 0) || 0) >= 300, '300 очков в арканоиде'],
            ['Спелеолог', (OS.store.get('best.qwen3d', 0) || 0) > 0, 'Пройти лабиринт Qwen3D'],
            ['Инвестор', OS.coins.earned() >= 100, 'Заработать 100 монет'],
            ['Кит', OS.coins.earned() >= 300, 'Заработать 300 монет']
          ];
          const done = achs.filter((a) => a[1]).length;
          body.innerHTML =
            '<div class="stm-prof">' +
              '<div class="stm-av">' + OS.esc(OS.settings.get('avatarText') || user[0].toUpperCase()) + '</div>' +
              '<div class="stm-pt"><b>' + OS.esc(user) + '</b><span>Уровень ' + OS.coins.level() + ' · QwenOS Steam</span>' +
              '<div class="stm-lvl"><i style="width:' + ((OS.coins.earned() % 60) / 60 * 100).toFixed(0) + '%"></i></div>' +
              '<span class="dim" style="font-size:11px">до следующего уровня: ' + Math.max(0, 60 - (OS.coins.earned() % 60)) + ' монет опыта</span></div>' +
              '<div class="stm-stats">' +
                '<div>' + OS.svg('coin', 15) + '<b>' + OS.coins.get() + '</b><span>монет</span></div>' +
                '<div>' + OS.svg('chart', 15) + '<b>' + OS.coins.earned() + '</b><span>заработано</span></div>' +
                '<div>' + OS.svg('play', 15) + '<b>' + total + '</b><span>запусков</span></div>' +
                '<div>' + OS.svg('star', 15) + '<b>' + done + '/' + achs.length + '</b><span>ачивок</span></div>' +
              '</div>' +
              '<div class="stm-h">Достижения</div>' +
              '<div class="stm-achs">' + achs.map((a) =>
                '<div class="stm-ach' + (a[1] ? ' on' : '') + '">' + OS.svg(a[1] ? 'star' : 'lock', 16) + '<div><b>' + a[0] + '</b><span>' + a[2] + '</span></div></div>').join('') + '</div>' +
            '</div>';
        }
        win.setTitle('Steam — ' + ({ store: 'магазин', lib: 'библиотека', prof: 'профиль' })[tab]);
      }

      win.body.querySelector('.stm-tabs').addEventListener('click', (e) => {
        const b = e.target.closest('[data-t]'); if (!b) return;
        tab = b.dataset.t; render();
      });
      const u1 = OS.bus.on('coins', () => { if (win.root.isConnected) render(); });
      const u2 = OS.bus.on('apps:changed', () => { if (win.root.isConnected) render(); });
      render();
      win.data.state = { get coins() { return OS.coins.get(); }, get tab() { return tab; } };
      return () => { u1(); u2(); };
    }
  });
})(window.OS);
