document.addEventListener('DOMContentLoaded', () => {
  const socket = io();
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  let myId = null;
  const players = {};
  const bullets = [];

  const joinBtn = document.getElementById('joinBtn');
  const leaveBtn = document.getElementById('leaveBtn');
  const nameInput = document.getElementById('name');

  joinBtn.onclick = () => {
    if (myId) return;
    const name = nameInput.value.trim() || "Player";
    const info = { x: Math.random()*700+50, y: Math.random()*500+50, name };
    socket.emit('new-player', info);
    joinBtn.disabled = true;
    leaveBtn.disabled = false;
    nameInput.disabled = true;
  };

  leaveBtn.onclick = () => {
    if (myId) {
      socket.disconnect();
      myId = null;
      joinBtn.disabled = false;
      leaveBtn.disabled = true;
      nameInput.disabled = false;
      Object.keys(players).forEach(k => delete players[k]);
      bullets.length = 0;
    }
  };

  // === socket events ===
  socket.on('connect', () => console.log('Connected', socket.id));
  socket.on('init-state', state => { Object.assign(players, state); myId = socket.id; });
  socket.on('player-joined', ({id,data}) => players[id] = data);
  socket.on('player-left', id => delete players[id]);
  socket.on('player-moved', ({id,x,y}) => { if(players[id]) { players[id].x=x; players[id].y=y; } });
  socket.on('player-rotated', ({id,angle}) => { if(players[id]) players[id].angle=angle; });
  socket.on('bullet-fired', b => bullets.push(b));
  socket.on('player-hit', ({id,hp}) => { if(players[id]) players[id].hp = hp; });
  socket.on('player-respawn', ({id,x,y,hp}) => { if(players[id]) { players[id].x=x; players[id].y=y; players[id].hp=hp; } });

  // === Controls ===
  const keys = {};
  window.addEventListener('keydown', e => keys[e.key] = true);
  window.addEventListener('keyup', e => keys[e.key] = false);

  // === Rotate tank with mouse ===
  canvas.addEventListener('mousemove', e => {
    if(!myId) return;
    const me = players[myId];
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const angle = Math.atan2(my - me.y, mx - me.x);
    me.angle = angle;
    socket.emit('rotate', angle);
  });

  // === Shoot bullets ===
  canvas.addEventListener('click', e => {
    if(!myId) return;
    const me = players[myId];
    const gunLength = 20;
    const speed = 6;
    const bulletX = me.x + Math.cos(me.angle)*gunLength;
    const bulletY = me.y + Math.sin(me.angle)*gunLength;
    const vx = Math.cos(me.angle)*speed;
    const vy = Math.sin(me.angle)*speed;
    socket.emit('shoot', { x: bulletX, y: bulletY, vx, vy });
  });

  // === Update ===
  function update() {
    const me = players[myId];
    if(me){
      let moved=false;
      if(keys['w']) { me.y-=3; moved=true; }
      if(keys['s']) { me.y+=3; moved=true; }
      if(keys['a']) { me.x-=3; moved=true; }
      if(keys['d']) { me.x+=3; moved=true; }
      me.x = Math.max(15, Math.min(785, me.x));
      me.y = Math.max(15, Math.min(585, me.y));
      if(moved) socket.emit('move',{x:me.x,y:me.y});
    }

    for(let i=bullets.length-1;i>=0;i--){
      const b = bullets[i];
      b.x += b.vx; b.y += b.vy;
      if(b.x<0||b.x>canvas.width||b.y<0||b.y>canvas.height) bullets.splice(i,1);
    }
  }

  // === Draw ===
  function drawPlayer(p){
    ctx.save();
    ctx.translate(p.x,p.y);
    ctx.rotate(p.angle||0);
    ctx.fillStyle = p.color;
    ctx.fillRect(-15,-10,30,20); // tank body
    ctx.fillStyle='black';
    ctx.fillRect(0,-3,20,6); // cannon
    ctx.restore();

    ctx.fillStyle='white';
    ctx.font='12px Arial';
    ctx.fillText(p.name,p.x-20,p.y-20);
    ctx.fillText("HP:"+p.hp,p.x-20,p.y+25);
  }

  function loop(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    update();
    for(const id in players) drawPlayer(players[id]);
    ctx.fillStyle='yellow';
    bullets.forEach(b=>ctx.fillRect(b.x-2,b.y-2,4,4));
    requestAnimationFrame(loop);
  }

  loop();
});
