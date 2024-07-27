import Sudoku from './Sudoku.js';

const range = (end, start = 0) => ([...Array(end - start).keys()].map(v => v + start));

const difficultyMap = {
  'easy': 36,
  'medium': 27,
  'hard': 24,
};

export default class SudokuBoard {
  static DEFAULT_NUM_CLUES = difficultyMap.easy;

  /**
   *
   * @param {Object} options
   * @param {Sudoku | null} [options.game = null]
   * @param {boolean} [options.includeControls = true]
   * @param {boolean} [options.interactive = true]
   * @param {string[]} [options.classes]
   */
  constructor({
    game = null,
    includeControls = true,
    interactive = true,
    classes = [],
  } = {}) {
    this.interactive = Boolean(interactive);
    this.selected = -1;

    this.board = document.createElement('div');
    this.board.classList.add('sudoku-board', ...classes);

    this.regions = range(9).map(this._createSudokuRegion);
    this.regions.forEach((region) => this.board.appendChild(region));

    this.cells = range(9*9).map((cellIndex) => {
      const cell = this._createSudokuCell(cellIndex);
      const regionIndex = Sudoku.cellRegion(cellIndex);
      const region = this.regions[regionIndex];
      if (regionIndex % 2 === 1) cell.classList.add('odd');
      region.appendChild(cell);
      return cell;
    });

    this.container = document.createElement('div');
    this.container.classList.add('sudoku-container', 'flex-horizontal', 'col-gap-2', 'items-center');
    this.container.appendChild(this.board);

    if (Boolean(includeControls)) {
      this.useControls();
    }

    /** @type {Sudoku} */
    this._sudoku = null;

    /** @type {Promise<Sudoku>} */
    this.sudokuPromise = ((game) ? Promise.resolve(game) : this.generatePuzzle(difficultyMap.medium))
    this.sudokuPromise.then((sudoku) => {
      this._sudoku = sudoku;
      this._bindToGame(sudoku);
    });
  }

  get component() {
    return this.container;
  }

  get game() {
    return this._sudoku;
  }

  set game(sudoku) {
    this.sudokuPromise = this.sudokuPromise.finally(() => {
      this._sudoku = sudoku;
      this._bindToGame(sudoku);
    });
  }

  get loading() {
    return this.board.classList.contains('loading');
  }

  set loading(loading) {
    if (loading) {
      this.board.classList.add('loading');
    } else {
      this.board.classList.remove('loading');
    }
  }

  useControls() {
    if (this.controlsContainer) {
      return;
    }

    this.difficultySelect = this._createDifficultySelect();
    this.solveButton = this._createSolveButton();
    this.generateButton = this._createGenerateButton();
    this.stuckButton = this._createStuckButton();
    this.shuffleButton = this._createShuffleButton();

    this.controlsContainer = this.controlsContainer || document.createElement('div');
    this.controlsContainer.classList.add('sudoku-controls-container', 'flex-vertical', 'row-gap-2', 'items-center');
    this.controlsContainer.append(
      this.difficultySelect,
      this.generateButton,
      this.shuffleButton,
      this.stuckButton,
      this.solveButton,
    );

    this.container.classList.add('p2');
    this.container.prepend(this.controlsContainer);
  }

  removeControls() {
    if (this.controlsContainer) {
      this.controlsContainer.remove();
      this.controlsContainer = null;
    }
  }

  freeze() {
    this.interactive = false;
    this.cells.forEach((cell) => {
      cell.onclick = null;
      cell.onkeydown = null;
    });
  }

  /**
   *
   * @param {Promise<T>} promise
   * @param {number} timeoutMs
   * @returns {Promise<T>}
   */
  timedPromise(promise, timeoutMs = 10000) {
    return Promise.race([
      promise,
      new Promise((resolve, reject) => {
        const id = setTimeout(() => {
          reject('Timed out waiting for promise');
        }, timeoutMs);

        promise.then((value) => {
          clearTimeout(id);
          resolve(value);
        }).catch((reason) => {
          clearTimeout(id);
          reject(reason);
        });
      })
    ]);
  }

  /**
   *
   * @param {number} numClues
   * @param {number} timeoutMs
   * @returns {Promise<Sudoku>}
   */
  generatePuzzle(numClues = SudokuBoard.DEFAULT_NUM_CLUES, timeoutMs = 10000) {
    this._sudoku = null;

    if (this.loading) {
      return;
    }

    return this.timedPromise(
      new Promise((resolve, reject) => {
        this.loading = true;
        try {
          resolve(Sudoku.generatePuzzle(numClues));
        } catch (e) {
          reject('Failed to generate puzzle');
        }
        this.loading = false;
      }),
      timeoutMs
    );
  }

