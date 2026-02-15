# Tetris + Heuristic Solver

Browser Tetris in vanilla JS/canvas with a Dellacherie-style autoplay solver. No build step, no dependencies.

## Run

Open `index.html` in a browser, or serve the directory:

```
python3 -m http.server
```

Autoplay is on by default. Manual controls: arrows to move/rotate, `Z`/`X` to rotate, `Space` to hard drop.

## How the solver works

- Tries every rotation and placement for the current piece.
- Board scoring = `+linesCleared -aggregateHeight -holes -bumpiness`.
- Weights are hardcoded to the classic Dellacherie values (`0.760666 / 0.810066 / 0.35663 / 0.184483`), as used in e.g. [Parallel Greedy Tetris Solver](https://www.cs.columbia.edu/~sedwards/classes/2020/4995-fall/reports/Tetris.pdf) (Gilliland & Zhang, COMS 4995).
- Simulated drops for each piece are repeated for upcoming pieces if `depth > 1` (pieces come from a 7-bag queue; the solver sees `depth - 1` of them ahead).
- Chooses the branch (whose length is defined by `depth`) with the best total board score.
- Only executes the first move of the branch, then recalculates from the start.

## Known limitations

- Search depth is fixed at 2; the optional depth/auto/restart UI controls referenced in `game.js` are not present in `index.html` (the code null-guards them, so autoplay still runs).
- Greedy one-piece-at-a-time commitment means the solver can still top out on long unlucky sequences.

## License

MIT — see [LICENSE](LICENSE).
