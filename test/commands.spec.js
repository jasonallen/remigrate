'use strict';

var expect = require('chai').expect;
var commands = require('../lib/commands');
var tmp = require('tmp');
var AppError = require('../lib/appError');
var fs = require('fs');

/**
 * inEmptyDir() runs a callback while chdir'ed into
 * an empty tmp dir. It will clean up after itself,
 * when the cb is done running.
 *
 * @param {Function} cb
 */
function inEmptyDir(cb) {
  var cwd = process.cwd();
  tmp.dir(function _tempDirCreated(err, path, cleanupCallback) {
    if (err) { throw err; }
    process.chdir(path);
    cb();
    process.chdir(cwd);
    cleanupCallback();
  });
}

/* global it describe */
describe('commands', function() {
  describe('status', function() {
    it('should fail when no migrations folder', function(done) {
      inEmptyDir(function() {
        expect(function() {
          commands.status();
        }).to.throw(AppError, /Missing migrations directory/);
        done();
      });
    });

    it('should fail with directory, but no remigraterc.js file', function(done) {
      inEmptyDir(function() {
        fs.mkdirSync('./migrations');
        expect(function() {
          commands.status();
        }).to.throw(AppError, /Cannot read migrations\/remigraterc\.js file/);
        done();
      });
    });

    it('should fail with malformed remigraterc.js file', function(done) {
      inEmptyDir(function() {
        fs.mkdirSync('./migrations');
        fs.writeFileSync('./migrations/remigraterc.js', '{}');
        expect(function() {
          commands.status();
        }).to.throw(AppError, /remigraterc\.js file seems malformed/);
        done();
      });
    });
  });
});
