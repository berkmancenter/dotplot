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
import { json as requestJson } from 'd3-request';
import { drag as d3Drag } from 'd3-drag';
import getFoci from '../utils/get-foci';
import serverRender from '../utils/server-render';
import importCSVData from '../utils/csv_import';

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


    /*  FUNCTION

        Name:       Ember Init
        Run:        On app start.
        Task:       Set width and height.

    */
    init: function () {
        var width = (Ember.$(window).width() - 333) * 85 / 100;
        var height = Ember.$(window).height() * 65 / 100;

        this.set('width', width);
        this.set('height', height);

    },


    /*  FUNCTION

        Name:       Lable Toggle
        Run:        On lables change.
        Task:       Repositions foci labels.
        Observes:   labels.

    */
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


    /*  FUNCTION

        Name:       Fuzzy Search
        Run:        On fuzzyTest change.
        Task:       Highlights matching nodes.
        Observes:   fuzzyText.

    */
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


    /*  FUNCTION

        Name:       Get Nodes.
        Run:        When called.
        Task:       Returns array of nodes.
        Accepts:
            frameType:  Type of frame (string)
        Returns:    Nodes collection (Promise)
    */
    getNodes: function (frameType) {
        NProgress.start();
        var controller = this;

        // This is the column in the data we're building a set of nodes for.
        var column = this.get('selectedColumn').get('id');


        /*  FUNCTION

            Name:       Multiple Choice Node.
            Run:        When called.
            Task:       Creates node object.
            Accepts:
                nodeObject: Original node (object)
                type:       Foci type (string)
                first:      Loop start (boolean)
            Returns:    Node copy (object)

        */
        function multipleChoiceNode(nodeObject, type, first) {
            var newNode = {};
            if (first) {
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
            return newNode;
        }


        /*  FUNCTION

            Name:       Multiple Choice Types.
            Run:        When called.
            Task:       Processes individual node.
            Accepts:
                controller: Parent controller (scope)
                node:       Original node (string)
            Returns:    Nodes collection for type (array)

        */
        function multipleChoiceTypes(controller, node) {
            var nodeArr = [];
            var first = true;
            var nodeObject = controller.get('nodes')
                .findBy('id', node.get('id'));
            controller.get('selectedColumn')
                .get('choice')
                .forEach(function (type) {
                    if (!node.get(type)) {
                        return;
                    } else {
                        var newNode = multipleChoiceNode(
                            nodeObject,
                            type,
                            first
                        );
                        first = false;
                        nodeArr.push(newNode);
                    }
                });
            return nodeArr;
        }


        /*  FUNCTION

            Name:       Multiple Choice Nodes.
            Run:        When called.
            Task:       Processes nodes collection.
            Accepts:
                controller: Parent controller (scope)
                nodes:      Nodes collection (array)
            Returns:    Nodes collection (array)

        */
        function multipleChoiceNodes(controller, nodes) {
            var nodeArr = [];
            nodes.forEach(function (node) {
                var newNodes = multipleChoiceTypes(
                    controller,
                    node
                );
                if(newNodes.length) {
                    nodeArr = nodeArr.concat(newNodes);
                } else {
                    return;
                }
            });
            return nodeArr;
        }


        /*  FUNCTION

            Name:       Single Choice Node.
            Run:        When called.
            Task:       Creates node object.
            Accepts:
                controller: Parent controller (scope)
                createNew:  Use existing (boolean)
                node:       Original Node (object)
            Returns:    Node copy (object)

        */
        function singleChoiceNode(controller, createNew, node) {
            var newNode = {};
            if (!node[column]) {
                return;
            } else if (createNew) {
                newNode = {
                    id: node.get('id')
                };
                newNode[column] = node[column];
                return newNode;
            } else {
                var nodeObject = controller.get('nodes')
                    .findBy('id', node.get('id'));
                newNode = {
                    id: nodeObject.id,
                    x: nodeObject.x,
                    y: nodeObject.y,
                    fill: nodeObject.fill
                };
                newNode[column] = node[column];
                return newNode;
            }
        }


        /*  FUNCTION

            Name:       Single Choice Nodes.
            Run:        When called.
            Task:       Processes nodes collection.
            Accepts:
                controller: Parent controller (scope)
                createNew:  Use existing (boolean)
                nodes:      Nodes collection (array)
            Returns:    Nodes collection (array)

        */
        function singleChoiceNodes(controller, createNew, nodes) {
            var nodesArr = [];
            nodes.forEach(function (node) {
                var newNode = singleChoiceNode(
                    controller,
                    createNew,
                    node
                );
                if (!newNode) {
                    return;
                } else {
                    nodesArr.push(newNode);
                }
            });
            controller.set('nodes', nodesArr);
            return nodesArr;
        }


        /*  FUNCTION

            Name:       Pricess Single Choice.
            Run:        When called.
            Task:       Processes single choice frame.
            Accepts:
                controller: Parent controller (scope)
                createNew:  Use existing (boolean)
            Returns:    Nodes collection (array)

        */
        function processSingleChoice(controller, createNew) {
            var nodes = controller.get('store')
                .findAll('node')
                .then(
                    singleChoiceNodes.bind(
                        this,
                        controller,
                        createNew
                    )
                );
            return nodes;
        }


        /*  FUNCTION

            Name:       Process Multiple Choice.
            Run:        When called.
            Task:       Processes multiple choice frame.
            Accepts:
                controller: Parent controller (scope)
            Returns:    Nodes collection (array)

        */
        function processMultipleChoice(controller) {
            var nodes = controller.get('store')
                .findAll('node')
                .then(
                    multipleChoiceNodes.bind(
                        this,
                        controller
                    )
                );
            return nodes;
        }

        return new Ember.RSVP.Promise(function (resolve, reject) {
            if (frameType === 'Single Choice') {
                var createNew = !controller.get('d3Init');
                processSingleChoice(controller, createNew).then(function (nodes) {
                        resolve(nodes);
                    });
            } else if (frameType === 'Multiple Choice') {
                processMultipleChoice(controller).then(function (nodes) {
                    resolve(nodes);
                });
            } else {
                reject('Invalid FrameType: ' + frameType);
            }
        });
    },


    /*  FUNCTION

        Name:       Get Foci.
        Run:        When called.
        Task:       Calculates foci coordniates.
        Accepts:
            choices:    Foci collection (array)
        Returns:    Foci coordinates (array)

    */
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
        /*  ACTION

            Name:       Load Sample Data.
            Run:        When called.
            Task:       Load sample frames.

        */
        loadSampleData: function () {
            this.set('projectId', 'sampleData');
            this.send('loadProject');
        },


        /*  ACTION

            Name:       Load Project.
            Run:        When called.
            Task:       Loads project from a file.

        */
        loadProject: function () {
            this.send('hideIntro');
            var file = config.serverConf.apiEndpoint + this.get('projectId');


            /*  FUNCTION

                Name:       Send Data.
                Run:        When called.
                Accepts:
                    controller: Parent controller (scope)
                Task:       Send file to action.

            */
            function sendData(controller) {
                controller.send(
                    'importJSONData',
                    file
                );
                controller.send(
                    'hideModel',
                    'fileUpload'
                );
            }


            /*  FUNCTION

                Name:       Data Failure.
                Run:        When called.
                Task:       Trigger error animation.

            */
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


        /*  ACTION

            Name:       Change color.
            Run:        When called.
            Accepts:
                foci:   Foci collection (array)
                event:  New color value. (object)
            Task:       Change color of foci nodes.

        */
        changeColor: function (foci, event) {
            var color = event.target.value;
            selectAll('.foci-' + foci.id)
                .transition()
                .style('fill', color)
                .style('stroke', rgb(color).darker(2))
        },


        /*  ACTION

            Name:       Create Frame.
            Run:        Teamplate.
            Task:       Create a new frame.

        */
        createFrame: function () {
            if (!this.get('frameTitle')) {
                Ember.$('#createFrame')
                    .removeClass('zoomIn')
                    .addClass('shake');
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
                    this.send(
                        'hideModel',
                        'createFrame'
                    );
                    this.send('createMultipleChoice');
                } else if (frameType === 'Single Choice') {
                    this.send(
                        'hideModel',
                        'createFrame'
                    );
                    this.send(
                        'createSingleChoice'
                    );
                }
            }
        },


        /*  ACTION

            Name:       Create Single Choice.
            Run:        When called.
            Task:       Create a new single choice frame.

        */
        createSingleChoice: function () {
            var columnId = this.get('selectedColumn').get('id');
            var controller = this;


            /*  FUNCTION

                Name:       Push Unique Type.
                Run:        When called.
                Accepts:
                    type:   Foci type (scope)
                    types:  Unique foci collection (array)
                Task:       Push unique foci in a collection.

            */
            function pushUniqueType(types, type) {
                if (types.includes(type[columnId])) {
                    return;
                } else {
                    types.pushObject(type[columnId]);
                }
            }


            /*  FUNCTION

                Name:       Store Frame.
                Run:        When called.
                Accepts:
                    controller: Parent controller (scope)
                    nodes:      Frame nodes collection (array)
                Task:       Save frame data in storage..

            */
            function storeFrame(controller, nodes) {
                var types = [];
                nodes.forEach(
                    pushUniqueType.bind(
                        this,
                        types
                    )
                );
                var foci = controller.getFoci(types);
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
                controller.send(
                    'd3Init',
                    frame,
                    true
                );
            }
            this.getNodes('Single Choice')
                .then(storeFrame.bind(this, controller));
        },


        /*  ACTION

            Name:       Reset App.
            Run:        Teamplate.
            Task:       Reset storage.

        */
        resetApp: function () {
            /*  FUNCTION

                Name:       Delete Columns.
                Run:        When called.
                Accepts:
                    columns:    Questions collection (object)
                Task:       Delete questions from storage.

            */
            function deleteColumns(columns) {
                columns.toArray().forEach(function (column) {
                    column.deleteRecord();
                });
            }


            /*  FUNCTION

                Name:       Delete Nodes.
                Run:        When called.
                Accepts:
                    nodes:  Nodes collection (object)
                Task:       Delete nodes from storage.

            */
            function deleteNodes(nodes) {
                nodes.toArray().forEach(function (node) {
                    node.deleteRecord();
                });
            }


            /*  FUNCTION

                Name:       Delete Frames.
                Run:        When called.
                Accepts:
                    frames: Frames collection (object)
                Task:       Delete frames from storage.

            */
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


        /*  ACTION

            Name:       Create Multiple Choice.
            Run:        When called.
            Task:       Create a new multiple choice frame.

        */
        createMultipleChoice: function () {
            var columnId = this.get('selectedColumn')
                .get('id');
            var choices = this.get('selectedColumn')
                .get('choice');
            var controller = this;


            /*  FUNCTION

                Name:       Store Frame.
                Run:        When called.
                Accepts:
                    controller: Parent controller (scope)
                    nodes:      Nodes collection (array)
                Task:       Save frame data in storage.

            */
            function storeFrame(controller, nodes) {
                var foci = controller.getFoci(choices);
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
                controller.send(
                    'd3Init',
                    frame,
                    true
                );
            }
            this.getNodes('Multiple Choice')
                .then(storeFrame.bind(this, controller));
        },


        /*  ACTION

            Name:       Create Dialog.
            Run:        Teamplate.
            Task:       Opens HTML5 dialog.

        */
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


        /*  ACTION

            Name:       Delete Frame.
            Run:        Teamplate.
            Accepts:
                frame:  Frame (object)
            Task:       Delete frame from store.

        */
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


        /*  ACTION

            Name:       Hide Intro.
            Run:        Teamplate.
            Task:       Remove how-to instructions.

        */
        hideIntro: function () {
            Ember.$('#dotplot-introData')
                .remove();
            Ember.$('#dotplot-button-sampleData')
                .remove();
        },


        /*  ACTION

            Name:       Show Model.
            Run:        Teamplate.
            Accepts:
                modelId:    Model selector (string)
            Task:       Opens specific HTML5 dialog.

        */
        showModel: function (modelId) {
            var dialog = document.querySelector('#' + modelId);
            dialog.showModal();
        },


        /*  ACTION

            Name:       Hide Model.
            Run:        Teamplate.
            Accepts:
                modelId:    Model selector (string)
            Task:       Hides specific HTML5 dialog.

        */
        hideModel: function (modelId) {
            var dialog = document.querySelector('#' + modelId);
            dialog.close();
        },


        /*  ACTION

            Name:       File Upload.
            Run:        Teamplate.
            Accepts:
                file:       File meta (object)
                resetInput: Crear input field (function)
            Task:       Process uploaded file.

        */
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


        /*  ACTION

            Name:       Import JSON Data.
            Run:        When called.
            Accepts:
                file:   File blob (object)
            Task:       Parses frame data in JSON file.

        */
        importJSONData: function (file) {
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
        },

        /*  ACTION

            Name:       Import CSV Data.
            Run:        When called.
            Accepts:
                file:   File blob (object)
            Task:       Parses data in CSV file.

        */
        importCSVData: importCSVData,

        /*  ACTION

            Name:       Select Column.
            Run:        Template.
            Accepts:
                column: CSV Column (object)
            Task:       Marks column as selected.

        */
        selectColumn: function (column) {
            Ember.$('#column_' + column.get('id'))
                .addClass('active')
                .siblings()
                .removeClass('active');
            this.set('selectedColumn', column);
            this.set('frameTitle', column.get('text'));
            Ember.$('#frameTitle').addClass('is-focused');
        },


        /*  ACTION

            Name:       D3 Init.
            Run:        When called.
            Accepts:
                Frame:  Frame data (object)
            Task:       Plots frame data.

        */
        d3Init: function (frame) {
            this.set('d3Init', true);
            var controller = this;
            var fill = scaleOrdinal(schemeCategory20);
            var nodeIds = '';

            select('.dotplot-nodes > svg')
                .attr('width', this.get('width'))
                .attr('height', this.get('height'));


            /*  FUNCTION

                Name:       Get Node Ids.
                Run:        When called.
                Accepts:
                    controller: Parent controller (scope)
                    d:          DOM node (object)
                Task:       Creates nodes selection sequence.

            */
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


            /*  FUNCTION

                Name:       Foci Update.
                Run:        When called.
                Accepts:
                    controller: Parent controller (scope)
                    d:          DOM node (object)
                Task:       Updates foci on drag end.

            */
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


            /*  FUNCTION

                Name:       Set Color.
                Run:        When called.
                Accepts:
                    d:      DOM node (object)
                Task:       Creates color if not present.
                Returns:    Color (string)

            */
            function setColor(d) {
                if (d.fill) {
                    return d.fill;
                } else {
                    d.fill = fill(d[frame.get('id')]);
                    return d.fill;
                }
            }


            /*  FUNCTION

                Name:       Node Click.
                Run:        When called.
                Accepts:
                    controller: Parent controller (scope)
                    d:          DOM node (object)
                Task:       Triggers click action.

            */
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
            var node = select('.dotplot-nodes > svg')
                .selectAll('.node')
                .data(frame.get('nodes'), function (d) {
                    return d.id;
                });
            node.exit()
                .transition()
                .duration(config.visualConf.transitionOut)
                .style('opacity', 0)
                .remove();
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


        /*  ACTION

            Name:       Update Node Position.
            Run:        When called.
            Accepts:
                node:   DOM node (object)
            Task:       Updates coordinates in storage.

        */
        updateNodePosition: function (node) {
            var frameId = this.get('frame').get('id');


            /*  FUNCTION

                Name:       Change Coordinates.
                Run:        When called.
                Accepts:
                    node:   DOM node data (object)
                Task:       Updates node coordinates on SVG.

            */
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


        /*  ACTION

            Name:       Change Foci.
            Run:        When called.
            Accepts:
                nodeIds:    Node ids sequence (string)
                event:      New node position (object)
            Task:       Updates foci position on SVG.

        */
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
            selectAll('[id^="' + this.get('node') + '"]')
                .transition()
                .duration(config.visualConf.transitionIn)
                .attr('r', frame.get('radius'));
            var nodeId = node.id;
            if (node.id.indexOf('--') > 0) {
                nodeId = node.id.substr(0, node.id.indexOf('--'));
            }
            selectAll('[id^=' + nodeId + ']')
                .transition()
                .duration(config.visualConf.transitionIn)
                .attr('r', frame.get('radius') + 3);
            this.set('node', nodeId);
            this.send(
                'nodeInfo',
                nodeId
            );
        },


        /*  ACTION

            Name:       Node Filter.
            Run:        When called.
            Accepts:
                nodes:  Node ids sequence (string)
            Task:       Highlights specific nodes on SVG.

        */
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


        /*  ACTION

            Name:       Node Info.
            Run:        When called.
            Accepts:
                nodeId: Node selector (string)
            Task:       Opens node info dialog.

        */
        nodeInfo: function (nodeId) {
            var info = [];


            /*  FUNCTION

                Name:       Get Labels.
                Run:        When called.
                Accepts:
                    frameInfo:  Lable data (object)
                Task:       Finds label text.

            */
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


            /*  FUNCTION

                Name:       Get Frame Info.
                Run:        When called.
                Accepts:
                    frame:  Frame data (object)
                Task:       Creates info collection from labels.

            */
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
            this.set('info', info);
            Ember.$('#nodeInfo').fadeIn();
        },


        /*  ACTION

            Name:       Hide Node Info.
            Run:        Template.
            Task:       Hides node info dialog.

        */
        hideNodeInfo: function () {
            var controller = this;
            Ember.$('#nodeInfo').fadeOut();
            selectAll('[id^=' + this.get('node') + ']')
                .transition()
                .duration(config.visualConf.transitionIn)
                .attr('r', controller.get('frame').get('radius'));
        },


        /*  ACTION

            Name:       Server Plot.
            Run:        When called.
            Accepts:
                frame:  Frame data (object)
            Task:       Performs force layout server side.

        */
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


            /*  FUNCTION

                Name:       Plot Nodes.
                Run:        Template.
                Accepts:
                    controller: Parent controller (scope)
                    nodes:      Nodes collection (array)
                Task:       Plots frame data on SVG.

            */
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
            serverRender(serverObject)
                .then(
                    plotNodes.bind(
                        this,
                        controller
                    )
                );
        },

        /*  ACTION

            Name:       D3 Plot.
            Run:        When called.
            Accepts:
                frame:  Frame data (object)
            Task:       Plots frame data on SVG.

        */
        d3Plot: function (frame) {
            this.send('removeLabels');
            var controller = this;
            var nodeData = frame.get('nodes');
            var foci = _.keyBy(frame.get('foci'), 'id');
            var node = select('.dotplot-nodes > svg')
                .selectAll('circle.node')
                .data(nodeData, function (d) {
                    return d.id;
                });


            /*  FUNCTION

                Name:       End.
                Run:        When called.
                Task:       Updates foci on drag end.

            */
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
            var collisionForce = forceCollide()
                .radius(this.get('charge'))
                .strength(0.8);


            /*  FUNCTION

                Name:       Position Force.
                Run:        When called.
                Accepts:
                    frame:      Frame data (object)
                    firseFoci:  Color foci coordinates (object)
                    foci:       Frame specific foci (object)
                Task:       Updates nodes coordinates.
                Returns:    Force instance (object)
            */
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
            var numTicks = Math.ceil(
                Math.log(force.alphaMin()) / Math.log(1 - force.alphaDecay())
            );
            setTimeout(function () {
                for (var i = 0; i < numTicks; ++i) {
                    force.tick();
                    NProgress.set(i / numTicks);
                }
                end();
            }, 0);
        },


        /*  ACTION

            Name:       Remove Labels.
            Run:        When called.
            Task:       Removes foci labels from SVG.

        */
        removeLabels: function () {
            select('.dotplot-nodes > svg')
                .selectAll('.label')
                .remove();
        },


        /*  ACTION

            Name:       Show Labels.
            Run:        When called.
            Accepts:
                frame:          Frame data (object)
                updatePosition: Update cordinates (boolean)
            Task:       Displays labels on SVG.

        */
        showLabels: function (frame, updatePosition) {
            var label = select('.dotplot-nodes > svg')
                .selectAll('.label')
                .data(frame.get('foci'));


            /*  FUNCTION

                Name:       Calculate X.
                Run:        When called.
                Accepts:
                    d:      DOM label (object)
                Task:       Calculates label X coordinate.
                Returns:    New X coordinate (float)

            */
            function calculateX(d) {
                if (updatePosition) {
                    var nodes = frame.get('nodes')
                        .filterBy(frame.get('id'), d.id);
                    var minXNode = _.minBy(nodes, function (node) {
                        return node.x;
                    });
                    var maxXNode = _.maxBy(nodes, function (node) {
                        return node.x;
                    });
                    var fociWidth = maxXNode.x - minXNode.x;
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


            /*  FUNCTION

                Name:       Calculate Y.
                Run:        When called.
                Accepts:
                    d:      DOM label (object)
                Task:       Calculates label Y coordinate.
                Returns:    New Y coordinate (float)

            */
            function calculateY(d) {
                if (updatePosition) {
                    var nodes = frame.get('nodes')
                        .filterBy(frame.get('id'), d.id);
                    var maxYNode = _.maxBy(nodes, function (node) {
                        return node.y;
                    });
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


            /*  FUNCTION

                Name:       Clean Up.
                Run:        When called.
                Accepts:
                    d:      DOM label (object)
                Task:       Removes unused labels.

            */
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


        /*  ACTION

            Name:       Update Labels.
            Run:        When called.
            Task:       Label update cycle.

        */
        updateLabels: function () {
            this.send(
                'hideModel',
                'editLabel'
            );
            this.send('removeLabels');
            this.send(
                'showLabels',
                this.get('frame'),
                true
            );
        },


        /*  ACTION

            Name:       Same Node Positions.
            Run:        When called.
            Accepts:
                frame:  Frame data (object)
            Task:       Saves node coordinates in storage.

        */
        saveNodePositions: function (frame) {
            var node = select('.dotplot-nodes > svg')
                .selectAll('circle.node');


            /*  FUNCTION

                Name:       Update Node.
                Run:        When called.
                Accepts:
                    node:   Node data (object)
                Task:       Saves new node coordinates.

            */
            function updateNode(node) {
                var nodeObject = frame.get('nodes')
                    .findBy('id', node.id);
                nodeObject.x = node.x;
                nodeObject.y = node.y;
            }
            node.each(updateNode);
        },


        /*  ACTION

            Name:       Change Gravity.
            Run:        Template.
            Accepts:
                event:  New gravity value (object)
            Task:       Change gravity in the plot.

        */
        changeGravity: function (event) {
            this.set('gravity', parseInt(event.target.value));
            this.send('removeLabels');
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


        /*  ACTION

            Name:       Change Charge.
            Run:        Template.
            Accepts:
                event:  New charge value (object)
            Task:       Change charge in the plot.

        */
        changeCharge: function (event) {
            this.set('charge', parseInt(event.target.value));
            this.send('removeLabels');
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


        /*  ACTION

            Name:       Change Radius.
            Run:        Template.
            Accepts:
                event:  New radius value (object)
            Task:       Change node radius in the plot.

        */
        changeRadius: function (event) {
            var node = select('.dotplot-nodes > svg')
                .selectAll('circle.node');
            this.get('frame')
                .set('radius', parseInt(event.target.value));
            this.set('radius', parseInt(event.target.value));
            node.transition()
                .duration(config.visualConf.transitionIn)
                .attr('r', parseInt(event.target.value));
        },


        /*  ACTION

            Name:       Select Frame.
            Run:        Template.
            Accepts:
                frame:  Frame data (object)
            Task:       Transition into new node layout.

        */
        selectFrame: function (frame) {
            NProgress.start();
            this.send('removeLabels');
            var controller = this;
            var nodeIds = '';


            /*  FUNCTION

                Name:       Get Node Ids.
                Run:        When called.
                Accepts:
                    controller: Parent controller (scope)
                    d:          DOM node (object)
                Task:       Creates nodes selection sequence.

            */
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


            /*  FUNCTION

                Name:       Foci Update.
                Run:        When called.
                Accepts:
                    controller: Parent controller (scope)
                    d:          DOM node (object)
                Task:       Updates foci on drag end.

            */
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


            /*  FUNCTION

                Name:       Node Click.
                Run:        When called.
                Accepts:
                    controller: Parent controller (scope)
                    d:          DOM node (object)
                Task:       Triggers click action.

            */
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


            /*  FUNCTION

                Name:       Get Coordinates.
                Run:        When called.
                Accepts:
                    controller: Parent controller (scope)
                    type:       Foci type (string)
                    d:          DOM node (object)
                Task:       Finds existing node position.

            */
            function getCoordinate(controller, type, d) {
                if (d.id.indexOf('--') !== -1) {
                    var nodeId = d.id
                        .substr(0, d.id.indexOf('--'));
                    var node = controller.get('frame')
                        .get('nodes')
                        .findBy('id', nodeId);
                    return node[type];
                } else {
                    return d[type];
                }
            }
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
            var node = select('.dotplot-nodes > svg')
                .selectAll('circle.node')
                .data(frame.get('nodes'), function (d) {
                    return d.id;
                });
            node.exit()
                .transition()
                .duration(config.visualConf.transitioOut)
                .style('opacity', 0)
                .remove();
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


        /*  ACTION

            Name:       Show Notification.
            Run:        When called.
            Accepts:
                type:       Notification type (string)
                message:    Message for notification (string)
                clear:      Auto clear notification (boolean)
            Task:       Show notification bar.

        */
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


        /*  ACTION

            Name:       Send To Server.
            Run:        Template.
            Accepts:
                blob:   Project JSON file (object)
            Task:       Save project file on server.

        */
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
                    controller.send(
                        'showNotification',
                        'info',
                        type + ':<a class="dotplot-notification-link" target=_blank href=' + projectLink + '><b>' + request.responseText + '</b></a>',
                        false
                    );
                }
            };
            request.upload.onprogress = function (e) {
                if (e.lengthComputable) {
                    NProgress.set(e.loaded / e.total);
                }
            };
            request.send(data);
        },


        /*  ACTION

            Name:       Export Data.
            Run:        Template.
            Accepts:
                type:   Export of publish (string)
            Task:       Export or publish project frames.

        */
        exportData: function (type) {
            var project = {
                width: this.get('width'),
                height: this.get('height'),
                frames: []
            };
            var controller = this;


            /*  FUNCTION

                Name:       Push Frame JSON.
                Run:        When called.
                Accepts:
                    frame:  Frame data (object)
                Task:       Creates frame data copy in collection.

            */
            function pushFrameJson(frame) {
                var frameCopy = frame.toJSON();
                frameCopy.id = frame.get('id');
                project.frames.pushObject(frameCopy);
            }


            /*  FUNCTION

                Name:       Export Data.
                Run:        When called.
                Accepts:
                    frames: Frames collection (array)
                Task:       Exports or publishes frame data.

            */
            function exportData(frames) {
                frames.forEach(pushFrameJson);
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
            this.get('store')
                .findAll('frame')
                .then(exportData);
        }
    }
});
