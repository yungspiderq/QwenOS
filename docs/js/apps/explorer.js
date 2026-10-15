/* ==========================================================================
   QwenOS 3.0 — apps/explorer.js
   «Корзина» и «Этот компьютер» — как в Windows
   ========================================================================== */
(function (OS) {
  'use strict';
  const fs = OS.fs;

  const extIcon = (it) => {
    if (it.type === 'dir') return { n: 'folder', c: 'linear-gradient(135deg,#fbbf24,#d97706)' };
    const e = it.ext;
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(e)) return { n: 'image', c: 'linear-gradient(135deg,#ec4899,#8b5cf6)' };
    if (e === 'md') return { n: 'book', c: 'linear-gradient(135deg,#3b82f6,#1d4ed8)' };
    if (['js', 'ts', 'json'].includes(e)) return { n: 'code', c: 'linear-gradient(135deg,#facc15,#ca8a04)' };
    if (['css'].includes(e)) return { n: 'palette', c: 'linear-gradient(135deg,#22d3ee,#0891b2)' };
    if (['html'].includes(e)) return { n: 'globe', c: 'linear-gradient(135deg,#f97316,#c2410c)' };
    if (['mp3', 'wav', 'ogg'].includes(e)) return { n: 'music', c: 'linear-gradient(135deg,#a855f7,#6d28d9)' };
    return { n: 'file', c: 'linear-gradient(135deg,#94a3b8,#64748b)' };
  };

  /* =======================================================================
     КОРЗИНА
     ======================================================================= */
  OS.Apps.register({
    id: 'trash',
    name: 'Корзина',
    icon: 'trash',
    color: '#64748b', color2: '#334155',
    category: 'Система',
    keywords: 'корзина recycle bin удалённые файлы восстановить',
    width: 680, height: 540, minWidth: 380, minHeight: 320,
    mount(win, api) {
      win.body.innerHTML =
        '<div class="tr">' +
          '<div class="tr-bar"><div class="grow"><b>Корзина</b><span class="tr-sum"></span></div>' +
          '<button class="btn btn-sm" data-a="refresh">Обновить</button>' +
          '<button class="btn btn-sm btn-danger" data-a="empty">Очистить корзину</button></div>' +
          '<div class="tr-list"></div>' +
        '</div>';
      const list = win.body.querySelector('.tr-list');
      const sum = win.body.querySelector('.tr-sum');

      function render() {
        const items = fs.trashList();
        const total = items.reduce((s, i) => s + i.size, 0);
        sum.textContent = items.length
          ? items.length + ' объект(ов) · ' + OS.fmtBytes(total) + ' · файлы можно восстановить'
          : 'пусто · удалённые из проводника и с рабочего стола файлы попадают сюда';
        list.innerHTML = '';
        if (!items.length) {
          list.innerHTML = '<div class="tr-empty">' + OS.svg('trash', 46) + '<p><b>Корзина пуста</b></p><p class="dim">Удаляйте файлы через проводник или рабочий стол —<br>они появятся здесь, и их можно будет восстановить.</p></div>';
          win.setTitle('Корзина — пусто');
          return;
        }
        win.setTitle('Корзина — ' + items.length);
        items.forEach((it) => {
          const ic = extIcon(it);
          const row = OS.el('div', { class: 'tr-item' });
          row.innerHTML =
            '<div class="ic" style="background:' + ic.c + '">' + OS.svg(ic.n, 17) + '</div>' +
            '<div class="tx"><b>' + OS.esc(it.name) + '</b><span>был в: ' + OS.esc(it.orig) + ' · удалён ' + OS.fmtDateTime(it.at) + ' · ' + OS.fmtBytes(it.size) + '</span></div>' +
            '<button class="btn btn-sm" data-a="open" title="Открыть">Открыть</button>' +
            '<button class="btn btn-sm btn-accent" data-a="restore">Восстановить</button>' +
            '<button class="btn btn-sm btn-danger" data-a="kill">Удалить</button>';
          row.querySelector('[data-a="restore"]').onclick = () => {
            const r = fs.untrash(it.name);
            if (r.ok) { OS.toast('Восстановлено', r.path, { icon: 'refresh' }); OS.bus.emit('fs:changed'); render(); }
            else OS.toast('Ошибка', r.error, { icon: 'x' });
          };
          row.querySelector('[data-a="kill"]').onclick = () => {
            if (!confirm('Удалить «' + it.name + '» безвозвратно?')) return;
            fs.rm(fs.join(fs.trashDir(), it.name), true);
            fs._saveTrashMeta(fs._trashMeta().filter((m) => m.name !== it.name));
            OS.bus.emit('fs:changed'); render();
          };
          row.querySelector('[data-a="open"]').onclick = () => {
            const p = fs.join(fs.trashDir(), it.name);
            if (it.type === 'dir') api.open('files', { path: p });
            else OS.wm.openPath(p);
          };
          list.append(row);
        });
      }
      win.body.querySelector('[data-a="refresh"]').onclick = render;
      win.body.querySelector('[data-a="empty"]').onclick = () => {
        const n = fs.trashList().length;
        if (!n) return OS.toast('Корзина пуста', 'Очищать нечего', { icon: 'info', timeout: 2000 });
        if (!confirm('Очистить корзину? ' + n + ' объект(ов) будет удалено безвозвратно.')) return;
        fs.emptyTrash();
        OS.toast('Корзина очищена', '', { icon: 'trash' });
        OS.bus.emit('fs:changed'); render();
      };
      const u = OS.bus.on('fs:changed', () => { if (win.root.isConnected) render(); });
      render();
      return () => u();
    }
  });

  /* =======================================================================
     ЭТОТ КОМПЬЮТЕР
     ======================================================================= */
  OS.Apps.register({
    id: 'mypc',
    name: 'Этот компьютер',
    icon: 'monitor',
    color: '#0ea5e9', color2: '#1e40af',
    category: 'Система',
    keywords: 'этот компьютер мой компьютер диски проводник my computer this pc',
    width: 780, height: 580, minWidth: 400, minHeight: 360,
    mount(win, api) {
      const user = OS.settings.get('user');
      win.body.innerHTML = '<div class="pc"></div>';
      const root = win.body.querySelector('.pc');

      function render() {
        const TOTAL = 5 * 1024 * 1024;
        const used = fs.du('/');
        const pct = Math.min(100, used / TOTAL * 100);
        const mem = OS.memInfo();
        const cc = fs.count('/');
        const FOLDERS = [
          { name: 'Рабочий стол', path: fs.home() + '/Desktop', icon: 'monitor', c: 'linear-gradient(135deg,#60a5fa,#1d4ed8)' },
          { name: 'Документы', path: fs.home() + '/Documents', icon: 'note', c: 'linear-gradient(135deg,#fbbf24,#b45309)' },
          { name: 'Загрузки', path: fs.home() + '/Downloads', icon: 'download', c: 'linear-gradient(135deg,#34d399,#065f46)' },
          { name: 'Изображения', path: fs.home() + '/Pictures', icon: 'image', c: 'linear-gradient(135deg,#ec4899,#86198f)' },
          { name: 'Музыка', path: fs.home() + '/Music', icon: 'music', c: 'linear-gradient(135deg,#a855f7,#581c87)' },
          { name: 'Проекты', path: fs.home() + '/Projects', icon: 'code', c: 'linear-gradient(135deg,#f97316,#7c2d12)' }
        ];
        root.innerHTML =
          '<div class="pc-hero"><div class="ic">' + OS.svg('monitor', 28) + '</div>' +
            '<div><b>' + OS.esc(user) + '@qwenos — этот компьютер</b>' +
            '<span>QwenOS ' + OS.version + ' «' + OS.codename + '» · ' + OS.kernel + '</span></div>' +
            '<div style="margin-left:auto" class="row">' +
              '<button class="btn btn-sm" data-a="files">Проводник</button>' +
              '<button class="btn btn-sm" data-a="mon">Диспетчер</button>' +
              '<button class="btn btn-sm" data-a="set">Параметры</button>' +
            '</div></div>' +
          '<div class="pc-h">Устройства и диски</div>' +
          '<div class="pc-drive" data-go="/">' +
            '<div class="ic">' + OS.svg('disk', 20) + '</div>' +
            '<div class="tx"><b>Локальный диск (C:) — виртуальная ФС</b>' +
            '<div class="bar"><i class="' + (pct > 82 ? 'warn' : '') + '" style="width:' + pct.toFixed(1) + '%"></i></div>' +
            '<span>Свободно ' + OS.fmtBytes(TOTAL - used) + ' из ' + OS.fmtBytes(TOTAL) + ' · занято ' + pct.toFixed(1) + '%</span></div>' +
            '<div class="chip">qwen-vfs</div>' +
          '</div>' +
          '<div class="pc-h">Папки этого компьютера</div>' +
          '<div class="pc-folders">' + FOLDERS.map((f) =>
            '<button class="pc-f" data-go="' + f.path + '"><i class="ic" style="background:' + f.c + '">' + OS.svg(f.icon, 19) + '</i><b>' + f.name + '</b><span>' + fs.list(f.path, true).length + ' эл.</span></button>').join('') +
            '<button class="pc-f" data-app="trash"><i class="ic" style="background:linear-gradient(135deg,#64748b,#334155)">' + OS.svg('trash', 19) + '</i><b>Корзина</b><span>' + fs.trashList().length + ' эл.</span></button>' +
          '</div>' +
          '<div class="pc-h">Система</div>' +
          '<div class="pc-sys">' +
            '<div>Процессор<b>Virtual CPU × ' + (navigator.hardwareConcurrency || 4) + '</b></div>' +
            '<div>Память (куча JS)<b>' + OS.fmtBytes(mem.used) + ' / ' + OS.fmtBytes(mem.limit) + '</b></div>' +
            '<div>Файлов в системе<b>' + cc.files + ' файлов · ' + cc.dirs + ' каталогов</b></div>' +
            '<div>Время работы<b>' + OS.fmtDur(OS.uptime()) + '</b></div>' +
            '<div>Открытых окон<b>' + OS.wm.windows.length + '</b></div>' +
            '<div>Частота кадров<b>' + OS.perf.fps + ' fps</b></div>' +
          '</div>';
        win.setTitle('Этот компьютер');
      }
      root.addEventListener('click', (e) => {
        const go = e.target.closest('[data-go]');
        if (go) return api.open('files', { path: go.dataset.go });
        const app = e.target.closest('[data-app]');
        if (app) return api.open(app.dataset.app);
        const a = e.target.closest('[data-a]');
        if (!a) return;
        if (a.dataset.a === 'files') api.open('files', { path: fs.home() });
        else if (a.dataset.a === 'mon') api.open('monitor');
        else if (a.dataset.a === 'set') api.open('settings', { section: 'system' });
      });
      const u1 = OS.bus.on('fs:changed', () => { if (win.root.isConnected) render(); });
      const u2 = OS.bus.on('wm:change', OS.debounce(() => { if (win.root.isConnected) render(); }, 600));
      render();
      return () => { u1(); u2(); };
    }
  });
})(window.OS);
