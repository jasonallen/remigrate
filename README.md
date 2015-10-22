## Remigrate

A rails-inspired node.js migration tool written and framework for [RethinkDB](http://rethinkdb.com). Migrations are a convenient way to alter your database schema over time in a consistent and easy way.

### Installation

```
npm install -g remigrate
```

### Usage

Your first step is to configure remigrate. To do this you need to create a .remigraterc.js file in your migrations folder. This file must export the configuration remigrate will use to connect to RethinkDB. Example:

```
mkdir migrations
echo "export {db:'mytestdb'}" > migrations/.remigraterc.js
```

Create your first migration.

```
remigrate generate createPersonTable
```

...this will create a file called '20150901081428_createPersonTable.js' (the numbers will be different!) in your migrations folder. The numbers are a date format (YYYYMMDDHHMMSS) - that's there to ensure your migrations have a natural sort order, even across teams.

Now edit the file so it contains this code:

```
var r = require('rethinkdb');

export {
  up: function(db, conn) {
    return db.tableCreate('person').run(conn);
  },
  down: function(rethinkconfig) {
    return db.tableDrop('person').run(conn);
  }
};
```

Now you are ready to run your migration:

```
remigrate up
```

If you don't see any errors, then your RethinkDB is migrated up. You can rollback by running:

```
remigrate down
```

### Contributing

Use github for issues, PRs preferred.
