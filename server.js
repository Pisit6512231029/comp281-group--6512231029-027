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
let roundTime = 60; // รอบละ 60 วินาที
let timer = roundTime;
let roundActive = true;

// == เริ่มจับเวลา ==
setInterval(() => {
  if (roundActive) {
    timer--;
    io.emit('timer-update', timer);

    if (timer <= 0) {
      roundActive = false;
      endRound();
    }
  }
}, 1000);

function endRound() {
  // หาผู้ชนะ
  const ranked = Object.entries(players)
    .map(([id, p]) => ({ name: p.name, score: p.score || 0 }))
    .sort((a, b) => b.score - a.score);

  io.emit('round-end', ranked);
  console.log('🏁 Round ended! Ranking:', ranked);

  setTimeout(() => startNewRound(), 5000); // 5 วิแล้วเริ่มรอบใหม่
}

function startNewRound() {
  timer = roundTime;
  roundActive = true;
  bullets.length = 0;
  for (const id in players) {
    players[id].hp = 100;
    players[id].x = Math.random() * 700 + 50;
    players[id].y = Math.random() * 500 + 50;
  }
  io.emit('round-start', { players, timer });
  console.log('🚀 New round started!');
}

io.on('connection', socket => {
  console.log('connected', socket.id);

  socket.on('new-player', info => {
    players[socket.id] = {
      x: info.x,
      y: info.y,
      color: randomColor(),
      name: info.name || `Player-${socket.id.slice(0,4)}`,
      hp: 100,
      angle: 0,
      score: 0
    };
    socket.emit('init-state', { players, timer });
    socket.broadcast.emit('player-joined', { id: socket.id, data: players[socket.id] });
  });

  socket.on('move', pos => {
    if (players[socket.id]) {
      players[socket.id].x = pos.x;
      players[socket.id].y = pos.y;
      socket.broadcast.emit('player-moved', { id: socket.id, x: pos.x, y: pos.y });
    }
  });

  socket.on('rotate', angle => {
    if (players[socket.id]) {
      players[socket.id].angle = angle;
      socket.broadcast.emit('player-rotated', { id: socket.id, angle });
    }
  });

  socket.on('shoot', b => {
    if (!roundActive) return;
    bullets.push({ ...b, owner: socket.id });
    io.emit('bullet-fired', { ...b, owner: socket.id });
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    socket.broadcast.emit('player-left', socket.id);
  });
});

// == Bullet / Collision Logic ==
setInterval(() => {
  if (!roundActive) return;
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx;
    b.y += b.vy;

    for (const id in players) {
      if (id === b.owner) continue;
      const p = players[id];
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      if (Math.sqrt(dx * dx + dy * dy) < 16) {
        p.hp -= 20;
        io.emit('player-hit', { id, hp: p.hp });

        if (p.hp <= 0) {
          // เพิ่มคะแนนให้คนยิง
          const shooter = players[b.owner];
          if (shooter) shooter.score = (shooter.score || 0) + 1;
          io.emit('score-update', { id: b.owner, score: shooter.score });

          // Respawn
          p.hp = 100;
          p.x = Math.random() * 700 + 50;
          p.y = Math.random() * 500 + 50;
          io.emit('player-respawn', { id, x: p.x, y: p.y, hp: p.hp });
        }

        bullets.splice(i, 1);
        break;
      }
    }

    if (b.x < 0 || b.x > 800 || b.y < 0 || b.y > 600) bullets.splice(i, 1);
  }
}, 30);

function randomColor() {
  const colors = ['#e74c3c','#3498db','#2ecc71','#f1c40f','#9b59b6','#e67e22','#1abc9c'];
  return colors[Math.floor(Math.random() * colors.length)];
}

server.listen(3000, () => console.log('✅ Server running at http://localhost:3000'));
