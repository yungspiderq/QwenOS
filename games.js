/* ============ QwenOS Arcade — реестр игр + лаунчер ============ */
const Games = {};
function registerGame(id, def) { Games[id] = def; }

/* ---------- Лаунчер «Аркада» ---------- */
registerApp('arcade', {
  name: 'Аркада', icon: '🕹️', width: 560, height: 420,
  open(win) {
    win.body.innerHTML = `
      <div class="arcade">
        <h2>🕹️ QwenOS Arcade</h2>
        <p class="ar-note">Выберите игру — она откроется в новом окне.</p>
        <div class="ar-grid"></div>
      </div>`;
    const g = win.body.querySelector('.ar-grid');
    Object.entries(Games).forEach(([id, game]) => {
      const d = document.createElement('div');
      d.className = 'ar-card';
      d.innerHTML = `<div class="ar-icon">${game.icon}</div><div class="ar-name">${game.name}</div><div class="ar-desc">${game.desc||''}</div>`;
      d.onclick = () => OS.openApp(id);
      g.appendChild(d);
    });
  }
});

/* ---------- 2048 ---------- */
registerGame('g2048', {
  name: '2048', icon: '🔢', desc: 'Сдвигай плитки и собери 2048!',
  open(win) {
    win.body.innerHTML = `
      <div class="game2048">
        <div class="g20-head"><span>Счёт: <b class="g20-s">0</b></span><span>Рекорд: <b class="g20-r">0</b></span><button class="g20-new">🔄 Новая</button></div>
        <div class="g20-board"></div>
        <div class="sn-help">Стрелки / WASD</div>
      </div>`;
    win.el.tabIndex = 0;
    let board, score;
    let best = +localStorage.getItem('qwenos_2048_best') || 0;
    win.body.querySelector('.g20-r').textContent = best;
    const COLORS = {2:'#eee4da',4:'#ede0c8',8:'#f2b179',16:'#f59563',32:'#f67c5f',64:'#f65e3b',128:'#edcf72',256:'#edcc61',512:'#edc850',1024:'#edc53f',2048:'#edc22e'};
    function newBoard(){ board = Array.from({length:4},()=>Array(4).fill(0)); score=0; add(); add(); render(); }
    function add(){ const empty=[]; board.forEach((r,y)=>r.forEach((v,x)=>{if(!v)empty.push([x,y]);})); if(!empty.length)return; const p=empty[Math.floor(Math.random()*empty.length)]; board[p[1]][p[0]]=Math.random()<0.9?2:4; }
    function slide(row){ let a=row.filter(v=>v), g=0;
      for(let i=0;i<a.length-1;i++) if(a[i]===a[i+1]){ a[i]*=2; g+=a[i]; a.splice(i+1,1); }
      while(a.length<4)a.push(0); return [a,g]; }
    function move(dir){ // 0-left 1-up 2-right 3-down
      const before=JSON.stringify(board); let gained=0;
      for(let i=0;i<4;i++){
        let line;
        if(dir===0) line=board[i].slice();
        else if(dir===2) line=board[i].slice().reverse();
        else if(dir===1) line=board.map(r=>r[i]);
        else line=board.map(r=>r[i]).reverse();
        const res=slide(line); gained+=res[1]; const nl=res[0];
        if(dir===0) board[i]=nl;
        else if(dir===2) board[i]=nl.reverse();
        else if(dir===1) nl.forEach((v,j)=>board[j][i]=v);
        else nl.forEach((v,j)=>board[3-j][i]=v);
      }
      if(JSON.stringify(board)!==before){ score+=gained; add(); if(score>best){best=score;localStorage.setItem('qwenos_2048_best',best);} render(); checkEnd(); }
    }
    function checkEnd(){
      if(board.flat().includes(2048)) return OS.notify('🔢 2048','Вы собрали 2048! 🎉');
      for(let y=0;y<4;y++)for(let x=0;x<4;x++){ if(!board[y][x])return;
        if(x<3&&board[y][x]===board[y][x+1])return; if(y<3&&board[y][x]===board[y+1][x])return; }
      OS.notify('🔢 2048',`Игра окончена. Счёт: ${score}`);
    }
    function render(){
      const el=win.body.querySelector('.g20-board'); el.innerHTML='';
      win.body.querySelector('.g20-s').textContent=score; win.body.querySelector('.g20-r').textContent=best;
      board.flat().forEach(v=>{ const c=document.createElement('div'); c.className='g20-cell'+(v?' tile':''); c.textContent=v||'';
        if(v){ c.style.background=COLORS[v]||'#3c3a32'; c.style.color=v<=4?'#776e65':'#fff'; } el.appendChild(c); });
    }
    win.el.addEventListener('keydown', e=>{
      const m={ArrowLeft:0,ArrowUp:1,ArrowRight:2,ArrowDown:3,a:0,w:1,d:2,s:3};
      const k=e.key.length===1?e.key.toLowerCase():e.key;
      if(m[k]!==undefined){ e.preventDefault(); move(m[k]); win.el.focus(); }
    });
    win.body.querySelector('.g20-new').onclick=newBoard;
    newBoard(); setTimeout(()=>win.el.focus(),50);
  }
});

