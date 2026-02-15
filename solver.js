const COLS = 10;
const ROWS = 20;

const DEFAULT_WEIGHTS = Object.freeze({
  heightWeight: 0.810066,
  linesWeight: 0.760666,
  holesWeight: 0.35663,
  bumpinessWeight: 0.184483
});

const BASE_SHAPES = Object.freeze({
  I: [[1, 1, 1, 1]],
  O: [
    [1, 1],
    [1, 1]
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1]
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0]
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1]
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1]
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1]
  ]
});

const COLORS = Object.freeze({
  I: "#06b6d4",
  O: "#fbbf24",
  T: "#a855f7",
  S: "#22c55e",
  Z: "#ef4444",
  J: "#3b82f6",
  L: "#f97316"
});

function rotateClockwise(matrix) {
  const height = matrix.length;
  const width = matrix[0].length;
  const rotated = Array.from({ length: width }, () => Array(height).fill(0));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      rotated[x][height - 1 - y] = matrix[y][x];
    }
  }

  return rotated;
}

function trimMatrix(matrix) {
  let top = 0;
  let bottom = matrix.length - 1;
  let left = 0;
  let right = matrix[0].length - 1;

  while (top <= bottom && matrix[top].every((v) => v === 0)) {
    top += 1;
  }
  while (bottom >= top && matrix[bottom].every((v) => v === 0)) {
    bottom -= 1;
  }

  while (left <= right && matrix.every((row) => row[left] === 0)) {
    left += 1;
  }
  while (right >= left && matrix.every((row) => row[right] === 0)) {
    right -= 1;
  }

  const trimmed = [];
  for (let y = top; y <= bottom; y += 1) {
    trimmed.push(matrix[y].slice(left, right + 1));
  }

  return trimmed.length > 0 ? trimmed : [[0]];
}

function matrixKey(matrix) {
  return matrix.map((row) => row.join("")).join("|");
}

function buildRotations(shape) {
  const rotations = [];
  const seen = new Set();
  let current = trimMatrix(shape);

  for (let i = 0; i < 4; i += 1) {
    const key = matrixKey(current);
    if (!seen.has(key)) {
      seen.add(key);
      rotations.push(current);
    }
    current = trimMatrix(rotateClockwise(current));
  }

  return rotations;
}

const pieceEntries = Object.entries(BASE_SHAPES).map(([type, shape], index) => [
  type,
  {
    id: index + 1,
    color: COLORS[type],
    rotations: buildRotations(shape)
  }
]);

const PIECES = Object.freeze(Object.fromEntries(pieceEntries));

function createEmptyBoard(rows = ROWS, cols = COLS) {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
}

function cloneBoard(board) {
  return board.map((row) => row.slice());
}

function collides(board, shape, x, y) {
  for (let sy = 0; sy < shape.length; sy += 1) {
    for (let sx = 0; sx < shape[sy].length; sx += 1) {
      if (shape[sy][sx] === 0) {
        continue;
      }

      const bx = x + sx;
      const by = y + sy;

      if (bx < 0 || bx >= COLS || by >= ROWS) {
        return true;
      }

      if (by >= 0 && board[by][bx] !== 0) {
        return true;
      }
    }
  }

  return false;
}

function clearCompletedRows(board) {
  const nextBoard = board.filter((row) => row.some((cell) => cell === 0));
  const cleared = ROWS - nextBoard.length;

  while (nextBoard.length < ROWS) {
    nextBoard.unshift(Array(COLS).fill(0));
  }

  return { board: nextBoard, linesCleared: cleared };
}

function findDropY(board, shape, x) {
  let y = -shape.length;

  if (collides(board, shape, x, y)) {
    return null;
  }

  while (!collides(board, shape, x, y + 1)) {
    y += 1;
  }

  return y;
}

function applyMove(board, pieceType, rotationIndex, x) {
  const piece = PIECES[pieceType];
  if (!piece) {
    return null;
  }

  const shape = piece.rotations[rotationIndex];
  const y = findDropY(board, shape, x);
  if (y === null) {
    return null;
  }

  const next = cloneBoard(board);
  for (let sy = 0; sy < shape.length; sy += 1) {
    for (let sx = 0; sx < shape[sy].length; sx += 1) {
      if (shape[sy][sx] === 0) {
        continue;
      }
      const by = y + sy;
      const bx = x + sx;
      if (by < 0) {
        return null;
      }
      next[by][bx] = piece.id;
    }
  }

  const { board: clearedBoard, linesCleared } = clearCompletedRows(next);

  return {
    board: clearedBoard,
    linesCleared,
    x,
    finalY: y,
    rotationIndex
  };
}

