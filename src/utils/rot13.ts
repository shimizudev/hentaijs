/**
 * Applies the ROT13 cipher to a string, shifting each letter 13 positions in the alphabet.
 * Non-alphabetic characters remain unchanged.
 *
 * @param {string} str - The input string to be encoded or decoded with ROT13.
 * @returns {string} The ROT13 transformed string.
 * @throws {TypeError} If the input is not a string.
 *
 * @example
 * // Returns "uryyb"
 * rot13Cipher("hello");
 *
 * @example
 * // Returns "hello"
 * rot13Cipher("uryyb");
 *
 * @example
 * // Returns "Uryyb, Jbeyq! 123"
 * rot13Cipher("Hello, World! 123");
 */
export const rot13Cipher = (str: string): string => {
	if (typeof str !== "string") {
		throw new TypeError("Input must be a string");
	}

	if (str.length === 0) {
		return "";
	}

	return str.replace(/[a-zA-Z]/g, (c) => {
		const charCode = c.charCodeAt(0);
		const isUpperCase = charCode >= 65 && charCode <= 90;
		const shiftedCharCode = isUpperCase
			? ((charCode - 65 + 13) % 26) + 65
			: ((charCode - 97 + 13) % 26) + 97;
		return String.fromCharCode(shiftedCharCode);
	});
};
