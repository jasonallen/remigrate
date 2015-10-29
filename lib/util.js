'use strict';
var Promise = require('bluebird');
var path = require('path');
var AppError = require('./appError');
var r = require('rethinkdb');
var fs = require('fs');
var context = require('./context');
var strftime = require('strftime');

var MIGRATIONS_TABLE = '_remigrate_';
var migrationNameRE = /^([0-9]{14})_(.+)$/;

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
function fileMigrations() {
  var files = fs.readdirSync('./migrations');
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
      return r.db(context.db()).tableCreate(MIGRATIONS_TABLE).run(e.conn);
    })
    .then(function(conn) {
      return r.db(context.db()).table(MIGRATIONS_TABLE)
        .insert({name: migration})
        .run(conn);
    });
}

/**
 * deletes the migration from the migration table.
 *
 * @param {String} migration name
 * @return {Promise}
 */
function unlogMigration(migration) {
  return connect()
    .then(tableCheck)
    .catch(function(e) {
      if (e.message !== 'Missing Remigrate Table.') { throw e; }
      return r.db(context.db()).tableCreate(MIGRATIONS_TABLE).run(e.conn);
    })
    .then(function(conn) {
      return r.db(context.db()).table(MIGRATIONS_TABLE)
        .filter({name: migration})
        .delete()
        .run(conn);
    });
}

/**
 * performs the specified migration
 *
 * @param {String} name of migration file to run
 * @return {Promise}
 */
function upMigration(migration) {
  var withoutjs = migration.slice(0,-3);
  var migrationPath = [process.cwd(), 'migrations', withoutjs].join(path.sep);
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


/**
 * performs a down specified migration
 *
 * @param {String} name of the migration
 * @return {Promise}
 */
function downMigration(migration) {
  var withoutjs = migration.slice(0,-3);
  var migrationPath = [process.cwd(), 'migrations', withoutjs].join(path.sep);
  var definition = require(migrationPath);
  return connect()
    .then(function(conn) {
      return definition
        .down(r.db(context.db()), conn)
        .then(function() {
          return unlogMigration(migration);
        }).then(function() {
          return migration;
        });
      })
    .catch(function(err) {
      throw err;
    });
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

/**
 * throws AppError if migrations dir doesn't exist
 */
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

/**
 * returns a Promise that will throw an AppError if the migration name isnt
 * well-formed.
 *
 * @return {Promise}
 */
function validMigrationName(name) {
  return new Promise(function(resolve) {
    if (name === 'last' || migrationNameRE.test(name)) {
      return resolve();
    }
    throw new AppError('No valid migration specified.');
  });
}

var migrationTemplate = 'module.exports = {\n\
  up: function(db, conn) { return db.tableCreate(\'persons\').run(conn);},\n\
  down: function(db, conn) { return db.tableDrop(\'persons\').run(conn);}\n\
};\n';

/**
 * generates a migration with the given name
 *
 * @param {String} name of the migration
 * @return {Promise} promise with the filename
 */
function generateMigration(name) {
  return new Promise(function(resolve) {
    var filename = strftime('%Y%m%H%M%S') + '_' + name + '.js';
    var fullFilename = ['.','migrations',filename].join(path.sep);
    fs.writeFileSync(fullFilename, migrationTemplate);
    resolve(filename);
  });
}

module.exports = {
  checkMigrationDir: checkMigrationDir,
  dbMigrations: dbMigrations,
  fileMigrations: fileMigrations,
  upMigration: upMigration,
  downMigration: downMigration,
  scheduledMigrations: scheduledMigrations,
  migrationsTable: migrationsTable,
  requiredFiles: requiredFiles,
  setContext: setContext,
  checkValidDb: checkValidDb,
  validMigrationName: validMigrationName,
  generateMigration: generateMigration,
  MIGRATIONS_TABLE: MIGRATIONS_TABLE
};
