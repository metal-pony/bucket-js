import { range, shuffle } from '../util/arrays.js';
// import Debugger from '../util/debug.js';
import Sudoku from './Sudoku.js';
import SudokuSieve, { cellMask, cellsFromMask } from './SudokuSieve.js';

// const isDebugging = true;
// const whenDebugging = new Debugger(isDebugging);

/**
 * @typedef {object} Node
 * @property {Sudoku} puzzle
 * @property {Node[] | null} nexts
 */

/**
 *
 * @param {SudokuSieve} sieve
 */
function _sieveChoice2(sieve) {
  // let { matrix, maximum, maximumCells } = sieve.reductionMatrix();
  const item = sieve.first;
  const alts = shuffle(cellsFromMask(item));
  const cell = alts.shift();
  return {
    cell,
    alts,
    items: sieve.removeOverlapping(cellMask(cell))
  };
}

// TODO Use genetic algorithm to find the best starting masks
// Start with population of randomly chosen masks
// Mask fitness = number of bits set, lower is more fit
// Crossover = combine masks in various ways producing an arbitary number of children
// Mutation = flip some bits at random, maybe at the rate of a function of fitness
// Selection =

export function SuperSet() {
  /** @type {Set<bigint>[]} */
  const _itemSets = Array(81).fill(0).map(_=>new Set());
  let _size = 0n;
  const _bigintHash = (bb) => (bb % 81n);
  return {
    /**
     * @param {bigint} item
     * @returns {boolean} True if the item was successfully added; otherwise false.
     */
    add(item) {
      if (_itemSets[_bigintHash(item)].has(item)) {
        return false;
      }
      _itemSets[_bigintHash(item)].add(item);
      _size++;
      return true;
    },
    /**
     * @param {bigint} item
     * @returns {boolean}
     */
    has(item) {
      return _itemSets[_bigintHash(item)].has(item);
    },
    get size() {
      return _size;
    }
  };
}

/**
 * A depth-first backtracking approach to finding puzzle masks that satisfy
 * all items in the sieve; i.e. the mask contains bits that overlap with all
 * sieve items.
 * TODO continue
 * The masks are generated via the sieve's reduction matrix,
 *
 * @param {SudokuSieve} sieve
 * @param {number=27} maxLen
 * @param {number=2500} maxSize
 * @returns {Set<bigint>[]}
 */
