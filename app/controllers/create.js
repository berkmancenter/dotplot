/* global saveAs, Fuse */

import Ember from 'ember';
import _ from 'lodash';
import NProgress from 'ember-cli-nprogress';
import * as config from '../config';
import { select, selectAll, event } from 'd3-selection';
import { } from 'd3-transition';
import { forceSimulation, forceX, forceY, forceCollide } from 'd3-force';
import { scaleOrdinal, schemeCategory20 } from 'd3-scale';
import { rgb } from 'd3-color';
import { json as requestJson, csv as requestCsv } from 'd3-request';
import { drag as d3Drag } from 'd3-drag';
import getFoci from '../utils/get-foci';
import serverRender from '../utils/server-render';

export default Ember.Controller.extend({
    charge: config.visualConf.charge,

    scale: config.visualConf.scale,

    fuzzyNodes: [],

    fuzzyText: null,

    firstCreate: true,

    server: false,

    firstFoci: {},

    radius: config.visualConf.radius,

    labels: true,

    showNodeInfo: true,

    gravity: config.visualConf.gravity,

    nodes: [],

    notifications: Ember.inject.service('notification-messages'),

    // Set width and height according to screen resolution.
    init: function () {
        var width = (Ember.$(window).width() - 333) * 85 / 100;
        var height = Ember.$(window).height() * 65 / 100;

        this.set('width', width);
        this.set('height', height);
    },

    // Observe Show Labels toggle.
    labelToggle: function () {
        if (this.get('labels')) {
            this.send(
                'showLabels',
                this.get('frame'),
                true
            );
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
                this.send(
                    'nodeFilter',
                    results
                );
            } else {
                this.send(
                    'nodeFilter',
                    false
                );
            }
        } else {
            this.send(
                'nodeFilter',
                false
            );
        }
    }.observes('fuzzyText'),

    getNodes: function (frameType) {
        NProgress.start();

        var that = this;

        var column = this.get('selectedColumn').get('id');

        var nodes = [];

        // Ember promise.
        return new Ember.RSVP.Promise(function (resolve, reject) {
            if (frameType === 'Single Choice') {
                if (!that.get('d3Init')) {
                    // Create new node objects from the existing.
                    that.get('store')
                        .findAll('node')
                        .then(function (response) {
                            response.forEach(function (node) {
                                if (node[column]) {
                                    var newNode = {
                                        id: node.get('id')
                                    };

                                    newNode[column] = node[column];
                                    nodes.pushObject(newNode);
                                }
                            });

                            that.set('nodes', nodes);
                            resolve(nodes);
                        });
                } else {
                    // Use existing nodes data to create new nodes.
                    that.get('store')
                        .findAll('node')
                        .then(function (response) {
                            response.forEach(function (node) {
                                if (node[column]) {
                                    var nodeObject = that.get('nodes')
                                        .findBy('id', node.get('id'));

                                    var newNode = {
                                        id: nodeObject.id,
                                        x: nodeObject.x,
                                        y: nodeObject.y,
                                        fill: nodeObject.fill
                                    };

                                    newNode[column] = node[column];
                                    nodes.pushObject(newNode);
                                }
                            });

                            resolve(nodes);
                        });
                }
            } else if (frameType === 'Multiple Choice') {
                that.get('store')
                    .findAll('node')
                    .then(function (response) {
                        response.forEach(function (node) {
                            var nodeObject = that.get('nodes')
                                .findBy('id', node.get('id'));

                            var first = true;

                            that.get('selectedColumn')
                                .get('choice')
                                .forEach(function (type) {
                                    if (node.get(type)) {
                                        var newNode = {};

                                        // Use existing nodes for first choice.
                                        if (first) {
                                            first = false;

                                            newNode = {
                                                id: nodeObject.id,
                                                x: nodeObject.x,
                                                y: nodeObject.y,
                                                fill: nodeObject.fill
                                            };
                                        } else {
                                            newNode = {
                                                id: nodeObject.id + '--' + type,
                                                x: nodeObject.x,
                                                y: nodeObject.y,
                                                fill: nodeObject.fill
                                            };
                                        }

                                        newNode[column] = type;
                                        nodes.pushObject(newNode);
                                    }
                                });
                        });

                        resolve(nodes);
                    });
            } else {
                // Reject promise if invalid frame type.
                reject('Invalid FrameType: ' + frameType);
            }
        });
    },

    getFoci: function (choices) {
        var foci = getFoci(choices, this.get('width'), this.get('height'));

        if (this.get('firstCreate')) {
            var firstFoci = _.keyBy(foci, 'id');
            var fill = scaleOrdinal(schemeCategory20);

            firstFoci = _.mapKeys(firstFoci, function (value, key) {
                return fill(key);
            });

            this.set('firstFoci', firstFoci);
            this.set('firstCreate', false);
        }

        return foci;
    },

    actions: {
        loadSampleData: function () {
            this.set('projectId', 'sampleData');
            this.send('loadProject');
        },

        loadProject: function () {
            this.send('hideIntro');

            var file = config.serverConf.apiEndpoint + this.get('projectId');

            function sendDataCallback(controller) {
                // Pass data to the import action.
                controller.send(
                    'importJSONData',
                    file
                );

                // Hide HTML5 Model.
                controller.send(
                    'hideModel',
                    'fileUpload'
                );
            }

            function dataFailure() {
                // Shake effect if no title is provided.
                Ember.$('#fileUpload')
                    .removeClass('zoomIn')
                    .addClass('shake');

                // Remove class on animation complete.
                window.setTimeout(function () {
                    Ember.$('#fileUpload')
                        .removeClass('shake');
                }, 1000);
            }

            Ember.$.get(file, sendDataCallback(this))
                .fail(dataFailure);
        },

        changeColor: function (foci, event) {
            var color = event.target.value;

            selectAll('.foci-' + foci.id)
                .transition()
                .style('fill', color)
                .style('stroke', rgb(color).darker(2))
        },

        createFrame: function () {
            if (!this.get('frameTitle')) {
                // Shake effect if no title is provided.
                Ember.$('#createFrame')
                    .removeClass('zoomIn')
                    .addClass('shake');

                // Remove class on animation complete.
                window.setTimeout(function () {
                    Ember.$('#createFrame')
                        .removeClass('shake');
                }, 1000);
            } else {
                Ember.$('#createFrame')
                    .addClass('zoomIn');

                var frameType = this.get('selectedColumn')
                    .get('type');

                if (frameType === 'Multiple Choice') {
                    // Hide the model.
                    this.send(
                        'hideModel',
                        'createFrame'
                    );

                    // Create multiple choice frame.
                    this.send('createMultipleChoice');
                } else if (frameType === 'Single Choice') {
                    // Hide the model.
                    this.send(
                        'hideModel',
                        'createFrame'
                    );

                    // Create single choice frame.
                    this.send(
                        'createSingleChoice'
                    );
                }
            }
        },

        createSingleChoice: function () {
            var columnId = this.get('selectedColumn').get('id');

            var controller = this;

            // Push type in array if doesn't exist.
            function pushUniqueType(types, type) {
                if (types.includes(type[columnId])) {
                    return;
                } else {
                    types.pushObject(type[columnId]);
                }
            }

            // Store frame in the data store.
            function storeFrame(controller, nodes) {
                var types = [];

                nodes.forEach(
                    pushUniqueType.bind(
                        this,
                        types
                    )
                );

                // Calculate foci.
                var foci = controller.getFoci(types);

                // Create a new frame record.
                var frame = controller.get('store')
                    .createRecord('frame', {
                        id: columnId,
                        title: controller.get('frameTitle'),
                        foci: foci,
                        radius: controller.get('radius'),
                        nodes: nodes,
                        type: 'Single Choice',
                        switch: 'On Click'
                    });

                // Plot the frame.
                controller.send(
                    'd3Init',
                    frame,
                    true
                );
            }

            // Get nodes and store in frame.
            this.getNodes('Single Choice')
                .then(storeFrame.bind(this, controller));
        },

        resetApp: function () {
            // Delete each column from store.
            function deleteColumns(columns) {
                columns.toArray().forEach(function (column) {
                    column.deleteRecord();
                });
            }

            // Delete each node from store.
            function deleteNodes(nodes) {
                nodes.toArray().forEach(function (node) {
                    node.deleteRecord();
                });
            }

            // Delete each frame from store.
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

            // Reload app after deleting data.
            window.location.reload(true);
        },

        createMultipleChoice: function () {
            var columnId = this.get('selectedColumn')
                .get('id');

            var choices = this.get('selectedColumn')
                .get('choice');

            var controller = this;

            // Store frame in the data store.
            function storeFrame(controller, nodes) {
                // Calcuate foci for frame.
                var foci = controller.getFoci(choices);

                // Create a new frame record.
                var frame = controller.get('store')
                    .createRecord('frame', {
                        id: columnId,
                        title: controller.get('frameTitle'),
                        foci: foci,
                        radius: controller.get('radius'),
                        nodes: nodes,
                        type: 'Multiple Choice',
                        switch: 'On Click'
                    });

                // Plot the frame
                controller.send(
                    'd3Init',
                    frame,
                    true
                );
            }

            // Get nodes and store frame.
            this.getNodes('Multiple Choice')
                .then(storeFrame.bind(this, controller));
        },

        createDialog: function () {
            if (this.get('csvFile')) {
                this.send(
                    'showModel',
                    'createFrame'
                );
            } else {
                this.send(
                    'showNotification',
                    'error',
                    'Please add a CSV file to create frames.',
                    true
                );
            }
        },

        deleteFrame: function (frame) {
            this.get('store')
                .deleteRecord(frame);

            this.send(
                'showNotification',
                'error',
                'Successfully deleted frame ' + frame.get('id') + '.',
                true
            );
        },


        hideIntro: function () {
            Ember.$('#dotplot-introData').remove();
            Ember.$('#dotplot-button-sampleData').remove();
        },

        showModel: function (modelId) {
            var dialog = document.querySelector('#' + modelId);

            dialog.showModal();
        },

        hideModel: function (modelId) {
            var dialog = document.querySelector('#' + modelId);

            dialog.close();
        },

        fileUpload: function (file, resetInput) {
            this.send('hideIntro');

            if (file[0].type === 'application/json') {
                var jsonFile = URL.createObjectURL(file[0]);

                this.send(
                    'importJSONData',
                    jsonFile
                );

                this.send(
                    'hideModel',
                    'fileUpload'
                );

                resetInput();
            } else if (file[0].type === 'text/csv') {
                // Get local file path.
                var csvFile = URL.createObjectURL(file[0]);

                this.set('csvFile', csvFile);

                this.send(
                    'importCSVData',
                    csvFile
                );

                this.send(
                    'hideModel',
                    'fileUpload'
                );

                resetInput();
            } else {
                this.send(
                    'hideModel',
                    'fileUpload'
                );

                this.send(
                    'showNotification',
                    'error',
                    'Invalid file type of uploaded file.',
                    true
                );

                resetInput();
            }
        },

        importJSONData: function (file) {
            NProgress.start();

            var controller = this;

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

            function storeFrame(controller, frame) {
                controller.get('store')
                    .createRecord('frame', frame);
            }

            function processFrame(controller, ratio, frame) {
                updateNodes(frame, ratio)
                    .then(storeFrame.bind(this, controller));
            }

            function processJson(controller, data) {
                // Update width and height according to window size.
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
        },

        importCSVData: function (file) {
            NProgress.start();

            var controller = this;

            select('.dotplot-nodes > svg')
                .attr('width', this.get('width'))
                .attr('height', this.get('height'));

            function multipleChoice(column, id) {
                var newId = id.substr(0, id.indexOf('_'));
 
                var recordExists = controller.get('store')
                    .hasRecordForId('column', newId);

                if (!recordExists) {
                    // Create record for multiple choice question.
                    controller.get('store')
                        .createRecord('column', {
                            id: newId,
                            text: column.substr(0, column.indexOf('-')),
                            choice: [id],
                            type: 'Multiple Choice'
                        });
                } else {
                    // Push choice in choice array.
                    controller.get('store')
                        .findRecord('column', newId)
                        .then(function (column) {
                            column.get('choice').pushObject(id);
                        });
                }
            }

            function singleChoice(column, id) {
                controller.get('store')
                    .createRecord('column', {
                        id: id,
                        text: column,
                        type: 'Single Choice'
                    });
            }

            function isValidQuestion(id) {
                var textValue = id.indexOf('TEXT');
                
                var questionValue = id.indexOf('Q');

                if (textValue === -1 && questionValue === 0) {
                    return true;
                } else {
                    return false;
                }
            }

            function parseRow(column, id) {
                if (isValidQuestion(id)) {
                    if (id.indexOf('_') > 0) {
                        multipleChoice(column, id);
                    } else {
                        singleChoice(column, id);
                    }
                } else {
                    return;
                }
            }

            function parseQuestions(row) {
                _.forEach(row[0], parseRow);
                NProgress.done();
            }

            function createNode(row, node, fuzzyNode) {
                _.forOwn(row, function (value, key) {
                    if (!value) {
                        return;
                    } else {
                        node[key] = value;

                        if (_.isNaN(parseInt(value))) {
                            fuzzyNode[key] = value;
                        } else {
                            return;
                        }
                    }
                });

                var storeNode = controller.get('store')
                    .createRecord('node', node);

                fuzzyNode['id'] = storeNode.get('id');

                controller.get('fuzzyNodes')
                    .pushObject(fuzzyNode);
            }
            
            function createNodes(rows) {
                rows.forEach(function (row, index) {
                    var node = {
                        id: row.V1
                    };

                    var fuzzyNode = {};

                    if (index !== 0) {
                        controller.get('nodes')
                            .pushObject({
                                id: row.V1
                            });
                        
                        if (index !== 1) {
                            createNode(
                                row,
                                node,
                                fuzzyNode
                            );
                        } else {
                            return;
                        }
                    } else {
                        return;
                    }
                });
            }

            requestCsv(file, parseQuestions);

            requestCsv(file, createNodes);
        },

        selectColumn: function (column) {
            // Highlight selected column.
            Ember.$('#column_' + column.get('id'))
                .addClass('active')
                .siblings()
                .removeClass('active');

            this.set('selectedColumn', column);

            // Set default frame title.
            this.set('frameTitle', column.get('text'));

            // Make frame field active.
            Ember.$('#frameTitle').addClass('is-focused');
        },

        d3Init: function (frame) {
            // Layout Initialised.
            this.set('d3Init', true);

            var controller = this;

            var fill = scaleOrdinal(schemeCategory20);

            var nodeIds = '';

            function getNodeIds(controller, d) {
                controller.send('removeLabels');

                var frameId = controller.get('frame')
                    .get('id');

                var nodes = controller.get('frame')
                    .get('nodes')
                    .filterBy(
                    frameId,
                    d[frameId]
                    );

                nodes = _.map(nodes, function (node) {
                    return '#' + node.id;
                });

                nodeIds = _.toString(nodes);
            }

            function fociUpdate(controller, d) {
                controller.send(
                    'updateNodePosition',
                    d
                );

                controller.send(
                    'showLabels',
                    controller.get('frame'),
                    true
                );
            }

            function setColor(d) {
                // Define node fill if not already defined.
                if (d.fill) {
                    return d.fill;
                } else {
                    d.fill = fill(d[frame.get('id')]);
                    return d.fill;
                }
            }

            function nodeClick(controller, d) {
                if (controller.get('showNodeInfo')) {
                    controller.send(
                        'nodeClick',
                        d,
                        frame
                    );
                } else if (event.defaultPrevented) {
                    return;
                } else {
                    return;
                }
            }

            // Drag to change foci location.
            var drag = d3Drag()
                .on('start', getNodeIds.bind(this, controller))
                .on('drag', function () {
                    controller.send(
                        'changeFoci',
                        nodeIds,
                        event
                    );
                })
                .on('end', fociUpdate.bind(this, controller));

            // Update node data.
            var node = select('.dotplot-nodes > svg')
                .selectAll('.node')
                .data(frame.get('nodes'), function (d) {
                    return d.id;
                });

            // Remove nodes from the SVG that are not in the data.
            node.exit()
                .transition()
                .duration(config.visualConf.transitionOut)
                .style('opacity', 0)
                .remove();

            // Create nodes that are not already present on the SVG.
            node.enter()
                .append('circle')
                .attr('class', function (d) {
                    return 'node foci-' + d[frame.get('id')];
                })
                .attr('id', function (d) {
                    return d.id;
                })
                .attr('cx', function (d) {
                    return d.x;
                })
                .attr('cy', function (d) {
                    return d.y;
                })
                .attr('r', frame.get('radius'))
                .style('fill', setColor)
                .style('opacity', config.visualConf.opacity)
                .style('stroke', function (d) {
                    return rgb(d.fill).darker(2);
                })
                .on('click', nodeClick.bind(this, controller))
                .call(drag);

            // Create force layout.
            if (this.get('server')) {
                this.send(
                    'serverPlot',
                    frame,
                );
            } else {
                this.send(
                    'd3Plot',
                    frame,
                    true
                );
            }
        },

        updateNodePosition: function (node) {
            var frameId = this.get('frame').get('id')

            function changeCoordinates(node) {
                var x = select('[id=' + node.id + ']')
                    .attr('cx');
                var y = select('[id=' + node.id + ']')
                    .attr('cy');

                node.x = +x;
                node.y = +y;
            }

            this.get('frame')
                .get('nodes')
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

        nodeClick: function (node, frame) {
            // Reset node radius.
            selectAll('[id^="' + this.get('node') + '"]')
                .transition()
                .duration(config.visualConf.transitionIn)
                .attr('r', frame.get('radius'));

            var nodeId = node.id;

            // Check if it's a duplicate node.
            if (node.id.indexOf('--') > 0) {
                nodeId = node.id.substr(0, node.id.indexOf('--'));
            }

            // Change radius on node selection.
            selectAll('[id^=' + nodeId + ']')
                .transition()
                .duration(config.visualConf.transitionIn)
                .attr('r', frame.get('radius') + 3);

            // Set global node variable.
            this.set('node', nodeId);

            // Display node info.
            this.send(
                'nodeInfo',
                nodeId
            );
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
            var info = [];

            function getLabels(frameInfo, frame, node) {
                if (node.id.indexOf(nodeId) < 0) {
                    return;
                } else {
                    var nodeCat = node[frame.get('id')];

                    var value = frame.get('foci')
                        .findBy('id', nodeCat)
                        .text;

                    frameInfo.answer += value + ' ';
                }
            }

            function getFrameInfo(frame) {
                var frameInfo = {
                    question: frame.get('title'),
                    answer: ''
                };

                frame.get('nodes')
                    .forEach(
                        getLabels.bind(
                            this,
                            frameInfo,
                            frame
                        )
                    );

                info.pushObject(frameInfo);
            }

            this.get('store')
                .findAll('frame')
                .then(function (frames) {
                    frames.forEach(getFrameInfo);
                });

            // Update info.
            this.set('info', info);

            // Fade-in node info.
            Ember.$('#nodeInfo').fadeIn();
        },

        hideNodeInfo: function () {
            var controller = this;

            // Fade-out node info.
            Ember.$('#nodeInfo').fadeOut();

            // Reset node radius.
            selectAll('[id^=' + this.get('node') + ']')
                .transition()
                .duration(config.visualConf.transitionIn)
                .attr('r', controller.get('frame').get('radius'));
        },

        serverPlot: function (frame) {
            var foci = _.keyBy(frame.get('foci'), 'id');

            var controller = this;

            this.send('removeLabels');

            var serverObject = {
                frame: frame,
                foci: foci,
                charge: this.get('charge'),
                gravity: this.get('gravity'),
                width: this.get('width'),
                height: this.get('height')
            };

            function plotNodes(controller, nodes) {
                frame.set('nodes', nodes);

                select('.dotplot-nodes > svg')
                    .selectAll('circle.node')
                    .data(nodes, function (d) {
                        return d.id;
                    })
                    .transition()
                    .attr('cx', function (d) {
                        return d.x;
                    })
                    .attr('cy', function (d) {
                        return d.y;

                    });

                controller.send(
                    'showNotification',
                    'success',
                    'Server render completed, you can now modify it.',
                    true
                );

                NProgress.done();

                controller.set('frame', frame);

                if (!controller.get('labels')) {
                    return;
                } else {
                    controller.send(
                        'showLabels',
                        frame,
                        true
                    );
                }
            }

            serverRender(serverObject).then(plotNodes.bind(this, controller));
        },

        d3Plot: function (frame) {
            NProgress.set(0.0);

            // Show new labels.
            this.send('removeLabels');

            var controller = this;

            var nodeData = frame.get('nodes');

            // For improved performance.
            var foci = _.keyBy(frame.get('foci'), 'id');

            // Update node data.
            var node = select('.dotplot-nodes > svg')
                .selectAll('circle.node')
                .data(nodeData, function (d) {
                    return d.id;
                });

            // Show labels and update nProgress.
            function end() {
                NProgress.done();

                controller.send(
                    'showNotification',
                    'success',
                    'Force layout completed, you can now modify it.',
                    true
                );

                node.attr('cx', function (d) {
                    return d.x;
                })
                    .attr('cy', function (d) {
                        return d.y;
                    });

                controller.set('frame', frame);

                if (!controller.get('labels')) {
                    return;
                } else {
                    controller.send(
                        'showLabels',
                        frame,
                        true
                    );
                }
            }

            // Define force properties.
            var collisionForce = forceCollide()
                .radius(this.get('charge'))
                .strength(0.8);

            var positionForce = function (frame, firstFoci, foci) {
                var fociXForce, fociYForce, colorXForce, colorYForce;

                function force(alpha) {
                    if (alpha < 0.5) {
                        fociXForce(alpha);
                        fociYForce(alpha);
                    } else {
                        colorXForce(alpha);
                        colorYForce(alpha);
                    }
                }

                force.initialize = function (n) {
                    fociXForce = forceX(function (n) {
                        return foci[n[frame.get('id')]].x;
                    });

                    fociYForce = forceY(function (n) {
                        return foci[n[frame.get('id')]].y;
                    });

                    colorXForce = forceX(function (n) {
                        return firstFoci[n.fill].x;
                    });

                    colorYForce = forceY(function (n) {
                        return firstFoci[n.fill].y;
                    });

                    fociXForce.initialize(n);
                    fociYForce.initialize(n);
                    colorXForce.initialize(n);
                    colorYForce.initialize(n);
                }

                return force;
            }(frame, controller.get('firstFoci'), foci);

            var force = forceSimulation()
                .force('collision', collisionForce)
                .force('foci', positionForce)
                .nodes(nodeData)
                .stop();

            this.set('force', force);

            // Start the force layout.
            // This could be in a web worker.
            var numTicks = Math.ceil(Math.log(force.alphaMin()) / Math.log(1 - force.alphaDecay()));

            setTimeout(function () {
                for (var i = 0; i < numTicks; ++i) {
                    force.tick();
                    NProgress.set(i / numTicks);
                }
                end();
            }, 0);
        },

        removeLabels: function () {
            select('.dotplot-nodes > svg')
                .selectAll('.label')
                .remove();
        },

        showLabels: function (frame, updatePosition) {
            // Update label data.
            var label = select('.dotplot-nodes > svg')
                .selectAll('.label')
                .data(frame.get('foci'));

            function calculateX(d) {
                if (updatePosition) {
                    // Find all nodes in the foci.
                    var nodes = frame.get('nodes')
                        .filterBy(frame.get('id'), d.id);

                    // Find node with minimum X coordinate.
                    var minXNode = _.minBy(nodes, function (node) {
                        return node.x;
                    });

                    // Find node with minimum Y coordinate.
                    var maxXNode = _.maxBy(nodes, function (node) {
                        return node.x;
                    });

                    // Calculate foci width.
                    var fociWidth = maxXNode.x - minXNode.x;

                    // Update label coordinate value.
                    d.labelx = minXNode.x + (fociWidth - this.getBBox().width) / 2;

                    if (!_.isNaN(d.labelx)) {
                        return d.labelx;
                    } else {
                        return;
                    }
                } else {
                    return d.labelx;
                }
            }

            function calculateY(d) {
                if (updatePosition) {
                    // Find all nodes in the foci.
                    var nodes = frame.get('nodes')
                        .filterBy(frame.get('id'), d.id);

                    // Find node with minimum Y coordinate.
                    var maxYNode = _.maxBy(nodes, function (node) {
                        return node.y;
                    });

                    // Update label coordinate value.
                    d.labely = maxYNode.y + 25;

                    if (!_.isNaN(d.labely)) {
                        return d.labely;
                    } else {
                        return;
                    }
                } else {
                    return d.labely;
                }
            }

            function cleanUp(d) {
                if (_.isNaN(d.labelx) || _.isNaN(d.labely)) {
                    this.remove();

                    _.remove(frame.get('foci'), {
                        id: d.id
                    });
                } else {
                    return;
                }
            }

            // Create labels that are not already present on the SVG.
            label.enter()
                .append('text')
                .attr('class', 'label')
                .style('opacity', config.visualConf.opacity)
                .style('font-family', 'Open Sans')
                .text(function (d) {
                    return d.text;
                })
                .attr('dx', calculateX)
                .attr('dy', calculateY)
                .each(cleanUp);
        },

        updateLabels: function () {
            // Hide the model.
            this.send(
                'hideModel',
                'editLabel'
            );

            // Remove existing labels.
            this.send('removeLabels');

            // Show new labels.
            this.send(
                'showLabels',
                this.get('frame'),
                true
            );
        },

        saveNodePositions: function (frame) {
            // Select all nodes on the SVG.
            var node = select('.dotplot-nodes > svg')
                .selectAll('circle.node');

            function updateNode(node) {
                var nodeObject = frame.get('nodes')
                    .findBy('id', node.id);

                nodeObject.x = node.x;

                nodeObject.y = node.y;
            }

            // Find the node (Frame Model) and update coordinate values.
            node.each(updateNode);
        },

        changeGravity: function (event) {
            // Get slider value when the value changes.
            this.set('gravity', parseInt(event.target.value));

            // Remove existing labels.
            this.send('removeLabels');

            // Run the force layout again.
            if (this.get('server')) {
                this.send(
                    'serverPlot',
                    this.get('frame')
                );
            } else {
                this.send(
                    'd3Plot',
                    this.get('frame'),
                    false
                );
            }
        },

        changeCharge: function (event) {
            // Get slider value when the value changes.
            this.set('charge', parseInt(event.target.value));

            // Remove existing labels.
            this.send('removeLabels');

            // Run the force layout again.
            if (this.get('server')) {
                this.send(
                    'serverPlot',
                    this.get('frame'),
                );
            } else {
                this.send(
                    'd3Plot',
                    this.get('frame'),
                    false
                );
            }
        },

        changeRadius: function (event) {
            // Select all nodes on the SVG.
            var node = select('.dotplot-nodes > svg')
                .selectAll('circle.node');

            this.get('frame')
                .set('radius', parseInt(event.target.value));

            this.set('radius', parseInt(event.target.value));

            // Transition into new radius value.
            node.transition()
                .duration(config.visualConf.transitionIn)
                .attr('r', parseInt(event.target.value));
        },

        selectFrame: function (frame) {
            NProgress.start();

            // Remove existing labels.
            this.send('removeLabels');

            // Controller reference.
            var controller = this;

            var nodeIds = '';

            function getNodeIds(controller, d) {
                controller.send('removeLabels');

                var frameId = controller.get('frame')
                    .get('id');

                var nodes = controller.get('frame')
                    .get('nodes')
                    .filterBy(
                    frameId,
                    d[frameId]
                    );

                nodes = _.map(nodes, function (node) {
                    return '#' + node.id;
                });

                nodeIds = _.toString(nodes);
            }

            function fociUpdate(controller, d) {
                controller.send(
                    'updateNodePosition',
                    d
                );

                controller.send(
                    'showLabels',
                    controller.get('frame'),
                    true
                );
            }

            function nodeClick(controller, d) {
                if (controller.get('showNodeInfo')) {
                    controller.send(
                        'nodeClick',
                        d,
                        frame
                    );
                } else if (event.defaultPrevented) {
                    return;
                } else {
                    return;
                }
            }

            // Drag to change foci location.
            var drag = d3Drag()
                .on('start', getNodeIds.bind(this, controller))
                .on('drag', function () {
                    controller.send(
                        'changeFoci',
                        nodeIds,
                        event
                    );
                })
                .on('end', fociUpdate.bind(this, controller));

            function getCoordinate(controller, type, d) {
                if (d.id.indexOf('--') !== -1) {
                    var nodeId = d.id
                        .substr(0, d.id.indexOf('--'));

                    var node = controller.get('frame')
                        .get('nodes')
                        .findBy('id', nodeId);

                    return node[type];
                } else {
                    d[type];
                }
            }

            // Update node data.
            var node = select('.dotplot-nodes > svg')
                .selectAll('circle.node')
                .data(frame.get('nodes'), function (d) {
                    return d.id;
                });

            // Remove nodes from the SVG that are not in the data.
            node.exit()
                .transition()
                .duration(config.visualConf.transitioOut)
                .style('opacity', 0)
                .remove();

            // Create nodes that are not already present on the SVG.
            node.enter()
                .append('circle')
                .attr('class', 'node')
                .attr('id', function (d) {
                    return d.id;
                })
                .attr('cx', getCoordinate.bind(this, controller, 'x'))
                .attr('cy', getCoordinate.bind(this, controller, 'y'))
                .attr('r', frame.get('radius'))
                .style('fill', function (d) {
                    return d.fill;
                })
                .style('opacity', config.visualConf.opacity)
                .style('stroke', function (d) {
                    return rgb(d.fill).darker(2);
                })
                .on('click', nodeClick.bind(this, controller))
                .call(drag);

            var node2 = select('.dotplot-nodes > svg')
                .selectAll('circle.node')
                .data(frame.get('nodes'), function (d) {
                    return d.id;
                });

            // Transition into the new node positions.
            node2.transition()
                .duration(config.visualConf.transitionIn)
                .attr('cx', function (d) {
                    return d.x;
                })
                .attr('cy', function (d) {
                    return d.y;
                })
                .on('end', _.once(function () {
                    controller.set('frame', frame);
                    NProgress.done();

                    if (!controller.get('labels')) {
                        return;
                    } else {
                        controller.send(
                            'showLabels',
                            frame,
                            false
                        );
                    }
                }));
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
                // Invalid Type.
            }
        },

        sendToServer: function (blob) {
            NProgress.start();

            var request = new XMLHttpRequest();

            var data = new FormData();

            var controller = this;

            var type = 'Published';

            // Check if the project already exists.
            if (this.get('projectId')) {
                data.append('projectData', blob, this.get('projectId'));

                type = 'Updated';
            } else {
                // Generate unique project id.
                var projectId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxyxxx'.replace(/[xy]/g, function (c) {
                    var r = Math.random() * 16 | 0;
                    var v = c === 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });

                this.set('projectId', projectId);

                data.append('projectData', blob, projectId);
            }

            // Open connection.
            request.open('POST', config.serverConf.apiEndpoint, true);

            // Show notification on success.
            request.onreadystatechange = function () {
                if (request.readyState === 4 && request.status === 200) {
                    var projectLink = config.serverConf.previewEndpoint + request.responseText;

                    controller.send(
                        'showNotification',
                        'info',
                        type + ':<a class="dotplot-notification-link" target=_blank href=' + projectLink + '><b>' + request.responseText + '</b></a>',
                        false
                    );
                }
            };

            // Track upload progress.
            request.upload.onprogress = function (e) {
                if (e.lengthComputable) {
                    NProgress.set(e.loaded / e.total);
                }
            };

            // Send data to the server.
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
                // Create a copy of the frame.
                var frameCopy = frame.toJSON();

                // Add id to the copied frame.
                frameCopy.id = frame.get('id');

                // Push the updated frame data.
                project.frames.pushObject(frameCopy);
            }

            function exportData(frames) {
                frames.forEach(pushFrameJson);

                // Create a new BLOB with the fileData.
                var blob = new Blob([JSON.stringify(project)], {
                    type: 'application/json'
                });

                if (type === 'publish') {
                    controller.send(
                        'sendToServer',
                        blob,
                        'DotPlot.json'
                    );
                } else if (type === 'save') {
                    saveAs(blob, 'DotPlot.json');
                } else {
                    return;
                }
            }

            // Find all frame records.
            this.get('store')
                .findAll('frame')
                .then(exportData);
        }
    }
});
