/* ================= Виртуальная файловая система ================= */
const FS = {
  root: {
    'Рабочий стол': { type: 'dir', children: {} },
    'Документы': { type: 'dir', children: {
      'readme.txt': { type: 'file', content: 'Добро пожаловать в WebOS!\n\nЭто операционная система, полностью написанная на HTML, CSS и JavaScript.\n\nВозможности:\n - Оконный менеджер (перетаскивание, ресайз, свернуть/развернуть)\n - Виртуальная файловая система (сохраняется в localStorage)\n - Терминал с командами: help, ls, cd, cat, echo, touch, mkdir, rm, clear, neofetch, date, whoami, tree\n - Приложения: Блокнот, Калькулятор, Проводник, Рисовалка, Сапёр, Игра «Жизнь», Часы, Браузер, Настройки\n - Меню Пуск, уведомления, контекстные меню, экран блокировки\n\nПриятного пользования! 🎉' },
      'секрет.txt': { type: 'file', content: 'Здесь был кот 🐈' }
    }},
    'Изображения': { type: 'dir', children: {} },
    'Музыка': { type: 'dir', children: {} },
    'Загрузки': { type: 'dir', children: {} },
  }
};

function fsNormalizePath(path) {
  const parts = [];
  for (const p of path.split('/')) {
    if (p === '' || p === '.') continue;
    if (p === '..') parts.pop();
    else parts.push(p);
  }
  return '/' + parts.join('/');
}
function fsGetNode(path) {
  const parts = fsNormalizePath(path).split('/').filter(Boolean);
  let node = { type: 'dir', children: FS.root };
  for (const p of parts) {
    if (node.type !== 'dir' || !(p in node.children)) return null;
    node = node.children[p];
  }
  return node;
}
function fsSave() { try { localStorage.setItem('webos_fs', JSON.stringify(FS.root)); } catch(e){} }
function fsLoad() { try { const d = localStorage.getItem('webos_fs'); if (d) FS.root = JSON.parse(d); } catch(e){} }

/* ================= Реестр приложений ================= */
const Apps = {};
function registerApp(id, def) { Apps[id] = def; }

/* ---------- Блокнот ---------- */
registerApp('notepad', {
  name: 'Блокнот', icon: '📝', width: 560, height: 420,
  open(win, params = {}) {
    const filePath = params.path || null;
    win.body.innerHTML = `
      <div class="notepad">
        <textarea spellcheck="false" placeholder="Начните печатать..."></textarea>
        <div class="np-status"><span class="np-name">${filePath || 'Без имени'}</span><span class="np-info">0 симв.</span></div>
      </div>`;
    const ta = win.body.querySelector('textarea');
    const info = win.body.querySelector('.np-info');
    if (filePath) {
      const node = fsGetNode(filePath);
      if (node && node.type === 'file') ta.value = node.content;
    }
    ta.oninput = () => info.textContent = ta.value.length + ' симв.';
    ta.focus();
    win.shortcuts = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveAs();
      }
    };
    function saveAs() {
      let name = filePath ? filePath.split('/').pop() : prompt('Имя файла для сохранения:', 'новый_файл.txt');
      if (!name) return;
      const dir = fsGetNode('/Документы');
      dir.children[name] = { type: 'file', content: ta.value };
      fsSave();
      OS.notify('Блокнот', `Файл «${name}» сохранён в /Документы`);
      win.body.querySelector('.np-name').textContent = '/Документы/' + name;
    }
  }
});

