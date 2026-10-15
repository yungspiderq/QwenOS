/* ==========================================================================
   QwenOS 3.0 — apps/productivity.js
   Блокнот (Markdown) · Калькулятор · Таймер · Погода
   ========================================================================== */
(function (OS) {
  'use strict';
  const fs = OS.fs;

  /* ------------------------------------------------- мини-рендер Markdown */
  OS.md = function (src) {
    const lines = String(src || '').split('\n');
    let html = '', inCode = false, inList = null, inTable = false, inQuote = false;
    const inline = (t) => OS.esc(t)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/~~([^~]+)~~/g, '<s>$1</s>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    const closeList = () => { if (inList) { html += '</' + inList + '>'; inList = null; } };
    const closeTable = () => { if (inTable) { html += '</tbody></table>'; inTable = false; } };
    const closeQuote = () => { if (inQuote) { html += '</blockquote>'; inQuote = false; } };

    lines.forEach((raw) => {
      const line = raw;
      if (/^```/.test(line)) {
        if (inCode) { html += '</code></pre>'; inCode = false; } else { closeList(); closeTable(); closeQuote(); html += '<pre class="md-pre"><code>'; inCode = true; }
        return;
      }
      if (inCode) { html += OS.esc(line) + '\n'; return; }
      if (/^\s*\|.*\|\s*$/.test(line)) {
        const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        if (/^[-:\s|]+$/.test(line)) return; // разделитель
        closeList(); closeQuote();
        if (!inTable) { html += '<table class="md-table"><thead><tr>' + cells.map((c) => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>'; inTable = true; }
        else html += '<tr>' + cells.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>';
        return;
      }
      closeTable();
      if (/^>\s?/.test(line)) { closeList(); if (!inQuote) { html += '<blockquote class="md-q">'; inQuote = true; } html += inline(line.replace(/^>\s?/, '')) + '<br>'; return; }
      closeQuote();
      const hm = line.match(/^(#{1,6})\s+(.*)$/);
      if (hm) { closeList(); html += '<h' + (hm[1].length + 1) + ' class="md-h">' + inline(hm[2]) + '</h' + (hm[1].length + 1) + '>'; return; }
      if (/^\s*([-*+])\s+/.test(line)) {
        if (inList !== 'ul') { closeList(); html += '<ul class="md-ul">'; inList = 'ul'; }
        html += '<li>' + inline(line.replace(/^\s*[-*+]\s+/, '')) + '</li>'; return;
      }
      if (/^\s*\d+[.)]\s+/.test(line)) {
        if (inList !== 'ol') { closeList(); html += '<ol class="md-ol">'; inList = 'ol'; }
        html += '<li>' + inline(line.replace(/^\s*\d+[.)]\s+/, '')) + '</li>'; return;
      }
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { closeList(); html += '<hr class="md-hr">'; return; }
      if (!line.trim()) { closeList(); return; }
      closeList();
      html += '<p class="md-p">' + inline(line) + '</p>';
    });
    closeList(); closeTable(); closeQuote();
    if (inCode) html += '</code></pre>';
    return html;
  };

  /* =======================================================================
     БЛОКНОТ
     ======================================================================= */
  OS.Apps.register({
    id: 'notes',
    name: 'Блокнот',
    icon: 'note',
    color: '#eab308', color2: '#a16207',
    category: 'Продуктивность',
    keywords: 'текст редактор заметки markdown notes editor write',
    width: 900, height: 580, minWidth: 420, minHeight: 300,
    mount(win, api) {
      const st = { path: win.params.path || null, dirty: false, mode: 'edit', fontSize: OS.store.get('notes.fs', 14), list: [], q: '' };
      if (st.path && !fs.isFile(st.path)) st.path = null;

      win.body.innerHTML =
        '<div class="nt">' +
          '<aside class="nt-side">' +
            '<div class="nt-side-h"><span>Заметки</span><button class="ib" data-a="new" title="Новая заметка"></button></div>' +
            '<div class="nt-search"><input placeholder="Поиск…" spellcheck="false"></div>' +
            '<div class="nt-list"></div>' +
          '</aside>' +
          '<div class="nt-main">' +
            '<div class="nt-bar">' +
              '<div class="nt-name"><b></b><span class="nt-path dim"></span></div>' +
              '<div class="nt-tools">' +
                '<button class="btn btn-sm" data-a="save" title="Сохранить (Ctrl+S)">Сохранить</button>' +
                '<button class="btn btn-sm" data-a="saveas">Сохранить как…</button>' +
                '<button class="btn btn-sm" data-a="md" title="Предпросмотр Markdown">MD</button>' +
                '<button class="btn btn-sm" data-a="dl">Скачать</button>' +
                '<button class="btn btn-sm" data-a="del">Удалить</button>' +
              '</div>' +
            '</div>' +
            '<div class="nt-edit"><textarea spellcheck="false" placeholder="Начните печатать…"></textarea><div class="nt-preview hidden"></div></div>' +
            '<div class="nt-status"><span class="nt-words"></span><span class="nt-state"></span><span class="nt-fs"><button class="ib" data-a="fs-">A−</button><button class="ib" data-a="fs+">A+</button></span></div>' +
          '</div>' +
        '</div>';

      const ta = win.body.querySelector('textarea');
      const prev = win.body.querySelector('.nt-preview');
      const listEl = win.body.querySelector('.nt-list');
      const nameEl = win.body.querySelector('.nt-name b');
      const pathEl = win.body.querySelector('.nt-path');
      const wordsEl = win.body.querySelector('.nt-words');
      const stateEl = win.body.querySelector('.nt-state');
      win.body.querySelector('[data-a="new"]').innerHTML = OS.svg('plus', 15);
      win.body.querySelector('[data-a="fs-"]').innerHTML = '';
      ta.style.fontSize = st.fontSize + 'px';

      function collect() {
        const exts = ['txt', 'md', 'js', 'css', 'html', 'json', 'log', 'csv', 'xml', 'yml', 'yaml', 'ini', 'conf', 'sh', 'py', 'ts', 'svg'];
        const all = [];
        const walk = (dir) => fs.list(dir).forEach((it) => {
          if (it.type === 'dir') walk(it.path);
          else if (exts.includes(it.ext) || it.ext === '') all.push(it);
        });
        walk('/');
        st.list = all.filter((f) => !st.q || f.name.toLowerCase().includes(st.q));
        return st.list;
      }
      function renderList() {
        collect();
        listEl.innerHTML = '';
        if (!st.list.length) { listEl.innerHTML = '<div class="nt-empty">Заметок пока нет</div>'; return; }
        st.list.forEach((f) => {
          const b = OS.el('button', { class: 'nt-item' + (st.path === f.path ? ' on' : '') });
          const first = (fs.read(f.path) || '').split('\n').find((l) => l.trim()) || 'пустой файл';
          b.innerHTML = '<div class="nt-i1">' + OS.svg(f.ext === 'md' ? 'book' : 'text', 13) + '<b>' + OS.esc(f.name) + '</b></div>' +
            '<div class="nt-i2">' + OS.esc(first.slice(0, 46)) + '</div>' +
            '<div class="nt-i3">' + OS.fmtDateTime(f.modified) + ' · ' + OS.fmtBytes(f.size) + '</div>';
          b.onclick = () => { if (st.dirty && !confirm('Есть несохранённые изменения. Закрыть без сохранения?')) return; load(f.path); };
          b.oncontextmenu = (e) => {
            e.preventDefault(); e.stopPropagation();
            OS.menu(e.clientX, e.clientY, [
              { head: f.name },
              { label: 'Открыть', icon: 'ext', onClick: () => load(f.path) },
              { label: 'Показать в «Файлах»', icon: 'folder', onClick: () => api.open('files', { path: fs.dirname(f.path) }) },
              { label: 'Скопировать путь', icon: 'copy', onClick: () => OS.copyText(f.path) },
              { sep: true },
              { label: 'Удалить (в Корзину)', icon: 'trash', danger: true, onClick: () => { if (confirm('Переместить «' + f.name + '» в Корзину?')) { fs.trash(f.path); OS.bus.emit('fs:changed'); if (st.path === f.path) { st.path = null; ta.value = ''; syncName(); } renderList(); } } }
            ]);
          };
          listEl.append(b);
        });
      }
      function syncName() {
        const n = st.path ? fs.basename(st.path) : 'Без имени';
        nameEl.textContent = n;
        pathEl.textContent = st.path ? fs.dirname(st.path) : 'файл ещё не сохранён';
        win.setTitle('Блокнот — ' + n + (st.dirty ? ' •' : ''));
      }
      function load(path) {
        st.path = path;
        ta.value = fs.read(path) || '';
        st.dirty = false;
        if (st.mode === 'md') renderMd();
        syncName(); renderList(); updateStatus();
        ta.focus();
      }
      function save() {
        if (!st.path) return saveAs();
        const r = fs.write(st.path, ta.value);
        st.dirty = false; syncName(); renderList(); updateStatus();
        OS.bus.emit('fs:changed', st.path);
        OS.toast('Сохранено', fs.basename(st.path) + ' · ' + OS.fmtBytes(r.size), { icon: 'save', timeout: 2200 });
      }
      function saveAs() {
        const def = st.path ? fs.basename(st.path) : 'заметка.md';
        const dir = st.path ? fs.dirname(st.path) : fs.home() + '/Documents';
        const name = prompt('Сохранить как (имя файла):', def);
        if (!name) return;
        st.path = fs.join(dir, name.trim());
        save();
      }
      function updateStatus() {
        const t = ta.value;
        const words = t.trim() ? t.trim().split(/\s+/).length : 0;
        wordsEl.textContent = words + ' слов · ' + t.length + ' симв. · ' + t.split('\n').length + ' строк';
        stateEl.textContent = st.dirty ? 'не сохранено' : (st.path ? 'сохранено' : '');
        stateEl.className = 'nt-state ' + (st.dirty ? 'dirty' : '');
      }
      function renderMd() { prev.innerHTML = OS.md(ta.value); }

      ta.addEventListener('input', () => {
        st.dirty = true; syncName(); updateStatus();
        if (st.mode === 'md') renderMd();
        saveSoon();
      });
      const saveSoon = OS.debounce(() => { if (st.dirty && st.path) save(); }, 1400);
      ta.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); return; }
        if (e.key === 'Tab') {
          e.preventDefault();
          const s = ta.selectionStart, en = ta.selectionEnd;
          ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(en);
          ta.selectionStart = ta.selectionEnd = s + 2;
          ta.dispatchEvent(new Event('input'));
        }
      });

      win.body.addEventListener('click', (e) => {
        const b = e.target.closest('[data-a]'); if (!b) return;
        const a = b.dataset.a;
        if (a === 'save') save();
        else if (a === 'saveas') saveAs();
        else if (a === 'new') {
          if (st.dirty && !confirm('Несохранённые изменения будут потеряны. Продолжить?')) return;
          st.path = null; ta.value = ''; st.dirty = false; st.mode = 'edit';
          prev.classList.add('hidden'); ta.classList.remove('hidden');
          b.closest('.nt-tools') && null;
          syncName(); updateStatus(); ta.focus();
        } else if (a === 'md') {
          st.mode = st.mode === 'edit' ? 'md' : 'edit';
          prev.classList.toggle('hidden', st.mode !== 'md');
          ta.classList.toggle('hidden', st.mode === 'md');
          b.classList.toggle('btn-accent', st.mode === 'md');
          if (st.mode === 'md') renderMd(); else ta.focus();
        } else if (a === 'dl') OS.download(st.path ? fs.basename(st.path) : 'note.txt', ta.value);
        else if (a === 'del') {
          if (!st.path) return OS.toast('Нечего удалять', 'Файл ещё не сохранён', { icon: 'info' });
          if (!confirm('Переместить «' + fs.basename(st.path) + '» в Корзину?')) return;
          fs.trash(st.path); OS.bus.emit('fs:changed');
          st.path = null; ta.value = ''; st.dirty = false; syncName(); renderList(); updateStatus();
        } else if (a === 'fs+') { st.fontSize = Math.min(26, st.fontSize + 1); ta.style.fontSize = st.fontSize + 'px'; OS.store.set('notes.fs', st.fontSize); }
        else if (a === 'fs-') { st.fontSize = Math.max(10, st.fontSize - 1); ta.style.fontSize = st.fontSize + 'px'; OS.store.set('notes.fs', st.fontSize); }
      });

      const searchEl = win.body.querySelector('.nt-search input');
      searchEl.addEventListener('input', OS.debounce(() => { st.q = searchEl.value.toLowerCase().trim(); renderList(); }, 160));

      const unsub = OS.bus.on('fs:changed', () => { if (win.root.isConnected) renderList(); });
      if (st.path) load(st.path); else { syncName(); renderList(); updateStatus(); ta.focus(); }
      return () => { if (st.dirty && st.path) { fs.write(st.path, ta.value); fs.saveNow(); } unsub(); };
    }
  });

  /* =======================================================================
     КАЛЬКУЛЯТОР (собственный парсер выражений, без eval)
     ======================================================================= */
  const Calc = (function () {
    function tokenize(s) {
      const out = []; let i = 0;
      while (i < s.length) {
        const ch = s[i];
        if (/\s/.test(ch)) { i++; continue; }
        if (/[0-9.]/.test(ch)) { let n = ''; while (i < s.length && /[0-9.]/.test(s[i])) n += s[i++]; out.push({ t: 'num', v: parseFloat(n) }); continue; }
        if (/[a-zA-Zа-яА-Я]/.test(ch)) { let n = ''; while (i < s.length && /[a-zA-Zа-яА-Я]/.test(s[i])) n += s[i++]; out.push({ t: 'id', v: n }); continue; }
        if ('+-*/%^()!'.includes(ch)) { out.push({ t: ch }); i++; continue; }
        throw new Error('недопустимый символ «' + ch + '»');
      }
      return out;
    }
    function parse(tokens) {
      let p = 0;
      const peek = () => tokens[p], eat = (t) => { if (tokens[p] && (t ? tokens[p].t === t : true)) return tokens[p++]; throw new Error('ожидалось ' + (t || 'выражение')); };
      function expr() { let v = term(); while (peek() && (peek().t === '+' || peek().t === '-')) { const op = eat().t; const r = term(); v = op === '+' ? v + r : v - r; } return v; }
      function term() { let v = unary(); while (peek() && (peek().t === '*' || peek().t === '/' || peek().t === '%')) { const op = eat().t; const r = unary(); if ((op === '/' || op === '%') && r === 0) throw new Error('деление на ноль'); v = op === '*' ? v * r : op === '/' ? v / r : v % r; } return v; }
      function unary() { if (peek() && peek().t === '-') { eat(); return -unary(); } if (peek() && peek().t === '+') { eat(); return unary(); } return power(); }
      function power() { let v = postfix(); if (peek() && peek().t === '^') { eat(); v = Math.pow(v, power()); } return v; }
      function postfix() { let v = atom(); while (peek() && peek().t === '!') { eat(); v = fact(v); } return v; }
      function fact(n) { if (n < 0 || n !== Math.floor(n) || n > 170) throw new Error('факториал определён для 0…170'); let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
      function atom() {
        const tk = peek();
        if (!tk) throw new Error('незавершённое выражение');
        if (tk.t === 'num') { eat(); return tk.v; }
        if (tk.t === '(') { eat(); const v = expr(); eat(')'); return v; }
        if (tk.t === 'id') {
          eat();
          const name = tk.v.toLowerCase();
          const consts = { pi: Math.PI, e: Math.E, tau: Math.PI * 2, inf: Infinity };
          if (name in consts) return consts[name];
          const fns = { sqrt: Math.sqrt, abs: Math.abs, sin: Math.sin, cos: Math.cos, tan: Math.tan, log: Math.log10, ln: Math.log, exp: Math.exp, round: Math.round, floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max, pow: Math.pow, random: Math.random };
          if (fns[name]) {
            if (!peek() || peek().t !== '(') throw new Error('после ' + name + ' нужна скобка');
            eat('(');
            const args = [expr()];
            while (peek() && peek().t === ',') { eat(); args.push(expr()); }
            eat(')');
            return fns[name].apply(null, args);
          }
          throw new Error('неизвестное имя «' + tk.v + '»');
        }
        throw new Error('неожиданный символ «' + tk.t + '»');
      }
      const v = expr();
      if (p < tokens.length) throw new Error('лишние данные в выражении');
      return v;
    }
    return {
      eval(s) { const t = tokenize(String(s)); if (!t.length) return 0; return parse(t); },
      fmt(v) {
        if (typeof v !== 'number' || isNaN(v)) return 'Ошибка';
        if (!isFinite(v)) return '∞';
        const r = Math.round(v * 1e10) / 1e10;
        if (Math.abs(r) >= 1e15 || (Math.abs(r) < 1e-6 && r !== 0)) return r.toExponential(6);
        return String(r);
      }
    };
  })();
  OS.calc = Calc;

  OS.Apps.register({
    id: 'calculator',
    name: 'Калькулятор',
    icon: 'calculator',
    color: '#f97316', color2: '#7c2d12',
    category: 'Продуктивность',
    keywords: 'calc математика счёт вычисления math',
    width: 400, height: 560, minWidth: 320, minHeight: 420,
    mount(win) {
      let expr = '', last = '', mem = 0;
      const hist = OS.store.get('calc.hist', []) || [];
      win.body.innerHTML =
        '<div class="ca">' +
          '<div class="ca-disp"><div class="ca-expr"></div><div class="ca-res">0</div></div>' +
          '<div class="ca-hist"></div>' +
          '<div class="ca-keys"></div>' +
        '</div>';
      const dExpr = win.body.querySelector('.ca-expr'), dRes = win.body.querySelector('.ca-res');
      const keys = win.body.querySelector('.ca-keys'), histEl = win.body.querySelector('.ca-hist');

      const KEYS = [
        ['C', 'ac'], ['⌫', 'del'], ['%', 'op'], ['÷', 'op'],
        ['7', 'n'], ['8', 'n'], ['9', 'n'], ['×', 'op'],
        ['4', 'n'], ['5', 'n'], ['6', 'n'], ['−', 'op'],
        ['1', 'n'], ['2', 'n'], ['3', 'n'], ['+', 'op'],
        ['±', 'fn'], ['0', 'n'], [',', 'n'], ['=', 'eq'],
        ['(', 'op'], [')', 'op'], ['√', 'fn'], ['x²', 'fn'],
        ['1/x', 'fn'], ['xʸ', 'op'], ['M+', 'fn'], ['M−', 'fn']
      ];
      keys.innerHTML = KEYS.map((k) => '<button class="ca-k ' + k[1] + '" data-k="' + k[0] + '">' + k[0] + '</button>').join('');

      const norm = (s) => s.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/,/g, '.').replace(/√/g, 'sqrt').replace(/xʸ/g, '^');
      function update() {
        dExpr.textContent = expr || '\u00a0';
        let preview = '';
        if (expr) { try { const v = Calc.eval(norm(expr)); preview = Calc.fmt(v); } catch (e) { preview = ''; } }
        dRes.textContent = preview || (last !== '' ? last : '0');
        dRes.classList.toggle('small', (preview || last || '0').length > 12);
      }
      function renderHist() {
        histEl.innerHTML = hist.length ? hist.slice(-14).reverse().map((h) => '<button class="ca-h" data-e="' + OS.esc(h.e) + '"><span>' + OS.esc(h.e) + '</span><b>' + OS.esc(h.r) + '</b></button>').join('') : '<div class="ca-h-empty">История пуста</div>';
        histEl.scrollTop = 0;
      }
      function press(k) {
        OS.sfx.play('click');
        if (k === 'C') { expr = ''; last = ''; }
        else if (k === '⌫') expr = expr.slice(0, -1);
        else if (k === '=') {
          if (!expr) return;
          try {
            const v = Calc.eval(norm(expr));
            const r = Calc.fmt(v);
            hist.push({ e: expr, r: r }); if (hist.length > 60) hist.shift();
            OS.store.set('calc.hist', hist);
            last = r; expr = r === 'Ошибка' ? '' : r; renderHist();
          } catch (e) { last = 'Ошибка'; expr = ''; OS.sfx.play('error'); OS.toast('Ошибка вычисления', String(e.message || e), { icon: 'x', timeout: 2600 }); }
        }
        else if (k === '±') { if (expr) expr = expr.startsWith('-') ? expr.slice(1) : '-' + expr; }
        else if (k === '√') expr = 'sqrt(' + (expr || '') + ')';
        else if (k === 'x²') expr = '(' + (expr || '0') + ')^2';
        else if (k === '1/x') expr = '1/(' + (expr || '0') + ')';
        else if (k === 'xʸ') expr += '^';
        else if (k === 'M+') { try { mem += Calc.eval(norm(expr || last || '0')); OS.toast('Память', 'M = ' + Calc.fmt(mem), { icon: 'coin', timeout: 1600 }); } catch (e) { /* noop */ } }
        else if (k === 'M−') { try { mem -= Calc.eval(norm(expr || last || '0')); OS.toast('Память', 'M = ' + Calc.fmt(mem), { icon: 'coin', timeout: 1600 }); } catch (e) { /* noop */ } }
        else if (k === '%') { try { const v = Calc.eval(norm(expr || '0')) / 100; expr = Calc.fmt(v); } catch (e) { /* noop */ } }
        else expr += k;
        if (expr.length > 90) expr = expr.slice(-90);
        update();
      }
      keys.addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) press(b.dataset.k); });
      histEl.addEventListener('click', (e) => { const b = e.target.closest('[data-e]'); if (b) { expr = b.dataset.e; update(); } });

      const onKey = (e) => {
        if (!win.root.isConnected || OS.wm.active !== win) return;
        const ae = document.activeElement;
        if (ae && /INPUT|TEXTAREA/.test(ae.tagName) && !win.body.contains(ae)) return;
        const k = e.key;
        if (/^[0-9]$/.test(k)) { press(k); e.preventDefault(); }
        else if (k === '.' || k === ',') { press(','); e.preventDefault(); }
        else if (k === '+') { press('+'); e.preventDefault(); }
        else if (k === '-') { press('−'); e.preventDefault(); }
        else if (k === '*') { press('×'); e.preventDefault(); }
        else if (k === '/') { press('÷'); e.preventDefault(); }
        else if (k === '%') { press('%'); e.preventDefault(); }
        else if (k === '^') { press('xʸ'); e.preventDefault(); }
        else if (k === '(' || k === ')') { press(k); e.preventDefault(); }
        else if (k === 'Enter' || k === '=') { press('='); e.preventDefault(); }
        else if (k === 'Backspace') { press('⌫'); e.preventDefault(); }
        else if (k === 'Escape') { press('C'); e.preventDefault(); }
      };
      document.addEventListener('keydown', onKey);
      update(); renderHist();
      return () => document.removeEventListener('keydown', onKey);
    }
  });

  /* =======================================================================
     ТАЙМЕР / СЕКУНДОМЕР  (устанавливается из QwenStore)
     ======================================================================= */
  OS.Apps.register({
    id: 'timer',
    name: 'Таймер',
    icon: 'clock',
    color: '#06b6d4', color2: '#0e7490',
    category: 'Продуктивность',
    keywords: 'секундомер отсчёт stopwatch countdown timer будильник',
    width: 460, height: 520, minWidth: 340, minHeight: 400,
    storeOnly: true,
    mount(win) {
      let tab = 'sw', swT = 0, swRun = false, swIv = null, laps = [];
      let cdTotal = 5 * 60, cdLeft = 5 * 60, cdRun = false, cdIv = null;

      win.body.innerHTML =
        '<div class="tm">' +
          '<div class="tm-tabs"><button class="on" data-t="sw">Секундомер</button><button data-t="cd">Таймер</button></div>' +
          '<div class="tm-pane" id="tm-sw">' +
            '<div class="tm-big" id="sw-disp">00:00.00</div>' +
            '<div class="tm-btns"><button class="btn" data-a="lap">Круг</button><button class="btn btn-accent" data-a="start">Старт</button><button class="btn" data-a="reset">Сброс</button></div>' +
            '<div class="tm-laps" id="sw-laps"></div>' +
          '</div>' +
          '<div class="tm-pane hidden" id="tm-cd">' +
            '<svg class="tm-ring" viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="52"/><circle class="fg" id="cd-ring" cx="60" cy="60" r="52"/></svg>' +
            '<div class="tm-big" id="cd-disp">05:00</div>' +
            '<div class="tm-presets">' + [1, 3, 5, 10, 15, 25].map((m) => '<button class="chip" data-m="' + m + '">' + m + ' мин</button>').join('') + '</div>' +
            '<div class="tm-btns"><button class="btn" data-a="minus">−30с</button><button class="btn btn-accent" data-a="start">Старт</button><button class="btn" data-a="plus">+30с</button></div>' +
          '</div>' +
        '</div>';
      const swDisp = win.body.querySelector('#sw-disp'), swLaps = win.body.querySelector('#sw-laps');
      const cdDisp = win.body.querySelector('#cd-disp'), cdRing = win.body.querySelector('#cd-ring');
      const R = 52 * 2 * Math.PI;
      cdRing.style.strokeDasharray = R;

      const fmtSw = (ms) => { const m = Math.floor(ms / 60000), s = Math.floor(ms % 60000 / 1000), c = Math.floor(ms % 1000 / 10); return OS.pad(m) + ':' + OS.pad(s) + '.' + OS.pad(c); };
      const fmtCd = (s) => { s = Math.max(0, Math.ceil(s)); return OS.pad(Math.floor(s / 60)) + ':' + OS.pad(s % 60); };

      function updCd() { cdDisp.textContent = fmtCd(cdLeft); cdRing.style.strokeDashoffset = R * (1 - (cdTotal ? cdLeft / cdTotal : 0)); }
      function updSw() { swDisp.textContent = fmtSw(swT); }

      win.body.querySelectorAll('.tm-tabs button').forEach((b) => {
        b.onclick = () => {
          tab = b.dataset.t;
          win.body.querySelectorAll('.tm-tabs button').forEach((x) => x.classList.toggle('on', x === b));
          win.body.querySelector('#tm-sw').classList.toggle('hidden', tab !== 'sw');
          win.body.querySelector('#tm-cd').classList.toggle('hidden', tab !== 'cd');
          win.setTitle('Таймер — ' + (tab === 'sw' ? 'секундомер' : 'отсчёт'));
        };
      });

      win.body.querySelector('#tm-sw').addEventListener('click', (e) => {
        const b = e.target.closest('[data-a]'); if (!b) return;
        const a = b.dataset.a;
        if (a === 'start') {
          swRun = !swRun; b.textContent = swRun ? 'Пауза' : 'Старт';
          b.classList.toggle('btn-accent', !swRun);
          if (swRun) { const t0 = Date.now() - swT; swIv = setInterval(() => { swT = Date.now() - t0; updSw(); }, 40); }
          else clearInterval(swIv);
        } else if (a === 'lap') {
          if (!swRun) return;
          laps.unshift(swT);
          swLaps.innerHTML = laps.slice(0, 40).map((l, i) => '<div class="tm-lap"><span>Круг ' + (laps.length - i) + '</span><b>' + fmtSw(l) + '</b></div>').join('');
        } else if (a === 'reset') { clearInterval(swIv); swRun = false; swT = 0; laps = []; swLaps.innerHTML = ''; updSw(); win.body.querySelector('#tm-sw [data-a="start"]').textContent = 'Старт'; }
      });

      win.body.querySelector('#tm-cd').addEventListener('click', (e) => {
        const pre = e.target.closest('[data-m]');
        if (pre) { cdTotal = cdLeft = parseInt(pre.dataset.m, 10) * 60; cdRun = false; clearInterval(cdIv); updCd(); win.body.querySelector('#tm-cd [data-a="start"]').textContent = 'Старт'; return; }
        const b = e.target.closest('[data-a]'); if (!b) return;
        const a = b.dataset.a;
        if (a === 'plus') { cdTotal += 30; cdLeft += 30; updCd(); }
        else if (a === 'minus') { cdTotal = Math.max(30, cdTotal - 30); cdLeft = Math.max(0, cdLeft - 30); updCd(); }
        else if (a === 'start') {
          cdRun = !cdRun; b.textContent = cdRun ? 'Пауза' : 'Старт';
          if (cdRun) {
            const end = Date.now() + cdLeft * 1000;
            cdIv = setInterval(() => {
              cdLeft = (end - Date.now()) / 1000; updCd();
              if (cdLeft <= 0) {
                clearInterval(cdIv); cdRun = false; cdLeft = 0; updCd();
                b.textContent = 'Старт';
                OS.toast('Время вышло!', 'Таймер завершил отсчёт', { icon: 'bell', timeout: 8000 });
                OS.sfx.play('notify'); OS.sfx.play('notify');
              }
            }, 200);
          } else clearInterval(cdIv);
        }
      });

      updSw(); updCd();
      return () => { clearInterval(swIv); clearInterval(cdIv); };
    }
  });

  /* =======================================================================
     ПОГОДА  (устанавливается из QwenStore)
     ======================================================================= */
  OS.Apps.register({
    id: 'weather',
    name: 'Погода',
    icon: 'cloud',
    color: '#38bdf8', color2: '#1d4ed8',
    category: 'Сеть',
    keywords: 'погода прогноз температура weather forecast',
    width: 620, height: 520, minWidth: 380, minHeight: 380,
    storeOnly: true,
    mount(win) {
      const CITIES = ['Москва', 'Санкт-Петербург', 'Новосибирск', 'Казань', 'Сочи', 'Владивосток', 'Астана', 'Минск'];
      const KINDS = [
        { id: 'sun', name: 'Ясно', icon: 'sun' }, { id: 'pc', name: 'Переменная облачность', icon: 'cloud' },
        { id: 'cloud', name: 'Облачно', icon: 'layers' }, { id: 'rain', name: 'Дождь', icon: 'download' },
        { id: 'storm', name: 'Гроза', icon: 'zap' }, { id: 'snow', name: 'Снег', icon: 'star' }
      ];
      let city = OS.store.get('wx.city', 'Москва');
      function seedFor(name) {
        let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
        const r = (n) => { h = (h * 1103515245 + 12345) >>> 0; return (h >>> 8) % n; };
        const base = 5 + r(26);
        const days = Array.from({ length: 6 }, (_, i) => {
          const k = KINDS[r(KINDS.length)];
          const t = base + r(9) - 4 - i;
          return { d: i, kind: k, t: t, tn: t - 4 - r(4), wind: 1 + r(12), hum: 40 + r(55), pres: 735 + r(40) };
        });
        return { days: days, base: base };
      }
      let data = seedFor(city);

      win.body.innerHTML = '<div class="wx"></div>';
      const root = win.body.querySelector('.wx');

      function render() {
        data = seedFor(city);
        const now = data.days[0];
        const dn = (i) => { const d = new Date(Date.now() + i * 86400000); return i === 0 ? 'Сегодня' : OS.DAYS[d.getDay()].slice(0, 2) + ', ' + d.getDate() + '.' + OS.pad(d.getMonth() + 1); };
        root.innerHTML =
          '<div class="wx-hero">' +
            '<div class="wx-city">' + OS.svg('compass', 15) + '<span>' + OS.esc(city) + '</span></div>' +
            '<div class="wx-now"><div class="wx-ic">' + OS.svg(now.kind.icon, 44) + '</div>' +
            '<div><div class="wx-t">' + now.t + '°</div><div class="wx-k">' + now.kind.name + '</div></div></div>' +
            '<div class="wx-meta">' +
              '<span>' + OS.svg('wave', 13) + ' ' + now.wind + ' м/с</span>' +
              '<span>' + OS.svg('download', 13) + ' ' + now.hum + '%</span>' +
              '<span>' + OS.svg('target', 13) + ' ' + now.pres + ' мм</span>' +
            '</div>' +
          '</div>' +
          '<div class="wx-days">' + data.days.map((d, i) =>
            '<div class="wx-day' + (i === 0 ? ' on' : '') + '">' +
              '<span>' + dn(i) + '</span>' +
              '<i>' + OS.svg(d.kind.icon, 20) + '</i>' +
              '<b>' + d.t + '°</b><small>' + d.tn + '°</small>' +
            '</div>').join('') + '</div>' +
          '<canvas class="wx-chart"></canvas>' +
          '<div class="wx-cities">' + CITIES.map((c) => '<button class="chip' + (c === city ? ' on' : '') + '" data-c="' + c + '">' + c + '</button>').join('') + '</div>' +
          '<div class="wx-note">' + OS.svg('info', 12) + ' Данные генерируются детерминированно для каждого города — это симуляция, а не реальный прогноз.</div>';

        const cv = root.querySelector('.wx-chart');
        const r = cv.getBoundingClientRect();
        cv.width = Math.max(200, r.width) * devicePixelRatio; cv.height = 110 * devicePixelRatio;
        const ctx = cv.getContext('2d');
        ctx.scale(devicePixelRatio, devicePixelRatio);
        const W = cv.width / devicePixelRatio, H = cv.height / devicePixelRatio;
        const ts = data.days.map((d) => d.t);
        const min = Math.min.apply(null, ts) - 2, max = Math.max.apply(null, ts) + 2;
        const px = (i) => 24 + i * ((W - 48) / (ts.length - 1));
        const py = (t) => H - 22 - ((t - min) / (max - min)) * (H - 46);
        ctx.strokeStyle = 'rgba(128,140,180,.18)'; ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) { const y = 18 + i * ((H - 40) / 3); ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(W - 20, y); ctx.stroke(); }
        const g = ctx.createLinearGradient(0, 0, W, 0);
        g.addColorStop(0, getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#8b5cf6');
        g.addColorStop(1, getComputedStyle(document.documentElement).getPropertyValue('--accent-2').trim() || '#06b6d4');
        ctx.beginPath(); ts.forEach((t, i) => { i ? ctx.lineTo(px(i), py(t)) : ctx.moveTo(px(i), py(t)); });
        ctx.strokeStyle = g; ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; ctx.stroke();
        ctx.lineTo(px(ts.length - 1), H); ctx.lineTo(px(0), H); ctx.closePath();
        ctx.globalAlpha = .12; ctx.fillStyle = g; ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = 'currentColor';
        ts.forEach((t, i) => {
          ctx.beginPath(); ctx.arc(px(i), py(t), 3.4, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
          ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = 'rgba(160,170,200,.95)'; ctx.font = '10px system-ui'; ctx.textAlign = 'center';
          ctx.fillText(t + '°', px(i), py(t) - 9);
        });
        win.setTitle('Погода — ' + city);
      }
      root.addEventListener('click', (e) => {
        const b = e.target.closest('[data-c]'); if (!b) return;
        city = b.dataset.c; OS.store.set('wx.city', city); render();
      });
      render();
      const u = OS.bus.on('wm:resize', () => setTimeout(render, 60));
      return () => u();
    }
  });
})(window.OS);
