'use strict';

var h = require('./helper');
var expect = require('chai').expect;
var commands = require('../lib/commands');
var AppError = require('../lib/appError');
var fs = require('fs');

/* global it describe before after*/
describe('commands', function() {
  this.timeout(8000);

  describe('status', function() {
    it('should fail when no migrations folder', function(done) {
      h.inEmptyDir(function(iedDone) {
        expect(function() {
          commands.status();
        }).to.throw(AppError, /Missing migrations directory/);
        iedDone();
        done();
      });
    });

    it('should fail with directory, but no remigraterc.js file', function(done) {
      h.inEmptyDir(function(iedDone) {
        fs.mkdirSync('./migrations');
        expect(function() {
          commands.status();
        }).to.throw(AppError, /Cannot read migrations\/remigraterc\.js file/);
        iedDone();
        done();
      });
    });

    it('should fail with malformed remigraterc.js file', function(done) {
      h.inEmptyDir(function(iedDone) {
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
        cleanupDir = h.inTmpDirWith(['createPersons']);
        return h.inDBContext()
          .then(commands.up)
          .then(function(res) {
            upResult = res;
          });
      });

      after(function() {
        cleanupDir();
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
