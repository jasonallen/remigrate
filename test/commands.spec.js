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
  console.log("CWD: " + process.cwd());
  r.connect(util.remigraterc(), function(err1, conn) {
    console.log('err1? ' + err1);
    if (err1) { throw err1; }
    r.db(dbName).tableList().run(conn, function(err2, tables) {
      console.log('err2? ' + err2);
      if (err2) { throw err2; }
      console.log('check3: ' + tables.length);
      if (tables.indexOf(tableName) >= 0) {
        // table exists - empty it out
        console.log('calling table delete');
        r.db(dbName).table(tableName).delete().run(conn, function(err3, info) {
          if (err3) { throw err3; }
          cb();
          return;
        });
      }
      // table doesn't exist - just cb
      console.log('calling cb from inTableContexter');
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
function inDBContext(cb) {
  console.log('inDBContext: setting up');
  var dbName = 'remigratetest';
  var tablename = '_remigrate_';
  // make sure db exists
  console.log("CWD: " + process.cwd());
  var dbInfo = util.remigraterc();
  console.log("CWD1: " + process.cwd());
  r.connect(dbInfo, function(err1, conn) {
    console.log("CWD2: " + process.cwd());
    console.log('ERR? ' + err1);
    if (err1) { throw err1; }
    r.dbList().run(conn, function(err2, dbList) {
      console.log("CWD3: " + process.cwd());
      console.log('ERR2? ' + err2);
      if (err2) { throw err2; }
      if (dbList.indexOf(dbName) >= 0) {
        // db exists, run in table context
        inTableContext(dbName, tablename, cb);
        return;
      }
      console.log('inDBContext: creating db');
      r.dbCreate(util.remigraterc().db).run(conn, function(err3, info) {
        console.log('err3? ' + err3);
        if (err3) { throw err3; }
        // db exists, run in table context
        inTableContext(dbName, tablename, cb);
        return;
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
  console.log('inEmptyDir: chdir-ing to path');
  process.chdir(tmpobj.name);
  cb(function() {
    console.log('inEmptyDir: cleaning up');
    process.chdir(cwd);
    tmpobj.removeCallback();
  });
}

var sampleMigrations = {
  'createPersons': {
    filename: '20150909082314_createPersons',
    contents: '\
    module.exports = { \
      up: function(db, conn) { return db.createTable(\'persons\');}, \
      down: function(db, conn) { return db.tableDrop(\'persons\');}  \
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
    for (var i = 0; i < migrations; i++) {
      var migration = migrations[i];
      var filename = sampleMigrations[migration].filename;
      var contents = sampleMigrations[migration].contents;
      fs.writeFileSync('migrations/' + filename, contents);
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
          inDBContext(function() {
            console.log('calling commandsUp');
            commands.up(function(res) {
              upResult = res;
              idwDone();
              done();
            });
          });
        });
      });

      it('should have succeeded', function() {
        expect(upResult).to.eql('Yay');
      });
    });
  });
});
