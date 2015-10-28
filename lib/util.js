'use strict';
var Promise = require('bluebird');
var path = require('path');
var AppError = require('./appError');
var r = require('rethinkdb');
var fs = require('fs');
var context = require('./context');


var MIGRATIONS_TABLE = '_remigrate_';

/**
 * returns a promise with a connection to our database
 *
 * @return {Promise} with the rethinkDB connection
 */
function connect() {
  return r.connect(context.dbInfo());
}

/**
 * returns a promise that resolves with the connection if the database exists,
 * otherwise throws with an AppError.
 *
 * @return {Promise} with rethinkDB connection, or error if no DB
 */
function dbCheck(conn) {
  return r
    .dbList()
    .run(conn)
    .then(function(dbs) {
      return new Promise(function(resolve) {
        if (dbs.indexOf(context.db()) < 0 ) {
          throw new AppError('Missing Database.', conn);
        }
        resolve(conn);
      });
    });
}

/**
 * returns a Promise that resolves with the connection if the remigrate table
 * exists, otherwise throws an AppError.
 *
 * @return {Promise} with rethinkDB connection, or error if no table
 */
function tableCheck(conn) {
  return r
    .db(context.db())
    .tableList()
    .run(conn)
    .then(function(tables) {
      return new Promise(function(resolve) {
        if (tables.indexOf(MIGRATIONS_TABLE) < 0) {
          throw new AppError('Missing Remigrate Table.', conn);
        }
        resolve(conn);
      });
    });
}

/**
 * returns a promise that yields the migrations that have been run
 * (e.g. that are in the db). Will return an empty array if the db
 * is not present, or if the migrations table is missing.
 *
 * @return {Promise} migration that have been run in the db
 */
function dbMigrations() {
  return connect()
    .then(dbCheck)
    .then(tableCheck)
    .then(function(conn) {
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
    })
    .catch(function(err) {
      if (err.message === 'Missing Database.' ||
        err.message === 'Missing Remigrate Table.') {
          // this is acceptable - just return empty array
          return [];
        }
        throw err;
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

/**
 * writes the migration to the migration table. Will create the table if it
 * doesnt exist
 *
 * @param {String} migration name
 * @return {Promise}
 */
function logMigration(migration) {
  return connect()
    .then(tableCheck)
    .catch(function(e) {
      if (e.message !== 'Missing Remigrate Table.') { throw e; }
      var conn = e.conn;
      return r.db(context.db()).tableCreate(MIGRATIONS_TABLE).run(conn);
    })
    .then(function(conn) {
      return r
        .db(context.db())
        .table(MIGRATIONS_TABLE)
        .insert({name: migration})
        .run(conn);
    });
}

function runMigration(migration) {
  var withoutjs = migration.slice(0,-3);
  var migrationPath = [process.cwd(), '.', 'migrations', withoutjs].join(path.sep);
  var definition = require(migrationPath);
  return connect()
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

/*
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
*/

/**
 * Ensures that the migration table is created and available in the target
 * database.
 *
 * @return {Function} Promise
 */
function migrationsTable(cb) {
  return connect()
    .then(dbCheck)
    .catch(function(err) {
      if (err.message !== 'Missing Database.') { throw err; }
      return r.dbCreate(context.db()).run(err.conn)
        .then(function() { return err.conn;});
    })
    .then(tableCheck)
    .catch(function(err) {
      if (err.message !== 'Missing Remigrate Table.') { throw err; }
      return r.db(context.db()).tableCreate(MIGRATIONS_TABLE).run(err.conn)
        .then(function() { return err.conn;} );
    });
}

/**
 * sets the database context to the cmd parameters passed in
 *
 * @param {Object} the commander cmd
 * @return {Promise}
 */
function setContext(cmd) {
  var database = cmd && cmd.parent && cmd.parent.database;
  var port = cmd && cmd.parent && cmd.parent.port;
  context.setDB(database, port);
  return new Promise(function(resolve) { resolve(); });
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
