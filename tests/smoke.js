/* Смоук-тест QwenOS в jsdom: загрузка, вход, все приложения, терминал, ФС */
const { JSDOM, VirtualConsole, ResourceLoader } = require('jsdom');
const path = require('path');
const fsp = require('fs');

const BASE = (function () {
  const a = path.resolve(__dirname, '..', 'docs');
  const b = path.resolve(__dirname, '..', 'QwenOS', 'docs');
  return fsp.existsSync(a) ? a : b;
})();
const DOC = path.join(BASE, 'index.html');
const ORIGIN = 'https://qwenos.local';

class LocalLoader extends ResourceLoader {
  fetch(url) {
    try {
      const u = new URL(url);
      if (u.origin !== ORIGIN) return Promise.resolve(Buffer.from(''));
      const fp = path.join(BASE, decodeURIComponent(u.pathname).replace(/^\/+/g, ''));
      return fsp.promises.readFile(fp).then((b) => Buffer.from(b)).catch(() => null);
    } catch (e) { return Promise.resolve(null); }
  }
}
const errors = [];
const notes = [];

function mockCtx(canvas) {
  const grad = { addColorStop() {} };
  return {
    canvas,
    fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: '', lineJoin: '', font: '',
    textAlign: '', textBaseline: '', globalAlpha: 1, shadowColor: '', shadowBlur: 0,
    imageSmoothingEnabled: true,
    clearRect() {}, fillRect() {}, strokeRect() {}, beginPath() {}, closePath() {},
    moveTo() {}, lineTo() {}, stroke() {}, fill() {}, arc() {}, ellipse() {}, rect() {},
    arcTo() {}, roundRect() {}, save() {}, restore() {}, translate() {}, rotate() {},
    scale() {}, setTransform() {}, resetTransform() {}, clip() {},
    createLinearGradient: () => grad, createRadialGradient: () => grad, createPattern: () => null,
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)), width: w | 0, height: h | 0 }),
    putImageData() {}, drawImage() {},
    fillText() {}, strokeText() {}, measureText: () => ({ width: 10 }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray((w | 0) * (h | 0) * 4), width: w | 0, height: h | 0 })
  };
}

