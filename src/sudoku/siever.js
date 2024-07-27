import { range } from '../util/arrays.js';
import { bounded } from '../util/common.js';
import Debugger from '../util/debug.js';
import {
  bitCombo,
  bitComboToR,
  factorial,
  nChooseK
} from '../util/perms.js';
import Sudoku, {
  NUM_DIGITS,
  NUM_SPACES,
  cellCol,
  cellRegion,
  cellRegion2D,
  cellRow,
  indicesFor
} from './Sudoku.js';
import SudokuSieve from './SudokuSieve.js';
import { searchForPrimeInvalidFromMask, sieveCombos4, SuperSet, verifySieveItems } from './exp2.js';
// import { verifySieveItems } from './exp2.js';

const debug = new Debugger(true);

// Invalid Sudoku sieve
// The sieve contains contains 81 subarrays, each containing invalid puzzle bitmasks
// with the number of clues indicated via the index of the subarray.
// The sieve is built from the top down, starting with the maximum number of clues (80).
// Sieve items are stored as BigInts, with each bit representing a cell in the puzzle.
// All puzzles whose clues overlap with the bitmasks in the sieve are invalid derivatives
// and are not stored in the sieve.
// Not all subarrays will contain elements, as some clue counts may not have any invalid puzzles, eg, 80.

/**
 *
 * @param {Sudoku} config Sudoku configuration to use as the basis for the sieve
 * @param {number} minK Minimum number of clues to consider
 * @returns {BigInt[][]} The invalid puzzle sieve
 */
export function createSieve(config, minK = 77) {
  const _config = new Sudoku(config);

  /** @type {BigInt[][]} */
  let sieve = Array(81).fill(0).map(() => []);

  // const config = Sudoku.generateConfig({ normalize: true });
  for (let k = 80; k >= minK; k--) {
    const nck = nChooseK(81, k);

    // const onePercent = nck / 100n;
    for (let bigR = 0n; bigR < nck; bigR++) {
      // if ((bigR % onePercent) === 0n) {
      //   console.log(`k=${k} ${Number(bigR / onePercent)}%`);
      // }

      // TODO Ensure this function (createSieve) is working correctly, since original bitCombo was
      // TODO   replaced by bitCombo2. The two *should* have been functioning the exact same.
      const mask = bitCombo(81, k, bigR);

      // Check all sieve items starting from the end of the sieve
      let isDerivative = false;
      for (let i = 80; i > k && !isDerivative; i--) {
        for (let j = 0; j < sieve[i].length && !isDerivative; j++) {
          if ((mask & (~sieve[i][j])) === 0n) {
            isDerivative = true;
          }
        }
      }

      if (isDerivative) {
        continue;
      }

      // const puzzle = Sudoku.mask(_config, mask);
      const puzzle = _config.filter(mask);
      if (!puzzle.hasUniqueSolution()) {
        sieve[k].push(mask);
        debug.log(puzzle.toString());
      }
    }
  }

  return sieve;
}

// const config = Sudoku.generateConfig({ normalize: true });
// const sieve = createSieve(config, 77);

/**
 *
 * @param {Sudoku} config
 * @returns
 */
function thing(config) {
  const board = config.board2D;
  // Create a lookup table for the board such that table[row][digit] = column
  const colDigitTransform = Array(9).fill(0).map(() => Array(9).fill(0));
  // And another for the board such that table[column][digit] = row
  const rowDigitTransform = Array(9).fill(0).map(() => Array(9).fill(0));
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const digit = board[row][col];
      colDigitTransform[row][digit] = col;
      rowDigitTransform[col][digit] = row;
    }
  }
}

/**
 * Locates unsolvable pairs in a Sudoku configuration.
 * An unsolvable pair is a pair of 4 cells that, when removed, render the puzzle unsolvable.
 *
 * @param {Sudoku} config
 * @returns {bigint[]}
 */
export function findUnsolvablePairs(config) {
  debug.log(`findUnsolvablePairs(${config.toString()})`);
  const board = config.board2D;

  // Create a lookup table for the board such that table[row][digit] = column
  const colDigitTransform = Array(9).fill(0).map(() => Array(9).fill(0));
  // And another for the board such that table[column][digit] = row
  const rowDigitTransform = Array(9).fill(0).map(() => Array(9).fill(0));
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const digit = board[row][col];
      colDigitTransform[row][digit] = col;
      rowDigitTransform[col][digit] = row;
    }
  }

  const pairs = [];

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      // Checking through the row
      for (let c = 0; c < 9; c++) {
        if (c === col) {
          continue;
        }

        // Locate the row of second digit in the column of the first
        const r = rowDigitTransform[col][board[row][c]];
        if (!isUnsolvablePair(config, row, col, r, c)) {
          continue;
        }

        const invalidPuzzleR = bitComboToR(81, 77, BigInt(`0b${'1'.repeat(81)}`) & ~(
          (1n << BigInt(80 - (row * 9 + col))) |
          (1n << BigInt(80 - (row * 9 + c))) |
          (1n << BigInt(80 - (r * 9 + col))) |
          (1n << BigInt(80 - (r * 9 + c)))
        ));

        // Ensure that the puzzle mask is not already in the list
        if (!pairs.includes(invalidPuzzleR)) {
          pairs.push(invalidPuzzleR);
          // debug.log(Sudoku.mask(config, bitCombo(81, 77, invalidPuzzleR)).toString());
          debug.log(config.filter(bitCombo(81, 77, invalidPuzzleR)).toString());
        }
      }

      // Checking through the column
      for (let r = 0; r < 9; r++) {
        if (r === row) {
          continue;
        }

        // Locate the column of second digit in the row of the first
        const c = colDigitTransform[row][board[r][col]];
        if (!isUnsolvablePair(config, row, col, r, c)) {
          continue;
        }

        const invalidPuzzleR = bitComboToR(81, 77, BigInt(`0b${'1'.repeat(81)}`) & ~(
          (1n << BigInt(80 - (row * 9 + col))) |
          (1n << BigInt(80 - (row * 9 + c))) |
          (1n << BigInt(80 - (r * 9 + col))) |
          (1n << BigInt(80 - (r * 9 + c)))
        ));

        // Ensure that the puzzle mask is not already in the list
        if (!pairs.includes(invalidPuzzleR)) {
          pairs.push(invalidPuzzleR);
          // debug.log(`${Sudoku.mask(config, invalidPuzzleR).toString()}`);
          debug.log(`${config.filter(invalidPuzzleR).toString()}`);
        }
      }
    }
  }

  return pairs;
}

export function isUnsolvablePair(config, r1, c1, r2, c2) {
  const board = config.board2D;
  const d1 = board[r1][c1];
  const d2 = board[r2][c2];
  const d3 = board[r1][c2];
  const d4 = board[r2][c1];
  const region1 = cellRegion2D(r1, c1);
  const region2 = cellRegion2D(r2, c2);
  const region3 = cellRegion2D(r1, c2);
  const region4 = cellRegion2D(r2, c1);

  const result = (
    (d1 === d2) &&
    (d3 === d4) &&
    (d1 !== d3) &&
    (region1 !== region2) &&
    (region3 !== region4) &&
    (
      ((region1 === region3) && (region2 === region4)) ||
      ((region1 === region4) && (region2 === region3))
    )
  );

  return result;
}

// TODO Remove later - This is here to catch the seen caching in CPU perf
/**
 * @typedef {Object} Memo
 * @property {Set<BigInt>} seen
 * @property {(mask: BigInt) => boolean} has
 * @property {(mask: BigInt) => void} add
 */

/**
 *
 * @returns {Memo}
 */
function _memo() {
  const seen = new Set();

  return {
    seen,
    has(mask) {
      return seen.has(mask);
    },
    add(mask) {
      seen.add(mask);
    }
  };
}

function cellMask(ci) {
  return (1n << BigInt(80 - ci));
}

class Chain {
  /**
   * @param {number[]} configBoard
   */
  constructor(configBoard) {
    /** @type {number[]} */
    this._board = configBoard.slice();

    /** @type {number[]} */
    this._cells = [];
    this._length = 0;

    this._mask = 0n;
    this._hash = 0n;

    /** @type {number[][]} */
    this._rows = Array(9).fill(0).map(() => []);
    this.numRows = 0;

    /** @type {number[]} */
    this._cols = Array(9).fill(0).map(() => []);
    this.numCols = 0;

    /** @type {number[][]} */
    this._regions = Array(9).fill(0).map(() => []);
    this.numRegions = 0;

    /** @type {number[]} */
    this._digitCounts = [0,0,0,0,0,0,0,0,0];
    this.distinctDigits = 0;
    this.singleDigits = 0; // Bitmask of digits that only appear once in the chain
  }

  get mask() { return this._mask; }
  get cells() { return this._cells.slice(); }
  get length() { return this._length; }
  get root() { return this._cells[0]; }
  get tail() { return this._cells[this._length - 1]; }
  get hash() { return this._hash; }

  /**
   *
   * @param {number} ci
   */
  nextHash(ci) {
    return (this._hash << 7n) + BigInt(ci);
  }

  hasSingleDigits() {
    return this.singleDigits > 0;
  }

  has(ci) {
    return this._mask & cellMask(ci);
  }

  add(ci) {
    if (typeof ci !== 'number' || ci < 0 || ci >= NUM_SPACES) {
      throw new Error(`Invalid cell index: ${ci} (type: ${typeof ci})`);
    }

    this._cells.push(ci);
    this._length++;
    this._mask |= cellMask(ci);
    this._hash <<= 7n;
    this._hash += BigInt(ci);

    const digit = this._board[ci];
    const di = digit - 1;
    this._digitCounts[di]++;
    if (this._digitCounts[di] === 1) {
      this.distinctDigits++;
      this.singleDigits |= (1 << (di));
    } else {
      this.singleDigits &= ~(1 << (di));
    }

    const row = cellRow(ci);
    if (this._rows[row].length === 0) {
      this.numRows++;
    }
    this._rows[row].push(ci);

    const col = cellCol(ci);
    if (this._cols[col].length === 0) {
      this.numCols++;
    }
    this._cols[col].push(ci);

    const region = cellRegion(ci);
    if (this._regions[region].length === 0) {
      this.numRegions++;
    }
    this._regions[region].push(ci);
  }