// TODO Rewrite this from scratch. DFS over all sieve items.
// TODO     Each node removes and remembers the items they cover from the sieve.
// TODO       When backtracking, the covered sieve items are added again to the sieve.
// TODO     When the sieve is empty, the puzzle mask, m, covers all sieve items. Record m, then backtrack.
// TODO     Respect the max result length by backtracking if the stack grows larger than maxLen.
// TODO     Respect the max results size by stopping the search once there are maxSize results.
// TODO     Don't forget to add all the sieve items back before exiting. The sieve items must remain intact.
export function sieveCombos4(sieve, maxLen = 21, maxSize = 2500) { // TODO I WAS DOING SOMETHING HERE
  // !Side: Modifies sieve by removing overlapping items
  const root = _sieveChoice2(sieve);

  const stack = [root];
  /** @type {Set<bigint>[]} */
  const results = range(maxLen + 1).map(() => new Set());

  const seen = SuperSet();

  let m = cellMask(root.cell);
  seen.add(m);
  let total = 0;

  // Returns true if replaced, false if popped.
  // !Side: Modifies sieve by adding top items back / removing overlapping items
  // !Side: Modifies stack by popping / updating top
  // !Side: Modifies m to keep in sync with the stack
  const replaceTopWithAltOrPop = () => {
    const top = stack[stack.length - 1];

    // Backtracking
    // Take top cell bit off of mask
    // m ^= cellMask(top.cell);
    m &= ~cellMask(top.cell);
    // Put sieve items back
    sieve.add(...top.items);

    // If there's an alt to consider, the try that, or pop the stack to backtrack
    while (top.alts.length > 0) {
      const altCellIndex = top.alts.shift();
      const malt = m | cellMask(altCellIndex);
      if (seen.add(malt)) {
        m = malt;
        top.cell = altCellIndex;
        top.items = sieve.removeOverlapping(cellMask(altCellIndex));
        // seen.add(malt);
        return true;
      }
    }

    stack.pop();
    return false;
  };

  while (stack.length > 0 && total < maxSize) {
  // while (stack.length > 0) {
    // const top = stack[stack.length - 1];
    // let topAltsStr = `{${top.alts.join(',')}}`.padEnd(30, ' ');

    if (sieve.length === 0) {
      if(!results[stack.length].has(m)) {
        results[stack.length].add(m);
        total++;
        // let mStr = m.toString(2).padStart(81, '0').replace(/0/g, '.').replace(/1/g, '#');
        // whenDebugging.log(`[${stack.length}] ${mStr}`);
      }

      replaceTopWithAltOrPop();

      // Add each alt to the results
      // m ^= cellMask(top.cell);
      // while (top.alts.length > 0) {
      //   const alt = top.alts.shift();
      //   const altMask = cellMask(alt);
      //   m |= altMask;
      //   seen.add(m);
      //   mStr = m.toString(2).padStart(81, '0').replace(/0/g, '.').replace(/1/g, '#').padStart(80 + stack.length, ' ');
      //   topAltsStr = `{${top.alts.join(',')}}`.padEnd(30, ' ');
      //   if(!results[stack.length].has(m)) {
      //     results[stack.length].add(m);
      //     total++;
      //   }
      //   whenDebugging.log(`[${stack.length}] 🍆`.padEnd(16) + mStr);
      //   m &= ~altMask;
      // }

      // // Add all items back to stack and pop to backtrack
      // sieve.add(...top.items);
      // stack.pop();
    } else if (stack.length >= maxLen) {
      // whenDebugging.log(`[${stack.length}] ${top.cell} (${sieve.length}) ${topAltsStr}`.padEnd(64) + mStr);
      replaceTopWithAltOrPop();
    } else {
      // Find next unseen sieve choice
      // let { matrix, maximum, maximumCells } = sieve.reductionMatrix();
      // maximumCells = shuffle(maximumCells.filter(ci => matrix[ci] === maximum));
      const item = sieve.first;
      const alts = shuffle(cellsFromMask(item));
      let nextCellFound = false;
      // Check each maximum cell for unseen sieve choices, use the first unseen one
      while (alts.length > 0 && !nextCellFound) {
        const cell = alts.shift();
        // const cell = maximumCells.shift();
        const mask = cellMask(cell);
        const malt = m | mask;
        // mStr = malt.toString(2).padStart(81, '0').replace(/0/g, '.').replace(/1/g, '#').padStart(80 + stack.length, ' ');
        // topAltsStr = `{${maximumCells.join(',')}}`.padEnd(30, ' ');
        if (seen.add(malt)) {
          // Length of sieve if cell is chosen
          // TODO Remove after debug
          // const sieveLen = sieve.filter((item) => (item & mask) === 0n).length;

          // whenDebugging.log(`[${stack.length + 1}] ${cell} (${sieveLen}) ${topAltsStr}`.padEnd(64) + mStr);
          // seen.add(malt);
          stack.push({
            cell,
            alts,
            items: sieve.removeOverlapping(mask)
          });
          m = malt;
          nextCellFound = true;
        } else {
          // log with x after topAltStr
          // whenDebugging.log(`[${stack.length + 1}] ${cell} (...) ${topAltsStr} x`.padEnd(64) + mStr);
        }
      }

      if (!nextCellFound) {
        replaceTopWithAltOrPop();
      }

      // // !Side: Modifies sieve by removing overlapping items
      // const next = _sieveChoice(sieve);
      // stack.push(next);
      // // Keep m in sync with the stack
      // m |= cellMask(next.cell);
    }
  }

  while (stack.length > 0) {
    sieve.add(...stack.pop().items);
  }

  return results;
}

// Cache to collect puzzle masks whose solutions flag has been calculated > 2.
// Also collect puzzle masks for flag == 1 where #clues <= 27
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

// TODO Add options for maxEmptyCells (default 18). Convert search to depth-first approach.
/**
 *
 * @param {SudokuSieve} ss
 * @param {bigint} mask
 * @param {solutionsFlagCache} cache
 * @returns {bigint}
 */
export function searchForPrimeInvalidFromMask(ss, mask, cache) {
  const config = ss.config;
  const configBoard = config.board;
  let board = config.filter(mask);
  // let board = config.filter(~mask);
  board._resetEmptyCells();
  board._reduce();

  if (cache.getFor(board) < 2) {
    return -1n;
  }

  // whenDebugging.log(board.toString());

  let keepGoing = true;
  let i = 0;
  while (keepGoing) {
    // TODO Sudoku class could keep track of this
    const emptyCells = board.board.reduce((_emptyCells, digit, ci) => {
      if (digit === 0) {
        _emptyCells.push(ci);
      }
      return _emptyCells;
    }, []);
    shuffle(emptyCells);
    const chosen = emptyCells.reduce((_chosen, ci) => {
      if (_chosen.length === 0) {
        const next = new Sudoku(board);
        next.setDigit(configBoard[ci], ci);
        next._resetEmptyCells();
        next._reduce();
        const nFlag = cache.getFor(next);
        if (nFlag > 1) {
          _chosen.push({ board: next, ci });
        }
      }

      return _chosen;
    }, []);

    if (chosen.length > 0) {
      // whenDebugging.log(board.toString().padStart(80 + i, ' '));
      board = chosen[0].board;
      i++;
    } else {
      // whenDebugging.log(board.toString().padStart(80 + i, ' '), ' ✅');
      // whenDebugging.log(`  '${board.toString()}',`);
      return board.emptyCellMask;
    }
  }
}
