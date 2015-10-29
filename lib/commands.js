'use strict';
var util = require('./util');
var context = require('./context');
var Promise = require('bluebird');
var AppError = require('./appError');

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
          .upMigration(migration)
          .then(function() {
            write('...done.\n');
          });
      });
    });
}

/**
 * will rollback the latest migration
 */
function down(arg, cmd) {
  return util.validMigrationName(arg)
    .then(function() {return util.setContext(cmd); })
    .then(util.checkValidDb)
    .then(util.checkMigrationDir)
    .then(util.dbMigrations)
    .then(function(migrations) {
      var migration;
      if (arg === 'last') {
        migration = migrations[migrations.length - 1];
      } else {
        var i = migrations.indexOf(arg);
        if (i < 0) {
          throw new AppError('Not a valid migration.');
        }
        migration = arg;
      }
      var write = context.stdout().write;
      write('running down on ' + migration + '...');
      return util
        .downMigration(migration)
        .then(function() {
          write('...done.\n');
      });
    });
}

/**
 * will report the current satus of migrations
 */
function status(cmd) {
  return util.setContext(cmd)
    .then(util.checkValidDb)
    .then(util.checkMigrationDir)
    .then(util.dbMigrations)
    .then(function(dbMigrations) {
      var out = context.stdout();
      out.write(dbMigrations.length + ' migrations run.\n');
      if (dbMigrations.length > 0) {
        var last3 = dbMigrations.slice(-3);
        out.write('last ' + last3.length + ':\n');
        last3.map(function(mig) { out.write('  ' + mig + '\n'); });
      }
    })
    .then(util.scheduledMigrations)
    .then(function(migrations) {
      var out = context.stdout();
      out.write('\n' + migrations.length + ' migrations pending.\n');
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
function generate(arg, cmd) {
  return util.setContext(cmd)
    .then(function() {
      return util.generateMigration(arg);
    })
    .then(function(name) {
      var out = context.stdout();
      out.write('Generated ' + name + '\n');
    });
}

module.exports = {
  up: up,
  down: down,
  status: status,
  generate: generate
};
