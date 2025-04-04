// Fixed version of chessgame.js

const socket = io();
const chess = new Chess();
const boardElement = document.querySelector('.chessboard');
const gameContainer = document.createElement('div');
gameContainer.className = 'game-container';

// Create turn indicators and status message
const topTurnIndicator = document.createElement('div');
const bottomTurnIndicator = document.createElement('div');
const statusMessage = document.createElement('div');
topTurnIndicator.className = 'turn-indicator top';
bottomTurnIndicator.className = 'turn-indicator bottom';
statusMessage.className = 'status-message';

// Add elements to the page
document.body.appendChild(gameContainer);
gameContainer.appendChild(topTurnIndicator);
gameContainer.appendChild(boardElement);
gameContainer.appendChild(bottomTurnIndicator);
gameContainer.appendChild(statusMessage);

let draggedPiece = null;
let sourcesquare = null;
let playerRole = null;
let canMove = false;

// Update status message
const updateStatusMessage = (message) => {
  statusMessage.textContent = message;
  statusMessage.style.display = message ? 'block' : 'none';
};

// Update turn indicators
const updateTurnIndicators = () => {
  const currentTurn = chess.turn();
  const isBlackTurn = currentTurn === 'b';
  
  topTurnIndicator.textContent = `${isBlackTurn ? "Black's" : "White's"} turn`;
  bottomTurnIndicator.textContent = `${!isBlackTurn ? "White's" : "Black's"} turn`;
  
  topTurnIndicator.style.display = isBlackTurn ? 'block' : 'none';
  bottomTurnIndicator.style.display = !isBlackTurn ? 'block' : 'none';
  
  topTurnIndicator.classList.toggle('active', isBlackTurn);
  bottomTurnIndicator.classList.toggle('active', !isBlackTurn);
  
  // Update canMove status
  canMove = playerRole === currentTurn;
};

// Convert between algebraic notation and board coordinates
const toAlgebraic = (row, col) => {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  return files[col] + (8 - row);
};

const fromAlgebraic = (square) => {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const col = files.indexOf(square[0]);
  const row = 8 - parseInt(square[1]);
  return { row, col };
};

// Render the chess board
const renderBoard = () => {
  const board = chess.board();
  boardElement.innerHTML = "";
  
  board.forEach((row, rowIndex) => {
    row.forEach((piece, colIndex) => {
      const squareElement = document.createElement('div');
      squareElement.classList.add('square');
      squareElement.classList.add((rowIndex + colIndex) % 2 === 0 ? 'white' : 'black');
      
      // Add data attribute for square position
      const square = toAlgebraic(rowIndex, colIndex);
      squareElement.dataset.square = square;
      
      if (piece) {
        const pieceElement = document.createElement('div');
        pieceElement.classList.add('piece');
        pieceElement.classList.add(piece.color === 'w' ? 'white-piece' : 'black-piece');
        
        const pieceSymbol = piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase();
        pieceElement.innerText = getPieceUnicode(pieceSymbol);
        
        // Only allow dragging if it's the player's piece and their turn
        pieceElement.draggable = canMove && piece.color === playerRole;
        
        pieceElement.addEventListener('dragstart', (e) => {
          if (!canMove || piece.color !== playerRole) {
            e.preventDefault();
            return;
          }
          
          draggedPiece = piece;
          sourcesquare = square;
          e.target.classList.add('dragging');
          
          // Highlight valid moves
          const validMoves = chess.moves({ square: sourcesquare, verbose: true });
          validMoves.forEach(move => {
            const targetSquare = document.querySelector(`[data-square="${move.to}"]`);
            if (targetSquare) {
              targetSquare.classList.add('valid-move');
            }
          });
        });
        
        pieceElement.addEventListener('dragend', (e) => {
          e.target.classList.remove('dragging');
          
          // Remove valid move highlights
          document.querySelectorAll('.valid-move').forEach(square => {
            square.classList.remove('valid-move');
          });
          
          draggedPiece = null;
          sourcesquare = null;
        });
        
        squareElement.appendChild(pieceElement);
      }
      
      squareElement.addEventListener('dragover', (e) => e.preventDefault());
      
      squareElement.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!draggedPiece || !canMove) return;
        
        // Remove valid move highlights
        document.querySelectorAll('.valid-move').forEach(square => {
          square.classList.remove('valid-move');
        });
        
        const targetSquare = square;
        const move = {
          from: sourcesquare,
          to: targetSquare,
          promotion: 'q' // Auto-promote to queen for simplicity
        };
        
        // Check if move is legal
        const validMoves = chess.moves({ verbose: true });
        const isValidMove = validMoves.some(validMove => 
          validMove.from === move.from && validMove.to === move.to
        );
        
        if (isValidMove) {
          // Make the move locally
          const result = chess.move(move);
          
          if (result) {
            console.log('Move made:', move);
            // Send move to server
            socket.emit('move', move);
            updateTurnIndicators();
          }
        } else {
          console.log('Invalid move:', move);
        }
        
        renderBoard();
      });
      
      // Add click handler for mobile support
      squareElement.addEventListener('click', (e) => {
        if (!canMove) return;
        
        // If no piece is selected yet and this square has a piece of the player's color
        if (!sourcesquare && piece && piece.color === playerRole) {
          sourcesquare = square;
          draggedPiece = piece;
          squareElement.classList.add('selected');
          
          // Highlight valid moves
          const validMoves = chess.moves({ square: sourcesquare, verbose: true });
          validMoves.forEach(move => {
            const targetSquare = document.querySelector(`[data-square="${move.to}"]`);
            if (targetSquare) {
              targetSquare.classList.add('valid-move');
            }
          });
        } 
        // If a piece is already selected
        else if (sourcesquare) {
          // Remove previous highlights
          document.querySelectorAll('.selected, .valid-move').forEach(el => {
            el.classList.remove('selected', 'valid-move');
          });
          
          // If clicking on a different square, try to move
          if (sourcesquare !== square) {
            const move = {
              from: sourcesquare,
              to: square,
              promotion: 'q' // Auto-promote to queen for simplicity
            };
            
            // Check if move is legal
            const validMoves = chess.moves({ verbose: true });
            const isValidMove = validMoves.some(validMove => 
              validMove.from === move.from && validMove.to === move.to
            );
            
            if (isValidMove) {
              // Make the move locally
              const result = chess.move(move);
              
              if (result) {
                console.log('Move made:', move);
                // Send move to server
                socket.emit('move', move);
                updateTurnIndicators();
              }
            } else {
              console.log('Invalid move:', move);
            }
            
            renderBoard();
          }
          
          // Reset selection
          sourcesquare = null;
          draggedPiece = null;
        }
      });
      
      boardElement.appendChild(squareElement);
    });
  });
  
  updateTurnIndicators();
};

