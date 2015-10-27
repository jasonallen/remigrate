'use strict';
var path = require('path');
var fs = require('fs');
var AppError = require('./appError');
var r = require('rethinkdb');
var util = require('./util');
var remigratercPath = util.remigratercPath;
var remigraterc = util.remigraterc;

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
  migrationsTable: migrationsTable,
  requiredFiles: requiredFiles
};
