import { range, shuffle } from '../util/arrays.js';
import Debugger from '../util/debug.js';
import { searchForSieve2 } from './siever.js';
import Sudoku from './Sudoku.js';
import SudokuSieve from './SudokuSieve.js';

const isDebugging = true;
const whenDebugging = new Debugger(isDebugging);

/**
 * @typedef {object} Node
 * @property {Sudoku} puzzle
 * @property {Node[] | null} nexts
 */

/**
 *
 * @param {Sudoku} config
 * @param {bigint} mask
 * @param {Set<bigint>} sieve
 * @returns {Set<bigint>}
 */
function findUnresolvableItems(config, mask, sieve) {
  const configBoard = config.board;
  const rootPuzzle = config.filter(mask);

  // For each sieve item, if the root puzzle overlaps with the sieve item, then add pick a cell from the sieve item
  // and add it to the root puzzle.
  sieve.forEach((sieveItem) => {
    if ((rootPuzzle.mask & sieveItem) === 0n) {
      return;
    }

    const sieveItemBoard = config.filter(sieveItem).board;
    const sieveItemEmptyCellIndices = sieveItemBoard.reduce((_emptyCells, digit, ci) => {
      if (digit > 0) {
        _emptyCells.push(ci);
      }
      return _emptyCells;
    }, []);

    const fillInIndex = sieveItemEmptyCellIndices[Math.floor(Math.random() * sieveItemEmptyCellIndices.length)];
    rootPuzzle.setDigit(configBoard[fillInIndex], fillInIndex);
  });

  rootPuzzle._resetEmptyCells();
  rootPuzzle._reduce();
  whenDebugging.log(
    'findUnresolvableItems:\n' +
    `     config: ${config.toString()}\n` +
    `       mask: ${mask.toString(2).padStart(81,'0').replace(/0/g, '.').replace(/1/g, '#')}\n` +
    `       root: ${config.filter(mask).toString()}\n` +
    `  (reduced): ${rootPuzzle.toString()}\n`
  );

  /** @type {Set<bigint>} */
  const items = new Set(sieve);
  const _items = [...sieve];

  if (rootPuzzle.solutionsFlag() < 2) {
    whenDebugging.log('❌ rootPuzzle has less than 2 solutions. Returning empty array.');
    return items;
  }

  /** @type {Node[]} */
  const stack = [{ puzzle: rootPuzzle, nexts: null }];

  /**
   * Keeps track of which puzzles have been generated during the search.
   *
   * Note: Call `_reduce()` before adding to this to minimize memory usage
   * by eliminating the more obvious duplicates.
   *
   * TODO This will either hold toString() or mask. I'm not sure which one performs better.
   *
   * TODO Benchmark toString() vs mask. For now, using strings.
   *
   * @type {Set<bigint>}
   */
  const seen = new Set();
  seen.add(rootPuzzle.mask);

  const searchStart = Date.now();
  whenDebugging.log('\nSearching ...\n');

  while (stack.length > 0) {
    const current = stack[stack.length - 1];

    // First time visiting this node.
    if (current.nexts === null) {
      // Generate all possible puzzles with +1 clue and > 1 solutions and hasn't been seen.
      const nextNodes = current.puzzle.board.reduce((_nexts, digit, ci) => {
        if (digit === 0) {
          const nextPuzzle = new Sudoku(current.puzzle);
          nextPuzzle.setDigit(configBoard[ci], ci);
          nextPuzzle._resetEmptyCells();
          nextPuzzle._reduce();
          // const pStr = nextPuzzle.toString();
          const pFlag = nextPuzzle.solutionsFlag();
          if (
            pFlag > 1// &&
            // !seen.has(pStr)
          ) {
            // seen.add(pStr);
            _nexts.push({
              puzzle: nextPuzzle,
              nexts: null
            });
          }
        }

        return _nexts;
      }, []);

      // If there are no nexts, this is a sieve item.
      if (nextNodes.length === 0) {
        // const pStr = current.puzzle.toString();
        const itemsSize = items.size;
        items.add(current.puzzle.emptyCellMask);
        if (items.size > itemsSize) {
          _items.push(current.puzzle.emptyCellMask);
        }
        // whenDebugging.log(current.puzzle.toString().padStart(80 + stack.length, ' '), ' ✅');
        whenDebugging.log(current.puzzle.toString(), ' ✅');
        stack.pop();
        continue;
      } else {
        whenDebugging.log(current.puzzle.toString());
      }

      current.nexts = nextNodes;
    }

    /** @type {Node} */
    let next = null;
    while (current.nexts.length > 0) {
      next = current.nexts.pop();
      // If next is a derivative of an item, skip it
      const prime = _items.find((sieveItem) => (next.puzzle.mask & sieveItem) === 0);
      if (
        prime ||
        // This next has been seen before
        seen.has(next.puzzle.mask)
      ) {
        // whenDebugging.log(
        //   next.puzzle.toString().padStart(80 + stack.length, ' '),
        //   ` < ${(prime) ? 'prime' : 'seen'}`
        // );
        next = null;
      } else {
        break;
      }
    }

    // Backtrack if `nexts` already existed and is empty, because all have been visited.
    if (next === null) {
      stack.pop();
    } else {
      seen.add(next.puzzle.mask);
      stack.push(next);
    }

  }

  whenDebugging.log(`\nSearch completed in ${Date.now() - searchStart}ms.`);

  return items;
}

function cellMask(cellIndex) {
  return 1n << (80n - BigInt(cellIndex));
}

/**
 * @param {bigint} mask
 * @returns {number[]}
 */
function cellsFromMask(mask) {
  const cells = [];
  let ci = 80;
  while (mask > 0n) {
    if (mask & 1n) {
      cells.push(ci);
    }
    mask >>= 1n;
    ci--;
  }
  return cells;
}

/**
 *
 * @param {SudokuSieve} sieve
 */
function _sieveChoice(sieve) {
  let { matrix, maximum, maximumCells } = sieve.reductionMatrix();

  const cell = maximumCells.filter(ci => matrix[ci] === maximum)[0];
  return {
    cell,
    alts: maximumCells.slice(1),
    items: sieve.removeOverlapping(cellMask(cell))
  };
}

/**
 *
 * @param {SudokuSieve} sieve
 */
function _sieveChoice2(sieve) {
  // let { matrix, maximum, maximumCells } = sieve.reductionMatrix();
  const item = sieve.first;
  const alts = cellsFromMask(item);
  shuffle(alts);
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
  const _bigintHash = (bb) => Number(bb % 81n);
  let _size = 0n;
  let _hits = 0;
  let _total = 0;
  return {
    get size() {
      return _size;
    },
    /**
     * @param {bigint} item
     * @returns {boolean} True if the item was successfully added; otherwise false.
     */
    add(item) {
      const subset = _itemSets[_bigintHash(item)];
      const sizeBefore = subset.size;
      subset.add(item);
      if (subset.size > sizeBefore) {
        _size++;
        return true;
      }
      return false;
    },
    /**
     * @param {bigint} item
     * @returns {boolean}
     */
    has(item) {
      _total++;
      if (_itemSets[_bigintHash(item)].has(item)) {
        _hits++;
        return true;
      }
      return false;
    },
    clear() {
      _itemSets.forEach(set => set.clear());
      _size = 0n;
      _hits = 0;
      _total = 0;
    },
    toString() {
      const hitPercent = ((_hits / (_total || 1)) * 100).toFixed(2);
      const dist = _size > 81**2 ? _itemSets.map(set => set.size).join(',') : 'n/a';
      return `SuperSet{size: ${_size}, hits: ${_hits}/${_total} (${hitPercent}%), subsetDist: [${dist}]}`;
    }
  };
}

/**
 * A depth-first backtracking approach to finding puzzle masks that satisfy
 * all items in the sieve; i.e. the mask contains bits that overlap with all
 * sieve items.
 *TODO continue
 * The masks are generated via the sieve's reduction matrix,
 *
 * @param {SudokuSieve} sieve
 * @param {number=27} maxLen
 * @param {number=2500} maxSize
 * @param {(mask: bigint, numCells: number) => void} callback
 * @returns {Set<bigint>[]}
 */
