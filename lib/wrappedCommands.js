var commands = require('./commands');

/**
 * this module returns the same commands as 'commands.js', but they are wrapped
 * with a handler that catches our own recognized errors ('AppErrors'), and
 * outputs these to STDOUT in an elegant way. This provides a better user
 * experience than having an error shown, where the stack trace is ugly and
 * confusing.
 */

/**
 * runs the cb under a try/catch to elegantly handle AppErrors
 *
 * @param {Function} callback wrap
 */
function wrapAppError(cb) {
  return function() {
    try {
      cb()
    } catch (err) {
      if (err.type === 'AppError') {
        console.log("Remigrate Error: " + err.message);
      } else {
        throw err;
      }
    }
  }
}

var wrappedCommands = {};
for(var c in commands) {
  if(commands.hasOwnProperty(c))
    wrappedCommands[c] = wrapAppError(commands[c]);
};
module.exports = wrappedCommands;