/* ---------- Калькулятор ---------- */
registerApp('calc', {
  name: 'Калькулятор', icon: '🧮', width: 320, height: 440, resizable: false,
  open(win) {
    win.body.innerHTML = `
      <div class="calc">
        <div class="calc-display">0</div>
        <div class="calc-grid">
          <button class="clr" data-k="C">C</button><button class="clr" data-k="CE">⌫</button>
          <button class="op" data-k="%">%</button><button class="op" data-k="/">÷</button>
          <button data-k="7">7</button><button data-k="8">8</button><button data-k="9">9</button><button class="op" data-k="*">×</button>
          <button data-k="4">4</button><button data-k="5">5</button><button data-k="6">6</button><button class="op" data-k="-">−</button>
          <button data-k="1">1</button><button data-k="2">2</button><button data-k="3">3</button><button class="op" data-k="+">+</button>
          <button data-k="0">0</button><button data-k=".">.</button><button class="eq" data-k="=">=</button>
        </div>
      </div>`;
    const disp = win.body.querySelector('.calc-display');
    let cur = '0', prev = null, op = null, fresh = true;
    const fmt = v => String(v).replace('.', ',');
    function press(k) {
      if (k === 'C') { cur='0'; prev=null; op=null; fresh=true; }
      else if (k === 'CE') { cur = cur.length>1 ? cur.slice(0,-1) : '0'; }
      else if (k === '=') {
        if (op && prev !== null) {
          const a = parseFloat(prev), b = parseFloat(cur);
          let r = op==='+'?a+b: op==='-'?a-b: op==='*'?a*b: op==='/'? (b===0?NaN:a/b) : b;
          cur = isNaN(r) ? 'Ошибка' : String(+r.toFixed(10));
          prev = null; op = null; fresh = true;
        }
      }
      else if ('+-*/%'.includes(k)) {
        if (op && prev !== null && !fresh) press('=');
        prev = cur; op = k; fresh = true;
      }
      else if (k === '.') { if (fresh){cur='0.';fresh=false;} else if (!cur.includes('.')) cur+='.'; }
      else { if (fresh){cur=k;fresh=false;} else cur = cur==='0'?k:cur+k; }
      if (k === '%') { cur = String(parseFloat(cur)/100); fresh = true; }
      disp.textContent = fmt(cur);
    }
    win.body.querySelectorAll('button').forEach(b => b.onclick = () => press(b.dataset.k));
    win.shortcuts = (e) => {
      const m = {'Enter':'=', '=':'=', 'Escape':'C', 'Backspace':'CE'};
      if (/[0-9+\-*/%.]/.test(e.key)) press(e.key);
      else if (m[e.key]) press(m[e.key]);
    };
  }
});

/* ---------- Проводник ---------- */
registerApp('explorer', {
  name: 'Проводник', icon: '📁', width: 720, height: 480,
  open(win, params = {}) {
    let cwd = params.path || '/';
    win.body.innerHTML = `
      <div class="explorer">
        <div class="ex-side">
          <div data-p="/Рабочий стол">🖥 Рабочий стол</div>
          <div data-p="/Документы">📄 Документы</div>
          <div data-p="/Изображения">🖼 Изображения</div>
          <div data-p="/Музыка">🎵 Музыка</div>
          <div data-p="/Загрузки">⬇ Загрузки</div>
        </div>
        <div class="ex-main">
          <div class="ex-path">
            <button class="ex-up" title="Наверх">⬅</button>
            <input class="ex-path-in" value="">
          </div>
          <div class="ex-files"></div>
        </div>
      </div>`;
    const filesEl = win.body.querySelector('.ex-files');
    const pathIn = win.body.querySelector('.ex-path-in');
    win.body.querySelectorAll('.ex-side div').forEach(d => d.onclick = () => go(d.dataset.p));
    win.body.querySelector('.ex-up').onclick = () => {
      const parts = fsNormalizePath(cwd).split('/').filter(Boolean);
      parts.pop();
      go('/' + parts.join('/'));
    };
    pathIn.onchange = () => go(pathIn.value);
    function iconFor(name, node) {
      if (node.type === 'dir') return '📁';
      if (name.endsWith('.txt') || name.endsWith('.md')) return '📄';
      if (/\.(png|jpg|jpeg|gif|svg)$/.test(name)) return '🖼';
      if (/\.(mp3|wav|ogg)$/.test(name)) return '🎵';
      return '📃';
    }
    function go(p) {
      cwd = fsNormalizePath(p);
      const node = fsGetNode(cwd);
      if (!node || node.type !== 'dir') { OS.notify('Проводник', 'Папка не найдена: ' + cwd); return; }
      pathIn.value = cwd;
      filesEl.innerHTML = '';
      const entries = Object.entries(node.children);
      if (!entries.length) filesEl.innerHTML = '<div style="grid-column:1/-1;color:#888;padding:20px;text-align:center">Эта папка пуста</div>';
      for (const [name, child] of entries.sort((a,b)=> (a[1].type===b[1].type? a[0].localeCompare(b[0]) : a[1].type==='dir'?-1:1))) {
        const el = document.createElement('div');
        el.className = 'ex-file';
        el.innerHTML = `<div class="f-icon">${iconFor(name, child)}</div><div class="f-name">${name}</div>`;
        el.ondblclick = () => {
          const full = fsNormalizePath(cwd + '/' + name);
          if (child.type === 'dir') go(full);
          else if (/\.(png|jpg|jpeg|gif|svg)$/i.test(name)) OS.openApp('paint');
          else OS.openApp('notepad', { path: full });
        };
        el.oncontextmenu = (e) => {
          e.preventDefault(); e.stopPropagation();
          OS.contextMenu(e.clientX, e.clientY, [
            { label: 'Открыть', fn: () => el.ondblclick() },
            { label: 'Переименовать', fn: () => {
                const nn = prompt('Новое имя:', name);
                if (nn && nn !== name) { node.children[nn] = node.children[name]; delete node.children[name]; fsSave(); go(cwd); }
              }},
            { sep: true },
            { label: 'Удалить', fn: () => {
                if (confirm(`Удалить «${name}»?`)) { delete node.children[name]; fsSave(); go(cwd); }
              }}
          ]);
        };
        filesEl.appendChild(el);
      }
    }
    go(cwd);
  }
});

