var credentials = require('../credentials.json');

var mysql=require("mysql");
var async=require("async");


credentials.host="ids"
var connection = mysql.createConnection(credentials);


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

