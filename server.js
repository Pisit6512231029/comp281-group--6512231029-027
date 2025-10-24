const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const players = {};
const bullets = [];

// === socket.io connection ===
io.on('connection', socket => {
  console.log('connected', socket.id);

  socket.on('new-player', info => {
    players[socket.id] = { 
      x: info.x, 
      y: info.y, 
      color: info.color||randomColor(), 
      name: info.name||`Player-${socket.id.slice(0,4)}`, 
      hp: 100,
      angle: 0
    };
    socket.emit('init-state', players);
    socket.broadcast.emit('player-joined', { id: socket.id, data: players[socket.id] });
  });

  socket.on('move', pos => {
    if(players[socket.id]){
      players[socket.id].x = pos.x;
      players[socket.id].y = pos.y;
      socket.broadcast.emit('player-moved', { id: socket.id, x: pos.x, y: pos.y });
    }
  });

  // รับมุมหมุน
  socket.on('rotate', angle => {
    if(players[socket.id]){
      players[socket.id].angle = angle;
      socket.broadcast.emit('player-rotated', { id: socket.id, angle });
    }
  });

  socket.on('shoot', bullet => {
    bullets.push({ ...bullet, owner: socket.id });
    io.emit('bullet-fired', { ...bullet, owner: socket.id });
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    socket.broadcast.emit('player-left', socket.id);
  });
});

// === Server tick ===
setInterval(() => {
  for(let i = bullets.length - 1; i >= 0; i--){
    const b = bullets[i];
    b.x += b.vx;
    b.y += b.vy;

    for(const id in players){
      if(id === b.owner) continue;
      const p = players[id];
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      if(Math.sqrt(dx*dx + dy*dy) < 16){
        p.hp -= 20;
        io.emit('player-hit', { id, hp: p.hp });
        bullets.splice(i,1);
        break;
      }
    }

    if(b.x < 0 || b.x > 800 || b.y < 0 || b.y > 600){
      bullets.splice(i,1);
    }
  }

  // Respawn
  for(const id in players){
    if(players[id].hp <= 0){
      players[id].hp = 100;
      players[id].x = Math.random()*700+50;
      players[id].y = Math.random()*500+50;
      io.emit('player-respawn', { id, x: players[id].x, y: players[id].y, hp: players[id].hp });
    }
  }
}, 30);

function randomColor() {
  const colors = ['#e74c3c','#3498db','#2ecc71','#f1c40f','#9b59b6','#e67e22','#1abc9c'];
  return colors[Math.floor(Math.random()*colors.length)];
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
