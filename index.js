// blocky
import Blocky from './src/blocky/Blocky.js'
import BlockyState from './src/blocky/BlockyState.js'
import BlockyEvent from './src/blocky/BlockyEvent.js'
import Piece from './src/blocky/Piece.js'
import { Shape as BlockyShape, SHAPES } from './src/blocky/Shape.js'
import ShapeQueue from './src/blocky/ShapeQueue.js'

// engine
import Engine from './src/engine/Engine.js';
import Scene from './src/engine/Scene.js';
import GameObj from './src/engine/GameObj.js';
import Point from './src/engine/Point.js';
import { intersects } from './src/engine/IntersectionMap.js';
import LineSeg from './src/engine/LineSeg.js';
import LinearLineSeg from './src/engine/LinearLineSeg.js';
import ArcLineSeg from './src/engine/ArcLineSeg.js';
import Shape from './src/engine/Shape.js';
import Circle, { CircleIntersectionStates } from './src/engine/Circle.js';
import Polygon from './src/engine/Polygon.js';

// event
import Event from './src/event/Event.js';
import EventBus from './src/event/EventBus.js';

// structs
import Coord from './src/structs/Coord.js';
import Move from './src/structs/Move.js';
import Position from './src/structs/Position.js';
import Vector from './src/structs/Vector.js';

// util
import {
  shuffle,
  range,
  swap,
  swapAllInArr,
  isMatrix,
  isSquareMatrix,
  validateMatrixOrThrow,
  validateSquareMatrixOrThrow,
  rotateArr90,
  reflectOverHorizontal,
  reflectOverVertical,
  reflectOverDiagonal,
  reflectOverAntiDiagonal,
} from './src/util/arrays.js';
import Debugger from './src/util/debug.js';
import {
  factorial,
  permutation,
  shuffle as bigintShuffle,
  forEachPerm,
  nChooseK,
  combo,
  allCombos,
  forEachCombo,
  bitCombo,
  bitComboToR,
  bitLength,
  randomBigInt,
  randomPermutation,
  randomCombo,
  randomBitCombo
} from './src/util/perms.js';
import {
  bounded,
  validateNonNegative,
  validatePositive,
  validateNegative,
  validateInteger,
  validatePositiveInteger,
  validateNegativeInteger,
} from './src/util/common.js';
import Freezable from './src/util/Freezable.js';
import Timer from './src/util/Timer.js';
import ZMod from './src/util/ZMod.js';

// sudoku
import Sudoku, {
  indicesFor,
  masksFor,
  cellRow,
  cellCol,
  cellRegion,
  cellRegion2D
} from './src/sudoku/Sudoku.js';
import SudokuSieve, {validateSieve} from './src/sudoku/SudokuSieve.js';
import {
  sieveCombos,
  sieveCombos2,
  sieveCombos3,
  sieveCombos4,
  reductionMatrix,
  createBoardMaskFromSieve,
  f,
  f2,
  searchForPrimeInvalidFromMask,
  verifySieveItems,
  sieve
} from './src/sudoku/exp2.js';
import {
  createSieve,
  findUnsolvablePairs,
  isUnsolvablePair,
  searchForSieve2,
  isIrreducableChain,
  analyzeEmptyCellChain
} from './src/sudoku/siever.js';

export {
  // blocky
  Blocky,
  BlockyState,
  BlockyEvent,
  Piece,
  BlockyShape,
  SHAPES,
  ShapeQueue,

  // engine
  Engine,
  Scene,
  GameObj,
  Point,
  intersects,
  LineSeg,
  LinearLineSeg,
  ArcLineSeg,
  Shape,
  Circle,
  CircleIntersectionStates,
  Polygon,

  // event
  Event,
  EventBus,

  // structs
  Coord,
  Move,
  Position,
  Vector,

  // arrays
  shuffle,
  swap,
  range,
  swapAllInArr,
  isMatrix,
  isSquareMatrix,
  validateMatrixOrThrow,
  validateSquareMatrixOrThrow,
  rotateArr90,
  reflectOverHorizontal,
  reflectOverVertical,
  reflectOverDiagonal,
  reflectOverAntiDiagonal,

  Debugger,

  // perms
  factorial,
  permutation,
  bigintShuffle,
  forEachPerm,
  nChooseK,
  combo,
  allCombos,
  forEachCombo,
  bitCombo,
  bitComboToR,
  bitLength,
  randomBigInt,
  randomPermutation,
  randomCombo,
  randomBitCombo,

  // common
  bounded,
  validateNonNegative,
  validatePositive,
  validateNegative,
  validateInteger,
  validatePositiveInteger,
  validateNegativeInteger,

  Freezable,
  Timer,
  ZMod,

  // sudoku
  Sudoku,
  indicesFor,
  masksFor,
  cellRow,
  cellCol,
  cellRegion,
  cellRegion2D,

  SudokuSieve,
  validateSieve,

  // exp2
  sieveCombos,
  sieveCombos2,
  sieveCombos3,
  sieveCombos4,
  reductionMatrix,
  createBoardMaskFromSieve,
  f,
  f2,
  searchForPrimeInvalidFromMask,
  verifySieveItems,
  sieve,

  // siever
  createSieve,
  findUnsolvablePairs,
  isUnsolvablePair,
  searchForSieve2 as searchForSieve2,
  isIrreducableChain,
  analyzeEmptyCellChain
};
