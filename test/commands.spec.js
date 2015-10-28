'use strict';

var h = require('./helper');
var commands = require('../lib/commands');
var AppError = require('../lib/appError');
var context = require('../lib/context');

var cmdFlags = {
  parent: { database: 'remigratetest'}
};

/* global it describe before after expect*/
describe('commands', function() {
  this.timeout(8000);

  describe('when in a completely empty dir', function() {
    var cleanupDir;

    before(function() {
      cleanupDir = h.inTmpDirWith();
      return h.removeTestDB();
    });

    after(function() {
      cleanupDir();
    });

    ['status', 'up'].map(function(command) {
      describe(command, function() {
        it('with dbinfo, it should fail with missing migration directory', function(done) {
          return commands[command](cmdFlags).should.be.rejectedWith(AppError,/Missing migrations directory/ )
            .notify(done);
        });
        it('without dbInfo, should fail with missing db info', function(done) {
          return commands[command]().should.be.rejectedWith(AppError, /No DB Specified/)
            .notify(done);
        });
      });
    });
  });

  describe('when with an empty migrations dir', function() {
    var cleanupDir;

    before(function() {
      cleanupDir = h.inTmpDirWith([]);
      return h.removeTestDB();
    });

    after(function() {
      cleanupDir();
    });

    ['status', 'up'].map(function(command) {
      describe(command, function() {
        it('without dbInfo, should fail with missing db info', function(done) {
          return commands[command]().should.be.rejectedWith(AppError, /No DB Specified/)
            .notify(done);
        });
      });
    });

    describe('running status', function() {
      before(function() {
        h.resetOutput();
        return commands.status(cmdFlags);
      });

      it ('should return 0 migrations to run', function() {
        expect(context.stdout().value()).to.match(/0 migrations to run/);
      });
    });

    describe('running up', function() {
      before(function() {
        h.resetOutput();
        return commands.up(cmdFlags);
      });

      it ('should return that nothing ran', function() {
        expect(context.stdout().value()).to.match(/0 migrations to run/);
      });
    });
  });

  describe('in a dir with one migration, and no db', function() {
    var cleanupDir;

    before(function() {
      h.resetOutput();
      cleanupDir = h.inTmpDirWith(['createPersons']);
      return h.removeTestDB();
    });

    after(function() {
      cleanupDir();
    });

    describe('after calling "migrate up"', function() {
      before(function() {
        return commands.up(cmdFlags);
      });

      it('should output success', function() {
        expect(context.stdout().value()).to.match(/1 migrations to run/);
        expect(context.stdout().value()).to.match(/running 20150909082314_createPersons\.js\.\.\.\.\.\.done\./);
      });

      it('should have created the persons table', function() {
        return h.expectTableToExist('persons');
      });

      it('should have recorded the migration', function() {
        return h.expectMigrationRecords(['20150909082314_createPersons.js']);
      });

      describe('then running status', function() {

        before(function() {
          return commands.status(cmdFlags);
        });

        it('should have succeeded', function() {
          expect(context.stdout().value()).to.match(/0 migrations to run/);
        });
      });
    });
  });
});
