(function () {
const solverLib = window.TetrisSolverLib;
if (!solverLib) {
  throw new Error("TetrisSolverLib is unavailable. Make sure solver.js loads before game.js.");
}

const {
  COLS,
  ROWS,
  PIECES,
  collides,
  createEmptyBoard,
  TetrisSolver
} = solverLib;

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const BLOCK_SIZE = Math.floor(canvas.width / COLS);

const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const statusEl = document.getElementById("status");
const depthEl = document.getElementById("depth");

const autoBtn = document.getElementById("autoBtn");
const restartBtn = document.getElementById("restartBtn");

const PIECE_TYPES = Object.keys(PIECES);
const ID_TO_COLOR = {};
for (const piece of Object.values(PIECES)) {
  ID_TO_COLOR[piece.id] = piece.color;
}

const LINE_SCORE = [0, 100, 300, 500, 800];
const initialDepth = depthEl ? (Number(depthEl.value) || 2) : 2;
const solver = new TetrisSolver({ depth: initialDepth });
const AUTO_MIN_ANIM_MS = 170;
const AUTO_MAX_ANIM_MS = 320;

const state = {
  board: createEmptyBoard(),
  current: null,
  queue: [],
  bag: [],
  score: 0,
  lines: 0,
  level: 1,
  dropTimer: 0,
  dropInterval: 800,
  auto: true,
  autoTimer: 0,
  autoInterval: 350,
  autoAnimation: null,
  gameOver: false
};

if (autoBtn) {
  autoBtn.textContent = state.auto ? "Disable Auto" : "Enable Auto";
}

function shuffle(values) {
  const result = values.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function refillBagIfNeeded() {
  if (state.bag.length === 0) {
    state.bag = shuffle(PIECE_TYPES);
  }
}

function drawFromBag() {
  refillBagIfNeeded();
  return state.bag.pop();
}

function fillQueue(minSize = 5) {
  while (state.queue.length < minSize) {
    state.queue.push(drawFromBag());
  }
}

function getCurrentShape() {
  if (!state.current) {
    return null;
  }
  return PIECES[state.current.type].rotations[state.current.rotationIndex];
}

function getShape(type, rotationIndex) {
  return PIECES[type].rotations[rotationIndex];
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function lerp(start, end, t) {
  return start + ((end - start) * t);
}

function easeInOutCubic(t) {
  if (t < 0.5) {
    return 4 * t * t * t;
  }
  const f = ((2 * t) - 2);
  return 0.5 * f * f * f + 1;
}

function getRotationSequence(currentRotation, targetRotation, totalRotations) {
  const cwSteps = (targetRotation - currentRotation + totalRotations) % totalRotations;
  const ccwSteps = (currentRotation - targetRotation + totalRotations) % totalRotations;
  const stepCount = Math.min(cwSteps, ccwSteps);
  const direction = cwSteps <= ccwSteps ? 1 : -1;
  const sequence = [currentRotation];

  for (let i = 1; i <= stepCount; i += 1) {
    sequence.push((currentRotation + (direction * i) + totalRotations) % totalRotations);
  }

  return sequence;
}

function createAutoAnimation(bestMove) {
  if (!state.current) {
    return null;
  }

  const rotations = PIECES[state.current.type].rotations.length;
  const duration = Math.max(
    AUTO_MIN_ANIM_MS,
    Math.min(AUTO_MAX_ANIM_MS, Math.floor(state.autoInterval * 0.9))
  );

  return {
    startX: state.current.x,
    startY: state.current.y,
    endX: bestMove.x,
    endY: bestMove.finalY,
    endRotationIndex: bestMove.rotationIndex,
    rotationSequence: getRotationSequence(
      state.current.rotationIndex,
      bestMove.rotationIndex,
      rotations
    ),
    elapsed: 0,
    duration
  };
}

function getAnimatedPiecePose(animation) {
  const progress = clamp01(animation.elapsed / animation.duration);
  const eased = easeInOutCubic(progress);

  const rotationPhaseEnd = animation.rotationSequence.length > 1 ? 0.3 : 0;
  const shiftPhaseStart = rotationPhaseEnd;
  const shiftPhaseEnd = 0.7;
  const dropPhaseStart = shiftPhaseEnd;

  let rotationIndex = animation.endRotationIndex;
  let x = animation.startX;
  let y = animation.startY;

  if (rotationPhaseEnd > 0 && eased < rotationPhaseEnd) {
    const rotationProgress = clamp01(eased / rotationPhaseEnd);
    const idx = Math.min(
      animation.rotationSequence.length - 1,
      Math.floor(rotationProgress * animation.rotationSequence.length)
    );
    rotationIndex = animation.rotationSequence[idx];
  }

  if (eased < shiftPhaseEnd) {
    const shiftProgress = eased <= shiftPhaseStart
      ? 0
      : clamp01((eased - shiftPhaseStart) / (shiftPhaseEnd - shiftPhaseStart));
    x = lerp(animation.startX, animation.endX, easeInOutCubic(shiftProgress));
    y = animation.startY;
  } else {
    x = animation.endX;
    const dropProgress = clamp01((eased - dropPhaseStart) / (1 - dropPhaseStart));
    y = lerp(animation.startY, animation.endY, easeInOutCubic(dropProgress));
  }

  return { x, y, rotationIndex };
}

function advanceAutoAnimation(delta) {
  if (!state.autoAnimation || !state.current) {
    return;
  }

  state.autoAnimation.elapsed += delta;
  if (state.autoAnimation.elapsed < state.autoAnimation.duration) {
    return;
  }

  state.current.rotationIndex = state.autoAnimation.endRotationIndex;
  state.current.x = state.autoAnimation.endX;
  state.current.y = state.autoAnimation.endY;
  state.autoAnimation = null;

  if (collides(state.board, getCurrentShape(), state.current.x, state.current.y)) {
    setGameOver();
    return;
  }

  lockPiece();
}

function setGameOver() {
  state.gameOver = true;
  state.current = null;
  state.autoAnimation = null;
}

function spawnPiece() {
  const type = state.queue.shift() || drawFromBag();
  fillQueue();

  const rotationIndex = 0;
  const shape = PIECES[type].rotations[rotationIndex];
  const x = Math.floor((COLS - shape[0].length) / 2);
  const y = -shape.length;

  state.current = { type, rotationIndex, x, y };
}

function clearLines() {
  let cleared = 0;
  const nextBoard = [];

  for (let y = 0; y < ROWS; y += 1) {
    const row = state.board[y];
    if (row.every((cell) => cell !== 0)) {
      cleared += 1;
    } else {
      nextBoard.push(row);
    }
  }

  while (nextBoard.length < ROWS) {
    nextBoard.unshift(Array(COLS).fill(0));
  }

  state.board = nextBoard;
  return cleared;
}

function updateScoring(clearedLines) {
  if (clearedLines <= 0) {
    return;
  }
  state.score += LINE_SCORE[clearedLines] * state.level;
  state.lines += clearedLines;
  state.level = 1 + Math.floor(state.lines / 10);
  state.dropInterval = Math.max(100, 800 - (state.level - 1) * 60);
}

function lockPiece() {
  const shape = getCurrentShape();
  if (!shape || !state.current) {
    return;
  }

  const pieceId = PIECES[state.current.type].id;
  const cells = [];

  for (let sy = 0; sy < shape.length; sy += 1) {
    for (let sx = 0; sx < shape[sy].length; sx += 1) {
      if (shape[sy][sx] === 0) {
        continue;
      }

      const bx = state.current.x + sx;
      const by = state.current.y + sy;

      if (by < 0) {
        setGameOver();
        return;
      }

      cells.push([bx, by]);
    }
  }

  for (const [bx, by] of cells) {
    state.board[by][bx] = pieceId;
  }

  const cleared = clearLines();
  updateScoring(cleared);
  spawnPiece();
}

function tryMove(dx, dy) {
  if (!state.current) {
    return false;
  }

  const shape = getCurrentShape();
  const nx = state.current.x + dx;
  const ny = state.current.y + dy;

  if (collides(state.board, shape, nx, ny)) {
    return false;
  }

  state.current.x = nx;
  state.current.y = ny;
  return true;
}

function rotate(dir) {
  if (!state.current) {
    return;
  }

  const piece = PIECES[state.current.type];
  const rotations = piece.rotations.length;
  const target = (state.current.rotationIndex + dir + rotations) % rotations;
  const shape = piece.rotations[target];

  for (const kick of [0, -1, 1, -2, 2]) {
    const nx = state.current.x + kick;
    if (!collides(state.board, shape, nx, state.current.y)) {
      state.current.rotationIndex = target;
      state.current.x = nx;
      return;
    }
  }
}

function hardDrop() {
  let distance = 0;
  while (tryMove(0, 1)) {
    distance += 1;
  }
  state.score += distance * 2;
  lockPiece();
}

function softDrop() {
  if (tryMove(0, 1)) {
    state.score += 1;
  } else {
    lockPiece();
  }
}

function drawCell(x, y, color, alpha = 1) {
  if (y < 0) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
  ctx.restore();
}

function drawPiece(type, rotationIndex, x, y, options = {}) {
  const shape = getShape(type, rotationIndex);
  const color = PIECES[type].color;
  const alpha = options.alpha === undefined ? 1 : options.alpha;
  const outlineOnly = options.outlineOnly === true;

  for (let sy = 0; sy < shape.length; sy += 1) {
    for (let sx = 0; sx < shape[sy].length; sx += 1) {
      if (shape[sy][sx] === 0) {
        continue;
      }

      const cellX = x + sx;
      const cellY = y + sy;
      if (cellY < 0) {
        continue;
      }

      if (outlineOnly) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(
          cellX * BLOCK_SIZE,
          cellY * BLOCK_SIZE,
          BLOCK_SIZE,
          BLOCK_SIZE
        );
        ctx.restore();
      } else {
        drawCell(cellX, cellY, color, alpha);
      }
    }
  }
}

function renderBoard() {
  ctx.fillStyle = "#0b1022";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const cell = state.board[y][x];
      if (cell !== 0) {
        drawCell(x, y, ID_TO_COLOR[cell] || "#9ca3af");
      } else {
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
      }
    }
  }
}

function renderCurrentPiece() {
  if (!state.current) {
    return;
  }

  if (state.autoAnimation) {
    const animated = getAnimatedPiecePose(state.autoAnimation);

    drawPiece(
      state.current.type,
      state.autoAnimation.endRotationIndex,
      state.autoAnimation.endX,
      state.autoAnimation.endY,
      { outlineOnly: true, alpha: 0.7 }
    );

    drawPiece(
      state.current.type,
      state.autoAnimation.rotationSequence[0],
      state.autoAnimation.startX,
      state.autoAnimation.startY,
      { outlineOnly: true, alpha: 0.25 }
    );

    drawPiece(
      state.current.type,
      animated.rotationIndex,
      animated.x,
      animated.y,
      { alpha: 1 }
    );
    return;
  }

  drawPiece(
    state.current.type,
    state.current.rotationIndex,
    state.current.x,
    state.current.y
  );
}

function updateHud() {
  if (scoreEl) {
    scoreEl.textContent = String(state.score);
  }
  if (linesEl) {
    linesEl.textContent = String(state.lines);
  }
  if (levelEl) {
    levelEl.textContent = String(state.level);
  }
  if (statusEl) {
    statusEl.textContent = state.gameOver
      ? "Game Over"
      : (state.auto ? (state.autoAnimation ? "Auto (Animating)" : "Auto") : "Running");
  }
}

function computeBestMove() {
  if (!state.current || state.gameOver) {
    return null;
  }

  const lookahead = state.queue.slice(0, Math.max(0, solver.depth - 1));
  return solver.bestMove(state.board, state.current.type, lookahead);
}

function runAutoStep() {
  if (!state.auto || state.gameOver || !state.current || state.autoAnimation) {
    return;
  }

  const bestMove = computeBestMove();
  if (!bestMove) {
    setGameOver();
    return;
  }

  state.autoAnimation = createAutoAnimation(bestMove);
}

function restartGame() {
  state.board = createEmptyBoard();
  state.current = null;
  state.queue = [];
  state.bag = [];
  state.score = 0;
  state.lines = 0;
  state.level = 1;
  state.dropTimer = 0;
  state.dropInterval = 800;
  state.autoTimer = state.auto ? state.autoInterval : 0;
  state.autoAnimation = null;
  state.gameOver = false;

  spawnPiece();
  updateHud();
  renderBoard();
  renderCurrentPiece();
}

function handleKeydown(event) {
  if (state.gameOver || state.auto || !state.current) {
    return;
  }

  switch (event.code) {
    case "ArrowLeft":
      tryMove(-1, 0);
      break;
    case "ArrowRight":
      tryMove(1, 0);
      break;
    case "ArrowUp":
    case "KeyX":
      rotate(1);
      break;
    case "KeyZ":
      rotate(-1);
      break;
    case "ArrowDown":
      softDrop();
      break;
    case "Space":
      hardDrop();
      break;
    default:
      return;
  }

  event.preventDefault();
  updateHud();
}

let lastTime = performance.now();
function tick(now) {
  const delta = now - lastTime;
  lastTime = now;

  if (!state.gameOver) {
    if (state.auto) {
      if (state.autoAnimation) {
        advanceAutoAnimation(delta);
      } else {
        state.autoTimer += delta;
        if (state.autoTimer >= state.autoInterval) {
          state.autoTimer = 0;
          runAutoStep();
        }
      }
    } else {
      state.dropTimer += delta;
      if (state.dropTimer >= state.dropInterval) {
        state.dropTimer = 0;
        if (!tryMove(0, 1)) {
          lockPiece();
        }
      }
    }
  }

  updateHud();
  renderBoard();
  renderCurrentPiece();
  requestAnimationFrame(tick);
}

if (depthEl) {
  depthEl.addEventListener("change", () => {
    const parsed = Number(depthEl.value);
    const depth = Math.max(1, Math.min(4, Number.isFinite(parsed) ? parsed : 2));
    depthEl.value = String(depth);
    solver.setDepth(depth);
  });
}

if (autoBtn) {
  autoBtn.addEventListener("click", () => {
    state.auto = !state.auto;
    state.autoAnimation = null;
    state.autoTimer = state.auto ? state.autoInterval : 0;
    state.dropTimer = 0;
    autoBtn.textContent = state.auto ? "Disable Auto" : "Enable Auto";
    updateHud();
  });
}

if (restartBtn) {
  restartBtn.addEventListener("click", restartGame);
}
window.addEventListener("keydown", handleKeydown);

restartGame();
requestAnimationFrame(tick);
})();