  pop() {
    const ci = this._cells.pop();
    this._length--;
    this._mask &= ~cellMask(ci);
    this._hash >>= 7n;

    const digit = this._board[ci];
    const di = digit - 1;
    this._digitCounts[di]--;
    if (this._digitCounts[di] === 0) {
      this.distinctDigits--;
    }

    if (this._digitCounts[di] === 1) {
      this.singleDigits |= (1 << (di));
    } else {
      this.singleDigits &= ~(1 << (di));
    }

    const row = cellRow(ci);
    this._rows[row].pop();
    if (this._rows[row].length === 0) {
      this.numRows--;
    }

    const col = cellCol(ci);
    this._cols[col].pop();
    if (this._cols[col].length === 0) {
      this.numCols--;
    }

    const region = cellRegion(ci);
    this._regions[region].pop();
    if (this._regions[region].length === 0) {
      this.numRegions--;
    }
  }

  clear() {
    this._cells = [];
    this._length = 0;
    this._mask = 0n;
    this._hash = 0n;

    this._rows = Array(9).fill(0).map(() => []);
    this.numRows = 0;

    this._cols = Array(9).fill(0).map(() => []);
    this.numCols = 0;

    this._regions = Array(9).fill(0).map(() => []);
    this.numRegions = 0;

    this._digitCounts = [0,0,0,0,0,0,0,0,0];
    this.distinctDigits = 0;
    this.singleDigits = 0;
  }

  isCyclic() {
    return this._length > 3 && isRowOrColPeer(this.root, this.tail);
  }

  boardStr() {
    return this._board.map((digit, ci) => this._cells.includes(ci) ? digit : '.').join('');
  }

  toString() {
    return `{ mask: ${this._mask}, cells: [${this._cells.join(', ')}], cyclic: ${this.isCyclic()}; board: ${this.boardStr()} }`;
  }
}

function bitsStr(bits, length = 81) {
  return bits.toString(2).padStart(length, '0');
}

/**
 * Definitions:
 *    config: A completely full and valid sudoku board.
 *    chain: A set of cells on a sudoku board
 */

/**
 * Minimum possible unsolvable chain length.
 *
 * On a Sudoku configuration, an unsolvable chain is a set of cells such that
 * the removal of any cell from the chain results in an unsolvable puzzle.
 */
const minLength = 4;

/**
 * The minimum number of digits to consider for an unsolvable chain.
 */
const minDigits = 2;

/**
 *
 * @param {SudokuSieve} sieve The full Sudoku to use as the basis for the sieve.
 * @param {object} options
 * @param {number} options.maxLength The maximum length of a chain to consider.
 * @param {number} options.maxDigits The maximum number of digits to consider for a chain.
 * @param {({ name: string, data: object }) => void} options.eventCallback
 * @returns {SudokuSieve}
 */
