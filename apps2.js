/* ============ QwenOS 2.0 — новые приложения ============ */

/* ---------- Музыкальный плеер (WebAudio синт-волна) ---------- */
registerApp('music', {
  name: 'Музыка', icon: '🎵', width: 460, height: 340, resizable: false,
  open(win) {
    const TRACKS = [
      { name: 'Neon Drive',   bpm: 112, wave: 'sawtooth', notes: [220, 261.6, 329.6, 261.6, 220, 196, 220, 329.6], bass: 55 },
      { name: 'Aurora Sleep', bpm: 72,  wave: 'sine',     notes: [329.6, 392, 440, 392, 329.6, 293.7, 329.6, 246.9], bass: 82.4 },
      { name: 'Bit Runner',   bpm: 140, wave: 'square',   notes: [440, 523.3, 659.3, 523.3, 440, 349.2, 440, 523.3], bass: 110 },
      { name: 'Deep Focus',   bpm: 90,  wave: 'triangle', notes: [196, 246.9, 293.7, 246.9, 174.6, 220, 246.9, 196], bass: 65.4 },
    ];
    let cur = 0, playing = false, seqTimer = null, stepIdx = 0, ac = null, master = null, analyser = null, raf = null;
    win.body.innerHTML = `
      <div class="music">
        <canvas class="mu-viz"></canvas>
        <div class="mu-now"><span class="mu-title">—</span><span class="mu-sub">выберите трек</span></div>
        <div class="mu-controls">
          <button class="mu-prev" title="Предыдущий">⏮</button>
          <button class="mu-play" title="Играть/пауза">▶</button>
          <button class="mu-next" title="Следующий">⏭</button>
          <input type="range" class="mu-vol" min="0" max="100" value="60" title="Громкость">
        </div>
        <div class="mu-list"></div>
      </div>`;
    const viz = win.body.querySelector('.mu-viz');
    const vctx = viz.getContext('2d');
    function fitViz(){ const r=viz.getBoundingClientRect(); viz.width=r.width*(window.devicePixelRatio||1); viz.height=r.height*(window.devicePixelRatio||1); }
    if (window.ResizeObserver) new ResizeObserver(fitViz).observe(viz);
    fitViz();
    const listEl = win.body.querySelector('.mu-list');
    TRACKS.forEach((t,i)=>{
      const d=document.createElement('div');
      d.className='mu-item'+(i===0?' active':'');
      d.innerHTML=`♪ ${t.name} <small>${t.bpm} BPM</small>`;
      d.onclick=()=>{ cur=i; if(playing){stopSeq();startSeq();}else renderList(); };
      listEl.appendChild(d);
    });
    function renderList(){
      [...listEl.children].forEach((c,i)=>c.classList.toggle('active', i===cur));
      win.body.querySelector('.mu-title').textContent = TRACKS[cur].name;
      win.body.querySelector('.mu-sub').textContent = playing ? '▶ играет · синт-волна' : '⏸ пауза';
    }
    function ensureAudio(){
      if (ac) return;
      ac = new (window.AudioContext||window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = win.body.querySelector('.mu-vol').value/100 * 0.5;
      analyser = ac.createAnalyser(); analyser.fftSize = 64;
      master.connect(analyser); analyser.connect(ac.destination);
      drawViz();
    }
    function tone(freq, dur, type, vol){
      const o=ac.createOscillator(), g=ac.createGain();
      o.type=type; o.frequency.value=freq;
      g.gain.setValueAtTime(vol, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime+dur);
      o.connect(g); g.connect(master); o.start(); o.stop(ac.currentTime+dur);
    }
    function startSeq(){
      ensureAudio(); if (ac.state==='suspended') ac.resume();
      playing=true; win.body.querySelector('.mu-play').textContent='⏸';
      const t=TRACKS[cur]; const beat=60/t.bpm/2;
      stepIdx=0;
      seqTimer=setInterval(()=>{
        tone(t.notes[stepIdx%t.notes.length], beat*0.9, t.wave, 0.25);
        if (stepIdx%4===0) tone(t.bass, beat*2, 'sine', 0.5);
        stepIdx++;
      }, beat*1000);
      renderList();
    }
    function stopSeq(){
      playing=false; clearInterval(seqTimer); seqTimer=null;
      const b=win.body.querySelector('.mu-play'); if(b)b.textContent='▶';
      renderList();
    }
    win.body.querySelector('.mu-play').onclick=()=>{ playing?stopSeq():startSeq(); };
    win.body.querySelector('.mu-prev').onclick=()=>{ cur=(cur+TRACKS.length-1)%TRACKS.length; if(playing){stopSeq();startSeq();}else renderList(); };
    win.body.querySelector('.mu-next').onclick=()=>{ cur=(cur+1)%TRACKS.length; if(playing){stopSeq();startSeq();}else renderList(); };
    win.body.querySelector('.mu-vol').oninput=e=>{ if(master) master.gain.value=e.target.value/100*0.5; };
    function drawViz(){
      raf=requestAnimationFrame(drawViz);
      const w=viz.width,h=viz.height;
      vctx.clearRect(0,0,w,h);
      const grad=vctx.createLinearGradient(0,0,w,0); grad.addColorStop(0,'#4da3ff'); grad.addColorStop(1,'#f093fb');
      vctx.fillStyle=grad;
      if (analyser){
        const data=new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const bw=w/data.length;
        for(let i=0;i<data.length;i++){ const bh=(data[i]/255)*h*0.9; vctx.fillRect(i*bw, h-bh, bw-1, bh); }
      } else { vctx.globalAlpha=.25; for(let i=0;i<32;i++) vctx.fillRect(i*(w/32), h*0.5, w/32-1, 2); vctx.globalAlpha=1; }
    }
    renderList();
    win.onClose=()=>{ stopSeq(); cancelAnimationFrame(raf); if(ac&&ac.close)ac.close(); };
  }
});

/* ---------- Заметки (стикеры) ---------- */
registerApp('notes', {
  name: 'Заметки', icon: '🗒️', width: 640, height: 440,
  open(win) {
    const KEY='qwenos_notes';
    let notes=[]; try{ notes=JSON.parse(localStorage.getItem(KEY))||[]; }catch(e){ notes=[]; }
    const COLORS=['#fff9c4','#ffe0b2','#f8bbd0','#c8e6c9','#bbdefb','#e1bee7'];
    win.body.innerHTML=`
      <div class="notes">
        <div class="nt-toolbar"><button class="nt-add">➕ Новая заметка</button><span class="nt-count"></span></div>
        <div class="nt-grid"></div>
      </div>`;
    const grid=win.body.querySelector('.nt-grid');
    const save=()=>localStorage.setItem(KEY, JSON.stringify(notes));
    function plural(n,f){ const m=n%100,k=n%10; return f[m>10&&m<20?2:k===1?0:k>1&&k<5?1:2]; }
    function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
    function render(){
      grid.innerHTML='';
      win.body.querySelector('.nt-count').textContent=notes.length+' '+plural(notes.length,['заметка','заметки','заметок']);
      notes.forEach((n,i)=>{
        const c=document.createElement('div');
        c.className='nt-card'; c.style.background=n.color;
        c.innerHTML=`<textarea>${esc(n.text)}</textarea>
          <div class="nt-foot"><span>${n.date}</span><button class="nt-del" title="Удалить">🗑</button></div>`;
        const ta=c.querySelector('textarea');
        ta.oninput=()=>{ n.text=ta.value; save(); };
        c.querySelector('.nt-del').onclick=()=>{ notes.splice(i,1); save(); render(); };
        grid.appendChild(c);
      });
    }
    win.body.querySelector('.nt-add').onclick=()=>{
      notes.unshift({ text:'', color:COLORS[Math.floor(Math.random()*COLORS.length)], date:new Date().toLocaleDateString('ru-RU') });
      save(); render();
      const first=grid.querySelector('textarea'); if(first)first.focus();
    };
    render();
  }
});

/* ---------- Погода (Open-Meteo, без ключей) ---------- */
registerApp('weather', {
  name: 'Погода', icon: '⛅', width: 480, height: 400,
  open(win) {
    const ICONS={0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌧️',55:'🌧️',61:'🌧️',63:'🌧️',65:'🌧️',71:'❄️',73:'❄️',75:'❄️',80:'🌦️',81:'🌧️',82:'⛈️',95:'⛈️'};
    win.body.innerHTML=`
      <div class="weather">
        <div class="wt-head">
          <input class="wt-city" placeholder="Город..." value="Moscow">
          <button class="wt-go">Найти</button>
        </div>
        <div class="wt-body"><div class="wt-loading">Загрузка...</div></div>
      </div>`;
    const body=win.body.querySelector('.wt-body');
    const cityIn=win.body.querySelector('.wt-city');
    async function geocode(q){
      const r=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=ru`);
      const d=await r.json(); return d.results&&d.results[0];
    }
    async function forecast(lat,lon){
      const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`);
      return r.json();
    }
    function daysHtml(f){
      return `<div class="wt-days">${f.daily.time.map((d,i)=>`<div class="wt-day"><div>${new Date(d).toLocaleDateString('ru-RU',{weekday:'short'})}</div><div>${ICONS[f.daily.weather_code[i]]||'·'}</div><div><b>${Math.round(f.daily.temperature_2m_max[i])}°</b> ${Math.round(f.daily.temperature_2m_min[i])}°</div></div>`).join('')}</div>`;
    }
    function mainHtml(name,c){
      return `<div class="wt-main"><div class="wt-icon">${ICONS[c.weather_code]||'🌡️'}</div><div class="wt-temp">${Math.round(c.temperature_2m)}°C</div><div class="wt-meta"><b>${name}</b><br>💨 ${Math.round(c.wind_speed_10m)} км/ч</div></div>`;
    }
    async function go(q){
      body.innerHTML='<div class="wt-loading">Загрузка... 📡</div>';
      try{
        const place=await geocode(q||cityIn.value.trim()||'Moscow');
        if(!place) throw new Error('город не найден');
        const f=await forecast(place.latitude, place.longitude);
        body.innerHTML=mainHtml(place.name,f.current)+daysHtml(f);
      }catch(e){ body.innerHTML=`<div class="wt-error">⚠️ Ошибка: ${e.message}<br><small>Проверьте подключение к интернету</small></div>`; }
    }
    win.body.querySelector('.wt-go').onclick=()=>go();
    cityIn.onkeydown=e=>{ if(e.key==='Enter') go(); };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async pos=>{
        try{ const f=await forecast(pos.coords.latitude,pos.coords.longitude);
          body.innerHTML=mainHtml('Ваше местоположение',f.current)+daysHtml(f);
        }catch(e){ go('Moscow'); }
      }, ()=>go('Moscow'), {timeout:4000});
    } else go('Moscow');
  }
});