/* ---------- Терминал ---------- */
registerApp('terminal', {
  name: 'Терминал', icon: '💻', width: 640, height: 420,
  open(win) {
    let cwd = '/';
    win.body.innerHTML = `<div class="terminal"><div class="t-out"></div><div class="t-in"><span class="t-prompt"></span><input spellcheck="false" autocomplete="off"></div></div>`;
    const term = win.body.querySelector('.terminal');
    const out = win.body.querySelector('.t-out');
    const input = win.body.querySelector('input');
    const promptEl = win.body.querySelector('.t-prompt');
    const history = []; let hIdx = -1;
    function setPrompt(){ promptEl.textContent = `user@webos:${cwd}$`; }
    function print(text, cls='') {
      const d = document.createElement('div');
      d.className = 't-line ' + cls; d.textContent = text;
      out.appendChild(d); term.scrollTop = term.scrollHeight;
    }
    print('WebOS Terminal 1.0 — введите "help" для списка команд.', 't-info');
    setPrompt();
    setTimeout(()=>input.focus(), 50);
    term.onclick = () => input.focus();

    function resolve(p) {
      if (!p) return cwd;
      return fsNormalizePath(p.startsWith('/') ? p : cwd + '/' + p);
    }
    const commands = {
      help: () => print('Команды: help, ls [путь], cd <путь>, pwd, cat <файл>, echo <текст>, touch <файл>,\nmkdir <папка>, rm <имя>, clear, date, whoami, uname, tree [путь], neofetch, open <приложение>, bsod'),
      ls: (args) => {
        const node = fsGetNode(resolve(args[0]));
        if (!node) return print('ls: путь не найден', 't-err');
        if (node.type === 'file') return print(args[0] || 'файл');
        const names = Object.keys(node.children);
        if (!names.length) return print('(пусто)');
        print(names.map(n => node.children[n].type==='dir' ? n+'/ [D]' : n).join('\n'));
      },
      cd: (args) => {
        const p = resolve(args[0] || '/');
        const node = fsGetNode(p);
        if (node && node.type === 'dir') { cwd = p; setPrompt(); }
        else print('cd: папка не найдена: ' + (args[0]||''), 't-err');
      },
      pwd: () => print(cwd),
      cat: (args) => {
        const node = fsGetNode(resolve(args[0]));
        if (node && node.type === 'file') print(node.content);
        else print('cat: файл не найден', 't-err');
      },
      echo: (args) => print(args.join(' ')),
      touch: (args) => {
        if (!args[0]) return print('usage: touch <файл>', 't-err');
        const dirPath = resolve('.'), parts = fsNormalizePath(dirPath + '/' + args[0]).split('/').filter(Boolean);
        const fname = parts.pop();
        const dir = fsGetNode('/' + parts.join('/'));
        if (dir && dir.type === 'dir') { dir.children[fname] = dir.children[fname] || { type:'file', content:'' }; fsSave(); print('создан: '+fname,'t-ok'); }
        else print('touch: ошибка пути', 't-err');
      },
      mkdir: (args) => {
        if (!args[0]) return print('usage: mkdir <папка>', 't-err');
        const parts = fsNormalizePath(cwd + '/' + args[0]).split('/').filter(Boolean);
        const dname = parts.pop();
        const parent = fsGetNode('/' + parts.join('/'));
        if (parent && parent.type==='dir') { parent.children[dname] = { type:'dir', children:{} }; fsSave(); print('создана папка: '+dname,'t-ok'); }
        else print('mkdir: ошибка', 't-err');
      },
      rm: (args) => {
        const node = fsGetNode(cwd);
        if (args[0] && node.children[args[0]]) { delete node.children[args[0]]; fsSave(); print('удалено: '+args[0],'t-ok'); }
        else print('rm: не найдено: '+(args[0]||''), 't-err');
      },
      clear: () => { out.innerHTML = ''; },
      date: () => print(new Date().toString()),
      whoami: () => print('user'),
      uname: () => print('WebOS 1.0 (HTML Edition) browser-kernel x86-js'),
      tree: (args) => {
        function walk(p, depth) {
          const node = fsGetNode(p);
          if (!node || node.type!=='dir') return;
          const keys = Object.keys(node.children).sort();
          keys.forEach((k,i) => {
            const last = i === keys.length-1;
            print(' '.repeat(depth*2) + (last?'└─ ':'├─ ') + k + (node.children[k].type==='dir'?'/':''));
            if (node.children[k].type==='dir') walk(fsNormalizePath(p+'/'+k), depth+1);
          });
        }
        const p = resolve(args[0]); print(p); walk(p, 1);
      },
      open: (args) => {
        const id = args[0];
        if (Apps[id]) { OS.openApp(id); print('запуск: ' + Apps[id].name, 't-ok'); }
        else print('open: приложение не найдено. Доступны: ' + Object.keys(Apps).join(', '), 't-err');
      },
      neofetch: () => print(
`        ____          user@webos
       / __ \  -----  OS: WebOS 1.0 HTML Edition
      / /_/ /  Host: ${navigator.userAgent.includes('Firefox')?'Firefox Browser':'Browser'}
     / _, _/   Kernel: JS ${new Date().getFullYear()}
    /_/ |_| \\__\\  Uptime: ${Math.floor(performance.now()/1000)} c
                 Shell: websh 1.0
                 DE: WebDesktop
                 Resolution: ${window.innerWidth}x${window.innerHeight}
                 CPU: ${navigator.hardwareConcurrency||'?'} vCPU
                 Memory: ${(navigator.deviceMemory||'?')} GB`),
      bsod: () => { OS.bsod(); }
    };

    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        const line = input.value;
        print(`user@webos:${cwd}$ ${line}`);
        input.value = '';
        if (line.trim()) {
          history.unshift(line); hIdx = -1;
          const parts = line.trim().split(/\s+/);
          const cmd = parts[0].toLowerCase();
          if (commands[cmd]) { try { commands[cmd](parts.slice(1)); } catch(err){ print('Ошибка: '+err.message,'t-err'); } }
          else print(`websh: команда не найдена: ${cmd} (введите "help")`, 't-err');
        }
      } else if (e.key === 'ArrowUp') { if (hIdx < history.length-1) input.value = history[++hIdx]; e.preventDefault(); }
      else if (e.key === 'ArrowDown') { if (hIdx > 0) input.value = history[--hIdx]; else { hIdx=-1; input.value=''; } e.preventDefault(); }
    };
  }
});

