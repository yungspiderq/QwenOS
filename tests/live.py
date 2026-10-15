import asyncio, os
from playwright.async_api import async_playwright
URL = os.environ.get('QWENOS_URL', 'https://yungspiderq.github.io/QwenOS/')
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1360,'height':850})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console.error: '+m.text) if m.type=='error' else None)
        await pg.goto(URL, wait_until='domcontentloaded')
        await pg.wait_for_selector('#lock:not(.hidden)', timeout=30000)
        await pg.click('#lock-btn')
        await pg.wait_for_selector('#os:not(.hidden)', timeout=10000)
        await pg.wait_for_timeout(1200)
        await pg.evaluate("QwenOS.wm.closeAll()")
        await pg.evaluate("QwenOS.wm.open('terminal'); QwenOS.wm.open('qwen3d')")
        await pg.wait_for_timeout(1500)
        sw = await pg.evaluate("navigator.serviceWorker ? (navigator.serviceWorker.controller ? 'active' : 'registered') : 'none'")
        icons = await pg.evaluate("document.querySelectorAll('#desktop-icons .dicon').length")
        wins = await pg.evaluate("QwenOS.wm.windows.length")
        await pg.screenshot(path='shots/11-live-pages.png')
        print('LIVE OK | sw:', sw, '| icons:', icons, '| windows:', wins, '| js errors:', len(errs))
        for e in errs[:10]: print('  ', e)
        await b.close()
asyncio.run(main())
