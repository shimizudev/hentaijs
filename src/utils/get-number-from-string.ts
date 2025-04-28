/**
 * Extracts the first number from a string.
 *
 * @param {string} str - The input string to extract a number from.
 * @returns {number | null} The first number found in the string, or null if no numbers are found.
 * @throws {TypeError} If the input is not a string.
 *
 * @example
 * // Returns 123
 * getNumberFromString("abc123def456");
 *
 * @example
 * // Returns null
 * getNumberFromString("no numbers here");
 */
export function getNumberFromString(str: string): number | null {
	if (typeof str !== "string") {
		throw new TypeError("Input must be a string");
	}

	if (str.trim() === "") {
		return null;
	}

	const numbers = str.match(/\d+/g);
	return numbers ? Number(numbers[0]) : null;
}
