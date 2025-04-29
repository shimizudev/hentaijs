/**
 * Normalizes a string by removing all symbols, special characters, and numbers,
 * then converts it to lowercase.
 *
 * @param {string} str - The input string to normalize.
 * @returns {string} The normalized string.
 * @throws {TypeError} If the input is not a string.
 *
 * @example
 * // Returns "hello world"
 * normalize("Hello World! 123");
 *
 * @example
 * // Returns "just text"
 * normalize("Just TEXT! @#$%^&*()");
 */
export function normalize(str: string): string {
	if (typeof str !== "string") {
		throw new TypeError("Input must be a string");
	}

	if (str.trim() === "") {
		return str;
	}

	// Remove all symbols, special characters, and numbers
	const normalized = str.replace(/[^a-zA-Z\s]/g, " ");

	// Convert to lowercase and remove double or more spaces
	return normalized
		.toLowerCase()
		.replace(/\s{2,}/g, " ")
		.replaceAll("episode", "");
}