/* ---------- Рисовалка ---------- */
registerApp('paint', {
  name: 'Рисовалка', icon: '🎨', width: 640, height: 480,
  open(win) {
    win.body.innerHTML = `
      <div class="paint">
        <div class="paint-tools">
          <input type="color" value="#4da3ff" title="Цвет">
          <input type="range" min="1" max="40" value="4" title="Размер кисти" style="width:90px">
          <button data-t="brush" class="active">🖌 Кисть</button>
          <button data-t="eraser">🧹 Ластик</button>
          <button data-t="line">📏 Линия</button>
          <button class="p-clear">🗑 Очистить</button>
          <button class="p-save">💾 Сохранить PNG</button>
        </div>
        <canvas></canvas>
      </div>`;
    const canvas = win.body.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const color = win.body.querySelector('input[type=color]');
    const size = win.body.querySelector('input[type=range]');
    let tool = 'brush', drawing = false, startX = 0, startY = 0, snapshot = null;
    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      const img = canvas.width ? ctx.getImageData(0,0,canvas.width,canvas.height) : null;
      canvas.width = rect.width; canvas.height = rect.height;
      ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (img) ctx.putImageData(img, 0, 0);
    }
    new ResizeObserver(resizeCanvas).observe(canvas);
    win.body.querySelectorAll('.paint-tools button[data-t]').forEach(b => b.onclick = () => {
      tool = b.dataset.t;
      win.body.querySelectorAll('.paint-tools button[data-t]').forEach(x=>x.classList.toggle('active', x===b));
    });
    win.body.querySelector('.p-clear').onclick = () => { ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); };
    win.body.querySelector('.p-save').onclick = () => {
      const a = document.createElement('a');
      a.download = 'рисунок.png'; a.href = canvas.toDataURL(); a.click();
      OS.notify('Рисовалка', 'Рисунок сохранён как PNG');
    };
    function pos(e) { const r = canvas.getBoundingClientRect(); return [e.clientX-r.left, e.clientY-r.top]; }
    canvas.addEventListener('pointerdown', e => {
      drawing = true; [startX,startY] = pos(e);
      if (tool === 'line') { snapshot = ctx.getImageData(0,0,canvas.width,canvas.height); }
      else { ctx.beginPath(); ctx.moveTo(startX,startY); }
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', e => {
      if (!drawing) return;
      const [x,y] = pos(e);
      ctx.strokeStyle = tool==='eraser' ? '#ffffff' : color.value;
      ctx.lineWidth = size.value;
      if (tool === 'brush' || tool === 'eraser') { ctx.lineTo(x,y); ctx.stroke(); }
      else if (tool === 'line') {
        ctx.putImageData(snapshot,0,0);
        ctx.beginPath(); ctx.moveTo(startX,startY); ctx.lineTo(x,y); ctx.stroke();
      }
    });
    canvas.addEventListener('pointerup', () => drawing = false);
  }
});

