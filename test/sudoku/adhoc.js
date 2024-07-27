import {
  Debugger,
  Sudoku,
  SudokuSieve,
  f,
  sieveCombos4,
  verifySieveItems
} from '../../index.js';

const debug = new Debugger(true);

const generationResults = Sudoku.generate();
/** @type {Sudoku} */
const config = generationResults[0].solutions[0];
const sieve = f(config, null, 1);

if (verifySieveItems(config, sieve, (failReason) => { debug.log(failReason); })) {
  debug.log('✅ sieve verified.');
} else {
  debug.log('❌ sieve verification failed.');
  process.exit(1);
}

const ss = new SudokuSieve({ config, items: sieve });
const ss2 = new SudokuSieve({ config, items: sieve });
const maxComboLength = 17;

// /** @type {Set<bigint>} */
// const seen = new Set();

/**
 * @param {bigint} comboMask
 * @param {number} numClues
 */
const combosCallback = (comboMask, numClues) => {
  if (numClues < 17) {
    return;
  }
  const q = config.filter(comboMask);
  const flag = q.solutionsFlag();
  if (flag === 1) {
    debug.log(`[${numClues}] ⭐️ ${q.toString()}`);
  }
  // seen.add(comboMask);
  // while (q.length > 0) {
  //   const p = q.shift();

  //   if (p.numEmptyCells <= 64) {
  //     debug.log(`[${numClues}] ${p.toString()}  [flag: ${flag}]`);
  //   } else {
  //     p._getNextsAdditive().forEach((next) => {
  //       const nextMask = next.mask;
  //       if (seen.has(nextMask)) {
  //         return;
  //       }
  //       seen.add(nextMask);
  //       q.push(next);
  //     });
  //   }
  // }
};
debug.log(`Generating combos (maxLength: ${maxComboLength}) from sieve (length: ${sieve.length})...`);
const start = Date.now();
const results = sieveCombos4(ss2, maxComboLength, 1000000, combosCallback);
debug.log(`Done in ${(Date.now() - start)}ms`);
debug.log(`config: ${config.toString()}`);

// Verify results: All items should cover the sieve entirely.
let allCovered = true;
results.forEach((masks, numClues) => {
  if (masks.size === 0) {
    return;
  }

  debug.log(`Verifying ${masks.size} results (numClues: ${numClues})...`);
  const _masks = Array.from(masks);
  _masks.forEach((mask) => {
    // if (sieve.filter((item) => (item & mask) === 0n).length > 0) {
    if (sieve.some(item => (item & mask) === 0n)) {
      allCovered = false;
      debug.log(`\n❌ ${mask.toString(2).padStart(81, '0').replace(/0/g, '.').replace(/1/g, '#')}  ${numClues}`);
    }
  });
});
if (allCovered) {
  debug.log('✅ sieveCombos3() results verified.');
}

// Reading sieve combos from maxLength to the min generated,
//    if the combo mask is a valid puzzle (solutionsFlag === 1),
//    then print it
// for (let numClues = results.length - 1; numClues > 0; numClues--) {
//   const masks = Array.from(results[numClues]);
//   if (masks.length > 0) {
//     masks.forEach((mask, i) => {
//       const p = config.filter(mask);
//       // let start = Date.now();
//       const flag = p.solutionsFlag();
//       // const flagTime = Date.now() - start;
//       // debug.log(`[${numClues}] ${p.toString()}  [flag: ${flag}] ${flagTime}ms`);

//       if (flag === 1) {
//         debug.log(`[${numClues}] ⭐️ ${p.toString()}`);
//       }
//     });
//   }
// }
