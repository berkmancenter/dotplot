import _ from 'lodash';
import NProgress from 'ember-cli-nprogress';
import Ember from 'ember';
import { json as requestJson } from 'd3-request';
import { select } from 'd3-selection';

export default function (file) {
  NProgress.start();
  var controller = this;


  /*  FUNCTION

      Name:       Update Nodes.
      Run:        When called.
      Accepts:
      frame:  Frame data (object)
      ratio:  Scale value (float)
      Task:       Update node coordinates.
      Returns:    Frame object (promise)

*/
  function updateNodes(frame, ratio) {
    return new Ember.RSVP.Promise(function (resolve) {
      frame.nodes
        .forEach(function (node, index) {
          var newNode = _.cloneDeep(node);
          newNode.x = node.x * ratio;
          newNode.y = node.y * ratio;
          newNode.px = node.px * ratio;
          newNode.py = node.py * ratio;
          var nodesLength = frame.nodes.length - 1;
          if (index != nodesLength) {
            return;
          } else {
            resolve(frame);
          }
        });
    });
  }


  /*  FUNCTION

      Name:       Store Frame.
      Run:        When called.
      Accepts:
      controller: Parent controller (scope)
      frame:      Frame data (object)
      Task:       Save frame data in storage.

*/
  function storeFrame(controller, frame) {
    controller.get('store')
      .createRecord('frame', frame);
  }


  /*  FUNCTION

      Name:       Process Frame.
      Run:        When called.
      Accepts:
      controller: Parent controller (scope)
      ratio:      Scale value (float)
      frame:      Frame data (object)
      Task:       Update nodes and store data.

*/
  function processFrame(controller, ratio, frame) {
    updateNodes(frame, ratio)
      .then(storeFrame.bind(this, controller));
  }


  /*  FUNCTION

      Name:       Process JSON.
      Run:        When called.
      Accepts:
      controller: Parent controller (scope)
      data:       Project data (object)
      Task:       Extract data from project file.

*/
  function processJson(controller, data) {
    var ratio = controller.get('height') / data.height;
    var width = data.width * ratio;
    controller.set('width', width);
    controller.set('scale', ratio);
    select('.dotplot-nodes > svg')
      .attr('width', width)
      .attr('height', controller.get('height'));
    data.frames
      .forEach(
          processFrame.bind(
            this,
            controller,
            ratio
            )
          );
    NProgress.done();
    controller.send(
        'showNotification',
        'success',
        'Project file successfully imported.',
        true
        );
  }
  requestJson(file, processJson.bind(this, controller));
}