export function searchForSieve2(sieve, options = { maxLength: minLength, maxDigits: minDigits }) {
  options = Object.assign({ maxLength: minLength, maxDigits: minDigits }, options);
  const maxLength = bounded(options?.maxLength ?? minLength, minLength, NUM_SPACES);
  const maxDigits = bounded(options?.maxDigits ?? minDigits, minDigits, NUM_DIGITS);
  // const sieve = options.sieve ?? [];

  // if (maxLength < MIN_LENGTH || maxDigits < MIN_DIGITS) {
  //   return [];
  // }

  // TODO Loop through all possible chain lengths, starting at 4
  // TODO ? Is it possible to skip all ODD chain lengths?

  // const maxStat = Math.floor(maxLength / 2);
  debug.log(`searchForSieve2({\n  config: ${sieve.config.toString()},\n  maxLength: ${maxLength},\n  maxDigits: ${maxDigits}\n})`);
  debug.log(sieve.config.toFullString());

  const configBoard = sieve.config.board;
  const board2D = sieve.config.board2D;

  /**
   * Lookup table[row][digit (- 1)] = column.
   *
   * Note: Index by `digit - 1` to get the column.
   * @type {number[][]}
   */
  const colDigitTransform = Array(9).fill(0).map(() => Array(9).fill(0));
  /**
   * Lookup table[column][digit (- 1)] = row.
   *
   * Note: Index by `digit - 1` to get the row.
   * @type {number[][]}
   */
  const rowDigitTransform = Array(9).fill(0).map(() => Array(9).fill(0));
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const digit = board2D[row][col];
      colDigitTransform[row][digit - 1] = col;
      rowDigitTransform[col][digit - 1] = row;
    }
  }

  /**
   * Contains board masks associated with each cell's possible chain (row and col) neighbors.
   * @type {bigint[]}
   */
  const NEXTS = Array(NUM_SPACES).fill(0n).map((_, ci) => {
    let mask = 0n;
    const row = cellRow(ci);
    const col = cellCol(ci);
    indicesFor.row[row].forEach((cj) => {
      if (cj !== ci) {
        mask |= cellMask(cj);
      }
    });
    indicesFor.col[col].forEach((cj) => {
      if (cj !== ci) {
        mask |= cellMask(cj);
      }
    });
    return mask;
  });

  /**
   * @param {number | bigint} digitsCombo array of digits to filter the nexts by
   * @returns {bigint[]} maps each cell to its row & col peers that contain the given digits
   */
  const getNexts = (digitsCombo) => {
    const _dc = BigInt(digitsCombo);
    // Build board mask for all cells holding the included digits.
    let filterMask = 0n;
    for (let ci = 0; ci < NUM_SPACES; ci++) {
      if (_dc & BigInt(1 << (configBoard[ci] - 1))) {
        filterMask |= cellMask(ci);
      }
    }

    return NEXTS.slice().map((mask, i) => ((mask & filterMask) & ~cellMask(i)));
  };

  const chains = [];

  let queueCount = 0;
  let seenCount = 0;
  let puzzleCheckCount = 0;
  let derivativeCount = 0;

  // TODO Remove after testing
  // const test_wanted = new Set([
  //   '21857463957389612446912357872145938635468179298623741514796..5369531..47832745961',
  //   '218574639573896124469123578721459386354681792986237415.479.2853.953.8247832745961',
  //   '218574639573896124469123578721459386354681.9.986237415147962853695318.4.832745961',
  //   '2185746395738961244691235787214593863546..7929862374151479628536953..247832745961',
  //   '218574639573896124469123578.21459.86.54681.92986237415147962853695318247832745961',
  //   '218574639573896124469123578.2145.386354681792.8623.415147962853695318247832745961',
  //   '218574639573896124469123578.2.459386354681792986237415.4.962853695318247832745961',
  //   '21.57463.57389612446.12357.721459386354681792986237415147962853695318247832745961',
  //   '.1.574639573896124469123578721459386354681792986237415147962853695318247.3.745961'
  // ].map(s => BigInt(`0b${s.replace(/[^.]/g, '0').replace(/\./g, '1')}`)));

  // const FULL_MASK = (1n << 81n) - 1n;

  /**
   * @typedef {Object} SearchSubspace
   * @property {number[]} digits
   * @property {Memo} cache
   * @property {number[][]} chains
   */

  /**
   * Search queue for finding chains. This is subdivided into smaller queues, where
   * the index is the bitcombo of digits
   * @type {SearchSubspace[]}
   */
  const queue = [
    ...range(2**9).map(r => {
      const digits = bitComboToDigits(9, BigInt(r)).map(d => d + 1);

      if (digits.length < 2 || digits.length > maxDigits) {
        return null;
      }

      return {
        digits,
        cache: _memo(),
        chains: configBoard.reduce((_chains, digit, ci) => {
          if (digits.includes(digit)) {
            _chains.push([ci]);
          }
          return _chains;
        }, [])
      };
    })
  ];

  const solvesUniquelyCache = {
    _yes: new Set(),
    _no: new Set(),

    _yesHits: 0,
    _noHits: 0,
    _misses: 0,

    _totalYesHits: 0,
    _totalNoHits: 0,
    _totalMisses: 0,

    /**
     *
     * @param {Sudoku} puzzle
     * @returns {boolean}
     */
    solvesUniquely: function(puzzle) {
      const key = puzzle.toString();
      if (this._yes.has(key)) {
        this._yesHits++;
        return true;
      } else if (this._no.has(key)) {
        this._noHits++;
        return false;
      }

      this._misses++;
      const result = puzzle.hasUniqueSolution();
      if (result) {
        this._yes.add(key);
      } else {
        this._no.add(key);
      }

      return result;
    },

    getStats: function() {
      return {
        yes: this._yes.size,
        no: this._no.size,
        yesHits: this._yesHits,
        noHits: this._noHits,
        misses: this._misses,
        totalYesHits: this._totalYesHits + this._yesHits,
        totalNoHits: this._totalNoHits + this._noHits,
        totalMisses: this._totalMisses + this._misses
      };
    },

    rollStats: function() {
      this._totalYesHits += this._yesHits;
      this._totalNoHits += this._noHits;
      this._totalMisses += this._misses;
      this._yesHits = 0;
      this._noHits = 0;
      this._misses = 0;
    }


  };

  // prints the 81-bit board mask as a 9x9 grid
  /**
   *
   * @param {bigint} mask
   */
  function boardMaskStr(mask) {
    let str = mask.toString(2).padStart(81, '0');
    return (
      ` ${str.slice(0, 9)}\n` +
      `  ${str.slice(9, 18)}\n` +
      `  ${str.slice(18, 27)}\n` +
      `  ${str.slice(27, 36)}\n` +
      `  ${str.slice(36, 45)}\n` +
      `  ${str.slice(45, 54)}\n` +
      `  ${str.slice(54, 63)}\n` +
      `  ${str.slice(63, 72)}\n` +
      `  ${str.slice(72, 81)}`
    );
  }

  // const isQueueEmpty = () => queue.every(subspace => subspace.chains.length === 0);

  const chain = new Chain(configBoard);

  // /** @type {Set<bigint>} */
  // const seen = new Set();
  const seen = SuperSet();

  let totalIterations = 0n;

  for (let ci = 0; ci < NUM_SPACES; ci++) {
    // const rootRow = cellRow(ci);
    // const rootCol = cellCol(ci);
    // const rootRegion = cellRegion(ci);
    const rootDigit = configBoard[ci];
    const bigRootDigit = BigInt(rootDigit);
    const bigRootDigitCombo = 1n << (bigRootDigit - 1n);

    // For each number of digits (k in [2, maxDigits]) and each bitcombo in 9 choose k,
    //    work through the search subspace to find all sieve chains.
    for (let k = 1; k < maxDigits; k++) {
      const nck = nChooseK(8, k);
      // For each bitcombo of 8 choose k
      for (let bigR = 0n; bigR < nck; bigR++) {
        const dc = bitCombo(8, k, bigR);

        // function getdc(rootDigit, digCombo) {
        //   const _bd = BigInt(rootDigit);
        //   const _dc = BigInt(digCombo);
        //   // let digitsCombo = (_dc >> (_bd - 1n));
        //   digitsCombo <<= _bd;
        //   const bigRootDigitMask = (1n << (_bd - 1n));
        //   digitsCombo |= bigRootDigitMask;
        //   digitsCombo |= (_dc & (bigRootDigitMask - 1n));
        //   return digitsCombo;
        // }

        // Interject the 9th digit into the correct position within digitsCombo
        let digitsCombo = (dc >> (bigRootDigit - 1n));
        digitsCombo <<= bigRootDigit;
        const bigRootDigitMask = (1n << (bigRootDigit - 1n));
        digitsCombo |= bigRootDigitMask;
        digitsCombo |= (dc & (bigRootDigitMask - 1n));

        const nexts = getNexts(digitsCombo);

        seen.clear();

        // for (let cj = ci; cj < NUM_SPACES; cj++) {
        if (digitsCombo & bigRootDigitCombo) {
          // chain should be empty here
          if (chain.length > 0) {
            console.log(`🚨 chain is expected to be empty but has length ${chain.length}`);
          }

          chain.add(ci);

          // TODO Potential optimization: If the root has no available neighbors, skip the chain
          // let rootNeighborsAvailable = node.nexts.filter(ci => !digits.includes(configBoard[ci])).length;
          let rootNeighborsAvailable = nexts[ci];

          const startTime = Date.now();
          queueCount = 0;
          derivativeCount = 0;
          puzzleCheckCount = 0;
          let singleDigitFailCount = 0;
          let distinctDigitFailCount = 0;
          let mathFailCount = 0;
          let uniqueSolutionCount = 0;
          let antiderivativeFailCount = 0;
          let deadendCount = 0;
          let chainLengthMaxedCount = 0;

          let lastUpdate = startTime;
          let numUpdates = 0;
          const UPDATE_INTERVAL_MS = 1000*15;

          // DFS using `chain` as the stack
          while (chain.length > 0) {
            totalIterations++;
            const tail = chain.tail;
            const tailNexts = nexts[tail] & ~chain.mask;
            // const tailNextsCis = bitComboToDigits(81, tailNexts);

            // let boardStrs = sieve.config.filter(chain.mask).toString().split('');
            // for (let tailNextCi of tailNextsCis) {
            //   // debug.log(`marking tail next ci: ${tailNextCi}`);
            //   if (boardStrs[tailNextCi] !== '.') {
            //     console.log(`🚨 tailNextCi ${tailNextCi} is not available`);
            //     continue;
            //   }
            //   // Set character in boardStr to '*'
            //   boardStrs[tailNextCi] = '*';
            // }

            // debug.log(
            //   `{ ci: ${ci}, ` +
            //   `dc: ${bitsStr(digitsCombo, 9)}, ` +
            //   `mask: ${chain.mask}, ` +
            //   // `tailNexts: ${tailNexts.toString(2).padStart(81,'0')}, ` +
            //   `board: ${boardStrs.join('')}, ` +
            //   `cells: ${chain.cells.join(',')} }`
            //   // `nexts: ${tailNextDigits.join(', ')}, ` +
            //   // `chain: ${chain.toString()} }`
            // );

            const now = Date.now();
            const timeSinceLastUpdate = now - lastUpdate;
            if (timeSinceLastUpdate > UPDATE_INTERVAL_MS) {
              numUpdates++;
              lastUpdate = now;
              // debug.log(`#   { time: ${now - startTime}ms,` +
              //   ` queued: ${queueCount},` +
              //   ` derivatives: ${derivativeCount},` +
              //   ` singleDigitFilter: ${singleDigitFailCount},` +
              //   ` distinctDigitFilter: ${distinctDigitFailCount},` +
              //   ` mathFilter: ${mathFailCount},` +
              //   ` puzzlesChecked: ${puzzleCheckCount},` +
              //   ` uniqueSol: ${uniqueSolutionCount},` +
              //   ` antiderivFail: ${antiderivativeFailCount},` +
              //   ` deadend: ${deadendCount},` +
              //   ` chainMaxed: ${chainLengthMaxedCount} }`
              // );
              // debug.log(`  =>{ solvesUniquelyCache: ${JSON.stringify(solvesUniquelyCache.getStats())} }`);
            }

            queueCount++;

            // Skip if the chain is a derivative of a previous chain
            const sieveItem = (
              sieve.has(chain.mask) ||
              sieve.isDerivative(chain.mask) ||
              chains.some(_chain => (_chain & chain.mask) === _chain)
            );
            if (sieveItem) {
              // debug.log(`  ❌ derivative`);
              // debug.log(`  ${sieveItem.toString(2).padStart(81, '0')}`);
              // debug.log(`- ${chainMask.toString(2).padStart(81, '0')}`);
              derivativeCount++;
              seen.add(chain.hash);

              // stack.pop();
              const tail = chain.tail;
              chain.pop();
              if (chain.length > 0) nexts[chain.tail] |= cellMask(tail);

              continue;
            }

            // debug.log(`  ${config.filterIndices(chain).toString()}`);

            // TODO If the chain length >= minimum target length (2 * k),
            // TODO   AND the first and last cells are row or column peers,
            // TODO   THEN check if the chain is irreducible, NOT uniquely solvable, and all antiderivatives are uniquely solvable.
            if (chain.length >= 2*(k+1) && chain.isCyclic()) {
              // debug.log(chainPuzzle.toFullString());
              let passing = true;

              // const chainPuzzle = config.keepIndices(chain);
              // const chainBoard = config.board.map((digit, ci) => (chain.includes(ci) ? 0 : digit));
              // const stats = analyzeEmptyCellChain(configBoard, chain);
              const m = chain.length;
              const numRows = chain.numRows;
              const numCols = chain.numCols;
              const numRegions = chain.numRegions;
              const distinctDigits = chain.distinctDigits;
              // const noSingleDigits = !chain.hasSingleDigits()
              // const noSingleDigits = stats.digitCounts.every((count) => (count === 0 || count > 1));

              if (chain.hasSingleDigits()) {
                // debug.log('  - not all digits have complements');
                passing = false;
                singleDigitFailCount++;
              }

              if (distinctDigits !== k + 1) {
                // debug.log(`  - distinct digits (${distinctDigits}) !== k + 1 (${k + 1})`);
                passing = false;
                distinctDigitFailCount++;
              }

              // Debug If chainBoard looks like this:
              // '.1.574639573896124469123578721459386354681792986237415147962853695318247.3.745961'
              // 1511157274518286468383040n (associated chainMask for future ref)
              // if (chainBoard.join('').replace(/0/g, '.') === '2.8.74.395738961244.9.23.78721459386354681792986237415147962853695318247832745961') {
              //   debug.log(`> ${chainBoard.join('').replace(/0/g, '.')}`);
              // }

              // Check common properties of unsolvable chains
              if (
                passing && (
                  // numRows, numCols, and numRegions must be at least 2
                  numRows < 2 || numRows === m ||
                  numCols < 2 || numCols === m ||
                  numRegions < 2 || numRegions === m ||

                  // numRows * numCols must be at least m
                  // TODO Can this be proven mathematically?
                  numRows * numCols < m ||

                  // numDigits must be at most m / 2
                  distinctDigits > m / 2 ||

                  // When rows or cols or regions are 2,
                  ((numRows === 2 || numCols === 2 || numRegions === 2) && (
                    // rows * cols must equal m
                    numRows * numCols !== m ||

                    // numDigits must be m / 2
                    distinctDigits !== m / 2
                  ))
                )
              ) {
                // debug.log('  - not a chain');
                passing = false;
                mathFailCount++;
              }

              // TODO Find a better way to test for irreducibility than actually solving, if possible
              if (passing) {
                // const puzzle = config.filterOutIndices(chain.cells);
                const puzzle = sieve.config.filter(~chain.mask);
                puzzleCheckCount++;
                const solvesUniquely = solvesUniquelyCache.solvesUniquely(puzzle);
                if (solvesUniquely) {
                // if (puzzle.hasUniqueSolution()) {
                  // debug.log('  - has unique solution');
                  uniqueSolutionCount++;
                } else {
                  // debug.log('  - some antiderivatives have zero or multiple solutions');
                  const antiderivatives = antiderivativePuzzles(puzzle);
                  // antiderivatives.some((p) => !p.hasUniqueSolution())
                  let allGucci = true;
                  for (let i = 0; i < antiderivatives.length; i++) {
                    puzzleCheckCount++;
                    if (!solvesUniquelyCache.solvesUniquely(antiderivatives[i])) {
                    // if (!antiderivatives[i].hasUniqueSolution()) {
                      // debug.log('  - some antiderivatives have zero or multiple solutions');
                      allGucci = false;
                      antiderivativeFailCount++;
                      break;
                    }
                  }

                  if (allGucci) {
                    // debug.log('  ✅ All antiderivatives have unique solutions.');
                    // debug.log(`${chains.length}  ✅ ${sieve.config.filter(~chain.mask).toString()}`);
                    // debug.log(new Sudoku(chainBoard).toFullString() + '\n');
                    chains.push(chain.mask);
                    sieve.add(chain.mask);


                    // stack.pop();
                    const tail = chain.tail;
                    chain.pop();
                    if (chain.length > 0) nexts[chain.tail] |= cellMask(tail);
                    continue;

                    // Remove all search space items that are derivatives of this chain
                    // const beforeRemovalLength = queue.length;
                    // subspace.chains = subqueue.filter((_chain) => {
                    //   const _chainMask = _chain.reduce((mask, chainCI) => mask | (1n << BigInt(80 - chainCI)), 0n);
                    //   return ((chainMask & _chainMask) !== _chain);
                    // });
                    // debug.log(`  - removed ${beforeRemovalLength - queue.length} derivative chains`);
                  }
                }
              }
            }

            if (
              chain.length >= maxLength
              // numRows > maxStat ||
              // numCols > maxStat ||
              // numRegions > maxStat
            ) {
              // debug.log('  ❌ max length');
              chainLengthMaxedCount++;
              seen.add(chain.hash);
              // stack.pop();
              const tail = chain.tail;
              chain.pop();
              if (chain.length > 0) nexts[chain.tail] |= cellMask(tail);
              continue;
            }

            // ! Dead end check: Root has no more available neighbors
            if ((nexts[ci] & ~chain.mask) === 0n) {
              // debug.log('  ❌ no root neighbors available');
              seen.add(chain.hash);
              deadendCount++;
              // stack.pop();
              const tail = chain.tail;
              chain.pop();
              if (chain.length > 0) nexts[chain.tail] |= cellMask(tail);
              continue;
            }

            // Choose the next cell to add to the chain
            // Remove the chosen cell from the available neighbors

            // const tail = chain.tail;
            // const tailNexts = nexts[tail];

            // Find the first available neighbor that is not already part of the chain.
            let nextFound = false;
            let next = ci + 1;
            let nextNeighborMask = cellMask(next);
            while (nextNeighborMask > 0n) {
              if (
                (tailNexts & nextNeighborMask) &&
                !(chain.mask & nextNeighborMask) &&
                !seen.has(chain.nextHash(next))
              ) {
                // next = cj;
                nextFound = true;
                break;
              }

              next++;
              nextNeighborMask >>= 1n;
            }

            if (!nextFound) {
              // debug.log('  ❌ no available neighbors');
              seen.add(chain.hash);
              deadendCount++;
              // stack.pop();
              const tail = chain.tail;
              chain.pop();
              // debug.log(`tail: ${tail}; chain: ${chain.toString()}; nexts[chain.tail]: ${nexts[chain.tail]}`);
              if (chain.length > 0) nexts[chain.tail] = (BigInt(nexts[chain.tail]) | BigInt(cellMask(tail)));
              continue;
            } else {
              // stack.push(next);
              chain.add(next);
              // seen.add(chain.hash);
              // debug.log(`  + ${next}`);

              // Remove the chosen cell from the available neighbors
              nexts[tail] &= ~nextNeighborMask;
              // rootNeighborsAvailable &= ~nextNeighborMask;
            }
          }

          const timed = Date.now() - startTime;
          debug.log(
            `  =>{ time: ${timed}ms,` +
            ` totalIterations: ${totalIterations},` +
            ` ci: ${ci}, ` +
            ` dc: ${bitsStr(digitsCombo, 9)}, ` +
            ` queued: ${queueCount},` +
            ` derivatives: ${derivativeCount},` +
            ` singleDigit: ${singleDigitFailCount},` +
            // ` distinctDigitFilter: ${distinctDigitFailCount},` +
            ` mathFilter: ${mathFailCount},` +
            ` puzzlesChecked: ${puzzleCheckCount},` +
            ` uniqueSol: ${uniqueSolutionCount},` +
            // ` antiderivFail: ${antiderivativeFailCount},` +
            ` deadends: ${deadendCount},` +
            ` chainMaxed: ${chainLengthMaxedCount} }`
          );
          // debug.log(`  =>{ solvesUniquelyCache: ${JSON.stringify(solvesUniquelyCache.getStats())} }`);
          solvesUniquelyCache.rollStats();
        }
        // }

        // TODO chainMask needs to be kept track of throughout the next whileloop
        // /** @type {number[][]} */
        // const stack = [root];

        // /** @type {number[]} */
        // const subqueue = [];
        // /** @type {number[]} */
        // const visited = [];
        // for (let j = ci + 1; j < NUM_SPACES; j++) {
        //   if (digits.includes(configBoard[j])) {
        //     subqueue.push({
        //       ci: j,
        //       nexts: config.getPeerIndices(j)
        //     });
        //   }
        // }
        // seenIndices[ci] = true;
        // if (!digits.includes(configBoard[ci])) {
        //   continue;
        // }

        // TODO is there a good way to use a cache here? (somewhere around here...)

        // const subqueue = [[ci]];
        // TODO debug log the subspace digits and stuff
        // TODO keep track of search stats for each subspace and print them out at the end
        // debug.log(`  - Searching subspace @index [${ci}]: digits ${digits}`);
        // debug.log(`  - Searching subspace[${subspaceIndex}]: digits ${subspace.digits}`);

        // chain.add(node.ci);

        // const startTime = Date.now();
        // queueCount = 0;
        // derivativeCount = 0;
        // puzzleCheckCount = 0;
        // let singleDigitFailCount = 0;
        // let distinctDigitFailCount = 0;
        // let mathFailCount = 0;
        // let uniqueSolutionCount = 0;
        // let antiderivativeFailCount = 0;
        // let deadendCount = 0;
        // let chainLengthMaxedCount = 0;

        // let lastUpdate = startTime;
        // let numUpdates = 0;
        // const UPDATE_INTERVAL_MS = 1000*15;

        // DFS using `chain` as the stack
        // while (chain.length > 0) {
        //   const now = Date.now();
        //   const timeSinceLastUpdate = now - lastUpdate;
        //   if (timeSinceLastUpdate > UPDATE_INTERVAL_MS) {
        //     numUpdates++;
        //     lastUpdate = now;
        //     debug.log(`#   { time: ${now - startTime}ms,` +
        //       ` queued: ${queueCount},` +
        //       ` derivatives: ${derivativeCount},` +
        //       ` singleDigitFilter: ${singleDigitFailCount},` +
        //       ` distinctDigitFilter: ${distinctDigitFailCount},` +
        //       ` mathFilter: ${mathFailCount},` +
        //       ` puzzlesChecked: ${puzzleCheckCount},` +
        //       ` uniqueSol: ${uniqueSolutionCount},` +
        //       ` antiderivFail: ${antiderivativeFailCount},` +
        //       ` deadend: ${deadendCount},` +
        //       ` chainMaxed: ${chainLengthMaxedCount} }`
        //     );
        //     debug.log(`  =>{ solvesUniquelyCache: ${JSON.stringify(solvesUniquelyCache.getStats())} }`);
        //   }

        //   // const chain = subqueue.shift();
        //   // const chain = [...stack];
        //   queueCount++;
        //   // const chainRoot = chain[0];
        //   // const chainRoot = root;
        //   // const last = chain[chain.length - 1];
        //   // const chainMask = chain.reduce((mask, chainCI) => mask | (1n << BigInt(80 - chainCI)), 0n);

        //   // ! Testing jumpoff: Looking for specific chains to debug.
        //   // if (test_wanted.has(chainMask)) {
        //   //   debug.log(`! ${chainMask.toString(2).padStart(81, '0')}`);
        //   //   test_wanted.delete(chainMask);
        //   // }

        //   // TODO If worth the mem + time, keep track of seen chains by Set<bigint> of chainMasks.
        //   // TODO Skip if the chain has been seen before.
        //   // TODO Determine if it is better to check seen chains before or after checking if derivative.

        //   // Skip if the chain is a derivative of a previous chain
        //   const sieveItem = (
        //     sieve.find(_sieveItem => (_sieveItem & chain.mask) === _sieveItem) ||
        //     chains.find(_chain => (_chain & chain.mask) === _chain)
        //   );
        //   if (sieveItem) {
        //     // debug.log('  ❌ is derivative:');
        //     // debug.log(`  ${sieveItem.toString(2).padStart(81, '0')}`);
        //     // debug.log(`- ${chainMask.toString(2).padStart(81, '0')}`);
        //     derivativeCount++;

        //     // stack.pop();
        //     chain.pop();

        //     continue;
        //   }

        //   // debug.log(`  ${config.filterIndices(chain).toString()}`);

        //   // TODO If the chain length >= minimum target length (2 * k),
        //   // TODO   AND the first and last cells are row or column peers,
        //   // TODO   THEN check if the chain is irreducible, NOT uniquely solvable, and all antiderivatives are uniquely solvable.
        //   if (chain.length >= 2*k && chain.isCyclic()) {
        //     // debug.log(chainPuzzle.toFullString());
        //     let passing = true;

        //     // const chainPuzzle = config.keepIndices(chain);
        //     // const chainBoard = config.board.map((digit, ci) => (chain.includes(ci) ? 0 : digit));
        //     // const stats = analyzeEmptyCellChain(configBoard, chain);
        //     const m = chain.length;
        //     const numRows = chain.numRows;
        //     const numCols = chain.numCols;
        //     const numRegions = chain.numRegions;
        //     const distinctDigits = chain.distinctDigits;
        //     // const noSingleDigits = !chain.hasSingleDigits()
        //     // const noSingleDigits = stats.digitCounts.every((count) => (count === 0 || count > 1));

        //     if (chain.hasSingleDigits()) {
        //       // debug.log('  ❌ not all digits have complements');
        //       passing = false;
        //       singleDigitFailCount++;
        //     }

        //     if (distinctDigits !== k) {
        //       // debug.log('  ❌ distinct digits !== k');
        //       passing = false;
        //       distinctDigitFailCount++;
        //     }

        //     // Debug If chainBoard looks like this:
        //     // '.1.574639573896124469123578721459386354681792986237415147962853695318247.3.745961'
        //     // 1511157274518286468383040n (associated chainMask for future ref)
        //     // if (chainBoard.join('').replace(/0/g, '.') === '2.8.74.395738961244.9.23.78721459386354681792986237415147962853695318247832745961') {
        //     //   debug.log(`> ${chainBoard.join('').replace(/0/g, '.')}`);
        //     // }

        //     // Check common properties of unsolvable chains
        //     if (
        //       passing && (
        //         // numRows, numCols, and numRegions must be at least 2
        //         numRows < 2 || numRows === m ||
        //         numCols < 2 || numCols === m ||
        //         numRegions < 2 || numRegions === m ||

        //         // numRows * numCols must be at least m
        //         // TODO Can this be proven mathematically?
        //         numRows * numCols < m ||

        //         // numDigits must be at most m / 2
        //         distinctDigits > m / 2 ||

        //         // When rows or cols or regions are 2,
        //         ((numRows === 2 || numCols === 2 || numRegions === 2) && (
        //           // rows * cols must equal m
        //           numRows * numCols !== m ||

        //           // numDigits must be m / 2
        //           distinctDigits !== m / 2
        //         ))
        //       )
        //     ) {
        //       // debug.log('  ❌ not a chain');
        //       passing = false;
        //       mathFailCount++;
        //     }

        //     // TODO Find a better way to test for irreducibility than actually solving, if possible
        //     if (passing) {
        //       // const puzzle = config.filterOutIndices(chain.cells);
        //       const puzzle = config.filter(~chain.mask);
        //       puzzleCheckCount++;
        //       if (solvesUniquelyCache.solvesUniquely(puzzle)) {
        //       // if (puzzle.hasUniqueSolution()) {
        //         // debug.log('  ❌ has unique solution');
        //         uniqueSolutionCount++;
        //       } else {
        //         // debug.log('  ❌ some antiderivatives have zero or multiple solutions');
        //         const antiderivatives = antiderivativePuzzles(puzzle);
        //         // antiderivatives.some((p) => !p.hasUniqueSolution())
        //         let allGucci = true;
        //         for (let i = 0; i < antiderivatives.length; i++) {
        //           puzzleCheckCount++;
        //           if (!solvesUniquelyCache.solvesUniquely(antiderivatives[i])) {
        //           // if (!antiderivatives[i].hasUniqueSolution()) {
        //             allGucci = false;
        //             antiderivativeFailCount++;
        //             break;
        //           }
        //         }

        //         if (allGucci) {
        //           // debug.log('  ✅ All antiderivatives have unique solutions.');
        //           debug.log(`${chains.length}  ✅ ${config.filter(~chain.mask).toString()}`);
        //           // debug.log(new Sudoku(chainBoard).toFullString() + '\n');
        //           chains.push(chain.mask);
        //           sieve.push(chain.mask);

        //           // stack.pop();
        //           chain.pop();
        //           continue;

        //           // Remove all search space items that are derivatives of this chain
        //           // const beforeRemovalLength = queue.length;
        //           // subspace.chains = subqueue.filter((_chain) => {
        //           //   const _chainMask = _chain.reduce((mask, chainCI) => mask | (1n << BigInt(80 - chainCI)), 0n);
        //           //   return ((chainMask & _chainMask) !== _chain);
        //           // });
        //           // debug.log(`  - removed ${beforeRemovalLength - queue.length} derivative chains`);
        //         }
        //       }
        //     }
        //   }

        //   if (
        //     chain.length >= maxLength
        //     // numRows > maxStat ||
        //     // numCols > maxStat ||
        //     // numRegions > maxStat
        //   ) {
        //     chainLengthMaxedCount++;
        //     // stack.pop();
        //     chain.pop();
        //     continue;
        //   }

        //   // ! Dead end check
        //   // Quick dead-end check: all the first cell's available row and column neighbors are inaccessible.
        //   const rootRow = cellRow(chain.root);
        //   const rootCol = cellCol(chain.root);
        //   // Count the number of root's neighbors that are NOT in the chain.
        //   // const rootNeighborsAvailable = subspace.digits.reduce((acc, d) => {
        //   const rootNeighborsAvailable = digits.reduce((acc, d) => {
        //     // If the digit is the root's digit, skip it
        //     if (d === configBoard[chainRoot]) {
        //       return acc;
        //     }

        //     const rowNeighbor = 9*rootRow + colDigitTransform[rootRow][d - 1];
        //     if (!chain.includes(rowNeighbor)) {
        //       acc++;
        //     }

        //     const colNeighbor = 9*rowDigitTransform[rootCol][d - 1] + rootCol;
        //     if (!chain.includes(colNeighbor)) {
        //       acc++;
        //     }

        //     return acc;
        //   }, 0);

        //   // If the root has no available neighbor to complete the chain, then the chain is a dead end
        //   if (rootNeighborsAvailable === 0) {
        //     // debug.log('  ❌ no root neighbors available');
        //     deadendCount++;
        //     continue;
        //   }
        //   // ! (end) Dead end check

        //   // ! Dead end check 2
        //   // Find the shortest path (BFS) between the root and the last cell.
        //   // If there is no path, then the chain is a dead end.
        //   /** @type {number[]} */
        //   // const remainingCells = configBoard.reduce((acc, d, _ci) => {
        //   //   if (digits.includes(d) && !chain.includes(_ci) && _ci > ci) {
        //   //     acc.push(_ci);
        //   //   }
        //   //   return acc;
        //   // }, []);
        //   // remainingCells.push(last);

        //   // const pathsQueue = [[chainRoot]];
        //   // let path = null;
        //   // let pathFound = false;
        //   // while (pathsQueue.length > 0) {
        //   //   path = pathsQueue.shift();
        //   //   const lastPathCell = path[path.length - 1];
        //   //   if (lastPathCell === last) {
        //   //     pathFound = true;
        //   //     break;
        //   //   }

        //   //   const lastPathRow = cellRow(lastPathCell);
        //   //   const lastPathCol = cellCol(lastPathCell);
        //   //   // const lastPathRegion = cellRegion(lastPathCell);

        //   //   digits.forEach((d) => {
        //   //     // Add the ROW neighbor(s) if not already part of the chain
        //   //     const rowNeighbor = 9*lastPathRow + colDigitTransform[lastPathRow][d - 1];
        //   //     if (!path.includes(rowNeighbor) && remainingCells.includes(rowNeighbor)) {
        //   //       pathsQueue.push([...path, rowNeighbor]);
        //   //     }

        //   //     // Add the COL neighbors
        //   //     const colNeighbor = 9*rowDigitTransform[lastPathCol][d - 1] + lastPathCol;
        //   //     if (!path.includes(colNeighbor) && remainingCells.includes(colNeighbor)) {
        //   //       pathsQueue.push([...path, colNeighbor]);
        //   //     }
        //   //   });
        //   // }

        //   // if (!pathFound) {
        //   //   // debug.log('  ❌ no path found');
        //   //   deadendCount++;
        //   //   continue;
        //   // }
        //   // ! (end) Dead end check 2

        //   // Expand the chain for all available row and column neighbors.
        //   // const firstDigit = configBoard[first];
        //   // const firstRow = cellRow(first);
        //   // const firstCol = cellCol(first);
        //   // const lastDigit = configBoard[last];
        //   const lastRow = cellRow(last);
        //   const lastCol = cellCol(last);
        //   const subqueueLengthBeforeExpanding = subqueue.length;
        //   // subspace.digits.forEach((d) => {
        //   digits.forEach((d) => {
        //     // Add the ROW neighbor(s) if not already part of the chain
        //     const rowNeighbor = 9*lastRow + colDigitTransform[lastRow][d - 1];
        //     if (!chain.includes(rowNeighbor) && rowNeighbor > chainRoot) {
        //       // const nextMask = chainMask | (1n << BigInt(80 - rowNeighbor));
        //       // if (!seen.has(nextMask)) {
        //         subqueue.push([...chain, rowNeighbor]);
        //         // seen.add(nextMask);
        //       // }
        //     }

        //     // Add the COL neighbors
        //     const colNeighbor = 9*rowDigitTransform[lastCol][d - 1] + lastCol;
        //     if (!chain.includes(colNeighbor) && colNeighbor > chainRoot) {
        //       // const nextMask = chainMask | (1n << BigInt(80 - colNeighbor));
        //       // if (!seen.has(nextMask)) {
        //         subqueue.push([...chain, colNeighbor]);
        //         // seen.add(nextMask);
        //       // }
        //     }
        //   });

        //   // debug.log(`  + expanded queue by ${subqueue.length - subqueueLengthBeforeExpanding}`);
        // } // end subqueue search

        // const timed = Date.now() - startTime;
        // debug.log(`  =>{ time: ${timed}ms,` +
        //   ` queued: ${queueCount},` +
        //   ` derivatives: ${derivativeCount},` +
        //   ` singleDigitFilter: ${singleDigitFailCount},` +
        //   ` distinctDigitFilter: ${distinctDigitFailCount},` +
        //   ` mathFilter: ${mathFailCount},` +
        //   ` puzzlesChecked: ${puzzleCheckCount},` +
        //   ` uniqueSol: ${uniqueSolutionCount},` +
        //   ` antiderivFail: ${antiderivativeFailCount},` +
        //   ` deadend: ${deadendCount},` +
        //   ` chainMaxed: ${chainLengthMaxedCount} }`
        // );
        // debug.log(`  =>{ solvesUniquelyCache: ${JSON.stringify(solvesUniquelyCache.getStats())} }`);
        // solvesUniquelyCache.rollStats();
      // }
      }
    }

    // Remove cellMask(ci) from each in NEXTS, as the cell should not be part of any remaining chains
    const maskRemovesCi = ~cellMask(ci);
    for (let i = 0; i < NUM_SPACES; i++) {
      NEXTS[i] &= maskRemovesCi;
    }
  }

  // debug.log(`Queue items searched: ${queueCount}`);
  // debug.log(`Seen size: ${cache.seen.size}`);
  // debug.log(`Seen hits: ${seenCount}`);
  // debug.log(`Puzzle check count: ${puzzleCheckCount}`);
  // debug.log(`Derivative count: ${derivativeCount}`);
  return chains;
}

