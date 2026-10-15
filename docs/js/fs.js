/* ==========================================================================
   QwenOS 3.0 — fs.js
   Виртуальная файловая система с сохранением в localStorage
   ========================================================================== */
(function (OS) {
  'use strict';

  const KEY = 'fs';
  const now = () => Date.now();

  function dirNode(name) { return { t: 'd', n: name, c: {}, m: now() }; }
  function fileNode(name, content) { return { t: 'f', n: name, v: String(content == null ? '' : content), m: now() }; }

  const FS = {
    root: null,
    _dirty: false,

    /* ---------- пути ---------- */
    normalize(path, cwd) {
      cwd = cwd || '/home/' + (OS.settings.get('user') || 'user');
      let p = String(path == null ? '' : path).trim();
      if (!p) p = cwd;
      if (p === '~' || p.startsWith('~/')) p = cwd + p.slice(1);
      if (!p.startsWith('/')) p = (cwd.replace(/\/$/, '') || '') + '/' + p;
      const out = [];
      p.split('/').forEach((seg) => {
        if (!seg || seg === '.') return;
        if (seg === '..') { out.pop(); return; }
        out.push(seg);
      });
      return '/' + out.join('/');
    },
    split(path) { return this.normalize(path).split('/').filter(Boolean); },
    dirname(path) { const s = this.split(path); s.pop(); return '/' + s.join('/'); },
    basename(path) { const s = this.split(path); return s[s.length - 1] || '/'; },
    join(a, b) { return this.normalize((a === '/' ? '' : a) + '/' + b); },
    ext(path) { const n = this.basename(path); const i = n.lastIndexOf('.'); return i > 0 ? n.slice(i + 1).toLowerCase() : ''; },

    /* ---------- обход ---------- */
    node(path) {
      let n = this.root;
      const segs = this.split(path);
      for (const s of segs) {
        if (!n || n.t !== 'd' || !n.c[s]) return null;
        n = n.c[s];
      }
      return n;
    },
    exists(path) { return !!this.node(path); },
    isDir(path) { const n = this.node(path); return !!n && n.t === 'd'; },
    isFile(path) { const n = this.node(path); return !!n && n.t === 'f'; },

    home() { return '/home/' + (OS.settings.get('user') || 'user'); },

    stat(path) {
      const n = this.node(path);
      if (!n) return null;
      if (n.t === 'd') return { type: 'dir', name: n.n, path: this.normalize(path), modified: n.m, size: this.du(path), items: Object.keys(n.c).length };
      return { type: 'file', name: n.n, path: this.normalize(path), modified: n.m, size: FS.byteLen(n.v), ext: FS.ext(n.n) };
    },

    byteLen(s) { try { return new Blob([s]).size; } catch (e) { return String(s).length; } },

    list(path) {
      const n = this.node(path);
      if (!n || n.t !== 'd') return [];
      const base = this.normalize(path);
      return Object.values(n.c).map((c) => ({
        name: c.n,
        path: (base === '/' ? '' : base) + '/' + c.n,
        type: c.t === 'd' ? 'dir' : 'file',
        modified: c.m,
        ext: c.t === 'f' ? FS.ext(c.n) : '',
        size: c.t === 'f' ? FS.byteLen(c.v) : 0
      })).sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, 'ru') : a.type === 'dir' ? -1 : 1));
    },

    read(path) { const n = this.node(path); return n && n.t === 'f' ? n.v : null; },

    /* ---------- запись ---------- */
    _mkdirs(path) {
      const segs = this.split(path);
      let n = this.root;
      for (const s of segs) {
        if (!n.c[s]) n.c[s] = dirNode(s);
        n = n.c[s];
      }
      return n;
    },
    write(path, content, opts) {
      opts = opts || {};
      path = this.normalize(path);
      const p = this.dirname(path), name = this.basename(path);
      if (!name) return { ok: false, error: 'Некорректное имя файла' };
      if (!this.exists(p)) { if (opts.mkdirs === false) return { ok: false, error: 'Нет каталога ' + p }; this._mkdirs(p); }
      const pn = this.node(p);
      if (pn.c[name] && pn.c[name].t === 'd') return { ok: false, error: 'Это каталог' };
      if (pn.c[name]) { pn.c[name].v = String(content == null ? '' : content); pn.c[name].m = now(); }
      else pn.c[name] = fileNode(name, content);
      this.touch();
      return { ok: true, path: path, size: this.byteLen(String(content == null ? '' : content)) };
    },
    mkdir(path, recursive) {
      path = this.normalize(path);
      if (this.exists(path)) return { ok: false, error: 'Уже существует' };
      const p = this.dirname(path), name = this.basename(path);
      if (!this.exists(p)) { if (!recursive) return { ok: false, error: 'Нет каталога ' + p }; this._mkdirs(p); }
      this.node(p).c[name] = dirNode(name);
      this.touch();
      return { ok: true, path: path };
    },
    rm(path, recursive) {
      path = this.normalize(path);
      if (path === '/') return { ok: false, error: 'Нельзя удалить корень' };
      const n = this.node(path);
      if (!n) return { ok: false, error: 'Не найдено' };
      if (n.t === 'd' && Object.keys(n.c).length && !recursive) return { ok: false, error: 'Каталог не пуст' };
      const pn = this.node(this.dirname(path));
      delete pn.c[this.basename(path)];
      this.touch();
      return { ok: true };
    },
    rename(path, newName) {
      path = this.normalize(path);
      newName = String(newName).trim();
      if (!newName || newName.includes('/')) return { ok: false, error: 'Некорректное имя' };
      const n = this.node(path);
      if (!n) return { ok: false, error: 'Не найдено' };
      const pn = this.node(this.dirname(path));
      if (pn.c[newName]) return { ok: false, error: 'Имя занято' };
      delete pn.c[n.n];
      n.n = newName; n.m = now();
      pn.c[newName] = n;
      this.touch();
      return { ok: true, path: this.join(this.dirname(path), newName) };
    },
    move(src, dstDir) {
      src = this.normalize(src); dstDir = this.normalize(dstDir);
      const n = this.node(src);
      if (!n) return { ok: false, error: 'Не найдено' };
      if (!this.isDir(dstDir)) return { ok: false, error: 'Назначение не каталог' };
      if (dstDir === src || dstDir.startsWith(src + '/')) return { ok: false, error: 'Нельзя переместить в себя' };
      const dst = this.node(dstDir);
      if (dst.c[n.n]) return { ok: false, error: 'Имя занято в каталоге назначения' };
      const sp = this.node(this.dirname(src));
      delete sp.c[n.n];
      dst.c[n.n] = n; n.m = now();
      this.touch();
      return { ok: true, path: this.join(dstDir, n.n) };
    },
    copy(src, dstDir) {
      const n = this.node(src);
      if (!n) return { ok: false, error: 'Не найдено' };
      const clone = JSON.parse(JSON.stringify(n));
      const dst = this.node(dstDir);
      if (!dst || dst.t !== 'd') return { ok: false, error: 'Нет каталога' };
      let name = clone.n, i = 1;
      const dot = name.lastIndexOf('.');
      const stem = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : '';
      while (dst.c[name]) { name = stem + ' (копия ' + (i++) + ')' + ext; }
      clone.n = name; clone.m = now();
      dst.c[name] = clone;
      this.touch();
      return { ok: true, path: this.join(dstDir, name) };
    },

    /* ---------- сводки ---------- */
    du(path) {
      const n = this.node(path || '/');
      if (!n) return 0;
      if (n.t === 'f') return this.byteLen(n.v);
      return Object.values(n.c).reduce((s, c) => s + this.du(this.join(path, c.n)), 0);
    },
    count(path) {
      const n = this.node(path || '/');
      if (!n) return { files: 0, dirs: 0 };
      let files = 0, dirs = 0;
      const walk = (x) => { Object.values(x.c || {}).forEach((c) => { if (c.t === 'd') { dirs++; walk(c); } else files++; }); };
      walk(n);
      return { files: files, dirs: dirs };
    },
    treeText(path, prefix) {
      path = this.normalize(path || '/');
      prefix = prefix || '';
      const items = this.list(path);
      let out = prefix + this.basename(path) + (this.isDir(path) ? '/' : '') + '\n';
      items.forEach((it, idx) => {
        const last = idx === items.length - 1;
        const branch = prefix ? (last ? '└── ' : '├── ') : (last ? '└── ' : '├── ');
        if (it.type === 'dir') out += this.treeText(it.path, prefix + (last ? '    ' : '│   ')).replace(prefix + (prefix ? '' : ''), prefix + branch, 1);
        else out += prefix + branch + it.name + '\n';
      });
      return out;
    },
    find(query, root) {
      query = String(query || '').toLowerCase();
      root = this.normalize(root || '/');
      const out = [];
      const walk = (p) => {
        this.list(p).forEach((it) => {
          if (it.name.toLowerCase().includes(query)) out.push(it);
          if (it.type === 'dir') walk(it.path);
        });
      };
      walk(root);
      return out.slice(0, 400);
    },
    grep(query, root) {
      query = String(query || '');
      root = this.normalize(root || '/');
      const out = [];
      const walk = (p) => {
        this.list(p).forEach((it) => {
          if (it.type === 'dir') walk(it.path);
          else {
            const v = this.read(it.path) || '';
            if (v.indexOf(query) >= 0) {
              const line = v.split('\n').find((l) => l.indexOf(query) >= 0) || '';
              out.push({ path: it.path, line: line.trim().slice(0, 120) });
            }
          }
        });
      };
      walk(root);
      return out.slice(0, 200);
    },

    /* ---------- персистентность ---------- */
    touch() { this._dirty = true; this._save(); },
    _save: OS.debounce(function () {
      try { OS.store.set(KEY, this.root); this._dirty = false; } catch (e) { console.warn('[fs] save failed', e); }
    }, 400),
    saveNow() { try { OS.store.set(KEY, this.root); this._dirty = false; } catch (e) { /* noop */ } },

    load() {
      const raw = OS.store.get(KEY, null);
      if (raw && raw.t === 'd' && raw.c) { this.root = raw; this.migrate(); return true; }
      this.seed();
      return false;
    },
    migrate() {
      // гарантируем наличие ключевых каталогов после обновлений
      const h = this.home();
      ['Desktop', 'Documents', 'Pictures', 'Music', 'Downloads', 'Projects'].forEach((d) => {
        const p = h + '/' + d;
        if (!this.exists(p)) this._mkdirs(p);
      });
      ['etc', 'var/log', 'tmp', 'bin', 'usr/share'].forEach((d) => { if (!this.exists('/' + d)) this._mkdirs('/' + d); });
    },

    /* ---------- начальное наполнение ---------- */
    seed() {
      this.root = dirNode('/');
      const u = OS.settings.get('user') || 'user';
      const home = '/home/' + u;
      ['Desktop', 'Documents', 'Pictures', 'Music', 'Downloads', 'Projects/qwen-site'].forEach((d) => this._mkdirs(home + '/' + d));
      ['etc', 'var/log', 'tmp', 'bin', 'usr/share', 'proc'].forEach((d) => this._mkdirs('/' + d));

      this.write(home + '/Documents/README.md', [
        '# Добро пожаловать в QwenOS ' + OS.version + ' «' + OS.codename + '»',
        '',
        'Это **виртуальная операционная система**, целиком работающая во вкладке браузера.',
        'Никаких серверов: файловая система, настройки и прогресс игр живут в localStorage.',
        '',
        '## Быстрый старт',
        '- `Терминал` — наберите `help`, чтобы увидеть все команды',
        '- `Файлы` — просмотр и правка виртуальной ФС',
        '- `Настройки` — темы, обои, акцент, масштаб интерфейса',
        '- `Qwen3D` — рейкастинг-демо, стрелки/WASD для движения',
        '- `Синтезатор` — процедурная музыка на WebAudio',
        '',
        '## Горячие клавиши',
        '| Клавиши | Действие |',
        '|---|---|',
        '| `Ctrl+Alt+T` | Открыть терминал |',
        '| `Ctrl+Alt+F` | Открыть файлы |',
        '| `Meta / Ctrl+Esc` | Меню «Пуск» |',
        '| `Alt+Tab` | Переключение окон |',
        '| `Win+Tab` | Обзор всех окон |',
        '| `Esc` | Закрыть меню/обзор |',
        '',
        'Приятной работы!'
      ].join('\n'));

      this.write(home + '/Documents/todo.txt', [
        '[x] Собрать ядро QwenOS',
        '[x] Написать оконный менеджер',
        '[ ] Пройти «Сапёр» на эксперте',
        '[ ] Нарисовать что-нибудь в Paint',
        '[ ] Выучить команды терминала',
        '[ ] Установить все приложения из QwenStore'
      ].join('\n'));

      this.write(home + '/Documents/license.txt', 'QwenOS ' + OS.version + ' — учебный проект.\nСвободно используйте, изменяйте и распространяйте.\nСделано с любовью к веб-платформе.\n');

      this.write(home + '/Projects/qwen-site/index.html', [
        '<!DOCTYPE html>',
        '<html lang="ru">',
        '<head><meta charset="utf-8"><title>Мой сайт</title><link rel="stylesheet" href="style.css"></head>',
        '<body>',
        '  <h1>Привет, QwenOS!</h1>',
        '  <p>Этот файл лежит в виртуальной ФС.</p>',
        '  <script src="app.js"><\/script>',
        '</body>',
        '</html>'
      ].join('\n'));
      this.write(home + '/Projects/qwen-site/style.css', 'body{font-family:system-ui;background:#0b0e1a;color:#e8ecf5;padding:40px}\nh1{background:linear-gradient(90deg,#8b5cf6,#06b6d4);-webkit-background-clip:text;color:transparent}');
      this.write(home + '/Projects/qwen-site/app.js', "console.log('QwenOS app loaded');\nconst greet = (n) => `Привет, ${n}!`;\ngreet('world');\n");

      this.write('/etc/os-release', [
        'NAME="QwenOS"',
        'VERSION="' + OS.version + ' (' + OS.codename + ')"',
        'ID=qwenos',
        'PRETTY_NAME="QwenOS ' + OS.version + ' ' + OS.codename + '"',
        'KERNEL="' + OS.kernel + '"',
        'HOME_URL="https://github.com/yungspiderq/QwenOS"'
      ].join('\n'));
      this.write('/etc/hostname', 'qwenos\n');
      this.write('/etc/motd', 'Система QwenOS ' + OS.version + '. Введите help для списка команд.\n');
      this.write('/etc/passwd', u + ':x:1000:1000:' + u + ':/home/' + u + ':/bin/qsh\nroot:x:0:0:root:/root:/bin/qsh\n');
      this.write('/var/log/system.log', '[' + new Date().toISOString() + '] kernel: cold boot ok\n[' + new Date().toISOString() + '] vfs: mounted /home\n[' + new Date().toISOString() + '] wm: compositor ready\n');
      this.write('/proc/cpuinfo', 'processor : 0\nmodel name : Qwen Virtual CPU @ ' + (navigator.hardwareConcurrency || 4) + ' threads\nvendor : QwenOS\n');
      this.write(home + '/Downloads/.keep', '');
      this.saveNow();
    }
  };

  FS.load();
  OS.fs = FS;
})(window.OS);