/* ---------- Таймер / Секундомер ---------- */
registerApp('timer', {
  name: 'Таймер', icon: '⏲️', width: 360, height: 340, resizable:false,
  open(win) {
    win.body.innerHTML=`
      <div class="timers">
        <div class="tm-tabs"><button class="active" data-t="sec">⏱ Секундомер</button><button data-t="cnt">⏲ Обратный</button></div>
        <div class="tm-display">00:00.0</div>
        <div class="tm-setup hidden">
          <input type="number" class="tm-min" min="0" max="180" value="5" style="width:70px"> мин
          <input type="number" class="tm-sec" min="0" max="59" value="0" style="width:70px"> сек
        </div>
        <div class="tm-btns">
          <button class="tm-start">▶ Старт</button>
          <button class="tm-reset">⟲ Сброс</button>
        </div>
      </div>`;
    const disp=win.body.querySelector('.tm-display');
    let mode='sec', running=false, iv=null, t0=0, elapsed=0, target=0;
    const fmt=ms=>{ const s=ms/1000; return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}.${String(Math.floor(ms/100)%10)}`; };
    function beepWin(){ try{ const a=new AudioContext(); const o=a.createOscillator(),g=a.createGain(); o.frequency.value=880; g.gain.setValueAtTime(.2,a.currentTime); g.gain.exponentialRampToValueAtTime(.001,a.currentTime+.8); o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime+.8);}catch(e){} }
    function tick(){
      if(mode==='sec'){ disp.textContent=fmt(elapsed+(performance.now()-t0)); }
      else { const rem=target-(performance.now()-t0); disp.textContent=fmt(Math.max(0,rem));
        if(rem<=0){ stop(); disp.textContent='00:00.0'; OS.notify('⏲ Таймер','Время вышло! 🔔',8000); beepWin(); } }
    }
    function start(){
      if(running)return stop();
      if(mode==='cnt'){ target=(+win.body.querySelector('.tm-min').value*60 + +win.body.querySelector('.tm-sec').value)*1000; if(target<=0)return; }
      t0=performance.now(); running=true; iv=setInterval(tick,100);
      win.body.querySelector('.tm-start').textContent='⏸ Пауза';
    }
    function stop(){ running=false; clearInterval(iv);
      if(mode==='sec') elapsed+=performance.now()-t0;
      win.body.querySelector('.tm-start').textContent='▶ Старт'; }
    win.body.querySelector('.tm-start').onclick=start;
    win.body.querySelector('.tm-reset').onclick=()=>{ stop(); elapsed=0; disp.textContent='00:00.0'; };
    win.body.querySelectorAll('.tm-tabs button').forEach(b=>b.onclick=()=>{
      stop(); mode=b.dataset.t; elapsed=0; disp.textContent='00:00.0';
      win.body.querySelectorAll('.tm-tabs button').forEach(x=>x.classList.toggle('active',x===b));
      win.body.querySelector('.tm-setup').classList.toggle('hidden', mode!=='cnt');
    });
    win.onClose=()=>clearInterval(iv);
  }
});

/* ---------- Змейка ---------- */
registerApp('snake', {
  name: 'Змейка', icon: '🐍', width: 420, height: 470, resizable:false,
  open(win) {
    win.body.innerHTML=`
      <div class="snake">
        <div class="sn-score">🍎 Счёт: <b class="sn-s">0</b> · Рекорд: <b class="sn-r">0</b></div>
        <canvas class="sn-canvas"></canvas>
        <div class="sn-help">Стрелки / WASD · пробел — пауза/рестарт</div>
      </div>`;
    const cv=win.body.querySelector('.sn-canvas'), ctx=cv.getContext('2d');
    const N=20, CELL=18; cv.width=N*CELL; cv.height=N*CELL;
    let snake=[{x:9,y:9}], dir={x:1,y:0}, nextDir={x:1,y:0}, food={x:5,y:5}, score=0, dead=false, paused=false, loop=null;
    let best=+localStorage.getItem('qwenos_snake_best')||0;
    win.body.querySelector('.sn-r').textContent=best;
    function placeFood(){ do{ food={x:Math.floor(Math.random()*N),y:Math.floor(Math.random()*N)}; }while(snake.some(s=>s.x===food.x&&s.y===food.y)); }
    function step(){
      if(dead||paused)return;
      dir=nextDir;
      const h={x:(snake[0].x+dir.x+N)%N, y:(snake[0].y+dir.y+N)%N};
      if(snake.some(s=>s.x===h.x&&s.y===h.y)){ dead=true; clearInterval(loop);
        if(score>best){best=score;localStorage.setItem('qwenos_snake_best',best);}
        win.body.querySelector('.sn-r').textContent=best;
        OS.notify('🐍 Змейка', `Игра окончена! Счёт: ${score}. Пробел — заново.`); draw(); return; }
      snake.unshift(h);
      if(h.x===food.x&&h.y===food.y){ score++; win.body.querySelector('.sn-s').textContent=score; placeFood(); }
      else snake.pop();
      draw();
    }
    function draw(){
      ctx.fillStyle='#0d1117'; ctx.fillRect(0,0,cv.width,cv.height);
      ctx.fillStyle='#e8564d'; ctx.beginPath(); ctx.arc(food.x*CELL+CELL/2, food.y*CELL+CELL/2, CELL/2-2, 0, 7); ctx.fill();
      snake.forEach((s,i)=>{ ctx.fillStyle=i?`hsl(${140-i*2},70%,${Math.max(30,55-i)}%)`:'#7ee787'; ctx.fillRect(s.x*CELL+1,s.y*CELL+1,CELL-2,CELL-2); });
      if(paused){ ctx.fillStyle='rgba(255,255,255,.7)'; ctx.font='16px sans-serif'; ctx.fillText('ПАУЗА',cv.width/2-28,cv.height/2); }
      if(dead){ ctx.fillStyle='rgba(232,86,77,.9)'; ctx.font='bold 22px sans-serif'; ctx.fillText('💀 GAME OVER',cv.width/2-80,cv.height/2); }
    }
    function reset(){ snake=[{x:9,y:9}]; dir=nextDir={x:1,y:0}; score=0; dead=false; paused=false; win.body.querySelector('.sn-s').textContent=0; placeFood(); clearInterval(loop); loop=setInterval(step,110); draw(); }
    win.el.tabIndex=0;
    win.el.addEventListener('keydown', e=>{
      const map={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]};
      const k=e.key.length===1?e.key.toLowerCase():e.key;
      if(map[k]){ const [x,y]=map[k]; if(dir.x===-x&&dir.y===-y)return; nextDir={x,y}; e.preventDefault(); }
      if(k===' '){ e.preventDefault(); if(dead)reset(); else {paused=!paused;draw();} }
    });
    reset();
    win.onClose=()=>clearInterval(loop);
  }
});

/* ---------- Крестики-нолики vs AI (минмакс) ---------- */
registerApp('tictactoe', {
  name: 'Крестики', icon: '⭕', width: 340, height: 420, resizable:false,
  open(win) {
    win.body.innerHTML=`
      <div class="ttt">
        <div class="ttt-status">Ваш ход (X)</div>
        <div class="ttt-grid"></div>
        <div class="ttt-score">Вы: <b class="ts-x">0</b> · Ничьи: <b class="ts-d">0</b> · ИИ: <b class="ts-o">0</b></div>
        <button class="ttt-new">🔄 Новая игра</button>
      </div>`;
    const grid=win.body.querySelector('.ttt-grid'), status=win.body.querySelector('.ttt-status');
    let board=Array(9).fill(''), over=false, sc={x:0,d:0,o:0};
    const LINES=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    function winner(b){ for(const[a,c,d]of LINES) if(b[a]&&b[a]===b[c]&&b[a]===b[d])return b[a]; return b.includes('')?null:'d'; }
    function minimax(b, me){
      const w=winner(b); if(w==='o')return[10,-1]; if(w==='x')return[-10,-1]; if(w==='d')return[0,-1];
      let bestScore=me==='o'?-Infinity:Infinity, bestI=-1;
      for(let i=0;i<9;i++) if(!b[i]){ b[i]=me; const s=minimax(b, me==='o'?'x':'o')[0]; b[i]='';
        if(me==='o'?s>bestScore:s<bestScore){bestScore=s;bestI=i;} }
      return [bestScore,bestI];
    }
    function render(){ grid.innerHTML=''; board.forEach((v,i)=>{ const d=document.createElement('div'); d.className='ttt-cell'+(v?' filled':''); d.textContent=v; d.onclick=()=>play(i); grid.appendChild(d); }); }
    function play(i){
      if(over||board[i])return; board[i]='x';
      let w=winner(board); if(w){ render(); finish(w); return; }
      const move=minimax(board.slice(),'o')[1];
      if(move>=0) board[move]='o';
      w=winner(board); if(w){ render(); finish(w); } else { status.textContent='Ваш ход (X)'; render(); }
    }
    function finish(w){ over=true;
      if(w==='x'){status.textContent='🎉 Вы победили!';sc.x++;}
      else if(w==='o'){status.textContent='🤖 ИИ победил';sc.o++;}
      else {status.textContent='🤝 Ничья';sc.d++;}
      win.body.querySelector('.ts-x').textContent=sc.x; win.body.querySelector('.ts-o').textContent=sc.o; win.body.querySelector('.ts-d').textContent=sc.d;
    }
    win.body.querySelector('.ttt-new').onclick=()=>{ board=Array(9).fill(''); over=false; status.textContent='Ваш ход (X)'; render(); };
    render();
  }
});

/* ---------- Магазин скинов ---------- */
const Skins = {
  current() { return localStorage.getItem('qwenos_skin')||'default'; },
  apply(id) {
    document.body.classList.remove('skin-neon','skin-retro','skin-glass','skin-gold');
    if (id!=='default') document.body.classList.add('skin-'+id);
    localStorage.setItem('qwenos_skin', id);
  }
};
registerApp('store', {
  name: 'Магазин', icon: '🛍️', width: 560, height: 420,
  open(win) {
    const ITEMS=[
      {id:'neon', name:'Неон', icon:'💜', desc:'Розово-фиолетовые акценты и светящиеся рамки окон'},
      {id:'retro', name:'Ретро-DOS', icon:'🟩', desc:'Зелёный терминал, пиксельные шрифты, олдскул'},
      {id:'glass', name:'Стекло', icon:'🪟', desc:'Максимальное размытие и прозрачность'},
    ];
    win.body.innerHTML=`
      <div class="store">
        <h2>🛍️ Магазин скинов QwenOS</h2>
        <p class="st-note">Все скины бесплатны 🎁. «Купить» = применить. Можно вернуть «По умолчанию».</p>
        <div class="st-grid"></div>
      </div>`;
    const g=win.body.querySelector('.st-grid');
    const cur=Skins.current();
    const all=[{id:'default',name:'По умолчанию',icon:'🎨',desc:'Классический вид QwenOS Aurora'},...ITEMS];
    all.forEach(it=>{
      const d=document.createElement('div');
      d.className='st-card'+(cur===it.id?' owned':'');
      d.innerHTML=`<div class="st-icon">${it.icon}</div><div class="st-name">${it.name}</div><div class="st-desc">${it.desc}</div>
        <button>${cur===it.id?'✓ Активен':'Купить · 0₽'}</button>`;
      d.querySelector('button').onclick=()=>{
        Skins.apply(it.id);
        OS.notify('🛍️ Темы', it.id==='default'?'Восстановлен стандартный стиль':`Скин «${it.name}» применён! ✨`);
        g.querySelectorAll('.st-card').forEach((x,i)=>{ const isCur=all[i].id===it.id; x.classList.toggle('owned',isCur); x.querySelector('button').textContent=isCur?'✓ Активен':'Купить · 0₽'; });
      };
      g.appendChild(d);
    });
  }
});

/* ---------- Скин «Золото» — покупается только в Steam за 700 🪙 ---------- */
(function(){
  const prevOpen = Apps.store.open;
  Apps.store.open = function(win) {
    prevOpen.call(this, win);
    if (window.Money && !Money.owned()['skin-gold']) {
      const card = document.createElement('div');
      card.className = 'st-card';
      card.innerHTML = `<div class="st-icon">👑</div><div class="st-name">Золото <small style="color:#e8564d">EXCLUSIVE · Steam</small></div>
        <div class="st-desc">Роскошная золотая тема. Доступна только после покупки в Steam за ${Money.fmt(700)}.</div>
        <button>🔒 Купить в Steam</button>`;
      card.querySelector('button').onclick = () => OS.openApp('shop');
      const g = win.body.querySelector('.st-grid');
      if (g) g.appendChild(card);
    }
  };
})();