  _bindToGame() {
    this.selected = -1;
    const isSolved = this.game.isSolved;
    this._removeValidityCss();
    this.game.board.forEach((digit, cellIndex) => {
      this.updateCellToDigit(cellIndex, digit);

      const cell = this.cells[cellIndex];
      cell.tabIndex = 0;

      if (isSolved) {
        cell.classList.add('solved');
      }

      if (this.game.isClue(cellIndex)) {
        cell.classList.add('given');
      } else {
        cell.classList.remove('given');
      }

      this._bindOnClick(cellIndex);
      this._bindOnKeyDown(cellIndex);
    });
  }

  _bindOnClick(cellIndex) {
    const cell = this.cells[cellIndex];
    if (!this.interactive || this.game.isClue(cellIndex)) {
      cell.onclick = null;
    } else {
      cell.onclick = (() => {
        if (this.loading || this.game.isSolved) {
          return;
        }

        this.selected = cellIndex;
        cell.focus();
        this.updateCellToDigit(cellIndex, (cell.value*1 + 1) % 10);
        this._removeValidityCss();
        if (this.game.isSolved) {
          this._applyValidityCss();
        }
      });
    }
  }

  _bindOnKeyDown(cellIndex) {
    const cell = this.cells[cellIndex];
    if (!this.interactive || this.game.isClue(cellIndex)) {
      cell.onkeydown = null;
    } else {
      cell.onkeydown = ((event) => {
        const key = event.key;

        if (Object.keys(numberKeyMap).includes(key)) {
          if (this.loading || this.game.isSolved) {
            return;
          }

          this.updateCellToDigit(cellIndex, numberKeyMap[key]);
          this._removeValidityCss();
          if (this.game.isSolved) {
            this._applyValidityCss();
          }
        } else if (Object.keys(arrowKeyMap).includes(key)) {

          let nextCellIndex = this.game.board.findIndex((val) => !isDigit(val));
          if (this.selected >= 0) {
            nextCellIndex = arrowKeyMap[key](this.game, this.selected);
          }

          if (
            nextCellIndex !== undefined &&
            nextCellIndex > -1 &&
            nextCellIndex !== this.selected
          ) {
            this.selected = nextCellIndex;
            this.cells[nextCellIndex].focus();
          }
        }

        event.preventDefault();
      });
    }
  }


  updateCellToDigit(cellIndex, digit) {
    this.game.setDigit(digit, cellIndex);

    const cell = this.cells[cellIndex];
    cell.value = `${digit}`;
    cell.innerText = (digit === 0) ? '' : `${digit}`;
  }

  _removeValidityCss() {
    this.cells.forEach((cell) => {
      cell.classList.remove('solved', 'invalid-1', 'invalid-2', 'invalid-3');
    });
  }

  _applyValidityCss() {
    const digits = range(9);
    const rowValidity = digits.map(row => this.game.isRowValid(row));
    const colValidity = digits.map(col => this.game.isColValid(col));
    const regionValidity = digits.map(region => this.game.isRegionValid(region));
    const solved = this.game.isSolved;

    this._removeValidityCss();

    this.cells.forEach((cell, cellIndex) => {
      if (solved) {
        cell.classList.add('solved');
        return;
      }

      let validity = 0;
      if (!rowValidity[Sudoku.cellRow(cellIndex)]) validity += 1;
      if (!colValidity[Sudoku.cellCol(cellIndex)]) validity += 1;
      if (!regionValidity[Sudoku.cellRegion(cellIndex)]) validity += 1;

      if (validity > 0) {
        cell.classList.add(`invalid-${validity}`);
      }
    });
  }

  _createSudokuRegion() {
    const region = document.createElement('div');
    region.classList.add('sudoku-region');
    return region;
  }

  _createSudokuCell(cellIndex) {
    const cell = document.createElement('button');
    cell.classList.add('sudoku-cell');
    cell.cellIndex = cellIndex;
    return cell;
  }

  _createDifficultySelect() {
    const select = document.createElement('select');
    select.classList.add('p1', 'bg-dark', 'primary', 'button', 'hoverable', 'hover-primary');
    Object.keys(difficultyMap).forEach((difficulty) => {
      const option = document.createElement('option');
      option.value = difficulty;
      option.innerText = difficulty;
      select.appendChild(option);
    });
    select.value = 'easy';
    return select;
  }

  _createSolveButton() {
    const solveBtn = document.createElement('button');
    solveBtn.classList.add('p1', 'button', 'hoverable', 'hover-evil', 'bg-dark', 'evil');
    const icon = document.createElement('i');
    icon.classList.add('fa-solid', 'fa-magic-wand-sparkles');
    solveBtn.appendChild(icon);
    solveBtn.appendChild(document.createTextNode(' Solve'));
    solveBtn.onclick = (() => {
      if (this.loading || this.game.isSolved) return;
      this.game.solve()
      this._bindToGame(this.game);
      this._applyValidityCss();
    });
    return solveBtn;
  }

