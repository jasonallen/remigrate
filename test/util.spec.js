'use strict';

var h = require('./helper');
var util = require('../lib/util');

/* global it describe before expect*/
describe('util', function() {
  this.timeout(8000);

  describe('dbMigrations', function() {

    describe('with no DB', function() {

      before(function() {
        h.setTestDBContext();
        return h.removeTestDB();
      });

      it ('should return none', function(done) {
        expect(util.dbMigrations()).to.eventually.eql([]).notify(done);
      });
    });
  });
});
