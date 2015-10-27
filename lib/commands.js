'use strict';
var util = require('./util');

/**
 * will perform any lingering migrations
 */
function up(env, options, cb) {
  if (arguments.length === 1) {
    cb = env;
  }
  util.requiredFiles();
  return util.migrationsTable()
    .then(util.dbMigrations)
    .then(function(dbMigrations) {
      var fileMigrations = util.fileMigrations();
      // run every fileMigration not found in dbMigrations
      var toRun = fileMigrations.filter(function(filename) {
        return dbMigrations.indexOf(filename) < 0;
      });
      return util.runMigrations(toRun);
    });
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
  util.requiredFiles();
  return util.scheduledMigrations();
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
