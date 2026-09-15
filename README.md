# Tetris + Heuristic Solver

Browser Tetris in vanilla JS/canvas with a Dellacherie-style autoplay solver. No build step, no dependencies.

## Run

Open `index.html` in a browser, or serve the directory:

```
python3 -m http.server
```

Autoplay is on by default; the side panel shows score/lines/level/status and has a search depth input (1-6), an auto toggle and a restart button. With auto off: arrows to move, `Up`/`X`/`Z` to rotate, `Down` to soft drop, `Space` to hard drop.

## How the solver works

- Tries every rotation and column for the current piece, dropping it straight down.
- Board scoring = `+linesCleared -aggregateHeight -holes -bumpiness`.
- Weights are hardcoded to the classic Dellacherie values (`0.760666 / 0.810066 / 0.35663 / 0.184483`), as used in e.g. [Parallel Greedy Tetris Solver](https://www.cs.columbia.edu/~sedwards/classes/2020/4995-fall/reports/Tetris.pdf) (Gilliland & Zhang, COMS 4995).
- Simulated drops for each piece are repeated for upcoming pieces if `depth > 1` (pieces come from a 7-bag queue; the solver sees `depth - 1` of them ahead).
- Chooses the branch (whose length is defined by `depth`) with the best total board score; a branch that leaves a later piece with no legal drop scores `-Infinity`.
- Only executes the first move of the branch, then recalculates from the start.

## Known limitations

- Moves are straight drops only: no tucks, slides or spins, so placements under overhangs are never considered.
- Rotation kicks are horizontal only (no SRS), so e.g. an I piece lying on the floor can't be rotated upright.
- Greedy one-piece-at-a-time commitment means the solver can still top out on long unlucky sequences.

## License

MIT — see [LICENSE](LICENSE).
