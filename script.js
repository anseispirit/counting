document.addEventListener('DOMContentLoaded', function() {
  const createBtn = document.getElementById('createAccountBtn');
  const modal = document.getElementById('modal');
  const modalClose = document.getElementById('modalClose');
  const cancelSignup = document.getElementById('cancelSignup');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const rememberCheckbox = document.getElementById('remember');

  const loginSection = document.getElementById('loginSection');
  const setupSection = document.getElementById('setupSection');
  const scoreboardSection = document.getElementById('scoreboardSection');
  const sidebar = document.getElementById('sidebar');
  const sidebarUserLabel = document.getElementById('sidebarUserLabel');
  const gameList = document.getElementById('gameList');
  const newGameBtn = document.getElementById('newGameBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const addPlayerForm = document.getElementById('addPlayerForm');
  const newPlayerName = document.getElementById('newPlayerName');
  const newPlayerScore = document.getElementById('newPlayerScore');
  const playerChips = document.getElementById('playerChips');
  const startGameBtn = document.getElementById('startGameBtn');
  const backToSetupBtn = document.getElementById('backToSetupBtn');
  const playerList = document.getElementById('playerList');
  const scoreForm = document.getElementById('scoreForm');
  const scoreInput = document.getElementById('scoreInput');
  const currentPlayerText = document.getElementById('currentPlayerText');
  const currentGameTitle = document.getElementById('currentGameTitle');

  let currentUser = null;
  let players = [];
  let currentPlayerIndex = 0;
  let currentGame = null;
  let games = [];

  function showModal() {
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function hideModal() {
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  createBtn.addEventListener('click', function(e) {
    e.preventDefault();
    showModal();
  });
  modalClose.addEventListener('click', hideModal);
  cancelSignup.addEventListener('click', hideModal);
  modal.addEventListener('click', function(e) {
    if (e.target === modal) hideModal();
  });

  async function postJson(url, body) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Unexpected error');
    }
    return data;
  }

  function saveLoginToDevice(username, password) {
    localStorage.setItem('savedLogin', JSON.stringify({ username, password }));
  }
  function clearSavedLogin() {
    localStorage.removeItem('savedLogin');
  }
  function getSavedLogin() {
    const raw = localStorage.getItem('savedLogin');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function showSection(section) {
    loginSection.classList.add('hidden');
    setupSection.classList.add('hidden');
    scoreboardSection.classList.add('hidden');
    section.classList.remove('hidden');
  }

  function renderSidebar() {
    sidebar.classList.remove('hidden');
    sidebarUserLabel.textContent = currentUser ? `Logged in as ${currentUser}` : '';
    gameList.innerHTML = games.length
      ? games.map(game => `
          <div class="game-card ${game.isActive ? 'active' : ''}" data-id="${game.id}">
            <div>
              <strong>${game.title}</strong>
              <div class="muted">${game.players.length} players · ${new Date(game.updatedAt).toLocaleString()}</div>
            </div>
            <div class="game-card-actions">
              <button class="btn-secondary resume-game" data-id="${game.id}" type="button">Resume</button>
              <button class="btn-secondary remove-game" data-id="${game.id}" type="button">Delete</button>
            </div>
          </div>
        `).join('')
      : '<p class="muted">No saved games yet.</p>';

    document.querySelectorAll('.resume-game').forEach(button => {
      button.addEventListener('click', function() {
        const gameId = this.dataset.id;
        const game = games.find(item => item.id === gameId);
        if (game) loadGame(game);
      });
    });

    document.querySelectorAll('.remove-game').forEach(button => {
      button.addEventListener('click', async function() {
        const gameId = this.dataset.id;
        const confirmed = confirm('Remove this saved game?');
        if (!confirmed) return;
        try {
          const result = await postJson('/api/delete-game', { username: currentUser, gameId });
          games = result.games || [];
          renderSidebar();
          if (currentGame && currentGame.id === gameId) {
            currentGame = null;
            resetSetup();
          }
        } catch (error) {
          alert(error.message);
        }
      });
    });
  }

  function renderPlayerChips() {
    playerChips.innerHTML = players.length
      ? players.map((player, index) => `
          <div class="player-chip">
            <div>
              <strong>${player.name}</strong>
              <div class="muted">${player.history.reduce((sum, n) => sum + Number(n), 0)} pts</div>
            </div>
            <button class="remove-player" data-index="${index}" type="button">×</button>
          </div>
        `).join('')
      : '<p class="muted">Add players one at a time on the right.</p>';

    document.querySelectorAll('.remove-player').forEach(button => {
      button.addEventListener('click', function() {
        const index = Number(this.dataset.index);
        players.splice(index, 1);
        renderPlayerChips();
      });
    });
  }

  function calculateTotal(history) {
    return history.reduce((sum, value) => sum + Number(value), 0);
  }

  function renderScoreboard() {
    playerList.innerHTML = '';
    if (!players.length) {
      playerList.innerHTML = '<p class="muted">No players in this game yet.</p>';
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'score-grid';

    players.forEach((player, index) => {
      const column = document.createElement('div');
      column.className = 'player-column' + (index === currentPlayerIndex ? ' current' : '');
      const header = document.createElement('div');
      header.className = 'player-header';
      header.textContent = player.name || 'Unnamed player';
      column.appendChild(header);

      player.history.forEach(score => {
        const entry = document.createElement('div');
        entry.className = 'score-entry';
        entry.textContent = score;
        column.appendChild(entry);
      });

      const divider = document.createElement('div');
      divider.className = 'score-divider';
      column.appendChild(divider);

      const total = document.createElement('div');
      total.className = 'score-total';
      total.textContent = `${calculateTotal(player.history)} pts`;
      column.appendChild(total);

      grid.appendChild(column);
    });

    playerList.appendChild(grid);

    const active = players[currentPlayerIndex] || null;
    currentPlayerText.textContent = active
      ? `Now enter points for ${active.name}.`
      : 'No active player.';
  }

  function resetSetup() {
    players = [];
    currentPlayerIndex = 0;
    currentGame = null;
    renderPlayerChips();
    showSection(setupSection);
  }

  function setCurrentGame(game) {
    currentGame = JSON.parse(JSON.stringify(game));
    players = currentGame.players.map(player => ({
      name: player.name,
      history: Array.isArray(player.history) ? [...player.history] : [Number(player.score) || 0]
    }));
    currentPlayerIndex = Number(currentGame.currentPlayerIndex || 0);
    renderScoreboard();
    currentGameTitle.textContent = currentGame.title || '';
    showSection(scoreboardSection);
  }

  function updateGameList(updatedGame) {
    const existing = games.findIndex(game => game.id === updatedGame.id);
    if (existing >= 0) {
      games[existing] = updatedGame;
    } else {
      games.unshift(updatedGame);
    }
    games.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    renderSidebar();
  }

  async function saveGame() {
    if (!currentUser || !currentGame) return;
    currentGame.players = players.map(player => ({
      name: player.name,
      history: player.history
    }));
    currentGame.currentPlayerIndex = currentPlayerIndex;
    currentGame.updatedAt = new Date().toISOString();
    currentGame.isActive = true;

    try {
      const result = await postJson('/api/save-game', {
        username: currentUser,
        game: currentGame
      });
      currentGame = result.game;
      updateGameList(currentGame);
    } catch (error) {
      alert(error.message);
    }
  }

  async function loadGame(game) {
    if (!game) return;
    setCurrentGame(game);
  }

  async function handleLogin(username, password, remember) {
    try {
      const result = await postJson('/api/login', { username, password });
      currentUser = result.username;
      games = result.games || [];
      if (remember) saveLoginToDevice(username, password);
      sidebar.classList.remove('hidden');
      renderSidebar();
      if (result.activeGame) {
        setCurrentGame(result.activeGame);
      } else {
        resetSetup();
      }
    } catch (error) {
      clearSavedLogin();
      alert(error.message);
      showSection(loginSection);
    }
  }

  async function handleSignup(event) {
    event.preventDefault();
    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
      alert('Passwords do not match.');
      return;
    }

    try {
      await postJson('/api/signup', { username, password });
      alert('Account created successfully. Please login.');
      signupForm.reset();
      hideModal();
    } catch (error) {
      alert(error.message);
    }
  }

  addPlayerForm.addEventListener('submit', function(event) {
    event.preventDefault();
    const name = newPlayerName.value.trim();
    const score = Number(newPlayerScore.value);

    if (!name) {
      alert('Enter a player name.');
      return;
    }
    if (Number.isNaN(score)) {
      alert('Enter a valid starting score.');
      return;
    }

    players.push({ name, history: [score] });
    newPlayerName.value = '';
    newPlayerScore.value = '0';
    renderPlayerChips();
  });

  startGameBtn.addEventListener('click', async function() {
    if (!players.length) {
      alert('Add at least one player before starting the game.');
      return;
    }

    currentPlayerIndex = 0;
    currentGame = {
      id: currentGame && currentGame.id ? currentGame.id : null,
      title: `Game ${new Date().toLocaleString()}`,
      players: players.map(player => ({ name: player.name, history: player.history })),
      currentPlayerIndex,
      createdAt: currentGame && currentGame.createdAt ? currentGame.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true
    };

    await saveGame();
    renderScoreboard();
    showSection(scoreboardSection);
  });

  scoreForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    const points = Number(scoreInput.value);
    if (Number.isNaN(points)) {
      alert('Enter a number to add.');
      return;
    }

    players[currentPlayerIndex].history.push(points);
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    await saveGame();
    renderScoreboard();
    scoreInput.value = '';
    scoreInput.focus();
  });

  backToSetupBtn.addEventListener('click', function() {
    renderPlayerChips();
    showSection(setupSection);
  });

  newGameBtn.addEventListener('click', function() {
    currentGame = null;
    resetSetup();
  });

  logoutBtn.addEventListener('click', function() {
    currentUser = null;
    games = [];
    currentGame = null;
    clearSavedLogin();
    sidebar.classList.add('hidden');
    showSection(loginSection);
  });

  loginForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const remember = rememberCheckbox.checked;
    await handleLogin(username, password, remember);
  });

  signupForm.addEventListener('submit', handleSignup);

  const savedLogin = getSavedLogin();
  if (savedLogin && savedLogin.username && savedLogin.password) {
    handleLogin(savedLogin.username, savedLogin.password, true);
  } else {
    showSection(loginSection);
  }
});
