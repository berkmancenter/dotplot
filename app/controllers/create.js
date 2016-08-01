import Ember from 'ember';
import d3 from 'd3';
import _ from 'lodash/lodash';

export default Ember.Controller.extend({
    height: 530,
    width: 900,
    charge: 12,
    gravity: 4,
    nodes: [],
    getNodes: function (frameType) {
        var that = this;
        var nodes = [];
        return new Ember.RSVP.Promise(function (resolve, reject) {

            if (frameType === "Single Choice") {
                d3.csv(that.csvFile, function (d) {
                    return {
                        id: d.V1,
                        value: d[that.get('selectedColumn').get('id')]
                    };
                }, function (error, rows) {
                    if (!that.get('d3Init')) {
                        rows.forEach(function (row, index) {
                            if (index !== 0) {
                                var nodeRef = that.get('nodes')
                                    .findBy('id', row.id);
                                var node = {
                                    id: nodeRef.id,
                                };
                                node[that.get('selectedColumn').get('id')] = parseInt(row.value);
                                nodes.pushObject(node);
                            }
                        });
                        that.set('nodes', nodes);
                        resolve(nodes);
                    } else {
                        rows.forEach(function (row, index) {
                            if (index !== 0) {
                                var nodeRef = that.get('nodes')
                                    .findBy('id', row.id);
                                var node = {
                                    id: nodeRef.id,
                                    index: nodeRef.index,
                                    x: nodeRef.x,
                                    y: nodeRef.y
                                };
                                node[that.get('selectedColumn').get('id')] = parseInt(row.value);
                                nodes.pushObject(node);
                            }
                        });
                        resolve(nodes);
                    }
                });
            } else if (frameType === "Multiple Choice") {
                d3.csv(that.csvFile, function (rows) {
                    rows.forEach(function (row, index) {
                        if (index !== 0) {
                            var nodeObject = that.get('nodes')
                                .findBy('id', row.V1);
                            var first = true;
                            that.get('selectedColumn')
                                .get('choice')
                                .forEach(function (type) {
                                    if (parseInt(row[type]) === 1) {
                                        var node = {};
                                        if (first) {
                                            first = false;
                                            node = {
                                                id: nodeObject.id,
                                                x: nodeObject.x,
                                                y: nodeObject.y,
                                                fill: nodeObject.fill
                                            };
                                        } else {
                                            node = {
                                                id: nodeObject.id + '--' + type,
                                                x: nodeObject.x,
                                                y: nodeObject.y,
                                                fill: nodeObject.fill
                                            };
                                        }
                                        node[that.get('selectedColumn').get('id')] = type;
                                        nodes.pushObject(node);
                                    }
                                });
                        }
                    });
                    resolve(nodes);
                });
            } else {
                reject("Invalid FrameType: " + frameType);
            }
        });
    },
    getFoci: function (choices) {
        var that = this;
        var index = 0;
        var foci = {};

        var fociCount = choices.length;
        var perRow = Math.ceil(Math.sqrt(fociCount));
        var numRow = Math.ceil(Math.sqrt(fociCount));

        for (var i = 0; i < numRow; i++) {
            var temp = Math.min(perRow, fociCount - (i * perRow));
            for (var j = 0; j < temp; j++) {
                foci[choices[index]] = {
                    x: Math.ceil((that.get('width') / (temp + 1)) * (j + 1)),
                    y: Math.ceil((that.get('height') / (numRow + 1)) * (i + 1))
                };
                index++;
            }
        }

        return foci;
    },
    actions: {
        createFrame: function () {
            var frameType = this.get('selectedColumn').get('type');
            if (frameType === "Multiple Choice") {
                this.send('createMultipleChoice');
            } else if (frameType === "Single Choice") {
                this.send('createSingleChoice');
            }
        },
        createSingleChoice: function () {
            var that = this;

            this.getNodes('Single Choice').then(function (nodes) {
                var choices = [];

                nodes.forEach(function (node) {
                    if (!choices.contains(node[that.get('selectedColumn').get('id')])) {
                        choices.pushObject(node[that.get('selectedColumn').get('id')]);
                    }
                });

                var foci = that.getFoci(choices);

                var frame = that.get('store')
                    .createRecord('frame', {
                        id: that.get('selectedColumn').get('id'),
                        title: that.get('frameTitle'),
                        foci: foci,
                        radius: 5,
                        nodes: nodes,
                        type: "Single Choice",
                        switch: "Click"
                    });

                that.send('hideModel', 'createFrame');
                that.set('frame', frame);

                that.send('d3Init', frame);
            });
        },

        createMultipleChoice: function () {
            var that = this;

            this.getNodes('Multiple Choice').then(function (nodes) {
                var foci = that.getFoci(that.get('selectedColumn')
                    .get('choice'));

                var frame = that.get('store')
                    .createRecord('frame', {
                        id: that.get('selectedColumn').get('id'),
                        title: that.get('frameTitle'),
                        foci: foci,
                        radius: 5,
                        nodes: nodes,
                        type: "Multiple Choice",
                        switch: "Click"
                    });

                that.send('hideModel', 'createFrame');
                that.set('frame', frame);
                that.send('d3Init', frame);
            });
        },

        deleteFrame: function (frame) {
            this.get('store')
                .deleteRecord(frame);
        },

        showModel: function (modelId) {
            var dialog = document.querySelector('#' + modelId);
            dialog.showModal();
        },

        hideModel: function (modelId) {
            var dialog = document.querySelector('#' + modelId);
            dialog.close();
        },

        fileUpload: function (file) {
            var that = this;
            var csvFile = URL.createObjectURL(file[0]);

            that.set('csvFile', csvFile);
            that.send('hideModel', 'fileUpload');

            d3.csv(csvFile, function (d) {
                _.forEach(d[0], function (column, id) {
                    if (id.indexOf('TEXT') === -1 && id.indexOf('Q') === 0) {
                        if (id.indexOf('_') > 0) {
                            var newId = id.substr(0, id.indexOf('_'));
                            if (!that.get('store').hasRecordForId('column', newId)) {
                                that.get('store')
                                    .createRecord('column', {
                                        id: newId,
                                        text: column.substr(0, column.indexOf('-')),
                                        choice: [],
                                        type: "Multiple Choice"
                                    });
                            } else {
                                that.get('store')
                                    .findRecord('column', newId)
                                    .then(function (column) {
                                        column.choice.pushObject(id);
                                    });
                            }
                        } else {
                            that.get('store')
                                .createRecord('column', {
                                    id: id,
                                    text: column,
                                    type: "Single Choice"
                                });
                        }
                    }
                });
            });

            d3.csv(csvFile, function (rows) {
                rows.forEach(function (row, index) {
                    if (index !== 0) {
                        that.get('nodes')
                            .pushObject({
                                id: row.V1
                            });
                    }
                });
            });
        },

        selectColumn: function (column) {
            Ember.$("#column_" + column.get('id'))
                .addClass("active")
                .siblings()
                .removeClass('active');
            this.set('selectedColumn', column);
        },

        d3Init: function (frame) {
            this.set('d3Init', true);

            var svg = d3.select(".dotplot-nodes > svg")
                .attr("width", this.width)
                .attr("height", this.height);

            var fill = d3.scale.category20();

            var node = svg.selectAll(".node")
                .data(frame.get('nodes'), function (d) {
                    return d.id;
                });

            node.enter()
                .append("circle")
                .attr("class", "node")
                .attr("id", function (d) {
                    return d.id;
                })
                .attr("cx", function (d) {
                    return d.x;
                })
                .attr("cy", function (d) {
                    return d.y;
                })
                .attr("r", frame.get('radius'))
                .style("fill", function (d) {
                    if (d.fill) {
                        return d.fill;
                    } else {
                        d.fill = fill(d[frame.get('id')]);
                        return d.fill;
                    }
                })
                .style("opacity", 0.7)
                .style("stroke", function (d, i) {
                    return d3.rgb(fill(i)).darker(2);
                });

            node.exit()
                .transition()
                .duration(500)
                .style("opacity", 0)
                .remove();

            this.send('d3Plot', frame);
        },

        d3Plot: function (frame) {
            var that = this;
            var foci = frame.get('foci');
            var node = d3.select(".dotplot-nodes > svg")
                .selectAll('circle.node')
                .data(frame.get('nodes'), function (d) {
                    return d.id;
                });

            function drawNode(alpha) {
                return function (d) {
                    var center = foci[d[frame.get('id')]];
                    d.x += (center.x - d.x) * 0.09 * alpha;
                    d.y += (center.y - d.y) * 0.09 * alpha;
                };
            }

            function tick(e) {
                node.each(drawNode(e.alpha));
                node.attr("cx", function (d) {
                        return d.x;
                    })
                    .attr("cy", function (d) {
                        return d.y;
                    });
            }

            function end() {

            }

            var force = d3.layout
                .force()
                .nodes(frame.get('nodes'))
                .size([that.get('width'), that.get('height')])
                .on("tick", tick)
                .on('end', end)
                .charge(-1 * that.get('charge'))
                .gravity(that.get('gravity') / 100);

            this.set('force', force);
            force.start();
        },

        saveNodePositions: function (frame) {
            var node = d3.select(".dotplot-nodes > svg")
                .selectAll('circle.node');
            node.each(function (node) {
                var nodeRef = frame.get('nodes')
                    .findBy('id', node.id);
                nodeRef.x = node.x;
                nodeRef.y = node.y;
            });
        },

        changeGravity: function (event) {
            this.set('gravity', event.target.value);
            this.send('d3Plot', this.get('frame'));
        },

        changeCharge: function (event) {
            this.set('charge', event.target.value);
            this.send('d3Plot', this.get('frame'));
        },

        changeRadius: function (event) {
            var node = d3.select(".dotplot-nodes > svg")
                .selectAll('circle.node');

            node.transition()
                .duration(1000)
                .attr('r', event.target.value);
        },

        selectFrame: function (frame) {
            var that = this;
            var node = d3.select(".dotplot-nodes > svg")
                .selectAll('circle.node')
                .data(frame.get('nodes'));

            node.enter()
                .append("circle")
                .attr("class", "node")
                .attr("id", function (d) {
                    return d.id;
                })
                .attr("cx", function (d) {
                    var nodeId = d.id.substr(0, d.id.indexOf('--'));
                    if (nodeId) {
                        var nodeRef = that.get('frame')
                            .get('nodes')
                            .findBy("id", nodeId);
                    } else {
                        var nodeRef = that.get('frame')
                            .get('nodes')
                            .findBy("id", d.id);
                    }
                    return nodeRef.x;
                })
                .attr("cy", function (d) {
                    var nodeId = d.id.substr(0, d.id.indexOf('--'));
                    if (nodeId) {
                        var nodeRef = that.get('frame')
                            .get('nodes')
                            .findBy("id", nodeId);
                    } else {
                        var nodeRef = that.get('frame')
                            .get('nodes')
                            .findBy("id", d.id);
                    }
                    return nodeRef.y;
                })
                .attr("r", frame.get('radius'))
                .style("fill", function (d) {
                    return d.fill;
                })
                .style("opacity", 0.7)
                .style("stroke", function (d) {
                    return d3.rgb(d.fill).darker(2);
                });

            node.exit()
                .transition()
                .duration(500)
                .style("opacity", 0)
                .remove();

            node.transition().duration(1000)
                .attr('cx', function (d) {
                    return d.x;
                })
                .attr('cy', function (d) {
                    return d.y;
                });
            
            this.set('frame', frame);
        }
    }
});