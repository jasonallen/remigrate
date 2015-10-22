var path = require('path');
var fs = require('fs');
var AppError = require('./appError');
var r = require('rethinkdb');

'use strict';

/**
 * checks to see if the migrations dir is there, and if the .remigraterc.js file too
 */
function checkMigrationsDir() {
  var migrationsPath = ['.','migrations'].join(path.sep);
  var fd, fstat;
  try {
    fd = fs.openSync(migrationsPath, 'r');
    fstat = fs.fstatSync(fd);
  } catch(err) {
    throw new AppError('Missing migrations directory');
  }
  if (!fstat.isDirectory()) throw new AppError('Missing migrations directory');
}

/**
 * returns the path to ./migrations/remigraterc.js
 *
 * @returns {String} path to ./migratinos/remigraterc.js
 */
function remigratercPath() {
  return [process.cwd(),'.','migrations','remigraterc'].join(path.sep);
}

/**
 * checks to see if the .remigraterc.js file. It will throw an AppError if there
 * is no remigraterc.js file, or if its malformed.
 */
function checkRemigratercFile() {
  var migrationsrcPath = remigratercPath();
  var remigrate;
  try {
    remigraterc = require(migrationsrcPath);
  } catch (err) {
    throw new AppError('Cannot read migrations/remigraterc.js file');
  }
  var malformedErr = new AppError('remigraterc.js file seems malformed. Make sure it exports a database configuration object, with at least a \'db\' property');

  if (typeof remigraterc !== 'object') { throw malformedErr; }
  if (typeof remigraterc.db !== 'string') { throw malformedErr; }
}

/**
 * checks that all the required files and directory are present, otherwise
 * throws an AppError with the appropriate message.
 */
function requiredFiles() {
  checkMigrationsDir();
  checkRemigratercFile();
}

/**
 * executes a callback in a context of a connection
 */
function withConnection(cb) {
  r.connect(remigraterc(), function(err, conn) {
    if (err) {
      throw new AppError(err.message);
    }
    return cb(conn);
  });
}

/**
 * returns the ./migrations/remigraterc.js exports
 *
 * @returns {Object } the remigraterc.js exports
 */
function remigraterc() {
  return require(remigratercPath());
}

function ensureTableExists(conn, cb) {
  r.db(remigraterc().db).tableList().run(conn, function(tables) {
    if (tables.indexOf('_remigrate_') >= 0) {
      // yep, it exists - all done
      cb();
      return
    } else {
      // no, create it
      r.db(remigraterc().db).tableCreate('_remigrate_').run(conn, function(err, res) {
        if (err) { throw err; }
        console.dir(res);
      });
    }
  })
}

/**
 * Ensures that the migration table is created and available in the target
 * database.
 *
 * @param {Function} the callback for when its done
 */
function migrationsTable(cb) {
  return withConnection(function(conn) {
    r.dbList().run(conn, function(dbs) {
      if (dbs.indexOf(remigraterc()) >= 0) {
        ensureTableExists(conn, cb);
      } else {
        // doesn't exist - create it
        r.dbCreate(remigraterc().db).run(conn, function(res){
          ensureTableExists(conn, cb);
        });
      }
    });
  });
}

module.exports = {
  migrationsTable: migrationsTable,
  requiredFiles: requiredFiles
};
