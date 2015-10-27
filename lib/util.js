'use strict';
var path = require('path');
var AppError = require('./appError');
var r = require('rethinkdb');
var fs = require('fs');
var Promise = require('bluebird');

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
          if (tables.indexOf(tables) < 0) {
            // doesn't exit - so none!
            return new Promise(function(res) { res([]); });
          }
          // table exists, so fetch items in it
          return r
            .db(remigraterc().db)
            .table(MIGRATIONS_TABLE)
            .run(conn);
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
  cb(filtered);
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
  Promise
    .map(migrations, runMigration, {concurrency: 1})
    .then(function(res) {
      cb(res);
    });
}

module.exports = {
  remigratercPath: remigratercPath,
  remigraterc: remigraterc,
  withConnection: withConnection,
  dbMigrations: dbMigrations,
  fileMigrations: fileMigrations,
  runMigrations: runMigrations,
  MIGRATIONS_TABLE: MIGRATIONS_TABLE
};
