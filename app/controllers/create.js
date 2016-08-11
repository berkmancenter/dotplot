import Ember from 'ember';
import d3 from 'd3';
import _ from 'lodash/lodash';

export default Ember.Controller.extend({
    height: 530,
    width: 1000,
    charge: 12,
    gravity: 4,
    nodes: [],
    getNodes: function (frameType) {
        NProgress.start();
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
                                node[that.get('selectedColumn').get('id')] = row.value;
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
                                    x: nodeRef.x,
                                    y: nodeRef.y
                                };
                                node[that.get('selectedColumn').get('id')] = row.value;
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
        var foci = [];

        var fociCount = choices.length;
        var perRow = Math.ceil(Math.sqrt(fociCount));
        var numRow = Math.ceil(Math.sqrt(fociCount));

        for (var i = 0; i < numRow; i++) {
            var temp = Math.min(perRow, fociCount - (i * perRow));
            for (var j = 0; j < temp; j++) {
                var point = {
                    id: choices[index],
                    text: choices[index],
                    x: Math.ceil((that.get('width') / (temp + 1)) * (j + 1)),
                    y: Math.ceil((that.get('height') / (numRow + 1)) * (i + 1))
                };
                index++;
                foci.pushObject(point);
            }
        }

        return foci;
    },
    actions: {
        createFrame: function () {
            if (!this.get('frameTitle')) {
                Ember.$('#createFrame').removeClass('zoomIn').addClass('shake');
                window.setTimeout(function () {
                    Ember.$('#createFrame').removeClass('shake');
                }, 1000);
            } else {
                Ember.$('#createFrame').addClass('zoomIn');
                var frameType = this.get('selectedColumn').get('type');
                if (frameType === "Multiple Choice") {
                    this.send('hideModel', 'createFrame');
                    this.send('createMultipleChoice');
                } else if (frameType === "Single Choice") {
                    this.send('hideModel', 'createFrame');
                    this.send('createSingleChoice');
                }
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
            NProgress.start();
            var that = this;

            // Get local file path.
            var csvFile = URL.createObjectURL(file[0]);

            that.set('csvFile', csvFile);

            // Hidel dialog.
            that.send('hideModel', 'fileUpload');

            // Loop : CSV rows.
            d3.csv(csvFile, function (d) {
                // Loop : Column titles.
                _.forEach(d[0], function (column, id) {
                    // Select only non-text and question columns.
                    if (id.indexOf('TEXT') === -1 && id.indexOf('Q') === 0) {
                        // If the question is multiple choice.
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
                NProgress.set(0.6);
            });

            // Create node objects.
            d3.csv(csvFile, function (rows) {
                rows.forEach(function (row, index) {
                    if (index !== 0) {
                        that.get('nodes')
                            .pushObject({
                                id: row.V1
                            });
                    }
                });
                NProgress.done();
            });
        },

        selectColumn: function (column) {
            // Highlight selected column.
            Ember.$("#column_" + column.get('id'))
                .addClass("active")
                .siblings()
                .removeClass('active');

            this.set('selectedColumn', column);

            // Set default frame title.
            this.set('frameTitle', column.get('text'));

            // Make frame field active.
            Ember.$("#frameTitle").addClass('is-focused');
        },

        d3Init: function (frame) {
            this.set('d3Init', true);

            var that = this;

            // Set SVG size.
            var svg = d3.select(".dotplot-nodes > svg")
                .attr("width", this.width)
                .attr("height", this.height);

            var fill = d3.scale.category20();

            // Update node data.
            var node = svg.selectAll(".node")
                .data(frame.get('nodes'), function (d) {
                    return d.id;
                });

            // Remove nodes from the SVG that are not in the data.
            node.exit()
                .transition()
                .duration(100)
                .style("opacity", 0)
                .remove();

            // Create nodes that are not already present on the SVG.
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
                    // Define node fill if not already defined.
                    if (d.fill) {
                        return d.fill;
                    } else {
                        d.fill = fill(d[frame.get('id')]);
                        return d.fill;
                    }
                })
                .style("opacity", 0.7)
                .style("stroke", function (d) {
                    // Return darker shade of node fill.
                    return d3.rgb(d.fill).darker(2);
                })
                .on('click', function (d) {
                    that.send('nodeClick', d, frame);
                });

            this.send('d3Plot', frame);
        },

        nodeClick: function (node, frame) {
            // Reset node radius.
            d3.selectAll("[id^=" + this.get('node') + "]")
                .transition()
                .duration(500)
                .attr("r", frame.get('radius'));

            var nodeId = node.id;

            // Check if it's a duplicate node.
            if (node.id.indexOf('--') > 0) {
                nodeId = node.id.substr(0, node.id.indexOf('--'));
            }

            // Transition into new radius.
            d3.selectAll("[id^=" + nodeId + "]")
                .transition()
                .duration(500)
                .attr("r", 10);

            // Set global node variable.
            this.set('node', nodeId);
            this.send('nodeInfo', nodeId);
        },

        nodeInfo: function (nodeId) {
            var info = [];
            this.get('store').findAll('frame').then(function (frames) {
                frames.forEach(function (frame) {
                    var frameInfo = {
                        question: frame.get('title'),
                        answer: ""
                    };
                    frame.get('nodes').forEach(function (node) {
                        if (node.id.indexOf(nodeId) >= 0) {
                            var nodeCat = node[frame.get('id')];
                            var value = frame.get('foci').findBy('id', nodeCat).text;
                            frameInfo.answer += value + " ";
                        }
                    });
                    info.pushObject(frameInfo);
                });
            });
        },

        d3Plot: function (frame) {
            NProgress.set(0.4);
            this.send('removeLabels');
            var that = this;

            // Update node data.
            var node = d3.select(".dotplot-nodes > svg")
                .selectAll('circle.node')
                .data(frame.get('nodes'), function (d) {
                    return d.id;
                });

            // Generate foci object for improved performance.
            var foci = _.indexBy(frame.get('foci'), 'id');

            // Update node coordinates using alpha value.
            function drawNode(alpha) {
                return function (d) {
                    var center = foci[d[frame.get('id')]];
                    d.x += (center.x - d.x) * 0.09 * alpha;
                    d.y += (center.y - d.y) * 0.09 * alpha;
                };
            }

            // Update DOM.
            function tick(e) {
                NProgress.inc(e.alpha);
                if (e.alpha <= 0.03) {
                    that.get('force').stop();
                }
                node.each(drawNode(e.alpha));
                node.attr("cx", function (d) {
                        return d.x;
                    })
                    .attr("cy", function (d) {
                        return d.y;
                    });
            }

            // Show labels and update nProgress.
            function end() {
                NProgress.done();
                that.set('frame', frame);
                that.send('showLabels', frame, true);
            }

            // Define force properties.
            var force = d3.layout
                .force()
                .nodes(frame.get('nodes'))
                .size([that.get('width'), that.get('height')])
                .on("tick", tick)
                .on('end', end)
                .charge(-1 * that.get('charge'))
                .gravity((10 - that.get('gravity')) / 100);

            this.set('force', force);

            force.start();
        },

        removeLabels: function () {
            d3.select(".dotplot-nodes > svg")
                .selectAll('text.label')
                .remove();
        },

        showLabels: function (frame, updatePosition) {
            // Update label data.
            var label = d3.select(".dotplot-nodes > svg")
                .selectAll(".label")
                .data(frame.get('foci'));

            // Create labels that are not already present on the SVG.
            label.enter()
                .append("text")
                .attr("class", "label")
                .style("opacity", 0)
                .style("font-family", "Open Sans")
                .text(function (d) {
                    return d.text;
                })
                .attr("dx", function (d) {
                    if (updatePosition) {
                        // Find all nodes in the foci.
                        var nodes = frame.get('nodes').filterBy(frame.get('id'), d.id);

                        // Find node with minimum X coordinate.
                        var minXNode = _.min(nodes, function (node) {
                            return node.x;
                        });
                        // Find node with minimum Y coordinate.
                        var maxXNode = _.max(nodes, function (node) {
                            return node.x;
                        });
                        // Calculate foci width.
                        var fociWidth = maxXNode.x - minXNode.x;

                        // Update label coordinate value.
                        d.labelx = minXNode.x + (fociWidth - this.getBBox().width) / 2;
                        return d.labelx;
                    } else {
                        return d.labelx;
                    }
                })
                .attr("dy", function (d) {
                    if (updatePosition) {
                        // Find all nodes in the foci.
                        var nodes = frame.get('nodes').filterBy(frame.get('id'), d.id);

                        // Find node with minimum Y coordinate.
                        var maxYNode = _.max(nodes, function (node) {
                            return node.y;
                        });

                        // Update label coordinate value.
                        d.labely = maxYNode.y + 25;
                        return d.labely;
                    } else {
                        return d.labely;
                    }
                });

            // Fade-in effect.
            label.transition()
                .duration(500)
                .style("opacity", 0.7);
        },

        updateLabels: function () {
            this.send('hideModel', 'editLabel');
            this.send('removeLabels');
            this.send('showLabels', this.get('frame'), true);
        },

        saveNodePositions: function (frame) {
            // Select all nodes on the SVG.
            var node = d3.select(".dotplot-nodes > svg")
                .selectAll('circle.node');

            // Find the node and update coordinate values.
            node.each(function (node) {
                var nodeRef = frame.get('nodes')
                    .findBy('id', node.id);
                nodeRef.x = node.x;
                nodeRef.y = node.y;
            });
        },

        changeGravity: function (event) {
            this.set('gravity', event.target.value);

            // Remove the labels.
            this.send('removeLabels');

            // Run the force layout again.
            this.send('d3Plot', this.get('frame'));
        },

        changeCharge: function (event) {
            this.set('charge', event.target.value);

            // Remove the labels.
            this.send('removeLabels');

            // Run the force layout again.
            this.send('d3Plot', this.get('frame'));
        },

        changeRadius: function (event) {
            // Select all nodes on the SVG.
            var node = d3.select(".dotplot-nodes > svg")
                .selectAll('circle.node');

            // Transition into new radius value.
            node.transition()
                .duration(1000)
                .attr('r', event.target.value);
        },

        selectFrame: function (frame) {
            NProgress.start();

            // Remove existing labels.
            this.send('removeLabels');

            var that = this;

            // Update node data.
            var node = d3.select(".dotplot-nodes > svg")
                .selectAll('circle.node')
                .data(frame.get('nodes'), function (d) {
                    return d.id;
                });

            // Remove nodes from the SVG that are not in the data.
            node.exit()
                .transition()
                .duration(100)
                .style('opacity', 0)
                .remove();

            // Create nodes that are not already present on the SVG.
            node.enter()
                .append("circle")
                .attr("class", "node")
                .attr("id", function (d) {
                    return d.id;
                })
                .attr("cx", function (d) {
                    // Check if it's a duplicate node.
                    var nodeId = d.id.substr(0, d.id.indexOf('--'));
                    if (nodeId) {
                        return that.get('frame')
                            .get('nodes')
                            .findBy("id", nodeId).x;
                    } else {
                        return frame.get('nodes')
                            .findBy("id", d.id).x;
                    }
                })
                .attr("cy", function (d) {
                    // Check if it's a duplicate node.
                    var nodeId = d.id.substr(0, d.id.indexOf('--'));
                    if (nodeId) {
                        return that.get('frame')
                            .get('nodes')
                            .findBy("id", nodeId).y;
                    } else {
                        return frame.get('nodes')
                            .findBy("id", d.id).y;
                    }
                })
                .attr("r", frame.get('radius'))
                .style("fill", function (d) {
                    return d.fill;
                })
                .style("opacity", 0.7)
                .style("stroke", function (d) {
                    return d3.rgb(d.fill).darker(2);
                })
                .on('click', function (d) {
                    that.send('nodeClick', d, frame);
                });

            // Transition into the new node positions.
            node.transition().duration(1000)
                .attr('cx', function (d) {
                    return d.x;
                })
                .attr('cy', function (d) {
                    return d.y;
                })
                .each("end", _.once(function () {
                    that.send('showLabels', frame);
                }));


            this.set('frame', frame);
            NProgress.done();
        }
    }
});