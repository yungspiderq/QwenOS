/* ============ Steam QwenStore — магазин игр за внутриигровую валюту ============ */

const Money = {
  KEY: 'qwenos_money', OWNED: 'qwenos_owned', STATS: 'qwenos_mstats',
  bal() { return +(localStorage.getItem(this.KEY) || 0); },
  setBal(v) { localStorage.setItem(this.KEY, Math.max(0, Math.round(v))); this.renderHUD(); },
  add(v) { this.setBal(this.bal() + v); },
  spend(v) { if (this.bal() < v) return false; this.add(-v); return true; },
  owned() { try { return JSON.parse(localStorage.getItem(this.OWNED)) || {}; } catch(e) { return {}; } },
  own(id, price) { const o = this.owned(); o[id] = { price, date: new Date().toLocaleDateString('ru-RU') }; localStorage.setItem(this.OWNED, JSON.stringify(o)); },
  stats() { try { return JSON.parse(localStorage.getItem(this.STATS)) || {}; } catch(e) { return {}; } },
  bump(stat, inc = 1) { const s = this.stats(); s[stat] = (s[stat] || 0) + inc; localStorage.setItem(this.STATS, JSON.stringify(s)); return s[stat]; },
  fmt(n) { return n.toLocaleString('ru-RU') + ' 🪙'; },
  renderHUD() {
    document.querySelectorAll('.money-hud').forEach(el => el.textContent = this.fmt(this.bal()));
  }
};

/* Каталог Steam-магазина */
const SHOP_ITEMS = [
  { id: 'doom', name: 'DOOM (Qwen Edition)', icon: '👹', price: 500, cat: 'Экшен', desc: 'Легендарный шутер 1993 года в вашем браузере. Радуйтесь, будто нашли пентакль.', tag: 'ХИТ' },
  { id: 'pong', name: 'Понг Deluxe', icon: '🏓', price: 150, cat: 'Аркада', desc: 'Понг против ИИ с ускорением мяча и таблицей рекордов.' },
  { id: 'breakout', name: 'Арканоид NEON', icon: '🧱', price: 200, cat: 'Аркада', desc: 'Неоновый арканоид: 3 жизни, комбо и бонусные кирпичи.' },
  { id: 'space', name: 'Космос: Астероиды', icon: '🚀', price: 300, cat: 'Экшен', desc: 'Космический шутер с параллаксом звёзд и прокачкой огня.' },
  { id: 'flags', name: 'Флагман Квиз', icon: '🏳️', price: 120, cat: 'Викторина', desc: '60 флагов мира, серии и глобальный рекорд streak.' },
  { id: 'tictactoe', name: 'Крестики-нолики AI+', icon: '⭕', price: 100, cat: 'Классика', desc: 'Невозможно обыграть. Проверь себя на минимаксе.' },
  { id: 'skin-gold', name: 'Скин «Золото»', icon: '👑', price: 700, cat: 'Кастомизация', desc: 'Роскошная золотая тема окон и панели. Чистый люкс.', tag: 'LUX' },
];

