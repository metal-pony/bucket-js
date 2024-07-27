import {
  range,
  rotateArr90,
  reflectOverHorizontal,
  reflectOverVertical,
  reflectOverDiagonal,
  reflectOverAntiDiagonal,
  shuffle,
  swapAllInArr
} from '../util/arrays.js';
import { randomCombo } from '../util/perms.js';
import Debugger from '../util/debug.js';
import SudokuSieve from './SudokuSieve.js';
import { populateSieve } from './siever.js';

const debug = new Debugger(false);

const randInt = (max => ((Math.random() * max) | 0));
const chooseRandom = (arr, remove = false) => {
  if (arr.length === 0) return null;
  if (remove) return arr.splice(randInt(arr.length), 1)[0];
  return arr[randInt(arr.length)];
};

/**
 * @callback SolutionFoundCallback
 * @param {Sudoku} sudoku
 * @returns {boolean} If `true`, the search will continue for more solutions.
 */

/** The number of digits used in Sudoku.*/
export const NUM_DIGITS = 9;
export const NUM_DIGITS_SQRT = Math.sqrt(NUM_DIGITS);

// This is only used for grabbing values out of the constraints map
const NUM_DIGITS_DBL = NUM_DIGITS * 2;

/** `0x1ff`; Represents the combination of all candidates for a given cell on a Sudoku board.*/
const ALL = 511;
/** The number of spaces on a Sudoku board.*/
export const NUM_SPACES = NUM_DIGITS*NUM_DIGITS;
/** The minimum number of clues required for a Sudoku puzzle.*/
export const MIN_CLUES = 17;

const ALL_VALID = (1<<27) - 1;

const digitRange = range(NUM_DIGITS);

const DIGITS = range(NUM_DIGITS + 1, 1);

/** @type {number[]} */
const SHUFFLED_DIGITS = shuffle([...DIGITS]);

/** @type {number[]} */
const EMPTY_BOARD = Array(NUM_SPACES).fill(0);

/** Maps digits (the indices) to their encoded board values.*/
const ENCODER = [0, ...digitRange.map((shift) => 1<<shift)];

/**
 * Maps the 2^9 board values to a digit.
 * @type {number[]}
 **/
const DECODER = range(1<<NUM_DIGITS).fill(0);
for (let shift = 0; shift < NUM_DIGITS; shift++) { DECODER[1<<shift] = shift + 1; }

/**
 * Maps the encoded board values (the indices) to the lists of candidate digits they represent.
 * @type {number[][]}
 **/
const CANDIDATE_DECODINGS = range(1<<NUM_DIGITS).map(encoded => {
  const candidates = [];
  for (let digit = 1; encoded > 0 && digit <= NUM_DIGITS; digit++, encoded >>= 1) {
    if (encoded & 1) {
      candidates.push(digit);
    }
  }
  return candidates;
});

/**
 * Maps the encoded board values (the indices) to the list of candidate digits (ENCODED) they represent.
 * @type {number[][]}
 **/
const CANDIDATES = CANDIDATE_DECODINGS.map(candidates => candidates.map(digit => ENCODER[digit]));

/**
 * Cache of Sudoku board indices for each row, column, and region.
 * @type {{row: number[][], col: number[][], region: number[][], peersOfCell: number[][]}}
 * @example
 * indicesFor.row[0] // [0, 1, 2, 3, 4, 5, 6, 7, 8]
 * indicesFor.col[0] // [0, 9, 18, 27, 36, 45, 54, 63, 72]
 * indicesFor.regions[0] // [0, 1, 2, 9, 10, 11, 18, 19, 20]
 */
export const indicesFor = {
  /** The indices of the cells in each row.*/
  row: digitRange.map((row) => range((row+1)*NUM_DIGITS, row*NUM_DIGITS)),
  /** The indices of the cells in each column.*/
  col: digitRange.map((col) => digitRange.map((row) => col + row*NUM_DIGITS)),
  /** The indices of the cells in each region.*/
  region: digitRange.map((reg) => digitRange.map((i) => {
    const n = NUM_DIGITS_SQRT;
    const rRow = Math.floor(reg/n);
    const rCol = reg%n;
    return (rRow*(n**3) + rCol*n + Math.floor(i/n)*NUM_DIGITS + (i%n));
  })),
  /** The indices of the cells that are peers.*/
  peersOfCell: range(NUM_SPACES).flatMap((ci) => ([
    ...digitRange.map((row) => range((row+1)*NUM_DIGITS, row*NUM_DIGITS)),
    ...digitRange.map((col) => digitRange.map((row) => col + row*NUM_DIGITS)),
    ...digitRange.map((reg) => digitRange.map((i) => {
      const n = NUM_DIGITS_SQRT;
      const rRow = Math.floor(reg/n);
      const rCol = reg%n;
      return (rRow*(n**3) + rCol*n + Math.floor(i/n)*NUM_DIGITS + (i%n));
    })).filter(cj => cj !== ci),
  ])),
};

/**
 * 81-Bit board masks useful for filtering different board areas.
 * @type {{none: bigint, all: bigint, row: bigint[], col: bigint[], region: bigint[]}}
 */
export const masksFor = {
  none: 0n,
  all: (1n << 81n) - 1n,
  row: indicesFor.row.map(row => row.reduce((mask, ci) => (mask | (1n << BigInt(NUM_SPACES - 1 - ci))), 0n)),
  col: indicesFor.col.map(col => col.reduce((mask, ci) => (mask | (1n << BigInt(NUM_SPACES - 1 - ci))), 0n)),
  region: indicesFor.region.map((reg) => reg.reduce((mask, ci) => (mask | (1n << BigInt(NUM_SPACES - 1 - ci))), 0n)),
};

/**
 * Encodes a digit value.
 * @param {number} digit From 0 - 9
 * @returns {number}
 */
const encode = (digit) => ENCODER[digit];

/**
 * Decodes an encoded value.
 * @param {number} encoded
 * @returns {number}
 */
const decode = (encoded) => DECODER[encoded];

/**
 * Returns whether the given encoded value represents a digit.
 * @param {number} encoded
 * @returns {boolean}
 */
const isDigit = (encoded) => DECODER[encoded] > 0;

/**
 * Returns the row index of the given cell.
 * @param {number} cellIndex
 * @returns {number}
 */
export const cellRow = (cellIndex) => (cellIndex / NUM_DIGITS) | 0;

/**
 * Returns the column index of the given cell.
 * @param {number} cellIndex
 * @returns {number}
 */
export const cellCol = (cellIndex) => (cellIndex % NUM_DIGITS);

/**
 * Returns the region index of the given cell.
 * @param {number} cellIndex
 * @returns {number}
 */
export const cellRegion = (cellIndex) => ((cellIndex / 27) | 0) * 3 + (((cellIndex % 9) / 3) | 0);

/**
 * Returns the region index of the given cell.
 * @param {number} row
 * @param {number} col
 * @returns {number}
 */
export const cellRegion2D = (row, col) => ((row / 3) | 0) * 3 + ((col / 3) | 0);

function cellMask(cellIndex) { return 1n << (BigInt(NUM_SPACES - cellIndex - 1)); }
const CELL_MASKS = range(NUM_SPACES).map(cellMask);

class SudokuArea {
  /**
   * @param {number} index [0,8]
   * @param {Sudoku} sudoku
   */
  constructor(index, sudoku) {
    this._index = index;
    this._sudoku = sudoku;
    this._isValid = true;
    this._constraints = 0;

    /** Candidate digit to cell index mapping.*/
    this._candidates = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  }

  get constraints() { return this._constraints; }
  get isFull() { return this._constraints === ALL; }
  get isValid() { return this._isValid; }
  hasDigit(digit) { return (this._constraints & encode(digit)) > 0; }

  addDigit(digit) {
    if (this.hasDigit(digit)) {
      this._isValid = false;
      this._sudoku._isValid = false;
    } else {
      this._constraints |= encode(digit);
    }
  }

