/* global require, module, __dirname */

const router = require('express').Router();
const bodyParser = require('body-parser');
const uuid = require('uuid/v4');
const jsonParser = bodyParser.json({ type: 'application/*+json', limit: '5mb' });
const fs = require('fs');
const root = __dirname + '/../uploads/';

function storeProject(req, res) {
  let project = req.body;
  project.data.attributes.currentFrameIndex = 0;
  if (!project.data.id) {
    project.data.id = uuid();
  }
  const writer = fs.createWriteStream(root + project.data.id);
  writer.end(JSON.stringify(project), function() {
    res.status(201).json(project);
  });
}

router.post('/', jsonParser, storeProject);
router.patch('/:id', jsonParser, storeProject);
router.get('/:id', function (req, res) {
  res.sendFile(req.params.id, {
    root: root,
    headers: { 'Content-Type': 'application/vnd.api+json' }
  });
});
router.delete('/:id', function (req, res) {
  res.status(204).end();
});

module.exports = router;
