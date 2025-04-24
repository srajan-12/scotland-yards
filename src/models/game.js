const { Player } = require('./player.js');
const { mrX } = require('../utils/roles.js');

const createEmptyStop = () => {
  return {
    taxies: [],
    buses: [],
    subways: [],
    ferries: []
  };
};

const detectivesWinStatusLookup = (role) => {
  const status = {
    'Detective Red': 2,
    'Detective Green': 3,
    'Detective Purple': 4,
    'Detective Blue': 5,
    'Detective Orange': 6
  };
  return status[role];
};

const isMrXStranded = strandedPlayers => {
  return strandedPlayers.some(player => player.role === mrX);
};

const areDetectivesStranded = (detectives, strandedPlayers) => {
  const strandedDetectives = strandedPlayers.filter(
    ({ role }) => role.includes('Detective')
  ).map(({ username }) => username);

  return detectives.every(({ username }) => {
    return strandedDetectives.includes(username);
  });
};

const areDetectivesOutOfTickets = detectives => {
  return detectives.every(({ tickets }) => {
    const allTickets = Object.values(tickets);
    const ticketSum = allTickets.reduce((a, b) => a + b);
    return ticketSum <= 0;
  });
};

const isStranded = validStops => {
  const stops = Object.values(validStops).flat();
  return stops.length <= 0;
};

class Game {
  #gameId;
  #players;
  #stops;
  #limit;
  #currentPlayerIndex;
  #round;
  #gameOver;
  #winningStatus;
  #twoXTakenAt;
  #leftPlayers;

  constructor(gameId, stops = {}, players = []) {
    this.#gameId = gameId;
    this.#players = players;
    this.#stops = stops;
    this.#limit = { min: 3, max: 6 };
    this.#round = 0;
    this.#gameOver = false;
    this.#winningStatus = null;
    this.#twoXTakenAt = null;
    this.#leftPlayers = [];
  }

  init({ players, currentPlayerIndex, round, gameOver, winningStatus, twoXTakenAt, leftPlayers }) {
    this.#currentPlayerIndex = currentPlayerIndex;
    this.#round = round;
    this.#gameOver = gameOver;
    this.#winningStatus = winningStatus;
    this.#twoXTakenAt = twoXTakenAt;
    this.#players = [];
    this.#leftPlayers = leftPlayers;

    players.forEach(({ username, ...playerData }) => {
      const player = new Player(username);
      player.init(playerData);
      this.#players.push(player);
    });
  }

  addPlayer(player) {
    this.#players.push(player);
  }

  isMrX(username) {
    const player = this.findPlayer(username);
    return player.isMrX();
  }

  mrXLog() {
    const mrX = this.#players.find(player => player.isMrX());
    return mrX.log;
  }

  isCurrentPlayer(username) {
    const currentPlayer = this.#players[this.#currentPlayerIndex];
    return currentPlayer.isSamePlayer(username);
  }

  getPlayers() {
    return this.#players.map(player => player.info);
  }

  findPlayer(username) {
    return this.#players.find((player) => player.isSamePlayer(username));
  }

  changeGameStatus() {
    this.#currentPlayerIndex = 0;
  }

  changeCurrentPlayer() {
    if (this.#gameOver) {
      this.#setGameOverStatus();
      return;
    }

    this.#currentPlayerIndex =
      (this.#currentPlayerIndex + 1) % this.#players.length;
    if (!this.isPlayerActive(this.currentPlayer.username)) {
      this.#setGameOverStatus();
      this.changeCurrentPlayer();
    }
    this.#setGameOverStatus();
  }

  canGameStart() {
    return this.#players.length >= this.#limit.min;
  }

  isGameFull() {
    return this.#players.length >= this.#limit.max;
  }

  #updateRound() {
    const currentPlayer = this.#players[this.#currentPlayerIndex];
    if (currentPlayer.info.role === mrX) {
      this.#round += 1;
    }
  }

  getMrXPlayer() {
    return this.#players.find(player => player.isMrX());
  }
 
