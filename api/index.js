var app = require('express')();
var project = require('./routes/project');
var render = require('./routes/render');
var bodyParser = require('body-parser');

app.use(function(req, res, next) {
  //TODO tighten
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "PATCH, PUT, DELETE");
  next();
});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({limit: '50mb'}));

app.use('/api/projects', project);
app.use('/api/render', render);

var port = process.env.PORT || 3000;
app.listen(port, function () {
  console.log('DotPlot server is listening on port ' + port + '!')
});
