import Sudoku, {
  cellCol, cellCol as cellCol2,
  cellRegion, cellRegion as cellRegion2,
  cellRow, cellRow as cellRow2
} from '../../src/sudoku/Sudoku.js';
import { range } from '../../src/util/arrays.js';

const iterations = 1234567;
// const inputsLength = Sudoku.NUM_SPACES * iterations;
// const cellIndexInputs = Array(inputsLength).fill(0).map((_, i) => i % Sudoku.NUM_SPACES);
const len = Sudoku.NUM_SPACES;
const inputs = range(len);
function timedTest(testFn) {
  const start = Date.now();
  for (let n = iterations; n > 0; n--) {
    for (let i = len - 1; i >= 0; i--) {
      testFn(inputs[i]);
    }
  }
  return Date.now() - start;
}

const timeStr = t => t.toString().padStart(13, ' ');

console.log(`Testing cell area lookup function performance over ${iterations} iterations...\n`);

let c1 = timedTest(cellCol);
let reg2 = timedTest(cellRegion2);
let r2 = timedTest(cellRow2);
let r1 = timedTest(cellRow);
let reg1 = timedTest(cellRegion);
let c2 = timedTest(cellCol2);

// let percentDiff = Math.abs(row1 - row2) / Math.max(row1, row2) * 100;
let rDiffPercent = Math.abs(r1 - r2) / r1 * 100;
let cDiffPercent = Math.abs(c1 - c2) / c1 * 100;
let regDiffPercent = Math.abs(reg1 - reg2) / reg1 * 100;

// Output as table
console.log(
  ` | Function   | Time [1] (ms) | Time [2] (ms) | % Diff   |\n`,
  `| ---------- | ------------- | ------------- | -------- |\n`,
  `| cellRow    | ${r1.toString().padStart(13, ' ')} | ${r2.toString().padStart(13, ' ')} | ${(r2 > r1) ? '+' : '-'} ${(rDiffPercent).toFixed(2).padStart(4, ' ')}% |\n`,
  `| cellCol    | ${c1.toString().padStart(13, ' ')} | ${c2.toString().padStart(13, ' ')} | ${(c2 > c1) ? '+' : '-'} ${cDiffPercent.toFixed(2).padStart(4, ' ')}% |\n`,
  `| cellRegion | ${reg1.toString().padStart(13, ' ')} | ${reg2.toString().padStart(13, ' ')} | ${(reg2 > reg1) ? '+' : '-'} ${regDiffPercent.toFixed(2).padStart(4, ' ')}% |\n`
);


console.log(`| Function   | Time [1] (ms) | Time [2] (ms) | % Diff     |`);
console.log(`| ---------- | ------------- | ------------- | ---------- |`);

process.stdout.write(`| cellRow    | `);
const row1 = timedTest(cellRow);
process.stdout.write(`${timeStr(row1)} | `);
const row2 = timedTest(cellRow2);
process.stdout.write(`${timeStr(row2)} | `);
const rowDiffPercent = Math.abs(row1 - row2) / row1 * 100;
console.log(`${(row2 > row1) ? '+' : '-'} ${rowDiffPercent.toFixed(2).padStart(6, ' ')}% |`);

process.stdout.write(`| cellCol    | `);
const col1 = timedTest(cellCol);
process.stdout.write(`${timeStr(col1)} | `);
const col2 = timedTest(cellCol2);
process.stdout.write(`${timeStr(col2)} | `);
const colDiffPercent = Math.abs(col1 - col2) / col1 * 100;
console.log(`${(col2 > col1) ? '+' : '-'} ${colDiffPercent.toFixed(2).padStart(6, ' ')}% |`);

process.stdout.write(`| cellRegion | `);
const region1 = timedTest(cellRegion);
process.stdout.write(`${timeStr(region1)} | `);
const region2 = timedTest(cellRegion2);
process.stdout.write(`${timeStr(region2)} | `);
const regionDiffPercent = Math.abs(region1 - region2) / region1 * 100;
console.log(`${(region2 > region1) ? '+' : '-'} ${regionDiffPercent.toFixed(2).padStart(6, ' ')}% |`);

let n = 0;
do {
  c1 = timedTest(cellCol);
  reg2 = timedTest(cellRegion2);
  r2 = timedTest(cellRow2);
  r1 = timedTest(cellRow);
  reg1 = timedTest(cellRegion);
  c2 = timedTest(cellCol2);

  rDiffPercent = Math.abs(r1 - r2) / r1 * 100;
  cDiffPercent = Math.abs(c1 - c2) / c1 * 100;
  regDiffPercent = Math.abs(reg1 - reg2) / reg1 * 100;

  // Output as table
  console.log(
    `\n| Function   | Time [1] (ms) | Time [2] (ms) | % Diff   |\n`,
    `| ---------- | ------------- | ------------- | -------- |\n`,
    `| cellRow    | ${r1.toString().padStart(13, ' ')} | ${r2.toString().padStart(13, ' ')} | ${(r2 > r1) ? '+' : '-'} ${(rDiffPercent).toFixed(2).padStart(4, ' ')}% |\n`,
    `| cellCol    | ${c1.toString().padStart(13, ' ')} | ${c2.toString().padStart(13, ' ')} | ${(c2 > c1) ? '+' : '-'} ${cDiffPercent.toFixed(2).padStart(4, ' ')}% |\n`,
    `| cellRegion | ${reg1.toString().padStart(13, ' ')} | ${reg2.toString().padStart(13, ' ')} | ${(reg2 > reg1) ? '+' : '-'} ${regDiffPercent.toFixed(2).padStart(4, ' ')}% |\n`
  );
} while (n++ < 5);

console.log('\nFinished.');
