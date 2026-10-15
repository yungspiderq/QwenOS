/* ==========================================================================
   QwenOS 3.0 — apps/system.js
   Терминал (qsh) и Файловый менеджер
   ========================================================================== */
(function (OS) {
  'use strict';
  const fs = OS.fs;

  /* =======================================================================
     ТЕРМИНАЛ
     ======================================================================= */
  OS.Apps.register({
    id: 'terminal',
    name: 'Терминал',
    icon: 'terminal',
    color: '#15803d', color2: '#052e16',
    category: 'Система',
    keywords: 'shell консоль qsh команда cmd bash',
    width: 780, height: 460, minWidth: 380, minHeight: 220,
    mount(win, api) {
      const user = OS.settings.get('user');
      const S = {
        cwd: fs.home(),
        hist: [], hIdx: -1,
        env: { PS1: 'qsh', TERM: 'xterm-qwen', USER: user, HOME: fs.home(), PATH: '/bin:/usr/bin' }
      };

      win.body.innerHTML =
        '<div class="term">' +
          '<div class="term-out" id="' + win.id + '-out"></div>' +
          '<div class="term-line">' +
            '<span class="term-prompt"></span>' +
            '<input class="term-in" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Командная строка">' +
          '</div>' +
        '</div>';
      const out = win.body.querySelector('.term-out');
      const inp = win.body.querySelector('.term-in');
      const promptEl = win.body.querySelector('.term-prompt');
      win.body.classList.add('term-host');

      const c = (cls, txt) => '<span class="' + cls + '">' + OS.esc(txt) + '</span>';
      let capture = null; // не-null, когда вывод перенаправляется в файл ( > / >> )
      function print(html, cls) {
        if (capture) { const d = OS.el('div'); d.innerHTML = html == null ? '' : html; capture.push(d.textContent); return d; }
        const d = OS.el('div', { class: 'term-row' + (cls ? ' ' + cls : '') });
        d.innerHTML = html == null ? '' : html;
        out.append(d);
        out.scrollTop = out.scrollHeight;
        return d;
      }
      const text = (t, cls) => print(OS.esc(t), cls);

      function shortPath(p) {
        const h = fs.home();
        if (p === h) return '~';
        if (p.startsWith(h + '/')) return '~' + p.slice(h.length);
        return p;
      }
      function updatePrompt() {
        promptEl.innerHTML = c('t-user', user) + c('t-at', '@') + c('t-host', 'qwenos') + ':' + c('t-path', shortPath(S.cwd)) + c('t-dollar', '$ ');
        win.setTitle('Терминал — ' + shortPath(S.cwd));
      }
      const abs = (p) => fs.normalize(p, S.cwd);

      /* --------------------------------------------------- набор команд */
      const CMDS = {};
      const def = (name, fn, help) => { CMDS[name] = { fn: fn, help: help }; };

      def('help', (args) => {
        if (args[0]) {
          const cmd = CMDS[args[0]];
          if (!cmd) return text('Нет справки по «' + args[0] + '»', 't-err');
          print('<b class="t-cmd">' + OS.esc(args[0]) + '</b> — ' + OS.esc(cmd.help || ''));
          return;
        }
        print('<b>QwenOS shell (qsh) ' + OS.version + '</b> — доступные команды:\n');
        const groups = {
          'Файлы': ['ls', 'cd', 'pwd', 'cat', 'write', 'mkdir', 'touch', 'rm', 'mv', 'cp', 'tree', 'find', 'grep', 'wc', 'du'],
          'Система': ['neofetch', 'uname', 'hostname', 'whoami', 'date', 'uptime', 'ps', 'kill', 'free', 'df', 'history', 'clear', 'exit'],
          'Приложения': ['apps', 'open', 'theme', 'accent', 'wallpaper', 'notify', 'say', 'store'],
          'Развлечения': ['cowsay', 'fortune', 'matrix', 'calc', 'colors', 'ping', 'curl', 'sudo']
        };
        for (const g in groups) {
          print(c('t-dim', '  ' + g.toUpperCase()));
          groups[g].forEach((n) => {
            if (!CMDS[n]) return;
            print('    ' + c('t-cmd', n.padEnd(11)) + c('t-dim', (CMDS[n].help || '').slice(0, 62)));
          });
          print('');
        }
        print(c('t-dim', 'Совет: Tab — автодополнение, ↑/↓ — история, echo "текст" > файл — запись.'));
      }, 'эта справка');

      def('ls', (args) => {
        const long = args.includes('-l') || args.includes('-la') || args.includes('-al');
        const target = args.find((a) => !a.startsWith('-')) || S.cwd;
        const p = abs(target);
        if (!fs.exists(p)) return text('ls: ' + target + ': нет такого файла или каталога', 't-err');
        if (fs.isFile(p)) { print(long ? lsLine(fs.stat(p)) : c('t-file', fs.basename(p))); return; }
        const items = fs.list(p);
        if (!items.length) return text('(пусто)', 't-dim');
        if (long) { items.forEach((it) => print(lsLine(it))); return; }
        const cols = Math.max(2, Math.floor((out.clientWidth || 600) / 20));
        let line = '', n = 0;
        items.forEach((it) => {
          const nm = it.type === 'dir' ? c('t-dir', it.name + '/') : (isImg(it.name) ? c('t-img', it.name) : c('t-file', it.name));
          line += nm + ' '.repeat(Math.max(1, 18 - it.name.length));
          if (++n % cols === 0) { print(line); line = ''; }
        });
        if (line) print(line);
      }, 'содержимое каталога [-l] [путь]');

      function isImg(n) { return /\.(png|jpe?g|gif|webp|svg)$/i.test(n); }
      function lsLine(it) {
        const d = new Date(it.modified);
        const perm = it.type === 'dir' ? 'drwxr-xr-x' : '-rw-r--r--';
        return c('t-perm', perm) + c('t-dim', ' ' + user + ' ' + user + ' ') +
          c('t-size', String(it.size || (it.type === 'dir' ? 4096 : 0)).padStart(7)) + ' ' +
          c('t-dim', OS.pad(d.getDate()) + '.' + OS.pad(d.getMonth() + 1) + '.' + d.getFullYear()) + '  ' +
          (it.type === 'dir' ? c('t-dir', it.name + '/') : isImg(it.name) ? c('t-img', it.name) : c('t-file', it.name));
      }

      def('cd', (args) => {
        const p = abs(args[0] || '~');
        if (!fs.exists(p)) return text('cd: ' + args[0] + ': нет такого каталога', 't-err');
        if (!fs.isDir(p)) return text('cd: ' + args[0] + ': не каталог', 't-err');
        S.cwd = p; updatePrompt();
      }, 'сменить каталог');

      def('pwd', () => text(S.cwd), 'текущий каталог');

      def('cat', (args) => {
        if (!args.length) return text('cat: укажите файл', 't-err');
        args.forEach((a) => {
          const p = abs(a);
          if (!fs.isFile(p)) return text('cat: ' + a + ': не файл', 't-err');
          text(fs.read(p));
        });
      }, 'вывести содержимое файла');

      def('write', (args) => {
        const p = abs(args[0] || '');
        const body = args.slice(1).join(' ');
        if (!args[0]) return text('write: write <файл> <текст>', 't-err');
        const r = fs.write(p, body);
        text(r.ok ? 'записано ' + r.size + ' байт → ' + p : 'ошибка: ' + r.error, r.ok ? 't-ok' : 't-err');
      }, 'записать текст в файл');

      def('mkdir', (args) => {
        if (!args.length) return text('mkdir: укажите имя', 't-err');
        args.forEach((a) => { const r = fs.mkdir(abs(a), true); text(r.ok ? 'создан ' + a : 'mkdir: ' + r.error, r.ok ? 't-ok' : 't-err'); });
      }, 'создать каталог');

      def('touch', (args) => {
        args.forEach((a) => { const p = abs(a); if (fs.exists(p)) fs.write(p, fs.read(p)); else fs.write(p, ''); });
      }, 'создать пустой файл');

      def('rm', (args) => {
        const rec = args.some((a) => /^-r/.test(a));
        const targets = args.filter((a) => !a.startsWith('-'));
        if (!targets.length) return text('rm: укажите путь', 't-err');
        targets.forEach((t) => {
          const p = abs(t);
          if (!fs.exists(p)) return text('rm: ' + t + ': не найдено', 't-err');
          if (fs.isDir(p) && !rec) return text('rm: ' + t + ': это каталог (нужен -r)', 't-err');
          const r = fs.rm(p, rec);
          text(r.ok ? 'удалено ' + t : 'rm: ' + r.error, r.ok ? 't-ok' : 't-err');
        });
      }, 'удалить файл/каталог [-r]');

      def('mv', (args) => {
        if (args.length < 2) return text('mv: mv <откуда> <куда>', 't-err');
        const src = abs(args[0]), dst = abs(args[1]);
        if (fs.isDir(dst)) { const r = fs.move(src, dst); return text(r.ok ? 'перемещено' : 'mv: ' + r.error, r.ok ? 't-ok' : 't-err'); }
        const rn = fs.rename(src, fs.basename(dst));
        if (rn.ok && fs.dirname(dst) !== fs.dirname(src)) fs.move(rn.path, fs.dirname(dst));
        text(rn.ok ? 'перемещено' : 'mv: ' + rn.error, rn.ok ? 't-ok' : 't-err');
      }, 'переместить/переименовать');

      def('cp', (args) => {
        if (args.length < 2) return text('cp: cp <откуда> <куда>', 't-err');
        const r = fs.copy(abs(args[0]), fs.isDir(abs(args[1])) ? abs(args[1]) : fs.dirname(abs(args[1])));
        text(r.ok ? 'скопировано → ' + r.path : 'cp: ' + r.error, r.ok ? 't-ok' : 't-err');
      }, 'копировать файл/каталог');

      def('tree', (args) => {
        const p = abs(args[0] || S.cwd);
        print('<span class="t-dir">' + OS.esc(shortPath(p)) + '</span>');
        const walk = (dir, pref) => {
          const items = fs.list(dir);
          items.forEach((it, i) => {
            const last = i === items.length - 1;
            print(c('t-dim', pref + (last ? '└── ' : '├── ')) + (it.type === 'dir' ? c('t-dir', it.name) : c('t-file', it.name)));
            if (it.type === 'dir' && pref.length < 24) walk(it.path, pref + (last ? '    ' : '│   '));
          });
        };
        walk(p, '');
        const cc = fs.count(p);
        print(c('t-dim', '\n' + cc.dirs + ' каталогов, ' + cc.files + ' файлов'));
      }, 'дерево каталогов');

      def('find', (args) => {
        if (!args[0]) return text('find: укажите имя', 't-err');
        const res = fs.find(args.join(' '), S.cwd);
        if (!res.length) return text('ничего не найдено', 't-dim');
        res.forEach((r) => print((r.type === 'dir' ? c('t-dir', r.path) : c('t-file', r.path)) + c('t-dim', '  ' + OS.fmtBytes(r.size))));
      }, 'поиск по имени');

      def('grep', (args) => {
        if (!args[0]) return text('grep: укажите текст', 't-err');
        const q = args[0], root = args[1] ? abs(args[1]) : S.cwd;
        const res = fs.grep(q, root);
        if (!res.length) return text('совпадений нет', 't-dim');
        res.forEach((r) => print(c('t-file', r.path) + c('t-dim', ': ') + OS.esc(r.line)));
      }, 'поиск по содержимому');

      def('wc', (args) => {
        args.forEach((a) => {
          const v = fs.read(abs(a));
          if (v == null) return text('wc: ' + a + ': не файл', 't-err');
          const lines = v.split('\n').length, words = v.split(/\s+/).filter(Boolean).length;
          print(c('t-size', String(lines).padStart(6)) + c('t-dim', ' строк ') + c('t-size', String(words).padStart(6)) + c('t-dim', ' слов  ') + c('t-file', a));
        });
      }, 'число строк и слов');

      def('du', (args) => text(OS.fmtBytes(fs.du(abs(args[0] || S.cwd))) + '\t' + shortPath(abs(args[0] || S.cwd))), 'размер каталога');

      def('echo', (args) => text(args.join(' ')), 'вывести текст');

      def('clear', () => { out.innerHTML = ''; }, 'очистить экран');

      def('history', () => { S.hist.forEach((h, i) => print(c('t-dim', String(i + 1).padStart(4)) + '  ' + c('t-cmd', h))); }, 'история команд');

      def('exit', () => { setTimeout(() => api.close(), 120); }, 'закрыть терминал');

      def('date', () => text(new Date().toString()), 'текущая дата и время');
      def('uptime', () => text('up ' + OS.fmtDur(OS.uptime()) + ',  1 пользователь,  нагрузка: ' + (Math.random() * 0.6 + 0.1).toFixed(2)), 'время работы');
      def('whoami', () => text(user), 'имя пользователя');
      def('hostname', () => text('qwenos'), 'имя машины');
      def('uname', (a) => text(a.includes('-a') ? OS.kernel + ' qwenos 6.1.0-web #' + OS.build + ' JavaScript ' + navigator.platform : 'QwenOS'), 'информация о системе');

      def('neofetch', () => {
        const ac = OS.settings.accentPair();
        const mem = OS.memInfo();
        const logo = [
          '      ██████╗     ', '     ██╔═══██╗    ', '    ██║   ██║    ',
          '    ██║   ██║    ', '    ╚██████╔╝    ', '     ╚═════╝     '
        ];
        const info = [
          ['user', user + '@qwenos'], ['os', 'QwenOS ' + OS.version + ' «' + OS.codename + '»'],
          ['kernel', OS.kernel], ['uptime', OS.fmtDur(OS.uptime())],
          ['shell', 'qsh 1.0'], ['resolution', innerWidth + 'x' + innerHeight],
          ['theme', OS.settings.get('theme') + ' / ' + ac.name], ['wm', 'QwenWM (DOM compositor)'],
          ['cpu', 'Virtual CPU × ' + (navigator.hardwareConcurrency || 4)],
          ['memory', OS.fmtBytes(mem.used) + ' / ' + OS.fmtBytes(mem.limit)],
          ['disk', OS.fmtBytes(fs.du('/')) + ' в VFS'], ['fps', OS.perf.fps + ' fps']
        ];
        for (let i = 0; i < Math.max(logo.length, info.length); i++) {
          const l = logo[i] ? c('t-logo', logo[i]) : ' '.repeat(18);
          const r = info[i] ? c('t-key', info[i][0].padEnd(11)) + c('t-val', info[i][1]) : '';
          print(l + ' ' + r);
        }
        print('');
        print(['#000', '#f00', '#0f0', '#ff0', '#00f', '#f0f', '#0ff', '#fff'].map((hex, i) =>
          '<span style="background:' + hex + ';display:inline-block;width:22px;height:11px;border-radius:2px"></span>').join(''));
      }, 'красивая информация о системе');

      def('ps', () => {
        print(c('t-key', '  PID  ПРИЛОЖЕНИЕ       ОКНО                 ВРЕМЯ'));
        OS.wm.windows.forEach((w, i) => {
          print(c('t-size', String(1000 + i).padStart(5)) + '  ' + c('t-cmd', w.appId.padEnd(15)) + c('t-dim', (w.title || '').slice(0, 20).padEnd(21)) + OS.fmtDur(Date.now() - w.openedAt));
        });
        if (!OS.wm.windows.length) text('  (нет запущенных процессов)', 't-dim');
      }, 'список окон-процессов');

      def('kill', (args) => {
        const pid = parseInt(args[0], 10);
        const w = OS.wm.windows[pid - 1000];
        if (!w) return text('kill: процесс не найден', 't-err');
        OS.wm.close(w); text('процесс ' + pid + ' завершён', 't-ok');
      }, 'закрыть окно по PID');

      def('free', () => {
        const m = OS.memInfo();
        print(c('t-dim', '              всего      использовано   свободно'));
        print(c('t-key', 'Mem:  ') + c('t-val', OS.fmtBytes(m.total).padStart(12) + OS.fmtBytes(m.used).padStart(16) + OS.fmtBytes(m.total - m.used).padStart(13)));
        print(c('t-key', 'VFS:  ') + c('t-val', OS.fmtBytes(5 * 1024 * 1024).padStart(12) + OS.fmtBytes(fs.du('/')).padStart(16)));
      }, 'память');

      def('df', () => {
        const used = fs.du('/'), total = 5 * 1024 * 1024;
        print(c('t-key', 'Файловая система   Размер  Занято  Свободно  Использовано  Точка'));
        print(c('t-val', 'qwen-vfs           ' + OS.fmtBytes(total).padStart(7) + OS.fmtBytes(used).padStart(9) + OS.fmtBytes(total - used).padStart(10) + String(Math.round(used / total * 100) + '%').padStart(11) + '     /'));
      }, 'дисковое пространство');

      def('apps', () => {
        const list = OS.Apps.list().filter((a) => OS.Apps.installed(a.id));
        print(c('t-dim', 'Установлено приложений: ' + list.length));
        list.forEach((a) => print('  ' + c('t-cmd', a.id.padEnd(14)) + c('t-val', a.name)));
      }, 'список приложений');

      def('store', () => api.open('store'), 'открыть QwenStore');

      def('open', (args) => {
        if (!args[0]) return text('open: укажите приложение или путь', 't-err');
        const t = args.join(' ');
        if (OS.Apps.has(t)) { const w = api.open(t); if (w) text('запуск «' + OS.Apps.get(t).name + '»', 't-ok'); return; }
        const p = abs(t);
        if (fs.exists(p)) { OS.wm.openPath(p); text('открываю ' + p, 't-ok'); return; }
        text('open: «' + t + '» не найдено', 't-err');
      }, 'запустить приложение или открыть файл');

      def('theme', (args) => {
        const themes = ['dark', 'light', 'aurora', 'neon', 'mono'];
        if (!args[0] || args[0] === 'list') return text('Доступные темы: ' + themes.join(', ') + '\nТекущая: ' + OS.settings.get('theme'));
        if (!themes.includes(args[0])) return text('theme: нет такой темы', 't-err');
        OS.settings.set('theme', args[0]); text('Тема → ' + args[0], 't-ok');
      }, 'сменить тему оформления');

      def('accent', (args) => {
        if (!args[0]) return text('Акценты: ' + OS.accents.map((a) => a.id).join(', ') + '\nТекущий: ' + OS.settings.get('accent'));
        const a = OS.accents.find((x) => x.id === args[0]);
        if (!a) return text('accent: нет такого акцента', 't-err');
        OS.settings.set('accent', a.id); text('Акцент → ' + a.name, 't-ok');
      }, 'сменить акцентный цвет');

      def('wallpaper', (args) => {
        if (!args[0]) return text('Обои: ' + OS.wallpapers.map((w) => w.id).join(', ') + '\nТекущие: ' + OS.settings.get('wallpaper'));
        const w = OS.wallpapers.find((x) => x.id === args[0]);
        if (!w) return text('wallpaper: нет таких обоев', 't-err');
        OS.settings.set('wallpaper', w.id); text('Обои → ' + w.name, 't-ok');
      }, 'сменить обои');

      def('notify', (args) => OS.toast('Терминал', args.join(' ') || 'Привет из qsh!', { icon: 'terminal' }), 'показать уведомление');

      def('say', (args) => {
        const msg = args.join(' ');
        if (!msg) return text('say: укажите текст', 't-err');
        try {
          if (!('speechSynthesis' in window)) return text('say: синтез речи не поддерживается', 't-err');
          const u = new SpeechSynthesisUtterance(msg); u.lang = 'ru-RU'; u.rate = 1.02;
          speechSynthesis.speak(u); text('говорю…', 't-ok');
        } catch (e) { text('say: ' + e.message, 't-err'); }
      }, 'озвучить текст');

      def('calc', (args) => {
        const expr = args.join('');
        if (!/^[-+*/%().\d\s^eE]+$/.test(expr)) return text('calc: недопустимые символы', 't-err');
        try {
          const r = Function('"use strict";return (' + expr.replace(/\^/g, '**') + ')')();
          print(c('t-dim', expr + ' = ') + c('t-ok', String(r)));
        } catch (e) { text('calc: ошибка выражения', 't-err'); }
      }, 'калькулятор: calc 2+2*10');

      def('colors', () => {
        const row = (from, to) => Array.from({ length: 8 }, (_, i) => '<span style="background:rgb(' + from + ',' + i * 30 + ',' + to + ');display:inline-block;width:26px;height:16px"></span>').join('');
        print(row(30, 90)); print(row(120, 200)); print(row(220, 40));
      }, 'палитра');

      def('cowsay', (args) => {
        const msg = args.join(' ') || 'Moo!';
        const bar = '-'.repeat(msg.length + 2);
        text(' ' + bar + '\n< ' + msg + ' >\n ' + bar + '\n        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||');
      }, 'корова говорит');

      def('fortune', () => {
        const f = [
          'Лучший способ предсказать будущее — написать его в редакторе.',
          'В любом баге есть как минимум одна фича.',
          '99little bugs in the code, 99 little bugs… take one down, patch it around, 127 little bugs in the code.',
          'Работает? Не трогай.',
          'CSS — это просто, сказал никто никогда. Ну почти.',
          'Коммит-сообщение — это письмо себе в будущее.',
          'Массив из 5 элементов содержит 6 состояний: пустой, один, много, и «а где ещё три?»',
          'Локальное хранилище — самая надёжная база данных в браузере.',
          'Если терминал открыт, день проходит продуктивнее.'
        ];
        print(c('t-ok', OS.pick(f)));
      }, 'мудрость дня');

      def('ping', (args) => {
        const host = args[0] || 'qwenos.local';
        text('PING ' + host + ' (127.0.0.1): 56 байт данных');
        let i = 0;
        const t = setInterval(() => {
          if (!win.root.isConnected || i++ >= 4) {
            clearInterval(t);
            print(c('t-dim', '\n--- статистика ' + host + ' ---\n4 пакетов передано, 4 получено, 0% потерь'));
            return;
          }
          print('64 байта из ' + host + ': icmp_seq=' + i + ' ttl=64 время=' + (Math.random() * 8 + 0.4).toFixed(2) + ' мс');
        }, 500);
      }, 'проверить хост');

      def('curl', (args) => {
        const url = args[0] || 'qwen://home';
        const pages = OS.webPages ? OS.webPages() : null;
        if (pages && pages[url.replace(/^https?:\/\//, '')]) {
          text(pages[url.replace(/^https?:\/\//, '')].text || '(страница получена)');
        } else if (/^https?:\/\//.test(url)) {
          text('curl: внешний доступ из песочницы QwenOS запрещён.\nПопробуйте внутренние адреса: qwen://home, qwen://docs, qwen://news', 't-warn');
        } else text('curl: ' + url + ' — 404 Not Found', 't-err');
      }, 'запросить страницу QwenNet');

      def('sudo', (args) => {
        if (!args.length) return text('sudo: укажите команду', 't-err');
        text('[sudo] пароль для ' + user + ': ', 't-dim');
        setTimeout(() => {
          if (args[0] === 'rm' && args.includes('-rf') && args.includes('/')) {
            text('Хорошая попытка 🙂 Форматирование виртуального диска отклонено политикой QwenOS.', 't-warn');
          } else {
            print(c('t-ok', user + ' не входит в список sudoers. Инцидент будет записан в /var/log/system.log'));
            fs.write('/var/log/system.log', (fs.read('/var/log/system.log') || '') + '[' + new Date().toISOString() + '] security: ' + user + ' пытался выполнить sudo ' + args.join(' ') + '\n');
          }
        }, 500);
      }, 'выполнить от root (почти)');

      def('matrix', (args) => {
        const secs = Math.min(20, parseInt(args[0], 10) || 8);
        text('Вход в Матрицу… (' + secs + ' с, любая клавиша — выход)', 't-ok');
        const cv = OS.el('canvas', { class: 'term-matrix' });
        const wrap = OS.el('div', { class: 'matrix-wrap' }, [cv]);
        win.body.append(wrap);
        const ctx2 = cv.getContext('2d');
        let raf = 0, drops = [], size = 14;
        const resize = () => { cv.width = win.body.clientWidth; cv.height = win.body.clientHeight; drops = new Array(Math.ceil(cv.width / size)).fill(0).map(() => Math.random() * -50); };
        resize();
        const chars = 'アカサタナハマヤラワ01QWENОС█▓▒░<>{}[]$#@%&';
        const t0 = Date.now();
        const draw = () => {
          ctx2.fillStyle = 'rgba(0,6,2,.09)'; ctx2.fillRect(0, 0, cv.width, cv.height);
          ctx2.font = size + 'px monospace';
          drops.forEach((y, i) => {
            const ch = chars[Math.floor(Math.random() * chars.length)];
            ctx2.fillStyle = Math.random() > .975 ? '#d7ffe6' : '#22c55e';
            ctx2.fillText(ch, i * size, y * size);
            if (y * size > cv.height && Math.random() > .975) drops[i] = 0;
            drops[i] += 1;
          });
          if (Date.now() - t0 < secs * 1000 && win.root.isConnected) raf = requestAnimationFrame(draw);
          else stop();
        };
        const stop = () => { cancelAnimationFrame(raf); wrap.remove(); document.removeEventListener('keydown', onKey); };
        const onKey = () => stop();
        document.addEventListener('keydown', onKey);
        raf = requestAnimationFrame(draw);
      }, 'эффект «Матрицы»');

      def('update', (args) => {
        const U = OS.updater;
        if (!U) return text('update: центр обновлений недоступен', 't-err');
        const mode = args[0] || 'check';
        if (mode === 'demo') { text('Демонстрация экрана установки…', 't-ok'); U.demo(); return; }
        if (mode === 'install') {
          if (!U.pending) return text('update: нет загруженного обновления (сначала update check)', 't-warn');
          text('Установка обновления сборки ' + U.pending.build + '…', 't-ok');
          U.install(U.pending);
          return;
        }
        text('Проверка сервера обновлений…', 't-dim');
        U.check({}).then((r) => {
          if (r) {
            print(c('t-ok', 'Доступно обновление: сборка ' + r.build + ' (' + (r.version || OS.version) + ')'));
            print(c('t-dim', 'Установите командой: ') + c('t-cmd', 'update install') + c('t-dim', ' или через уведомление.'));
          } else print(c('t-ok', 'Обновлений нет. Текущая сборка: ' + U.current.build));
        });
      }, 'проверить/установить обновления [check|install|demo]');

      def('reboot', () => { text('Перезагрузка…', 't-warn'); setTimeout(() => OS.power.reboot(), 600); }, 'перезагрузить систему');
      def('shutdown', () => { text('Завершение работы…', 't-warn'); setTimeout(() => OS.power.shutdown(), 600); }, 'выключить');
      def('lock', () => OS.power.lock(), 'заблокировать экран');
      def('logout', () => OS.power.lock(), 'выйти из сеанса');

      /* ------------------------------------------------------ разбор строки */
      function tokenize(line) {
        const out = []; let cur = '', q = null;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (q) { if (ch === q) q = null; else cur += ch; }
          else if (ch === '"' || ch === "'") q = ch;
          else if (/\s/.test(ch)) { if (cur) { out.push(cur); cur = ''; } }
          else cur += ch;
        }
        if (cur) out.push(cur);
        return out;
      }

      function run(rawLine) {
        const line0 = rawLine.trim();
        print(promptEl.innerHTML + c('t-in', line0));
        if (!line0) return;
        S.hist.push(line0); S.hIdx = S.hist.length;

        // перенаправление вывода в файл:  echo hi > note.txt
        let line = line0, redirect = null;
        const rm = line0.match(/^(.*?)\s*(>>?)\s*(\S+)\s*$/);
        if (rm && rm[1].trim()) { line = rm[1].trim(); redirect = { append: rm[2] === '>>', file: rm[3] }; }

        const parts = tokenize(line);
        const name = parts[0];
        const args = parts.slice(1);

        if (redirect) {
          capture = [];
          try { exec(name, args); } catch (e) { capture = null; text(String(e && e.message || e), 't-err'); return; }
          const content = capture.join('\n');
          capture = null;
          const p = abs(redirect.file);
          const prev = redirect.append && fs.isFile(p) ? (fs.read(p) || '').replace(/\n$/, '') + '\n' : '';
          const r = fs.write(p, prev + content);
          text(r.ok ? (redirect.append ? 'дописано в ' : 'записано в ') + p + ' (' + r.size + ' байт)' : 'ошибка: ' + r.error, r.ok ? 't-ok' : 't-err');
          OS.bus.emit('fs:changed', p);
          return;
        }
        exec(name, args);
      }

      function exec(name, args) {
        const cmd = CMDS[name];
        if (!cmd) {
          const near = Object.keys(CMDS).filter((k) => k.startsWith(name[0]) || lev(k, name) <= 2);
          text('qsh: команда не найдена: ' + name + (near.length ? '\nВозможно, вы имели в виду: ' + near.slice(0, 4).join(', ') : ''), 't-err');
          OS.sfx.play('error');
          return;
        }
        try { cmd.fn(args); } catch (e) { text(name + ': ' + (e && e.message || e), 't-err'); }
      }

      function lev(a, b) {
        const m = [];
        for (let i = 0; i <= b.length; i++) m[i] = [i];
        for (let j = 0; j <= a.length; j++) m[0][j] = j;
        for (let i = 1; i <= b.length; i++) for (let j = 1; j <= a.length; j++) {
          m[i][j] = b[i - 1] === a[j - 1] ? m[i - 1][j - 1] : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
        }
        return m[b.length][a.length];
      }

      /* --------------------------------------------------------- ввод */
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const v = inp.value; inp.value = '';
          run(v);
          updatePrompt();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (S.hIdx > 0) { S.hIdx--; inp.value = S.hist[S.hIdx] || ''; }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (S.hIdx < S.hist.length - 1) { S.hIdx++; inp.value = S.hist[S.hIdx] || ''; }
          else { S.hIdx = S.hist.length; inp.value = ''; }
        } else if (e.key === 'Tab') {
          e.preventDefault();
          const v = inp.value;
          const parts = v.split(/(\s+)/);
          const last = parts[parts.length - 1];
          if (!last) return;
          let cands = [];
          if (v.trim().split(/\s+/).length === 1 && !/\s$/.test(v)) {
            cands = Object.keys(CMDS).filter((c) => c.startsWith(last));
          } else {
            const dirPart = last.includes('/') ? last.slice(0, last.lastIndexOf('/') + 1) : '';
            const namePart = last.slice(dirPart.length);
            const base = abs(dirPart || S.cwd);
            cands = fs.list(base).map((i) => dirPart + i.name + (i.type === 'dir' ? '/' : '')).filter((n) => n.slice(dirPart.length).toLowerCase().startsWith(namePart.toLowerCase()));
          }
          if (cands.length === 1) { parts[parts.length - 1] = cands[0]; inp.value = parts.join(''); }
          else if (cands.length > 1) { print(promptEl.innerHTML + c('t-in', v)); print(c('t-dim', cands.join('   '))); }
        } else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); CMDS.clear.fn([]); }
        else if (e.key === 'c' && e.ctrlKey) { e.preventDefault(); print(promptEl.innerHTML + c('t-in', inp.value + '^C')); inp.value = ''; }
      });
      win.body.addEventListener('pointerdown', (e) => {
        if (e.target.closest('a,button,input,.term-matrix')) return;
        const sel = String(window.getSelection());
        if (!sel) setTimeout(() => inp.focus(), 0);
      });

      /* ------------------------------------------------------- приветствие */
      const banner = [
        '<span class="t-logo">  ██████╗  ██╗    ██╗███████╗███╗   ██╗</span>',
        '<span class="t-logo"> ██╔═══██╗ ██║    ██║██╔════╝████╗  ██║</span>',
        '<span class="t-logo"> ██║   ██║ ██║ █╗ ██║█████╗  ██╔██╗ ██║</span>',
        '<span class="t-logo"> ██║▄▄ ██║ ██║███╗██║██╔══╝  ██║╚██╗██║</span>',
        '<span class="t-logo"> ╚██████╔╝ ╚███╔███╔╝███████╗██║ ╚████║</span>',
        '<span class="t-logo">  ╚══▀▀═╝   ╚══╝╚══╝ ╚══════╝╚═╝  ╚═══╝</span>'
      ];
      banner.forEach((b) => print(b));
      print(c('t-dim', 'QwenOS ' + OS.version + ' «' + OS.codename + '» · ' + OS.kernel));
      print(c('t-dim', 'Введите ') + c('t-cmd', 'help') + c('t-dim', ', чтобы увидеть список команд. Сегодня ' + OS.fmtDate() + '.'));
      print('');
      updatePrompt();
      setTimeout(() => inp.focus(), 60);

      return () => { document.removeEventListener('keydown', () => {}); };
    }
  });

  /* =======================================================================
     ФАЙЛОВЫЙ МЕНЕДЖЕР
     ======================================================================= */
  OS.Apps.register({
    id: 'files',
    name: 'Файлы',
    icon: 'folder',
    color: '#f59e0b', color2: '#b45309',
    category: 'Система',
    keywords: 'проводник файлы папки explorer manager vfs',
    width: 860, height: 540, minWidth: 420, minHeight: 280,
    mount(win, api) {
      const S = {
        path: win.params.path || fs.home(),
        hist: [], hi: -1,
        view: OS.store.get('files.view', 'grid'),
        sel: null, q: ''
      };
      if (!fs.isDir(S.path)) S.path = fs.home();

      win.body.innerHTML =
        '<div class="fm">' +
          '<aside class="fm-side"><div class="fm-side-t">Избранное</div><div class="fm-places"></div><div class="fm-side-t">Диск</div><div class="fm-disk"></div></aside>' +
          '<div class="fm-main">' +
            '<div class="fm-bar">' +
              '<button class="ib" data-a="back" title="Назад"></button>' +
              '<button class="ib" data-a="fwd" title="Вперёд"></button>' +
              '<button class="ib" data-a="up" title="Вверх"></button>' +
              '<div class="fm-crumb"></div>' +
              '<div class="fm-search"><span></span><input placeholder="Поиск в папке" spellcheck="false"></div>' +
              '<button class="ib" data-a="newfolder" title="Новая папка"></button>' +
              '<button class="ib" data-a="newfile" title="Новый файл"></button>' +
              '<button class="ib" data-a="view" title="Вид"></button>' +
            '</div>' +
            '<div class="fm-list"></div>' +
            '<div class="fm-status"></div>' +
          '</div>' +
        '</div>';

      const $side = win.body.querySelector('.fm-places');
      const $disk = win.body.querySelector('.fm-disk');
      const $crumb = win.body.querySelector('.fm-crumb');
      const $list = win.body.querySelector('.fm-list');
      const $status = win.body.querySelector('.fm-status');
      const $q = win.body.querySelector('.fm-search input');
      const bar = win.body.querySelector('.fm-bar');
      bar.querySelector('[data-a="back"]').innerHTML = OS.svg('back', 16);
      bar.querySelector('[data-a="fwd"]').innerHTML = OS.svg('fwd', 16);
      bar.querySelector('[data-a="up"]').innerHTML = OS.svg('up', 16);
      bar.querySelector('[data-a="newfolder"]').innerHTML = OS.svg('folder', 16);
      bar.querySelector('[data-a="newfile"]').innerHTML = OS.svg('file', 16);
      win.body.querySelector('.fm-search span').innerHTML = OS.svg('search', 14);

      const PLACES = [
        { name: 'Домашняя папка', path: fs.home(), icon: 'home' },
        { name: 'Рабочий стол', path: fs.home() + '/Desktop', icon: 'monitor' },
        { name: 'Документы', path: fs.home() + '/Documents', icon: 'note' },
        { name: 'Загрузки', path: fs.home() + '/Downloads', icon: 'download' },
        { name: 'Изображения', path: fs.home() + '/Pictures', icon: 'image' },
        { name: 'Музыка', path: fs.home() + '/Music', icon: 'music' },
        { name: 'Проекты', path: fs.home() + '/Projects', icon: 'code' },
        { name: 'Диск /', path: '/', icon: 'disk' },
        { name: 'Система /etc', path: '/etc', icon: 'gear' },
        { name: 'Журналы', path: '/var/log', icon: 'list' }
      ];

      function renderSide() {
        $side.innerHTML = '';
        PLACES.forEach((p) => {
          const b = OS.el('button', { class: 'fm-place' + (S.path === p.path ? ' on' : '') });
          b.innerHTML = OS.svg(p.icon, 15) + '<span>' + OS.esc(p.name) + '</span>';
          b.onclick = () => go(p.path);
          $side.append(b);
        });
        const total = 5 * 1024 * 1024, used = fs.du('/');
        $disk.innerHTML = '<div class="fm-disk-bar"><i style="width:' + Math.min(100, used / total * 100).toFixed(1) + '%"></i></div>' +
          '<div class="fm-disk-t">' + OS.fmtBytes(used) + ' из ' + OS.fmtBytes(total) + '</div>';
      }

      function iconFor(it) {
        if (it.type === 'dir') return { n: 'folder', c: 'linear-gradient(135deg,#fbbf24,#d97706)' };
        const e = it.ext;
        if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(e)) return { n: 'image', c: 'linear-gradient(135deg,#ec4899,#8b5cf6)' };
        if (['md'].includes(e)) return { n: 'book', c: 'linear-gradient(135deg,#3b82f6,#1d4ed8)' };
        if (['js', 'ts', 'json'].includes(e)) return { n: 'code', c: 'linear-gradient(135deg,#facc15,#ca8a04)' };
        if (['css', 'scss'].includes(e)) return { n: 'palette', c: 'linear-gradient(135deg,#22d3ee,#0891b2)' };
        if (['html', 'htm'].includes(e)) return { n: 'globe', c: 'linear-gradient(135deg,#f97316,#c2410c)' };
        if (['mp3', 'wav', 'ogg'].includes(e)) return { n: 'music', c: 'linear-gradient(135deg,#a855f7,#6d28d9)' };
        if (['log', 'txt'].includes(e)) return { n: 'text', c: 'linear-gradient(135deg,#94a3b8,#475569)' };
        return { n: 'file', c: 'linear-gradient(135deg,#94a3b8,#64748b)' };
      }

      function renderCrumb() {
        $crumb.innerHTML = '';
        const parts = S.path.split('/').filter(Boolean);
        const mk = (label, path) => {
          const b = OS.el('button', { class: 'fm-cr' }, label);
          b.onclick = () => go(path);
          return b;
        };
        $crumb.append(mk('qwenos', '/'));
        let acc = '';
        parts.forEach((p) => { acc += '/' + p; $crumb.append(OS.el('span', { class: 'fm-cr-sep' }, '/'), mk(p, acc)); });
      }

      function render() {
        const items = fs.list(S.path).filter((it) => !S.q || it.name.toLowerCase().includes(S.q));
        $list.className = 'fm-list ' + (S.view === 'grid' ? 'grid' : 'rows');
        $list.innerHTML = '';
        if (!items.length) {
          $list.innerHTML = '<div class="fm-empty">' + OS.svg('folderOpen', 42) + '<p>' + (S.q ? 'Ничего не найдено по «' + OS.esc(S.q) + '»' : 'Папка пуста') + '</p></div>';
        }
        items.forEach((it) => {
          const ic = iconFor(it);
          const node = OS.el('div', { class: 'fm-item' + (S.sel === it.path ? ' sel' : ''), tabindex: '0', 'data-path': it.path });
          node.innerHTML =
            '<div class="fm-ic" style="background:' + ic.c + '">' + OS.svg(ic.n, 18) + '</div>' +
            '<div class="fm-nm" title="' + OS.esc(it.name) + '">' + OS.esc(it.name) + '</div>' +
            '<div class="fm-meta">' + (it.type === 'dir' ? fs.list(it.path).length + ' эл.' : OS.fmtBytes(it.size)) + '</div>';
          node.onclick = (e) => { S.sel = it.path; render(); if (e.detail === 2) openItem(it); };
          node.ondblclick = () => openItem(it);
          node.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); S.sel = it.path; render(); itemMenu(e.clientX, e.clientY, it); };
          $list.append(node);
        });
        const cc = fs.count(S.path);
        $status.textContent = items.length + ' эл. в папке · ' + cc.files + ' файлов, ' + cc.dirs + ' подпапок · ' + OS.fmtBytes(fs.du(S.path));
        win.setTitle('Файлы — ' + (S.path === fs.home() ? '~' : S.path));
        renderCrumb(); renderSide();
      }

      function openItem(it) {
        if (it.type === 'dir') return go(it.path);
        OS.wm.openPath(it.path);
      }

      function go(p, noHist) {
        p = fs.normalize(p);
        if (!fs.isDir(p)) { OS.toast('Не каталог', p, { icon: 'x' }); return; }
        if (!noHist) { S.hist = S.hist.slice(0, S.hi + 1); S.hist.push(p); S.hi = S.hist.length - 1; }
        S.path = p; S.sel = null; S.q = ''; $q.value = '';
        render();
      }

      function itemMenu(x, y, it) {
        OS.menu(x, y, [
          { label: it.type === 'dir' ? 'Открыть' : 'Открыть в приложении', icon: 'ext', onClick: () => openItem(it) },
          { label: 'Переименовать', icon: 'pencil', key: 'F2', onClick: () => rename(it) },
          { label: 'Дублировать', icon: 'copy', onClick: () => { fs.copy(it.path, S.path); render(); OS.bus.emit('fs:changed'); } },
          { sep: true },
          { label: 'Копировать путь', icon: 'link', onClick: () => { OS.copyText(it.path); OS.toast('Скопировано', it.path, { icon: 'copy' }); } },
          { label: 'Свойства', icon: 'info', onClick: () => props(it) },
          { sep: true },
          { label: 'Удалить', icon: 'trash', danger: true, key: 'Del', onClick: () => del(it) }
        ]);
      }

      function rename(it) {
        const name = prompt('Новое имя:', it.name);
        if (name == null) return;
        const r = fs.rename(it.path, name.trim());
        if (!r.ok) OS.toast('Ошибка', r.error, { icon: 'x' });
        render(); OS.bus.emit('fs:changed');
      }
      function del(it) {
        if (!confirm('Удалить «' + it.name + '»' + (it.type === 'dir' ? ' со всем содержимым' : '') + '?')) return;
        const r = fs.rm(it.path, true);
        if (!r.ok) OS.toast('Ошибка', r.error, { icon: 'x' });
        render(); OS.bus.emit('fs:changed');
      }
      function props(it) {
        const s = fs.stat(it.path);
        const rows = [
          ['Имя', s.name], ['Тип', s.type === 'dir' ? 'Каталог' : 'Файл (' + (s.ext || 'без расширения') + ')'],
          ['Путь', s.path], ['Размер', OS.fmtBytes(s.size)],
          ['Изменён', OS.fmtDateTime(s.modified)],
          s.type === 'dir' ? ['Содержит', fs.list(s.path).length + ' элементов'] : ['Строк', String((fs.read(s.path) || '').split('\n').length)]
        ];
        api.open('dialog', { title: 'Свойства — ' + s.name, rows: rows, icon: it.type === 'dir' ? 'folder' : 'file' });
      }

      $q.addEventListener('input', OS.debounce(() => { S.q = $q.value.toLowerCase().trim(); render(); }, 160));

      bar.addEventListener('click', (e) => {
        const b = e.target.closest('[data-a]'); if (!b) return;
        const a = b.dataset.a;
        if (a === 'back') { if (S.hi > 0) { S.hi--; go(S.hist[S.hi], true); } }
        else if (a === 'fwd') { if (S.hi < S.hist.length - 1) { S.hi++; go(S.hist[S.hi], true); } }
        else if (a === 'up') go(fs.dirname(S.path));
        else if (a === 'newfolder') {
          const n = prompt('Имя новой папки:', 'Новая папка');
          if (n) { const r = fs.mkdir(fs.join(S.path, n.trim()), true); if (!r.ok) OS.toast('Ошибка', r.error, { icon: 'x' }); render(); OS.bus.emit('fs:changed'); }
        } else if (a === 'newfile') {
          const n = prompt('Имя нового файла:', 'новый.txt');
          if (n) { fs.write(fs.join(S.path, n.trim()), ''); render(); OS.bus.emit('fs:changed'); }
        } else if (a === 'view') {
          S.view = S.view === 'grid' ? 'rows' : 'grid';
          OS.store.set('files.view', S.view);
          b.innerHTML = OS.svg(S.view === 'grid' ? 'list' : 'grid', 16);
          render();
        }
      });
      bar.querySelector('[data-a="view"]').innerHTML = OS.svg(S.view === 'grid' ? 'list' : 'grid', 16);

      win.body.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.fm-item') || e.target.closest('.fm-bar') || e.target.closest('.fm-side')) return;
        e.preventDefault();
        OS.menu(e.clientX, e.clientY, [
          { head: shortP(S.path) },
          { label: 'Новая папка', icon: 'folder', onClick: () => bar.querySelector('[data-a="newfolder"]').click() },
          { label: 'Новый файл', icon: 'file', onClick: () => bar.querySelector('[data-a="newfile"]').click() },
          { sep: true },
          { label: 'Обновить', icon: 'refresh', onClick: () => render() },
          { label: 'Открыть в терминале', icon: 'terminal', onClick: () => api.open('terminal') },
          { sep: true },
          { label: 'Свойства папки', icon: 'info', onClick: () => props({ path: S.path, type: 'dir', name: fs.basename(S.path) }) }
        ]);
      });

      function shortP(p) { return p === fs.home() ? '~' : p; }

      const onKey = (e) => {
        if (!win.root.isConnected || document.activeElement === $q) return;
        if (e.key === 'Backspace' || (e.altKey && e.key === 'ArrowLeft')) { e.preventDefault(); bar.querySelector('[data-a="back"]').click(); }
        else if (e.key === 'F2' && S.sel) { const it = fs.stat(S.sel); if (it) rename(it); }
        else if ((e.key === 'Delete') && S.sel) { const it = fs.stat(S.sel); if (it) del(it); }
        else if (e.key === 'Enter' && S.sel) { const it = fs.stat(S.sel); if (it) openItem(it); }
      };
      document.addEventListener('keydown', onKey);

      const unsub = OS.bus.on('fs:changed', () => { if (win.root.isConnected) render(); });
      win._nav = go;
      go(S.path);
      render();

      return () => { document.removeEventListener('keydown', onKey); unsub(); };
    },
    onReuse(w, params) { if (params && params.path) OS.bus.emit('files:navigate', params.path); }
  });

  // событие навигации для уже открытых окон «Файлы»
  OS.bus.on('files:navigate', (p) => {
    OS.wm.byApp('files').forEach((w) => { if (w._nav) w._nav(p); });
  });
})(window.OS);