  removeDigit(digit) {
    if (!this._isValid) {
      this.recalcConstraints();
      // Is the whole puzzle now valid?
      this._sudoku._isValid = this._sudoku.isEveryAreaValid();
    } else {
      this._constraints &= ~encode(digit);
    }
  }

  recalcConstraints() {
    this._constraints = 0;
    this._isValid = true;

    // TODO This is probably not what I meant. What did I mean?
    this.cells.forEach((cell) => {
      if (cell.digit > 0) {
        if (this.hasDigit(cell.digit)) {
          this._isValid = false;
          this._sudoku._isValid = false;
        }
        this._constraints |= encode(cell.digit);
      }
    });
  }

  addCandidate()
}

class SudokuRow extends SudokuArea {
  /**
   * @param {number} index
   * @param {SudokuCell[]} cells
   */
  constructor(index, cells) {
    super(index, cells[0]._sudoku);
    this.cells = cells.filter((cell, ci) => {
      if (cellRow(ci) === this._index) {
        cell._row = this;
        cell._rowIndex = this._index;
        return true;
      }
      return false;
    });
  }
}

class SudokuCol extends SudokuArea {
  /**
   * @param {number} index
   * @param {SudokuCell[]} cells
   */
  constructor(index, cells) {
    super(index, cells[0]._sudoku);
    this.cells = cells.filter((cell, ci) => {
      if (cellCol(ci) === this._index) {
        cell._col = this;
        cell._colIndex = this._index;
        return true;
      }
      return false;
    });
  }
}

class SudokuRegion extends SudokuArea {
  /**
   * @param {number} index
   * @param {SudokuCell[]} cells
   */
  constructor(index, cells) {
    super(index, cells[0]._sudoku);
    this.cells = cells.filter((cell, ci) => {
      if (cellRegion(ci) === this._index) {
        cell._region = this;
        cell._regionIndex = this._index;
        return true;
      }
      return false;
    });
  }
}

class SudokuCell {
  /**
   *
   * @param {number} index [0-80]
   * @param {Sudoku} sudoku
   */
  constructor(index, sudoku) {
    this._index = index;
    /** @type {Sudoku} */
    this._sudoku = sudoku;
    this._rowIndex = -1;
    this._colIndex = -1;
    this._regionIndex = -1;
    /** @type {SudokuRow} */
    this._row = null;
    /** @type {SudokuCol} */
    this._col = null;
    /** @type {SudokuRegion} */
    this._region = null;
    this._candidatesMask = 0;
    this._digit = 0;
    this._initial = 0;
  }

  get row() { return this._row; }
  get col() { return this._col; }
  get region() { return this._region; }
  get initialValue() { return this._initial; }
  set initialValue(value) { this._initial = value; }
  get isClue() { return this._initial > 0; }
  get digit() { return this._digit; }
  get constraints() {
    return (this._row._constraints | this._col._constraints | this._region._constraints) & ALL;
  }

  set digit(value) {
    if (value === this._digit) return;
    const previousDigit = this._digit;
    this._digit = value;
    this._candidatesMask = encode(value);

    // TODO This should be handled by the Sudoku class. _sudoku probably shouldn't exist. Cell shouldn't need to know about it.
    this._sudoku._board[this._index] = this._candidatesMask;
    this._sudoku._digits[this._index] = value;

    if (previousDigit > 0) {
      this._sudoku._numEmptyCells++;
      this._row.removeDigit(previousDigit);
      this._col.removeDigit(previousDigit);
      this._region.removeDigit(previousDigit);
    }

    if (this._digit > 0) {
      this._sudoku._numEmptyCells--;
      this._row.addDigit(this._digit);
      this._col.addDigit(this._digit);
      this._region.addDigit(this._digit);
    }
  }

  reset() {
    this.digit = this._initial;
  }
}

export class SudokuNode {
  /**
   *
   * @param {Sudoku} sudoku
   * @param {SudokuNode | null} prev
   */
  constructor(sudoku, prev = null) {
    this.sudoku = sudoku;

    /** @type {SudokuNode} */
    this.prev = prev;

    /** @type {SudokuNode[]} */
    this.nexts = null;
    this.visited = false;

    this.omittedNextCells = 0n;
  }

  dispose() {
    this.sudoku = null;
    this.nexts = null;
  }

  _findNexts(omittedNextCells = []) {
    this.nexts ??= this.sudoku._digits.reduce((nexts, digit, ci) => {
      if (digit > 0 && !omittedNextCells.includes(ci)) {
        const bCopy = new Sudoku(this.sudoku);
        bCopy.setDigit(0, ci);
        nexts.push(new SudokuNode(bCopy, this));
      }
      return nexts;
    }, []);
  }

  /**
   * Attempts to get a random, unvisited neighbor of this node.
   * Populates the list of neighbors for this node if it does not yet exist.
   * @param {number[]} [omittedNextCells] An array of cell indices to omit from the list of neighbors.
   * @return {SudokuNode} A random unvisited neighbor node.
   */
  getNextUnvisited(omittedNextCells = []) {
    this._findNexts(omittedNextCells);
    return chooseRandom(this.nexts.filter(n => (n !== null && !n.visited)));
  }
}

/**
 * Represents a Sudoku board.
 */
export class Sudoku {
  /** 9; The number of digits that appear on a Sudoku board.*/
  static get NUM_DIGITS() { return NUM_DIGITS; }
  /** 81; The number of spaces on a Sudoku board.*/
  static get NUM_SPACES() { return NUM_SPACES; }
  /** 17; The minimum number of clues required for a proper Sudoku puzzle.*/
  static get MIN_CLUES() { return MIN_CLUES; }

  /**
   *
   * @param {Sudoku} config
   * @param {bigint[]} sieve
   * @returns {number[]}
   */
  static cellsToKeepFromSieve(config, sieve) {
    let _sieve  = [...sieve];
    const cellsToKeep = [];

    while (_sieve.length > 0) {
      let maximum = 0;
      let reductionMatrix = _sieve.reduce((reductionMatrix, mask) => {
        config.filter(mask)._digits.forEach((val, ci) => {
          if (val > 0) {
            reductionMatrix[ci]++;

            if (reductionMatrix[ci] > maximum) {
              maximum = reductionMatrix[ci];
            }
          }
        });
        return reductionMatrix;
      }, [...EMPTY_BOARD]);

      /** @type {number[]} */
      const maxValueCells = reductionMatrix.reduce((max, val, ci) => {
        if (val === maximum) {
          max.push(ci);
        }
        return max;
      }, []);

      const cellToKeep = chooseRandom(maxValueCells);
      cellsToKeep.push(cellToKeep);

      // Filter out all sieve items that use the cell
      _sieve = _sieve.filter((mask) => (config.filter(mask)._digits[cellToKeep] === 0));
    }

    return cellsToKeep;
  }

  static _defaultGenerationOptions = Object.freeze({
    numClues: NUM_SPACES,
    timeOutMs: 0,
    config: null,
    amount: 1,
    normalize: false,
    callback: null
  });