/* ---------- Понг vs AI ---------- */
registerGame('pong', {
  name: 'Понг', icon: '🏓', desc: 'Классика: вы против ИИ',
  open(win) {
    win.body.innerHTML=`
      <div class="pong">
        <div class="sn-score">Вы <b class="pg-p">0</b> : <b class="pg-c">0</b> ИИ · W/S или ↑/↓</div>
        <canvas class="pg-canvas"></canvas>
      </div>`;
    win.el.tabIndex=0;
    const cv=win.body.querySelector('.pg-canvas'), ctx=cv.getContext('2d');
    cv.width=380; cv.height=280;
    let py=cv.height/2-25, cy=py, ball={x:190,y:140,vx:2.6,vy:1.8}, sp=0, sc=[0,0], raf=null, keys={}, closed=false;
    win.el.addEventListener('keydown',e=>{keys[e.key]=true; if(['ArrowUp','ArrowDown'].includes(e.key))e.preventDefault();});
    win.el.addEventListener('keyup',e=>keys[e.key]=false);
    function resetBall(dir){ ball.x=190; ball.y=140; ball.vx=2.6*dir; ball.vy=(Math.random()*3-1.5); sp=0; }
    function loop(){
      if(closed)return;
      raf=requestAnimationFrame(loop);
      if(keys['w']||keys['W']||keys['ArrowUp'])py-=4;
      if(keys['s']||keys['S']||keys['ArrowDown'])py+=4;
      py=Math.max(0,Math.min(cv.height-50,py));
      const target=ball.y-25; cy+=Math.max(-3.2,Math.min(3.2,(target-cy)*0.08));
      cy=Math.max(0,Math.min(cv.height-50,cy));
      ball.x+=ball.vx*(1+sp*0.02); ball.y+=ball.vy*(1+sp*0.02);
      if(ball.y<6||ball.y>cv.height-6)ball.vy*=-1;
      if(ball.x<16&&ball.x>6&&ball.y>py&&ball.y<py+50){ ball.vx=Math.abs(ball.vx); sp++; ball.vy+=(ball.y-(py+25))*0.12; }
      if(ball.x>cv.width-16&&ball.x<cv.width-6&&ball.y>cy&&ball.y<cy+50){ ball.vx=-Math.abs(ball.vx); sp++; ball.vy+=(ball.y-(cy+25))*0.12; }
      if(ball.x<0){ sc[1]++; win.body.querySelector('.pg-c').textContent=sc[1]; resetBall(1); }
      if(ball.x>cv.width){ sc[0]++; win.body.querySelector('.pg-p').textContent=sc[0]; resetBall(-1); }
      draw();
    }
    function draw(){
      ctx.fillStyle='#0d1117'; ctx.fillRect(0,0,cv.width,cv.height);
      ctx.strokeStyle='rgba(255,255,255,.25)'; ctx.setLineDash([6,8]); ctx.beginPath(); ctx.moveTo(cv.width/2,0); ctx.lineTo(cv.width/2,cv.height); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle='#4da3ff'; ctx.fillRect(8,py,8,50);
      ctx.fillStyle='#f093fb'; ctx.fillRect(cv.width-16,cy,8,50);
      ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(ball.x,ball.y,6,0,7); ctx.fill();
    }
    resetBall(Math.random()<.5?1:-1); loop();
    win.onClose=()=>{ closed=true; cancelAnimationFrame(raf); };
  }
});

