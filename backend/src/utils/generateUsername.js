/**
 * USERNAME GENERATOR
 *
 * PURPOSE:
 * Generates a unique 7-character uppercase alphanumeric username.
 * Used for internal identification and admin communication.
 *
 * FORMAT: 7 characters, uppercase letters (A-Z) + digits (0-9)
 * EXAMPLES: A7K9P2X, B3M5Q8Z, C2N6R1W
 *
 * WHY 7 CHARACTERS?
 * - 36^7 = ~78 billion possible combinations
 * - Collision probability is negligible up to ~1 million users
 * - Short enough to display cleanly in mobile UI
 * - Distinguishable from phone numbers and emails
 *
 * UNIQUENESS STRATEGY:
 * Generate → Check DB → Retry if collision (up to 5 attempts)
 * At current scale, collisions should be essentially zero.
 * If collision rate increases (>100k users), switch to a sequential prefix system.
 *
 * WHEN IS IT GENERATED?
 * On user registration (register function in authController.js).
 * Once set, username is NEVER changed. It is the permanent user identifier.
 *
 * TODO: Call generateUniqueUsername(User) in authController.js register function
 */

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const USERNAME_LENGTH = 7;

/**
 * Generates a random 7-character uppercase alphanumeric string.
 * @returns {string} e.g. "A7K9P2X"
 */
const generateUsername = () => {
  let result = '';
  for (let i = 0; i < USERNAME_LENGTH; i++) {
    result += CHARSET.charAt(Math.floor(Math.random() * CHARSET.length));
  }
  return result;
};

/**
 * Generates a unique username by checking the DB for collisions.
 * Retries up to 5 times before throwing.
 *
 * @param {mongoose.Model} UserModel - The User mongoose model
 * @returns {Promise<string>} A unique username
 * @throws {Error} If unable to generate a unique username after 5 attempts
 */
const generateUniqueUsername = async (UserModel) => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const username = generateUsername();
    const exists = await UserModel.findOne({ username }).lean();
    if (!exists) return username;
  }
  throw new Error('Failed to generate a unique username after 5 attempts. This should not happen at normal scale.');
};

module.exports = { generateUsername, generateUniqueUsername };
