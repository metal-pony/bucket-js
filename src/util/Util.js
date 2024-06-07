/**
 * Returns a random integer between min and max, inclusive.
 *
 * @param {number} value The value to bind.
 * @param {number} min The minimum value, inclusive.
 * @param {number} max The maximum value, inclusive.
 * @returns {number} A random integer between min and max, inclusive.
 */
export const bounded = (value, min, max) => {
  if (min > max) {
    throw new Error(`min must be less than or equal to max`);
  }

  return Math.min(Math.max(min, value), max);
};

/**
 * Shuffles the given array in place using the Fisher-Yates algorithm.
 *
 * @param {number[]} arr The array to shuffle.
 * @returns {number[]} The given array for convenience.
 */
export const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    swap(arr, i, Math.floor(Math.random() * (i + 1)));
  }
  return arr;
};

/**
 * Swaps the elements at the given indices in the given array.
 *
 * @param {number[]} arr The array in which to swap elements.
 * @param {number} i The index of the first element to swap.
 * @param {number} j The index of the second element to swap.
 * @returns {number[]} The given array for convenience.
 */
export const swap = (arr, i, j) => {
  const temp = arr[i];
  arr[i] = arr[j];
  arr[j] = temp;
  return arr;
};

/**
 * Returns an array of numbers from start to end, inclusive.
 *
 * @param {number} start The first number in the range.
 * @param {number} end The last number in the range.
 * @returns {number[]} An array of numbers from start to end, inclusive.
 */
export const range = (start, end) => {
  const result = [];
  for (let i = start; i <= end; i++) {
    result.push(i);
  }
  return result;
};

/**
 * Returns the given value if it is non-negative, otherwise throws an error.
 * @param {number} value The value to validate.
 * @param {string} name The name of the value to print if there's an error.
 * @returns {number} The given value if it is non-negative.
 */
export const validateNonNegative = (value, name) => {
  if (value < 0) {
    throw new Error(`${name} must be non-negative`);
  }
  return value;
};

/**
 * Returns the given value if it is positive, otherwise throws an error.
 * @param {number} value The value to validate.
 * @param {string} name The name of the value to print if there's an error.
 * @returns {number} The given value if it is positive.
 */
export const validatePositive = (value, name) => {
  if (value <= 0) {
    throw new Error(`${name} must be positive`);
  }
  return value;
};

/**
 * Returns the given value if it is negative, otherwise throws an error.
 * @param {number} value The value to validate.
 * @param {string} name The name of the value to print if there's an error.
 * @returns {number} The given value if it is negative.
 */
export const validateNegative = (value, name) => {
  if (value >= 0) {
    throw new Error(`${name} must be negative`);
  }
  return value;
};

/**
 * Returns the given value if it is an integer, otherwise throws an error.
 * @param {number} value The value to validate.
 * @param {string} name The name of the value to print if there's an error.
 * @returns {number} The given value if it is an integer.
 */
export const validateInteger = (value, name) => {
  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be an integer`);
  }
  return value;
};

/**
 * Returns the given value if it is a positive integer, otherwise throws an error.
 * @param {number} value The value to validate.
 * @param {string} name The name of the value to print if there's an error.
 * @returns {number} The given value if it is a positive integer.
 */
export const validatePositiveInteger = (value, name) => {
  validateInteger(value, name)
  return validatePositive(value, name);
};

/**
 * Returns the given value if it is a negative integer, otherwise throws an error.
 * @param {number} value The value to validate.
 * @param {string} name The name of the value to print if there's an error.
 * @returns {number} The given value if it is a negative integer.
 */
export const validateNegativeInteger = (value, name) => {
  validateInteger(value, name);
  return validateNegative(value, name);
};
