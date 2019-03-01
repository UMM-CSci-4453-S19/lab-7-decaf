mysql=require('mysql');
dbf=require('./_name_.dbf-setups.js');

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
