import {
  bitComboToR,
  Sudoku,
  searchForSieve2,
  analyzeEmptyCellChain,
  findUnsolvablePairs,
  isUnsolvablePair,
  SudokuSieve
} from '../../index.js';

const configStr = '218574639573896124469123578721459386354681792986237415147962853695318247832745961';
const config = new Sudoku(configStr);

const expectedSieveItemsByChainLength = [
  [],
  [],
  [],
  [],
  [ // chain length 4
    '21857463957389612446912357872145938635468179298623741514796..5369531..47832745961',
    '218574639573896124469123578721459386354681792986237415.479.2853.953.8247832745961',
    '218574639573896124469123578721459386354681.9.986237415147962853695318.4.832745961',
    '2185746395738961244691235787214593863546..7929862374151479628536953..247832745961',
    '218574639573896124469123578.21459.86.54681.92986237415147962853695318247832745961',
    '218574639573896124469123578.2145.386354681792.8623.415147962853695318247832745961',
    '218574639573896124469123578.2.459386354681792986237415.4.962853695318247832745961',
    '21.57463.57389612446.12357.721459386354681792986237415147962853695318247832745961',
    '.1.574639573896124469123578721459386354681792986237415147962853695318247.3.745961'
  ].map(s => BigInt(`0b${s.replace(/[^.]/g, '0').replace(/\./g, '1')}`)),
  [],
  [ // chain length 6
    '218574639573896124469123578721459386354681792986.3.41514.96.85369531824783..45961',
    '2185746395738961244691235787214593863..6817929862374151.79628.369.3182.7832745961',
    '218574639573896124469123578721459386.546.17929.62.7415147962853695318247..2745961',
    '21857463957389612446912357872.45938.35468179298.2374.51479628536953182478327459..',
    '218574639573896124469..3578721459386354681792986..7415147962853695..8247832745961',
    '2185746395738961244..123578721459386354681792.8.237415147962853..5318247832745961',
    '218574639573896..4469123578721459386354681792986237..5147962853695318..7832745961',
    '218574639573..6124469123578721459386354..1792986237415147..2853695318247832745961',
    '218574639.7389612..69123.78721459386354681792986237.1.147962853695318247832745961',
    '2185.46.957389612446912.5.87214593863546817929862..415147962853695318247832745961',
    '218.7.639573896124469123578721..93863546817929862374151479628536953182478327..961',
    '218..4639573896124469123578721..9386354681792986237415147962853695318247832..5961',
    '218...639573896124469123578721459386354681792986237415147962853695318247832...961',
    '2.8.74.395738961244.9.23.78721459386354681792986237415147962853695318247832745961',
    '2..57463957389612446912357872.4593.63546817929.62374.5147962853695318247832745961',
  ].map(s => BigInt(`0b${s.replace(/[^.]/g, '0').replace(/\./g, '1')}`)),
];

describe('searchForSieve2', () => {
  test('finds all 2-digit chains length 4', () => {
    const expectedItems = expectedSieveItemsByChainLength[4];
    const sieve = new SudokuSieve({ config });
    searchForSieve2(sieve);
    const items = sieve.items;
    expect(items.length).toBe(expectedItems.length);
    expect(items).toEqual(expect.arrayContaining(expectedItems));
  });

  test('finds expected pairs', () => {
    // const prevSieve = [];
    // TODO searchForSieve2(config, maxLength = 6+) is not finding all expected chains
    // TODO But the function isn't being used in the more recent generation approaches, so
    // TODO fixing it isn't a priority. For now, just test the first 5 chain lengths.
    const sieve = new SudokuSieve({ config });
    for (let maxLength = 0; maxLength < expectedSieveItemsByChainLength.length; maxLength++) {
      searchForSieve2(sieve, { maxLength, maxDigits: (((maxLength + 1) / 2) | 0)  });

      const items = sieve.items;
      const expectedItems = expectedSieveItemsByChainLength.slice(0, Math.max(5, maxLength + 1)).flat();

      // const expectedItems = expectedSieveItemsByChainLength[maxLength];
      expect(items.length).toBe(expectedItems.length);
      expect(items).toEqual(expect.arrayContaining(expectedItems));

      // prevSieve.push(...sieve);
    }
  });
});

describe('_analyzeEmptyCellChain', () => {
  test('produces expected stats', () => {
    const configBoard = config.board;
    const chain = [0, 2, 72, 74];
    const stats = analyzeEmptyCellChain(configBoard, chain);

    expect(stats.rows).toEqual([0, 8]);
    expect(stats.cols).toEqual([0, 2]);
    expect(stats.regions).toEqual([0, 6]);
    expect(stats.distinctDigits).toBe(2);
    expect(stats.digitCounts[2 - 1]).toBe(2);
    expect(stats.digitCounts[8 - 1]).toBe(2);
  });
});

describe('findUnsolvablePairs', () => {
  test('finds expected pairs', () => {
    const expectedBoards = [
      '21857463957389612446912357872145938635468179298623741514796..5369531..47832745961',
      '218574639573896124469123578721459386354681792986237415.479.2853.953.8247832745961',
      '218574639573896124469123578721459386354681.9.986237415147962853695318.4.832745961',
      '2185746395738961244691235787214593863546..7929862374151479628536953..247832745961',
      '218574639573896124469123578.21459.86.54681.92986237415147962853695318247832745961',
      '218574639573896124469123578.2145.386354681792.8623.415147962853695318247832745961',
      '218574639573896124469123578.2.459386354681792986237415.4.962853695318247832745961',
      '21.57463.57389612446.12357.721459386354681792986237415147962853695318247832745961',
      '.1.574639573896124469123578721459386354681792986237415147962853695318247.3.745961'
    ].map(s => bitComboToR(81, 77, BigInt(`0b${s.replace(/[^.]/g, '1').replace(/\./g, '0')}`)));
    const pairs = findUnsolvablePairs(config);
    expect(pairs.length).toBe(expectedBoards.length);
    expect(pairs).toEqual(expect.arrayContaining(expectedBoards));
  });
});

describe('isUnsolvablePair', () => {
  test('finds expected pairs', () => {
    // const config = '218574639573896124469123578721459386354681792986237415147962853695318247832745961';
    [
      { r1: 0, c1: 0, r2: 8, c2: 2 },
      { r1: 0, c1: 2, r2: 2, c2: 8 },
      { r1: 3, c1: 0, r2: 6, c2: 2 },
      { r1: 3, c1: 0, r2: 5, c2: 5 },
      { r1: 3, c1: 0, r2: 4, c2: 6 },
      { r1: 4, c1: 4, r2: 7, c2: 5 },
      { r1: 4, c1: 6, r2: 7, c2: 8 },
      { r1: 6, c1: 0, r2: 7, c2: 4 },
      { r1: 6, c1: 5, r2: 7, c2: 6 },
    ].forEach(({ r1, c1, r2, c2 }) => {
      const result = isUnsolvablePair(config, r1, c1, r2, c2);
      expect(result).toBe(true);
    });
  });
});