  _createGenerateButton() {
    const btn = document.createElement('button');
    btn.classList.add('p1', 'bg-dark', 'secondary', 'button', 'circle-2', 'hoverable');
    const icon = document.createElement('i');
    icon.classList.add('fa-solid', 'fa-rotate-right');
    btn.appendChild(icon);
    btn.onclick = (() => {
      this._sudoku = null;
      this.sudokuPromise = this.generatePuzzle(difficultyMap[this.difficultySelect.value]).then((sudoku) => {
        this._sudoku = sudoku;
        this._bindToGame(sudoku);
      });
    });
    return btn;
  }

  _createStuckButton() {
    const btn = document.createElement('button');
    btn.classList.add('p1', 'button', 'hoverable', 'hover-primary', 'bg-dark', 'primary');
    const icon = document.createElement('i');
    icon.classList.add('fa-solid', 'fa-screwdriver-wrench');
    btn.appendChild(icon);
    btn.appendChild(document.createTextNode(' Check!'));
    btn.onclick = (() => {
      if (this.loading || this.game.isSolved) return;

      this._removeValidityCss();

      range(81).filter((cellIndex) => (
        !this.game.isClue(cellIndex) && (
          !this.game.isRowValid(Sudoku.cellRow(cellIndex)) ||
          !this.game.isColValid(Sudoku.cellCol(cellIndex)) ||
          !this.game.isRegionValid(Sudoku.cellRegion(cellIndex))
        )
      )).forEach((cellIndex) => {
        this.updateCellToDigit(cellIndex, 0);
      });
    });

    return btn;
  }

  _createShuffleButton() {
    const btn = document.createElement('button');
    btn.classList.add('p1', 'bg-dark', 'gold', 'button', 'circle-2', 'hoverable', 'hover-gold');
    const icon = document.createElement('i');
    icon.classList.add('fa-solid', 'fa-shuffle');
    btn.appendChild(icon);
    btn.onclick = (() => {
      if (this.loading) return;
      this._removeValidityCss();
      this._performRandomTransforms();
      this._bindToGame(this.game);
    });
    return btn;
  }

  /**
   * Performs a random number of random transforms on the current sudoku puzzle.
   * Transforms include:
   * - Reflection over horizontal axis
   * - Reflection over vertical axis
   * - Reflection over diagonal axis
   * - Reflection over antidiagonal axis
   * - Rotation 90 degrees (clockwise)
   *
   * Call `_bindToGame` after calling this method to update the UI.
   */
  _performRandomTransforms() {
    const currentValues = this.game.board;
    const transforms = [
      this.game.reflectOverHorizontal.bind(this.game),
      this.game.reflectOverVertical.bind(this.game),
      this.game.reflectOverDiagonal.bind(this.game),
      this.game.reflectOverAntidiagonal.bind(this.game),
      this.game.rotate90.bind(this.game),
      this.game.rotate90.bind(this.game) // double chance of rotation
    ];

    const numTransforms = Math.floor(Math.random() * 20) + 8;

    while (this.game.board.every((digit, cellIndex) => digit === currentValues[cellIndex])) {
      for (let n = 0; n < numTransforms; n++) {
        transforms[Math.floor(Math.random() * transforms.length)]();
      }
    }
  }
}

const numberKeyMap = {
  'Backspace': 0,
  ...(range(10).reduce((map, digit) => {
    map[`${digit}`] = digit;
    return map;
  }, {}))
};

const arrowKeyMap = {
  'ArrowUp': (sudoku, currentSelected) => {
    // Find the first non-given cell above the selected cell, wrapping around to
    // the bottom of the board if necessary.
    return range(9)
      .map(rowOffset => (currentSelected - (9 * (rowOffset + 1)) + 81) % 81)
      .filter(cellIndex => cellIndex !== currentSelected)
      .find(cellIndex => !sudoku.isClue(cellIndex));
  },
  'ArrowDown': (sudoku, currentSelected) => {
    return range(9)
      .map(rowOffset => (currentSelected + (9 * (rowOffset + 1)) + 81) % 81)
      .filter(cellIndex => cellIndex !== currentSelected)
      .find(cellIndex => !sudoku.isClue(cellIndex));
  },
  'ArrowLeft': (sudoku, currentSelected) => {
    return range(9)
      .map(rowOffset => (currentSelected - rowOffset - 1 + 81) % 81)
      .filter(cellIndex => cellIndex !== currentSelected)
      .find(cellIndex => !sudoku.isClue(cellIndex));
  },
  'ArrowRight': (sudoku, currentSelected) => {
    return range(9)
      .map(rowOffset => (currentSelected + rowOffset + 1 + 81) % 81)
      .filter(cellIndex => cellIndex !== currentSelected)
      .find(cellIndex => !sudoku.isClue(cellIndex));
  }
};
