# Lab 7
This it the **prelminary** version.  It will be fleshed out more as the next week and a half progresses.

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



