var credentials = require('../credentials.json');
var mysql=require("mysql");
credentials.host="ids";
var pool=mysql.createPool(credentials);

pool.getConnection(function(err,conn){
  if(!err){
      conn.query('Select * from jafi.till_buttons',function(err,rows,fields){
          if(err){
            console.log('Error looking up databases');
          } else {
            for(row in rows) {
                console.log(rows[row]);
                buttons.push(rows[row]);
            }

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

var buttons= [];

app.use(express.static(__dirname + '/public')); //Serves the web pages
app.get("/buttons",function(req,res){ // handles the /buttons API
  res.send(buttons);
});

app.listen(port);
