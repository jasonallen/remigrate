'use strict';

module.exports = function AppError(message, conn) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message;
  this.type = 'AppError';
  this.conn = conn;
};

require('util').inherits(module.exports, Error);
