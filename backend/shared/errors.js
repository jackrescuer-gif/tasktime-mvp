/**
 * Shared error response helpers. No business logic.
 */
function sendError(res, statusCode, message) {
  return res.status(statusCode).json({ error: message });
}

module.exports = { sendError };
