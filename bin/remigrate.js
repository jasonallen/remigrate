#!/usr/bin/env node
var program = require('commander');
var commands = require('../lib/wrappedCommands');

program
  .version('0.0.1')
  .option('-d, --database <dbname>', 'database name')
  .option('-p, --port <portnumber>', 'port number');

program
  .command('generate [name]')
  .description('generates a new migration')
  .action(commands.generate);

program
  .command('up')
  .description('migrates up to the latest migration')
  .action(commands.up);

program
  .command('down [migration]')
  .description('migrates down the last migration')
  .action(commands.down);

program
  .command('status')
  .description('returns the current migration status')
  .action(commands.status);

program.parse(process.argv);

// Check the program.args obj
var NO_COMMAND_SPECIFIED = program.args.length === 0;

// Handle it however you like
if (NO_COMMAND_SPECIFIED) {
  // e.g. display usage
  program.help();
}
