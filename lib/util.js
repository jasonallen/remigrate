'use strict';
var path = require('path');
var AppError = require('./appError');
var r = require('rethinkdb');

/**
 * returns the path to ./migrations/remigraterc.js
 *
 * @returns {String} path to ./migratinos/remigraterc.js
 */
function remigratercPath() {
  console.log('cwd a2: ' + process.cwd())
  return [process.cwd(), '.', 'migrations', 'remigraterc'].join(path.sep);
}

/**
 * returns the ./migrations/remigraterc.js exports
 *
 * @returns {Object } the remigraterc.js exports
 */
function remigraterc() {
  console.log('cwd a1: ' + process.cwd())
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
 * returns the migrations that have been run (e.g. that are in the db)
 */
function dbMigrations(cb) {
  withConnection(function(conn) {
    console.log('about to blow up?');
    r.db(remigraterc().db).tableList().run(conn, function(err1, tables) {
      if (err1) { throw err1; }
      console.dir(tables);
      if (tables.indexOf(tables) < 0) {
        // doesn't exit - so none!
        cb([]);
        return;
      }
      r.db(remigraterc().db).table(MIGRATIONS_TABLE).run(conn, function(err, items) {
        if (err) { throw err; }
        console.log('ITEMS');
        console.dir(items);
        cb(items);
        conn.close();
      });


    });
  });
}

module.exports = {
  remigratercPath: remigratercPath,
  remigraterc: remigraterc,
  withConnection: withConnection,
  dbMigrations: dbMigrations,
  MIGRATIONS_TABLE: MIGRATIONS_TABLE
};
