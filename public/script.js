const socket = io();

// UI State
let isAdmin = false;
let roomCode = null;
let playerName = '';
let seniors = [];

const urlParams = new URLSearchParams(window.location.search);
const urlRoomCode = urlParams.get('room');

document.addEventListener('DOMContentLoaded', () => {
    if (urlRoomCode) {
        document.getElementById('joinSection').style.display = 'block';
    } else {
        document.getElementById('createSection').style.display = 'block';
    }
});

// Helpers
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  
  if(document.getElementById(`tab-${tab}`)) {
    document.getElementById(`tab-${tab}`).classList.add('active');
  }
  document.getElementById(`screen-${tab}`).classList.add('active');
}

// 1. Connection & Room Logic
function createRoom() {
    socket.emit('create_room');
}

function joinRoom() {
    playerName = document.getElementById('playerName').value.trim();
    if(!playerName || !urlRoomCode) return showToast('Please enter your name');
    socket.emit('join_room', { code: urlRoomCode, name: playerName });
}

socket.on('room_created', (code) => {
    isAdmin = true;
    roomCode = code;
    document.getElementById('adminTabs').style.display = 'flex';
    document.getElementById('adminRoomInfo').style.display = 'inline-flex';
    
    // Generate QR with join URL
    const joinUrl = window.location.origin + window.location.pathname + '?room=' + code;
    document.getElementById('qrImage').src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(joinUrl)}`;
    document.getElementById('qrContainer').style.display = 'block';
    
    // Init Setup grid
    initDefaultSeniors();
    buildSetupGrid();
    switchTab('setup');
});

socket.on('joined_room', ({ code, state, round }) => {
    roomCode = code;
    if(state === 'setup') switchTab('waiting');
    else if(state === 'game') switchTab('game'); // Ideally get match state
});

socket.on('players_updated', (players) => {
    if(isAdmin) {
        document.getElementById('playerCountLabel').textContent = `${players.length} Players Joined`;
    }
});

socket.on('error_msg', msg => showToast(msg));

// 2. Setup Logic (Admin)
const RAW_SENIORS = [
  {"name":"S.L","hobbies":"Dancing, Singing, Debating, Acting","line":"Will steal your fries AND your heart 🍟💘","img":"images/sl.jpeg"},
  {"name":"S.B","hobbies":"Acting","line":"Debugging your heart since 2004 ","img":"images/sb.jpeg"},
  {"name":"T.J.","hobbies":"Debating","line":"I’ll win the debate but still choose you 💘","img":"images/tj.jpeg"},
  {"name":"A.D.","hobbies":"Dancing, Singing, Debating, Acting","line":"I act well, but this smile for you is real","img":"images/ad.jpeg"},
  {"name":"T.R.","hobbies":"Debating","line":"Are you WiFi? Because I’m feeling a strong connection","img":"images/tr.jpeg"},
  {"name":"M.D.","hobbies":"Dancing, Singing, Debating, Acting","line":"I had a line ready… but you distracted me","img":"images/md.jpeg"},
  {"name":"H.Y.","hobbies":"Debating","line":"I’d put you on repeat… no shame","img":"images/hy.jpeg"},
  {"name":"G.T.","hobbies":"Dancing","line":"Is your name Google? Because you have everything I’m searching for.","img":"images/gt.jpeg"},
  {"name":"A.A","hobbies":"Acting","line":"Are you made of Copper and Tellurium? Because you’re CuTe.","img":"images/aa.jpeg"},
  {"name":"R.V.","hobbies":"Singing","line":"If I could rearrange the alphabet, I’d put 'U' and 'I' together.","img":"images/rv.jpeg"},
  {"name":"S.H.","hobbies":"Dancing, Singing, Debating, Acting","line":"Well, here I am. What are your other two wishes?","img":"images/sh.jpeg"},
  {"name":"R.B.","hobbies":"Dancing","line":"Do you have a Band-Aid? Because I scraped my knee falling for you.","img":"images/rb.jpeg"},
  {"name":"A.B","hobbies":"Dancing, Singing, Acting","line":"Do you believe in love at first sight, or should I walk by again?","img":"images/ab.jpeg"},
  {"name":"R.R.","hobbies":"Acting","line":"Is there an airport nearby or is it my heart taking off?","img":"images/rr.jpeg"},
  {"name":"J.H.","hobbies":"Acting","line":"If you were a tropical fruit, you’d be a fine-apple.","img":"images/jh.jpeg"},
  {"name":"B.S.","hobbies":"Dancing, Singing, Debating, Acting","line":"I think there’s something wrong with my eyes, I can’t take them off you.","img":"images/bs.jpeg"},
  {"name":"A.B.","hobbies":"Dancing, Singing, Debating, Acting","line":"If I were a stop light, I’d turn red every time you passed by, just so I could stare at you a bit longer.","img":"images/ab2.jpeg"},
  {"name":"D.C.","hobbies":"Acting","line":"On a scale of 1 to 10, you’re a 9... and I’m the 1 you need. ❤️","img":"images/dc.jpeg"},
  {"name":"A.C.","hobbies":"Dancing, Singing, Debating, Acting","line":"Are you a tower? Because Eiffel for you.","img":"images/ac.jpeg"},
  {"name":"H.V.","hobbies":"Dancing, Singing, Debating, Acting","line":"Are you the sun? Because my world revolves around you.","img":"images/hv.jpeg"},
  {"name":"P.P.","hobbies":"Dancing, Singing, Debating, Acting","line":"If you were a vegetable, you would be a cute-cumber ","img":"images/pp.jpeg"},
  {"name":"V.K.","hobbies":"Debating","line":"I was feeling a bit off today, but you definitely turned me on.","img":"images/vk.jpeg"},
  {"name":"A.R.","hobbies":"Dancing, Debating","line":"Did it hurt? When you fell from heaven?","img":"images/ar.jpeg"},
  {"name":"V.K.","hobbies":"Dancing, Singing, Debating, Acting","line":"Do you have a map? I keep getting lost in your eyes.","img":"images/vk2.jpeg"},
  {"name":"A.V.","hobbies":"Dancing, Singing, Debating, Acting","line":"Are you a camera? Because every time I look at you, I smile.","img":"images/av.jpeg"}
];

function initDefaultSeniors() {
  seniors = RAW_SENIORS.map((s, i) => ({
    id: i, name: s.name, initials: s.name, hobbies: s.hobbies, line: s.line, photo: s.img, wins: 0, eliminated: false
  }));
}

function buildSetupGrid() {
  const grid = document.getElementById('seniorGrid');
  grid.innerHTML = '';
  seniors.forEach((s, i) => {
    const card = document.createElement('div');
    card.className = 'senior-card';
    card.id = `setup-card-${i}`;
    card.innerHTML = `
      <div class="senior-avatar" onclick="document.getElementById('file-${i}').click()">
        ${s.photo ? `<img src="${s.photo}" alt="">` : `<span>${s.initials}</span>`}
      </div>
      <input type="file" class="file-input" id="file-${i}" accept="image/*" onchange="handleUpload(${i}, this)">
      <input class="senior-name-input" value="${s.name}" placeholder="Full Name" onchange="updateName(${i}, this.value)">
      <div class="senior-initials-disp">${s.initials}</div>
      <textarea class="senior-line-input" rows="2" placeholder="Pickup line..." onchange="updateLine(${i}, this.value)">${s.line}</textarea>
    `;
    grid.appendChild(card);
  });
}

window.handleUpload = function(i, input) {
  if (!input.files[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    seniors[i].photo = e.target.result;
    buildSetupGrid();
  };
  reader.readAsDataURL(input.files[0]);
}

window.updateName = function(i, val) {
  seniors[i].name = val;
  seniors[i].initials = getInitials(val || '?');
  buildSetupGrid();
}
window.updateLine = function(i, val) { seniors[i].line = val; }

window.startGame = function() {
    socket.emit('update_seniors', { code: roomCode, seniors });
    socket.emit('start_game', { code: roomCode });
}

// 3. Game Flow
socket.on('new_match', (payload) => {
    document.getElementById('resultOverlay').classList.remove('visible');
    switchTab('game');
    
    document.getElementById('matchupCounter').textContent = payload.matchupCounter;
    document.getElementById('roundTitle').textContent = payload.roundTitle;
    document.getElementById('roundBadge').style.display = 'inline-block';
    document.getElementById('roundBadge').textContent = payload.roundBadge;
    document.getElementById('progressLabel').textContent = `Progress: ${payload.progress.done} / ${payload.progress.total} matches`;
    document.getElementById('progressFill').style.width = `${(payload.progress.done / payload.progress.total) * 100}%`;
    
    setCandidate('Left', payload.left);
    setCandidate('Right', payload.right);
    
    document.getElementById('cardLeft').className = 'candidate-card';
    document.getElementById('cardRight').className = 'candidate-card';
    
    document.getElementById('voteOverlayLeft').style.display = 'none';
    document.getElementById('voteOverlayRight').style.display = 'none';
    
    if(isAdmin) {
        document.getElementById('liveVotesDisplay').style.display = 'block';
        document.getElementById('votesLeftCount').textContent = '0';
        document.getElementById('votesRightCount').textContent = '0';
    }
});

function setCandidate(side, s) {
  const photo = document.getElementById(`photo${side}`);
  photo.innerHTML = s.photo ? `<img src="${s.photo}" alt="">` : s.initials;
  document.getElementById(`initials${side}`).textContent = s.initials;
  document.getElementById(`hobbies${side}`).textContent = s.hobbies;
  document.getElementById(`line${side}`).textContent = s.line;
}

socket.on('timer_update', (t) => {
  const offset = 213.6 * (1 - t / 15);
  document.getElementById('timerCircle').style.strokeDashoffset = offset;
  document.getElementById('timerText').textContent = t;
  document.getElementById('timerRing').className = 'timer-ring' + (t <= 5 ? ' urgent' : '');
});

window.zeroTimer = function() {
    if(isAdmin) {
        socket.emit('zero_timer', { code: roomCode });
    }
}

window.vote = function(side) {
    if(isAdmin) return; // admins don't vote
    
    socket.emit('vote', { code: roomCode, side });
    
    document.getElementById('cardLeft').classList.remove('voted');
    document.getElementById('cardRight').classList.remove('voted');
    document.getElementById('card' + (side === 'left' ? 'Left' : 'Right')).classList.add('voted');
}

socket.on('live_votes', (v) => {
    if(isAdmin) {
        document.getElementById('votesLeftCount').textContent = v.left;
        document.getElementById('votesRightCount').textContent = v.right;
    }
});

socket.on('match_result', ({ winnerId, leftVotes, rightVotes, side }) => {
    // Reveal votes
    const ol = document.getElementById('voteOverlayLeft');
    const or = document.getElementById('voteOverlayRight');
    ol.style.display = 'flex'; or.style.display = 'flex';
    ol.textContent = leftVotes; or.textContent = rightVotes;
    
    document.getElementById('card' + (side === 'left' ? 'Left' : 'Right')).classList.add('winner-glow');
    document.getElementById('card' + (side === 'left' ? 'Right' : 'Left')).classList.add('loser-fade');
});

socket.on('leaderboard_update', (srvSeniors) => {
    const grid = document.getElementById('leaderboardGrid');
    const sorted = [...srvSeniors].sort((a, b) => {
      if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
      return b.wins - a.wins;
    });
    
    grid.innerHTML = sorted.map((s, rank) => {
        let classes = 'lb-row ';
        if (s.eliminated) classes += 'eliminated ';
        else classes += 'in-game ';
        if (rank === 0 && !s.eliminated) classes += 'champion ';
        
        let rankStr = `<div class="lb-rank">#${rank+1}</div>`;
        if(rank === 0) rankStr = `<div class="lb-rank gold">🥇</div>`;
        else if(rank === 1) rankStr = `<div class="lb-rank silver">🥈</div>`;
        else if(rank === 2) rankStr = `<div class="lb-rank bronze">🥉</div>`;
        
        return `
        <div class="${classes}">
            ${rankStr}
            <div class="lb-avatar">${s.photo ? `<img src="${s.photo}">` : s.initials}</div>
            <div class="lb-details">
                <div class="lb-name">${s.initials}</div>
                <div class="lb-hobbies">${s.hobbies || ''}</div>
            </div>
            <div class="lb-score-box">
                <div class="lb-score-val">${s.wins}</div>
                <div class="lb-score-label">WINS</div>
            </div>
            <div class="lb-status-badge ${s.eliminated ? 'eliminated' : 'in-game'}">${s.eliminated ? 'OUT' : 'ACTIVE'}</div>
        </div>`;
    }).join('');
});

