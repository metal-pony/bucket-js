import {
  Sudoku,
  cellCol,
  cellRegion,
  cellRegion2D,
  cellRow,
  masksFor,
  range
} from '../../index.js';
import puzzles from './puzzles24.js';

describe('cellRow, cellCol, cellRegion, cellRegion2D', () => {
  test('correct values', () => {
    for (let cellIndex = 80; cellIndex >= 0; cellIndex--) {
      const row = cellRow(cellIndex);
      const col = cellCol(cellIndex);
      const region = cellRegion(cellIndex);
      const region2D = cellRegion2D(row, col);
      expect(row).toBe(Math.floor(cellIndex / 9));
      expect(col).toBe(cellIndex % 9);
      expect(region).toBe(Math.floor(row / 3) * 3 + Math.floor(col / 3));
      expect(region2D).toBe(region);
    }
  });
});

describe('Sudoku', () => {
  describe('static', () => {
    test('mask', () => {
      const config = new Sudoku('218574639573896124469123578721459386354681792986237415147962853695318247832745961');
      const board = new Sudoku(config).board;

      // 1s in the mask indicate cells that are kept
      expect(config.filter(masksFor.none).board).toEqual(new Array(81).fill(0));
      expect(config.filter(masksFor.all).board).toEqual(board);

      masksFor.row.forEach((mask, rowIndex) => {
        const maskedBoard = config.filter(mask).board;
        for (let ci = 0; ci < 81; ci++) {
          expect(maskedBoard[ci]).toBe((cellRow(ci) === rowIndex) ? board[ci] : 0);
        }
      });

      masksFor.col.forEach((mask, colIndex) => {
        const maskedBoard = config.filter(mask).board;
        for (let ci = 0; ci < 81; ci++) {
          expect(maskedBoard[ci]).toBe((cellCol(ci) === colIndex) ? board[ci] : 0);
        }
      });

      masksFor.region.forEach((mask, regionIndex) => {
        const maskedBoard = config.filter(mask).board;
        for (let ci = 0; ci < 81; ci++) {
          expect(maskedBoard[ci]).toBe((cellRegion(ci) === regionIndex) ? board[ci] : 0);
        }
      });
    });
  });

  test('Puzzle solving', () => {
    const testPuzzles = puzzles.slice(0, Math.min(puzzles.length, 10));
    testPuzzles.forEach((sudoku) => {
      const puzzle = new Sudoku(sudoku.puzzle);
      let expectedNumClues = 0;
      const expectedClues = sudoku.puzzle.split('').map((char) => {
        if (char === '.') return 0;
        expectedNumClues += 1;
        return parseInt(char, 10);
      });

      expectPuzzleToBeValidAndSolvable({
        puzzle,
        expectedClues,
        expectedNumClues,
        solution: new Sudoku(sudoku.solution)
      });
    });
  });

  test('Configuration generation', () => {
    for (let n = 0; n < 10; n++) {
      const config = Sudoku.generateConfig();
      expectPuzzleToBeValidAndSolvable({
        puzzle: config,
        expectedNumClues: 81,
        expectedClues: config.board,
        solution: new Sudoku(config)
      });
    }
  });

  test('Puzzle generation', () => {
    const config = Sudoku.generate({ numClues: 81 })[0].solutions[0];
    expectPuzzleToBeValidAndSolvable({
      puzzle: config,
      expectedNumClues: 81,
      solution: config
    });

    for (let numClues = 80; numClues >= 27; numClues--) {
      const generationResults = Sudoku.generate({ numClues });
      const puzzle = generationResults[0].puzzle;
      const solution = new Sudoku(puzzle);
      solution.solve();
      expectPuzzleToBeValidAndSolvable({
        puzzle,
        expectedNumClues: numClues,
        solution
      });
    }
  });
});

/**
 * @typedef {Object} SudokuPuzzle
 * @property {string} puzzle
 * @property {string} solution
 */

/**
 * Returns a random puzzle from the provided list of puzzles.
 * @returns {SudokuPuzzle}
 */
function getRandomPuzzle() {
  const index = Math.floor(Math.random() * puzzles.length);
  return { ...puzzles[index] };
}

/**
 *
 * @param {Sudoku} puzzle
 */
function expectPuzzleToBeValid(puzzle) {
  for (let i = 0; i < 9; i++) {
    expect(
      puzzle.isRowValid(i),
      `Expected row ${i} to be valid:\n${puzzle.rowVals(i).join('')}`
    ).toBe(true);
    expect(
      puzzle.isColValid(i),
      `Expected col ${i} to be valid:\n${puzzle.colVals(i).join('')}`
    ).toBe(true);
    expect(
      puzzle.isRegionValid(i),
      `Expected region ${i} to be valid:\n${puzzle.regionVals(i).join('')}`
    ).toBe(true);
  }
  expect(puzzle.isValid).toBe(true);
}

/**
 *
 * @param {Sudoku} puzzle
 */
function expectPuzzleToBeFull(puzzle) {
  for (let i = 0; i < 9; i++) {
    expect(
      puzzle.isRowFull(i),
      `Expected row ${i} to be full:\n${puzzle.rowVals(i).join('')}`
    ).toBe(true);
    expect(
      puzzle.isColFull(i),
      `Expected col ${i} to be full:\n${puzzle.colVals(i).join('')}`
    ).toBe(true);
    expect(
      puzzle.isRegionFull(i),
      `Expected region ${i} to be full:\n${puzzle.regionVals(i).join('')}`
    ).toBe(true);
  }
  expect(puzzle.isFull).toBe(true);
  expect(puzzle.numEmptyCells).toBe(0);
}

/**
 *
 * @param {object} options
 * @param {Sudoku} options.puzzle (Required) The puzzle under test.
 * @param {number[]} options.expectedClues Expected clue values in `puzzle`.
 * @param {number} options.expectedNumClues Expected number of clues in `puzzle`.
 * @param {Sudoku} options.solution Expected solution to `puzzle`.
 */
function expectPuzzleToBeValidAndSolvable({
  puzzle,
  expectedClues = puzzle.clues,
  expectedNumClues = puzzle.numClues,
  solution = new Sudoku(puzzle)
}) {
  expect(
    puzzle.hasUniqueSolution(),
    `Puzzle does not have a unique solution:\n${puzzle.toString()}`
  ).toBe(true);

  expectPuzzleToBeValid(puzzle);

  expect(
    puzzle.numClues,
    `Puzzle expected to have ${expectedNumClues} clues, but has ${puzzle.numClues}:\n${puzzle.toString()}`
  ).toBe(expectedNumClues);

  expect(puzzle.clues).toEqual(expect.arrayContaining(expectedClues));
  expect(puzzle.numEmptyCells).toBe(81 - expectedNumClues);

  expect(puzzle.solve()).toBe(true);
  // Expect repeated calls to solve() to return true.
  expect(puzzle.solve()).toBe(true);
  expect(puzzle.hasUniqueSolution()).toBe(true);

  expectPuzzleToBeValid(puzzle);
  expectPuzzleToBeFull(puzzle);

  expect(puzzle.isSolved).toBe(true);
  // Expect a puzzle's clues to be retained after solving.
  expect(puzzle.numClues).toBe(expectedNumClues);
  expect(puzzle.clues).toEqual(expect.arrayContaining(expectedClues));
  // Expect the puzzle to match the solution after solving.
  expect(puzzle.toString()).toBe(solution.toString());
  expect(puzzle.board).toEqual(expect.objectContaining(solution.board));
}
