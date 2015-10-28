'use strict';

var stdout = process.stdout;
var stderr = process.stderr;
var db = null;
var port = null;

module.exports = {
  setOutput: function(out, err) {
    stdout = out;
    stderr = err;
  },
  stdout: function() { return stdout; },
  stderr: function() { return stderr; },
  setDB: function(dbParam, portParam) {
    db = dbParam;
    port = portParam;
  },
  db: function() { return db; },
  port: function() { return port; },
  dbInfo: function() {
    var info = {
      db: db
    };
    if (port) {
      info.port = port;
    }
    return info;
  }
};