socket.on('round_end', ({ round, winners, isFinal }) => {
    const overlay = document.getElementById('resultOverlay');
    
    if(isFinal) {
        document.getElementById('trophyEmoji').textContent = '👑';
        document.getElementById('resultTitle').textContent = 'We Have a Queen!';
        document.getElementById('resultSubtitle').textContent = 'The crowd goes absolutely wild! 🎉';
        launchConfetti();
    } else {
        document.getElementById('trophyEmoji').textContent = '🌸';
        document.getElementById('resultTitle').textContent = `Round ${round} Complete!`;
        document.getElementById('resultSubtitle').textContent = `${winners.length} queens advance to Round ${round + 1}`;
    }
    
    const wGrid = document.getElementById('winnersGrid');
    wGrid.innerHTML = winners.slice(0, 8).map(s => {
      return `<div class="winner-chip">
        <div class="winner-chip-avatar">${s.photo ? `<img src="${s.photo}" alt="">` : s.initials}</div>
        <div class="winner-chip-name">${s.initials}</div>
      </div>`;
    }).join('') + (winners.length > 8 ? `<div class="winner-chip"><div class="winner-chip-name">+${winners.length - 8} more</div></div>` : '');
  
    if(isAdmin && !isFinal) {
        document.getElementById('nextRoundBtn').style.display = 'inline-block';
        document.getElementById('playerWaitText').style.display = 'none';
        switchTab('leaderboard');
    } else if(!isFinal) {
        document.getElementById('nextRoundBtn').style.display = 'none';
        document.getElementById('playerWaitText').style.display = 'block';
    }
    
    overlay.classList.add('visible');
});

window.nextRound = function() {
    socket.emit('next_round', { code: roomCode });
}

function launchConfetti() {
  const colors = ['#FFB3D1','#FF5C9A','#F7C948','#FFE4EE','#FF8BB8','#C4275F'];
  const container = document.getElementById('confettiContainer');
  container.innerHTML = '';
  for (let i = 0; i < 80; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.cssText = `
      left: ${Math.random() * 100}%;
      top: -10px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      width: ${6 + Math.random() * 8}px;
      height: ${6 + Math.random() * 8}px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      animation-duration: ${2 + Math.random() * 3}s;
      animation-delay: ${Math.random() * 1.5}s;
    `;
    container.appendChild(piece);
  }
}
