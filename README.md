# Lab 7
# Asynchronous node
There are at least 3 ways to deal with the asynchronous issues arising from the intersection of node and mariaDB.  

## Approach One:  Coordinate using a data structure

Consider the fragment below which should look very similar to `show-databases.js` from the last lab:
```{js}
... stuff left out ...
var connection = mysql.createConnection(credentials);
var data={};
var processed={}

sql = "SHOW DATABASES";
connection.query(sql,function(err,rows,fields){ //connection.connect() is run automatically for a query
  if(err){
    console.log('Error looking up databases');
    connection.end();
  } else {
     processDBFs(rows); //Gets called once... so it is safe!
}
});
```
We will use the global variables `data` and `processed` to coordinate our asynchronous database queries.  Both of these variables are hash tables.

We begin the program similarly to what we did in the lat lab by seting up the connection.  The `connection.query()` method sets up the SQL query and passes the anonymous callback function that will either deal with the results of the query (if successful), or deal with the consequences of a failure (if there is an error).  Notice that the anonymous function has three parameters `err`, `rows`, and `fields` which will be filled with values resulting from the interaction with MariaDB.

Our logic is particularly simple-- if there is an error, report it and close the connection.  Otherwise our query has returned an array of objects which we will deal with in the function `processDBFs` (discussed below).

Let's look at how `processDBFs` works: 

```{js}
function processDBFs(dbfs){ // Asynchronous row handler
     for(var index in dbfs){
       var dbf = dbfs[index].Database;
       var sql = 'SHOW TABLES IN '+dbf;
        data[dbf] = Number.POSITIVE_INFINITY; //Exists, but not set.
        connection.query(sql, (function(dbf){
          return function(err,tables,fields){
            if(err){
              console.log('Error finding tables in dbf '+ dbf);
              connection.end();
            } else {
              processTables(tables,dbf);
            }
           };
        })(dbf));
    } // do NOT put a connection.end() here.  It will kill all queued queries.
}
```
The variable `dbfs` is an array of objects containing database names.  The outer `for` loop steps through each in turn.  We use the name of the dbf as a key in the global hash `data`.  Eventually `data` will hold a count of the number of tables in that database, but we don't know how many there are yet, so we store a value of `Number.POSITIVE_INFINITY`.   This reserves space in the data-structure.  IF the rest of the program works as expected, the value will change to an actual integer, but if not, then we can detect that there was a problem.

For each database we want to execute a query of the form `SHOW TABLES IN DBF`.  Setting up this query should look similar to what we did when we were running SHOW DATABASES-- we create a callback function to be executed when the quey is completed.  But there is one very, important difference that makes everything work.  Look closely at what is being done:

```{js}
        connection.query(sql, (function(dbf){
          return function(err,tables,fields){
            #function body
        })(dbf));

```

The callback function is **created** inside `processDBFs`.  This chunk of code:
```{js}
(function(dbf){
          return function(err,tables,fields){
            #function body
        })(dbf)
```
Executes an anonymous function that takes `dbf` as an argument and returns a function, namely the interior function:
```{js}
function(err,tables,fields){
    #function body
}
```

This is important.  The innermost function is defined *inside* the anonymous function and thus **shares its namespace**.  Most importantly... it has a local copy of the value of `dbf`.

**That** function (also anonymous) is the callback given to `connection.query`.  Because of the properties of closures-- the function body will use the proper version of `dbf`.  Without using this technique, your program would find the current value of `dbf` as it exists in `processDBFs`.

In a similar fashion each table can now be processed by a function.  Note the similar **callback construction** approach, and how all the local values are handed off to `processDescription(desc,table,dbf)` for final printing:

```{js}
function processTables(tables,dbf){ // Asynchronous row handler
    data[dbf] = tables.length; // Now it is set.
    processed[dbf] = 0;        // And has not yet been used as a label.
    for(var index in tables){
      var tableObj = tables[index];
      for(key in tableObj){
        var table = tableObj[key];
        table = dbf+"."+table;
        var sql = 'DESCRIBE '+table;
        connection.query(sql, (function(table,dbf){
          return function(err,desc,fields){
            if(err){
              console.log('Error describing table '+ table);
            } else {
              processDescription(desc,table,dbf);
            }
          };
          })(table,dbf));
      }
    }
}
```
Here we finally set the `dbf` entry in `data` to be the number of tables in the database.  And set the `dbf` entry in the global hash `processed` to reflect the fact that we have not yet printed out the DBF line in our desired output.

