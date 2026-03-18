// Standard gate implementations for simplification
export const STANDARD_GATES = {
	/**
	 * @param {number[]} inputs An array of bits.
	 * @returns {number} The result of a bitwise OR on all inputs.
	 */
	OR: (inputs) => {
		return inputs.reduce((acc, bit) => acc | bit, 0);
	},
	/**
	 * @param {number[]} inputs An array of bits.
	 * @returns {number} The result of a bitwise AND on all inputs.
	 */
	AND: (inputs) => {
		return inputs.reduce((acc, bit) => acc & bit, 1);
	},
	/**
	 * @param {number[]} input An array containing a single bit.
	 * @returns {number} The inverted bit.
	 */
	NOT: (input) => {
		if (input.length !== 1) {
			throw new Error("NOT gate requires exactly one input");
		}
		return input[0] ? 0 : 1;
	},

  XOR: (inputs) => {
    return inputs.reduce((acc, bit) => acc ^ bit, 0);
  }
};
