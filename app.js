
const express = require('express');
const socket = require('socket.io');
const http = require('http');
const { Chess } = require('chess.js');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socket(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Create a new chess game instance
const chess = new Chess();

// Track players and game state
let players = {}; // Tracks players
let gameInProgress = false;

// Set up Express middleware and static files
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

// Render the homepage
app.get('/', (req, res) => {
  res.render('index', { title: 'Chess Game' });
});

// Socket.io Connection Handling
io.on("connection", (uniquesocket) => {
  console.log("New user connected:", uniquesocket.id);
  
  // Send current game state to new connections
  uniquesocket.emit('gameState', chess.fen());
  
  // Assign roles to players
  if (!players.white) {
    players.white = uniquesocket.id;
    uniquesocket.emit('playerRole', 'w'); // Assign white role
    io.emit('turn', 'w'); // Notify everyone it's white's turn
    console.log("White player assigned:", uniquesocket.id);
  } else if (!players.black) {
    players.black = uniquesocket.id;
    uniquesocket.emit('playerRole', 'b'); // Assign black role
    console.log("Black player assigned:", uniquesocket.id);
    gameInProgress = true;
  } else {
    uniquesocket.emit('spectatorRole'); // Assign spectator role if game is full
    console.log("Spectator assigned:", uniquesocket.id);
  }
  
  // Notify all clients about current players
  io.emit('playersUpdate', {
    white: players.white ? true : false,
    black: players.black ? true : false
  });

  // Handle player disconnection
  uniquesocket.on("disconnect", function () {
    console.log(`User disconnected: ${uniquesocket.id}`);
    
    let roleChanged = false;
    
    if (players.white === uniquesocket.id) {
      delete players.white;
      roleChanged = true;
      console.log("White player disconnected");
    }
    
    if (players.black === uniquesocket.id) {
      delete players.black;
      roleChanged = true;
      console.log("Black player disconnected");
    }
    
    if (roleChanged) {
      // Notify all clients about player changes
      io.emit('playersUpdate', {
        white: players.white ? true : false,
        black: players.black ? true : false
      });
      
      // If game was in progress, reset it when a player leaves
      if (gameInProgress) {
        chess.reset();
        io.emit('gameReset');
        io.emit('turn', 'w');
        gameInProgress = false;
      }
    }
  });

  // Handle move events
  uniquesocket.on('move', function (move) {
    try {
      // Allow moves only if it is the player's turn
      if (chess.turn() === 'w' && uniquesocket.id !== players.white) {
        uniquesocket.emit('invalidMove', move);
        return;
      }
      
      if (chess.turn() === 'b' && uniquesocket.id !== players.black) {
        uniquesocket.emit('invalidMove', move);
        return;
      }
      
      // Make the move
      const result = chess.move(move);
      
      if (result) {
        // Broadcast the move and updated FEN to all clients
        io.emit('move', move);
        io.emit('gameState', chess.fen());
        
        // Emit turn change
        io.emit('turn', chess.turn());
        
        // Check for game end conditions
        if (chess.isCheckmate()) {
          io.emit('gameOver', { 
            winner: chess.turn() === 'w' ? 'black' : 'white', 
            reason: 'checkmate' 
          });
          gameInProgress = false;
        } else if (chess.isDraw()) {
          io.emit('gameOver', { 
            reason: 'draw', 
            cause: chess.isStalemate() ? 'stalemate' : 
                  chess.isThreefoldRepetition() ? 'repetition' : 
                  chess.isInsufficientMaterial() ? 'insufficient material' : 
                  'fifty-move rule' 
          });
          gameInProgress = false;
        }
      } else {
        uniquesocket.emit('invalidMove', move); // Notify the player of an invalid move
      }
    } catch (error) {
      console.error('Error handling move:', error);
      uniquesocket.emit('error', 'An error occurred while processing your move.');
    }
  });

  // Handle game reset request
  uniquesocket.on('resetGame', function() {
    if (uniquesocket.id === players.white || uniquesocket.id === players.black) {
      chess.reset();
      io.emit('gameReset');
      io.emit('gameState', chess.fen());
      io.emit('turn', 'w');
      gameInProgress = players.white && players.black;
    }
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, function () {
  console.log(`Server is running on port ${PORT}`);
});
