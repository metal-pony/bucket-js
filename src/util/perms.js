import { range } from './arrays.js';

const _randInt = (max) => ((Math.random() * max) | 0);

const _factorialMap = [1n, 1n];
const _factorialMapMaxSize = (1<<10);
/**
 * Generates the factorial of n. Smaller values (up to 2^10) are cached in a map.
 * @param {number} n The number to compute the factorial of. Must be >= 0.
 * @returns {BigInt} The factorial of n.
 */
export function factorial(n) {
  if (n < 0) {
    throw new Error('n must be >= 0');
  }

  if (_factorialMap[n]) {
    return _factorialMap[n];
  }

  let i = _factorialMap.length;
  let result = _factorialMap[i - 1];
  for (; i <= n; i++) {
    result *= BigInt(i);
    if (i < _factorialMapMaxSize) {
      _factorialMap[i] = result;
    }
  }

  return result;
}

/**
 * Generates a list of the r'th permutation of n items, such that 0 <= r < n!.
 * @param {number} n
 * @param {BigInt} r
 * @returns {number[]}
 */
export function permutation(n, r) {
  if (n < 0 || r < 0n || r >= factorial(n)) {
    throw new Error('n must be >= 0, r must be >= 0 and < n!');
  }

  const perm = range(n);
  for (let i = 0; i < n; i++) {
    let j = Number(
      (r % factorial(n - i)) / factorial(n - i - 1)
    );
    if (j === 0) {
      continue;
    }

    const temp = perm[i+j];
    while (j > 0) {
      perm[i+j] = perm[i+j-1];
      j--;
    }
    perm[i] = temp;
  }

  return perm;
}

/**
 * Shuffles the given array in place.
 * @param {any[]} arr The array to shuffle.
 * @returns {any[]} The given array.
 */
export function shuffle(arr) {
  const n = arr.length;
  if (!n || n < 2) {
    return arr;
  }
  const r = randomBigInt(factorial(n))

  for (let i = 0; i < n; i++) {
    let j = Number(
      (r % factorial(n - i)) / factorial(n - i - 1)
    );
    if (j === 0) {
      continue;
    }

    const temp = arr[i+j];
    while (j > 0) {
      arr[i+j] = arr[i+j-1];
      j--;
    }
    arr[i] = temp;
  }

  return arr;
}

/**
 * Performs a callback for each permutation of n items.
 * @param {number} n
 * @param {(perm: number[]) => boolean} callback Function that takes a permutation and
 * returns a boolean indicating whether to continue iterating.
 */
export function forEachPerm(n, callback) {
  const nck = factorial(n);
  for (let r = 0n; r < nck; r++) {
    if (!callback(permutation(n, r))) {
      break;
    }
  }
}

const nckCache = {
  0: [1n],
  1: [1n, 1n],
};

/**
 * Computes n choose k.
 * @param {number} n
 * @param {number} k
 * @returns {bigint}
 */
export function nChooseK(n, k) {
  if (n < 0 || k < 0 || n < k) {
    throw new Error('n and k must both be >= 0 and n must be >= k.');
  }

  if (k === 0 || n === k) {
    return 1n;
  }

  if (nckCache[n] && nckCache[n][k]) {
    return nckCache[n][k];
  }

  if (!nckCache[n]) {
    nckCache[n] = [];
  }

  nckCache[n][k] = factorial(n) / factorial(k) / factorial(n - k);
  return nckCache[n][k];
}

/**
 * Generates a list of the r'th combination of (n choose k) items, such that 0 <= r < (n choose k).
 * @param {number} n
 * @param {number} k
 * @param {BigInt} r
 * @returns {number[]}
 */
export function combo(n, k, r) {
  if (r < 0n) {
    throw new Error('r must be nonnegative');
  }

  const nck = nChooseK(n, k);
  if (r >= nck) {
    throw new Error(`r must be in interval [0, n choose k (${nck.toString()})`);
  }

  // Anything choose 0 is 1. There's only one way to choose nothing, i.e. the empty set.
  if (k === 0) {
    return [];
  }

  /** @type {number[]} */
  const result = Array(k).fill(0);

  let _n = n - 1;
  let _k = k - 1;
  let _r = BigInt(r);

  let index = 0;
  for (let i = 0; i < n; i++) {
    const _nck = nChooseK(_n, _k);
    if (_r < _nck) {
      result[index++] = i;
      _k--;

      if (index === k) {
        break;
      }
    } else {
      _r -= _nck;
    }
    _n--;
  }

  return result;
}

/**
 * Generates all possible combinations of k numbers from the interval [0,n).
 * Note: This function is not efficient for large values of n and k.
 * @param {number} n
 * @param {number} k
 * @returns {number[][]} An array of all possible combinations.
 */
export function allCombos(n, k) {
  const nck = nChooseK(n, k);
  const combos = [];
  for (let r = 0n; r < nck; r++) {
    combos.push(combo(n, k, r));
  }
  return combos;
}

/**
 * Performs a callback for each combination of k numbers from the interval [0,n).
 * @param {number} n
 * @param {number} k
 * @param {(items: number[]) => boolean} callback Function that takes a combination and
 * returns a boolean indicating whether to continue iterating.
 */