  /**
   * Generates a Sudoku board with various options. By default, generates a single Sudoku config.
   * @param {Object} options
   * @param {number} [options.numClues=NUM_SPACES] (in `[17, 81]`; default: `81`) The number of clues to generate.
   * @param {number} [options.timeOutMs=0] (default: `0` (no limit)) The maximum time to spend generating.
   * @param {Sudoku} [options.config=null] (default: `null`) A configuration to use for generating puzzle boards. One will be generated if not provided.
   * If generating configs, this will be ignored.
   * @param {number} [options.amount=1] (in `[1, 1000]`; default: `1`) The number of puzzles to generate.
   * @param {boolean} [options.normalize=false] (default: `false`) Whether to normalize the generated board.
   * @param {boolean} [options.useSieve=false] (default: `false`) Whether to use a sieve to generate puzzles.
   * @param {SudokuSieve} [options.sieve=null] (default: `null`) The sieve to use while generating puzzles.
   * @param {(generated: Sudoku) => void} [options.callback=null] (default: `null`) A callback function to call when a puzzle is generated.
   * @returns {object[]} The generated Sudoku boards along with some metrics.
   */
  static generate({
    numClues = NUM_SPACES,
    timeOutMs = 0,
    config = null,
    amount = 1,
    normalize = false,
    useSieve = false,
    sieve = null,
    callback = null
  } = this._defaultGenerationOptions) {
    debug.log(`generate> options: {\n` +
      `  numClues: ${numClues},\n` +
      `  timeOutMs: ${timeOutMs},\n` +
      `  config: ${config},\n` +
      `  amount: ${amount},\n` +
      `  normalize: ${normalize},\n` +
      `  useSieve: ${useSieve},\n` +
      `  sieve: ${sieve ? `length: ${sieve.length})` : ''},\n` +
      `  callback: ${callback}\n}`
    );

    // Validate options
    if (typeof numClues !== 'number' || numClues < MIN_CLUES || numClues > NUM_SPACES) {
      throw new Error(`Invalid number of clues: ${numClues}`);
    }
    if (typeof amount !== 'number' || amount < 1 || amount > 1000) {
      throw new Error(`Invalid amount: ${amount}`);
    }
    if (typeof timeOutMs !== 'number' || timeOutMs < 0) {
      debug.log(`generate> Correcting invalid timeOutMs ${timeOutMs} to 0.`);
      timeOutMs = 0;
    }
    normalize = Boolean(normalize);
    useSieve = Boolean(useSieve);
    if (config !== null && (!(config instanceof Sudoku) || !config.isSolved)) {
      throw new Error(`Invalid config: ${config}`);
    }
    if (callback !== null && typeof callback !== 'function') {
      throw new Error(`Invalid callback: ${callback}`);
    }

    const isTrackingTime = timeOutMs > 0;
    const startTime = Date.now();
    const isGeneratingConfigs = numClues === NUM_SPACES;

    const results = [];

    if (isGeneratingConfigs) {
      for (let i = 0; i < amount; i++) {
        const searchResults = Sudoku.configSeed().searchForSolutions3({
          timeOutMs,
          solutionFoundCallback: (_=>false)
        });

        const solution = searchResults.solutions[0];
        solution.clues = solution._digits;
        if (normalize) {
          solution.normalize();
        }

        if (callback !== null && solution) {
          callback(solution);
        }
        results.push(searchResults);
        debug.log(`generate> Generated config ${i + 1}/${amount}: ${solution.toString()}`);

        if (isTrackingTime) {
          const elapsedTime = Date.now() - startTime;
          if (elapsedTime >= timeOutMs) {
            debug.log(`generate> Time out after ${elapsedTime}ms.`);
            break;
          }
        }
      }
    } else {
      if (!config) {
        // console.log('generate> Generating config for puzzles...');
        config = this.generateConfig({ normalize });
        // console.log(`          Done. ${config.toString()}`);
      }

      // Keeps track of cells to keep in the puzzle. This is populated below if using the sieve method.
      let cellsToKeep = [];

      // If clues are low, it's advantageous to generate a sieve to filter invalid puzzles.
      // The sieve will be used to make better decisions about which cells to keep or remove.
      // let sieve = null;
      if (useSieve) {
        const sieveGenerationStart = Date.now();
        // TODO #25 Sudoku.loadSieveFile(filename) Supplies low-clue generation with a sieve for finding puzzles.
        //      Maybe this should be loaded automatically if it exists in the same directory. I just don't know
        //      how that might work with a browser version.
        // TODO Sudoku.findOrGenerateSieve(config, options) Finds the sieve for the given config, or generates one.
        //      Generated sieves won't be saved to file
        // TODO Sudoku.generateSieve(config, options)
        // TODO Aside: How to generate and save sieves? Maybe a separate tool? Subrepo?
        // console.log('generate> Generating sieve...');
        // TODO Move this to Sudoku.generateSieve
        // TODO How to decide what options to pass to generateSieve?
        // TODO Pass timeOutMs to generateSieve
        if (!sieve) {
          sieve = new SudokuSieve({ config });
        }

        // These 2-digit invalid cycles are extremely fast to generate, so we'll make sure
        // the sieve has at least these few basic items.
        // sieve.add(...searchForSieve2(config, { maxDigits: 2, maxLength: 18 }));
        populateSieve(sieve, 2);
        populateSieve(sieve, 3);
        // console.log(`          Done in ${Date.now() - sieveGenerationStart}ms. Sieve length: ${sieve.length}`);

        // Create reduction matrix for the sieve.
        // The reduction matrix is the 9x9 matrix where each cell contains the number of
        // times that cell appears as part of the unresolvable chain among sieve items.

        // The reduction matrix is used to determine which cells should be kept in the puzzle.
        // Each time a cell is picked to keep, the reduction matrix is updated to reflect the
        // removal of that cell from the sieve.

        // TODO We could do this for every puzzle generation attempt to keep things fresh
        // cellsToKeep.push(...Sudoku.cellsToKeepFromSieve(config, sieve));
      }

      const POPS_UNTIL_RESET = 100;

      for (let i = 0; i < amount; i++) {
        // cellsToKeep = [...Sudoku.cellsToKeepFromSieve(config, sieve)];
        cellsToKeep = sieve ? sieve._generateMaskCells() : [];

        const result = {
          puzzle: null,
          cellsKept: [...cellsToKeep],
          pops: 0,
          resets: 0,
          timeMs: 0,
        };

        const puzzleGenStartTime = Date.now();
        // const config = this.generateConfig();
        const rootNode = new SudokuNode(config);
        let puzzleStack = [rootNode];
        let numPops = 0; // Number of pops. If the search resets, so does this.

        // Not using maxPops for now
        // while (puzzleStack.length > 0 && numPops < maxPops) {
        while (puzzleStack.length > 0) {
          const puzzleNode = puzzleStack[puzzleStack.length - 1]; // peek
          const puzzle = puzzleNode.sudoku;
          puzzleNode.visited = true;
          debug.log(`generate> (empty cells: ${puzzle.numEmptyCells}) ${puzzle.toString()}`);

          // _board = puzzle.encodedBoard;
          // TODO Try using hasUniqueSolution cache like in siever
          if (!puzzle.hasUniqueSolution()) {
            debug.log(`generate> no unique solution, popping...`);
            puzzleStack.pop();
            puzzleNode.dispose();
            result.pops++;

            // TODO explore whether it's possible to keep a history for each node,
            //  i.e. track which cells were attempted to be removed.
            //  Then, this won't need any sort of restart fail-safe.

            // After a certain number of pops, restart the search. This ensures that
            // that the algorithm won't continue to try to remove cells when there is
            // no path to a valid puzzle.
            if (++numPops >= POPS_UNTIL_RESET) {
              puzzleStack = [rootNode];
              numPops = 0;
              result.resets++;
            }

            continue;
          }

          if (puzzle.numEmptyCells >= (NUM_SPACES - numClues)) {
            // debug.log(`generate> found puzzle with ${puzzle.numEmptyCells} empty cells`);

            // Just this one time debugging, print the puzzle and the time elapsed
            // console.log(`✅ ${puzzle.toString()} in ${Date.now() - puzzleGenStartTime}ms`);
            break;
          }

          const next = puzzleNode.getNextUnvisited(cellsToKeep);
          if (next) {
            puzzleStack.push(next);
          } else {
            puzzleStack.pop();
            result.pops++;

            if (++numPops >= POPS_UNTIL_RESET) {
              puzzleStack = [rootNode];
              numPops = 0;
              result.resets++;
            }
          }
        }

        // Not using maxPops for now
        // if (numPops >= maxPops || puzzleStack.length === 0) {
        //   return null;
        // }
        result.timeMs = Date.now() - puzzleGenStartTime;
        if (puzzleStack.length === 0) {
          // console.log(`generate> ❌ Failed to generate puzzle ${i + 1}/${amount}.`);
        } else {
          const puzzle = puzzleStack[puzzleStack.length - 1].sudoku;
          // puzzle._clues = puzzle.board;
          // puzzle.clues = puzzle._digits;
          // return puzzle;
          result.puzzle = new Sudoku(puzzle);
          results.push(result);

          debug.log(`generate> Generated puzzle ${i + 1}/${amount}: ${puzzle.toString()}`);
          if (callback !== null) {
            callback(new Sudoku(puzzle));
          }
        }
      }
    }

