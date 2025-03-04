const socket = io();
const chess = new Chess();
const boardElement = document.querySelector('.chessboard');
const gameContainer = document.createElement('div');
gameContainer.className = 'game-container';

// Create turn indicators
const topTurnIndicator = document.createElement('div');
const bottomTurnIndicator = document.createElement('div');
topTurnIndicator.className = 'turn-indicator top';
bottomTurnIndicator.className = 'turn-indicator bottom';

// Add elements to the page
document.body.appendChild(gameContainer);
gameContainer.appendChild(topTurnIndicator);
gameContainer.appendChild(boardElement);
gameContainer.appendChild(bottomTurnIndicator);

let draggedPiece = null;
let sourcesquare = null;
let playerRole = null;

const updateTurnIndicators = () => {
    const currentTurn = chess.turn();
    const isBlackTurn = currentTurn === 'b';

    topTurnIndicator.textContent = `${isBlackTurn ? "Black's" : "White's"} turn`;
    bottomTurnIndicator.textContent = `${!isBlackTurn ? "White's" : "Black's"} turn`;

    topTurnIndicator.style.display = isBlackTurn ? 'block' : 'none';
    bottomTurnIndicator.style.display = !isBlackTurn ? 'block' : 'none';

    topTurnIndicator.classList.toggle('active', isBlackTurn);
    bottomTurnIndicator.classList.toggle('active', !isBlackTurn);
};

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
                pieceElement.draggable = piece.color === playerRole && piece.color === chess.turn();

                pieceElement.addEventListener('dragstart', (e) => {
                    if (piece.color !== playerRole || piece.color !== chess.turn()) {
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
                if (!draggedPiece) return;

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
                    const result = chess.move(move);
                    if (result) {
                        console.log('Move made:', move);
                        socket.emit('move', move);
                        updateTurnIndicators();
                    }
                } else {
                    console.log('Invalid move:', move);
                }

                renderBoard();
            });

            boardElement.appendChild(squareElement);
        });
    });

    updateTurnIndicators();
};

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

// Listen for gameOver event from the server
socket.on('gameOver', (status) => {
    console.log('Game over:', status);
    showGameOverStatus(status);
});

socket.on('playerRole', (role) => {
    console.log('Received role:', role);
    playerRole = role;
    renderBoard();
});

socket.on('spectatorRole', () => {
    console.log('You are a spectator');
    playerRole = null;
    renderBoard();
});

socket.on('move', (move) => {
    console.log('Received move from server:', move);
    chess.move(move);
    renderBoard();
    updateTurnIndicators();
});

socket.on('turn', (turn) => {
    console.log('Current turn:', turn);
    updateTurnIndicators();
});

renderBoard();