export function forEachCombo(n, k, callback) {
  const nck = nChooseK(n, k);
  for (let r = 0n; r < nck; r++) {
    if (!callback(combo(n, k, r))) {
      break;
    }
  }
}

/**
 * Given (n choose k) possible combinations, generates the r'th combination represented as a bigint.
 * The n-bit number will have k bits set to 1.
 * @param {number} n
 * @param {number} k
 * @param {bigint} r
 * @returns {bigint}
 */
export function bitCombo(n, k, r) {
  if (r < 0n) {
    throw new Error('r must be nonnegative');
  }

  const nck = nChooseK(n, k);
  if (r >= nck) {
    throw new Error(`r must be in interval [0, n choose k (${nck.toString()})`);
  }

  // Anything choose 0 is 1. There's only one way to choose nothing, i.e. the empty set.
  if (k === 0) {
    return 0n;
  }

  let _result = 0n;
  let _r = BigInt(r);

  for (let _n = n - 1, _k = k - 1; _n >= 0 && _k >= 0; _n--) {
    const _nck = nChooseK(_n, _k);
    if (_r < _nck) {
      _result |= (1n << BigInt(_n));
      _k--;
    } else {
      _r -= _nck;
    }
  }

  return _result;
}

/**
 * Attempts to convert a bit combination back into its associated r value.
 * @param {number} n
 * @param {number} k
 * @param {bigint} bc
 * @returns {bigint} The r value associated with the bit combination, or -1 if not found.
 */
export function bitComboToR(n, k, bc) {
  // TODO This uses binary search, but there's probably an easy way to calculate this directly.
  let nck = nChooseK(n, k);

  // Binary search for the bit combination.
  let lo = 0n;
  let hi = nck - 1n;
  let mid = 0n;

  while (lo <= hi) {
    mid = lo + ((hi - lo) / 2n);
    let midBC = bitCombo(n, k, mid);
    if (midBC > bc) {
      lo = mid + 1n;
    } else if (midBC < bc) {
      hi = mid - 1n;
    } else {
      return mid;
    }
  }

  return -1n;
}

// Where bitLengthCache[i] = 2^(i-1)
const bitLengthCache = [
  0n, 1n, 2n, 4n, 8n, 16n, 32n, 64n, 128n, 256n,
  512n, 1024n, 2048n, 4096n, 8192n, 16384n, 32768n, 65536n, 131072n, 262144n,
  524288n, 1048576n, 2097152n, 4194304n, 8388608n, 16777216n, 33554432n,
  67108864n, 134217728n, 268435456n, 536870912n, 1073741824n,
];
/**
 * Computes the bit length of a BigInt.
 * @param {BigInt} bn
 * @returns {number}
 */
export function bitLength(bn) {
  bn = BigInt(bn);
  if (bn < 0n) {
    bn = -bn;
  }

  let bits = 0;
  let i = bitLengthCache.length - 1;
  while (i > 0) {
    if (bn === 0n) {
      return bits;
    }
    while (bn >= bitLengthCache[i]) {
      bits += i;
      bn >>= BigInt(i);
    }
    i--;
  }

  return bits;
}

/**
 * Generates a random BigInt between 0 and upperBound.
 * @param {bigint} upperBound (Default: `Number.MAX_SAFE_INTEGER`)
 * @returns {bigint}
 */
export function randomBigInt(upperBound = BigInt(Number.MAX_SAFE_INTEGER)) {
  // Normalize upperbound within [2,inf)
  if (upperBound < 2n) {
    if (upperBound < -2n) {
      upperBound = -upperBound;
    } else {
      upperBound = 2n;
    }
  }

  let bound = upperBound;
  let result = 0n
  let i = 0n;

  while (bound > 0n) {
    if (bound >= 65536n) {
      result |= (BigInt(_randInt(65536)) << i);
      i += 16n;
      bound >>= 16n;
    } else if (bound >= 256n) {
      result |= (BigInt(_randInt(256)) << i);
      i += 8n;
      bound >>= 8n;
    } else if (bound >= 16n) {
      result |= (BigInt(_randInt(16)) << i);
      i += 4n;
      bound >>= 4n;
    } else {
      let r = 0;
      do {
        r = BigInt(_randInt(Number(bound)));
      } while ((result | (BigInt(r) << i)) >= upperBound);
      result |= (r << i);
      bound = 0n;
    }
  }

  return result;
}

/**
 * Generates a random permutation of n numbers.
 * @param {number} n
 * @returns {number[]}
 */
export function randomPermutation(n) {
  return permutation(n, randomBigInt(factorial(n)));
}

/**
 * Generates a random combination of k numbers from the interval [0,n).
 * @param {number} n
 * @param {number} k
 * @returns {number[]}
 */
export function randomCombo(n, k) {
  return combo(n, k, randomBigInt(nChooseK(n, k)));
}

/**
 * Generates a random bit combination of k bits set to 1 from n bits.
 * @param {number} n
 * @param {number} k
 * @returns {bigint}
 */
export function randomBitCombo(n, k) {
  return bitCombo(n, k, randomBigInt(nChooseK(n, k)));
}

export default {
  factorial,
  permutation,
  shuffle,
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
};
