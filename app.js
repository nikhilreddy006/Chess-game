const express = require('express');
const socket = require('socket.io');
const http = require('http');
const { Chess } = require('chess.js');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socket(server);

const chess = new Chess();
let players = {}; // Tracks players

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

    // Assign roles to players
    if (!players.white) {
        players.white = uniquesocket.id;
        uniquesocket.emit('playerRole', 'w'); // Assign white role
        io.emit('turn', 'w'); // Notify everyone it's white's turn
    } else if (!players.black) {
        players.black = uniquesocket.id;
        uniquesocket.emit('playerRole', 'b'); // Assign black role
    } else {
        uniquesocket.emit('spectatorRole'); // Assign spectator role if game is full
    }

    // Handle player disconnection
    uniquesocket.on("disconnect", function () {
        console.log(`User disconnected: ${uniquesocket.id}`);
        if (players.white === uniquesocket.id) {
            delete players.white;
            io.emit('turn', 'b'); // Switch turn to black if white leaves
        }
        if (players.black === uniquesocket.id) {
            delete players.black;
            io.emit('turn', 'w'); // Switch turn to white if black leaves
        }
    });

    // Handle move events
    uniquesocket.on('move', function (move) {
        try {
            // Allow moves only if it is the player's turn
            if (chess.turn() === 'w' && uniquesocket.id !== players.white) return;
            if (chess.turn() === 'b' && uniquesocket.id !== players.black) return;

            const result = chess.move(move);
            if (result) {
                io.emit('move', move); // Broadcast the move to all clients
                
                // Check for game end conditions
                if (chess.isCheckmate()) {
                    io.emit('gameOver', { 
                        winner: chess.turn() === 'w' ? 'black' : 'white',
                        reason: 'checkmate'
                    });
                } else if (chess.isDraw()) {
                    io.emit('gameOver', { 
                        reason: 'draw',
                        cause: chess.isStalemate() ? 'stalemate' : 
                               chess.isThreefoldRepetition() ? 'repetition' : 
                               chess.isInsufficientMaterial() ? 'insufficient material' : 'fifty-move rule'
                    });
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
            io.emit('turn', 'w');
        }
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, function () {
    console.log(`Server is running on port ${PORT}`);
});