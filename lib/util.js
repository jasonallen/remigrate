'use strict';
var Promise = require('bluebird');
var path = require('path');
var AppError = require('./appError');
var r = require('rethinkdb');
var fs = require('fs');
var context = require('./context');

/**
 * executes a callback in a context of a connection
 *
 * @param {Function} callback passed in the connection
 */
function withConnection(cb) {
  r.connect(context.dbInfo(), function(err, conn) {
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
    .connect(context.dbInfo())
    .then(function(conn) {
      return r
        .db(context.db())
        .tableList()
        .run(conn)
        .then(function(tables) {
          if (tables.indexOf(MIGRATIONS_TABLE) < 0) {
            // doesn't exit - so none!
            return [];
          }
          // table exists, so fetch items in it
          return r
            .db(context.db())
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
    .connect(context.dbInfo())
    .then(function(conn) {
      return r
        .db(context.db())
        .tableList()
        .run(conn)
        .then(function(tables) {
          if (tables.indexOf(MIGRATIONS_TABLE) < 0) {
            // it doesn't exist - create it
            return r.db(context.db()).tableCreate(MIGRATIONS_TABLE).run(conn);
          }
          return new Promise(function(res,rej) { res(); });
        }).then(function() {
          return r
            .db(context.db())
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
    .connect(context.dbInfo())
    .then(function(conn) {
      return definition
        .up(r.db(context.db()), conn)
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
 * checks to see if the migrations dir is there
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


function checkMigrationDir() {
  return new Promise(function(res, rej) {
    var migrationsPath = ['.', 'migrations'].join(path.sep);
    var fd, fstat;
    try {
      fd = fs.openSync(migrationsPath, 'r');
      fstat = fs.fstatSync(fd);
      if (!fstat.isDirectory()) {
        rej(new AppError('Missing migrations directory'));
        return;
      }
      res();
    } catch (err) {
      rej(new AppError('Missing migrations directory'));
    }
  });
}

/**
 * checks that all the required files and directory are present, otherwise
 * throws an AppError with the appropriate message.
 */
function requiredFiles() {
  checkMigrationsDir();
}

function ensureTableExists(conn) {
  return r
    .db(context.db())
    .tableList()
    .run(conn)
    .then( function(tables) {
      if (tables.indexOf('_remigrate_') >= 0) {
        // yep, it exists - all done
        return new Promise(function(res) { res(); });
      } else {
        // no, create it
        return r
          .db(context.db())
          .tableCreate(MIGRATIONS_TABLE)
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
  return new Promise(function(res,rej) {
    if (context.db() === null) {
      return rej(new AppError('No DB Specified.'));
    }
    return res();
    })
  .then(function() {
    return r.connect(context.dbInfo());
    })
  .then(function(conn) {
      return r
        .dbList()
        .run(conn)
        .then(function(dbs) {
          if (dbs.indexOf(context.db()) >= 0) {
            return new Promise(function(res) { res(); });
          }
          return r.dbCreate(context.db()).run(conn);
        })
        .then(function() { return ensureTableExists(conn); });
    });
}

function setContext(cmd) {
  var database = cmd && cmd.parent && cmd.parent.database;
  var port = cmd && cmd.parent && cmd.parent.port;
  context.setDB(database, port);
  return new Promise(function(resolve, reject) { resolve(); });
}

function checkValidDb() {
  return new Promise(function(resolve, reject) {
    var db = context.db();
    if (typeof db === 'undefined' || db === null || db === '') {
      return reject(new AppError('No DB Specified.'));
    }
    resolve();
  });
}

module.exports = {
  withConnection: withConnection,
  checkMigrationDir: checkMigrationDir,
  dbMigrations: dbMigrations,
  fileMigrations: fileMigrations,
  runMigrations: runMigrations,
  runMigration: runMigration,
  scheduledMigrations: scheduledMigrations,
  migrationsTable: migrationsTable,
  requiredFiles: requiredFiles,
  setContext: setContext,
  checkValidDb: checkValidDb,
  MIGRATIONS_TABLE: MIGRATIONS_TABLE
};