/* ---------- Арканоид ---------- */
registerGame('breakout', {
  name: 'Арканоид', icon: '🧱', desc: 'Разбей все кирпичи',
  open(win) {
    win.body.innerHTML=`
      <div class="brickout">
        <div class="sn-score">Счёт <b class="bk-s">0</b> · Жизни <b class="bk-l">❤❤❤</b> · ←/→ или мышь</div>
        <canvas class="bk-canvas"></canvas>
      </div>`;
    win.el.tabIndex=0;
    const cv=win.body.querySelector('.bk-canvas'), ctx=cv.getContext('2d');
    cv.width=400; cv.height=300;
    let px=cv.width/2-35, ball={x:200,y:250,vx:2.4,vy:-2.8}, lives=3, score=0, raf=null, keys={}, bricks=[], stopped=false;
    const COLORS=['#e8564d','#f67c5f','#edcc61','#7ee787','#4da3ff','#b388ff'];
    function makeBricks(){ bricks=[]; for(let r=0;r<5;r++)for(let c=0;c<8;c++)bricks.push({x:c*48+8,y:r*20+30,w:44,h:16,alive:true,color:COLORS[r]}); }
    win.el.addEventListener('keydown',e=>{keys[e.key]=true; if(['ArrowLeft','ArrowRight'].includes(e.key))e.preventDefault();});
    win.el.addEventListener('keyup',e=>keys[e.key]=false);
    cv.addEventListener('pointermove',e=>{ const r=cv.getBoundingClientRect(); px=Math.max(0,Math.min(cv.width-70,e.clientX-r.left-35)); });
    function reset(){ ball={x:px+35,y:250,vx:(Math.random()<.5?-1:1)*2.4,vy:-2.8}; }
    function loop(){
      if(stopped)return;
      raf=requestAnimationFrame(loop);
      if(keys['ArrowLeft'])px-=6; if(keys['ArrowRight'])px+=6;
      px=Math.max(0,Math.min(cv.width-70,px));
      ball.x+=ball.vx; ball.y+=ball.vy;
      if(ball.x<6||ball.x>cv.width-6)ball.vx*=-1;
      if(ball.y<6)ball.vy*=-1;
      if(ball.y>cv.height-18&&ball.y<cv.height-8&&ball.x>px&&ball.x<px+70){ ball.vy=-Math.abs(ball.vy); ball.vx+=(ball.x-(px+35))*0.06; }
      if(ball.y>cv.height){ lives--; win.body.querySelector('.bk-l').textContent='❤'.repeat(Math.max(0,lives))||'—'; if(lives<=0){ gameOver(true);} else reset(); }
      for(const b of bricks){ if(!b.alive)continue;
        if(ball.x>b.x-6&&ball.x<b.x+b.w+6&&ball.y>b.y-6&&ball.y<b.y+b.h+6){ b.alive=false; ball.vy*=-1; score+=10; win.body.querySelector('.bk-s').textContent=score; break; } }
      if(bricks.every(b=>!b.alive)) gameOver(false);
      draw();
    }
    function gameOver(lost){
      cancelAnimationFrame(raf); stopped=true;
      OS.notify('🧱 Арканоид', lost?`Проигрыш! Счёт: ${score}`:`🎉 Все кирпичи сломаны! Счёт: ${score}`);
      lives=3; score=0; makeBricks(); win.body.querySelector('.bk-l').textContent='❤❤❤'; win.body.querySelector('.bk-s').textContent=0; reset();
      stopped=false; raf=requestAnimationFrame(loop);
    }
    function draw(){
      ctx.fillStyle='#0d1117'; ctx.fillRect(0,0,cv.width,cv.height);
      bricks.forEach(b=>{ if(!b.alive)return; ctx.fillStyle=b.color; ctx.fillRect(b.x,b.y,b.w,b.h); });
      ctx.fillStyle='#4da3ff'; ctx.fillRect(px,cv.height-14,70,8);
      ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(ball.x,ball.y,6,0,7); ctx.fill();
    }
    makeBricks(); reset(); loop();
    win.onClose=()=>{ stopped=true; cancelAnimationFrame(raf); };
  }
});