function getColumnHeights(board) {
  const heights = Array(COLS).fill(0);

  for (let x = 0; x < COLS; x += 1) {
    for (let y = 0; y < ROWS; y += 1) {
      if (board[y][x] !== 0) {
        heights[x] = ROWS - y;
        break;
      }
    }
  }

  return heights;
}

function getAggregateHeight(heights) {
  return heights.reduce((sum, value) => sum + value, 0);
}

function getHoles(board) {
  let holes = 0;

  for (let x = 0; x < COLS; x += 1) {
    let started = false;
    for (let y = 0; y < ROWS; y += 1) {
      if (board[y][x] !== 0) {
        started = true;
      } else if (started) {
        holes += 1;
      }
    }
  }

  return holes;
}

function getBumpiness(heights) {
  let bumpiness = 0;
  for (let i = 0; i < heights.length - 1; i += 1) {
    bumpiness += Math.abs(heights[i] - heights[i + 1]);
  }
  return bumpiness;
}

function evaluateBoard(board, linesCleared = 0, weights = DEFAULT_WEIGHTS) {
  const heights = getColumnHeights(board);
  const aggregateHeight = getAggregateHeight(heights);
  const holes = getHoles(board);
  const bumpiness = getBumpiness(heights);

  return (
    (weights.linesWeight * linesCleared) -
    (weights.heightWeight * aggregateHeight) -
    (weights.holesWeight * holes) -
    (weights.bumpinessWeight * bumpiness)
  );
}

function generateLegalMoves(board, pieceType) {
  const piece = PIECES[pieceType];
  if (!piece) {
    return [];
  }

  const moves = [];
  for (let rotationIndex = 0; rotationIndex < piece.rotations.length; rotationIndex += 1) {
    const shape = piece.rotations[rotationIndex];
    const maxX = COLS - shape[0].length;

    for (let x = 0; x <= maxX; x += 1) {
      const move = applyMove(board, pieceType, rotationIndex, x);
      if (move !== null) {
        moves.push(move);
      }
    }
  }

  return moves;
}

class TetrisSolver {
  constructor(options = {}) {
    this.depth = Number.isFinite(options.depth) ? options.depth : 2;
    this.weights = { ...DEFAULT_WEIGHTS, ...(options.weights || {}) };
    this.setDepth(this.depth);
  }

  setDepth(depth) {
    this.depth = Math.max(1, Math.min(6, Math.floor(depth)));
  }

  bestMove(board, currentPieceType, nextPieces = []) {
    if (!PIECES[currentPieceType]) {
      return null;
    }

    const sequence = [currentPieceType, ...nextPieces.filter((type) => PIECES[type])];
    const depth = Math.min(this.depth, sequence.length);
    const best = this.search(board, sequence, depth);
    if (!best) {
      return null;
    }

    return {
      rotationIndex: best.firstMove.rotationIndex,
      x: best.firstMove.x,
      finalY: best.firstMove.finalY,
      score: best.score
    };
  }

  search(board, pieceSequence, depth) {
    const pieceType = pieceSequence[0];
    const legalMoves = generateLegalMoves(board, pieceType);
    let best = null;

    for (const move of legalMoves) {
      let score = evaluateBoard(move.board, move.linesCleared, this.weights);

      if (depth > 1 && pieceSequence.length > 1) {
        const child = this.search(move.board, pieceSequence.slice(1), depth - 1);
        if (child) {
          score += child.score;
        }
      }

      if (best === null || score > best.score) {
        best = {
          score,
          firstMove: move
        };
      }
    }

    return best;
  }
}

window.TetrisSolverLib = Object.freeze({
  COLS,
  ROWS,
  DEFAULT_WEIGHTS,
  PIECES,
  createEmptyBoard,
  cloneBoard,
  collides,
  evaluateBoard,
  generateLegalMoves,
  TetrisSolver
});
