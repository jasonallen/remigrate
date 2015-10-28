'use strict';
var util = require('./util');

/**
 * will perform any lingering migrations
 */
function up(cmd) {
  return util.setContext(cmd)
    .then(util.checkValidDb)
    .then(util.checkMigrationDir)
    .then(util.scheduledMigrations)
    .then(util.runMigrations);
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
function status(cmd) {
  return util.setContext(cmd)
    .then(util.checkValidDb)
    .then(util.checkMigrationDir)
    .then(util.scheduledMigrations);
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