/**
 *
 * @param {Sudoku} config
 * @param {number[]} chain
 * @returns {boolean}
 */
export function isIrreducableChain(config, chain) {
  // const puzzle = Sudoku.mask(config, mask);
  const puzzle = config.filter(mask);
  const stats = analyzeEmptyCellChain(puzzle);
  const m = stats.emptyCells.length;
  const numRows = stats.rows.length;
  const numCols = stats.cols.length;
  const numRegions = stats.regions.length;
  const numDigits = stats.digits.length;
}

const digCounts = Array(9).fill(0);
/**
 *
 * @param {number[]} configBoard
 * @param {number[]} chain
 */
export function analyzeEmptyCellChain(configBoard, chain) {
  const result = {
    rows: [],
    cols: [],
    regions: [],
    distinctDigits: 0,
    digitCounts: digCounts.slice(), // TODO Should this index by the actual digit, not the digit - 1? Which is more intuitive?
    emptyCells: [] // TODO Why is this here? Can it be removed?
  };

  for (let chainIndex = 0; chainIndex < chain.length; chainIndex++) {
    const ci = chain[chainIndex];
    const row = cellRow(ci);
    const col = cellCol(ci);
    const region = cellRegion(ci);
    const digit = configBoard[ci];

    if (!result.rows.includes(row)) {
      result.rows.push(row);
    }

    if (!result.cols.includes(col)) {
      result.cols.push(col);
    }

    if (!result.regions.includes(region)) {
      result.regions.push(region);
    }

    if (result.digitCounts[digit - 1] === 0) {
      result.distinctDigits++;
    }
    result.digitCounts[digit - 1]++;

    if (!result.emptyCells.includes(ci)) {
      result.emptyCells.push(ci);
    }
  }

  return result;
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
 *
 * @param {Sudoku} puzzle
 * @returns {Sudoku[]}
 */
function antiderivativePuzzles(puzzle) {
  // TODO this might be a PITA to debug
  const _puzzle = new Sudoku(puzzle);
  _puzzle._resetEmptyCells();
  _puzzle._reduce();
  return _puzzle.board.reduce((acc, digit, ci) => {
    if (digit === 0) {
      _puzzle.getCandidates(ci).forEach((candidate) => {
        const newPuzzle = new Sudoku(puzzle);
        newPuzzle.setDigit(candidate, ci);
        acc.push(newPuzzle);
      });
    }

    return acc;
  }, []);
}

/**
 *
 * @param {number} n
 * @param {bigint} bigR
 * @returns {number[]}
 */
function bitComboToDigits(n, bigR) {
  const digits = [];
  let i = 0;
  while (bigR > 0n && i < n) {
    if (bigR & 1n) {
      digits.push(n - i - 1);
    }
    i++;
    bigR >>= 1n;
  }
  return digits;
}

function isRowPeer(ci1, ci2) {
  return cellRow(ci1) === cellRow(ci2);
}

function isColPeer(ci1, ci2) {
  return cellCol(ci1) === cellCol(ci2);
}

function isRowOrColPeer(ci1, ci2) {
  return isRowPeer(ci1, ci2) || isColPeer(ci1, ci2);
}

const solutionsFlagCache = {
  /** @type {Set<bigint>} */
  _2set: new Set(),
  _2setHits: 0,
  _2setMisses: 0,

  _1set: new Set(),
  _1setHits: 0,
  _1setMisses: 0,

  // An array of sets of single solution masks.
  // Single solutions are sorted into these sets based on the number of clues.
  // Index 0 = 17 clues, up to 27 clues.
  /** @type {Set<bigint>[]} */
  _singleSolutionMasks: range(11).map(() => new Set()),

  /**
   * @param {Sudoku} board
   * @returns {number}
   */
  getFor(board) {
    const clues = 81 - board.numEmptyCells;
    const copy = new Sudoku(board);
    copy._resetEmptyCells();
    copy._reduce();
    const mask = copy.mask;
    const in2sCache = this._2set.has(mask);

    if (in2sCache) {
      this._2setHits++;
      return 2;
    } else {
      this._2setMisses++;
      const in1sCache = this._1set.has(mask);
      if (in1sCache) {
        this._1setHits++;
        return 1;
      } else {
        this._1setMisses++;
        const flag = board.solutionsFlag();
        if (flag > 1) {
          this._2set.add(mask);
        } else if (flag === 1) {
          this._1set.add(mask);
          if (clues <= 27) {
            this._singleSolutionMasks[clues - 17].add(board.mask);
          }
        }
        return flag;
      }
    }
  }
};


const configStr = '218574639573896124469123578721459386354681792986237415147962853695318247832745961';
const config = new Sudoku(configStr);
const configBoard = config.board;
// const expectedSieveItems = [ // chain length 4
//   '21857463957389612446912357872145938635468179298623741514796..5369531..47832745961',
//   '218574639573896124469123578721459386354681792986237415.479.2853.953.8247832745961',
//   '218574639573896124469123578721459386354681.9.986237415147962853695318.4.832745961',
//   '2185746395738961244691235787214593863546..7929862374151479628536953..247832745961',
//   '218574639573896124469123578.21459.86.54681.92986237415147962853695318247832745961',
//   '218574639573896124469123578.2145.386354681792.8623.415147962853695318247832745961',
//   '218574639573896124469123578.2.459386354681792986237415.4.962853695318247832745961',
//   '21.57463.57389612446.12357.721459386354681792986237415147962853695318247832745961',
//   '.1.574639573896124469123578721459386354681792986237415147962853695318247.3.745961',
//   '218574639573896124469123578721459386354681792986.3.41514.96.85369531824783..45961',
//   '2185746395738961244691235787214593863..6817929862374151.79628.369.3182.7832745961',
//   '218574639573896124469123578721459386.546.17929.62.7415147962853695318247..2745961',
//   '21857463957389612446912357872.45938.35468179298.2374.51479628536953182478327459..',
//   '218574639573896124469..3578721459386354681792986..7415147962853695..8247832745961',
//   '2185746395738961244..123578721459386354681792.8.237415147962853..5318247832745961',
//   '218574639573896..4469123578721459386354681792986237..5147962853695318..7832745961',
//   '218574639573..6124469123578721459386354..1792986237415147..2853695318247832745961',
//   '218574639.7389612..69123.78721459386354681792986237.1.147962853695318247832745961',
//   '2185.46.957389612446912.5.87214593863546817929862..415147962853695318247832745961',
//   '218.7.639573896124469123578721..93863546817929862374151479628536953182478327..961',
//   '218..4639573896124469123578721..9386354681792986237415147962853695318247832..5961',
//   '218...639573896124469123578721459386354681792986237415147962853695318247832...961',
//   '2.8.74.395738961244.9.23.78721459386354681792986237415147962853695318247832745961',
//   '2..57463957389612446912357872.4593.63546817929.62374.5147962853695318247832745961',
// ].map(s => BigInt(`0b${s.replace(/[^.]/g, '0').replace(/\./g, '1')}`));

// const sieve2 = new SudokuSieve({ config });
// while (sieve2.length < 400) {
//   const mask = sieve2._generateMask2();
//   const prime = searchForPrimeInvalidFromMask(sieve2, mask, solutionsFlagCache);
//   const numCells = sieve2._numCells(prime);
//   if (prime > 0n) {
//     if (numCells > 18) {
//       continue;
//     }
//     sieve2.add(prime);
//     console.log(`[${sieve2.length.toString()}] {${numCells.toString().padStart(2, ' ')}} ${prime.toString().padStart(26, ' ')}n; ${config.filter(prime).toString()}`);
//   } else {
//     console.log('prime not found');
//   }
// }

class BigDecimal {
  constructor(value) {
      let [ints, decis] = String(value).split(".").concat("");
      decis = decis.padEnd(BigDecimal.decimals, "0");
      this.bigint = BigInt(ints + decis);
  }
  static fromBigInt(bigint) {
      return Object.assign(Object.create(BigDecimal.prototype), { bigint });
  }
  divide(divisor) { // You would need to provide methods for other operations
      return BigDecimal.fromBigInt(this.bigint * BigInt("1" + "0".repeat(BigDecimal.decimals)) / divisor.bigint);
  }
  toString() {
      let s = this.bigint.toString().replace("-", "").padStart(BigDecimal.decimals+1, "0");
      s = (s.slice(0, -BigDecimal.decimals) + "." + s.slice(-BigDecimal.decimals))
             .replace(/(\.0*|0+)$/, "");
      return this.bigint < 0 ? "-" + s : s;
  }
}
BigDecimal.decimals = 4; // Configuration of the number of decimals you want to have.

// // Demo
// var a = new BigDecimal("123456789123456789876");
// var b = new BigDecimal( "10000000000000000000");

// console.log(a.divide(b).toString());

// Find and print out all sieve items with 2 digits and 18 cells
const sieve = new SudokuSieve({ config });
// searchForSieve2(sieve, { maxDigits: 2, maxLength: 18 });
// searchForSieve2(sieve, { maxDigits: 3, maxLength: 9 });
// console.log(`Found ${sieve.length} sieve items:`);
// sieve.forEach((mask) => {
//   console.log(`${mask.toString().padStart(26,' ')} ${config.filter(mask).toString()}`);
// });

// let sieveErrors = sieve.validate();
// const isSieveValid = sieveErrors.length === 0;
// console.log(isSieveValid ?
//   '✅ sieve.validate() passed.' :
//   `❌ sieve.validate() failed:\n${sieveErrors.map(err=>`  - ${err},`).join('\n')}`
// );
// const searchSpace = nChooseK(81, 17);
// if (isSieveValid) {
//   let sieveSum = 0n;
//   sieve.forEach((mask) => {
//     const s = nChooseK(81 - sieve._numCells(mask), 16);
//     sieveSum += s;
//     console.log(`numCells: ${sieve._numCells(mask)}; s: ${s.toString().padStart(26)}; ${config.filter(mask).toString()}`);
//   });
//   console.log(`Sieve sum: ${sieveSum} / (81,17)=${searchSpace} ; ${(new BigDecimal(sieveSum * 100n).divide(new BigDecimal(searchSpace))).toString()}%`);

//   let checked = 0n;
//   // sieveCombos4(sieve, 17, Number.MAX_SAFE_INTEGER, (mask, m) => {
//   //   // Attempt to remove as many bits as possible while still satisfying the sieve
//   //   // const _mask = BigInt(mask);
//   //   // const q = [_mask];
//   //   checked++;
//   //   const flag = solutionsFlagCache.getFor(config.filter(mask));
//   //   console.log(`${flag === 1 ? '⭐️' : '  '} ${flag} [${m.toString().padStart(2)}] mask: ${mask.toString().padStart(26)}; ${config.filter(mask).toString()} (${checked})`);
//   // });






// }

// console.log(`Collecting for solutions for all sieve items...`);
// const allSolutions2 = new Set();
// sieve.forEach((mask) => {
//   // const p = ;
//   config.filter(~mask).searchForSolutions3({
//     solutionFoundCallback: (solution, _n) => {
//       const solStr = solution.toString();
//       if (!allSolutions2.has(solStr)) {
//         allSolutions2.add(solStr);
//         console.log(`                      ${solStr}`);
//       }
//       return true;
//     }
//   });
// });
// console.log(`Found ${allSolutions2.size} solutions for all sieve items.\n`);

/**
 *
 * @param {Sudoku} config1
 * @param {Sudoku} config2
 * @returns {bigint}
 */
function diff(config1, config2) {
  const a = config1.board;
  const b = config2.board;
  let mask = 0n;
  for (let ci = 0; ci < NUM_SPACES; ci++) {
    if (a[ci] !== b[ci]) {
      mask |= cellMask(ci);
    }
  }
  return mask;
}

/**
 *
 * @param {SudokuSieve} sieve
 * @param {number} k
 * @returns {{ allSolutions: Set<string>, diffs: Set<bigint> }}
*/
export function populateSieve(sieve, k) {
  const _config = sieve.config;
  const _configBoard = _config.board;
  const nck = nChooseK(NUM_DIGITS, k);
  // Collect all solutions for each partial puzzle
  let dots = 0;
  console.log('[ ==================================================================================================== ]');
  process.stdout.write('[ ');
  const pBoard = _config.board;
  for (let i = 0n; i < nck; i++) {
    const dCombo = bitCombo(NUM_DIGITS, k, i);
    // let pMask = 0n;
    for (let ci = 0; ci < 81; ci++) {
      const d = _configBoard[ci];
      if ((1n << BigInt(d - 1)) & dCombo) {
        // pMask |= cellMask(ci);
        pBoard[ci] = 0;
      } else {
        pBoard[ci] = d;
      }
    }

    // const p = config.filter(~pMask);
    // const p = new Sudoku(pBoard);

    // console.log(`> digits: [${bitsStr(dCombo, 9)}] ${p.toString()}`);
    (new Sudoku(pBoard)).searchForSolutions3({
      solutionFoundCallback: (solution, _n) => {
        // const sBoard = solution.board;
        // const solStr = sBoard.join('');
        const _diff = diff(_config, solution);
        if (_diff > 0n) {
          sieve.add(_diff);
        }

        // if (!result.has(solStr)) {
        //   result.add(solStr);
        //   // console.log(`                      ${solStr}`);
        // }
        return true;
      }
    });

    const currentPercent = 100 * Number(i) / Number(nck); // Should be truncated via bigint division
    while (dots < currentPercent) {
      process.stdout.write('.');
      dots++;
    }
  }
  console.log(' ]');

  // return { allSolutions: result, diffs: diffMasks };
  // return { diffs: diffMasks };
}


// let { allSolutions, diffs } = titties(2);
// console.log(`Found ${allSolutions.size} solutions for all 2-digit combos:`);
// allSolutions.forEach(solutionStr => {
//   console.log(`                      ${solutionStr}`);
// });

// Diff solutions against the config, store each as mask in a set
// /** @type {Set<bigint>} */
// let diffMasks = new Set();
// allSolutions.forEach((solutionStr) => {
//   const sBoard = new Sudoku(solutionStr).board;
//   let mask = 0n;
//   for (let ci = 0; ci < NUM_SPACES; ci++) {
//     if (configBoard[ci] !== sBoard[ci]) {
//       mask |= cellMask(ci);
//     }
//   }
//   if (mask > 0n) {
//     if (!diffMasks.has(mask)) {
//       diffMasks.add(mask);
//     }
//   }
// });

// Check if the diffMasks are in the sieve
// console.log(`${diffs.size} diffs found:`);
// let sieveDiffs = [];
// diffs.forEach((mask) => {
//   const inSieve = sieve.has(mask);
//   const icon = inSieve ? '✅' : '  ';
//   const diffItemStr = mask.toString().padStart(26,' ');
//   console.log(`${icon} ${diffItemStr} ${config.filter(~mask).toString()}`);
//   if (inSieve) {
//     sieveDiffs.push(mask);
//   }
// });
// console.log(`Found ${sieveDiffs.length} diffs were also found the sieve.`);

// console.log(`Verifying all diff items...`);
// if (verifySieveItems(config, [...diffs], failReason => { console.log(failReason) })) {
//   console.log('✅ All diffs verified.');
// } else {
//   console.log('❌ Some diffs failed verification.');
// }

// console.log(`Verifying diff items found in sieve...`);
// if (verifySieveItems(config, sieveDiffs, failReason => { console.log(failReason) })) {
//   console.log('✅ All sieve diffs verified.');
// } else {
//   console.log('❌ Some sieve diffs failed verification.');
// }

for (let k = 2; k < 4; k++) {
  console.log(`Populating sieve with all ${k}-digit combo items...`);
  const startSize = sieve.length;
  let startTime = Date.now();
  populateSieve(sieve, k);
  let timed = Date.now() - startTime;
  console.log(`Done in ${timed}ms. Added ${sieve.length - startSize} items.`);

  console.log(`verifySieveItems(config, sieve):`);
  if (verifySieveItems(config, sieve.items, failReason => { console.log(failReason) })) {
    console.log('  ✅ Pass');
  } else {
    console.log('  ❌ Fail');
  }

  console.log(`sieve.validate():`);
  const sieveErrors = sieve.validate();
  if (sieveErrors.length > 0) {
    console.log('  ❌ Failed with errors:');
    sieveErrors.forEach((err) => {
      console.log('    ' + err);
    });
  } else {
    console.log('  ✅ Pass');
  }

  // console.log(`Are all sieve items (k=2) also in sieve3?`);
  // let sieve2InSieve3 = true;
  // sieve.items.forEach((mask) => {
  //   const inSieve3 = sieve3.has(mask);
  //   const icon = inSieve3 ? '✅' : '❌';
  //   const diffItemStr = mask.toString().padStart(26,' ');
  //   console.log(`${icon} ${diffItemStr} ${config.filter(~mask).toString()}`);
  //   if (!inSieve3) {
  //     sieve2InSieve3 = false;
  //   }
  // });
  // if (sieve2InSieve3) {
  //   console.log('✅ All sieve2 items are in sieve3.');
  // } else {
  //   console.log('❌ Some sieve2 items are not in sieve3.');
  // }

}
// console.log('Pruning...');
// sieve.prune({ maxCells: 17 });
console.log('Final sieve items:');
sieve.forEach((mask) => {
  console.log(`[${sieve._countMaskCells(mask).toString().padStart(2)}] ${mask.toString().padStart(26)} ${config.filter(mask).toString()}`);
});

let solutions = [];
let solutionSet = new Set();
const solutionFoundCallback = (solution, _n) => {
  // const sBoard = solution.board;
  // const solStr = sBoard.join('');
  const _diff = diff(config, solution);
  if (_diff > 0n && !solutionSet.has(_diff)) {
    sieve.add(_diff);
    solutionSet.add(_diff);
  }

  // if (!result.has(solStr)) {
  //   result.add(solStr);
  //   // console.log(`                      ${solStr}`);
  // }
  return true;
};

const checkIfWinner = (mask) => {
  // Adds any new invalid forms to the sieve
  const sieveBefore = sieve.length;
  const flag = Math.min(2, solutions.length);
  solutionSet.clear();
  ({ solutions } = config.filter(mask).searchForSolutions3({ solutionFoundCallback }));
  const sieveGrew = sieve.length > sieveBefore;
  console.log(`${(flag === 1) ? '⭐️' : (sieveGrew ? '+ ' : '  ')} ${mask.toString().padStart(26)} ${config.filter(mask).toString()}`);
};

console.log('Searching sieveCombos4...');
sieveCombos4(sieve, 17, Number.MAX_SAFE_INTEGER, (mask, m) => {
  if (m === 17) {
    checkIfWinner(mask);
  } else {
    const q = [mask];
    while (q.length > 0) {
      const _mask = q.shift();
      if (sieve._countMaskCells(_mask) === 17) {
        for (let ci = 0; ci < 81; ci++) {
          const nextMask = _mask | cellMask(ci);
          if (nextMask > _mask) {
            q.push(nextMask);
          }
        }
      } else {
        checkIfWinner(_mask);
      }
    }
  }
});

console.log('Final sieve items:');
sieve.forEach((mask) => {
  console.log(`[${sieve._countMaskCells(mask).toString().padStart(2)}] ${mask.toString().padStart(26)} ${config.filter(mask).toString()}`);
});

const nck = nChooseK(81, 17);

function verify17Puzzles(strs) {
  strs.forEach((puzzleStr) => {
    const puzzle = new Sudoku(puzzleStr);
    console.log(puzzle.toString());
    const flag = puzzle.solutionsFlag();
    console.log(`  flag: ${flag}`);
    console.log(`  solutions:`);
    const solutionSet = new Set();
    const {solutions} = puzzle.searchForSolutions3({
      solutionFoundCallback: (solution, numFound) => {
        const str = solution.toString();
        if (!solutionSet.has(str)) {
          solutionSet.add(str);
          console.log(`    ${str}`);
        }
        return solutionSet.size <= 1;
      }
    });
    console.log();
  });
}

// verify17Puzzles([

// ]);

// const startTime = Date.now();
// const MS_TO_UPDATE = 1000 * 15;
// let lastUpdate = startTime - MS_TO_UPDATE;
// console.log('Searching (81 | 17)...');
// for (let n = 0n; n < nck; n++) {
//   const mask = bitCombo(81, 17, n);
//   if (sieve.doesMaskSatisfy(mask)) {
//     // const flag = config.filter(~mask).solutionsFlag();
//     const sieveBefore = sieve.length;
//     config.filter(~mask).searchForSolutions3({ solutionFoundCallback });
//     const sieveGrew = sieve.length > sieveBefore;
//     console.log(flag === 1 ? '⭐️' : (sieveGrew ? '+ ' : '  ') +
//       ` [${n.toString().padStart(18)}]` +
//       ` m[${sieve._numCells(mask).toString().padStart(2)}]` +
//       ` d[${sieve._numDigits(mask)}]` +
//       ` ${mask.toString().padStart(26)}` +
//       ` ${config.filter(mask).toString()}`
//     );
//   }
// }






// console.log(`Found ${allSolutions3.size} solutions for all ${k}-digit combos:`);
// allSolutions3.forEach(solutionStr => {
//   console.log(`                      ${solutionStr}`);
// });
// console.log(`(Found ${allSolutions3.size} solutions for all ${k}-digit combos)\n`);

// Diff solutions against the config, store each as mask in a set

// /** @type {Set<bigint>} */
// const diffMasks3 = new Set();
// allSolutions3.forEach((solutionStr) => {
//   const sBoard = new Sudoku(solutionStr).board;
//   let mask = 0n;
//   for (let ci = 0; ci < NUM_SPACES; ci++) {
//     if (configBoard[ci] !== sBoard[ci]) {
//       mask |= cellMask(ci);
//     }
//   }
//   if (mask > 0n) {
//     if (!diffMasks3.has(mask)) {
//       diffMasks3.add(mask);
//     }
//   }
// });
// console.log(`${diffs.size} diffs found:`);

// const sieve3 = new SudokuSieve({ config });
// process.stdout.write('Sorting by #cells ascending... ');
// const diffs3 = [...diffs].sort((a, b) => (sieve3._numCells(a) - sieve3._numCells(b)));
// console.log('Done.');

// console.log('Removing derivatives...');
// let removed = 0;
// let dots = 0;
// console.log('[ ==================================================================================================== ]');
// process.stdout.write('[ ');
// let len = diffs3.length;
// for (let i = 0; i < len; i++) {
//   const a = diffs3[i];
//   for (let j = len - 1; j > i; j--) {
//     const b = diffs3[j];
//     if ((a & b) === a) {
//       diffs3.splice(j, 1);
//       len--;
//       removed++;
//     }
//   }

//   const currentPercent = Number(i * 100 / len);
//   while (dots <= currentPercent) {
//     process.stdout.write('.');
//     dots++;
//   }
// }
// console.log(' ]');
// console.log(`Removed ${removed} derivatives.`);
// console.log(`${diffs3.length} diffs remain.`);

// console.log('Adding to sieve... ');
// sieve3.add(...diffs3);
// dots = 0;
// console.log('[ ==================================================================================================== ]');
// process.stdout.write('[ ');
// diffs3.forEach((mask, i) => {
//   sieve3.add(mask);
//   const currentPercent = Number(i * 100 / diffs3.length);
//   while (dots <= currentPercent) {
//     process.stdout.write('.');
//     dots++;
//   }
// });
// console.log(' ]');

// diffs3.forEach((mask) => {
//   const inSieve = sieve3.has(mask);
//   const icon = inSieve ? '✅' : '  ';
//   const diffItemStr = mask.toString().padStart(26,' ');
//   console.log(`${icon} ${diffItemStr} ${config.filter(~mask).toString()}`);
// });
// console.log(`${sieve3.length} diffs were entered into the sieve.`);

// console.log(`Verifying all diff items (k=${k})...`);
// if (verifySieveItems(config, [...diffs3], failReason => { console.log(failReason) })) {
//   console.log(`✅ All diffs (k=${k}) verified.`);
// } else {
//   console.log('❌ Some diffs failed verification.');
// }

// console.log(`Verifying sieve3...`);
// if (verifySieveItems(config, sieve3.items, failReason => { console.log(failReason) })) {
//   console.log('✅ sieve3 verified.');
// } else {
//   console.log('❌ Some sieve diffs failed verification.');
// }

// sieveErrors = sieve3.validate();
// if (sieveErrors.length > 0) {
//   console.log('❌ sieve3 validation errors:');
//   sieveErrors.forEach((err) => {
//     console.log(err);
//   });
// } else {
//   console.log('✅ sieve3.validate() passed.');
// }

// console.log(`Are all sieve items (k=2) also in sieve3?`);
// let sieve2InSieve3 = true;
// sieve.items.forEach((mask) => {
//   const inSieve3 = sieve3.has(mask);
//   const icon = inSieve3 ? '✅' : '❌';
//   const diffItemStr = mask.toString().padStart(26,' ');
//   console.log(`${icon} ${diffItemStr} ${config.filter(~mask).toString()}`);
//   if (!inSieve3) {
//     sieve2InSieve3 = false;
//   }
// });
// if (sieve2InSieve3) {
//   console.log('✅ All sieve2 items are in sieve3.');
// } else {
//   console.log('❌ Some sieve2 items are not in sieve3.');
// }

// console.log('final sieve items:');
// sieve3.forEach((mask) => {
//   console.log(`${mask.toString().padStart(26,' ')} ${config.filter(mask).toString()}`);
// });








// How many random masks need to be generated starting from an empty sieve in order to find all the other sieve items?
// const sieve2 = new SudokuSieve({ config });
// let attempts = 0;

// // Items in sieve and not sieve2
// let remaining = sieve.items.filter(mask => !sieve2.has(mask));

// while (remaining.length > 0) {
//   attempts++;
//   const mask = sieve2._generateMask2();
//   const prime = searchForPrimeInvalidFromMask(sieve2, mask, solutionsFlagCache);
//   if (prime > 0n) {
//     sieve2.add(prime);
//     for (let i = 0; i < remaining.length; i++) {
//       if ((prime & remaining[i]) === remaining[i]) {
//         remaining.splice(i, 1);
//         break;
//       }
//     }
//     console.log(`[${sieve2.length.toString()}] ${prime.toString().padStart(26, ' ')}n; ${config.filter(prime).toString()}`);
//   } else {
//     console.log('prime not found');
//   }
// }

// const start = Date.now();
// searchForSieve2(new SudokuSieve({config}), {maxDigits: 3, maxLength: 9});
// const end = Date.now();
// console.log(`Sieve found in ${end - start} ms.`);









// console.log(`Found ${sieve2.length} sieve items:`);
// sieve.forEach((mask) => {
//   console.log(`${mask.toString().padStart(26,' ')} ${config.filter(mask).toString()}`);
// });

// if (sieve.length !== expectedSieveItems.length) {
//   debug.log(`❌ Expected ${expectedSieveItems.length} sieve items but found ${sieve.length}.`);
// }

// // Expect the sieve to contain the above sieve items and the other way around
// sieve.forEach((sieveItem) => {
//   const icon = expectedSieveItems.includes(sieveItem) ? '✅' : '❌';
//   const sieveItemStr = sieveItem.toString().padStart(26,' ');
//   console.log(`${icon} ${sieveItemStr} ${config.filter(~sieveItem).toString()}`);
// });
// console.log('---');
// expectedSieveItems.forEach((expectedItem) => {
//   const icon = sieve.has(expectedItem) ? '✅' : '❌';
//   const expectedItemStr = expectedItem.toString().padStart(26,' ');
//   console.log(`${icon} ${expectedItemStr} ${config.filter(~expectedItem).toString()}`);
// });






// const config = new Sudoku('218574639573896124469123578721459386354681792986237415147962853695318247832745961');
// const normalConfig = new Sudoku(config.normalizedBoard);

// // console.log(analyzeEmptyCellChain(config.board, [1, 3, 6, 19, 21, 24]));
// console.log(`Building sieve...`);
// const _maxDig = 3;
// const _maxLen = _maxDig * 2;
// const startTime = Date.now();
// const sieve = searchForSieve2(config, {
//   maxLength: 2*9,
//   maxDigits: 2
// });
// searchForSieve2(config, {
//   maxLength: 9,
//   maxDigits: 3,
//   sieve
// });
// searchForSieve2(config, {
//   maxLength: 8,
//   maxDigits: 4,
//   sieve
// });
// const endTime = Date.now();
// sieve.forEach((mask) => {
//   console.log(normalConfig.filter(mask).toString());

//   // console.log('\n' + normalConfig.filter(~mask).toString());
//   // console.log(normalConfig.filter(mask).toFullString());
// });
// console.log(`\nSieve built. ${sieve.length} chains found in ${endTime - startTime} ms.`);
// console.log(`  ${normalConfig.toString()}`);
