/* global Fuse, saveAs */

import Ember from 'ember';
import _ from 'lodash';
import NProgress from 'ember-cli-nprogress';
import * as config from '../config';

import { select, selectAll } from 'd3-selection';
import { } from 'd3-transition';
import { rgb } from 'd3-color';
//import { drag as d3Drag } from 'd3-drag';

import getFoci from '../utils/get-foci';
import { parseQualtrics } from '../utils/qualtrics_import';
import importJSONData from '../utils/json_import';
import fetchDots from '../utils/get_dots';
import { d3Init, d3Layout, d3Transition } from '../utils/plotting';
import { showLabels, removeLabels } from '../utils/labels';

const canvasSelector = '.dotplot-nodes > svg';

export default Ember.Controller.extend({
    charge: config.visualConf.charge,
    scale: config.visualConf.scale,
    fuzzyNodes: [],
    fuzzyText: null,
    firstCreate: true,
    server: false,
    colorFrame: {},
    radius: config.visualConf.radius,
    labels: true,
    showNodeInfo: true,
    gravity: config.visualConf.gravity,
    nodes: [],
    notifications: Ember.inject.service('notification-messages'),

    init: function () {
        var width = (Ember.$(window).width() - 333) * 85 / 100;
        var height = Ember.$(window).height() * 65 / 100;

        this.set('width', width);
        this.set('height', height);

    },

    labelToggle: function () {
        if (this.get('labels')) {
            this.send('showLabels', this.get('frame'), true);
        } else {
            this.send('removeLabels');
        }
    }.observes('labels'),

    fuzzySearch: function () {
        var queryLength = this.get('fuzzyText').length;

        if (queryLength > 3) {
            var fuse = new Fuse(
                this.get('fuzzyNodes'),
                config.fuzzyConf
            );

            var results = fuse.search(
                this.get('fuzzyText')
            );

            if (results.length) {
                this.send('nodeFilter', results);
            } else {
                this.send('nodeFilter', false);
            }
        } else {
            this.send('nodeFilter', false);
        }
    }.observes('fuzzyText'),

    getDots: function(columnId, survey, existingDots) {
      return fetchDots(columnId, survey, existingDots);
    },

    getFoci: function(column) {
      return getFoci(column.choices, this.get('width'), this.get('height'));
    },

    actions: {
        loadSampleData: function () {
            this.set('projectId', 'sampleData');
            this.send('loadProject');
        },

        loadProject: function () {
            this.send('hideIntro');
            var file = config.serverConf.apiEndpoint + this.get('projectId');

            function sendData(controller) {
                controller.send('importJSONData', file);
                controller.send('hideModal', 'fileUpload');
            }

            function dataFailure() {
                Ember.$('#fileUpload')
                    .removeClass('zoomIn')
                    .addClass('shake');
                window.setTimeout(function () {
                    Ember.$('#fileUpload')
                        .removeClass('shake');
                }, 1000);
            }
            Ember.$.get(file, sendData(this))
                .fail(dataFailure);
        },

        changeColor: function (foci, event) {
            var color = event.target.value;
            selectAll('.foci-' + foci.id)
                .transition()
                .style('fill', color)
                .style('stroke', rgb(color).darker(2))
        },

      onCreateFrame: function () {
        if (!this.get('frameTitle')) {
          Ember.$('#createFrame').removeClass('zoomIn').addClass('shake');
          window.setTimeout(function () {
            Ember.$('#createFrame').removeClass('shake');
          }, 1000);
        } else {
          Ember.$('#createFrame').addClass('zoomIn');

          this.send('createFrame');
          this.send('hideModal', 'createFrame');
        }
      },

      createFrame: function() {
        NProgress.start();
        const controller = this;
        const project = controller.model.project;
        const column = controller.get('selectedColumn');

        const foci = controller.getFoci(column);
        const frameData = {
          columnId: column.id,
          title: controller.get('frameTitle'),
          foci: foci,
          radius: controller.get('radius'),
          type: column.type,
          switch: 'On Click'
        };
        const frame = controller.get('store').createRecord('frame', frameData);
        project.get('frames').pushObject(frame);
        if (controller.get('firstCreate')) {
          project.set('colorByFrameId', frame.get('columnId'));
          controller.set('firstCreate', false);
        }
        controller.send('d3Init', frame);
        NProgress.done();
      },

        resetApp: function () {
            function deleteColumns(columns) {
                columns.toArray().forEach(function (column) {
                    column.deleteRecord();
                });
            }

            function deleteNodes(nodes) {
                nodes.toArray().forEach(function (node) {
                    node.deleteRecord();
                });
            }

            function deleteFrames(frames) {
                frames.toArray().forEach(function (frame) {
                    frame.deleteRecord();
                });
            }
            this.get('store')
                .findAll('column')
                .then(deleteColumns);
            this.get('store')
                .findAll('node')
                .then(deleteNodes);
            this.get('store')
                .findAll('frame')
                .then(deleteFrames);
            window.location.reload(true);
        },

        createDialog: function () {
            if (this.get('csvFile')) {
                this.send('showModal', 'createFrame');
            } else {
                this.send('showNotification', 'error',
                    'Please add a CSV file to create frames.', true);
            }
        },

        deleteFrame: function (frame) {
          const controller = this;
          const project = controller.model.project;
          if (frame.get('columnId') === project.get('colorByFrameId')) {
            project.get('frames').then(frames => {
              const newColorFrame = frames.find(f => f.get('columnId') !== frame.get('columnId'));
              if (newColorFrame) {
                project.set('colorByFrameId', newColorFrame.get('columnId'));
              } else {
                project.set('colorByFrameId', null);
              }
            });
          }
          controller.get('store').deleteRecord(frame);
          controller.send('showNotification', 'error',
              'Successfully deleted frame ' + frame.get('title') + '.', true);
        },

        hideIntro: function () {
            Ember.$('#dotplot-introData')
                .remove();
            Ember.$('#dotplot-button-sampleData')
                .remove();
        },

        showModal: function (modalId) {
            var dialog = document.querySelector('#' + modalId);
            dialog.showModal();
        },

        hideModal: function (modalId) {
            var dialog = document.querySelector('#' + modalId);
            dialog.close();
        },

        fileUpload: function (file, resetInput) {
          const controller = this;
          const project = controller.model.project;

          controller.send('hideIntro');
          controller.send('hideModal', 'fileUpload');
          const uploadType = file[0].type;

          if (uploadType === 'application/json') {
            var jsonFile = URL.createObjectURL(file[0]);
            controller.send('importJSONData', jsonFile);
          } else if (uploadType === 'text/csv') {
            var csvFile = URL.createObjectURL(file[0]);
            controller.set('csvFile', csvFile);
            NProgress.start();
            parseQualtrics(csvFile)
              .then(survey => {
                console.log(survey);
                project.set('survey', survey);
                NProgress.done();
              });
          } else {
            this.send('showNotification', 'error',
                'Invalid file type of uploaded file.', true);
          }
          resetInput();
        },

        importJSONData: importJSONData,
        parseQualtrics: parseQualtrics,

        selectColumn: function (column) {
            Ember.$('#column_' + column.id)
                .addClass('active')
                .siblings()
                .removeClass('active');
            this.set('selectedColumn', column);
            this.set('frameTitle', column.question);
            Ember.$('#frameTitle').addClass('is-focused');
        },

        d3Init: function(frame) {
          const controller = this;

          controller.set('d3Init', true);
          d3Init(canvasSelector, frame, controller.get('width'), controller.get('height'));
          controller.send('d3Plot', frame);
        },

        d3Plot: function(frame) {
          const controller = this;
          const project = controller.model.project;
          NProgress.start();

          controller.send('removeLabels');

          function onDotClick(d) {
            if (controller.get('showNodeInfo')) {
              controller.send('nodeClick', d, frame);
            }
          }

          function onEnd(dots) {
            NProgress.done();
            controller.send('showNotification', 'success',
                'Force layout completed, you can now modify it.', true);
            controller.set('frame', frame);
            if (controller.get('labels')) {
              controller.send('showLabels', dots, frame, true);
            } else {
              return;
            }
          }

          function onTick(i, numTicks) {
            NProgress.set(i / numTicks);
          }

          project.get('colorByFrame')
            .then(colorFrame => {
              const dots = project.dots(frame, colorFrame);
              const needsLayout = _.isUndefined(dots[0].x);
              if (needsLayout) {
                return d3Layout(canvasSelector, dots, frame, colorFrame, controller.get('charge'), onTick)
                  .then(newDots => project.updateLayouts(frame, colorFrame, newDots))
                  .then(dots => d3Transition(canvasSelector, dots, frame, colorFrame, onDotClick));
              }
              return d3Transition(canvasSelector, dots, frame, colorFrame, onDotClick); })
            .then(onEnd);
        },

        showLabels: function(dots, frame, updatePosition) {
          return showLabels(canvasSelector, dots, frame, updatePosition); },
        removeLabels: function() { return removeLabels(canvasSelector); },
        updateLabels: function() {
          this.send('hideModal', 'editLabel');
          this.send('removeLabels');
          this.send('showLabels', this.get('frame'), true);
        },

        updateNodePosition: function (node) {
            var frameId = this.get('frame').get('id');

            function changeCoordinates(node) {
                var x = select('[id=' + node.id + ']')
                    .attr('cx');
                var y = select('[id=' + node.id + ']')
                    .attr('cy');
                node.x = +x;
                node.y = +y;
            }
            this.get('frame')
                .get('dots')
                .filterBy(
                    frameId,
                    node[frameId]
                )
                .forEach(changeCoordinates);
        },

        changeFoci: function (nodeIds, event) {
            selectAll(nodeIds)
                .attr('cx', function () {
                    return + select(this).attr('cx') + event.dx;
                });
            selectAll(nodeIds)
                .attr('cy', function () {
                    return + select(this).attr('cy') + event.dy;
                });
        },

        nodeClick: function (node) {
          this.set('node', node.id);
          this.send('nodeInfo', node.respId);
        },

        nodeFilter: function (nodes) {
            var controller = this;
            if (nodes) {
                selectAll('circle.node')
                    .transition()
                    .duration(config.visualConf.transitionIn)
                    .style('opacity', config.visualConf.opacity / 2);
                _.map(nodes, function (node) {
                    return selectAll('[id^=' + node + ']')
                        .transition()
                        .duration(config.visualConf.transitionIn)
                        .attr('r', controller.get('radius') + 3)
                        .style('opacity', config.visualConf.opacity);
                });
            } else {
                selectAll('circle.node')
                    .transition()
                    .duration(config.visualConf.transitionIn)
                    .attr('r', this.get('radius'))
                    .style('opacity', config.visualConf.opacity);
            }
        },

        nodeInfo: function (nodeId) {
          const controller = this;
          const project = controller.model.project;
          const survey = project.get('survey');
          let info = [];

          const resp = _.find(survey.responses, ['id', nodeId]);
          survey.columns.forEach(col => {
            if (!resp.answers[col.id]) { return; }
            info.push({
              question: col.question,
              answer: resp.answers[col.id].join('; ')
            });
          });
          controller.set('info', info);
          Ember.$('#nodeInfo').fadeIn();
        },

        hideNodeInfo: function () {
            //var controller = this;
            Ember.$('#nodeInfo').fadeOut();
            /*
            selectAll('[id^=' + this.get('node') + ']')
                .transition()
                .duration(config.visualConf.transitionIn)
                .attr('r', controller.get('frame').get('radius'));
                */
        },

        saveNodePositions: function (frame) {
            var node = select(canvasSelector)
                .selectAll('circle.node');

            function updateNode(node) {
                var nodeObject = frame.get('dots')
                    .findBy('id', node.id);
                nodeObject.x = node.x;
                nodeObject.y = node.y;
            }
            node.each(updateNode);
        },

        changeGravity: function (event) {
            this.set('gravity', parseInt(event.target.value));
            this.send('removeLabels');
            if (this.get('server')) {
                this.send('serverPlot', this.get('frame'));
            } else {
                this.send('d3Plot', this.get('frame'));
            }
        },

        changeCharge: function (event) {
            this.set('charge', parseInt(event.target.value));
            this.send('removeLabels');
            if (this.get('server')) {
                this.send('serverPlot', this.get('frame'),);
            } else {
                this.send('d3Plot', this.get('frame'));
            }
        },

        changeRadius: function (event) {
            var node = select(canvasSelector)
                .selectAll('circle.node');
            this.get('frame')
                .set('radius', parseInt(event.target.value));
            this.set('radius', parseInt(event.target.value));
            node.transition()
                .duration(config.visualConf.transitionIn)
                .attr('r', parseInt(event.target.value));
        },

        selectFrame: function (frame) {
          const controller = this;
          const project = controller.model.project;

          NProgress.start();
          controller.send('removeLabels');

          function nodeClick(d) {
            if (controller.get('showNodeInfo')) {
              controller.send('nodeClick', d, frame);
            }
          }

          project.get('colorByFrame')
            .then(colorFrame => d3Transition(canvasSelector,
                  project.dots(frame, colorFrame), frame, colorFrame, nodeClick))
            .then(dots => {
              controller.set('frame', frame);
              NProgress.done();
              if (controller.get('labels')) {
                controller.send('showLabels', dots, frame, false);
              }
            });
        },

        showNotification: function (type, message, clear) {
            switch (type) {
                case 'warning':
                    this.get('notifications').warning(message, {
                        autoClear: clear,
                        clearDuration: config.visualConf
                            .notificationDuration
                    });
                    break;
                case 'info':
                    this.get('notifications').info(message, {
                        autoClear: clear,
                        htmlContent: true,
                        clearDuration: config.visualConf
                            .notificationDuration
                    });
                    break;
                case 'error':
                    this.get('notifications').error(message, {
                        autoClear: clear,
                        clearDuration: config.visualConf
                            .notificationDuration
                    });
                    break;
                case 'success':
                    this.get('notifications').success(message, {
                        autoClear: clear,
                        clearDuration: config.visualConf
                            .notificationDuration
                    });
                    break;
                default:
            }
        },

        sendToServer: function (blob) {
            NProgress.start();
            var request = new XMLHttpRequest();
            var data = new FormData();
            var controller = this;
            var type = 'Published';
            if (this.get('projectId')) {
                data.append('projectData', blob, this.get('projectId'));
                type = 'Updated';
            } else {
                var projectId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxyxxx'.replace(/[xy]/g, function (c) {
                    var r = Math.random() * 16 | 0;
                    var v = c === 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
                this.set('projectId', projectId);
                data.append('projectData', blob, projectId);
            }
            request.open('POST', config.serverConf.apiEndpoint, true);
            request.onreadystatechange = function () {
                if (request.readyState === 4 && request.status === 200) {
                    var projectLink = config.serverConf.previewEndpoint + request.responseText;
                    controller.send('showNotification', 'info',
                        type + ':<a class="dotplot-notification-link" target=_blank href=' + projectLink + '><b>' + request.responseText + '</b></a>', false);
                }
            };
            request.upload.onprogress = function (e) {
                if (e.lengthComputable) {
                    NProgress.set(e.loaded / e.total);
                }
            };
            request.send(data);
        },

        exportData: function (type) {
            var project = {
                width: this.get('width'),
                height: this.get('height'),
                frames: []
            };
            var controller = this;

            function pushFrameJson(frame) {
                var frameCopy = frame.toJSON();
                frameCopy.id = frame.get('id');
                project.frames.pushObject(frameCopy);
            }

            function exportData(frames) {
                frames.forEach(pushFrameJson);
                var blob = new Blob([JSON.stringify(project)], {
                    type: 'application/json'
                });
                if (type === 'publish') {
                    controller.send('sendToServer', blob, 'DotPlot.json');
                } else if (type === 'save') {
                    saveAs(blob, 'DotPlot.json');
                } else {
                    return;
                }
            }
            this.get('store')
                .findAll('frame')
                .then(exportData);
        }
    }
});
