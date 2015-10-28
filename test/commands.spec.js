'use strict';

var h = require('./helper');
var commands = require('../lib/commands');
var AppError = require('../lib/appError');
var context = require('../lib/context');

var cmdFlags = {
  parent: { database: 'remigratetest'}
};

/* global it describe before after expect beforeEach*/
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

  describe('when in a dir with just a migrations dir', function() {
    var cleanupDir;

    before(function() {
      cleanupDir = h.inTmpDirWith([]);
      return h.removeTestDB();
    });

    after(function() {
      cleanupDir();
    });

    describe('status without a db specified', function() {
      beforeEach(function() {h.resetOutput();});

      it('should throw with <NoDBSpecified>', function(done) {
        commands.status().should.be.rejectedWith(AppError, /No DB Specified/).notify(done);
      });
    });

    describe('status with db specified', function() {
      beforeEach(function() {
        h.resetOutput();
        return commands.status(cmdFlags);
      });
    });

/*
    describe('up', function() {
      it('should fail with missing migration error', function() {
        expect(function() {
          commands.up();
        }).to.throw(AppError, /Cannot read migrations\/remigraterc\.js file/);
      });
    });
*/
  });
/*
  describe('when in a dir with a malformed remigraterc.js file', function() {
    var cleanupDir;

    before(function() {
      cleanupDir = h.inTmpDirWith([]);
      return h.removeTestDB();
    });

    after(function() {
      cleanupDir();
    });

    describe('status', function() {
      it('should fail with malformed remigraterc', function() {
        expect(function() {
          commands.status();
        }).to.throw(AppError, /remigraterc\.js file seems malformed/);
      });
    });

    describe('up', function() {
      it('should fail with malformed remigraterc', function() {
        expect(function() {
          commands.up();
        }).to.throw(AppError, /remigraterc\.js file seems malformed/);
      });
    });
  });
*/
  describe('in a dir with one migration and no db', function() {
    var cleanupDir;

    before(function() {
      cleanupDir = h.inTmpDirWith(['createPersons']);
      return h.removeTestDB();
    });

    after(function() {
      cleanupDir();
    });

/*
    describe('with no db connection params', function() {
      it('status should fail', function() {
        expect(function() {
          commands.status();
        }).to.throw(AppError, /Missing migrations directory/);
      });
    });
*/
    describe('after calling "migrate up"', function() {

      before(function() {
        return commands.up(cmdFlags);
      });

      /*
      it('should have succeeded', function() {
        expect(upResult).to.eql([ '20150909082314_createPersons.js' ]);
      });
      */
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
