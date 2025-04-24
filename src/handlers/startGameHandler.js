const { Player } = require('../models/player.js');
const { roles } = require('../utils/roles.js');

const randInt = (limit) => {
  return Math.ceil(Math.random() * 1000) % limit;
};

const shuffle = (list) => {
  // const shuffleLimit = Math.max(20, list.length);
  const shuffleLimit = 50;
  for (let index = 0; index < shuffleLimit; index++) {
    const position = randInt(list.length);
    const item = list[position];
    list.splice(position, 1);
    list.unshift(item);
  }
  return list;
};

const initialStats = (games) => (req, res) => {
  const { gameId, username, lobbyId } = req.session;
  if (lobbyId) {
    delete req.session.lobbyId;
  }

  const game = games.findGame(gameId);
  const players = game.getInitialStats(username);

  res.json({ players, user: { username } });
};

const canGameStart = (lobby, username) => {
  return lobby && lobby.canLobbyClose(username);
};

const initializeGame = (lobby, lobbyId, games) => {
  const joinees = lobby.getJoinees();
  const players = joinees.map(joinee => new Player(joinee.username));
  return games.addGame(lobbyId, players);
};

const startGameHandler = (games, persistLobbies, persistGames) =>
  (req, res) => {
    const { lobby, lobbyId, username } = req.session;
    if (!canGameStart(lobby, username)) {
      res.json({ isStarted: false });
      return;
    }

    const game = initializeGame(lobby, lobbyId, games);
    lobby.closeLobby(username);

    // const initialPositions = [
    //   13, 26, 29, 91, 117, 34, 50, 53, 94, 103,
    //   112, 123, 138, 141, 155, 174
    // ];

    const initialPositions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
     21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 
     41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 
     61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 
     81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 
     101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 
     121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 
     141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 
     161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 
     181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200];
    const shuffledPositions = shuffle(initialPositions);

    game.assignRoles(roles, shuffle);
    game.assignInitialPositions(shuffledPositions);
    game.changeGameStatus();

    persistLobbies(lobbyId, () => {
      persistGames(lobbyId, () => res.json({ isStarted: true }));
    });
  };

module.exports = { startGameHandler, initialStats };
