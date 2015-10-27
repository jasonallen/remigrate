'use strict';

var expect = require('chai').expect;
var commands = require('../lib/commands');
var tmp = require('tmp');
var AppError = require('../lib/appError');
var fs = require('fs');
var r = require('rethinkdb');

/* this is the database testing */
var dbName = 'remigratetest';
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
function expectTableToExist(tableName) {
  return r
    .connect(dbInfo)
    .then(function(conn) {
      return r
        .db(dbName)
        .tableList()
        .run(conn)
        .then(function(tables) {
          expect(tables).to.include(tableName);
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
        .table('_remigrate_')
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


/* global it describe before after*/
describe('commands', function() {
  this.timeout(8000);

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
      var cleanupDir;

      before(function() {
        cleanupDir = inTmpDirWith(['createPersons']);
        return inDBContext()
          .then(commands.up)
          .then(function(res) {
            upResult = res;
            return new Promise(function(res2) { return res2(); });
          });
      });

      after(function() {
        cleanupDir();
      });

      it('should have succeeded', function() {
        expect(upResult).to.eql([ '20150909082314_createPersons.js' ]);
      });

      it('should have created the persons table', function() {
        return expectTableToExist('persons');
      });

      it('should have recorded the migration', function() {
        return expectMigrationRecords(['20150909082314_createPersons.js']);
      });

    });
  });
});