  transferTicketToMrX(ticket) {
    // Only transfer tickets when a detective makes a move
    // Don't transfer when Mr. X moves
    // Don't transfer when using 2x card
    if (ticket === 'twoX') {
      return;
    }
    
    // Skip if current player is Mr. X
    const currentPlayer = this.#players[this.#currentPlayerIndex];
    if (currentPlayer.isMrX()) {
      return;
    }
 
    // Transfer the ticket to Mr. X
    const mrX = this.getMrXPlayer();
    mrX.addTicket(ticket);
  }
  
  playMove(destination, ticket) {
    const currentPlayer = this.#players[this.#currentPlayerIndex];
    currentPlayer.updatePosition(destination);
    currentPlayer.updateLog(ticket);
    currentPlayer.reduceTicket(ticket);
    this.transferTicketToMrX(ticket);

    this.#updateRound();

    if (!this.isTwoXInAction()) {
      this.changeCurrentPlayer();
    }
  }

  assignRoles(roles, shuffler = (x) => x) {
    // this.#players = shuffler(this.#players);

    this.#players.forEach((player, index) => {
      player.assignRole(roles[index]);
    });
  }

  assignInitialPositions(initialPositions) {
    this.#players.forEach((player, index) => {
      player.updatePosition(initialPositions[index]);
    });
  }

  #stopsOccupiedByDetectives() {
    const occupiedStops = [];
    this.getPlayers().forEach(player => {
      if (player.role === mrX) {
        return;
      }
      occupiedStops.push(player.currentPosition);
    });
    return occupiedStops;
  }

  #isStopOccupiedByDetective(stop) {
    return this.#stopsOccupiedByDetectives().includes(stop);
  }

  getValidStops(username) {
    const requestedPlayer = this.findPlayer(username);
    const connectedStop = this.#stops[requestedPlayer.info.currentPosition];
    const validStops = createEmptyStop();
    const routes = Object.keys(connectedStop);

    routes.forEach(route => {
      const availableStops = connectedStop[route].filter(x => {
        return !this.#isStopOccupiedByDetective(x);
      });
      validStops[route] = [];
      const isTicketAvailable = requestedPlayer.isTicketAvailable(route);
      const notHideLast = requestedPlayer.notHideLast(route);

      if (isTicketAvailable && notHideLast) {
        validStops[route] = availableStops;
      }
    });
    return validStops;
  }

  isMovePossible(username, position) {
    const stops = this.getValidStops(username);
    const allStops = Object.values(stops).flat();
    return allStops.includes(position);
  }

  addToInactive(username) {
    const player = this.findPlayer(username);
    this.#leftPlayers.push(player.info);

    if (this.isCurrentPlayer(username)) {
      this.changeCurrentPlayer();
    }

    if (player.isMrX()) {
      this.setGameOver(7);
      return;
    }

    if (this.haveAllDetectivesLeft()) {
      this.setGameOver(11);
    }
  }

  #getStrandedPlayers() {
    const strandedPlayers = [];

    this.getPlayers().forEach(player => {
      const validStops = this.getValidStops(player.username);
      if (isStranded(validStops)) {
        strandedPlayers.push({
          role: player.role,
          username: player.username
        });
      }
    });

    return strandedPlayers;
  }

  #getMrXLocation() {
    const mrXLocation = this.getPlayers().find(player => player.role === mrX);
    return mrXLocation.currentPosition;
  }

  #isRoundOver() {
    return this.#currentPlayerIndex === 0;
  }

  #getDetectives() {
    return this.getPlayers().filter(player => {
      return player.role.includes('Detective');
    });
  }

  #setDetectiveWinStatus() {
    const mrXLocation = this.#getMrXLocation();
    const detectives = this.#getDetectives();

    const winningDetective = detectives.find(({ currentPosition }) => {
      return currentPosition === mrXLocation;
    });
    this.#winningStatus = detectivesWinStatusLookup(winningDetective.role);
  }

  #setDetectivesWinStatus() {
    if (isMrXStranded(this.#getStrandedPlayers())) {
      this.#gameOver = true;
      this.#winningStatus = 1;
    }
  }

  #setMrXWinStatus() {
    const detectives = this.#getDetectives();
    if (areDetectivesStranded(detectives, this.#getStrandedPlayers())) {
      this.#gameOver = true;
      this.#winningStatus = 8;
    }

    if (areDetectivesOutOfTickets(detectives)) {
      this.#gameOver = true;
      this.#winningStatus = 9;
    }
  }

  #setLastRoundWinStatus() {
    if (this.#round >= 24) {
      this.#gameOver = true;
      this.#winningStatus = 10;
    }

    const mrXLocation = this.#getMrXLocation();
    if (this.#isStopOccupiedByDetective(mrXLocation)) {
      this.#gameOver = true;
      this.#setDetectiveWinStatus();
    }
  }

  #setGameOverStatus() {
    if (!this.#isRoundOver()) {
      return;
    }

    this.#setMrXWinStatus();
    this.#setDetectivesWinStatus();
    this.#setLastRoundWinStatus();
  }

  get gameId() {
    return this.#gameId;
  }

  get currentPlayer() {
    return this.#players[this.#currentPlayerIndex].info;
  }

  get playerCount() {
    return this.#players.length;
  }

  setGameOver(statusCode) {
    this.#gameOver = true;
    this.#winningStatus = statusCode;
  }

  haveAllDetectivesLeft() {
    const status = this.#getDetectives().length === this.#leftPlayers.length;
    return this.#gameOver ? false : status;
  }

  isRevelationRound() {
    const revelationRounds = [3, 8, 13, 18, 24];
    return revelationRounds.includes(this.#round);
  }

  isTwoXAvailable() {
    if (this.#twoXTakenAt === null) {
      return true;
    }

    const currentPlayer = this.#players[this.#currentPlayerIndex];
    if (!currentPlayer.isMrX()) {
      return false;
    }

    if (!currentPlayer.isTicketAvailable('twoX')) {
      return false;
    }

    const roundsAfterTwoX = this.#round - this.#twoXTakenAt;
    return roundsAfterTwoX > 2;
  }

  enableTwoX(round) {
    this.#twoXTakenAt = round;
    const currentPlayer = this.#players[this.#currentPlayerIndex];
    currentPlayer.reduceTicket('twoX');
  }

  isTwoXInAction() {
    if (this.#twoXTakenAt === null) {
      return false;
    }
    const roundsAfterTwoX = this.#round - this.#twoXTakenAt;
    return roundsAfterTwoX === 1;
  }

  isMyPlayer(username) {
    if (this.#gameOver) {
      return false;
    }

    return this.#players.some(player => player.isSamePlayer(username));
  }

  isPlayerActive(username) {
    if (!this.isMyPlayer(username)) {
      return false;
    }
    return !this.hasPlayerLeft(username);
  }

  getInitialStats(username) {
    const currentPlayer = this.findPlayer(username);
    const players = this.getPlayers();

    if (currentPlayer.isMrX()) {
      return players;
    }

    players.forEach(player => {
      if (player.role === 'Mr. X') {
        player.currentPosition = '###';
      }
    });

    return players;
  }

  hasPlayerLeft(username) {
    return this.#leftPlayers.some((player) => {
      return player.username === username;
    });
  }

  getState() {
    const gameData = {};
    gameData.players = this.getPlayers();
    gameData.gameId = this.#gameId;
    gameData.currentPlayerIndex = this.#currentPlayerIndex;
    gameData.round = this.#round;
    gameData.strandedPlayers = this.#round > 0
      ? this.#getStrandedPlayers() : [];
    gameData.gameOver = this.#gameOver;
    gameData.winningStatus = this.#winningStatus;
    gameData.twoXTakenAt = this.#twoXTakenAt;
    gameData.leftPlayers = this.#leftPlayers;
    return gameData;
  }
}

module.exports = { Game };