/* ---------- Космос (shooter) ---------- */
registerGame('space', {
  name: 'Космос', icon: '🚀', desc: 'Отстреливай астероиды',
  open(win) {
    win.body.innerHTML=`
      <div class="space-game">
        <div class="sn-score">Очки <b class="sp-s">0</b> · ❤<b class="sp-h">3</b> · ←/→ движение, Space — огонь</div>
        <canvas class="sp-canvas"></canvas>
      </div>`;
    win.el.tabIndex=0;
    const cv=win.body.querySelector('.sp-canvas'), ctx=cv.getContext('2d');
    cv.width=400; cv.height=320;
    let ship={x:200}, bullets=[], rocks=[], stars=[], score=0, hp=3, keys={}, raf=null, spawnT=0, shootCd=0, over=false, closed=false;
    for(let i=0;i<60;i++)stars.push({x:Math.random()*400,y:Math.random()*320,s:Math.random()*1.5+.3});
    win.el.addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true; if([' ','arrowleft','arrowright'].includes(e.key.toLowerCase()))e.preventDefault();});
    win.el.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
    function end(){ over=true; OS.notify('🚀 Космос',`Корабль уничтожен! Очки: ${score}. Пробел — заново.`); }
    function restart(){ ship={x:200};bullets=[];rocks=[];score=0;hp=3;over=false; upd(); }
    function upd(){ win.body.querySelector('.sp-s').textContent=score; win.body.querySelector('.sp-h').textContent=hp; }
    function loop(){
      if(closed)return;
      raf=requestAnimationFrame(loop);
      if(over){ ctx.fillStyle='#05070f';ctx.fillRect(0,0,cv.width,cv.height);
        ctx.fillStyle='#fff';ctx.font='18px sans-serif';ctx.fillText('GAME OVER — пробел',110,160);
        if(keys[' '])restart(); return; }
      if(keys['arrowleft'])ship.x-=5; if(keys['arrowright'])ship.x+=5;
      ship.x=Math.max(12,Math.min(cv.width-12,ship.x));
      shootCd--; if(keys[' ']&&shootCd<=0){ bullets.push({x:ship.x,y:cv.height-30}); shootCd=12; }
      bullets.forEach(b=>b.y-=7); bullets=bullets.filter(b=>b.y>0);
      spawnT--; if(spawnT<=0){ rocks.push({x:Math.random()*cv.width,y:-20,r:10+Math.random()*14,v:1.2+Math.random()*1.8+score/500}); spawnT=34; }
      rocks.forEach(r=>r.y+=r.v);
      for(const r of rocks){ for(const b of bullets){ if(Math.hypot(r.x-b.x,r.y-b.y)<r.r){ r.dead=true; b.dead=true; score+=10; upd(); } } }
      for(const r of rocks){
        if(r.y>cv.height-46&&Math.abs(r.x-ship.x)<r.r+10){ r.dead=true; hp--; upd(); if(hp<=0)end(); }
        else if(r.y>cv.height+r.r){ r.dead=true; } }
      rocks=rocks.filter(r=>!r.dead); bullets=bullets.filter(b=>!b.dead);
      draw();
    }
    function draw(){
      ctx.fillStyle='#05070f'; ctx.fillRect(0,0,cv.width,cv.height);
      ctx.fillStyle='#8899bb'; stars.forEach(s=>{ s.y+=s.s; if(s.y>320)s.y=0; ctx.fillRect(s.x,s.y,1.5,1.5); });
      ctx.fillStyle='#e8564d'; rocks.forEach(r=>{ ctx.beginPath(); ctx.arc(r.x,r.y,r.r,0,7); ctx.fill(); });
      ctx.fillStyle='#ffd166'; bullets.forEach(b=>ctx.fillRect(b.x-1.5,b.y,3,8));
      ctx.fillStyle='#4da3ff'; ctx.beginPath(); ctx.moveTo(ship.x,cv.height-38); ctx.lineTo(ship.x-12,cv.height-16); ctx.lineTo(ship.x+12,cv.height-16); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#f66'; ctx.fillRect(ship.x-2,cv.height-16,4,6);
    }
    loop();
    win.onClose=()=>{ closed=true; cancelAnimationFrame(raf); };
  }
});

