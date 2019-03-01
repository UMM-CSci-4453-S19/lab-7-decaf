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
