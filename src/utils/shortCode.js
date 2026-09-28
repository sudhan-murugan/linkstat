const { customAlphabet } = require('nanoid');

// URL-safe alphanumerics only (no "-" / "_"), 7 chars ≈ 3.5 trillion combinations
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const LENGTH = 7;

const generateShortCode = customAlphabet(ALPHABET, LENGTH);

// Matches only strings that could be one of our codes (cheap pre-check before a DB lookup)
const SHORT_CODE_PATTERN = new RegExp(`^[${ALPHABET}]{${LENGTH}}$`);

module.exports = { generateShortCode, SHORT_CODE_PATTERN };
