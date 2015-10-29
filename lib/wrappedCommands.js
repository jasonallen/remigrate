'use strict';
var commands = require('./commands');
var context = require('./context');
var AppError = require('./appError');

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
    var cmd = arguments[arguments.length - 1];
    context.setDB(cmd.parent.database, cmd.parent.port);
    cb.apply(this, arguments)
      .catch (function(err) {
        if (err instanceof AppError) {
          context.stdout().write('Remigrate Error: ' + err.message + '\n');
          return;
        }
        throw err;
      });
    };
}

var wrappedCommands = {};
for (var c in commands) {
  if (commands.hasOwnProperty(c)) {
    wrappedCommands[c] = wrapAppError(commands[c]);
  }
}
module.exports = wrappedCommands;
