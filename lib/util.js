'use strict';
var Promise = require('bluebird');
var path = require('path');
var AppError = require('./appError');
var r = require('rethinkdb');
var fs = require('fs');

/**
 * returns the path to ./migrations/remigraterc.js
 *
 * @returns {String} path to ./migratinos/remigraterc.js
 */
function remigratercPath() {
  return [process.cwd(), '.', 'migrations', 'remigraterc'].join(path.sep);
}

/**
 * returns the ./migrations/remigraterc.js exports
 *
 * @returns {Object } the remigraterc.js exports
 */
function remigraterc() {
  return require(remigratercPath());
}

/**
 * executes a callback in a context of a connection
 *
 * @param {Function} callback passed in the connection
 */
function withConnection(cb) {
  r.connect(remigraterc(), function(err, conn) {
    if (err) {
      throw new AppError(err.message);
    }
    return cb(conn);
  });
}

var MIGRATIONS_TABLE = '_remigrate_';

/**
 * returns a promise that yields the migrations that have been run
 * (e.g. that are in the db)
 */
function dbMigrations(cb) {
  return r
    .connect(remigraterc())
    .then(function(conn) {
      return r
        .db(remigraterc().db)
        .tableList()
        .run(conn)
        .then(function(tables) {
          if (tables.indexOf(MIGRATIONS_TABLE) < 0) {
            // doesn't exit - so none!
            return [];
          }
          // table exists, so fetch items in it
          return r
            .db(remigraterc().db)
            .table(MIGRATIONS_TABLE)
            .run(conn)
            .then(function(cursor) {
              return cursor
                .toArray()
                .then(function(migrationObjects) {
                  return migrationObjects.map(function(obj) {
                    return obj.name;
                  });
                });
            });
        });
    });
}

/**
 * returns the list of migrations found in the migrations directory
 */
function fileMigrations(cb) {
  var files = fs.readdirSync('./migrations');
  var migrationNameRE = /^([0-9]{14})_(.+)$/;
  var filtered = files.filter(function(filename) {
    return migrationNameRE.test(filename);
  });
  return filtered;
}

function logMigration(migration) {
  return r
    .connect(remigraterc())
    .then(function(conn) {
      return r
        .db(remigraterc().db)
        .tableList()
        .run(conn)
        .then(function(tables) {
          if (tables.indexOf(MIGRATIONS_TABLE) < 0) {
            // it doesn't exist - create it
            return r.tableCreate(MIGRATIONS_TABLE).run(conn);
          }
          return new Promise(function(res,rej) { res(); });
        }).then(function() {
          return r
            .db(remigraterc().db)
            .table(MIGRATIONS_TABLE)
            .insert({name: migration})
            .run(conn);
      });
  });
}

function runMigration(migration) {
  var withoutjs = migration.slice(0,-3);
  var migrationPath = [process.cwd(), '.', 'migrations', withoutjs].join(path.sep);
  var definition = require(migrationPath);
  return r
    .connect(remigraterc())
    .then(function(conn) {
      return definition
        .up(r.db(remigraterc().db), conn)
        .then(function() {
          return logMigration(migration);
        }).then(function() {
          return migration;
        });
      })
    .catch(function(err) {
      throw err;
    });
}

function runMigrations(migrations, cb) {
  return Promise.map(migrations, runMigration, {concurrency: 1});
}

/**
 * returns an array of file migrations that haven't been run yet (that are not
 * in the database)
 *
 * @return {Promise} the promise that will be resolved with the list of
 *         migration names.
 */
function scheduledMigrations() {
  requiredFiles();
  var allMigrations = fileMigrations();
  return migrationsTable()
    .then(dbMigrations)
    .then(function(performedMigrations) {
      // run every fileMigration not found in dbMigrations
      return allMigrations.filter(function(filename) {
        return performedMigrations.indexOf(filename) < 0;
      });
    });
}

/**
 * checks to see if the migrations dir is there, and if the .remigraterc.js file too
 */
function checkMigrationsDir() {
  var migrationsPath = ['.', 'migrations'].join(path.sep);
  var fd, fstat;
  try {
    fd = fs.openSync(migrationsPath, 'r');
    fstat = fs.fstatSync(fd);
  } catch (err) {
    throw new AppError('Missing migrations directory');
  }
  if (!fstat.isDirectory()) {
    throw new AppError('Missing migrations directory');
  }
}

/**
 * checks to see if the .remigraterc.js file. It will throw an AppError if there
 * is no remigraterc.js file, or if its malformed.
 */
function checkRemigratercFile() {
  var migrationsrcPath = remigratercPath();
  var remigratercModule;
  try {
    remigratercModule = require(migrationsrcPath);
  } catch (err) {
    throw new AppError('Cannot read migrations/remigraterc.js file');
  }
  var malformedErr = new AppError('remigraterc.js file seems malformed. Make sure it exports a database configuration object, with at least a \'db\' property');

  if (typeof remigratercModule !== 'object') { throw malformedErr; }
  if (typeof remigratercModule.db !== 'string') { throw malformedErr; }
}

/**
 * checks that all the required files and directory are present, otherwise
 * throws an AppError with the appropriate message.
 */
function requiredFiles() {
  checkMigrationsDir();
  checkRemigratercFile();
}

function ensureTableExists(conn) {
  return r
    .db(remigraterc().db)
    .tableList()
    .run(conn)
    .then( function(tables) {
      if (tables.indexOf('_remigrate_') >= 0) {
        // yep, it exists - all done
        return new Promise(function(res) { res(); });
      } else {
        // no, create it
        return r
          .db(remigraterc().db)
          .tableCreate('_remigrate_')
          .run(conn);
      }
    });
}

/**
 * Ensures that the migration table is created and available in the target
 * database.
 *
 * @return {Function} Promise
 */
function migrationsTable(cb) {
  return r
    .connect(remigraterc())
    .then(function(conn) {
      return r
        .dbList()
        .run(conn)
        .then(function(dbs) {
          if (dbs.indexOf(remigraterc().db) >= 0) {
            return new Promise(function(res) { res(); });
          }
          return r.dbCreate(remigraterc().db).run(conn);
        })
        .then(function() { return ensureTableExists(conn); });
    });
}



module.exports = {
  remigratercPath: remigratercPath,
  remigraterc: remigraterc,
  withConnection: withConnection,
  dbMigrations: dbMigrations,
  fileMigrations: fileMigrations,
  runMigrations: runMigrations,
  scheduledMigrations: scheduledMigrations,
  migrationsTable: migrationsTable,
  requiredFiles: requiredFiles,
  MIGRATIONS_TABLE: MIGRATIONS_TABLE
};
