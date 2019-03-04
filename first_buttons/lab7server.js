var credentials = require('../credentials.json');
var mysql=require("mysql");
credentials.host="ids";
var pool=mysql.createPool(credentials);

var get_till = pool.getConnection(function(err,conn){
  if(!err){
      conn.query('Select * from jafi.till_buttons',function(err,rows,fields){
          if(err){
            console.log('Error looking up databases');
          } else {
            console.log(rows);
          }
          conn.release()
          pool.end()
        });
  } else{
      console.log('Error making connection')
  }
});


var express=require('express'),
app = express(),
port = process.env.PORT || 1337;

var buttons=[{"buttonID":1,"left":10,"top":70,"width":100,"label":"hotdogs","invID":1},
{"buttonID":2,"left":110,"top":70,"width":100,"label":"hambugers","invID":2},
{"buttonID":3,"left":210,"top":70,"width":100,"label":"bannanas","invID":3},
{"buttonID":4,"left":10,"top":120,"width":100,"label":"milkduds","invID":4}]; //static buttons

app.use(express.static(__dirname + '/public')); //Serves the web pages
app.get("/buttons",function(req,res){ // handles the /buttons API
  res.send(get_till);
});

app.listen(port);