/* ---------- Флаги (викторина) ---------- */
registerGame('flags', {
  name: 'Флаги', icon: '🏳️', desc: 'Угадай страну по флагу',
  open(win) {
    const DATA=[["🇦🇩","Андорра"],["🇦🇪","ОАЭ"],["🇦🇷","Аргентина"],["🇦🇺","Австралия"],["🇦🇹","Австрия"],["🇦🇿","Азербайджан"],["🇦🇴","Ангола"],["🇧🇪","Бельгия"],["🇧🇬","Болгария"],["🇧🇷","Бразилия"],["🇧🇾","Беларусь"],["🇨🇦","Канада"],["🇨🇭","Швейцария"],["🇨🇱","Чили"],["🇨🇳","Китай"],["🇨🇴","Колумбия"],["🇨🇿","Чехия"],["🇩🇪","Германия"],["🇩🇰","Дания"],["🇪🇸","Испания"],["🇫🇮","Финляндия"],["🇫🇷","Франция"],["🇬🇧","Великобритания"],["🇬🇪","Грузия"],["🇭🇷","Хорватия"],["🇭🇺","Венгрия"],["🇮🇩","Индонезия"],["🇮🇪","Ирландия"],["🇮🇳","Индия"],["🇮🇸","Исландия"],["🇮🇹","Италия"],["🇯🇵","Япония"],["🇰🇿","Казахстан"],["🇱🇹","Литва"],["🇱🇻","Латвия"],["🇲🇦","Марокко"],["🇲🇨","Монако"],["🇲🇩","Молдова"],["🇲🇪","Черногория"],["🇲🇰","Северная Македония"],["🇳🇱","Нидерланды"],["🇳🇴","Норвегия"],["🇳🇿","Новая Зеландия"],["🇵🇪","Перу"],["🇵🇱","Польша"],["🇵🇹","Португалия"],["🇷🇴","Румыния"],["🇷🇸","Сербия"],["🇷🇺","Россия"],["🇸🇦","Саудовская Аравия"],["🇸🇪","Швеция"],["🇸🇮","Словения"],["🇸🇰","Словакия"],["🇹🇭","Таиланд"],["🇹🇷","Турция"],["🇺🇦","Украина"],["🇺🇾","Уругвай"],["🇺🇸","США"],["🇿🇦","ЮАР"]];
    win.body.innerHTML=`
      <div class="flags">
        <div class="fl-score">Серия: <b class="fl-streak">0</b> · Лучшая: <b class="fl-best">0</b></div>
        <div class="fl-flag">❓</div>
        <div class="fl-opts"></div>
        <div class="fl-msg"></div>
      </div>`;
    const flagEl=win.body.querySelector('.fl-flag'), opts=win.body.querySelector('.fl-opts'), msg=win.body.querySelector('.fl-msg');
    let cur=null, streak=0, answered=false, best=+localStorage.getItem('qwenos_flags_best')||0;
    win.body.querySelector('.fl-best').textContent=best;
    function next(){
      answered=false;
      const pool=[...DATA].sort(()=>Math.random()-0.5);
      cur=pool[0];
      const wrong=pool.slice(1,4).map(d=>d[1]);
      const options=[cur[1],...wrong].sort(()=>Math.random()-0.5);
      flagEl.textContent=cur[0]; msg.textContent='';
      opts.innerHTML='';
      options.forEach(o=>{ const b=document.createElement('button'); b.textContent=o; b.onclick=()=>answer(o,b); opts.appendChild(b); });
    }
    function answer(o,btn){
      if(answered)return; answered=true;
      if(o===cur[1]){ streak++; btn.classList.add('ok'); msg.textContent='✅ Верно!';
        if(streak>best){best=streak;localStorage.setItem('qwenos_flags_best',best);win.body.querySelector('.fl-best').textContent=best;}
        win.body.querySelector('.fl-streak').textContent=streak;
        setTimeout(next,700);
      } else { btn.classList.add('bad'); msg.textContent=`❌ Это ${cur[1]}`; streak=0; win.body.querySelector('.fl-streak').textContent=0; setTimeout(next,1400); }
    }
    next();
  }
});
