var app = require('express')();
var project = require('./routes/project');
var render = require('./routes/render');
var bodyParser = require('body-parser');

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use('/api/project', project);
app.use('/api/render', render);

app.listen(3000, function () {
  console.log('DotPlot server is listening on port 3000!')
});