(async () => {
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => {
    const msg = String(e.message || e);
    if (/Could not load|not implemented/i.test(msg)) return;
    errors.push('jsdomError: ' + msg);
  });
  vc.on('error', (...a) => errors.push('console.error: ' + a.map(String).join(' ')));

  const dom = await JSDOM.fromFile(DOC, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    url: ORIGIN + '/index.html',
    resources: new LocalLoader(),
    beforeParse(window) {
      window.matchMedia = window.matchMedia || function (q) {
        return { matches: false, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; } };
      };
      window.HTMLCanvasElement.prototype.getContext = function () { return mockCtx(this); };
      window.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,QUFBQQ=='; };
      window.Element.prototype.setPointerCapture = function () {};
      window.Element.prototype.releasePointerCapture = function () {};
      window.URL.createObjectURL = () => 'blob:mock';
      window.URL.revokeObjectURL = () => {};
      window.confirm = () => true;
      window.prompt = () => 'test-value';
      window.localStorage.setItem('qwenos.v3.settings', JSON.stringify({ bootFast: true, tips: false }));
      window.addEventListener('error', (e) => errors.push('window.onerror: ' + (e.message || (e.error && e.error.stack) || e)));
    }
  });
  const { window } = dom;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await sleep(1600);

  const OS = window.QwenOS;
  if (!OS) { console.log('FAIL: window.QwenOS не определён'); process.exit(1); }
  notes.push('ядро загружено: ' + OS.version + ' «' + OS.codename + '»');

  // ---- вход в систему
  window.document.getElementById('lock-btn').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(700);
  if (window.document.getElementById('os').classList.contains('hidden')) errors.push('рабочий стол не показался после входа');
  else notes.push('вход выполнен, рабочий стол виден, иконок на столе: ' + window.document.querySelectorAll('#desktop-icons .dicon').length);
  notes.push('приложений зарегистрировано: ' + OS.Apps.list().length);

  // ---- ФС
  const fs = OS.fs;
  fs.write('/tmp/test.txt', 'привет qwenos');
  if (fs.read('/tmp/test.txt') !== 'привет qwenos') errors.push('fs.write/read сломан');
  fs.mkdir('/tmp/dir1/x', true);
  if (!fs.isDir('/tmp/dir1/x')) errors.push('fs.mkdir -p сломан');
  if (fs.normalize('~/Documents', '/home/user') !== '/home/user/Documents') errors.push('fs.normalize ~ сломан');
  fs.rm('/tmp/dir1', true);
  if (fs.exists('/tmp/dir1')) errors.push('fs.rm -r сломан');
  notes.push('ФС: запись/чтение/каталоги/удаление — ok');

  // ---- калькулятор
  const cases = [['2+2*10', 22], ['(1+2)*3', 9], ['-4+10', 6], ['2^10', 1024], ['10%3', 1], ['sqrt(144)', 12], ['5!', 120], ['1/0', 'err'], ['2+', 'err']];
  cases.forEach(([e, exp]) => {
    let got;
    try { got = OS.calc.eval(e); } catch (err) { got = 'err'; }
    if (exp === 'err') { if (got !== 'err' && isFinite(got)) errors.push('calc ' + e + ' должен был упасть, получил ' + got); }
    else if (got !== exp) errors.push('calc ' + e + ' = ' + got + ', ожидалось ' + exp);
  });
  notes.push('калькулятор: ' + cases.length + ' кейсов пройдено');

  // ---- все приложения (платные предварительно покупаем за тестовые монеты)
  OS.coins.add(100000);
  OS.Apps.list().forEach((a) => OS.Apps.buy(a.id));
  const apps = OS.Apps.list().filter((a) => !a.hidden);
  let opened = 0;
  for (const a of apps) {
    const w = OS.wm.open(a.id);
    await sleep(110);
    if (!w) { errors.push('не открылось приложение: ' + a.id); continue; }
    if (/Сбой запуска приложения/.test(w.body.innerHTML)) errors.push('КРАШ при монтировании: ' + a.id + ' → ' + (w.body.textContent || '').slice(0, 200));
    else if (!w.body.innerHTML.trim()) errors.push('пустое тело окна: ' + a.id);
    else opened++;
    OS.wm.close(w);
    await sleep(30);
  }
  notes.push('приложений открыто без крашей: ' + opened + '/' + apps.length);

  // ---- терминал
  const tw = OS.wm.open('terminal');
  await sleep(200);
  const tin = tw.body.querySelector('.term-in');
  const out = tw.body.querySelector('.term-out');
  async function run(cmd) {
    tin.value = cmd;
    tin.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await sleep(70);
    return out.textContent;
  }
  const tcmds = ['pwd', 'ls /', 'cd /etc', 'cat os-release', 'tree /home', 'neofetch', 'calc 6*7', 'echo hello > /tmp/echo.txt', 'cat /tmp/echo.txt', 'date', 'uptime', 'apps', 'history', 'df', 'free', 'ps', 'cowsay тест', 'uname -a', 'grep kernel /etc/os-release', 'unknowncmd'];
  for (const c of tcmds) await run(c);
  const after = out.textContent;
  if (!/NAME="QwenOS"/.test(after)) errors.push('cat os-release не вывел содержимое');
  if (!/hello/.test(after)) errors.push('перенаправление echo > file не сработало');
  if (!/42/.test(after)) errors.push('calc 6*7 не вернул 42');
  if (!/не найдена: unknowncmd/.test(after)) errors.push('неизвестная команда не обработана');
  notes.push('терминал: ' + tcmds.length + ' команд выполнено');
  OS.wm.close(tw);

  // ---- оконный менеджер
  const w1 = OS.wm.open('notes');
  const w2 = OS.wm.open('calculator');
  await sleep(100);
  OS.wm.toggleMax(w1);
  if (!w1.maximized) errors.push('максимизация не сработала');
  OS.wm.toggleMax(w1);
  if (w1.maximized) errors.push('восстановление из максимизации не сработало');
  OS.wm.minimize(w2);
  if (!w2.minimized) errors.push('сворачивание не сработало');
  OS.wm.restore(w2);
  OS.wm.focus(w1);
  if (OS.wm.active !== w1) errors.push('фокус не переключился');
  if (!OS.wm.cycle(1)) errors.push('Alt+Tab цикл не вернул окно');
  OS.wm.snap(w1, 'left');
  if (!w1.root.style.width) errors.push('снап влево не задал ширину');
  notes.push('оконный менеджер: max/min/restore/focus/cycle/snap — ok');
  OS.wm.close(w1); OS.wm.close(w2);

  // ---- меню Пуск
  window.document.getElementById('start-btn').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(140);
  const sm = window.document.getElementById('start-menu');
  if (sm.classList.contains('hidden')) errors.push('меню Пуск не открылось');
  else notes.push('меню «Пуск»: пунктов в списке — ' + sm.querySelectorAll('[data-app]').length);

  // ---- настройки: смена темы и обоев
  OS.settings.set('theme', 'neon');
  if (window.document.documentElement.getAttribute('data-theme') !== 'neon') errors.push('смена темы не применилась');
  OS.settings.set('wallpaper', 'ocean');
  OS.settings.set('accent', 'pink');
  OS.settings.set('theme', 'aurora');
  notes.push('настройки: темы/обои/акценты применяются');

  await sleep(250);
  console.log('======== СМОУК-ТЕСТ QWENOS ========');
  notes.forEach((n) => console.log('  [ok] ' + n));
  if (errors.length) {
    console.log('\nОШИБКИ (' + errors.length + '):');
    errors.slice(0, 40).forEach((e) => console.log('  [xx] ' + e));
    process.exit(1);
  }
  console.log('\nОШИБОК НЕТ');
  process.exit(0);
})().catch((e) => { console.log('ТЕСТ УПАЛ:', (e && e.stack) || e); process.exit(1); });
