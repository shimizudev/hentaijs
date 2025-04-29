/**
 * Removes all numbers from a string.
 *
 * @param {string} str - The input string to remove numbers from.
 * @returns {string} The string with all numbers removed.
 * @throws {TypeError} If the input is not a string.
 *
 * @example
 * // Returns "abcdef"
 * removeNumberFromString("abc123def456");
 *
 * @example
 * // Returns "no numbers here"
 * removeNumberFromString("no numbers here");
 */
export function removeNumberFromString(str: string): string {
	if (typeof str !== "string") {
		throw new TypeError("Input must be a string");
	}

	if (str.trim() === "") {
		return str;
	}

	return str.replace(/\d+/g, "");
}
