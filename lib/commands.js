'use strict';
var checks = require('./checks');

/**
 * will perform any lingering migrations
 */
function up(env, options) {
  console.log('up command');
}

/**
 * will rollback the latest migration
 */
function down(env, options) {
  console.log('down command');
}

/**
 * will report the current satus of migrations
 */
function status(env, options) {
  checks.requiredFiles();
  console.log('status command');
}

/**
 * will create a migration with the given name
 */
function generate(env, options) {
  console.log('generate command');
}

module.exports = {
  up: up,
  down: down,
  status: status,
  generate: generate
};
