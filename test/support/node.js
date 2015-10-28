'use strict';

var context = require('../../lib/context');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.should();
chai.use(chaiAsPromised);

global.chaiAsPromised = chaiAsPromised;
global.expect = chai.expect;

function fakeStream() {
  var buffer = '';

  return {
    write: function(s) {
      buffer += s;
    },
    reset: function() {
      buffer = '';
    },
    value: buffer
  };
}
context.setOutput(fakeStream(), fakeStream());
