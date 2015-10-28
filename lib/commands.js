'use strict';
var util = require('./util');
var context = require('./context');
var Promise = require('bluebird');

/**
 * will perform any lingering migrations
 */
function up(cmd) {
  return util.setContext(cmd)
    .then(util.checkValidDb)
    .then(util.checkMigrationDir)
    .then(util.scheduledMigrations)
    .then(function(migrations) {
      var write = context.stdout().write;
      write(migrations.length + ' migrations to run.\n');
      return Promise.each(migrations, function(migration) {
        write('running ' + migration + '...');
        return util
          .runMigration(migration)
          .then(function() {
            write('...done.\n');
          });
      });
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
function status(cmd) {
  return util.setContext(cmd)
    .then(util.checkValidDb)
    .then(util.checkMigrationDir)
    .then(util.scheduledMigrations)
    .then(function(migrations) {
      var out = context.stdout();
      out.write(migrations.length + ' migrations to run.\n');
      if (migrations.length > 0) {
        out.write('\n');
        migrations.map(function(m) {
          out.write('  ' + m + '\n');
        });
      }
    });
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