/* ---------- Сапёр ---------- */
registerApp('mines', {
  name: 'Сапёр', icon: '💣', width: 420, height: 480, resizable: false,
  open(win) {
    const W = 9, H = 9, MINES = 10;
    win.body.innerHTML = `
      <div class="mines">
        <div class="ms-head"><span class="ms-left"></span><button class="ms-reset">🙂</button><span class="ms-time">⏱ 0</span></div>
        <div class="ms-grid"></div>
        <div style="font-size:12px;color:#666">ЛКМ — открыть · ПКМ — флаг</div>
      </div>`;
    const grid = win.body.querySelector('.ms-grid');
    grid.style.gridTemplateColumns = `repeat(${W}, 26px)`;
    let cells, over, timer, t=0, flags;
    function reset() {
      over = false; flags = 0; t = 0; clearInterval(timer); timer = null;
      win.body.querySelector('.ms-reset').textContent = '🙂';
      win.body.querySelector('.ms-time').textContent = '⏱ 0';
      cells = Array.from({length:H}, ()=>Array.from({length:W}, ()=>({mine:false,open:false,flag:false,n:0})));
      let placed = 0;
      while (placed < MINES) {
        const x = Math.floor(Math.random()*W), y = Math.floor(Math.random()*H);
        if (!cells[y][x].mine) { cells[y][x].mine = true; placed++; }
      }
      for (let y=0;y<H;y++) for (let x=0;x<W;x++) {
        let n = 0;
        for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) {
          const ny=y+dy, nx=x+dx;
          if (ny>=0&&ny<H&&nx>=0&&nx<W&&cells[ny][nx].mine) n++;
        }
        cells[y][x].n = n;
      }
      render();
    }
    function render() {
      grid.innerHTML = '';
      win.body.querySelector('.ms-left').textContent = `💣 ${MINES - flags}`;
      for (let y=0;y<H;y++) for (let x=0;x<W;x++) {
        const c = cells[y][x];
        const d = document.createElement('div');
        d.className = 'ms-cell' + (c.open?' open':'') + (c.flag&&!c.open?' flag':'') + (c.open&&c.mine?' mine':'');
        if (c.open && !c.mine && c.n > 0) { d.textContent = c.n; d.classList.add('c'+c.n); }
        if (c.open && c.mine) d.textContent = '💣';
        if (c.flag && !c.open) d.textContent = '🚩';
        d.onclick = () => reveal(x,y);
        d.oncontextmenu = (e) => { e.preventDefault(); toggleFlag(x,y); };
        grid.appendChild(d);
      }
    }
    function startTimer(){ if (!timer) timer = setInterval(()=>{ t++; win.body.querySelector('.ms-time').textContent='⏱ '+t; },1000); }
    function reveal(x,y) {
      if (over) return;
      const c = cells[y][x];
      if (c.open || c.flag) return;
      startTimer();
      c.open = true;
      if (c.mine) { lose(); return; }
      if (c.n === 0) {
        for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) {
          const ny=y+dy, nx=x+dx;
          if (ny>=0&&ny<H&&nx>=0&&nx<W) reveal(nx,ny);
        }
      }
      checkWin(); render();
    }
    function toggleFlag(x,y) {
      if (over) return;
      const c = cells[y][x];
      if (c.open) return;
      c.flag = !c.flag; flags += c.flag?1:-1; render();
    }
    function lose() {
      over = true; clearInterval(timer);
      win.body.querySelector('.ms-reset').textContent = '😵';
      for (let y=0;y<H;y++) for (let x=0;x<W;x++) if (cells[y][x].mine) cells[y][x].open = true;
      render();
    }
    function checkWin() {
      let opened = 0;
      cells.flat().forEach(c => { if (c.open) opened++; });
      if (opened === W*H - MINES) {
        over = true; clearInterval(timer);
        win.body.querySelector('.ms-reset').textContent = '😎';
        OS.notify('Сапёр', `Победа за ${t} секунд! 🎉`);
      }
    }
    win.body.querySelector('.ms-reset').onclick = reset;
    reset();
  }
});

