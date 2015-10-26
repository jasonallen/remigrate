'use strict';

var expect = require('chai').expect;
var commands = require('../lib/commands');
var tmp = require('tmp');
var AppError = require('../lib/appError');
var fs = require('fs');
var r = require('rethinkdb');
var util = require('../lib/util');

/**
 * runs a callback in a context with a table emptied (if it exists)
 */
function inTableContext(dbName, tableName, cb) {
  r.connect(util.remigraterc(), function(err1, conn) {
    if (err1) { throw err1; }
    r.db(dbName).tableList().run(conn, function(err2, tables) {
      if (err2) { throw err2; }
      if (tables.indexOf(tableName) >= 0) {
        // table exists - empty it out
        r.db(dbName).table(tableName).delete().run(conn, function(err3, info) {
          if (err3) { throw err3; }
          cb();
          return;
        });
      }
      // table doesn't exist - just cb
      cb();
    });
  });
}

/**
 * runs a callback in a context where the rethinkdb database exists and
 * the table doesn't.
 *
 * @param {String} dbname
 * @param {String} tableName
 * @param {Function} callback to execute in that context
 */
function inDBContext() {
  var dbName = 'remigratetest';
  // make sure db exists
  var dbInfo = util.remigraterc();
  return r
    .connect(dbInfo)
    .then(function(conn) {
      return r.dbDrop(dbName).run(conn)
        .then(function() {
          r.dbCreate(dbName).run(conn);
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
 * executes the cb in a temp dir where a migrations directory exists, and
 * is populated with the array of migrations specified.
 *
 * @param {Array} array of migration names to add
 * @param {Function} callback to executes, with a doneCb param
 */
function inDirWith(migrations, cb) {
  inEmptyDir(function(done) {
    fs.mkdirSync('migrations');
    var remigratercContents = 'module.exports = { db:\'remigratetest\'};';
    fs.writeFileSync('migrations/remigraterc.js', remigratercContents);
    for (var i = 0; i < migrations.length; i++) {
      var migration = migrations[i];
      var filename = './migrations/' + sampleMigrations[migration].filename;
      var contents = sampleMigrations[migration].contents;
      fs.writeFileSync(filename, contents);
    }
    cb(done);
  });
}

/* global it describe before*/
describe('commands', function() {
  this.timeout(5000);

  describe('status', function() {
    it('should fail when no migrations folder', function(done) {
      inEmptyDir(function(iedDone) {
        expect(function() {
          commands.status();
        }).to.throw(AppError, /Missing migrations directory/);
        iedDone();
        done();
      });
    });

    it('should fail with directory, but no remigraterc.js file', function(done) {
      inEmptyDir(function(iedDone) {
        fs.mkdirSync('./migrations');
        expect(function() {
          commands.status();
        }).to.throw(AppError, /Cannot read migrations\/remigraterc\.js file/);
        iedDone();
        done();
      });
    });

    it('should fail with malformed remigraterc.js file', function(done) {
      inEmptyDir(function(iedDone) {
        fs.mkdirSync('./migrations');
        fs.writeFileSync('./migrations/remigraterc.js', '{}');
        expect(function() {
          commands.status();
        }).to.throw(AppError, /remigraterc\.js file seems malformed/);
        iedDone();
        done();
      });
    });

    describe('after a first up migration', function() {
      var upResult;

      before(function(done) {
        inDirWith(['createPersons'], function(idwDone) {
          inDBContext()
            .then(function() {
              commands.up(function(res) {
                upResult = res;
                idwDone();
                done();
              });
            });
        });
      });

      it('should have succeeded', function() {
        expect(upResult).to.eql([ '20150909082314_createPersons.js' ]);
      });
    });

  });

});
