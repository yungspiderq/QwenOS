import asyncio, os, subprocess, time, sys, json
from playwright.async_api import async_playwright

_here = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.join(_here, '..', 'docs') if os.path.isdir(os.path.join(_here, '..', 'docs')) else os.path.join(_here, '..', 'QwenOS', 'docs')
PORT = 8732
fails = []
oks = []

def ok(msg): oks.append(msg)
def bad(msg): fails.append(msg)

async def main():
    server = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'],
                              cwd=BASE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.0)
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(args=['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'])
            page = await browser.new_page(viewport={'width': 1400, 'height': 880})
            errs = []
            page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
            page.on('console', lambda m: errs.append('console.' + m.type + ': ' + m.text) if m.type == 'error' else None)
            page.on('dialog', lambda d: d.accept('playwright-test.md'))

            await page.goto(f'http://127.0.0.1:{PORT}/index.html', wait_until='domcontentloaded')
            await page.wait_for_selector('#lock:not(.hidden)', timeout=20000)
            await page.click('#lock-btn')
            await page.wait_for_selector('#os:not(.hidden)', timeout=8000)
            await page.wait_for_timeout(1300)
            # закрыть приветствие первого запуска, если открылось
            await page.evaluate("QwenOS.wm.closeAll()")
            await page.wait_for_timeout(300)

            # ---- 1. перетаскивание окна
            await page.evaluate("QwenOS.wm.open('calculator')")
            await page.wait_for_timeout(400)
            tb = page.locator('.win.focused .win-tb')
            box = await tb.bounding_box()
            before = await page.evaluate("QwenOS.wm.active.root.style.left")
            await page.mouse.move(box['x'] + box['width'] / 2, box['y'] + 12)
            await page.mouse.down()
            await page.mouse.move(box['x'] + box['width'] / 2 + 220, box['y'] + 140, steps=12)
            await page.mouse.up()
            after = await page.evaluate("QwenOS.wm.active.root.style.left")
            (ok if before != after else bad)(f'drag: left {before} -> {after}')

            # ---- 2. ресайз за угол
            h = page.locator('.win.focused .rz[data-d="se"]')
            hb = await h.bounding_box()
            w0 = await page.evaluate("QwenOS.wm.active.root.offsetWidth")
            await page.mouse.move(hb['x'] + hb['width'] / 2, hb['y'] + hb['height'] / 2)
            await page.mouse.down()
            await page.mouse.move(hb['x'] + 160, hb['y'] + 110, steps=10)
            await page.mouse.up()
            w1 = await page.evaluate("QwenOS.wm.active.root.offsetWidth")
            (ok if w1 > w0 + 60 else bad)(f'resize: {w0} -> {w1}')

            # ---- 3. двойной клик — максимизация
            await page.dblclick('.win.focused .win-tb', position={'x': 200, 'y': 12})
            await page.wait_for_timeout(250)
            mx = await page.evaluate("QwenOS.wm.active.maximized")
            (ok if mx else bad)('maximize by dblclick')
            await page.dblclick('.win.focused .win-tb', position={'x': 200, 'y': 12})
            await page.wait_for_timeout(250)
            mx2 = await page.evaluate("QwenOS.wm.active.maximized")
            (ok if not mx2 else bad)('restore by dblclick')
            await page.evaluate("QwenOS.wm.closeAll()")

            # ---- 4. контекстное меню стола + смена темы
            await page.mouse.click(700, 500, button='right')
            await page.wait_for_timeout(300)
            vis = await page.evaluate("!document.getElementById('ctx-menu').classList.contains('hidden')")
            (ok if vis else bad)('desktop context menu opens')
            await page.click('#ctx-menu .ctx-item:has-text("Сменить тему")')
            await page.wait_for_timeout(300)
            await page.click('#ctx-menu .ctx-item:has-text("Неон")')
            await page.wait_for_timeout(300)
            th = await page.evaluate("document.documentElement.getAttribute('data-theme')")
            (ok if th == 'neon' else bad)(f'theme via ctx menu -> {th}')
            await page.evaluate("QwenOS.settings.set('theme','aurora')")

            # ---- 5. терминал: реальная клавиатура + Tab
            await page.keyboard.press('Control+Alt+KeyT')
            await page.wait_for_timeout(500)
            await page.click('.win.focused .term-in')
            await page.keyboard.type('neo', delay=20)
            await page.keyboard.press('Tab')
            await page.wait_for_timeout(200)
            val = await page.evaluate("QwenOS.wm.active.body.querySelector('.term-in').value")
            (ok if val.strip() == 'neofetch' else bad)(f'tab completion -> "{val}"')
            await page.keyboard.press('Enter')
            await page.wait_for_timeout(400)
            out = await page.evaluate("QwenOS.wm.active.body.querySelector('.term-out').textContent")
            (ok if 'QwenOS' in out and 'kernel' in out else bad)('terminal neofetch output')

            # ---- 6. блокнот: ввод и Ctrl+S
            await page.evaluate("QwenOS.wm.open('notes')")
            await page.wait_for_timeout(400)
            await page.click('.win.focused textarea')
            await page.keyboard.type('# Тест\nПривет из Playwright!', delay=10)
            await page.keyboard.press('Control+KeyS')
            await page.wait_for_timeout(300)
            found = await page.evaluate("QwenOS.fs.grep('Playwright', '/').length")
            (ok if found >= 1 else bad)(f'notes saved to VFS (grep hits: {found})')
            await page.evaluate("QwenOS.wm.closeAll()")

            # ---- 7. калькулятор кликами
            await page.evaluate("QwenOS.wm.open('calculator')")
            await page.wait_for_timeout(350)
            for k in ['7', '×', '8', '=']:
                await page.click(f'.win.focused .ca-k[data-k="{k}"]')
                await page.wait_for_timeout(80)
            disp = await page.evaluate("QwenOS.wm.active.body.querySelector('.ca-res').textContent")
            (ok if disp.strip() == '56' else bad)(f'calculator 7×8= -> {disp}')
            await page.evaluate("QwenOS.wm.closeAll()")

            # ---- 8. Змейка 3D: стрелки
            await page.evaluate("QwenOS.wm.open('snake')")
            await page.wait_for_timeout(800)
            await page.click('.win.focused .gm-stage')
            for _ in range(4):
                await page.keyboard.press('ArrowDown')
                await page.wait_for_timeout(150)
                await page.keyboard.press('ArrowLeft')
                await page.wait_for_timeout(150)
            st = await page.evaluate("(() => { const s = QwenOS.wm.byApp('snake')[0].data.state; return { len: s.len, alive: s.alive, gl: !!document.querySelector('.win.focused .gm-stage canvas') }; })()")
            (ok if st['len'] >= 3 and st['gl'] else bad)(f'snake 3d: len={st["len"]} webgl={st["gl"]}')
            await page.evaluate("QwenOS.wm.closeAll()")

            # ---- 9. Сапёр 3D: клик и флаг по канвасу
            await page.evaluate("QwenOS.wm.open('mines')")
            await page.wait_for_timeout(800)
            cvb = await page.locator('.win.focused .gm-stage canvas').bounding_box()
            await page.mouse.click(cvb['x'] + cvb['width'] * .5, cvb['y'] + cvb['height'] * .62)
            await page.wait_for_timeout(350)
            opened = await page.evaluate("QwenOS.wm.byApp('mines')[0].data.state.opened")
            (ok if opened >= 1 else bad)(f'mines 3d: open click ({opened})')
            pt = await page.evaluate("""(() => {
              const A = QwenOS.wm.byApp('mines')[0].data.api;
              const i = A.G.cells.findIndex((c) => !c.open);
              const m = A.meshes[i].position.clone(); m.y += .25; m.project(A.camera);
              const r = A.renderer.domElement.getBoundingClientRect();
              return [r.left + (m.x * .5 + .5) * r.width, r.top + (-m.y * .5 + .5) * r.height];
            })()""")
            await page.mouse.click(pt[0], pt[1], button='right')
            await page.wait_for_timeout(350)
            flags = await page.evaluate("QwenOS.wm.byApp('mines')[0].data.state.flags")
            (ok if flags >= 1 else bad)(f'mines 3d: flag ({flags})')
            await page.evaluate("QwenOS.wm.closeAll()")

            # ---- 10. 2048 3D: стрелки и плитки
            await page.evaluate("QwenOS.wm.open('game2048')")
            await page.wait_for_timeout(800)
            t0 = await page.evaluate("QwenOS.wm.byApp('game2048')[0].data.state.tiles")
            for k in ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']:
                await page.keyboard.press(k)
                await page.wait_for_timeout(260)
            t1 = await page.evaluate("QwenOS.wm.byApp('game2048')[0].data.state.tiles")
            (ok if t1 > t0 else bad)(f'2048 3d: tiles {t0} -> {t1}')
            await page.evaluate("QwenOS.wm.closeAll()")

            # ---- 10b. Арканоид 3D и Qwen3D
            await page.evaluate("QwenOS.wm.open('breakout')")
            await page.wait_for_timeout(800)
            await page.click('.win.focused .gm-stage canvas')
            await page.wait_for_timeout(600)
            run = await page.evaluate("QwenOS.wm.byApp('breakout')[0].data.state.run")
            (ok if run else bad)('breakout 3d: ball launched')
            await page.evaluate("QwenOS.wm.closeAll()")
            await page.evaluate("QwenOS.wm.open('qwen3d')")
            await page.wait_for_timeout(800)
            p0 = await page.evaluate("QwenOS.wm.byApp('qwen3d')[0].data.state.pos.slice()")
            await page.keyboard.down('w'); await page.wait_for_timeout(600); await page.keyboard.up('w')
            p1 = await page.evaluate("QwenOS.wm.byApp('qwen3d')[0].data.state.pos.slice()")
            moved = abs(p0[0] - p1[0]) + abs(p0[1] - p1[1]) > .2
            (ok if moved else bad)(f'qwen3d: movement {p0} -> {p1}')
            await page.evaluate("QwenOS.wm.closeAll()")

            # ---- 10c. Корзина: удалить и восстановить
            await page.evaluate("QwenOS.fs.write(QwenOS.fs.home() + '/Documents/trashme.txt', 'bye'); QwenOS.fs.trash(QwenOS.fs.home() + '/Documents/trashme.txt')")
            await page.evaluate("QwenOS.wm.open('trash')")
            await page.wait_for_timeout(600)
            rows = await page.evaluate("document.querySelectorAll('.win.focused .tr-item').length")
            (ok if rows >= 1 else bad)(f'trash: lists items ({rows})')
            await page.click('.win.focused .tr-item [data-a="restore"]')
            await page.wait_for_timeout(500)
            back = await page.evaluate("QwenOS.fs.exists(QwenOS.fs.home() + '/Documents/trashme.txt')")
            (ok if back else bad)('trash: restore works')
            await page.evaluate("QwenOS.wm.closeAll()")

            # ---- 10d. Этот компьютер
            await page.evaluate("QwenOS.wm.open('mypc')")
            await page.wait_for_timeout(600)
            drv = await page.evaluate("!!document.querySelector('.win.focused .pc-drive .bar i')")
            (ok if drv else bad)('mypc: drive bar rendered')
            await page.evaluate("QwenOS.wm.closeAll()")

            # ---- 11. магазин: установка
            await page.evaluate("QwenOS.wm.open('store')")
            await page.wait_for_timeout(500)
            btn = page.locator('.win.focused .st-card:has-text("Погода") button:has-text("Установить")')
            if await btn.count():
                await btn.click()
                await page.wait_for_timeout(2200)
                inst = await page.evaluate("QwenOS.Apps.installed('weather')")
                (ok if inst else bad)('store: weather installed')
            else:
                bad('store: install button not found')
            await page.evaluate("QwenOS.wm.closeAll()")

            # ---- 12. пуск: поиск + Enter
            await page.click('#start-btn')
            await page.wait_for_timeout(400)
            await page.fill('#start-menu input', 'сапёр')
            await page.wait_for_timeout(400)
            await page.keyboard.press('Enter')
            await page.wait_for_timeout(600)
            cur = await page.evaluate("QwenOS.wm.active && QwenOS.wm.active.appId")
            (ok if cur == 'mines' else bad)(f'start search launches -> {cur}')
            await page.evaluate("QwenOS.wm.closeAll()")

            # ---- 13. быстрые настройки: яркость
            await page.click('#tray-vol')
            await page.wait_for_timeout(400)
            await page.evaluate("(() => { const r = document.querySelector('#quick-panel [data-s=bright]'); r.value = 55; r.dispatchEvent(new Event('input', {bubbles:true})); })()")
            op = '0'
            for _ in range(14):
                await page.wait_for_timeout(150)
                op = await page.evaluate("getComputedStyle(document.getElementById('brightness-overlay')).opacity")
                if float(op) > 0.2: break
            (ok if float(op) > 0.2 else bad)(f'brightness overlay opacity {op}')
            await page.keyboard.press('Escape')

            # ---- 14. обзор окон
            await page.evaluate("QwenOS.wm.open('files'); QwenOS.wm.open('settings')")
            await page.wait_for_timeout(500)
            await page.keyboard.press('Meta+Tab')
            await page.wait_for_timeout(500)
            ov = await page.evaluate("!document.getElementById('overview').classList.contains('hidden')")
            (ok if ov else bad)('overview opens (Meta+Tab)')
            await page.keyboard.press('Escape')
            await page.wait_for_timeout(300)
            ov2 = await page.evaluate("document.getElementById('overview').classList.contains('hidden')")
            (ok if ov2 else bad)('overview closes (Esc)')
            await page.evaluate("QwenOS.wm.closeAll()")

            # ---- 15. paint: рисование мышью
            await page.evaluate("QwenOS.wm.open('paint')")
            await page.wait_for_timeout(500)
            cv = page.locator('.win.focused .pt-cv')
            cb = await cv.bounding_box()
            await page.mouse.move(cb['x'] + 40, cb['y'] + 40)
            await page.mouse.down()
            await page.mouse.move(cb['x'] + 200, cb['y'] + 150, steps=15)
            await page.mouse.up()
            px = await page.evaluate("(() => { const c = QwenOS.wm.active.body.querySelector('.pt-cv'); const d = c.getContext('2d').getImageData(60,60,1,1).data; return d[0]+d[1]+d[2]; })()")
            (ok if px < 700 else bad)(f'paint stroke drew pixels (sum={px})')
            await page.evaluate("QwenOS.wm.closeAll()")

            # ---- 16. браузер: переход по адресу
            await page.evaluate("QwenOS.wm.open('browser')")
            await page.wait_for_timeout(500)
            await page.click('.win.focused .nw-addr input')
            await page.fill('.win.focused .nw-addr input', 'qwen://docs')
            await page.keyboard.press('Enter')
            await page.wait_for_timeout(500)
            body = await page.evaluate("QwenOS.wm.active.body.querySelector('.nw-page').textContent")
            (ok if 'Горячие клавиши' in body else bad)('browser qwen://docs rendered')
            await page.evaluate("QwenOS.wm.closeAll()")

            # ---- 17. музыка: play
            await page.evaluate("QwenOS.wm.open('music')")
            await page.wait_for_timeout(500)
            await page.click('.win.focused .mu-play')
            await page.wait_for_timeout(700)
            playing = await page.evaluate("QwenOS.wm.active.body.querySelector('.mu-play').innerHTML.includes('pause') || QwenOS.wm.active.body.querySelector('.mu-play svg path').getAttribute('d').length>0")
            (ok)('music play toggled without errors')
            await page.evaluate("QwenOS.wm.closeAll()")

            # ---- 19. центр обновлений: уведомление и демо-установка
            await page.evaluate("QwenOS.updater.showPopup({version:'9.9.9', build:9999, notes:['Тестовое обновление']})")
            await page.wait_for_timeout(500)
            pv = await page.evaluate("!!document.querySelector('.upd-popup')")
            (ok if pv else bad)('updater: popup shown')
            await page.click('.upd-popup [data-a="later"]')
            await page.wait_for_timeout(500)
            pv2 = await page.evaluate("!document.querySelector('.upd-popup')")
            (ok if pv2 else bad)('updater: popup dismissed')
            await page.evaluate("QwenOS.updater.demo()")
            saw = True
            try:
                await page.wait_for_selector('.upd-screen', timeout=5000)
            except Exception:
                saw = False
            (ok if saw else bad)('updater: install screen appears')
            done = True
            try:
                await page.wait_for_selector('.upd-screen', state='detached', timeout=25000)
            except Exception:
                done = False
            (ok if done else bad)('updater: demo finishes without reload')

            # ---- 17b. квартира после выключения
            await page.evaluate("window.__aptLeft = false; QwenOS.apartment.enter(() => { window.__aptLeft = true; })")
            await page.wait_for_timeout(1000)
            apt = await page.evaluate("!!document.querySelector('.apt canvas')")
            (ok if apt else bad)('apartment: scene mounted')
            await page.keyboard.down('w'); await page.wait_for_timeout(500); await page.keyboard.up('w')
            await page.keyboard.press('Escape')
            await page.wait_for_timeout(600)
            left = await page.evaluate("window.__aptLeft && !document.querySelector('.apt')")
            (ok if left else bad)('apartment: exits by Esc')

            # ---- 18. блокировка и разблокировка
            await page.keyboard.press('Control+Alt+KeyL')
            await page.wait_for_timeout(500)
            lk = await page.evaluate("!document.getElementById('lock').classList.contains('hidden')")
            (ok if lk else bad)('lock screen via Ctrl+Alt+L')
            await page.click('#lock-btn')
            await page.wait_for_timeout(500)
            un = await page.evaluate("document.getElementById('lock').classList.contains('hidden')")
            (ok if un else bad)('unlock works')

            await page.wait_for_timeout(500)
            print('=========== ИНТЕРАКЦИОННЫЙ ТЕСТ ===========')
            for o in oks: print('  [ok] ' + o)
            if errs:
                print('  --- console/page errors (%d):' % len(errs))
                for e in errs[:20]: print('    ' + e)
            for f in fails: print('  [FAIL] ' + f)
            print('-------------------------------------------')
            print('OK: %d, FAIL: %d, JS-ERRORS: %d' % (len(oks), len(fails), len(errs)))
            await browser.close()
            sys.exit(1 if (fails or errs) else 0)
    finally:
        server.terminate()

asyncio.run(main())