    const endTime = Date.now();
    const elapsedTime = endTime - startTime;
    // console.log(`Generated ${results.length} sudoku puzzles in ${elapsedTime}ms.`);

    // TODO Return structure with result and other stats
    return results;
  }

  // Uses DFS to locate valid sudoku puzzle.
  /**
   *
   * @param {number} numClues
   * @param {number} maxPops
   * @returns {Sudoku | null}
   */
  static generatePuzzle(numClues, maxPops = 1<<16) {
    const config = this.generateConfig();
    const rootNode = new SudokuNode(config);
    let puzzleStack = [rootNode];

    // let _board = [...EMPTY_BOARD];
    // puzzleStack.push(rootNode);

    let numPops = 0; // Number of pops. If the search resets, so does this.

    while (puzzleStack.length > 0 && numPops < maxPops) {
      const puzzleNode = puzzleStack[puzzleStack.length - 1]; // peek
      const puzzle = puzzleNode.sudoku;
      puzzleNode.visited = true;
      debug.log(`generatePuzzle> (empty: ${puzzle.numEmptyCells}) ${puzzle.toString()}`);

      // _board = puzzle.encodedBoard;
      if (!puzzle.hasUniqueSolution()) {
        debug.log(`generatePuzzle> no unique solution, popping...`);
        puzzleStack.pop();
        puzzleNode.dispose();

        // TODO explore whether it's possible to keep a history for each node,
        //  i.e. track which cells were attempted to be removed.
        //  Then, this won't need any sort of restart fail-safe.

        // After a certain number of pops, restart the search. This ensures that
        // that the algorithm won't continue to try to remove cells when there is
        // no path to a valid puzzle.
        if (++numPops >= 100) {
          puzzleStack = [rootNode];
          numPops = 0;
        }

        continue;
      }

      if (puzzle.numEmptyCells >= (NUM_SPACES - numClues)) {
        debug.log(`generatePuzzle> found puzzle with ${puzzle.numEmptyCells} empty cells`);
        break;
      }

      const next = puzzleNode.getNextUnvisited();
      if (next) {
        puzzleStack.push(next);
      } else {
        puzzleStack.pop();

        if (++numPops >= 100) {
          puzzleStack = [rootNode];
          numPops = 0;
        }
      }
    }

    if (numPops >= maxPops || puzzleStack.length === 0) {
      return null;
    }

    const puzzle = puzzleStack[puzzleStack.length - 1].sudoku;
    // puzzle._clues = puzzle.board;
    puzzle.clues = puzzle._digits; // TODO Not sure if this is necessary. Seen in other places within generation methods as well.
    return puzzle;
  }

  /**
   *
   * @param {bigint} mask 81 or less length bit mask, where 1s represent cells to keep.
   * @returns {Sudoku}
   */
  filter(mask) {
    return new Sudoku(this._digits.map((d, ci) => (mask & CELL_MASKS[ci]) ? 0 : d));
  }

  // Uses DFS to locate valid sudoku puzzle.
  /**
   *
   * @param {number} numClues
   * @param {number} maxTests
   * @returns {Sudoku | null}
   */
  static generatePuzzle2(numClues = 27, maxTests = 1<<24) {
    debug.log('generatePuzzle2');

    // TODO This is kinda dumb, yeah?
    if (numClues >= 36) {
      return this._randomComboPuzzle(numClues);
    }

    /**
     * @typedef {Object} SudokuNode
     * @property {Sudoku} sudoku
     * @property {Sudoku[] | null} nexts
     */

    /** @type {SudokuNode[]} */
    let stack = [];
    let testCounter = 0;
    let popsUntilReset = 0;

    while (++testCounter <= maxTests) {
      // Reset if necessary
      if (stack.length === 0 || popsUntilReset === 0) {
        // Clear the stack and start over
        stack = [{
          sudoku: Sudoku._randomComboPuzzle(numClues + Math.ceil((NUM_SPACES - numClues) / 4)),
          nexts: null,
        }];
        popsUntilReset = (NUM_SPACES - numClues)**2;
        debug.log(`RESET    ${stack[0].sudoku.toString()}`);
      }

      const top = stack[stack.length - 1];
      const sudoku = top.sudoku;
      // sudoku._reduce();

      const filledCells = NUM_SPACES - sudoku.numEmptyCells;
      debug.log(`${filledCells}${(filledCells < 10) ? ' ' : ''}       ${sudoku.toString()}`);

      if (!sudoku.hasUniqueSolution()) {
        debug.log(`POP -NU-`);
        stack.pop();
        popsUntilReset--;
        continue;
      }

      if (sudoku.numEmptyCells >= (NUM_SPACES - numClues)) {
        debug.log(`SOLUTION ${sudoku.toString()}`);
        return sudoku;
      }

      if (top.nexts === null) {
        top.nexts = sudoku._getNextsSubtractive();
      }

      if (top.nexts.length > 0) {
        // Get a random next
        const next = chooseRandom(top.nexts, true);
        stack.push({ sudoku: next, nexts: null });
        // debug.log(`    ++++ ${next.toString()}`);
      } else {
        debug.log(`POP -NN-`);
        stack.pop();
        popsUntilReset--;
      }
    }

    return null;
  }

  /**
   * Generates a Sudoku board with the diagonal regions randomly filled.
   * @returns {Sudoku}
   */
  static configSeed() {
    return new Sudoku()._fillSections(0b100010001);
  }

  /**
   * Generates a random Sudoku configuration.
   * @param {object} options
   * @param {boolean} [options.normalize=false] (default: `false`) Whether to normalize the generated board.
   * @param {number} [options.timeOutMs=0] (default: `0` (no limit)) The maximum time to spend generating.
   * @returns {Sudoku | null} A valid configuration, or `null` if none was found.
   */
  static generateConfig({ normalize, timeOutMs } = {
    normalize: false,
    // TODO I don't think we need a timeout for generating configs
    timeOutMs: 0
  }) {
    const config = Sudoku.configSeed().firstSolution(timeOutMs);
    // config._clues = config.board;
    config.clues = config._digits;
    return normalize ? config.normalize() : config;
  }

  /**
   * Performs a solutions search for the board and returns the first found.
   * @param {object} options
   * @param {number} [options.timeOutMs=0] (default: `0` (no limit)) The maximum time to spend generating.
   * @returns {Sudoku | null} The first solution found, or `null` if none was found.
   */
  firstSolution(timeOutMs = 0) {
    const results = this.searchForSolutions2({
      timeOutMs,
      solutionFoundCallback: (solution) => false
    });
    return results.solutions.length > 0 ? results.solutions[0] : null;
  }

  /**
   * Normalizes the board by rearranging the digits so that the first row
   * contains the digits 1-9 sequentially.
   *
   * This will also update the initial values to match the new board.
   * @returns {Sudoku} Returns itself for convenience.
   * @throws {Error} If the top row is not full.
   */
  normalize() {
    if (!this._rows[0].isFull) {
      throw new Error('Top row must be full to normalize the board.');
    }

    const boardCopy = this._digits;
    for (let digit = 1; digit <= NUM_DIGITS; digit++) {
      const currentDigit = boardCopy[digit - 1];
      if (currentDigit !== digit) {
        swapAllInArr(boardCopy, currentDigit, digit);
        this._cells.forEach((cell) => {
          if (cell.digit === currentDigit) {
            cell.digit = digit;
          } else if (cell.digit === digit) {
            cell.digit = currentDigit;
          }

          if (cell.initialValue === currentDigit) {
            cell.initialValue = digit;
          } else if (cell.initialValue === digit) {
            cell.initialValue = currentDigit;
          }
        });
      }
    }

    // this._clues = this._clues.map((digit, ci) => ((digit > 0) ? boardCopy[ci] : 0));
    // this.setBoard(boardCopy);
    boardCopy.forEach((digit, ci) => this.setDigit(digit, ci));
    // TODO something?

    return this;
  }

  /**
   * Returns an array of Sudokus with each possible candidate filled in at the given cell.
   *
   * If no cell index is provided, a cell with the fewest candidates will be picked.
   *
   * If there are no empty cells, an empty array is returned.
   *
   * @param {number} [emptyCellIndex=-1] (in `[0, 80]`; default: `-1`) The index of the empty cell to fill.
   * If not provided or is negative or out of bounds, a cell with the fewest candidates will be picked.
   * @returns {Sudoku[]}
   */
  _getNextsAdditive(emptyCellIndex = -1) {
    emptyCellIndex = Number(emptyCellIndex) || -1;
    if (emptyCellIndex < 0 || emptyCellIndex >= NUM_SPACES) {
      emptyCellIndex = this._pickEmptyCell();
    }

    let result = [];
    if (emptyCellIndex >= 0) {
      result = this.getCandidates(emptyCellIndex).map((candidateDigit) => {
        const next = new Sudoku(this);
        next.setDigit(candidateDigit, emptyCellIndex);
        return next;
      });
    }

    return result;
  }

  /**
   * @returns {Sudoku[]}
   */
  _getNextsSubtractive() {
    return this._digits.reduce((nexts, val, i) => {
      if (val > 0) {
        const bCopy = new Sudoku(this);
        bCopy.setDigit(0, i);
        nexts.push(bCopy);
      }
      return nexts;
    }, []);
  }

  /**
   * Returns a set of antiderivative puzzles for the given puzzle.
   *
   * An antiderivative of a puzzle is the set of all puzzles extrapolated from
   * the given puzzle for each empty cell and for each empty cell's different
   * candidates.
   *
   * Note this means that the antiderivative set may contain invalid puzzles
   * or puzzles with multiple solutions, as 'cell's candidates' is not well defined here.
   * TODO check this last statement
   * @returns {Sudoku[]}
   */
  getAntiderivatives() {
    // For every antiderivative, check that it has a single or no solution
    const result = [];
    for (let ci = 0; ci < NUM_SPACES; ci++) {
      if (this.getDigit(ci) === 0) {
        for (const candidateDigit of this.getCandidates(ci)) {
          const next = new Sudoku(this);
          next.setDigit(candidateDigit, ci);
          result.push(next);
        }
      }
    }
    return result;
  }

  /**
   *
   * @param {number} regionMask A 9-bit mask where each bit represents a region
   * and whether to fill it with random digits.
   */
  _fillSections(regionMask) {
    for (let regIndex = 0; regIndex < NUM_DIGITS; regIndex++) {
      if ((regionMask & (1<<(NUM_DIGITS - 1 - regIndex))) > 0) {
        this.fillRegion(regIndex);
      }
    }
    return this;
  }

  /**
   * Fills the given region with the random digits 1-9 with no regard for board validity.
   * @param {number} regionIndex
   */
  fillRegion(regionIndex) {
    shuffle(SHUFFLED_DIGITS).forEach((digit, i) => this.setDigit(digit, indicesFor.region[regionIndex][i]));
  }

  /**
   * Determines whether the digits on the given board are the same as this board.
   * @param {Sudoku} other
   * @returns {boolean} True if the boards contain the same digits; otherwise false.
   */
  equals(other) {
    return this._digits.every((val, i) => val === other._digits[i]);
  }

  /**
   *
   * @returns {Sudoku[]}
   */
  getAllSolutions() {
    /** @type {Sudoku[]} */
    const results = [];
    // const board = puzzle.board.map(encode);
    this.searchForSolutions3({
      solutionFoundCallback: (solution, _numFound) => {
        debug.log(`SOLUTION FOUND >> ${solution.toString()}`);
        if (!results.some(s => s.equals(solution))) {
          results.push(solution);
        } else {
          debug.log('DUPLICATE SOLUTION IGNORED');
        }
        return true;
      }
    });

    return results;
  }

  /**
   * Performs a breadth-first search for sudoku solution(s) of the given board.
   * The given callback function is triggered when a solution is found. If the callback
   * returns `false`, the search will stop;
   * otherwise it will continue searching for solutions.
   *
   * @param {SolutionFoundCallback} solutionFoundCallback Called with a solution board when one is found.
   * If this returns `true`, then the search will continue for more solutions;
   * otherwise the search will stop.
   * @return {boolean} `true` if the search exhausted all possible solutions or hit maximum iterations; otherwise `false`.
   */
  searchForSolutions(solutionFoundCallback, maxIterations = Number.POSITIVE_INFINITY) {
    const root = new Sudoku(this);
    root._resetEmptyCells();
    const solutionQueue = [root];

    let iterations = 0;
    while (solutionQueue.length > 0 && iterations++ < maxIterations) {
      let possibleSolution = solutionQueue.shift();
      // debug.log(`> ${possibleSolution.toString()}`);

      if (possibleSolution._reduce()) {
        // debug.log(`R ${possibleSolution.toString()}`);
      }

      if (possibleSolution.numEmptyCells === 0) {
        if (possibleSolution.isSolved) {
          // debug.log(`! ${possibleSolution.toString()}`);
          if (!solutionFoundCallback(possibleSolution)) {
            return false;
          } else {
            // debug.log('continuing search...');
          }
        }
      } else {
        const emptyCellIndex = possibleSolution._pickEmptyCell();
        if (emptyCellIndex >= 0) {
          const candidates = possibleSolution.getCandidates(emptyCellIndex);
          if (candidates.length === 0) {
            // debug.log(`-`);
          } else {
            candidates.forEach((candidateDigit) => {
              const next = new Sudoku(possibleSolution);
              next.setDigit(candidateDigit, emptyCellIndex);
              solutionQueue.push(next);
              // debug.log(`+ ${next.toString()}`);
            });
          }
        }
      }
    }

    return (iterations < maxIterations);
  }

  /**
   * Performs a depth-first search for sudoku solution(s) of the given board.
   * The given callback function is triggered when a solution is found. If the callback
   * returns `false`, the search will stop;
   * otherwise it will continue searching for solutions.
   *
   * @param {object} options
   * @param {number} [options.timeOutMs=0] (default: `0` (no limit)) The maximum time to spend searching.
   * @param {(solution: Sudoku) => boolean} [options.solutionFoundCallback] Called with a solution when one is found.
   * If the callback returns truthy, the search will continue.
   * @return {{
   *  solutions: Sudoku[],
   *  iterations: number,
   *  branches: number,
   *  timeElapsedMs: number,
   *  complete: boolean,
   *  timedOut: boolean,
   *  terminatedByCallback: boolean
   * }} An object with the search results and metrics:
   * - `solutions` - The found solutions.
   * - `iterations` - The number of iterations performed, i.e., how many boards were checked.
   * - `branches` - The number of branches explored, i.e., how many times the algorithm picked an empty cell and tried solving it for each candidate.
   * - `timeElapsedMs` - The time elapsed.
   * - `complete` - Whether the entire search space was checked.
   * - `timedOut` - Whether the search timed out before completing.
   * - `terminatedByCallback` - Whether the search was terminated by the callback instead of checking the entire search space.
   */
  searchForSolutions2({
    timeOutMs = 0,
    solutionFoundCallback = (solution) => true
  }) {
    timeOutMs = Number(timeOutMs) || 0;

    const isTimeConstraint = timeOutMs > 0;
    const startTime = Date.now();

    const root = new Sudoku(this);
    root._resetEmptyCells();

    /**
     * @typedef {Object} SudokuNode
     * @property {Sudoku} sudoku
     * @property {Sudoku[] | null} nexts
     */

    /** @type {SudokuNode[]} */
    let stack = [{ sudoku: root, nexts: null }];

    const result = {
      /** @type {Sudoku[]} */
      solutions: [],
      iterations: 0,
      branches: 0,
      timeElapsedMs: 0,
      complete: false,
      timedOut: false,
      terminatedByCallback: false
    };

    while (stack.length > 0) {
      // Time check
      if (isTimeConstraint) {
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime >= timeOutMs) {
          debug.log(`searchForSolutions2> Time out after ${elapsedTime}ms.`);
          result.timedOut = true;
          break;
        }
      }

      const top = stack[stack.length - 1];
      const sudoku = top.sudoku;
      result.iterations++;
      // Reduce obvious candidates first. This may just solve the puzzle.
      sudoku._reduce();

      if (sudoku.isSolved) {
        result.solutions.push(new Sudoku(sudoku));
        stack.pop();
        if (Boolean(solutionFoundCallback(sudoku))) {
          continue;
        } else {
          result.terminatedByCallback = true;
          break;
        }
      }

      // Finds an empty cell to fill (with least candidates), then generates a collection
      // of Sudokus with each of the possible candidates filled in.
      // We'll need to check each of these for solutions.
      if (top.nexts === null) {
        top.nexts = sudoku._getNextsAdditive();
      }

      if (top.nexts.length > 0) {
        result.branches++;
        // Pick randomly from the list of nexts, and push it onto the stack.
        const next = chooseRandom(top.nexts, true);
        stack.push({ sudoku: next, nexts: null });
      } else {
        stack.pop();
      }
    }
    stack = null;

    result.complete = (!result.timedOut && !result.terminatedByCallback);
    result.timeElapsedMs = Date.now() - startTime;
    return result;
  }

  /**
   * Performs a depth-first search for sudoku solution(s) of the given board.
   * The given callback function is triggered when a solution is found. If the callback
   * returns `false`, the search will stop;
   * otherwise it will continue searching for solutions.
   *
   * @param {object} options
   * @param {number} [options.timeOutMs=0] (default: `0` (no limit)) The maximum time to spend searching.
   * @param {(solution: Sudoku, numFound: number) => boolean} [options.solutionFoundCallback] Called with a solution when one is found.
   * If the callback returns truthy, the search will continue.
   * @param {number} [options.concurrentBranches=81] Number of depth-first search branches
   * that can be explored concurrently. i.e., Maximum number of stacks the DFS can break out at one time. Each
   * stack takes turns progressing and checking for solutions. This helps prevent the scenario where some invalid
   * puzzles with few clues take a long time to find a second solution, due to the depth-first search space being
   * very large and taking significant time to backtrack.
   * @return {{
   *  solutions: Sudoku[],
   *  iterations: number,
   *  branches: number,
   *  timeElapsedMs: number,
   *  complete: boolean,
   *  timedOut: boolean,
   *  terminatedByCallback: boolean
   * }} An object with the search results and metrics:
   * - `solutions` - The found solutions.
   * - `iterations` - The number of iterations performed, i.e., how many boards were checked.
   * - `branches` - The number of branches explored, i.e., how many times the algorithm picked an empty cell and tried solving it for each candidate.
   * - `timeElapsedMs` - The time elapsed.
   * - `complete` - Whether the entire search space was checked.
   * - `timedOut` - Whether the search timed out before completing.
   * - `terminatedByCallback` - Whether the search was terminated by the callback instead of checking the entire search space.
   */
  searchForSolutions3({
    timeOutMs = 0,
    solutionFoundCallback = (solution, numFound) => true,
    concurrentBranches = 9,
  }) {
    timeOutMs = Number(timeOutMs) || 0;

    const isTimeConstraint = timeOutMs > 0;
    const startTime = Date.now();

    const root = new Sudoku(this);
    root._resetEmptyCells();

    /**
     * @typedef {Object} SudokuNode
     * @property {Sudoku} sudoku
     * @property {Sudoku[] | null} nexts
     */

    /** @type {SudokuNode[][]} */
    let stacks = [[{ sudoku: root, nexts: null }]];

    const result = {
      /** @type {Sudoku[]} */
      solutions: [],
      iterations: 0,
      branches: 0,
      timeElapsedMs: 0,
      complete: false,
      timedOut: false,
      terminatedByCallback: false
    };

    let emptyStacks = [];
    while (stacks.length > 0 && !result.terminatedByCallback) {
      // Time check
      if (isTimeConstraint) {
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime >= timeOutMs) {
          debug.log(`searchForSolutions3> Time out after ${elapsedTime}ms.`);
          result.timedOut = true;
          break;
        }
      }

      // Snapshot this since new stacks may be added during loop
      const numStacks = stacks.length;
      for (let i = 0; i < numStacks; i++) {
        const stack = stacks[i];

        if (stack.length === 0) {
          emptyStacks.push(i);
          continue;
        }

        const top = stack[stack.length - 1];
        const sudoku = top.sudoku;
        result.iterations++;
        // Reduce obvious candidates first. This may just solve the puzzle.
        sudoku._reduce();

        if (sudoku.isSolved) {
          result.solutions.push(new Sudoku(sudoku));
          stack.pop();
          if (Boolean(solutionFoundCallback(sudoku, result.solutions.length))) {
            continue;
          } else {
            result.terminatedByCallback = true;
            // stacks[i] = null;
            break;
          }
        }

        // Finds an empty cell to fill (with least candidates), then generates a collection
        // of Sudokus with each of the possible candidates filled in.
        // We'll need to check each of these for solutions.
        if (top.nexts === null) {
          top.nexts = shuffle(sudoku._getNextsAdditive());
        }

        if (top.nexts.length > 0) {
          // Pick randomly from the list of nexts, and push it onto the stack.
          result.branches++;
          stack.push({ sudoku: top.nexts.pop(), nexts: null });

          // If there are still more, and we haven't hit the branch limit, start a new stack.
          while (stacks.length < concurrentBranches && top.nexts.length > 0) {
            result.branches++;
            stacks.push([{ sudoku: top.nexts.pop(), nexts: null }]);
          }
        } else {
          stack.pop();
        }
      }

      // Remove empty stacks
      while (emptyStacks.length > 0) {
        stacks.splice(emptyStacks.pop(), 1);
      }
    }
    stacks = null;

    result.complete = (!result.timedOut && !result.terminatedByCallback);
    result.timeElapsedMs = Date.now() - startTime;
    return result;
  }

  /**
   * Sudoku Class Thing
   * @param {number[] | string | Sudoku} data
  */
 constructor(data = []) {
    /** NOTE: The props below are managed by this._cells, _rows, _cols, and _regions.*/

    /**
     * The Sudoku board, represented as an array of bit masks, each a length of `NUM_DIGITS` bits.
     * The masks correspond to the candidate values for each cell, e.g.:
     * - `0b000000001` = 1
     * - `0b000000010` = 2
     * - `0b000000100` = 3, and so on...
     * - `0b101110111` = candidates 1, 2, 3, 5, 6, 7, 9 (no 4 or 8)
     * - `0b111111111` = all candidates (1 - 9)
     * @type {number[]}
     */
    // TODO rename candidates
    this._board;

    /**
     *
     * @type {number[]}
     */
    this._digits;

    /** Tracks the number of empty cells on the board.*/
    this._numEmptyCells = NUM_SPACES;

    // TODO This isn't being tracked right now
    this._emptyCells = range(NUM_SPACES);

    /** Tracks whether the whole board is valid.*/
    this._isValid = false;

    this._cells = EMPTY_BOARD.map((_,ci)=>(new SudokuCell(ci, this)));
    this._rows = digitRange.map(i=>new SudokuRow(i, this._cells));
    this._cols = digitRange.map(i=>new SudokuCol(i, this._cells));
    this._regions = digitRange.map(i=>new SudokuRegion(i, this._cells));

    if (data instanceof Sudoku) {
      this._board = [...data._board];
      this._digits = [...data._digits];
      data._digits.forEach((digit, ci) => {
        this._cells[ci].initialValue = digit;
        this._cells[ci].digit = digit;
        // Area constraints, validity, _numEmptyCells will automatically set when setting the board
      });
    } else if (typeof data === 'string') {
      const invalid = 'Sudoku str is invalid';
      if (data.length > NUM_SPACES) throw new Error(`${invalid} (length)`);
      // Replace '-' and '.' with '0's
      let _str = data.replace(/-/g, '0'.repeat(NUM_DIGITS)).replace(/\./g, '0');
      if (_str.length !== NUM_SPACES) throw new Error(`${invalid} (length)`);
      if (!/^[0-9]+$/.test(_str)) throw new Error(`${invalid} (non-digit chars)`);

      this._board = [...EMPTY_BOARD];
      this._digits = [...EMPTY_BOARD];
      _str.split('').forEach((char, ci) => {
        const digit = Number(char);
        this._cells[ci].initialValue = digit;
        this._cells[ci].digit = digit;
      });
    } else if (Array.isArray(data)) {
      if (data.length !== NUM_SPACES) throw new Error(`Invalid board data (length)`);
      this._board = [...EMPTY_BOARD];
      this._digits = [...EMPTY_BOARD];
      data.forEach((digit, ci) => {
        this._cells[ci].initialValue = digit;
        this._cells[ci].digit = digit;
      });
    } else {
      throw new Error(`Invalid data type: ${typeof data}`);
    }
  }

  /** Returns a copy of the board.*/
  get board() { return this._digits.slice(); }
  /** Returns a copy of the board as a 2D array.*/
  get board2D() {
    const _digits = this.board;
    return Array(NUM_DIGITS).fill(0).map((_,r) => _digits.slice(r * NUM_DIGITS, (r + 1) * NUM_DIGITS));
  }

  /** The initial clues on the board.*/
  get clues() { return this._cells.map(cell => cell.initialValue); }
  set clues(newClues) {
    if (newClues.length !== NUM_SPACES) throw new Error(`Invalid clues data (length)`);
    newClues.forEach((digit, ci) => (this._cells[ci].initialValue = digit));
  }
  /** Counts the number of clues the board started with.*/
  get numClues() { return this._cells.reduce((res, cell) => (res += cell.isClue ? 1 : 0), 0); }


  // TODO: Not sure if this data really needs to be exposed. Maybe just access through other methods.
  /** The cells that make up the board.*/
  get cells() { return this._cells; }
  /** The rows that make up the board.*/
  get rows() { return this._rows; }
  /** The columns that make up the board.*/
  get cols() { return this._cols; }
  /** The regions that make up the board.*/
  get regions() { return this._regions; }

  /** The number of empty cells on the board.*/
  get numEmptyCells() { return this._numEmptyCells; }
  /** Whether the board is valid.*/
  get isValid() { return this._isValid; }
  /** Whether the board is full.*/
  get isFull() { return this._numEmptyCells === 0; }
  /** Whether the board is solved (full && valid).*/
  get isSolved() { return this.isFull && this.isValid; }

  // TODO Track this as digits are added and removed from the board. Then return in constant time.
  get mask() {
    return this._digits.reduce((acc, digit, ci) => (
      (digit > 0) ? (acc | CELL_MASKS[ci]) : acc
    ), 0n);
  }

  get emptyCellMask() {
    return this._digits.reduce((acc, digit, ci) => (
      (digit === 0) ? (acc | CELL_MASKS[ci]) : acc
    ), 0n);
  }

  /** Checks whether every row, column, and region is valid.*/
  isEveryAreaValid() {
    return (
      this._rows.every(area => area.isValid) &&
      this._cols.every(area => area.isValid) &&
      this._regions.every(area => area.isValid)
    );
  }

  /**
   * Sets the value of the board at the given index.
   * @param {number} digit
   * @param {number} index
   */
  setDigit(digit, index) {
    this._cells[index].digit = digit;
  }

  /**
   * Returns the digit at the given index.
   * @param {number} index
   * @returns {number}
   */
  getDigit(index) {
    return this._digits[index];
  }

  /**
   * Returns the current candidates for the cell at the given index.
   * @param {number} cellIndex
   * @returns {number[]}
   */
  getCandidates(cellIndex) {
    return CANDIDATE_DECODINGS[this._board[cellIndex]];
  }

  _getCandidatesEncoded(cellIndex) {
    // return ENCODER.slice(1).filter((encoded) => (this._board[cellIndex] & encoded) > 0);
    return CANDIDATES[this._board[cellIndex]];
  }

  /**
   * Clears all values and clues on the board. The result will be completely blank.
   */
  clear() {
    this._cells.forEach(cell => cell.digit = 0);
  }

  /**
   * Resets the board to its initial clues.
   */
  reset() {
    this._cells.forEach(cell => cell.reset());
  }

  /**
   * Returns a string representation of the board.
   * @returns {string}
   */
  toString() {
    return this._digits.join('').replace(/0/g, '.');
  }

  /**
   * Returns a multiline string representation of the board with border lines.
   * @returns {string}
   */
  toFullString() {
    return this._digits.reduce((str, digit, i) => {
      str += (digit > 0) ? digit.toString() : '.';
      str += (((((i+1)%3) === 0) && (((i+1)%9) !== 0)) ? ' | ' : '   ');

      if (((i+1)%9) === 0) {
        str += '\n';

        if (i < 80) {
          str += ((((Math.floor((i+1)/9)%3) == 0) && ((Math.floor(i/9)%8) != 0)) ?
            ' -----------+-----------+------------' :
            '            |           |            '
          );
          str += '\n  ';
        }
      }

      return str;
    }, '  ');
  }

  shuffleDigits() {
    shuffle(SHUFFLED_DIGITS).forEach((newDigit, i) => {
      this._cells.forEach(cell => {
        if (cell.digit === newDigit) {
          cell.digit = i + 1;
        } else if (cell.digit === i + 1) {
          cell.digit = newDigit;
        }

        if (cell.initialValue === newDigit) {
          cell.initialValue = i + 1;
        } else if (cell.initialValue === i + 1) {
          cell.initialValue = newDigit;
        }
      });

      this._digits = this._digits.map((val) => (val === newDigit) ? i + 1 : (val === i + 1) ? newDigit : val);
      this._board = this._board.map((val) => (val === newDigit) ? i + 1 : (val === i + 1) ? newDigit : val);

      // swapAllInArr(this._board, encode(newDigit), encode(i + 1));
      // swapAllInArr(this._clues, newDigit, i + 1);
    });
    this._resetEmptyCells();
    this._resetConstraints();
  }

  reflectOverHorizontal() {
    reflectOverHorizontal(this._board, NUM_DIGITS);
    // reflectOverHorizontal(this._clues, NUM_DIGITS);
    this._resetConstraints();
  }

  reflectOverVertical() {
    reflectOverVertical(this._board, NUM_DIGITS);
    // reflectOverVertical(this._clues, NUM_DIGITS);
    this._resetConstraints();
  }

  /**
   * Reflects the board values over the diagonal axis (line from bottomleft to topright).
   */
  reflectOverDiagonal() {
    reflectOverDiagonal(this._board);
    // reflectOverDiagonal(this._clues);
    this._resetConstraints();
  }

  reflectOverAntidiagonal() {
    reflectOverAntiDiagonal(this._board);
    // reflectOverAntiDiagonal(this._clues);
    this._resetConstraints();
  }

  rotate90() {
    rotateArr90(this._board);
    // rotateArr90(this._clues);
    this._resetEmptyCells();
    this._resetConstraints();
  }

  _resetConstraints() {
    this._cells.forEach(c=>c.reset());
  }

  /**
   * Resets empty cells to all candidates.
   * @param {number[]} board Encoded board values.
   */
  _resetEmptyCells() {
    this._cells.forEach((cell, ci) => {
      if (cell.digit === 0) {
        cell._candidatesMask = ALL;
        this._board[ci] = ALL;
      }
    });

    // this._board = this._board.map((val) => (isDigit(val) ? val : ALL));

    // TODO Does anything need to be done with the constraints?
  };

  /**
   *
   * @returns {boolean}
   */
  _reduce() {
    // let boardSolutionChanged = false;
    let hadReduction = false;
    const emptyCellsBefore = this._numEmptyCells;

    do {
      hadReduction = false;
      for (let i = 0; i < NUM_SPACES; i++) {
        hadReduction ||= this._reduce2(i);
        if (hadReduction) {
          // console.log(`reduced> ${boardSolution.board.map(decode).join('').replace(/0/g, '.')}`);
        }
        // boardSolutionChanged ||= hadReduction;
      }
    } while (hadReduction);

    return emptyCellsBefore !== this._numEmptyCells; // boardSolutionChanged;
  }

  /**
   *
   * @param {number} cellIndex
   * @returns {boolean}
   */
  _reduce2(cellIndex) {
    // let _board = boardSolution.board;
    const candidates = this._board[cellIndex];

    if (isDigit(candidates) || candidates <= 0) {
      return false;
    }

    // ? If candidate constraints reduces to 0, then the board is likely invalid.
    // TODO Reason out and test what happens when the board is invalid.
    // let reducedCandidates = (candidates & ~this._cellConstraints(cellIndex));
    let reducedCandidates = (candidates & ~this._cells[cellIndex].constraints);
    if (reducedCandidates <= 0) {
      // console.log(`reduce ${cellIndex} (${cellRow(cellIndex) + 1},${cellCol(cellIndex) + 1}): [${decode(candidates)}].  constraints reduced to 0... ERROR ERROR ERROR`);
      this.setDigit(0, cellIndex);
      return false;
    }

    // If by applying the constraints, the number of candidates is reduced to 1,
    // then the cell is solved.
    if (isDigit(reducedCandidates)) {
      // postDigit(boardSolution, cellIndex, decode(reducedCandidates));
      this.setDigit(decode(reducedCandidates), cellIndex);
      // this._board[cellIndex] = reducedCandidates;
      // constraints.add(cellIndex, decode(reducedCandidates));

    } else {
      const uniqueCandidate = this._hasUniqueCandidate(cellIndex);
      if (uniqueCandidate > 0) {
        // postDigit(boardSolution, cellIndex, decode(uniqueCandidate));
        // this._board[cellIndex] = uniqueCandidate;
        // constraints.add(cellIndex, decode(uniqueCandidate));
        this.setDigit(decode(uniqueCandidate), cellIndex);

        reducedCandidates = uniqueCandidate;
      } else {
        this._board[cellIndex] = reducedCandidates;
      }
    }

    if (reducedCandidates < candidates) {
      this._reduceNeighbors(cellIndex);
    }

    // Whether candidates for the given cell have changed.
    return candidates !== this._board[cellIndex];
  };

  /**
   *
   * @param {number} cellIndex
   * @returns {number}
   */
  _hasUniqueCandidate(cellIndex) {
    return this._getCandidatesEncoded(cellIndex).find((candidateMask) => (
      this._isCandidateUniqueInArea(indicesFor.row[row], cellIndex, candidateMask) ||
      this._isCandidateUniqueInArea(indicesFor.col[col], cellIndex, candidateMask) ||
      this._isCandidateUniqueInArea(indicesFor.region[region], cellIndex, candidateMask)
    )) || 0;
  }

  /**
   *
   * @param {number[]} areaIndices
   * @param {number} cellIndex
   * @param {number} candidateMask
   * @returns {boolean}
   */
  _isCandidateUniqueInArea(areaIndices, cellIndex, candidateMask) {
    const indices = areaIndices.filter((neighborIndex) => neighborIndex != cellIndex);
    return indices.every((neighborIndex) => (
      (this._board[neighborIndex] & candidateMask) === 0
    ));
  }

  /**
   *
   * @param {number} cellIndex
   * @returns {void}
   */
  _reduceNeighbors(cellIndex) {
    // System.out.printf("Relaxing neighbors of cell %d ...\n", cellIndex);
    [
      ...indicesFor.row[cellRow(cellIndex)],
      ...indicesFor.col[cellCol(cellIndex)],
      ...indicesFor.region[cellRegion(cellIndex)]
    ].filter((neighborIndex) => neighborIndex != cellIndex).forEach((neighborIndex) => this._reduce2(neighborIndex));

    // forEach((neighborIndex) => {
    //   if (neighborIndex != cellIndex) {
    //     this.reduce2(neighborIndex);
    //   }
    // });
    // System.out.printf("Done relaxing neighbors of cell %d ...\n", cellIndex);
  }

  /**
   *
   * @returns {number}
   */
  _findFirstEmptyCell() {
    return this._board.findIndex((val) => !isDigit(val));
  }

  /**
   * Finds the index of an empty cell which contains the fewest candidates.
   * @return {number} Cell index, or `-1` if there are no empty cells.
   */
  _pickEmptyCell() {
    let minCandidates = NUM_DIGITS + 1;
    const _numCandidatesMap = this._board.reduce((map, _, ci) => {
      const numCandidates = this.getCandidates(ci).length;
      if (numCandidates > 1 && numCandidates < minCandidates) {
        minCandidates = numCandidates;
      }
      map[numCandidates].push(ci);
      return map;
    }, range(NUM_DIGITS + 1).map(_=>[]));

    // If there are no empty cells, then minCandidates would not have changed
    if (minCandidates === (NUM_DIGITS + 1)) return -1;

    return chooseRandom(_numCandidatesMap[minCandidates]);
  }

  /**
   * Determines whether this puzzle has a single solution.
   * @returns {boolean} True if the puzzle has a unique solution; otherwise false.
   */
  hasUniqueSolution() {
    return this.solutionsFlag() === 1;
  }

  /**
   * Performs a solution search and returns a value indicating the number of solutions.
   *
   * The search will stop early if a second solution is found. Otherwise, the search will
   * will continue until the entire search space is checked.
   *
   * Note: If the board has fewer than the minimum `17` clues, then this returns `2` automatically.
   * @returns {number} Value indicating the number of solutions:
   * - `0` - No solution.
   * - `1` - A single solution.
   * - `2 or higher` - Multiple solutions.
   */
  solutionsFlag() {
    if (this.numEmptyCells > (NUM_SPACES - MIN_CLUES)) return 2;
    const searchResults = this.searchForSolutions3({
      solutionFoundCallback: (_solution, numFound) => (numFound < 2)
    });
    // console.log(`searchForSolutions3 (${(searchResults.timeElapsedMs > 2000) ? '🚨' : ''}${searchResults.timeElapsedMs}ms): ${this.toString()} ${JSON.stringify(searchResults)}`);
    return searchResults.solutions.length;
  }

  /**
   * Attempts to solve this board.
   * The board values will be updated only if a single solution is found.
   * @returns {boolean} True if there is a single solution; otherwise false.
   */
  solve() {
    const result = this.searchForSolutions3({
      solutionFoundCallback: (_solution, numFound) => (numFound < 2)
    });

    if (!result.complete || result.solutions.length !== 1) return false;
    result.solutions[0].board.forEach((digit, ci) => {
      this._cells[ci].digit = digit;
    });

    return true;
  }

  /**
   * TODO Not yet implemented.
   *
   * Determines whether this puzzle is in a prime invalid form.
   *
   * Prime invalid form means that the puzzle is unresolvable and each empty cell,
   * when filled in with the corresponding value from the config, results in a puzzle
   * that has a unique solution (the given config).
   * @param {Sudoku} config
   * @returns {boolean}
   */
  isPrimeInvalid(config) {
    // TODO
    return false;
  }
}

export default Sudoku;
