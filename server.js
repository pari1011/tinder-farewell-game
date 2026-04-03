const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = {};

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function makePairs(pool) {
  const pairs = [];
  for (let i = 0; i < pool.length - 1; i += 2) pairs.push([pool[i], pool[i+1]]);
  if (pool.length % 2 !== 0) pairs.push([pool[pool.length-1], null]);
  return pairs;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('create_room', () => {
    const code = generateRoomCode();
    rooms[code] = {
      code,
      admin: socket.id,
      players: [],
      seniors: [],
      state: 'setup',
      round: 1,
      matchups: [],
      currentMatch: 0,
      winners: [],
      votes: {},
      votedCount: 0,
      timeLeft: 30,
      timerInterval: null
      // Removed the custom data since admin uploads it
    };
    socket.join(code);
    socket.emit('room_created', code);
  });

  socket.on('join_room', ({ code, name }) => {
    code = code.toUpperCase();
    if (rooms[code]) {
      const room = rooms[code];
      const existing = room.players.find(p => p.id === socket.id);
      if(!existing) {
        const player = { id: socket.id, name };
        room.players.push(player);
      }
      socket.join(code);
      socket.emit('joined_room', { code, state: room.state, round: room.round, isAdmin: false });
      io.to(room.admin).emit('players_updated', room.players);
      
      // If game is in progress, sync them up
      if (room.state === 'game') {
          // just let them wait or give them current match
      }
    } else {
      socket.emit('error_msg', 'Room not found');
    }
  });

  socket.on('update_seniors', ({ code, seniors }) => {
    if (rooms[code] && rooms[code].admin === socket.id) {
      rooms[code].seniors = seniors;
    }
  });

  socket.on('start_game', ({ code }) => {
    const room = rooms[code];
    if (room && room.admin === socket.id) {
      room.state = 'game';
      room.round = 1;
      room.winners = [];
      const pool = shuffle([...room.seniors.map(s => s.id)]);
      room.matchups = makePairs(pool);
      room.currentMatch = 0;
      
      startMatch(code);
    }
  });

  function startMatch(code) {
    const room = rooms[code];
    if (!room) return;
    
    if (room.timerInterval) clearInterval(room.timerInterval);
    
    room.votes = {};
    room.votedCount = 0;
    
    if (room.currentMatch >= room.matchups.length) {
      endRound(code);
      return;
    }
    
    const m = room.matchups[room.currentMatch];
    
    if (m[1] === null) {
      room.winners.push(m[0]);
      room.seniors.find(s => s.id === m[0]).wins++;
      room.currentMatch++;
      startMatch(code);
      return;
    }
    
    const leftSenior = room.seniors.find(s => s.id === m[0]);
    const rightSenior = room.seniors.find(s => s.id === m[1]);
    
    room.timeLeft = 30;
    
    const payload = {
      matchupCounter: `Match ${room.currentMatch + 1} of ${room.matchups.filter(x => x[1] !== null).length}`,
      roundTitle: getRoundName(room),
      roundBadge: `Round ${room.round}`,
      progress: { done: room.currentMatch, total: room.matchups.filter(x => x[1] !== null).length },
      left: leftSenior,
      right: rightSenior,
      timeLeft: room.timeLeft
    };
    
    io.to(code).emit('new_match', payload);
    io.to(code).emit('leaderboard_update', room.seniors);

    room.timerInterval = setInterval(() => {
      room.timeLeft--;
      io.to(code).emit('timer_update', room.timeLeft);
      
      if (room.timeLeft <= 0) {
        clearInterval(room.timerInterval);
        resolveMatch(code);
      }
    }, 1000);
  }
  
  function resolveMatch(code) {
    const room = rooms[code];
    const m = room.matchups[room.currentMatch];
    
    let leftVotes = 0;
    let rightVotes = 0;
    for (let sid in room.votes) {
      if (room.votes[sid] === 'left') leftVotes++;
      if (room.votes[sid] === 'right') rightVotes++;
    }
    
    const winnerId = leftVotes >= rightVotes ? m[0] : m[1];
    
    room.winners.push(winnerId);
    room.seniors.find(s => s.id === winnerId).wins++;
    
    io.to(code).emit('match_result', { 
        winnerId, 
        leftVotes, 
        rightVotes, 
        side: leftVotes >= rightVotes ? 'left' : 'right' 
    });
    
    setTimeout(() => {
      room.currentMatch++;
      startMatch(code);
    }, 4000);
  }
  
  socket.on('vote', ({ code, side }) => { 
    const room = rooms[code];
    if (room && room.state === 'game' && !room.votes[socket.id]) {
      room.votes[socket.id] = side;
      room.votedCount++;
      
      io.to(room.admin).emit('live_votes', {
         left: Object.values(room.votes).filter(v => v === 'left').length,
         right: Object.values(room.votes).filter(v => v === 'right').length,
         total: room.players.length
      });
      
      if (room.votedCount >= room.players.length && room.players.length > 0) {
        clearInterval(room.timerInterval);
        resolveMatch(code);
      }
    }
  });
  
  function getRoundName(room) {
    const pool = room.seniors.filter(s => !s.eliminated).length;
    if (pool <= 2) return 'Grand Final 👑';
    if (pool <= 4) return 'Semi-Finals 🌸';
    if (pool <= 8) return 'Quarter-Finals ✨';
    return `Round ${room.round} — Group Stage`;
  }

  function endRound(code) {
    const room = rooms[code];
    room.state = 'round_end';
    
    const finalWinners = room.winners;
    
    room.seniors.forEach(s => {
      if (!finalWinners.includes(s.id)) s.eliminated = true;
    });
    
    const winnersPayload = finalWinners.map(id => room.seniors.find(s => s.id === id));
    
    io.to(code).emit('round_end', {
       round: room.round,
       winners: winnersPayload,
       isFinal: finalWinners.length === 1
    });
    
    io.to(code).emit('leaderboard_update', room.seniors);
  }
  
  socket.on('next_round', ({ code }) => {
    const room = rooms[code];
    if (room && room.admin === socket.id && room.state === 'round_end') {
      const surviving = room.winners;
      room.round++;
      room.matchups = makePairs(shuffle([...surviving]));
      room.currentMatch = 0;
      room.winners = [];
      room.state = 'game';
      
      startMatch(code);
    }
  });

  socket.on('disconnect', () => {
    // Remove player from any rooms they were in
    for (const code in rooms) {
      const room = rooms[code];
      const initialLength = room.players.length;
      room.players = room.players.filter(p => p.id !== socket.id);
      if (room.players.length !== initialLength) {
        io.to(room.admin).emit('players_updated', room.players);
        
        // If we're mid-game, and this was the last person holding up the timer
        if(room.state === 'game' && room.votedCount >= room.players.length && room.players.length > 0) {
            clearInterval(room.timerInterval);
            resolveMatch(code);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
