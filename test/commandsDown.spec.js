'use strict';

var h = require('./helper');
var commands = require('../lib/commands');
var AppError = require('../lib/appError');
/*
var context = require('../lib/context');
*/

/*
var cmdFlags = {
  parent: { database: 'remigratetest'}
};
*/

var noParamCmdFlags = {
  parent: { database: 'remigratetest'}
};

/* global it describe before after*/
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
      return commands.down(noParamCmdFlags).should.be
        .rejectedWith(AppError, /No valid migration specified/).notify(done);
    });
  });

});
