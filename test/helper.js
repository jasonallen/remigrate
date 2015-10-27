'use strict';

var expect = require('chai').expect;
var tmp = require('tmp');
var fs = require('fs');
var r = require('rethinkdb');

/* this is the database testing */
var dbName = 'remigratetest';
var tableName = '_remigrate_';
var dbInfo = { db: dbName };

/**
 * runs a callback in a context where the rethinkdb database exists and
 * the table doesn't.
 *
 * @param {String} dbname
 * @param {String} tableName
 * @param {Function} callback to execute in that context
 */
function inDBContext() {
  // make sure db exists
  return r
    .connect(dbInfo)
    .then(function(conn) {
      return r
        .dbList()
        .run(conn)
        .then(function(dbs) {
          if (dbs.indexOf(dbName) < 0) {
            // doesnt exist - we're done
            return new Promise(function(res) { res(); });
          }
          return r.dbDrop(dbName).run(conn)
            .then(function() {
              r.dbCreate(dbName).run(conn);
          });

        });
    });
}

/**
 * inEmptyDir() runs a callback while chdir'ed into
 * an empty tmp dir. It will clean up after itself,
 * when the cb is done running.
 *
 * @param {Function} cb that gets passed a 'done' callback param
 */
function inEmptyDir(cb) {
  var cwd = process.cwd();
  var tmpobj = tmp.dirSync({unsafeCleanup: true});
  process.chdir(tmpobj.name);
  cb(function() {
    process.chdir(cwd);
    tmpobj.removeCallback();
  });
}

/**
 * this is a list of canned migrations to be used in tests
 */
var sampleMigrations = {
  'createPersons': {
    filename: '20150909082314_createPersons.js',
    contents: '\
    module.exports = { \
      up: function(db, conn) { return db.tableCreate(\'persons\').run(conn);}, \
      down: function(db, conn) { return db.tableDrop(\'persons\').run(conn);}  \
    }; '
  }
};

/**
 * handy reusable function that asserts a given table exists
 *
 * @param {String} table name to check for
 * @return {Promise}
 */
function expectTableToExist(name) {
  return r
    .connect(dbInfo)
    .then(function(conn) {
      return r
        .db(dbName)
        .tableList()
        .run(conn)
        .then(function(tables) {
          expect(tables).to.include(name);
        });
    });
}

/**
 * handy function to
 */
function expectMigrationRecords(migrations) {
  return r
    .connect(dbInfo)
    .then(function(conn) {
      return r
        .db(dbName)
        .table(tableName)
        .run(conn)
        .then(function(cursor) {
          return cursor
            .toArray()
            .then(function(records) {
              var byName = records.map(function(item) {return item.name;});
              expect(byName).to.eql(migrations);
              return new Promise(function(res) { res(); });
            });
        });
    });
}

/**
 * changes working directory to a tmp dir with the specified migrations
 * in a ./migrations dir. Returns a function that will restore the cwd
 * to previous state, and delete the tmp dir, even if its not empty
 *
 * @param {Array} array of migrations (see sampleMigrations above)
 *
 * @return {Function} cleanup Function
 */
function inTmpDirWith(migrations) {
  var cwd = process.cwd();
  var tmpobj = tmp.dirSync({unsafeCleanup: true});
  process.chdir(tmpobj.name);
  fs.mkdirSync('migrations');
  var remigratercContents = 'module.exports = { db:\'remigratetest\'};';
  fs.writeFileSync('migrations/remigraterc.js', remigratercContents);
  for (var i = 0; i < migrations.length; i++) {
    var migration = migrations[i];
    var filename = './migrations/' + sampleMigrations[migration].filename;
    var contents = sampleMigrations[migration].contents;
    fs.writeFileSync(filename, contents);
  }
  return function() {
    process.chdir(cwd);
    tmpobj.removeCallback();
  };
}

module.exports = {
  inTmpDirWith: inTmpDirWith,
  expectMigrationRecords: expectMigrationRecords,
  expectTableToExist: expectTableToExist,
  inEmptyDir: inEmptyDir,
  inDBContext: inDBContext
};