/* ---------- Игра "Жизнь" ---------- */
registerApp('life', {
  name: 'Жизнь', icon: '🧬', width: 560, height: 460,
  open(win) {
    win.body.innerHTML = `
      <div class="game-life">
        <div class="gl-bar">
          <button class="l-toggle">▶ Старт</button>
          <button class="l-step">Шаг</button>
          <button class="l-random">🎲 Случайно</button>
          <button class="l-clear">Очистить</button>
          <span class="l-gen">Поколение: 0</span>
        </div>
        <canvas></canvas>
      </div>`;
    const canvas = win.body.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const CELL = 10;
    let cols, rows, grid, running = false, gen = 0, raf = null;
    function resize() {
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width; canvas.height = r.height;
      cols = Math.floor(canvas.width/CELL); rows = Math.floor(canvas.height/CELL);
      if (!grid || grid.length !== rows) grid = Array.from({length:rows},()=>Array(cols).fill(0));
    }
    new ResizeObserver(resize).observe(canvas);
    resize();
    function randomize() { grid = Array.from({length:rows},()=>Array.from({length:cols},()=>Math.random()<0.25?1:0)); gen=0; draw(); }
    function step() {
      const ng = Array.from({length:rows},()=>Array(cols).fill(0));
      for (let y=0;y<rows;y++) for (let x=0;x<cols;x++) {
        let n = 0;
        for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) {
          if (!dx&&!dy) continue;
          const ny=(y+dy+rows)%rows, nx=(x+dx+cols)%cols;
          n += grid[ny][nx];
        }
        ng[y][x] = (grid[y][x] && (n===2||n===3)) || (!grid[y][x] && n===3) ? 1 : 0;
      }
      grid = ng; gen++; draw();
    }
    function draw() {
      ctx.fillStyle = '#11151c'; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = '#4da3ff';
      for (let y=0;y<rows;y++) for (let x=0;x<cols;x++) if (grid[y][x]) ctx.fillRect(x*CELL+1, y*CELL+1, CELL-2, CELL-2);
      win.body.querySelector('.l-gen').textContent = 'Поколение: ' + gen;
    }
    function loop() { if (running) { step(); raf = requestAnimationFrame(loop); } }
    canvas.onclick = (e) => {
      const r = canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX-r.left)/CELL), y = Math.floor((e.clientY-r.top)/CELL);
      if (grid[y]) { grid[y][x] ^= 1; draw(); }
    };
    const btnToggle = win.body.querySelector('.l-toggle');
    btnToggle.onclick = () => {
      running = !running;
      btnToggle.textContent = running ? '⏸ Пауза' : '▶ Старт';
      btnToggle.classList.toggle('stop', running);
      if (running) loop(); else cancelAnimationFrame(raf);
    };
    win.body.querySelector('.l-step').onclick = step;
    win.body.querySelector('.l-random').onclick = randomize;
    win.body.querySelector('.l-clear').onclick = () => { grid = Array.from({length:rows},()=>Array(cols).fill(0)); gen=0; draw(); };
    randomize();
    win.onClose = () => { running = false; cancelAnimationFrame(raf); };
  }
});

