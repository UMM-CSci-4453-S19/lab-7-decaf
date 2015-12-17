var express=require('express'),
    mysql=require('mysql'),
    credentials=require('./credentials.json'),
    app = express(),
    port = process.env.PORT || 1337;

credentials.host='ids'; //setup database credentials

var connection = mysql.createConnection(credentials); // setup the connection

connection.connect(function(err){if(err){console.log(error)}});

app.use(express.static(__dirname + '/public'));
app.get("/buttons",function(req,res){
    var sql = 'SELECT * FROM TylerL.till_buttons';
    connection.query(sql,(function(res){return function(err,rows,fields){
        if(err){console.log("We have an error:");
            console.log(err);}
        res.send(rows);
    }})(res));
});
app.get("/click",function(req,res){
    var id = req.param('id');
    var sql = 'YOUR SQL HERE'
    console.log("Attempting sql ->"+sql+"<-");

    connection.query(sql,(function(res){return function(err,rows,fields){
        if(err){console.log("We have an insertion error:");
            console.log(err);}
        res.send(err); // Let the upstream guy know how it went
    }})(res));
});

app.get("/buttons",function(req,res){

});

app.listen(port);