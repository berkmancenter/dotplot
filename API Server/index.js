var express = require('express');
var app = express();
var multer = require('multer');

var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

var upload = multer({
    limits: {
        files: 1,
        fileSize: 500000,
        fields: 0
    },
    storage: storage
});

var projectRouter = express.Router();

projectRouter.post('/', upload.single('projectData'), function (req, res) {
    res.send(req.file.filename);
});

projectRouter.get('/:id', function (req, res) {
    res.sendFile(req.params.id, {
        root: 'uploads/'
    });
});

projectRouter.delete('/:id', function (req, res) {
    res.status(204).end();
});

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
});

app.use('/api/project', projectRouter);

app.listen(3000, function () {
  console.log('The DotPlot file serving server is listening on port 3000!')
});