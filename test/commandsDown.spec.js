'use strict';

var h = require('./helper');
var commands = require('../lib/commands');
var AppError = require('../lib/appError');
var context = require('../lib/context');
var util = require('../lib/util');

/*
var context = require('../lib/context');
*/

var cmdFlags = {
  parent: { database: 'remigratetest'}
};

var noParamCmdFlags = {
  parent: { database: 'remigratetest'}
};

/* global it describe before after expect*/
describe('down command', function() {
  this.timeout(8000);

  describe('with no param', function() {
    var cleanupDir;

    before(function() {
      cleanupDir = h.inTmpDirWith([]);
      return h.removeTestDB();
    });

    after(function() {
      cleanupDir();
    });

    it('should fail with required param error', function(done) {
      return commands.down(noParamCmdFlags).should.be
        .rejectedWith(AppError, /No valid migration specified/).notify(done);
    });
  });


  describe('with a nonexistent migration', function() {
    var cleanupDir;

    before(function() {
      cleanupDir = h.inTmpDirWith([]);
      return h.removeTestDB();
    });

    after(function() {
      cleanupDir();
    });

    it('should fail with bad param error', function(done) {
      return commands.down(cmdFlags).should.be
        .rejectedWith(AppError, /No valid migration specified/).notify(done);
    });
  });

  describe('with a performed migration', function() {
    var cleanupDir;

    before(function() {
      h.resetOutput();
      cleanupDir = h.inTmpDirWith(['createPersons']);
      return h.inDBContext()
        .then(function() { return commands.up(cmdFlags); })
        .then(function() {
          h.resetOutput();
          return commands.down('last', cmdFlags);
        });
    });

    after(function() {
      cleanupDir();
    });

    it('output should indicate success', function() {
      expect(context.stdout().value()).to.match(/running down on 20150909082314_createPersons\.js\.\.\.\.\.\.done/);
    });

    it('persons table should be gone', function(done) {
      expect(util.dbMigrations()).to.eventually.eql([]).notify(done);
    });
  });
});
