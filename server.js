const path = require('path');
const fs = require('fs').promises;
const express = require('express');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;
const dataFile = path.join(__dirname, 'accounts.json');

app.use(express.json());
app.use(express.static(path.join(__dirname)));

function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function readAccounts() {
  try {
    const content = await fs.readFile(dataFile, 'utf8');
    return JSON.parse(content || '[]');
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeAccounts(accounts) {
  await fs.writeFile(dataFile, JSON.stringify(accounts, null, 2), 'utf8');
}

function ensureAccountGames(account) {
  if (!Array.isArray(account.games)) {
    account.games = [];
  }
  return account.games;
}

app.post('/api/signup', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const accounts = await readAccounts();
  const normalizedUsername = normalizeUsername(username);

  if (accounts.some(account => account.username === normalizedUsername)) {
    return res.status(409).json({ error: 'Username already taken.' });
  }

  accounts.push({
    username: normalizedUsername,
    password: hashPassword(password),
    games: []
  });

  await writeAccounts(accounts);
  res.status(201).json({ message: 'Account created successfully.' });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const accounts = await readAccounts();
  const normalizedUsername = normalizeUsername(username);
  const hashed = hashPassword(password);
  const account = accounts.find(acc => acc.username === normalizedUsername);

  if (!account || account.password !== hashed) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  ensureAccountGames(account);
  const activeGame = account.games.find(game => game.isActive) || null;
  res.json({
    message: 'Login successful.',
    username: account.username,
    games: account.games,
    activeGame
  });
});

app.post('/api/save-game', async (req, res) => {
  const { username, game } = req.body;
  if (!username || !game || !Array.isArray(game.players)) {
    return res.status(400).json({ error: 'Username and game data are required.' });
  }

  const accounts = await readAccounts();
  const normalizedUsername = normalizeUsername(username);
  const account = accounts.find(acc => acc.username === normalizedUsername);
  if (!account) {
    return res.status(404).json({ error: 'Account not found.' });
  }

  ensureAccountGames(account);
  const games = account.games;
  const gameId = game.id || crypto.randomUUID();
  const savedGame = {
    id: gameId,
    title: game.title || `Game ${new Date().toLocaleString()}`,
    players: game.players.map(player => ({
      name: player.name,
      history: Array.isArray(player.history) ? player.history.map(Number) : [Number(player.score) || 0]
    })),
    currentPlayerIndex: Number(game.currentPlayerIndex || 0),
    createdAt: game.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: true
  };

  account.games = games.map(g => ({ ...g, isActive: false }));
  const existingIndex = account.games.findIndex(g => g.id === gameId);
  if (existingIndex >= 0) {
    account.games[existingIndex] = savedGame;
  } else {
    account.games.push(savedGame);
  }

  await writeAccounts(accounts);
  res.json({ game: savedGame });
});

app.post('/api/delete-game', async (req, res) => {
  const { username, gameId } = req.body;
  if (!username || !gameId) {
    return res.status(400).json({ error: 'Username and gameId are required.' });
  }

  const accounts = await readAccounts();
  const normalizedUsername = normalizeUsername(username);
  const account = accounts.find(acc => acc.username === normalizedUsername);
  if (!account) {
    return res.status(404).json({ error: 'Account not found.' });
  }

  ensureAccountGames(account);
  account.games = account.games.filter(game => game.id !== gameId);
  await writeAccounts(accounts);
  res.json({ games: account.games });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
