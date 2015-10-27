'use strict';

var h = require('./helper');
var expect = require('chai').expect;
var commands = require('../lib/commands');
var AppError = require('../lib/appError');
var fs = require('fs');

/* global it describe before after*/
describe('commands', function() {
  this.timeout(8000);

  describe('when in a completely empty dir and no DB', function() {
    var cleanupDir;

    before(function() {
      cleanupDir = h.inTmpDirWith();
      return h.removeTestDB();
    });

    after(function() {
      cleanupDir();
    });

    describe('status', function() {
      it('should fail with missing migration error', function() {
        expect(function() {
          commands.status();
        }).to.throw(AppError, /Missing migrations directory/);
      });
    });

    describe('up', function() {
      it('should fail with missing migration error', function() {
        expect(function() {
          commands.up();
        }).to.throw(AppError, /Missing migrations directory/);
      });
    });
  });

  describe('when in a dir with migrations dir, but no remigraterc.js file', function() {
    var cleanupDir;

    before(function() {
      cleanupDir = h.inTmpDirWith([]);
      // delete the remigraterc
      fs.unlinkSync('./migrations/remigraterc.js');
      return h.removeTestDB();
    });

    after(function() {
      cleanupDir();
    });

    describe('status', function() {
      it('should fail with missing migration error', function() {
        expect(function() {
          commands.status();
        }).to.throw(AppError, /Cannot read migrations\/remigraterc\.js file/);
      });
    });

    describe('up', function() {
      it('should fail with missing migration error', function() {
        expect(function() {
          commands.up();
        }).to.throw(AppError, /Cannot read migrations\/remigraterc\.js file/);
      });
    });
  });

  describe('when in a dir with a malformed remigraterc.js file', function() {
    var cleanupDir;

    before(function() {
      cleanupDir = h.inTmpDirWith([]);
      // corrupt the remigraterc
      fs.writeFileSync('./migrations/remigraterc.js', '{}');
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

  describe('in a dir with one migration and no db', function() {
    var cleanupDir;

    before(function() {
      cleanupDir = h.inTmpDirWith(['createPersons']);
      return h.removeTestDB();
    });

    after(function() {
      cleanupDir();
    });

      describe('after calling \'migrate up\'', function() {
        var upResult;

        before(function() {
          return commands.up()
            .then(function(res) {
              upResult = res;
            });
        });

        it('should have succeeded', function() {
          expect(upResult).to.eql([ '20150909082314_createPersons.js' ]);
        });

        it('should have created the persons table', function() {
          return h.expectTableToExist('persons');
        });

        it('should have recorded the migration', function() {
          return h.expectMigrationRecords(['20150909082314_createPersons.js']);
        });

        describe('running status', function() {
          var statusResult;

          before(function() {
            return commands.status().then(function(res) { statusResult = res; });
          });

          it('should have succeeded', function() {
            expect(statusResult).to.eql([]);
          });
        });
      });
  });
});
