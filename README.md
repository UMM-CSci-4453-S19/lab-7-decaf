# Lab 7
# Asynchronous node
There are at least 3 ways to deal with the asynchronous issues arising from the intersection of node and mariaDB.  
##Approach One:  Coordinate using a data structure
Consider the fragment below which should look very similar to `show-databases.js` from the lat lab:
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
The two big changes are the global variables `data` and `processed` (both hashes).

We set the connection up, same as before, but now we call another function to process each row.

Let's look at some of that:
```{js}
function processDBFs(dbfs){ // Asyncronous row handler
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
This solution uses the hash `data`, creating a key for every database and storing a value of `Number.POSITIVE_INFINITY`. It then sets up the callback function that should be run for each `SHOW TABLES IN ...` query.  Look closely at what is being done:

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
Executes an anonymous function that takes `dbf` as an argument.  The interior function:
```{js}
function(err,tables,fields){
    #function body
}
```
is defined inside the anonymous function and thus **shares its namespace**.  Most importantly... it has a local copy of the value of `dbf`.

**That** function (also anonymous) is the callback given to `connection.query`.  Because of the properties of closures-- the function body will use the proper version of `dbf`.

In a similar fashion each table can be processed by a function.  Note the similar **callback construction** approach, and how all the local values are handed off to `processDescription(desc,table,dbf)` for final printing:

```{js}
function processTables(tables,dbf){ // Asyncronous row handler
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

This is all fine and dandy... but how do we know when to close the connection?

```{js}
function processDescription(desc,table,dbf){
  data[dbf]--; //Processed one table
  if(processed[dbf]==0){
    processed[dbf] = 1
    console.log('---|'+dbf+'>');
  }
  console.log('.....|'+table+'>');
  console.log(desc);
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

##Approach 2: Using Promises

Start by reading this:  [Alex Perry's blog entry on promises in node](http://alexperry.io/node/2015/03/25/promises-in-node.html).

Here is a short writeup on using promises with node and mySQL (which will work just fine with mariaDB)

<https://medium.com/@alpercitak/node-js-with-mysql-a43c49bbafd3>

For this solution we are going to mix things up a bit and create a `connectionPool` so that each interaction has its own connection.

We are also going to take advantage of **[prepared statements ](http://www.w3resource.com/node.js/nodejs-mysql.php#prepared-statements)** to make our code even more compact.

**CURRENTLY UPDATING**

<https://lestersy.io/2015/2/22/Callback-Hell,-Async,-and-Promises>

##Approach 3: Use of async


# angular

Out goal in this lab is produce a web-page that interacts with our database.  The webpage will act as our Point of Sales (POS).  We will call it the **till**.  The till needs to be able to do the following:

* Be locked until a user logs in
   * record the log in and log out time
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

#Working our Way up to it

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

The web-server is expecting out HTML files to be in the 'public" sub directory.

in the 'public' sub-directory, do this tutorial:
<http://www.revillweb.com/tutorials/angularjs-in-30-minutes-angularjs-tutorial/>

At a bare mininum your group should now have
* The web-server `express.js` in the root directory of your project
* A subdiretory named `public`
   * `index.html` (perhaps various files for different sections of the tutorial:  the content)
   * `app.js` (for holding the angular code that orchestrates the data-binding:  the model)
   * `main.ctrl.js` (holds the angular code that orchestrates appearance: the view)

Together these three files exemplify the MVC philosophy:  

* model
* view
* content

The idea is to seperate differing concerns into differing files.  More information is available on [wiki](https://en.wikipedia.org/wiki/Model%E2%80%93view%E2%80%93controller)

##Complicating the web server

Now that you have a reasonable idea of how angular.js allows you to turn your index.html template into a full-fledged web-page, we are going to complicate matters slightly by interacting with the database.

The key idea here is that we are going to add a mechanism allowing our server to act as an intermediary between the web page and the database.  To this end we shall complicate our web server:  **most** of the time it will serve files from the `public` directory (this is where our angular files live), but, if we ask for the proper URL, it will also serve data that allows the cash register or the database to be updated. We could certainly seperate the web-page server from the data-server, however, ports are at a premium in the dungeon, its easier to manage **one** server rather than two, the individual requests are light enough that we don't need to worry about using two servers to improve our performance, and we remove the possibilities of any problematic cross-site scripting security getting in our way.

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

##Mixing in a little database

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

##Adding a little bit of functionality

What you are doing, as you modify the web server is implementing a REST service using node.js.

This 19 minutes video:  <http://www.restapitutorial.com/lessons/whatisrest.html> is a decent introduction to the idea.  There will be some terminology that might be new to you (like SOAP).  You can safely ignore them.  If you look at the contents of `buttons.js` you will notice that I am using the HTTP `get` verb.  