/* ---------- Приложение «Steam» ---------- */
registerApp('shop', {
  name: 'Steam', icon: '🎮', width: 760, height: 540,
  open(win) {
    win.body.innerHTML = `
      <div class="shop">
        <div class="sh-head">
          <div class="sh-logo">🎮 Steam <span>QwenStore</span></div>
          <div class="sh-balance money-hud" title="Ваш баланс">0 🪙</div>
          <button class="sh-work">💼 Заработать</button>
        </div>
        <div class="sh-tabs"></div>
        <div class="sh-grid"></div>
        <div class="sh-note">💡 Деньги зарабатываются в разделе «Заработок»: опросы, клипы, капча и мини-игры.</div>
      </div>`;
    const grid = win.body.querySelector('.sh-grid');
    const tabsEl = win.body.querySelector('.sh-tabs');
    let tab = 'Все';

    function renderTabs() {
      const cats = ['Все', ...new Set(SHOP_ITEMS.map(i => i.cat)), '📦 Мои игры'];
      tabsEl.innerHTML = '';
      cats.forEach(c => {
        const b = document.createElement('button');
        b.textContent = c; b.className = c === tab ? 'active' : '';
        b.onclick = () => { tab = c; renderGrid(); renderTabs(); };
        tabsEl.appendChild(b);
      });
    }
    function renderGrid() {
      grid.innerHTML = '';
      const owned = Money.owned();
      if (tab === '📦 Мои игры') {
        const mine = SHOP_ITEMS.filter(i => owned[i.id]);
        if (!mine.length) { grid.innerHTML = '<div class="sh-empty">Покупайте игры — они появятся здесь 🎮<br><small>Не хватает 🪙? Жмите «💼 Заработать» наверху!</small></div>'; return; }
        mine.forEach(i => grid.appendChild(card(i, owned[i.id])));
        return;
      }
      (tab === 'Все' ? SHOP_ITEMS : SHOP_ITEMS.filter(i => i.cat === tab)).forEach(i => grid.appendChild(card(i, owned[i.id])));
    }
    function card(item, own) {
      const d = document.createElement('div');
      d.className = 'sh-card' + (own ? ' owned' : '');
      d.innerHTML = `
        ${item.tag ? `<span class="sh-tag">${item.tag}</span>` : ''}
        <div class="sh-icon">${item.icon}</div>
        <div class="sh-name">${item.name}</div>
        <div class="sh-cat">${item.cat}</div>
        <div class="sh-desc">${item.desc}</div>
        <div class="sh-foot">
          <span class="sh-price">${own ? '✅ куплено · ' + Money.fmt(item.price) : Money.fmt(item.price)}</span>
          <button>${own ? '▶ Играть' : '🛒 Купить'}</button>
        </div>`;
      d.querySelector('button').onclick = () => {
        if (own) { if (item.id === 'skin-gold') Skins.apply('gold'); else openGame(item.id); return; }
        if (Money.spend(item.price)) {
          Money.own(item.id, item.price);
          OS.notify('🎮 Steam', `${item.name} куплена за ${Money.fmt(item.price)}! ${item.id === 'skin-gold' ? 'Золотая тема применена 👑' : 'Приятной игры 🎮'}`);
          if (item.id === 'skin-gold') Skins.apply('gold');
          renderGrid();
        } else {
          OS.notify('🎮 Steam', `Недостаточно средств (${Money.fmt(item.price)}). Заработайте 🪙 — кнопка «💼 Заработать».`);
          work();
        }
      };
      return d;
    }

    /* ---------- Заработок ---------- */
    const main = win.body;
    function work() {
      main.innerHTML = `
        <div class="sh-work">
          <button class="sh-back">← В магазин</button>
          <h2>💼 Биржа заработков</h2>
          <p class="sh-wsub">Выполняй задания — получай 🪙. Баланс: <b class="money-hud">0</b></p>
          <div class="sh-jobs">
            <div class="job" data-j="quiz"><div class="j-icon">📋</div><div><b>Опрос дня</b><br><small>+40 🪙 · 5 вопросов</small></div></div>
            <div class="job" data-j="clip"><div class="j-icon">🎬</div><div><b>Посмотреть «рекламу»</b><br><small>+25 🪙 · 5 секунд</small></div></div>
            <div class="job" data-j="captcha"><div class="j-icon">🤖</div><div><b>Пройти капчу</b><br><small>+15 🪙 · ты же не бот?</small></div></div>
            <div class="job" data-j="clicker"><div class="j-icon">👆</div><div><b>Кликер удачи</b><br><small>0–100 🪙 · рискни</small></div></div>
            <div class="job" data-j="daily"><div class="j-icon">📅</div><div><b>Ежедневный бонус</b><br><small>+60 🪙 · раз в сутки</small></div></div>
          </div>
          <div class="sh-play"></div>
        </div>`;
      main.querySelector('.sh-back').onclick = () => win.def.open(win);
      main.querySelectorAll('.job').forEach(j => j.onclick = () => jobs[j.dataset.j](main.querySelector('.sh-play')));
    }
    const reward = (el, amount, text) => {
      Money.add(amount);
      el.innerHTML = `<div class="j-done">${text}<br><b style="color:#ffd166">+${Money.fmt(amount)}</b></div>`;
      OS.notify('💰 Биржа', `Начислено ${Money.fmt(amount)}!`);
    };
    const jobs = {
      quiz(el) {
        const QS = [
          ['Сколько будет 7 × 8?', ['54','56','64'], 1],
          ['Столица Австралии?', ['Сидней','Канберра','Мельбурн'], 1],
          ['Какой язык создали в Netscape за 10 дней?', ['Python','JavaScript','Java'], 1],
          ['Сколько бит в одном байте?', ['4','8','16'], 1],
          ['H₂O — это…?', ['Соль','Вода','Кислота'], 1],
        ];
        let i = 0, right = 0;
        (function ask() {
          if (i >= QS.length) { reward(el, 40 + right * 5, `Опрос пройден! Правильных: ${right}/${QS.length}.`); return; }
          const [q, opts, ok] = QS[i++];
          el.innerHTML = `<div class="j-quiz"><b>${q}</b><div class="j-opts"></div></div>`;
          const box = el.querySelector('.j-opts');
          opts.forEach((o, idx) => {
            const b = document.createElement('button'); b.textContent = o;
            b.onclick = () => { if (idx === ok) right++; ask(); };
            box.appendChild(b);
          });
        })();
      },
      clip(el) {
        let t = 5;
        el.innerHTML = `<div class="j-clip">🎬 Реклама QwenOS: «Лучшая ОС в мире!»<br><span class="j-count">${t} сек…</span><div class="j-bar"><i></i></div></div>`;
        const iv = setInterval(() => {
          if (!document.body.contains(el)) return clearInterval(iv);
          t--;
          el.querySelector('.j-count').textContent = t > 0 ? t + ' сек…' : 'Готово!';
          el.querySelector('.j-bar i').style.width = ((5 - t) / 5 * 100) + '%';
          if (t <= 0) { clearInterval(iv); reward(el, 25, 'Вы досмотрели рекламу! Терпение 💪'); }
        }, 1000);
      },
      captcha(el) {
        const a = 3 + Math.floor(Math.random() * 6), b = 2 + Math.floor(Math.random() * 7);
        el.innerHTML = `<div class="j-cap">Подтвердите, что вы человек 🧍<br><b style="font-size:20px">${a} + ${b} = ?</b>
          <input type="number" class="j-cap-in"><button class="j-cap-ok">Проверить</button><span class="j-cap-msg"></span></div>`;
        el.querySelector('.j-cap-ok').onclick = () => {
          const v = +el.querySelector('.j-cap-in').value;
          if (v === a + b) reward(el, 15, 'Ботом не притворился. Принято 🤝');
          else el.querySelector('.j-cap-msg').textContent = '❌ Неверно. Попробуй ещё раз (или ты правда бот?)';
        };
      },
      clicker(el) {
        el.innerHTML = `<div class="j-click">🎁 Коробка удачи: выбери одну из трёх!<br><div class="j-boxes"></div></div>`;
        const prizes = [10, 100, 0].sort(() => Math.random() - 0.5);
        const boxes = el.querySelector('.j-boxes');
        prizes.forEach(p => {
          const b = document.createElement('button'); b.textContent = '📦';
          b.onclick = () => { reward(el, p, p ? '🎉 Джекпот!' : '😅 Пусто... бывает. Заходи ещё!'); };
          boxes.appendChild(b);
        });
      },
      daily(el) {
        const today = new Date().toDateString();
        if (localStorage.getItem('qwenos_daily') === today) {
          el.innerHTML = `<div class="j-done">📅 Бонус уже получен сегодня!<br><small>Возвращайся завтра за +60 🪙</small></div>`;
          return;
        }
        localStorage.setItem('qwenos_daily', today);
        reward(el, 60, '📅 Ежедневный бонус забран!');
      }
    };
    work();
  }
});
