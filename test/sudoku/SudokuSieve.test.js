import {
  // range,
  shuffle,
  Sudoku,
  SudokuSieve
} from '../../index.js';

const toStr = n => n.toString();

describe('SudokuSieve', () => {
  /** @type {Sudoku} */
  let config;
  /** @type {SudokuSieve} */
  let sieve;

  beforeEach(() => {
    config = new Sudoku('218574639573896124469123578721459386354681792986237415147962853695318247832745961');
    sieve = new SudokuSieve({ config });
  });

  describe('add', () => {
    test('adds items to the sieve', () => {
      const items = [1n, 2n, 4n];
      const result = sieve.add(...items);
      expect(sieve.items).toEqual(expect.arrayContaining(items));
      expect(result).toBe(true);
    });

    test('returns true if any items were added', () => {
      expect(sieve.add(1n)).toBe(true);

      // Duplicates return false
      expect(sieve.add(1n)).toBe(false);

      expect(sieve.add(2n)).toBe(true);

      // All odd numbers are derivatives of 1, so they should not be added.
      for (let n = 0; n < 10; n++) {
        const itemToAdd = BigInt(Math.ceil(Math.random() * 1024)) * 2n + 1n;
        expect(sieve.add(itemToAdd)).toBe(false);
      }
    });
  });

  describe('isDerivative', () => {
    test('returns true if the item is a derivative', () => {
      sieve.add(1n);
      expect(sieve.isDerivative(3n)).toBe(true);
    });

    test('returns false if the item is not a derivative', () => {
      sieve.add(1n);
      expect(sieve.isDerivative(2n)).toBe(false);
    });
  });

  describe('removeOverlapping', () => {
    test('removes overlapping items', () => {
      // sieve._items = range(16).map(BigInt);
      sieve._items = [
        [0n],
        [1n, 2n, 4n, 8n],
        [3n, 5n, 6n, 9n, 10n, 12n],
        [7n, 11n, 13n, 14n],
        [15n]
      ];
      sieve._length = 16;

      const mask = 10n;
      const expectedRemoved = [
        2n, 3n, 6n, 7n, 8n, 9n, 10n, 11n, 12n, 13n, 14n, 15n
      ].map(toStr);
      const removedStr = sieve.removeOverlapping(mask).map(toStr);
      const remainingItemsStr = sieve.items.map(toStr);

      expect(remainingItemsStr.length).toBe(4);
      expect(remainingItemsStr).toEqual(expect.arrayContaining(['0', '1', '4', '5']));

      expect(removedStr.length).toBe(12);
      expect(removedStr).toEqual(expect.arrayContaining(expectedRemoved));
    });
  });

  describe('_removeDerivatives', () => {
    test('removes derivatives', () => {
      // Note: Every odd number is a derivative of 1

      // All odd numbers are derivatives of 1. Only 1 should remain (1n) after derivative removal.
      const numItems = 12;
      const _items = Array(81).fill(0).map(_=>[]);
      _items[sieve._numCells(1n)].push(1n);
      sieve._length++;
      for (let n = 1; n < numItems; n++) {
        const item = BigInt(Math.ceil(Math.random() * 1024)) * 2n + 1n;
        const subArrIndex = sieve._numCells(item);
        _items[subArrIndex].push(item);
        sieve._length++;
      }
      _items.forEach(subarr => shuffle(subarr));

      // ! Hack to set _items directly.
      // ! Using .add() would not work as it would remove derivatives.
      sieve._items = _items;

      expect(sieve._removeDerivatives()).toBe(true);
      const remainingItemsStr = sieve.items.map(toStr);

      expect(remainingItemsStr.length).toBe(1);
      expect(remainingItemsStr).toEqual(expect.arrayContaining(['1']));
    });
  });

  describe('reductionMatrix', () => {
    test('sums the occurrences of bits', () => {
      // TODO Create a sieve with a preset of items

      // TODO Verify that the reduction matrix is as expected
    });

    test('sdlfkf', () => {
      const c = new Sudoku('847152693921376485635948721472635918316789542598214367263591874789423156154867239');
      const p = new Sudoku('847152693921376485635948721472635.1.3167895425982143672.35.1.747.942315.1548.723.');

      // Verify that c and s is valid and s has solutionsFlag = 2 and c has solutionsFlag = 1
      expect(p.isValid).toBe(true);
      expect(c.isValid).toBe(true);
      expect(p.solutionsFlag()).toBe(2);
      expect(c.solutionsFlag()).toBe(1);

      // For every empty cell in p, fill the cell with the corresponding cell in c,
      // and check if the puzzle is still valid and solutionsFlag = 1.
      const cBoard = c.board;
      const pBoard = p.board;
      for (let ci = 0; ci < 81; ci++) {
        if (pBoard[ci] === 0) {
          const pCopy = new Sudoku(p);
          pCopy.setDigit(cBoard[ci], ci);
          expect(pCopy.isValid).toBe(true);
          expect(pCopy.solutionsFlag()).toBe(1);
        }
      }
    });
  });

  describe('_generateMask', () => {
    // TODO Test that results have bit counts of < maxSelections

    // TODO If the sieve is empty, then the mask should be 0n

    // TODO Test that results satisfy all sieve items such that the mask overlaps btest(s) with
    //      all sieve items.

    // TODO What is the expected behavior when it's impossible or difficult to generate a mask that satisfies
    //     all sieve items within the maxSelections?
    //     - Should it return 0n?
    //     - Should it return a mask that satisfies the most sieve items and ignore maxSelections?
    //     - How many attempts should it make before increasing maxSelections?

    test('', () => {

    });
  });
});