// Get Unicode character for chess pieces
const getPieceUnicode = (piece) => {
  const pieces = {
    'P': '♙', 'N': '♘', 'B': '♗', 'R': '♖', 'Q': '♕', 'K': '♔',
    'p': '♟', 'n': '♞', 'b': '♝', 'r': '♜', 'q': '♛', 'k': '♚'
  };
  return pieces[piece] || "";
};

// Function to display game-over status
const showGameOverStatus = (status) => {
  const gameStatus = document.createElement('div');
  gameStatus.className = 'game-status';
  
  if (status.reason === 'checkmate') {
    gameStatus.textContent = `Game Over: ${status.winner} wins by Checkmate!`;
    gameStatus.classList.add('checkmate');
  } else if (status.reason === 'draw') {
    gameStatus.textContent = `Game Over: It's a draw (${status.cause})`;
    gameStatus.classList.add('draw');
  }
  
  document.body.appendChild(gameStatus);
  gameStatus.style.display = 'block';
  
  setTimeout(() => {
    gameStatus.style.opacity = '0';
    setTimeout(() => document.body.removeChild(gameStatus), 3000);
  }, 5000); // Keep the message visible for 5 seconds
};

// Socket.IO event handlers
socket.on('connect', () => {
  console.log('Connected to server');
  updateStatusMessage('Connected to server. Waiting for opponent...');
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  updateStatusMessage('Connection error. Please refresh the page.');
});

socket.on('playerRole', (role) => {
  console.log('Received role:', role);
  playerRole = role;
  updateStatusMessage(role === 'w' ? 'You are playing as White' : 'You are playing as Black');
  renderBoard();
});

socket.on('spectatorRole', () => {
  console.log('You are a spectator');
  playerRole = null;
  updateStatusMessage('You are a spectator. Game is in progress.');
  renderBoard();
});

socket.on('playersUpdate', (players) => {
  console.log('Players update:', players);
  if (players.white && players.black) {
    updateStatusMessage('Game in progress');
  } else if (players.white) {
    updateStatusMessage('Waiting for Black player to join...');
  } else if (players.black) {
    updateStatusMessage('Waiting for White player to join...');
  } else {
    updateStatusMessage('Waiting for players to join...');
  }
});

socket.on('move', (move) => {
  console.log('Received move from server:', move);
  chess.move(move);
  renderBoard();
});

socket.on('gameState', (fen) => {
  console.log('Received game state:', fen);
  chess.load(fen);
  renderBoard();
});

socket.on('turn', (turn) => {
  console.log('Current turn:', turn);
  updateTurnIndicators();
});

socket.on('invalidMove', (move) => {
  console.log('Invalid move:', move);
  updateStatusMessage('Invalid move. Please try again.');
  setTimeout(() => updateStatusMessage(''), 2000);
});

socket.on('gameOver', (status) => {
  console.log('Game over:', status);
  showGameOverStatus(status);
});

socket.on('gameReset', () => {
  console.log('Game reset');
  chess.reset();
  renderBoard();
  updateStatusMessage('Game has been reset');
});

socket.on('error', (message) => {
  console.error('Server error:', message);
  updateStatusMessage(`Error: ${message}`);
});

// Add reset button
const resetButton = document.createElement('button');
resetButton.textContent = 'Reset Game';
resetButton.className = 'reset-button';
resetButton.addEventListener('click', () => {
  socket.emit('resetGame');
});
gameContainer.appendChild(resetButton);

// Initial render
renderBoard();