/* ---------- Часы ---------- */
registerApp('clock', {
  name: 'Часы', icon: '🕒', width: 380, height: 300,
  open(win) {
    win.body.innerHTML = `<div class="clockapp"><div class="ca-time"></div><div class="ca-date"></div></div>`;
    const upd = () => {
      if (!document.body.contains(tEl)) return clearInterval(iv);
      const d = new Date();
      win.body.querySelector('.ca-time').textContent = d.toLocaleTimeString('ru-RU');
      win.body.querySelector('.ca-date').textContent = d.toLocaleDateString('ru-RU', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
    };
    const tEl = win.el;
    upd(); const iv = setInterval(upd, 1000);
    win.onClose = () => clearInterval(iv);
  }
});

/* ---------- Браузер ---------- */
registerApp('browser', {
  name: 'Браузер', icon: '🌐', width: 800, height: 560,
  open(win) {
    win.body.innerHTML = `
      <div class="browser">
        <div class="br-bar">
          <button class="br-back" title="Домой">🏠</button>
          <input class="br-url" placeholder="Адрес сайта (https://...)">
          <button class="br-go">➜</button>
        </div>
        <div class="br-content" style="flex:1;display:flex;flex-direction:column">
          <div class="br-note">
            <b>🌐 WebBrowser</b><br><br>
            Это демонстрационный браузер внутри веб-ОС.<br>
            Многие сайты запрещают встраивание через iframe, поэтому работает не всё.<br><br>
            Попробуйте:&nbsp;
            <a href="#" class="lk" data-u="https://example.com">example.com</a> ·
            <a href="#" class="lk" data-u="https://wikipedia.org">Wikipedia</a> ·
            <a href="#" class="lk" data-u="https://duckduckgo.com">DuckDuckGo</a>
          </div>
          <iframe class="br-frame" style="display:none" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>
        </div>
      </div>`;
    const urlIn = win.body.querySelector('.br-url');
    const frame = win.body.querySelector('.br-frame');
    const note = win.body.querySelector('.br-note');
    function nav(u) {
      if (!u) return;
      if (!/^https?:\/\//.test(u)) u = 'https://' + u;
      urlIn.value = u;
      note.style.display = 'none';
      frame.style.display = 'block';
      frame.src = u;
    }
    win.body.querySelector('.br-go').onclick = () => nav(urlIn.value);
    win.body.querySelector('.br-back').onclick = () => { frame.style.display='none'; note.style.display='block'; };
    urlIn.onkeydown = e => { if (e.key==='Enter') nav(urlIn.value); };
    win.body.querySelectorAll('.lk').forEach(a => a.onclick = e => { e.preventDefault(); nav(a.dataset.u); });
  }
});

/* ---------- О системе ---------- */
registerApp('about', {
  name: 'О системе', icon: 'ℹ️', width: 460, height: 360, resizable: false,
  open(win) {
    win.body.innerHTML = `
      <div class="app-pad about-box">
        <h2 style="margin-bottom:8px">WebOS 1.0 <span style="color:#4da3ff">«HTML Edition»</span></h2>
        Полноценная демонстрация ОС в браузере.<br>
        Ядро: <code>JavaScript ES2020</code> · Оболочка: <code>DOM + CSS Grid/Flex</code><br>
        Файловая система: <code>localStorage</code><br><br>
        <b>Горячие клавиши:</b><br>
        <code>Ctrl+Alt+T</code> — терминал · <code>Esc</code> — закрыть меню<br>
        Двойной клик по строке заголовка — свернуть/развернуть окно.<br><br>
        <span style="color:#888">© ${new Date().getFullYear()} Сделано на чистом HTML/CSS/JS без зависимостей.</span>
      </div>`;
  }
});

/* ---------- Настройки ---------- */
registerApp('settings', {
  name: 'Настройки', icon: '⚙️', width: 620, height: 440,
  open(win) {
    win.body.innerHTML = `
      <div class="settings">
        <div class="set-side">
          <div class="active" data-p="wallpaper">🖼 Оформление</div>
          <div data-p="system">🖥 Система</div>
          <div data-p="about">ℹ️ О программе</div>
        </div>
        <div class="set-main"></div>
      </div>`;
    const main = win.body.querySelector('.set-main');
    const pages = {
      wallpaper() {
        main.innerHTML = `<h2>Обои рабочего стола</h2>
          <div class="wp-picker">
            <div class="wp-thumb wp1" data-w="wp1"></div>
            <div class="wp-thumb wp2" data-w="wp2"></div>
            <div class="wp-thumb wp3" data-w="wp3"></div>
            <div class="wp-thumb wp4" data-w="wp4"></div>
            <div class="wp-thumb wp5" data-w="wp5"></div>
          </div>
          <p style="margin-top:14px;color:#666;font-size:13px">Текущие обои сохраняются между перезагрузками.</p>`;
        const cur = localStorage.getItem('webos_wp') || 'wp1';
        main.querySelectorAll('.wp-thumb').forEach(t => {
          t.classList.add(t.dataset.w);
          if (t.dataset.w === cur) t.classList.add('active');
          t.onclick = () => { OS.setWallpaper(t.dataset.w); main.querySelectorAll('.wp-thumb').forEach(x=>x.classList.remove('active')); t.classList.add('active'); };
        });
      },
      system() {
        main.innerHTML = `<h2>Система</h2>
          <label style="display:block;margin-bottom:12px"><input type="checkbox" id="set-notif" ${OS.soundOn?'checked':''}> Звуковые уведомления</label>
          <label style="display:block;margin-bottom:12px"><input type="checkbox" id="set-widget" ${localStorage.getItem('webos_widget')!=='0'?'checked':''}> Виджет часов на рабочем столе</label>
          <button id="set-reset" style="padding:8px 16px;border-radius:8px;border:1px solid #d33;background:#ffecec;color:#a33;cursor:pointer">🗑 Сбросить файловую систему</button>
          <button id="set-bsod" style="padding:8px 16px;border-radius:8px;border:1px solid #999;background:#eee;cursor:pointer;margin-left:8px">💀 Тест BSOD</button>`;
        main.querySelector('#set-notif').onchange = e => OS.setSound(e.target.checked);
        main.querySelector('#set-widget').onchange = e => OS.setWidget(e.target.checked);
        main.querySelector('#set-reset').onclick = () => {
          if (confirm('Удалить все файлы и настройки?')) { localStorage.removeItem('webos_fs'); location.reload(); }
        };
        main.querySelector('#set-bsod').onclick = () => OS.bsod();
      },
      about() { OS.openApp('about'); main.innerHTML = '<h2>О программе</h2><p>Откройте приложение «О системе» из меню Пуск.</p>'; }
    };
    win.body.querySelectorAll('.set-side div').forEach(d => d.onclick = () => {
      win.body.querySelectorAll('.set-side div').forEach(x=>x.classList.remove('active'));
      d.classList.add('active'); pages[d.dataset.p]();
    });
    pages.wallpaper();
  }
});

/* ---------- Корзина ---------- */
registerApp('trash', {
  name: 'Корзина', icon: '🗑', width: 520, height: 380,
  open(win) {
    win.body.innerHTML = `<div class="trash-empty"><div class="te-icon">🗑</div>Корзина пуста<br><small>Здесь пока ничего нет 🙂</small></div>`;
  }
});