// TODO Rewrite this from scratch. DFS over all sieve items.
// TODO     Each node removes and remembers the items they cover from the sieve.
// TODO       When backtracking, the covered sieve items are added again to the sieve.
// TODO     When the sieve is empty, the puzzle mask, m, covers all sieve items. Record m, then backtrack.
// TODO     Respect the max result length by backtracking if the stack grows larger than maxLen.
// TODO     Respect the max results size by stopping the search once there are maxSize results.
// TODO     Don't forget to add all the sieve items back before exiting. The sieve items must remain intact.
export function sieveCombos4(sieve, maxLen = 21, maxSize = 2500, callback = null) {
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

  const startTime = Date.now();
  const MS_TO_UPDATE = 15000;
  let lastUpdate = startTime - MS_TO_UPDATE;
  let iterations = 0;

  while (stack.length > 0 && total < maxSize) {
    iterations++;
    const now = Date.now();
    if ((now - lastUpdate) > MS_TO_UPDATE) {
      lastUpdate = now;
      // Print a snapshot the stack contents and the seen cache
      // console.log(JSON.stringify(stack, (_,v)=>(typeof v === 'bigint') ? v.toString() : v));
      console.log(
        `Stack{ iterations: ${iterations}, [${stack.map(({cell, alts, items}) => `${cell}(${alts.length})`).join(',')}] }`
      );
      // console.log(seen.toString());
    }

  // while (stack.length > 0) {
    // const top = stack[stack.length - 1];
    // let topAltsStr = `{${top.alts.join(',')}}`.padEnd(30, ' ');

    // console.log(`[${stack.map(({cell, alts, items}) => `${cell}(${alts.length})`).join(',')}] }`);

    if (sieve.length === 0) {
      if(!results[stack.length].has(m)) {
        results[stack.length].add(m);
        total++;
        if (callback) {
          callback(m, stack.length);
        }
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

/**
 * A depth-first backtracking approach to finding puzzle masks that satisfy
 * all items in the sieve; i.e. the mask contains bits that overlap with all
 * sieve items.
 *TODO continue
 * The masks are generated via the sieve's reduction matrix,
 *
 * @param {SudokuSieve} sieve
 * @param {number=27} maxLen
 * @param {number=2500} maxSize
 * @returns {Set<bigint>[]}
 */
export function sieveCombos3(sieve, maxLen = 27, maxSize = 2500) {
  // !Side: Modifies sieve by removing overlapping items
  const root = _sieveChoice(sieve);

  const stack = [root];
  /** @type {Set<bigint>[]} */
  const results = range(maxLen + 1).map(() => new Set());

  /** @type {Set<bigint>} */
  const seen = new Set();

  let m = cellMask(root.cell);
  seen.add(m);
  let total = 0;

  // Returns true if replaced, false if popped.
  // !Side: Modifies sieve by adding top items back / removing overlapping items
  // !Side: Modifies stack by popping / updating top
  // !Side: Modifies m to keep in sync with the stack
  const replaceTopWithAltOrPop = () => {
    const top = stack[stack.length - 1];
    // Remove bit on m
    m &= ~cellMask(top.cell);
    // Put back the sieve items
    sieve.add(...top.items);

    // If there's an alt to consider, the try that, or pop the stack to backtrack
    while (top.alts.length > 0) {
      const altCellIndex = top.alts.pop();
      const malt = m | cellMask(altCellIndex);
      if (!seen.has(malt)) {
        m = malt;
        seen.add(m);
        top.cell = altCellIndex;
        top.items = sieve.removeOverlapping(cellMask(altCellIndex));
        return true;
      }
    }

    stack.pop();
    return false;
  };

  while (stack.length > 0 && total < maxSize) {
    const top = stack[stack.length - 1];
    // let mStr = m.toString(2).padStart(81, '0').replace(/0/g, '.').replace(/1/g, '#').padStart(80 + stack.length, ' ');
    // let topAltsStr = `{${top.alts.join(',')}}`.padEnd(30, ' ');

    if (sieve.length === 0) {
      if(!results[stack.length].has(m)) {
        results[stack.length].add(m);
        total++;
      }
      // whenDebugging.log(`[${stack.length}] ${top.cell} (${sieve.length}) ${topAltsStr} ⭐️`.padEnd(64) + mStr);

      // Add each alt to the results
      m &= ~cellMask(top.cell);
      while (top.alts.length > 0) {
        const alt = top.alts.pop();
        const altMask = cellMask(alt);
        m |= altMask;
        seen.add(m);
        // mStr = m.toString(2).padStart(81, '0').replace(/0/g, '.').replace(/1/g, '#').padStart(80 + stack.length, ' ');
        // topAltsStr = `{${top.alts.join(',')}}`.padEnd(30, ' ');
        if(!results[stack.length].has(m)) {
          results[stack.length].add(m);
          total++;
        }
        // whenDebugging.log(`[${stack.length}] ${alt} (${sieve.length}) ${topAltsStr} ⭐️`.padEnd(64) + mStr);
        m &= ~altMask;
      }

      // Add all items back to stack and pop to backtrack
      sieve.add(...top.items);
      stack.pop();
    } else if (stack.length >= maxLen) {
      // whenDebugging.log(`[${stack.length}] ${top.cell} (${sieve.length}) ${topAltsStr}`.padEnd(64) + mStr);

      if (replaceTopWithAltOrPop()) {
        seen.add(m);
      }
    } else {
      // Find next unseen sieve choice
      let { matrix, maximum, maximumCells } = sieve.reductionMatrix();
      maximumCells = shuffle(maximumCells.filter(ci => matrix[ci] === maximum));
      let nextCellFound = false;
      // Check each maximum cell for unseen sieve choices, use the first unseen one
      while (maximumCells.length > 0 && !nextCellFound) {
        const cell = maximumCells.shift();
        const mask = cellMask(cell);
        const malt = m | mask;
        // mStr = malt.toString(2).padStart(81, '0').replace(/0/g, '.').replace(/1/g, '#').padStart(80 + stack.length, ' ');
        // topAltsStr = `{${maximumCells.join(',')}}`.padEnd(30, ' ');
        if (!seen.has(malt)) {
          // Length of sieve if cell is chosen
          // TODO Remove after debug
          // const sieveLen = sieve.filter((item) => (item & mask) === 0n).length;

          // whenDebugging.log(`[${stack.length + 1}] ${cell} (${sieveLen}) ${topAltsStr}`.padEnd(64) + mStr);
          seen.add(malt);
          stack.push({
            cell,
            alts: maximumCells,
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
        if (replaceTopWithAltOrPop()) {
          seen.add(m);
        }
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

/**
 *
 * @param {Sudoku} config TODO this is for debug messages. remove later
 * @param {bigint[]} sieve
 * @param {number} maxLen
 * @returns {bigint[][]}
 */
export function sieveCombos2(config, sieve, maxLen = 27) {
  /** @type {bigint[][]} */
  const results = range(maxLen + 1).map(() => []);
  /** @type {Set<bigint>} */
  const seen = new Set();

  // Sort sieve by bit count asc
  sieve.sort((a, b) => a.toString(2).replace(/0/g, '').length - b.toString(2).replace(/0/g, '').length);

  /** @type {number[][]} */
  const queue = [];
  // Get first sieve item
  let first = sieve[0];
  // For each cell in the first sieve item, push in new array to queue
  for (let ci = 0; ci < 81; ci++) {
    if (first & cellMask(ci)) {
      queue.push([ci]);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (current.length > maxLen) {
      continue;
    }

    const mask = current.reduce((mask, ci) => (mask | cellMask(ci)), 0n);
    // Find first item that doesn't overlap with mask
    const sieveTop = sieve.find((item) => (item & mask) === 0n);

    // There are none left (all overlap with mask)
    if (!sieveTop) {
      results[current.length].push(mask);
      whenDebugging.log(
        `[${current.length.toString().padStart(2, ' ')}]` +
        ` ${mask.toString().padStart(30, ' ')}` +
        `    ${config.filter(mask).toString()}`
      );
    } else if (current.length < maxLen) {
      for (let ci = 0; ci < 81; ci++) {
        // const nextCellMask = cellMask(ci);
        const nextMask = (mask | cellMask(ci));
        if (
          (sieveTop & nextMask) === 0n &&
          !seen.has(nextMask)
        ) {
          const next = [...current, ci];
          seen.add(nextMask);
          queue.push(next);
        }
      }
    }
  }

  return results;
}

/**
 *
 * @param {Sudoku} config TODO this is for debug messages. remove later
 * @param {bigint[]} sieve
 * @param {number} maxLen
 * @returns {bigint[][]}
 */
export function sieveCombos(config, sieve, maxLen = 27) {
  /** @type {bigint[][]} */
  const results = range(maxLen + 1).map(() => []);
  /** @type {Set<bigint>} */
  const seen = new Set();

  for (let ci = 0n; ci < 81n; ci++) {
    let mask = 1n << ci;
    let _sieve = sieve.filter((item) => (item & mask) === 0n);
    let len = 1;
    for (let cj = ci + 1n; (cj < 81n) && (_sieve.length > 0) && (len < maxLen); cj++) {
      const _mask = mask | (1n << cj);
      if (seen.has(_mask) || _sieve.every((item) => (item & _mask) === 0n)) {
        continue;
      }
      mask = _mask;
      seen.add(mask);
      len++;
      _sieve = _sieve.filter((item) => (item & mask) === 0n);
    }

    if (_sieve.length > 0) {
      continue;
    }

    results[len].push(mask);
    whenDebugging.log(
      `[${len.toString().padStart(2, ' ')}]` +
      ` ${mask.toString().padStart(30, ' ')}` +
      `    ${config.filter(mask).toString()}`
    );
  }

  return results;
}

/**
 *
 * @param {bigint[] | Set<bigint>} sieve
 * @returns {{matrix: number[], maximum: number, maximumCells: number[]}}
 */
export function reductionMatrix(sieve) {
  const result = {
    /** @type {number} */
    matrix: Array(81).fill(0),
    maximum: 0,
    /** @type {number[]} */
    maximumCells: []
  };

  sieve.forEach((mask) => {
    for (let ci = 0; ci < 81; ci++) {
      if (mask & cellMask(ci)) {
        result.matrix[ci]++;

        if (result.matrix[ci] > result.maximum) {
          result.maximum = result.matrix[ci];
          result.maximumCells = [ci];
        } else if (result.matrix[ci] === result.maximum) {
          result.maximumCells.push(ci);
        }
      }
    }
  });

  return result;
}

/**
 *
 * @param {Sudoku} config
 * @param {Set<bigint} sieve
 * @returns {bigint}
 */
export function createBoardMaskFromSieve(config, sieve, maxSelections = 27, maxAttempts = 100) {
  /** @type {bigint[]} */
  let _sieve; // = Array.from(sieve);
  let selectedCount = 0;
  let mask = 0n;
  let attempts = 0;

  const start = Date.now();

  do {
    selectedCount = 0;
    mask = 0n;
    _sieve = Array.from(sieve);
    // For each sieve item, if the root puzzle overlaps with the sieve item, then add pick a cell from the sieve item
    // and add it to the root puzzle.
    while (_sieve.length > 0) {
      const { matrix, maximum, maximumCells } = reductionMatrix(_sieve);

      // Collect all the distinct cell indices in the matrix.
      /** @type {{ci: number, count: number}[]} */
      const allCells = matrix.reduce((_allCells, count, ci) => {
        if (count > 0) {
          _allCells.push({ ci, count: count });
        }
        return _allCells;
      }, []).sort((a, b) => a.count - b.count);
      // Sum the counts of all cells.
      const countSum = allCells.reduce((sum, cell) => sum + cell.count, 0);
      // Generate a random number between 0 and the sum of the counts.
      // This will give us a random cell weighted by the count.
      // Higher count = higher chance of being selected.
      const rand = Math.floor(Math.random() * countSum);
      let chosenCell = null;
      let sum = 0;
      for (let i = 0; i < allCells.length; i++) {
        sum += allCells[i].count;
        if (sum >= rand) {
          chosenCell = allCells[i];
          break;
        }
      }
      if (chosenCell === null) {
        throw new Error('chosenCell is null');
      }

      const nextCi = chosenCell.ci;

      // Choose random cell from the maximum cells.
      // const nextCi = maximumCells[Math.floor(Math.random() * maximumCells.length)];
      selectedCount++;

      mask |= cellMask(nextCi);
      _sieve = _sieve.filter((item) => (item & mask) === 0n);
    }
  } while (selectedCount > maxSelections);// && attempts++ < maxAttempts);

  whenDebugging.log(`createBoardMaskFromSieve: generated mask from sieve in ${Date.now() - start}ms after ${attempts} attempts`);

  return mask;
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

/**
 *
 * @param {Sudoku} config
 * @param {bigint[]} existingSieve
 * @param {number} maxSieveSize
 * @returns {bigint[]}
 */
export function f(config, existingSieve = [], maxSieveSize = 100) {
  const ss = new SudokuSieve({ config });

  console.log(config.toString());

  /** @type {bigint[]} */
  const sieve = [];
  // let i = 0;
  const padding = Math.ceil(Math.log10(maxSieveSize));
  if (existingSieve && existingSieve.length > 0) {
    existingSieve.forEach((sieveItem) => {
      if (ss.add(sieveItem)) {
        console.log(`[${ss.length.toString().padStart(padding, ' ')}]  ${sieveItem}n,`);
        sieve.push(sieveItem);
        // i++;
      } else {
        console.log(`❌  sieve item was not added [${sieveItem}]`);
      }
    });
  } else {
    searchForSieve2(config, { maxDigits: 2, maxLength: 18 }).forEach((sieveItem) => {
      if (ss.add(sieveItem)) {
        console.log(`[${ss.length.toString().padStart(padding, ' ')}]  ${sieveItem}n,`);
        sieve.push(sieveItem);
        // i++;
      } else {
        console.log(`❌  sieve item was not added [${sieveItem}]`);
      }
    });
    searchForSieve2(config, { maxDigits: 3, maxLength: 9 }).forEach((sieveItem) => {
      // if (!sieve.includes(sieveItem)) {
        if (ss.add(sieveItem)) {
          console.log(`[${ss.length.toString().padStart(padding, ' ')}]  ${sieveItem}n,`);
          sieve.push(sieveItem);
          // i++;
        } else {
          if (!ss.isDerivative(sieveItem)) {
            console.log(`❌  sieve item was not added [${sieveItem}]`);
          }
        }
      // }
    });
  }

  /** @type {Set<bigint>} */
  const starSet = new Set();

  const keepGoing = true;
  while (keepGoing && ss.length < maxSieveSize) {
    const mask = ss._generateMask2();
    // const mask = createBoardMaskFromSieve(config, sieve);
    const board = config.filter(mask);
    // const board = config.filter(~mask);
    const flag = solutionsFlagCache.getFor(board);
    // board._resetEmptyCells();
    // board._reduce();
    // const flag = board.solutionsFlag();
    if (flag < 2) {
      // UHM SURE
      // Let's just debug
      if (!starSet.has(mask)) {
        console.log(`[${81 - board.numEmptyCells}] ⭐️  ${board.toString()}`);
        starSet.add(mask);
      }
      continue;
    }
    // board._resetEmptyCells();
    // board._reduce();

    const prime = searchForPrimeInvalidFromMask(ss, mask, solutionsFlagCache);
    if (prime > 0n) {
      ss.add(prime);
      console.log(`[${ss.length.toString().padStart(padding, ' ')}]  ${prime}n,`);
    } else {
      whenDebugging.log('prime not found');
    }

    // /** @type {Node[]} */
    // const stack = [{ puzzle: board, nexts: null }];
    // // const seen = new Set();
    // // seen.add(board.mask);

    // // whenDebugging.log(board.toString());

    // // TODO Remove unnecessary stack and seen map and nexts generation
    // while (stack.length > 0) {
    //   const current = stack[stack.length - 1];
    //   if (current.nexts === null) {
    //     const nextNodes = current.puzzle.board.reduce((_nexts, digit, ci) => {
    //       if (digit === 0) {
    //         const nextPuzzle = new Sudoku(current.puzzle);
    //         nextPuzzle.setDigit(config.board[ci], ci);
    //         const pFlag = solutionsFlagCache.getFor(nextPuzzle);
    //         nextPuzzle._resetEmptyCells();
    //         nextPuzzle._reduce();
    //         if (pFlag > 1) {
    //           _nexts.push({
    //             puzzle: nextPuzzle,
    //             nexts: null
    //           });
    //         }
    //       }

    //       return _nexts;
    //     }, []);

    //     if (nextNodes.length === 0) {
    //       const item = current.puzzle.emptyCellMask;
    //       if (ss.add(item)) {
    //         // sieve.push(item);
    //         // whenDebugging.log(current.puzzle.toString().padStart(80 + stack.length, ' '), ' ✅');
    //         console.log(`[${ss.length.toString().padStart(padding, ' ')}]  ${item}n,`);
    //         // i++;
    //       } else {
    //         console.log(`❌  sieve item is not valid [${item}]`);
    //       }
    //       break;
    //     } else {
    //       // whenDebugging.log(current.puzzle.toString().padStart(80 + stack.length, ' '));
    //     }

    //     current.nexts = shuffle(nextNodes);
    //   }

    //   let next = current.nexts.pop();
    //   // while (current.nexts.length > 0 && next === null) {
    //   //   const n = current.nexts.pop();
    //   //   // if (!seen.has(n.puzzle.mask)) {
    //   //     next = n;
    //   //   // } else {
    //   //   //   console.log('pork butts and taters');
    //   //   // }
    //   // }

    //   // if (next === null) {
    //   //   stack.pop();
    //   // } else {
    //     // seen.add(next.puzzle.mask);
    //     stack.push(next);
    //   // }
    // }
  }

  // console.log(`Sieve size: ${sieve.length}`);
  // sieve.forEach((sieveItem) => {
  // // console.log(config.filter(sieveItem).toString());
  //   console.log(config.filter(~sieveItem).toString());
  // });

  // return Array.from(sieve);
  return ss.items;
}

/**
 *
 * @param {Sudoku} config
 * @param {bigint[]} existingSieve
 * @param {number} maxSieveSize
 * @returns {bigint[]}
 */
export function f2(config, existingSieve = [], maxSieveSize = 1000) {
  const ss = new SudokuSieve({ config });

  console.log(config.toString());

  /** @type {bigint[]} */
  const sieve = [];
  // let i = 0;
  const padding = Math.ceil(Math.log10(maxSieveSize));
  if (existingSieve && existingSieve.length > 0) {
    existingSieve.forEach((sieveItem) => {
      if (ss.add(sieveItem)) {
        console.log(`[${ss.length.toString().padStart(padding, ' ')}]  ${sieveItem}n,`);
        sieve.push(sieveItem);
        // i++;
      } else {
        console.log(`❌  sieve item was not added [${sieveItem}]`);
      }
    });
  } else {
    searchForSieve2(config, { maxDigits: 2, maxLength: 18 }).forEach((sieveItem) => {
      if (ss.add(sieveItem)) {
        console.log(`[${ss.length.toString().padStart(padding, ' ')}]  ${sieveItem}n,`);
        sieve.push(sieveItem);
        // i++;
      } else {
        console.log(`❌  sieve item was not added [${sieveItem}]`);
      }
    });
    searchForSieve2(config, { maxDigits: 3, maxLength: 9 }).forEach((sieveItem) => {
      // if (!sieve.includes(sieveItem)) {
        if (ss.add(sieveItem)) {
          console.log(`[${ss.length.toString().padStart(padding, ' ')}]  ${sieveItem}n,`);
          sieve.push(sieveItem);
          // i++;
        } else {
          if (!ss.isDerivative(sieveItem)) {
            console.log(`❌  sieve item was not added [${sieveItem}]`);
          }
        }
      // }
    });
  }

  /** @type {Set<bigint>} */
  const starSet = new Set();

  const keepGoing = true;
  while (keepGoing && ss.length < maxSieveSize) {
    const mask = ss._generateMask2();
    // const mask = createBoardMaskFromSieve(config, sieve);
    const board = config.filter(mask);
    const flag = solutionsFlagCache.getFor(board);
    // board._resetEmptyCells();
    // board._reduce();
    // const flag = board.solutionsFlag();
    if (flag < 2) {
      // UHM SURE
      // Let's just debug
      if (!starSet.has(mask)) {
        console.log(`[${81 - board.numEmptyCells}] ⭐️  ${board.toString()}`);
        starSet.add(mask);
      }
      continue;
    }
    board._resetEmptyCells();
    board._reduce();

    /** @type {Node[]} */
    const stack = [{ puzzle: board, nexts: null }];
    const seen = new Set();
    // seen.add(board.mask);

    // whenDebugging.log(board.toString());

    // TODO Remove unnecessary stack and seen map and nexts generation
    while (stack.length > 0) {
      const current = stack[stack.length - 1];
      if (current.nexts === null) {
        const nextNodes = current.puzzle.board.reduce((_nexts, digit, ci) => {
          if (digit === 0) {
            const nextPuzzle = new Sudoku(current.puzzle);
            nextPuzzle.setDigit(config.board[ci], ci);
            const pFlag = solutionsFlagCache.getFor(nextPuzzle);
            nextPuzzle._resetEmptyCells();
            nextPuzzle._reduce();
            if (pFlag > 1) {
              _nexts.push({
                puzzle: nextPuzzle,
                nexts: null
              });
            }
          }

          return _nexts;
        }, []);

        if (nextNodes.length === 0) {
          const item = current.puzzle.emptyCellMask;
          if (ss.add(item)) {
            // sieve.push(item);
            // whenDebugging.log(current.puzzle.toString().padStart(80 + stack.length, ' '), ' ✅');
            console.log(`[${ss.length.toString().padStart(padding, ' ')}]  ${item}n,`);
            // i++;
          } else {
            console.log(`❌  sieve item is not valid [${item}]`);
          }
          break;
        } else {
          // whenDebugging.log(current.puzzle.toString().padStart(80 + stack.length, ' '));
        }

        current.nexts = shuffle(nextNodes);
      }

      let next = null;
      while (current.nexts.length > 0 && next === null) {
        const n = current.nexts.pop();
        if (!seen.has(n.puzzle.mask)) {
          next = n;
        }
      }

      if (next === null) {
        stack.pop();
      } else {
        seen.add(next.puzzle.mask);
        stack.push(next);
      }
    }
  }

  // console.log(`Sieve size: ${sieve.length}`);
  // sieve.forEach((sieveItem) => {
  //   console.log(config.filter(sieveItem).toString());
  //   console.log(config.filter(~sieveItem).toString());
  // });

  // return Array.from(sieve);
  return ss.items;
}

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

/**
 *
 * @param {Sudoku} config
 * @param {bigint[]} sieveItems
 * @param {(failReason: string) => void} failCallback
 * @returns {boolean}
 */
export function verifySieveItems(config, sieveItems, failCallback = null) {
  const _sieveSet = new Set(sieveItems);

  if (_sieveSet.size !== sieveItems.length) {
    if (failCallback) {
      failCallback('contains duplicates');
    }
    return false;
  }

  // const configBoard = config.board;

  for (let i = 0; i < sieveItems.length; i++) {
    const item = sieveItems[i];

    // Check for derivatives
    // for (let j = 0; j < sieve.length; j++) {
    //   const other = sieve[j];
    //   if ((item & other) === other && item !== other && item !== 0n && other !== 0n) {
    //     if (failCallback) {
    //       failCallback(
    //         `item [${item}] is a derivative of [${other}]\n` +
    //         `other: ${config.filter(~other).toString()}\n` +
    //         ` item: ${config.filter(~item).toString()}`
    //       );
    //     }
    //     return false;
    //   }
    // }

    const p = config.filter(~item);
    const b = p.board;

    if (p._reduce()) {
      if (failCallback) {
        failCallback(
          `sieve item[${i}]: ${item}n; is reducable\n` +
          `            ${b.join('')}\n` +
          `  reduced > ${p.toString()}`
        );
      }
      return false;
    }

    // Check that there are multiple solutions
    const pFlag = p.solutionsFlag();
    if (pFlag !== 2) {
      if (failCallback) {
        failCallback(`sieve item[${i}]: ${item}n; has pFlag = ${pFlag} (expected: 2)`);
      }
      return false;
    }

    // For every antiderivative, check that it has a single or no solution
    for (const a of p.getAntiderivatives()) {
      const aFlag = a.solutionsFlag();
      if (aFlag === 0) {
        console.log(`sieve item[${i}]: ${item}n; has no solution (expected: 1)`);
        return false;
      }
      if (aFlag > 1) {
        if (failCallback) {
          failCallback(`sieve item[${i}]: ${item}n; has multiple solutions (expected: 1)`);
        }
        return false;
      }
    }
  }

  return true;
}

// const config = new Sudoku('218574639573896124469123578721459386354681792986237415147962853695318247832745961');
// const configBoard = config.board;
// console.log(config.toFullString());

/**
 * Prebuilt sieve for
 * `218574639573896124469123578721459386354681792986237415147962853695318247832745961`
 * @type {bigint[]}
 */
export const sieve = [
  306954992322430055219200n,
  442722210901249822980n,
  9288709664931840n,
  23833193662228564279302n,
  3458764556770410496n,
  158348076961214400921612n,
  42663861689921679983636n,
  14906266688228606427268n,
  1213815652731362392213572n,
  321492179682895215071490n,
  456003513502100115984648n,
  90715224165318656n,
  312561793925627461783552n,
  18711025025408n,
  1511157274518286468383040n,
  3151872n,
  906694367033157887197184n,
  332635868477652992257n,
  1649267453952n,
  230215483705507665445416n,
  114531268434214944507440n,
  85002776835641929891840n,
  1770887431076134011552n,
  9165803807047680n,
  1285683059475306671767552n,
  343597386240n,
  5387583584n,
  681238871132469039473185n,
  11258999152312320n,
  56751409310457911050240n,
  6917529027678962706n,
  623465938509745721704448n,
  2286993044144131n,
  71442432n,
  188894661003635668811800n,
  2375090357084813787136n,
  13194173645824n,
  163512156372221582688392n,
  1362421542415355368474696n,
  47827941100928861750416n,
  1246737327144062647536720n,
  642247033199690103390208n,
  46116860185079194641n,
  1218979732142369573980352n,
  1945302859486693884288n,
  3458775590675513344n,
  275301696513360493805568n,
  6825820085633248n,
  666539570645056880832n,
  1275455443268349722624n,
  226673592866592830521392n,
  24128341568507416150022n,
  264452523040700131967032n,
  13194198630912n,
  1970324864237688n,
  23611837596552686206982n,
  126100789610235392n,
  1061056725901561129074880n,
  33056570137637554225152n,
  442721861067576705024n,
  864691134897610752n,
  813242006312060977152n,
  686108199077553062805509n,
  1331712428229619624181760n,
  90775682272198656n,
  55340232221933964288n,
  99262254119804274222615n,
  913822950431575924277253n,
  906694371503853501677568n,
  1322267659235086536015872n,
  1919328385580838103810246n,
  3027715986285656246468n,
  70328216420387651584n,
  611227820850784168388129n,
  1970324879119642n,
  61510668113784499863557n,
  4132070703297315471360n,
  8321934616166593n,
  758249397965351851131009n,
  1373417922506891555000320n,
  54148748644722195n,
  624572202719876548132870n,
  1008824636982427648n,
  600407575887914n,
  203218790275201908867100n,
  313905469185801060352n,
  188894660722160719675976n,
  2707726225561727533056n,
  1034315057901089083392n,
  7958295495049216n,
  33056570631563491672064n,
  221364595206050021376n,
  28334199636092235284483n,
  1823442313028918944793804n,
  246290673041667n,
  231562482787019194682280n,
  28342269558916520083730n,
  1221354403528273766907904n,
  33056565591193817448711n,
  221361773309449469962n,
  2142272270799188252042n,
  2412001859635451531813n,
  27670116591626389028n,
  2930224660480000n,
  1770894468672479495378n,
  227560437823068700672n,
  62657933097259388961356n,
  1246709651393980922331162n,
  188894660722160719364200n,
  33056573789870510571520n,
  341931298109148626944n,
  59622912n,
  774471057551977370091520n,
  17118579154833208410112n,
  51644925331n,
  1839991328065823179211397n,
  131801094455116948n,
  837233798419765576859648n,
  113336795602071037511796n,
  624055808727190861775040n,
  1825803442332299040047794n,
  1008813754877476864n,
  264452524870291238682624n,
  212672915263149618233344n,
  757977362533460163690625n,
  8794976666021119384n,
  1890208321619465525526528n,
  2951479079343596208128n,
  983746746890300344500224n,
  3709272752730537099264n,
  55380204387059344n,
  4793986806153216n,
  52398534998124036620316n,
  516509294896746856711n,
  683711962922644723638284n,
  5767146056475213824n,
  42658096514878268243992n,
  1871380198981632n,
  1242591240333548601213381n,
  90071993018745089n,
  33056570703029464989696n,
  64568187109086633289n,
  49761497615942229269777n,
  170116522368844605423616n,
  1261486502212384132925508n,
  350349788227303584912384n,
  722099853815826280874032n,
  25382720021346220573316n,
  899440925170158555136n,
  1523571933279892996657416n,
  226673596394447560519209n,
  6342058902028288n,
  91380420646797312n,
  742859607220320498352128n,
  516514229436144418816n,
  14201687711915513889792n,
  1770887431076176315552n,
  51615449473n,
  128917556946113509982208n,
  369655460163349401600n,
  652910004501229577699328n,
  442726714470813401088n,
  1312821683522137474926660n,
  126100789586858568n,
  2939177519808512n,
  1362712019525887873515520n,
  1314238295534855767195658n,
  433900284958212096n,
  207895457611700510916608n,
  64563604257983441937n,
  217228859830484805877774n,
  1854751606733011750486016n,
  227190100864213427683368n,
  76890501n,
  906694367500046469693440n,
  1247975595234836258752000n,
  51976799619n,
  1266640121577616n,
  23611922618471283163526n,
  774058469490688n,
  614534834481878737617280n,
  1372170479453305456055808n,
  23657950013407132385285n,
  1674982808636900996284416n,
  625181024086890128148684n,
  341895269312263882240n,
  27671279467417832448n,
  1940695692491121230016n,
  720594256535773184n,
  2043660408471579606908928n,
  64563610937462882304n,
  1410384010650628707581952n,
  189116021651045219827722n,
  4874330477428736n,
  626343134128875155488768n,
  14168113542683045423104n,
  1257353328148919152017408n,
  7042141694657610n,
  114447779592078421545104n,
  705006888981678474657834n,
  9117443063677698n,
  635966850230708743900546n,
  27670122789775346688n,
  623761230527364371337216n,
  1229606961593063814858946n,
  906694368149336135565315n,
  1860995474410778396160n,
  3669280777551126464000n,
  27670116591600748196n,
  54148749090178563n,
  42953245054613269250048n,
  143075308012611559227416n,
  1012689356372911756673130n,
  5764638360899518848n,
  177250265317720390108672n,
  5764639462558629888n,
  80455798536657380050432n,
  23611841487802183434916n,
  90177546067902467n,
  631654668378145233015048n,
  993873857351432827568128n,
  625753983290483369673728n,
  91720922500582223904812n,
  90079084244453028n,
  14167099475186328273280n,
  1035180250359736202522n,
  837201679111315716199436n,
  55340236143789611557n,
  388193462439110558875648n,
  1770896685546655187335n,
  1256911997903434980261888n,
  1273107446566829087543340n,
  332743955280998170775n,
  681278322664384204120609n,
  3119012984325361158312n,
  623836046681770474676486n,
  116288274660090345328920n,
  33056565380087567713926n,
  713080259357834677119103n,
  221361457887084679574n,
  1870148213679975234011136n,
  1909108891220607248739382n,
  681868330264164441415824n,
  630478681624219135052118n,
  1275043850502305026675730n,
  66196231426790282241041n,
  55775005522468292608n,
  1247087827665189011980288n,
  368934884772831170961n,
  1219132921947279975251968n,
  23611834701341807092757n,
  1676978372472272527360n,
  614918200655211337451996n,
  23611837114432367813348n,
  1294190425150377164800n,
  33056565380087919935495n,
  64564767615105368064n,
  832354905498334418436103n,
  1928135261190696944533504n,
  103892558989176156868874n,
  14167100722818102673540n,
  1294532889681364922925056n,
  698913301912869641674758n,
  642248186398443707564032n,
  59346020n,
  56751498390682515800064n,
  200849520750318963098882n,
  228279302337123717400n,
  59751950765264384n,
  2289909126802119303906038n,
  441188499n,
  906697830230910912497732n,
  28334256535827433931298n,
  46117512369295606309n,
  1816930517821283224518785n,
  1457163024110594000392488n,
  2498099412729856n,
  221366394762987307008n,
  160560735357133583403660n,
  173770716942249653960704n,
  2146963583231558238380937n,
  808191853375081943138688n,
  698284804857824783630336n,
  23611886563096879448614n,
  1829439890694219392614405n,
  3320422045771330916648n,
  456667596313227994234920n,
  175469122706174776066186n,
  964017325182n,
  314050156104890994688n,
  122782288541995696652336n,
  1239643197509783808606208n,
  8848525982957568n,
  42990805003900277000311n,
  5764612919392206848n,
  1290602251351153002516808n,
  92429354471522304n,
  264460604257712013968642n,
  6343106739830784n,
  29073366136837533335558n,
  1362920682848593820254281n,
  2412001859630139441409n,
  2951479071595496391168n,
  683711998405665139744768n,
  1813388736177343296438628n,
  188894667512793302384873n,
  909645846389104190194688n,
  90071993521808529n,
  832541341232693765996544n,
  2957243681349744885760n,
  1262307281285479827721284n,
  1827555833498622692163715n,
  368349366679726674149830n,
  1386143689933579972771885n,
  676027060196876392333504n,
  1976956801757060842963145n,
  624061569135301368217729n,
  35312903430492015682n,
  5770830877093414098n,
  474895357360595997294976n,
  4618035138658307n,
  119805297723389729832960n,
  421960951699341673341445n,
  723936130107204794580992n,
  51539712332n,
  1968083787253217285373952n,
  1666700234058604289720512n,
  1126806553505207835610458n,
  2954937843823056879616n,
  828909521035085827n,
  1226063567188458475676829n,
  1726307478011960n,
  61492221369916948742150n,
  113336796223565798605336n,
  28334199073140135165955n,
  232135772989340795281957n,
  6201319803060280n,
  28334199073139769737362n,
  1289212138721084803941248n,
  6205718973924080n,
  23611833101717073821702n,
  5671349731755080n,
  721492520779178568n,
  681215830821502653047331n,
  1561688310855729774874624n,
  1449768203594492528935884n,
  1266640079577649n,
  6917529028078208131n,
  80483468652768364364293n,
  3016042678291657818112n,
  42953250059474234769408n,
  46206932177560535297n,
  226673596294938868385892n,
  1989337634558461370957824n,
  1813610095135941617328128n,
  778270484257282952676002n,
  6198250556623602842n,
  1447714796351540649021440n,
  330568052741761245642752n,
  705884423951582756098048n,
  1223343967723658029249866n,
  14194769564925700686848n,
  1813389707431298162551017n,
  463714901254363283980288n,
  379931879140681322594528n,
  2384072223599948118695961n,
  2116288158222358490982468n,
  2959549524316008972288n,
  625757442054997189591040n,
  456171101566230115483651n,
  1549854080746740408932068n,
  963951893838n,
  51539830707n,
  700220282553114046758912n,
  5216154208394506n,
  113337227934438940737562n,
  64563604258017315973n,
  4135533799517758505120n,
  198340188507813273141248n,
  332635868477594550821n,
  765651215008240665886912n,
  3465603502234256096n,
  331469886537363596001826n,
  1289235919436376889706456n,
  23611832590270154932485n,
  12187150139536n,
  1194476573671960827658n,
  49192426231252541048213n,
  3542797346462136297472n,
  1970324883737694n,
  355279708395596n,
  3225876518928384n,
  1087338982641960336118570n,
  264452633169847698063360n,
  124552884360048191471824n,
  33499293440223121523734n,
  108086803399477348n,
  456003513530786336899456n,
  433893683589283840n,
  56751408881642067984384n,
  196717344191387164779538n,
  758091430287606395437056n,
  226674317322391247931432n,
  23611836115991559929862n,
  6863250633261056n,
  384443999590551106093476n,
  49152970880265006089936n,
  3028868907790263091200n,
  1397825522961005154402344n,
  973804364966079234048n,
  1139646262015340593553957n,
  28703133993096835109122n,
  3463305578483909704n,
  5636109927720025n,
  2895074514141184n,
  46117503416453857829n,
  1290552675651798981148672n,
  1251598039418145035255832n,
  46171008933723899395n,
  698913247876762565620262n,
  703636678097064220025064n,
  681943424179369163678089n,
  663017631320465490313216n,
  1226656653714728045248896n,
  145029210114198256268306n,
  790443686366286778567364n,
  559976298891243941957936n,
  113336796996251747876912n,
  1813388826289271114601032n,
  456151088299114750067528n,
  27670125156436773958n,
  1194478470168914167369n,
  4132086435110105694945n,
  221363639876735865094n,
  3028094298916255945380n,
  5417550010n,
  516576761125604180576n,
  1437005124445811400868864n,
  28361869224915724441166n,
  758278302230806053389330n,
  1813388736177343675498569n,
  1813388736355545776475108n,
  1813905245011407167164768n,
  3664403293536256n,
  161757450258297205506670n,
  623705766838275951037440n,
  813530239436998049792n,
  984355916383634651632003n,
  1390866059965601279172745n,
  1890498720478834582491488n,
  468437268247580403302400n,
  255007794516575573254951n,
  113336885671052925507090n,
  1770893067185656168640n,
  2460748821996771087872n,
  1890141344085804050286080n,
  1195615629117323617809n,
  179477848667268791228206n,
  4785130450260228n,
  128274514998909273636864n,
  89891398202558523375616n,
  1008806316537966858n,
  2951533226930452222890n,
  611584577998865220338693n,
  1813388736908606549887173n,
  1223276525120925354702104n,
  330567977904599262560256n,
  2038754622793312192430087n,
  203228159732957826514944n,
  3541892599231727271936n,
  325845647217430230041126n,
  1967310386913910156525568n,
  165283079128860395225224n,
  64568187109286871040n,
  7010315311376630918n,
  368939704056754016516n,
  14167208819679073944594n,
  1856122053220572770412612n,
  14167207535481097853257n,
  226673592094323350970921n,
  23611832590270095245444n,
  949356641149623197648018n,
  1246709651393980976414960n,
  14167210108828536012800n,
  721221921115099401n,
  2621239101109446017024n,
  13194198354020n,
  321123244868491229265920n,
  3463312171356749824n,
  1770887431127709713866n,
  2475970991486021107712n,
  28334199073139749458698n,
  246819871669647241641984n,
  54301672168755746n,
  323340438853805693952n,
  99336061470543758491648n,
  1979291756034266539320404n,
  463714901746946774138880n,
  625752830395367007977601n,
  1823663566715425019396312n,
  90072045061342467n,
  34827452811163658879142n,
  57426682n,
  108086808753471532n,
  80465310398556046538670n,
  477146454586385531871237n,
  860761976055431409172480n,
  1367291120316125555040809n,
  410181963378983706595754n,
  90178171566126083n,
  642625206087700914896896n,
  1060466430091202423423424n,
  323163768405928969728n,
  368934901989370785792n,
  23611945614363052212271n,
  234791419606025839366312n,
  6919499352520200472n,
  28334199073139778208786n,
  835860928791890893428500n,
  7485409507480900096n,
  422513455280097283068056n,
  347584576648723183997212n,
  474319076756675715188360n,
  2060243072705752058560512n,
  14167100100793412091904n,
  442723072903902987284n,
  1815159630363818845274241n,
  1637835895273772233523248n,
  681278178549193974505472n,
  874980378393323975475200n,
  23611832660644211720238n,
  33056570358869451080064n,
  1816345978803175309280256n,
  221415916642325140368n,
  36598353955554930458624n,
  745581727712548863838046n,
  1378933684204988671393832n,
  68026947233516685380n,
  727249806652681289212449n,
  113392189971766746160914n,
  1977230998916773598922948n,
  417783445048442783389202n,
  906694372598898363465728n,
  3055494201249532659331n,
  57047280041728189419520n,
  1990803226898008578721286n,
  1967502708116748578586624n,
  113336795588879045443728n,
  2393560262439012401152n,
  623687317626201828491264n,
  1554716234229608140001280n,
  53230566011889378131968n,
  23962915132452636891471n,
  270504245492074233926442n,
  259730161670628321788086n,
  1196768550578968544768n,
  1903119799613901244825731n,
  251024680639649891483688n,
  568159723105549295812648n,
  2533338973335984883884n,
  188894665296839075430440n,
  1143938276652285625098929n,
  643522486670434613854320n,
  1246931018305502013625620n,
  728579125147493009006592n,
  906701293623675149501094n,
  27728742156590908928n,
  1856122357216339302957568n,
  1214738435510642811171681n,
  8070450592478396801n,
  350578065277840861320192n,
  944482087624103446994944n,
  700201943895434615324672n,
  1436861005851448387305472n,
  1428908106581625454743558n,
  56224629292025372n,
  629304954820431622931968n,
  14167103150252307513490n,
  1715359560887030043901992n,
  2163681735704970012917784n,
  230805662476984282955936n,
  1234956553412273617698821n,
  250292351859224326914724n,
  1405106944846311905558533n,
  221368543552398037457n,
  14167099457585552523264n,
  283748519903343007503924n,
  33056566136725596798976n,
  113392243909409163975698n,
  54148748662182666n,
  710351688575092847159554n,
  76825381n,
  619424951528622101997761n,
  498661609172553534199603n,
  906694371510446410694656n,
  113779625535095178024468n,
  1289207529538087754957384n,
  55448319438164101192n,
  1777811785923868950720n,
  1348089498058600301056n,
  1247014042096269065715712n,
  463724124415294576525312n,
  1770889401401014747352n,
  1438012259328732967216673n,
  1457296603443776077316576n,
  442727215710676713472n,
  28334919896060326338566n,
  1770887450878118346896n,
  1852891507088009723904n,
  246291009110019n,
  47602309474265795134976n,
  2951479078181807425732n,
  684229513514395319164928n,
  1813416404270696055473793n,
  3541786416477743611904n,
  1990627072580985167020038n,
  332852042223257670180n,
  1813416404200052415081621n,
  417782583739961890623642n,
  1134862473771422461198336n,
  59114969312347658846208n,
  466052467408245943435264n,
  1259125318961946924580864n,
  1218095180209962985377792n,
  498598253n,
  23612554717349850202804n,
  3869560926698173628416n,
  1463941067650572984468618n,
  387690248817742970880n,
  198339916742211445456896n,
  569340309090971601245490n,
  1658819857948738789376n,
  109075926718235126267904n,
  412325082303394086191798n,
  42658101653089915311380n,
  419405173286248666141114n,
  264452525100260430708736n,
  721880584479328256n,
  33056567350412362138654n,
  54686427162116608n,
  1986975414912524520259624n,
  1362554056357153624555520n,
  906694367923358444552192n,
  27729306188741871104n,
  54715072433635874n,
  1848277287072902513664n,
  1266134072903597087005714n,
  388212053293689225609216n,
  369943691089263226880n,
  1928055131749197335855184n,
  1430882161102373479514119n,
  1022688670581934n,
  48489752784739864937984n,
  1362849204237061255593984n,
  708357963031705590178337n,
  1813389599461135505008716n,
  33057574644494790295552n,
  209961923599722598125776n,
  1758198886480448840718444n,
  1813394499665610745577472n,
  104021517081504106151936n,
  1666999228759656280097152n,
  864701115462070817n,
  115352926034854081n,
  1813617012702421404811264n,
  1350684778654930936266752n,
  516508834063897645578n,
  3541784248289205420416n,
  846668768426762972168204n,
  160560676801456293625996n,
  80446575165032842216100n,
  42658096023534009718034n,
  1848277287072877068800n,
  681573326454370106242354n,
  1981569445857485013745664n,
  769747544903002576751172n,
  1291142969285968406774208n,
  59225812322787851n,
  27671842419384542225n,
  3550287804820665630832n,
  245803279957770462569147n,
  1770887431076167870129n,
  2952347279781991588882n,
  695562155415330148319232n,
  7360023096061497642n,
  1762963221437004151717894n,
  1770887454081891172736n,
  404691267210532007989253n,
  188900429884240456417320n,
  766808766002158334902464n,
  2951479994762205110921n,
  661438580361236110639104n,
  759639957235846971674624n,
  226673592111403362156584n,
  5699890316872804n,
  684772582298868666459872n,
  321123280741194108715554n,
  1357312870095446967808n,
  2115620184325661288760394n,
  2103523299553728266405n,
  609528290986200534287383n,
  906740488358633270673503n,
  1362554056332964234526720n,
  5671349735915610n,
  725689287969947800n,
  114075963232940701253656n,
  3261777066162305290240n,
  171595775230078887465472n,
  53034389212754216067n,
  332779983665670148645n,
  33056565380087544545390n,
  535262213445024481280n,
  217229658925368080597187n,
  1770887444270315323552n,
  432352448530087978n,
  1813388737109316860903772n,
  1867046576979968n,
  1814583205640312457266688n,
  1332348663172357800727827n,
  113342570334614624141360n,
  180576837173274991450186n,
  3541786698034716947740n,
  992825563469304746438656n,
  1348665958810903454241n,
  1476483459215927533371392n,
  1006076530584595558563840n,
  81032115195766181463552n,
  758164209985865453290642n,
  2014622242909408198656n,
  666628622278332776640n,
  14167099476287987384320n,
  269405473824491169644648n,
  1012189246984814592n,
  2841687869399177n,
  628488064584368387076645n,
  23611834983503441690630n,
  1242591132281791170773703n,
  636378164751277368541184n,
  1061270156257570639052800n,
  1061990249563495093796n,
  758567665099218243027136n,
  719018096301221175361560n,
  1830573099048634475987621n,
  1289235201905520912961092n,
  173032837345269273067560n,
  870840523543532684755096n,
  758567696765979098873856n,
  1287655361829130n,
  138648160401800723174935n,
  1828776906600469522808832n,
  1848277300267041521664n,
  1228071522879509198412800n,
  963558261284n,
  722045414442345579937840n,
  98065451647538248n,
  17212429393021348n,
  963574792740n,
  643365525824422562439168n,
  1266640130721424n,
  1396003474849260872506574n,
  3046401519092795703296n,
  1813389455116729348936016n,
  1805477768574819239046n,
  1847167319934131603767302n,
  3465590308069261536n,
  8549833958752312n,
  160616036385085045131390n,
  2143954387884877145376963n,
  7507473613347n,
  396605527755561702400n,
  729033933626557176n,
  188923393796298885826088n,
  493930021006496823940374n,
  2294313816157921104032n,
  1195622454894430064196n,
  2841868459225480n,
  817424247260341806039228n,
  14231663053074017812480n,
  2547597081687412040072n,
  264452621721648793480045n,
  203061850280283422326799n,
  379412635561684541572114n,
  664199375840740276076544n,
  208338177565802595614720n,
  1362479116437390559939675n,
  1438483155731104959299624n,
  627523708920682877452288n,
  14194769564925675996672n,
  350349788438409818477568n,
  1218987365607323361019972n,
  681283799065761138368512n,
  1288176792672085477425152n,
  1229016744666093373261896n,
  1906835413285330573066240n,
  1223708592996912535388899n,
  1770890259569829798569n,
  1816340213678069540619010n,
  633881449416004017135750n,
  64997131766896525424n,
  283748465860146664445234n,
  1971903351821230365835264n,
  1770887431076174102746n,
  614534839540562085806272n,
  3763800449790348n,
  1894888014526534445957441n,
  7638108816348958992n,
  217229688282677719859206n,
  516508834063899218504n,
  432345570689172064n,
  522280609425945526465n,
  2952487878466056912896n,
  2046005960293112457723909n,
  595930106286526945034320n,
  1246709652801355826331760n,
  1407270329815644692290353n,
  417047448782965154895026n,
  313901009567041454083n,
  341895269312415433216n,
  1034892894975038645821440n,
  491665993214005509882328n,
  246290624975690n,
  115730333853387286153330n,
  1237874525695835677788226n,
  165458486989153428606580n,
  1220167970738839679877632n,
  46118051220178337799n,
  462059145307138334860n,
  1217211902523690169926016n,
  642469979690349082181632n,
  1973455199322649240211944n,
  809867500598335n,
  90071993496659509n,
  1816417316857506162713810n,
  1918578995884473356259600n,
  1216038300467862574368256n,
  610403950349763031155205n,
  1666109992397054358536930n,
  46122595259204501507n,
  1222673125060319832440832n,
  1285740813636931292233728n,
  1279766216774068493091062n,
  1225473792042286748434432n,
  1837000566546943517492100n,
  832354889798384397549568n,
  1220240879513207211819008n,
  1890203572573662731321953n,
  2954937844905469403941n,
  241579929483590238994476n,
  1813831459448575341187216n,
  160560694604800110448908n,
  1303376945846374401000162n,
  383856009624354837168128n,
  60883493487174958088384n,
  368934884637185023334n,
  1972493646950351800893530n,
  27675332265264548864n,
  852497830648801612267966n,
  8739468217417816n,
  368940843507332125478n,
  1405070051320913832443904n,
  340900586305349249683456n,
  1295713463074389360002048n,
  340320402187773167038800n,
  56204923355357784105n,
  1391096802869675370634163n,
  312617279400109903183872n,
  652474888328347058324671n,
  1226062844884340160233472n,
  1771004604123810890113n,
  1847397088837705813567048n,
  317302859153441965473792n,
  373998514026721591973413n,
  966621714719997463384064n,
  2842888267598663876608n,
  1246931013167290366558232n,
  313903254761061220352n,
  23611941101348764321324n,
  624581498149095812399616n,
  1823774876852585120175816n,
  1841722934107167539855495n,
  1388988163455404042604872n,
  31875983550933467398150n,
  33389237277362960533126n,
  610330274568316035104773n,
  456019672417588891254784n,
  1396003474638155009539163n,
  1970330216169528n,
  26005387635663864070150n,
  113337516168663448049459n,
  1813388734083941851765193n,
  30862916255940060284994n,
  108086854948553988n,
  28669041086856n,
  470392335842971554816n,
  516512571991085023232n,
  1895096564684013424345088n,
  661438582614967585865728n,
  3557951818402027947682n,
  1235253453851954025562117n,
  165799840913026015318016n,
  264895253713824383310021n,
  28534807862731877385n,
  683748853305664353182208n,
  1967919382103421484810786n,
  188894660722166071296040n,
  33056619634389278868134n,
  160560676801456285272268n,
  1935387769094865321542404n,
  2115620189960620811132030n,
  758249397952157749249042n,
  6917529027702637802n,
  81683461791631596143104n,
  230215375638274427060264n,
  1228500265035032298653890n,
  2307766377291144033730640n,
  1280227007081564602473n,
  719204541096723224723480n,
  1893012082629866372354177n,
  1229165680887175544244294n,
  1216033675428970545121736n,
  11554342689850272n,
  56806752957882617268547n,
  89928201618507638243333n,
  1837000568222329853968572n,
  1665740994623523662856394n,
  724557007482339480n,
  28334253151519704622867n,
  530399561686022911394816n,
  47215738494026803745n,
  1215441015066225773904320n,
  1273404326275260358066437n,
  108780792322733669089280n,
  13383689667844n,
  1257356777943733077278720n,
  255414735337290045870080n,
  2047680825928723319640240n,
  221366290177473904760n,
  331451295678095367885346n,
  368936112010796979988n,
  336102149821510555290624n,
  906694373190437942935696n,
  23611887266786628609685n,
  851245821602993454186788n,
  2095951004535335747059755n,
  983727975849601349451824n,
  1870764019250804660633600n,
  313902091469437537280n,
  549210319713149041770770n,
  56751410429761016570897n,
  425907760049802099557888n,
  2069665832279323920826368n,
  11334609602364320n,
  338271799152271998224710n,
  1991908984848052620877272n,
  1417130568128158119231488n,
  1823591904594141658030284n,
  331323433316626067619846n,
  1246710231237380748751114n,
  4280951167503552319752n,
  188894665148874633691288n,
  475485653172056362057728n,
  1323505796365827155623960n,
  1770888735170475920004n,
  554001582494726712595n,
  953516966880081141202949n,
  1967328852156221324285952n,
  47528814107696090318336n,
  5767453651832595113n,
  837252245867528372685956n,
  14201041158144n,
  1134907106118134272n,
  31875982951708355362822n,
  23611834987901756808526n,
  1829345169801583086601156n,
  1970324947337629n,
  436010792691848466n,
  1266282655662546230577218n,
  1215881553525881837601354n,
  4132084220774821560512n,
  369042971576105570566n,
  1816340215493363204522754n,
  1770887431076167912644n,
  1813395653776765727445320n,
  203061870795795611820557n,
  522274346530202714112n,
  1320510518046202374818816n,
  59369137n,
  81609674824221559046656n,
  61547994967845816582384n,
  5764641743320383488n,
  1914509367033931375970386n,
  1851736073576954986496n,
  922669246070171707122717n,
  200849520750310339543040n,
  201072335488689598501152n,
  1266691619374482n,
  2393559698406861438976n,
  211844801788803280797696n,
  1218982754272197332898116n,
  44428986783244267553172n,
  491659934912626616172554n,
  193847610098576836263946n,
  2033702952396551201833102n,
  722329301051130811n,
  2077841267666967288872960n,
  6869843542278144n,
  2997601638299606681283n,
  729125373971483854n,
  52568753061438261559296n,
  2828493713089161n,
  1890871107391413364719745n,
  912637711096455282819077n,
  1907843300867949895614470n,
  3541784588791394074624n,
  439339209753626840924208n,
  115153810083618657715633n,
  388194038895729493156385n,
  558254788680191678873600n,
  1726308551778865n,
  55340232846451697673n,
  1496489592427796n,
  625974196146814761132032n,
  705006889119943130873856n,
  7350229878054211856n,
  127503995401075348996144n,
  1991717264567996973648492n,
  925697686180463202271235n,
  33056565380087525228678n,
  379265058161259658367648n,
  1233739037050894182187014n,
  721027438226686084n,
  1423773414554534440960n,
  678416256860163n,
  2115620200088199777747236n,
  2201294249707322971521024n,
  2269140697221391920204997n,
  312342738839777930641408n,
  7956914126192640n,
  1285813303576530226579524n,
  5671349754333284n,
  3541788417009024925696n,
  1841722934107167544911254n,
  264452529318110164451840n,
  810648968998766116n,
  614540604223004482732224n,
  2058252169418284572734849n,
  14167099455425588530248n,
  1362416948805256561033216n,
  2135747923981850179143746n,
  326731307104433264971919n,
  5981365311968256n,
  64563604258025721381n,
  256778680798735204614566n,
  1108285734361166720008323n,
  419474435892129730396160n,
  1823442206912440415813848n,
  1540251560691242039774214n,
  313904349874642485248n,
  726225838187456701227008n,
  27670125165061145860n,
  23611833296294036702238n,
  720576975896953580n,
  283619016363608339644416n,
  282212263023120565927939n,
  652033189677732905911808n,
  5764631757433421968n,
  351155313376951306312n,
  28334253151519671337650n,
  462267585705882450967n,
  1231378857856844744517770n,
  3545730939364307980800n,
  739168354361793314816n,
  1246764991626202449455129n,
  1943011637744451453120n,
  81609656789986739552844n,
  523426363091555848468n,
  2349838818094390249557504n,
  56354211533039012418n,
  907360904211247925297344n,
  746395222002607419564601n,
  516508834069251494186n,
  206610461301316393041960n,
  442851105113554621952n,
  55772606014434060297n,
  1770890123679011767684n,
  406855597883961901071n,
  13194190305179n,
  35468603515217528225797n,
  1813396804413575097483264n,
  128071114417784350n,
  1154706316147646165680426n,
  1308099298778578715626214n,
  1893670740804835643367973n,
  25382720021346228895908n,
  738128018209838928494616n,
  1258533960302033211490304n,
  1530566431624810299777n,
  135205038036353408n,
  117168649757344160n,
  635787861846164822049317n,
  1816936282415655102349312n,
  652381214419352868103377n,
  1371903632169012622811136n,
  5764612093442034788n,
  1606492545728090332909775n,
  1008806316601600389n,
  8239351444038193n,
  27783349659149796864n,
  226679356706005524152360n,
  1900361968899236412327556n,
  1218979390088818474877120n,
  94539887637346945859590n,
  1921468529910068948238342n,
  624596414075631357135878n,
  342147474195374282539n,
  28850707942387985027330n,
  54148800184533922n,
  760302843788886898999296n,
  1917289552307345444233704n,
  3541874126345593061376n,
  516515892415361517668n,
  14167103284404235289618n,
  739743267827432292352n,
  56060812083095165477n,
  113383002521056530688145n,
  1814055554955829782342020n,
  54148748682740402n,
  56751408961921451032576n,
  221361406263691723142n,
  183361186141231808280083n,
  222090941703972602368n,
  666537285915460501696n,
  91644685566084742154468n,
  226673591812437283734056n,
  907210876161551434252288n,
  1050486734765537836014898n,
  46549699019996145673n,
  624572223378059893407744n,
  700229307942696675724800n,
  55539052796812095137873n,
  688470625312528057663745n,
  349461046685140014924932n,
  42953245602206969757699n,
  15461289869488639705093n,
  115108115365515103305936n,
  1419458515930242859670546n,
  624590721521183553555716n,
  23657950442222975451141n,
  2211653947484131885093162n,
  1013469436614867432n,
  371974010969790997369096n,
  5671349746156256n,
  432345622221246724n,
  122782002565081546621008n,
  2014741501439944712781824n,
  1870166659344414563893522n,
  2014114022877934174077059n,
  1217211925094327560175616n,
  66380609043113520993557n,
  709074726463894072590528n,
  1742276859938964649609860n,
  906694367429677762216086n,
  457331688962247044005888n,
  498064915310185654337n,
  28334204685240890294662n,
  1439217580215003487666280n,
  442814574783540302848n,
  1009185910180311424n,
  26563752874170739245604n,
  379265148242047905305124n,
  1813395651517374424907776n,
  3741914829592604010144n,
  47602597704092184741376n,
  4132088511014879002840n,
  2918697534935670216704n,
  4280951523333489295360n,
  1271599837074329998310267n,
  720586818617664036n,
  1258533942498740934279168n,
  1828184033889310629718561n,
  1295607355291920905082368n,
  14167099660679172163204n,
  172471364542079520990761n,
  1220159892444460223561728n,
  256412106986329590464512n,
  645235478669230229971228n,
  482585776115480287959370n,
  3541787050925872906240n,
  2537940519653480762368n,
];

// // Run some tests on mask creation
// const _sieve = new Set(sieve);
// const created = Array(81).fill(0);
// const N = 2000;
// for (let n = 0; n < N; n++) {
//   const mask = createBoardMaskFromSieve(config, _sieve);
//   let bitCount = 0;
//   for (let i = 0; i < 81; i++) {
//     if (mask & cellMask(i)) {
//       bitCount++;
//     }
//   }
//   created[bitCount]++;
//   if (n % ((N/100)|0) === 0) {
//     process.stdout.write('.');
//   }
// }

// // print results
// console.log('\nMask creation results:');
// created.forEach((count, i) => {
//   if (count > 0) {
//     const percent = (count / N * 100);
//     console.log(`  ${i}: ${count} (${percent.toFixed(2)}%)`.padStart(30), '-'.repeat(Math.ceil(percent)));
//   }
// });

// // f(config, sieve, 1000000);

// // print cache stats
// console.log('Cache stats:');
// console.log(`  _2set: ${solutionsFlagCache._2set.size}`);
// const twosTotal = solutionsFlagCache._2setHits + solutionsFlagCache._2setMisses;
// const twosHits = solutionsFlagCache._2setHits;
// const twosMisses = solutionsFlagCache._2setMisses;
// console.log(`  _2setHits: ${twosHits} (${(twosHits / twosTotal * 100).toFixed(2)}%)`);
// console.log(`  _2setMisses: ${twosMisses} (${(twosMisses / twosTotal * 100).toFixed(2)}%)`);

// console.log(`  _1set: ${solutionsFlagCache._1set.size}`);
// const onesTotal = solutionsFlagCache._1setHits + solutionsFlagCache._1setMisses;
// const onesHits = solutionsFlagCache._1setHits;
// const onesMisses = solutionsFlagCache._1setMisses;
// console.log(`  _1setHits: ${onesHits} (${(onesHits / onesTotal * 100).toFixed(2)}%)`);
// console.log(`  _1setMisses: ${onesMisses} (${(onesMisses / onesTotal * 100).toFixed(2)}%)`);

// // print single solution masks
// solutionsFlagCache._singleSolutionMasks.forEach((set, i) => {
//   const clues = i + 17;

//   if (set.size > 0) {
//     console.log(`  ${clues} clues: ${set.size}`);
//     set.forEach((mask) => {
//       console.log(`  > ${config.filter(mask).toString()}`);
//       console.log(`  > ${config.filter(~mask).toString()}`);
//     });
//   }
// });









// Create and output initial sieve.
// whenDebugging.log('Creating initial sieve ...');
// const startTime = Date.now();
// const sieve = new Set(searchForSieve2(config, { maxDigits: 2, maxLength: 18 }));
// whenDebugging.log(`Sieve created in ${Date.now() - startTime}ms.`);
// whenDebugging.log(`Sieve size: ${sieve.length}`);
// sieve.forEach((sieveItem) => { console.log(config.filter(~sieveItem).toString()) });

// // Start looking for unresolvable items.
// // For each clue count, generate a random mask and search for unresolvable items.
// // Continue generating and searching until failing to generate any new unresolvable items 3 times in a row.
// const minClues = 27;
// let numClues = 81;
// let count = 0;
// while (numClues >= minClues) {
//   const r = randomBigInt(nChooseK(81, numClues));
//   const mask = bitCombo2(81, numClues, r);
//   const sieveLengthBefore = sieve.size;
//   findUnresolvableItems(
//     config,
//     mask,
//     sieve
//   ).forEach((item) => sieve.add(item));

//   if (sieve.size === sieveLengthBefore) {
//     count++;
//   } else {
//     count = 0;
//   }

//   if (count >= 3) {
//     numClues--;
//     count = 0;
//   }
// }


// // const config2 = new Sudoku('2..5.463.5738.6...4691.35.872.4593.63546817929.6237..51479628536953182..832745961');

// // const items = findUnresolvableItems(config, 795824737478155011168n);


// console.log(`\n\nFound ${items.size} unresolvable items.`);
// items.forEach((sieveItem) => {
//   console.log();
//   console.log(config.filter(~sieveItem).toString());
// });

// // Just a quick verification that the items are unique.
// // const itemsSet = new Set(items);
// // if (items.length === itemsSet.size) {
// //   console.log(`✅ All ${items.length} items are unique.`);
// // } else {
// //   console.log('❌ Items are NOT unique.');
// //   console.log(`items.length (${items.length}) !== itemsSet.size (${itemsSet.size})`);
// //   // Print the duplicates
// //   console.log('Duplicates:')
// //   items.forEach((item, i) => {
// //     if (itemsSet.has(item)) {
// //       itemsSet.delete(item);
// //     } else {
// //       console.log(`  [${i.toString().padStart(Math.ceil(Math.log10(items.length)))}]: ${item}`);
// //     }
// //   });
// // }

// // TODO Test for derivatives of the same unresolvable puzzle.
