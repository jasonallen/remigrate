'use strict';

module.exports = function AppError(message) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message;
  this.type = 'AppError';
};

require('util').inherits(module.exports, Error);