This is all fine and dandy... but we still need to print out actual results and close the connection when we are done.  This is handled by `processDescription`:

```{js}
function processDescription(desc,table,dbf){
  data[dbf]--; //Processed one table
  if(processed[dbf]==0){
    processed[dbf] = 1
    console.log('---|'+dbf+'>');
  }
  console.log('.....|'+dbf+'.'+table+'>');
  desc.map(function(field){ // show the fields nicely
     console.log("\tFieldName: `"+field.Field+"` \t("+field.Type+")");
  });

  if(allZero(data)){connection.end()}
}
```
This function does all the printing.  It starts by decreases the table count in `dbf` by 1.  Then it checks to see if the database output line has been produced (that's what we use `processed` for).  If not, then the line is printed, and the fact recorded so that the line is not printed twice.

Regardless it prints the description of a table.  The only thing left is to shut down the connection when every table has had its description printed.  The function `allZero` returns `true` if every value in `data` is 0, otherwise it returns `false`:

```{js}
function allZero(object){
  allzero = true;
  for(obj in object){
    if(object[obj]!=0){allzero = false}
  }
  return(allzero);
}
```

## Approach 2: Using Promises

The more I investigate this approach, the more I think it is **the right thing to do**.  So, at the risk of really stretching this material out... let's learn a little bit about honesty and the importance of making promises.  I am basing much of this lecture of Daniel Parker's work in "JavaScript with Promises".  Before getting into the nitty-gritty here's an overview of the JavaScript event loop, as explained by [Philip Robers](https://www.youtube.com/watch?v=8aGhZQkoFbQ) (you will need about half an hour)

### What is a promise

A promise is an object meant to act as a placeholder for some value.  In situations involving asynchronous callback functions, a promise-object allows the asynchronous call to return immediately and provides the programmer (you) the opportunity to register *more* callbacks that will be run when the underlying function ends successfully or generates an error.  HTML5 includes a specification for [EcmaScript](https://en.wikipedia.org/wiki/ECMAScript), which is javaScript (mostly) and has native support for promises.  However, we are going to use the `bluebird` library because it is

* being actively developed
* works on older systems
* has several nice online examples of its use.

Before doing anything, install the node package using `npm install bluebird` in your projects root directory.

A promise can be in one of three states:

1. Pending
2. Fulfilled
3. Rejected

Generally, we are not going to be changing the state of a Promise ourselves, but it helps to know what is happening behind the scenes.  A Promise can change from *Pending* to *Fulfilled* (if successful) or *Rejected* (if there was an error).  A Promise in either of these two states is called *submitted*.  Once submitted a Promise can not change state.

Remember that a Promise is a placeholder for a value-- a value that is the end result of some asynchronous procedure.  We can assign handlers to a Promise to deal with the results of that procedure using the `.then()` method.  We can also use the `.catch()` method to deal with errors.  (If you're being picky, we can use `.then()` to deal with both success and failure).

We can also **chain** promises together using `.then()`.  This allows the programmer to introduce causal steps and deal with dependency issues.  This will make more sense after the examples below.  Try this short one first:

```{js}
Promise=require('bluebird');

var promise= new Promise(function(resolve,reject){
  console.log('Inside resolver function');
  resolve();
});

promise.then(function(){
  console.log('Inside onFulfilled handler');
});

console.log('End of Script');
```

The output of this little program should be as follows:
```
Inside resolver function
End of Script
Inside onFulfilled handler
```

So what is happening?  Bluebird is one of several promise APIs.  Somewhat similar to an `import` command in Java, we load it using `require`:  

```{js}
Promise=require('bluebird');
```

The variable `Promise` exposes all the functionality of the bluebird API (we could have called it whatever we wanted).  
The variable `promise` (notice the lower case p) is created using `new` and a constructor called `Promise()`.  This constructor expect a function that takes two arguments-- `resolve` and `reject`-- both functions in their own right (it's getting kind of meta isn't it?).  We pass the constructor just such an anonymous function:

```{js}
function(resolve,reject){
  console.log('Inside resolver function');
  resolve();
}
```

This function runs immediately (it is a **synchronous** call). And we get our first output line:  `Inside resolver function`.  The two functoral arguments: `resolve` and `reject` are provided by bluebird.  Both are run asynchronously and set up callback functions that will be fired later.  That's what makes this whole thing work.  The `resolve()` method is designed to recursively work back along the chain of handlers (if any) starting at that current Promise.  

Because `resolve()` is asynchronous it immediately returns (and it will return a promise object).  The function `resolve()` is now queued up, and will be run AFTER the main thread of execution is completed (because of the "run until completion motto" enjoyed by javaScript and node.js).   Eventually `resolve()` will attempt to resolve anything *hanging off* that original promise.  At this point however, no handlers have been attached to the promise, and there are no additional promises attached to it.  This is the beauty of making `resolve()` asynchronous-- the rest of the program now has time to assign handlers.

So we get to the next chunk in the code:
```{js}
promise.then(function(){
  console.log('Inside onFulfilled handler');
});
```
This one assigns a handler to the initial promise using `.then()`.  This is our `onFulfilled handler`.  So... we have assigned a callback (which definitely has not yet been run) which will trigger after our initial Promise is fulfilled.

Because the original `resolve()` function is waiting for the current thread of execution to finish it does not get to run yet... it is still waiting in the stack.

Finally we reach `console.log('End of Script')`, and we print out **second** line of output.

Now `resolve()` can run.  Because it had to wait until the end of our current thread of execution before being run, we had time to add things to the original promise.  The method `.resolve()` executes the `onFulfilled` handler, and our third line finally prints.

In general we would set up our initial promise like this:

```{js}
var promise = new Promise(function(resolve, reject) {
  // do a thing, possibly async, then…

  if (/* everything turned out fine */) {
    resolve("Stuff worked!");
  }
  else {
    reject(Error("It broke"));
  }
});
```

The `.then()` method expects either a Promise object or a callback function (more on that down below) as an argument.
### Back to Databases

Let's review our original `showDatabases.js` program:

```{js}
var credentials = require('./credentials.json');

var mysql=require("mysql");

credentials.host="ids"
var connection = mysql.createConnection(credentials);

connection.connect(function(err){
  if(err){
    console.log("Problems with MySQL: "+err);
  } else {
    console.log("Connected to Database.");
  }
});

connection.query('SHOW DATABASES',function(err,rows,fields){
  if(err){
    console.log('Error looking up databases');
  } else {
    console.log('Returned values were ',rows);
}
});
connection.end()
console.log("All done now.");
```

We are going to start by modifying this example to make use `connection.pool()`s.  The reason we are doing this is three-fold:

1. Most examples use this (and we would like to steal other people's good ideas when possible).
2. This approach will scale better to larger projects that might require multiple concurrent connections.
3. Creating a new connection helps insulate the user from fragile connections (connections can break)

```{js}
var credentials = require('./credentials.json');
var mysql=require("mysql");
credentials.host="ids"
var pool=mysql.createPool(credentials)
pool.getConnection(function(err,conn){
  if(!err){
      conn.query('SHOW DATABASES',function(err,rows,fields){
          if(err){
            console.log('Error looking up databases');
          } else {
            console.log('Returned values were ',rows);
          }
          conn.release()
          pool.end()
        });
  } else{
      console.log('Error making connection')
  }
});
console.log("All done now.");
```

Notice that we are using `.release()` and `pool.end()`.

In our example, this is major over-kill and something of a waste of time since it makes the code harder to read.  However... if we removed the `pool.end()`.  We could wrap most of our active-code in a function and have a comletely self-contained `sql` function.  We would **still** have to deal with the difficulties of asynchronous callbacks... but things would run very quickly indeed.

** Bringing in Promises**

Now we're going to add in promises.  There are some new ideas floating around in this next example, so be sure to type up the next example before continuing:

```{js}
var credentials = require('./credentials.json');

var mysql=require("mysql");
var Promise = require('bluebird');
var using = Promise.using;
Promise.promisifyAll(require("mysql/lib/Connection").prototype);
Promise.promisifyAll(require("mysql/lib/Pool").prototype);

credentials.host="ids"
var pool=mysql.createPool(credentials); //Setup the pool using our credentials.

var getConnection=function(){
    return pool.getConnectionAsync().disposer(
        function(connection){return connection.release();}
          );
};

var query=function(command){
    return using(getConnection(),function(connection){
       return connection.queryAsync(command);
    });
};


sql="SHOW DATABASES"
var result=query(mysql.format(sql)) //result is a promise
result.then(function(dbfs,err){console.log(dbfs)}).then(function(){pool.end()});
```

The first *weird* thing in the code up above is (somewhat abridged) some of the *Promise* parts:

```{js}
var Promise = require('bluebird');
Promise.promisifyAll(require("mysql/lib/Connection").prototype);
Promise.promisifyAll(require("mysql/lib/Pool").prototype);
```

The first line is clear:  We are using the promise library known as `bluebird`. The next two lines are a bit mysterious.  We will examine them in more detail later.  The important thing is that these lines *wrap* the original methods from mysql in functions that return Promises.  The function `promisify` converts callback-style APIs to use promises.  You can read up on it [at the bluebird documention](https://github.com/petkaantonov/bluebird/blob/master/API.md#promisification).  The key thing is that a new version of the function is made that now ends with the word `Async`.  Hence the `mysql` method `query` is now called `queryAsync` and returns a promise instead of its results.

**Connection Pools and Promises**

Things are a bit nicer now:
```{js}
var pool=mysql.createPool(credentials); //Setup the pool using our credentials.

var getConnection=function(){
    return pool.getConnectionAsync().disposer(
        function(connection){return connection.release();}
          );
};
```

The `.disposer()` method is part of `bluebird`.  It is guaranteed to run after the promise returned by `.getConnectionAsync()` is resolved.... so what we're doing is over-writing the `getConnection` function with one of our own.  The [blue bird documentation on Resource Management](https://github.com/petkaantonov/bluebird/blob/master/API.md#resource-management) is informative  Be sure to read the entire resource Management section before continuing.  

Now look at where `getConnection()` is being used:

```{js}
var query=function(command){
    return using(getConnection(),function(connection){
       return connection.queryAsync(command);
    });
};
```

The `query()` method is using `using` (which is discussed in that last link I provided).  This method will ensure that the anonymous function passed as the second argument can use the same name space as the promise returned by `getConnection()`.  It also ensures that the `.disposer()` method for `.getConnection()` isn't called until after `.queryAsync()` (which is a promise) is resolved.  

We are finally in a position to understand the *meat of the function*:

```{js}
var result=query(mysql.format(sql)) //result is a promise
result.then(function(dbfs,err){console.log(dbfs)}).then(function(){pool.end()});
```

So, the `query()` function returns a promise that is not completely resolved until the query it contains is executed.
We use `.then()` to process the results of those queries, and then another `.then()` chained off the back, that closes down the pool of connections.

**Making things a bit cleaner**

I would like to clean things up a bit to show how much more readable Promises can make our code.

First, create a file called `dbf-setup.js` and make certain it is in the same directory as your `credentials.json` file.  Here is what `dbf-setup.js` should contain:

```{js}
var credentials = require('./credentials.json');

var mysql=require("mysql");
var Promise = require('bluebird');
var using = Promise.using;
Promise.promisifyAll(require("mysql/lib/Connection").prototype);
Promise.promisifyAll(require("mysql/lib/Pool").prototype);

credentials.host="ids"
var connection = mysql.createConnection(credentials);

var pool=mysql.createPool(credentials); //Setup the pool using our credentials.

var getConnection=function(){
  return pool.getConnectionAsync().disposer(
    function(connection){return connection.release();}
  );
};
var query=function(command){ //SQL comes in and a promise comes out.
  return using(getConnection(),function(connection){
    return connection.queryAsync(command);
  });
};

var endPool=function(){
   pool.end(function(err){});
}

exports.query = query;
exports.releaseDBF=endPool;
```

We are defining a module.  Node.js allows you to use the `require` function to import information from another file, and the `exports.`*function_name*=*function*The only new material is at the end.  It is how we export functions.  

With that functionality wrapped up in a module the remaining code necessary to implement "SHOW DATABASES" is fairly short.  I have added TWO complications in preparation for the final version of the program however, so read carefully:

```{js}
mysql=require('mysql');
dbf=require('./dbf-setup.js');

var getDatabases=function(){//Returns a promise that can take a handler ready to process the results
  var sql = "SHOW DATABASES";
  return dbf.query(mysql.format(sql)); //Return a promise
}

var processDBFs=function(queryResults){
   dbfs=queryResults;
   return(dbfs);
}

dbf=getDatabases()
.then(processDBFs)
.then(function(results){console.log(results)})
.then(dbf.releaseDBF);
```

It is a waste to do so little work in `processDBFS`, but I wanted to point out something very important.  Each `.then()` method is returning a Promise, and by putting the `.then()`'s in order we are forcing the callback to be executed in our desired order.  The key thing to notice lives here:

```{js}
.then(processDBFs)
.then(function(results){console.log(results)})
```

Notice that the function `processDBFs` is returning an array of JavaScript objects-- one for each database.  Which function is processing those results?  That would be the anonymous function in the next line: `function(results){console.log(results)}`.

So the `.then()` methods form a chain of promises and these promises induce a chain of callback functions that hand their results off to each-other in the proper order.  This is one of the **secrets** to making it all work out.

Another secret is using the `.all()` method (I typically call it using the object attached to the blubird module.  In my case this looks like:  `Promise.all(myArrayOfPromises)`.

For this solution we are going to take advantage of **[prepared statements ](http://www.w3resource.com/node.js/nodejs-mysql.php#prepared-statements)** to make our code even more compact.

Here is my solution involving Promises and prepared statements.  My Promise-Fu is still quite weak, so there are, undoubtedly, ways to do this even more cleanly:

```{js}
Promise=require('bluebird')
mysql=require('mysql');
DBF=require('./dbf-setup.js');

var getDatabases=function(){//Returns a promise that can take a handler ready to process the results
  var sql = "SHOW DATABASES";
  return DBF.query(mysql.format(sql)); //Return a promise
}

var processDBFs=function(queryResults){ //Returns a promise that forces ALL dbfPromises to resolve before .thening()
   var dbfs=queryResults;
   return(Promise.all(dbfs.map(dbfToPromise)).then(processTables))
}

var processTables=function(results){ //Returns a promise that forces ALL table description Promises to resolve before .thening()
  var descriptionPromises=results.map(tableAndDbfToPromise);
  var allTables=Promise.all(descriptionPromises).then(function(results){return(results)});
  return(allTables);
}

//Takes an object (as returned by showDatabases) and returns a promise that resolves 
// to an array of objects containing table names for the dbf in dbfObj
var dbfToPromise=function(dbfObj){ 
  var dbf=dbfObj.Database
  var sql = mysql.format("SHOW TABLES IN ??",dbf);
  var queryPromise=DBF.query(sql)
  queryPromise=queryPromise.then(function(results){return({table:results,dbf:dbf})});
  return(queryPromise);
}

//Takes an object (as returned by showDatabases) and returns a promise that resolves 
// to an array of objects containing table descriptions.  
// This function creates helper functions:
//     describeTable()
//  which contains its own helper function printer(), for writing the output to console
var tableAndDbfToPromise=function(obj){
   var dbf=obj.dbf;
   var tableObj=obj.table;
   var key = "Tables_in_"+dbf;

   var tables=tableObj.map(function(val){return(val[key])})

   var describeTable=function(val,index){
       var table=dbf+"."+val;
       var printer=function(results){
          var desc=results;
          if(index==0){console.log("---|",dbf,">")};
          console.log(".....|"+table,">");
          desc.map(function(field){ // show the fields nicely
             console.log("\tFieldName: `"+field.Field+"` \t("+field.Type+")");
          })
       }

       var describeSQL=mysql.format("DESCRIBE ??",table);
       var promise=DBF.query(describeSQL).then(printer);
       return(promise);
   }
   var describePromises = tables.map(describeTable);
   return(Promise.all(describePromises))
}

var dbf=getDatabases()
.then(processDBFs)
.then(DBF.releaseDBF)
.catch(function(err){console.log("DANGER:",err)});
```

If people are interested, I'll add more explaining each step in turn:

### Now a bit more about promises in general.

Start by reading this:  [Alex Perry's blog entry on promises in node](http://alexperry.io/node/2015/03/25/promises-in-node.html).

Here is a short writeup on using promises with node and mySQL (which will work just fine with mariaDB)

<https://medium.com/@alpercitak/node-js-with-mysql-a43c49bbafd3>

<https://lestersy.io/2015/2/22/Callback-Hell,-Async,-and-Promises>

# angular

Out goal in this lab is produce a web-page that interacts with our database.  The webpage will act as our Point of Sales (POS).  We will call it the **till**.  The till needs to be able to do the following:

* Be locked until a user logs in
   * record the log-in and log-out time
   * Allow logging out
* Have a collection of buttons for items
   * When an item-button is pushed it (or a collection of items) should appear in a list
* The location of the buttons and their contents should be completely configurable
* The prices of items should reflect the values in the database
* Every transaction should be recorded
* Items in the list should be able to be selected and removed
* There should be a procedure that appends all the individual tills into a single permanent record and generates end of day statistics
* There should be a query that determihes
   * amount of time each employee was logged in
   * Statistics for length of transactions
   * Statistics for size of transactions.

# Working our Way up to it

Instead of diving head-first into the problem we will start simply and work our way up to something more complicated.

Start by creating a table called 'users'.  You can pick pretty much whatever structure you would like.  We will be adding complications to it in short order

We will start by using a node.js package known as `express.js` to create a very simple web server for our web pages:

```{js}
var express=require('express'),
app = express(),
port = process.env.PORT || 1337;

app.use(express.static(__dirname + '/public'));
app.listen(port);
```

The web-server is expecting our HTML files to be in the 'public" sub directory.

Using the 'public' sub-directory for your files, do this tutorial:
<http://www.revillweb.com/tutorials/angularjs-in-30-minutes-angularjs-tutorial/>

At a bare mininum your group should now have
* The web-server `express.js` in the root directory of your repository
* A subdirectory named `public`
   * `index.html` (perhaps various files for different sections of the tutorial:  the content)
   * `app.js` (for holding the angular code that orchestrates the data-binding:  the model)
   * `main.ctrl.js` (holds the angular code that orchestrates appearance: the view)

Together these three files exemplify the MVC philosophy:  

* model
* view
* content

The idea is to separate differing concerns into differing files.  More information is available on [wiki](https://en.wikipedia.org/wiki/Model%E2%80%93view%E2%80%93controller)

## Complicating the web server

Now that you have a reasonable idea of how angular.js allows you to turn your index.html template into a full-fledged web-page, we are going to complicate matters slightly by interacting with the database.

The key idea here is that we are going to add a mechanism allowing our server to act as an intermediary between the web page and the database.  To this end we shall complicate our web server:  **most** of the time it will serve files from the `public` directory (this is where our angular files live), but, if we ask for the proper URL, it will also serve data that allows the cash register or the database to be updated. We could certainly saperate the web-page server from the data-server, however, ports are at a premium in the dungeon, its easier to manage **one** server rather than two, the individual requests are light enough that we don't need to worry about using two servers to improve our performance, and we remove the possibilities of any problematic cross-site scripting security getting in our way.

As a first step lets expand our web server to provide files from the 'public' sub-directory, unless the requested URL look like '/buttons', in which case we will politely ask if the reader would like some buttons.

```
var express=require('express'),
app = express(),
port = process.env.PORT || 1337;

app.use(express.static(__dirname + '/public'));
app.get("/buttons",function(req,res){
  res.send("Hello World!  May I interest you in some... <em>buttons</em>?");
});

app.listen(port);
```
The 'express' package makes things easy.  Your directives are applied in the order you indicate them.  The `app.use()` method is using one of express' handlers:  `express.static` looks in the specified directory for files, and provides them if it finds them.

Since there is no 'buttons' subdirectory in 'public' express applies the next rule.

## Mixing in a little database

Now we are going to create a table called `till_buttons`.  The purpose of this table is to hold the data necessary to produce buttons that look like this:

```
<div style="position:absolute;left:320px;top:100px"><button id="1" >food</button></div>
```

In the example below I've replaced explicit values with expressions of the form '#stuff#' 

```
<div style="position:absolute;left:#LEFT#px;top:#TOP#px"><button id="#BUTTON_ID#" >#LABEL#</button></div>
```

**Exercise:**  Create a table that can hold this information.  Feel free to augment the table with a few extra fields to give yourself more control over the size, etc.

I'll provide the angular code necessary to make the buttons appear on the client side in the `first_buttons` subdirectory.  Your job is to
**Exercise:**  Modify the server code so that `/buttons` will return a JSON object that contains the results of querying your `till_buttons` table.  Note:  You may need to modify the files I provide to match the fields that you chose for your database.

## Adding a little bit of functionality

What you are doing, as you modify the web server is implementing a REST service using node.js.

This 19 minutes video:  <http://www.restapitutorial.com/lessons/whatisrest.html> is a decent introduction to the idea.  There will be some terminology that might be new to you (like SOAP).  You can safely ignore them.  If you look at the contents of `buttons.js` you will notice that I am using the HTTP `get` verb.  

# To Do
