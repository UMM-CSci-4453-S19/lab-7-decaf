# Coordinating asynchronous calls through multiple callbacks (v2)

In README.md there is a discussion of coordinating asynchronous calls using a data structure and (implicitly) multiple callback
functions. This is a second version of that
code that breaks things up a bit more in an effort to be a little
clearer about what's doing what, and in particular why we have to
construct a zillion functions along the way.

The initial setup is still the same:

```JavaScript
var credentials = require('./credentials.json');

var mysql=require("mysql");

credentials.host="ids";

var connection = mysql.createConnection(credentials);
var data={};
var processed={}

sql = "SHOW DATABASES";
connection.query(sql,function(err,rows,fields){ //connection.connect() is run automatically for a query
  if (err) {
    console.log('Error looking up databases');
    connection.end();
  } else {
    processDBFs(rows); //Gets called once... so it is safe!
  }
});
```

Now we have a somewhat simplified version of `processDBFs` from the README:

```JavaScript
function processDBFs(dbfs){ // Asynchronous row handler
  console.log("in processDBFs");
  for(var index in dbfs) {
    var dbf = dbfs[index].Database;
    var sql = 'SHOW TABLES IN '+ dbf;
    data[dbf] = Number.POSITIVE_INFINITY; //Exists, but not set.
    var callback = constructTablesCallback(dbf);
    connection.query(sql, callback);
  } // do NOT put a connection.end() here.  It will kill all queued queries.
}
```

The major change here is this uses a new function `constructTablesCallback` (provided below) to construct the 
callback used in the query. In the README version, the callback
function is declared anonymously in the body of `processDBFs`,
which rather clutters things up. Here we call a function
(`constructTablesCallback`) to construct the desired callback
function, which is then passed to the query.

One thing that this helps point out is that we aren't creating
_one_ callback function – we're creating _many_, one for
every database returned by the `SHOW DATABASES` query. And that's
arguably the key point here. If we have only one callback
function, through something like:

```JavaScript
  callback = (err, tables, fields) => {
    console.log('in inner func of processDBFs with dbf = ' + dbf);
    if (err) {
      console.log('Error finding tables in dbf ' + dbf);
      connection.end();
    } else {
      console.log('about to process tables for DB ' + dbf);
      console.log('with tables ' + JSON.stringify(tables));
      processTables(tables, dbf);
    }
  }
```

then that one callback function will have **only one** value of
the variable `dbf`, which will be used by _all_ the calls to that
callback. Because of the evaluation mechanism used by JavaScript,
the one value of `dbf` will in fact be the _last_ database name
we get from `SHOW DATABASES`. This will lead ot all manner of
problems because we'll be trying to attach tables from other
databases to that last database, which will typically fail.

And here's the code that constructs those callbacks:

```JavaScript
function constructTablesCallback(dbf) {
  console.log('in dbf for ' + dbf);
  return function(err,tables, fields) {
    console.log('in inner func of processDBFs with dbf = ' + dbf);
    if (err) {
      console.log('Error finding tables in dbf ' + dbf);
      connection.end();
    } else {
      console.log('about to process tables for DB ' + dbf);
      processTables(tables, dbf);
    }
  }
}
```

This constructs and returns a new function, which "captures" the
variable `dbf` in its scope. Since that has a different value for every call to `constructTablesCallback`, each of those callback
functions will have their own separate value for `dbf`, avoiding
the confusing tangle of crazy we'd get if we had a single 
callback.

We can then do something similar for `processTables()`:

```JavaScript
function processTables(tables, dbf) { // Asynchronous row handler
  data[dbf] = tables.length; // Now it is set.
  processed[dbf] = 0;    // And has not yet been used as a label.
  for(var index in tables){
    var tableObj = tables[index];
    for(key in tableObj) {
      var table = tableObj[key];
      table = dbf+"."+table;
      var sql = 'DESCRIBE '+table;
      var callback = processDescribeCallback(table, dbf);
      connection.query(sql, callback);
    }
  }
}

function processDescribeCallback(table, dbf) {
  return function(err, desc, fields) {
    if (err) {
      console.log('Error describing table '+ table);
    } else {
      processDescription(desc,table,dbf);
    }
  };
}
```

Add in the printing and bookkeeping and we have a complete working
version, using datastructures and careful callback construction 
to handle the asynchrony:

```JavaScript
function processDescription(desc, table, dbf) {
  data[dbf]--; //Processed one table
  if (processed[dbf]==0) {
    processed[dbf] = 1;
    console.log('---|'+dbf+'>');
  }
  console.log('.....|'+dbf+'.'+table+'>');
  desc.map(function(field){ // show the fields nicely
    console.log("\tFieldName: `"+field.Field+"` \t("+field.Type+")");
  });

  if(allZero(data)){connection.end()}
}

function allZero(object){
  allzero = true;
  for(obj in object){
    if(object[obj]!=0){allzero = false}
  }
  return(allzero);
}
```