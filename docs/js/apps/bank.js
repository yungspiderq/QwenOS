/* ==========================================================================
   QwenOS 3.0 — apps/bank.js
   QwenBank: счёт, перевод в Steam и работа (три мини-игры со сменами):
   Курьер (клик по целям), Печатник (скоростной набор), Тестировщик (найди баг)
   ========================================================================== */
(function (OS) {
  'use strict';

  const JOBS = {
    courier: {
      name: 'Курьер QwenExpress', icon: 'send', pay: '3 монеты / доставка',
      desc: 'Смена 30 секунд: заказы подсвечиваются на карте района — кликайте, чтобы доставить. Чем больше доставок, тем больше зарплата.',
      len: 30
    },
    typist: {
      name: 'Оператор набора', icon: 'keyboard', pay: '2 монеты / слово',
      desc: 'Смена 45 секунд: вводите показанные слова без ошибок и жмите Enter. Идеально для разминки пальцев перед терминалом.',
      len: 45
    },
    qa: {
      name: 'Тестировщик QwenOS', icon: 'shield', pay: '5 монет / баг',
      desc: '5 раундов: в каждом четыре строки кода, одна с ошибкой. Найдите баг раньше, чем он добрался до релиза.',
      len: 0
    }
  };

  const WORDS = ['qwen', 'терминал', 'обои', 'курсор', 'память', 'диск', 'поток', 'кэш', 'массив', 'цикл', 'байт', 'фрейм', 'шейдер', 'вектор', 'полигон', 'кошелёк', 'монета', 'смена', 'заказ', 'релиз'];

  const QA_ROUNDS = [
    { lines: ['for (let i = 0; i < 10; i++) {', '  sum += i;', '}', 'return sum;;'], bug: 3 },
    { lines: ['const a = [1, 2, 3];', 'a.lenght = 4;', 'a.push(5);', 'return a;'], bug: 1 },
    { lines: ['if (x = 5) {', '  open();', '}', 'close();'], bug: 0 },
    { lines: ['function f() {', '  retrun 42;', '}', 'f();'], bug: 1 },
    { lines: ['let i = 0;', 'while (i < 5) {', '  log(i);', '  i++;'], bug: 3 },
    { lines: ['const s = "привет";', 's = s.toUpperCase();', 'print(s);', '// ok'], bug: 1 },
    { lines: ['arr.forEach(x => {', '  total += x;', '});', 'return total # готово'], bug: 3 },
    { lines: ['if (ready === true)', '  launch();', 'else', '  wait()'], bug: 3 }
  ];

  OS.Apps.register({
    id: 'bank',
    name: 'Банк',
    icon: 'coin',
    color: '#16a34a', color2: '#14532d',
    category: 'Продуктивность',
    desktop: false,
    keywords: 'банк банк работа деньги монеты счёт перевод steam job bank',
    width: 820, height: 600, minWidth: 440, minHeight: 400,
    mount(win, api) {
      let tab = 'account', shift = null;
      win.body.innerHTML =
        '<div class="bnk">' +
          '<div class="bnk-head">' +
            '<div class="bnk-logo">' + OS.svg('coin', 20) + '<b>QwenBank</b></div>' +
            '<div class="bnk-tabs"><button data-t="account" class="on">Счёт</button><button data-t="work">Работа</button><button data-t="hist">История</button></div>' +
            '<div class="bnk-bal" title="Баланс счёта">' + OS.svg('coin', 14) + '<b class="bnk-sum">0</b></div>' +
          '</div>' +
          '<div class="bnk-body"></div>' +
        '</div>';
      const body = win.body.querySelector('.bnk-body');
      const sumEl = win.body.querySelector('.bnk-sum');

      function render() {
        sumEl.textContent = OS.bank.balance();
        win.body.querySelectorAll('.bnk-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
        body.innerHTML = '';
        body.scrollTop = 0;
        if (shift) return renderShift();
        if (tab === 'account') renderAccount();
        else if (tab === 'work') renderWork();
        else renderHist();
        win.setTitle('Банк — ' + ({ account: 'счёт', work: 'работа', hist: 'история' })[tab]);
      }

      function renderAccount() {
        const bal = OS.bank.balance(), wal = OS.coins.get();
        const w = OS.el('div', { class: 'bnk-acc' });
        w.innerHTML =
          '<div class="bnk-cards">' +
            '<div class="bnk-card"><span>Счёт QwenBank</span><b>' + OS.svg('coin', 16) + ' ' + bal + '</b><small>зарплата приходит сюда</small></div>' +
            '<div class="bnk-card steam-c"><span>Кошелёк Steam</span><b>' + OS.svg('steam', 16) + ' ' + wal + '</b><small>тратится в Steam</small></div>' +
          '</div>' +
          '<div class="bnk-h">Пополнить Steam со счёта</div>' +
          '<div class="bnk-transfer">' +
            [50, 100, 250].map((n) => '<button class="btn btn-sm" data-t="' + n + '"' + (bal < n ? ' disabled' : '') + '>' + OS.svg('right', 13) + ' ' + n + '</button>').join('') +
            '<button class="btn btn-sm" data-t="all"' + (bal < 1 ? ' disabled' : '') + '>Перевести всё (' + bal + ')</button>' +
          '</div>' +
          '<div class="bnk-note">' + OS.svg('info', 13) + '<div>Монеты на счёте зарабатываются работой (вкладка «Работа»). Перевод со счёта на кошелёк Steam мгновенный и без комиссии — QwenBank любит геймеров.</div></div>';
        w.querySelectorAll('[data-t]').forEach((b) => {
          b.onclick = () => {
            const n = b.dataset.t === 'all' ? OS.bank.balance() : parseInt(b.dataset.t, 10);
            if (OS.bank.toSteam(n)) {
              OS.sfx.play('ok');
              OS.toast('Steam пополнен', '+' + n + ' монет на кошельке из средств банка', { icon: 'steam' });
              render();
            } else OS.toast('Недостаточно средств', 'На счёте ' + OS.bank.balance() + ' — сначала поработайте', { icon: 'x', timeout: 3200 });
          };
        });
        body.append(w);
      }

      function renderWork() {
        const w = OS.el('div');
        w.innerHTML = '<div class="bnk-h">Доступные работы</div><div class="bnk-jobs">' +
          Object.keys(JOBS).map((id) => {
            const j = JOBS[id];
            return '<div class="bnk-job"><div class="bnk-job-ic">' + OS.svg(j.icon, 22) + '</div>' +
              '<div class="bnk-job-tx"><b>' + j.name + '</b><span class="chip">' + OS.svg('coin', 11) + ' ' + j.pay + '</span>' +
              '<p>' + j.desc + '</p></div>' +
              '<button class="btn btn-accent btn-sm" data-job="' + id + '">Начать смену</button></div>';
          }).join('') + '</div>' +
          '<div class="bnk-note">' + OS.svg('zap', 13) + '<div>Зарплата зачисляется на счёт QwenBank сразу после смены. Откройте вкладку «Счёт», чтобы перевести монеты в Steam.</div></div>';
        w.querySelectorAll('[data-job]').forEach((b) => {
          b.onclick = () => { startShift(b.dataset.job); };
        });
        body.append(w);
      }

      function renderHist() {
        const h = OS.bank.history();
        const w = OS.el('div');
        w.innerHTML = '<div class="bnk-h">Операции по счёту</div>';
        if (!h.length) w.innerHTML += '<div class="bnk-empty">' + OS.svg('chart', 38) + '<p>Операций пока нет</p><p class="dim">Поработайте смену или переведите монеты в Steam</p></div>';
        else w.innerHTML += '<div class="bnk-hist">' + h.map((r) =>
          '<div class="bnk-hi"><span>' + OS.fmtDateTime(r.t) + '</span><i>' + OS.esc(r.src) + '</i><b class="' + (r.n >= 0 ? 'plus' : 'minus') + '">' + (r.n >= 0 ? '+' : '') + r.n + '</b></div>').join('') + '</div>';
        body.append(w);
      }

      /* ------------------------------------------------------- смены */
      function startShift(id) {
        shift = { id: id, left: JOBS[id].len, earned: 0, done: 0, timer: null, round: 0 };
        render();
      }
      function endShift(reason) {
        const s = shift;
        clearInterval(s.timer);
        shift = null;
        if (s.earned > 0) {
          OS.bank.deposit(s.earned, 'работа: ' + JOBS[s.id].name.toLowerCase());
          OS.sfx.play('ok');
          OS.toast('Зарплата начислена', '+' + s.earned + ' монет на счёт QwenBank (' + JOBS[s.id].name + ')', { icon: 'coin', timeout: 6000 });
        } else OS.toast('Смена окончена', 'Заработок 0 — попробуйте ещё раз', { icon: 'info', timeout: 3200 });
        render();
      }

      function renderShift() {
        const s = shift;
        const head = '<div class="bnk-shift-h"><b>' + JOBS[s.id].name + '</b>' +
          '<span>заработано: <b class="plus">' + s.earned + '</b></span>' +
          (s.id === 'qa' ? '<span>раунд ' + (s.round + 1) + '/5</span>' : '<span>осталось: <b>' + s.left + ' с</b></span>') +
          '<button class="btn btn-sm" data-end>Завершить смену</button></div>';
        const w = OS.el('div', { class: 'bnk-shift' });
        w.innerHTML = head + '<div class="bnk-shift-body"></div>';
        body.append(w);
        w.querySelector('[data-end]').onclick = () => endShift('manual');
        const zone = w.querySelector('.bnk-shift-body');

        if (s.id === 'courier') {
          zone.innerHTML = '<div class="bnk-courier">' + Array.from({ length: 9 }, (_, i) => '<button class="bnk-cell" data-i="' + i + '"></button>').join('') + '</div>';
          let target = -1;
          const cells = zone.querySelectorAll('.bnk-cell');
          const newTarget = () => {
            if (target >= 0) cells[target].classList.remove('on');
            target = OS.rndi(0, 8);
            cells[target].classList.add('on');
          };
          newTarget();
          s.timer = setInterval(() => {
            s.left--;
            const el = body.querySelector('.bnk-shift-h b.plus');
            const tm = body.querySelectorAll('.bnk-shift-h span b')[1];
            if (tm) tm.textContent = s.left + ' с';
            if (el) el.textContent = s.earned;
            if (Math.random() < .35) newTarget();
            if (s.left <= 0) endShift();
          }, 1000);
          zone.onclick = (e) => {
            const c = e.target.closest('[data-i]');
            if (!c) return;
            if (+c.dataset.i === target) {
              s.done++; s.earned += 3;
              OS.sfx.play('click');
              c.classList.add('hit');
              setTimeout(() => c.classList.remove('hit'), 180);
              newTarget();
              body.querySelector('.bnk-shift-h b.plus').textContent = s.earned;
            }
          };
        }

        if (s.id === 'typist') {
          let word = OS.pick(WORDS);
          zone.innerHTML = '<div class="bnk-type"><div class="bnk-word"></div><input class="field" placeholder="печатайте здесь и Enter…" autocomplete="off" spellcheck="false"><div class="bnk-type-st"></div></div>';
          const wEl = zone.querySelector('.bnk-word'), inp = zone.querySelector('input'), stEl = zone.querySelector('.bnk-type-st');
          const nextWord = () => { word = OS.pick(WORDS); wEl.textContent = word; inp.value = ''; stEl.textContent = 'слов за смену: ' + s.done; };
          nextWord();
          setTimeout(() => inp.focus(), 60);
          inp.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            if (inp.value.trim().toLowerCase() === word) {
              s.done++; s.earned += 2;
              OS.sfx.play('ok');
              nextWord();
            } else {
              OS.sfx.play('error');
              inp.classList.add('err');
              setTimeout(() => inp.classList.remove('err'), 260);
            }
          });
          s.timer = setInterval(() => {
            s.left--;
            const tm = body.querySelectorAll('.bnk-shift-h span b')[1];
            if (tm) tm.textContent = s.left + ' с';
            body.querySelector('.bnk-shift-h b.plus').textContent = s.earned;
            if (s.left <= 0) endShift();
          }, 1000);
        }

        if (s.id === 'qa') {
          const round = () => {
            if (s.round >= 5) return endShift();
            const r = QA_ROUNDS[(s.round * 3 + OS.rndi(0, 2)) % QA_ROUNDS.length];
            zone.innerHTML = '<div class="bnk-qa"><p class="dim">Найдите строку с ошибкой:</p><pre>' +
              r.lines.map((l, i) => '<button class="bnk-qa-l" data-i="' + i + '">' + (i + 1) + '  ' + OS.esc(l) + '</button>').join('') + '</pre></div>';
            body.querySelectorAll('.bnk-shift-h span')[1].innerHTML = 'раунд ' + (s.round + 1) + '/5';
            zone.querySelectorAll('[data-i]').forEach((b) => {
              b.onclick = () => {
                if (+b.dataset.i === r.bug) {
                  s.done++; s.earned += 5;
                  b.classList.add('good');
                  OS.sfx.play('ok');
                } else {
                  b.classList.add('bad');
                  OS.sfx.play('error');
                }
                s.round++;
                setTimeout(round, 420);
              };
            });
          };
          round();
        }
      }

      win.body.querySelector('.bnk-tabs').addEventListener('click', (e) => {
        const b = e.target.closest('[data-t]'); if (!b || shift) return;
        tab = b.dataset.t; render();
      });
      const u1 = OS.bus.on('bank', () => { if (win.root.isConnected && !shift) render(); });
      const u2 = OS.bus.on('coins', () => { if (win.root.isConnected && !shift) render(); });
      render();
      win.data.state = { get balance() { return OS.bank.balance(); }, get shift() { return !!shift; } };
      return () => { if (shift) clearInterval(shift.timer); u1(); u2(); };
    }
  });
})(window.OS);
