import Ember from 'ember';
import d3 from 'd3';
import _ from 'lodash/lodash';

export default Ember.Controller.extend({
    height: 530,
    width: 900,
    getFoci: function (choices, columnId) {
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
        createSingeChoice: function () {
            var that = this;

            d3.csv(this.csvFile, function (d) {
                return {
                    id: d.V1,
                    value: d[that.get('selectedColumn').get('id')]
                };
            }, function (error, rows) {
                rows.forEach(function (row, index) {
                    if (index !== 0) {
                        var nodeObject = that.get('nodes').findBy('id', row.id);
                        _.set(nodeObject, that.get('selectedColumn').get('id'), row.value);
                    }
                });

                var choices = [];

                that.get('nodes').forEach(function (node) {
                    if (!choices.contains(node[that.get('selectedColumn').get('id')])) {
                        choices.pushObject(node[that.get('selectedColumn').get('id')]);
                    }
                });

                var foci = that.getFoci(choices, that.get('selectedColumn').get('id'));

                var frame = that.get('store').createRecord('frame', {
                    id: that.get('selectedColumn').get('id'),
                    title: that.get('frameTitle'),
                    foci: foci,
                    radius: 7,
                    nodes: rows.slice(1),
                    type: "Single Choice",
                    switch: "Click"
                });

                that.send('hideModel', 'createFrame');
                that.set('frame', frame);

                if (!that.d3Init) {
                    that.send('d3Init', frame);
                } else {
                    that.send('singChoicePlot', frame);
                }
            });
        },

        createMultipleChoice: function () {
            var that = this;
            d3.csv(this.csvFile, function (rows) {
                rows.forEach(function (row, index) {
                    if (index !== 0) {
                        var nodeObject = that.get('nodes').findBy('id', row.V1);
                        that.get('selectedColumn').get('choice').forEach(function (type) {
                            var dummyNode = {
                                id: nodeObject.id + '_' + type,
                                x: nodeObject.x,
                                y: nodeObject.y
                            };
                            dummyNode[that.get('selectedColumn').get('id')] = type;
                            that.get('nodes').pushObject(dummyNode);
                        });
                        that.get('nodes').removeObject(nodeObject);
                    }
                });
                
                var foci = that.getFoci(that.get('selectedColumn').get('choice'), that.get('selectedColumn').get('id'));

                var frame = that.get('store').createRecord('frame', {
                    id: that.get('selectedColumn').get('id'),
                    title: that.get('frameTitle'),
                    foci: foci,
                    radius: 7,
                    nodes: rows.slice(1),
                    type: "Single Choice",
                    switch: "Click"
                });

                that.send('hideModel', 'createFrame');
                that.set('frame', frame);

                if (!that.d3Init) {
                    that.send('d3Init', frame);
                } else {
                    that.send('singChoicePlot', frame);
                }
            });
        },

        deleteFrame: function (frame) {
            this.get('store').deleteRecord(frame);
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
            var nodes = [];
            var csvFile = URL.createObjectURL(file[0]);

            that.set('csvFile', csvFile);
            that.send('hideModel', 'fileUpload');

            d3.csv(csvFile, function (d) {
                _.forEach(d[0], function (column, id) {
                    if (id.indexOf('TEXT') === -1 && id.indexOf('Q') === 0) {
                        if (id.indexOf('_') > 0) {
                            var newId = id.substr(0, id.indexOf('_'));
                            if (!that.get('store').hasRecordForId('column', newId)) {
                                that.get('store').createRecord('column', {
                                    id: newId,
                                    text: column.substr(0, column.indexOf('-')),
                                    choice: []
                                });
                            } else {
                                that.get('store').findRecord('column', newId).then(function (column) {
                                    column.choice.pushObject(id);
                                });
                            }
                        } else {
                            that.get('store').createRecord('column', {
                                id: id,
                                text: column
                            });
                        }
                    }
                });
            });

            d3.csv(csvFile, function (rows) {
                rows.forEach(function (row, index) {
                    if (index !== 0) {
                        nodes.pushObject({
                            id: row.V1
                        });
                    }
                });
                that.set('nodes', nodes);
            });
        },

        selectColumn: function (column) {
            Ember.$("#column_" + column.get('id')).addClass("active").siblings().removeClass('active');
            this.set('selectedColumn', column);
        },

        d3Init: function (frame) {
            this.set('d3Init', true);
            var nodes = this.get('nodes');

            var svg = d3.select(".dotplot-nodes").append("svg")
                .attr("width", this.width)
                .attr("height", this.height);

            var fill = d3.scale.category20();

            var node = svg.selectAll(".node")
                .data(nodes)
                .enter().append("circle")
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
                    return fill(d[frame.get('id')]);
                })
                .style("stroke", function (d, i) {
                    return d3.rgb(fill(i)).darker(2);
                });

            this.set('node', node);
            
            this.send('singChoicePlot', frame);
        },

        singChoicePlot: function (frame) {
            var that = this;
            var foci = frame.get('foci');

            function drawNode(alpha) {
                return function (d) {
                    var center = foci[d[frame.get('id')]];
                    d.x += (center.x - d.x) * 0.09 * alpha;
                    d.y += (center.y - d.y) * 0.09 * alpha;
                };
            }

            function tick(e) {
                that.get('node').each(drawNode(e.alpha));
                that.get('node').attr("cx", function (d) {
                        return d.x;
                    })
                    .attr("cy", function (d) {
                        return d.y;
                    });
            }

            var force = d3.layout.force()
                .nodes(that.get('nodes'))
                .size([that.get('width'), that.get('height')])
                .on("tick", tick);

            this.set('force', force);

            force.start();
        },

        saveNodePositions: function (frame) {
            this.get('node').each(function (node) {
                frame.get('nodes').findBy('id', node.id).x = node.x;
                frame.get('nodes').findBy('id', node.id).y = node.y;
            });
        },

        changeGravity: function (event) {
            var gravity = event.target.value / 100;
            this.get('force').gravity(gravity).start();
        },

        changeCharge: function (event) {
            var charge = -1 * event.target.value;
            this.get('force').charge(charge).start();
        },

        changeRadius: function (event) {
            var radius = event.target.value;
            var node = d3.select(".dotplot-nodes > svg").selectAll('circle.node');
            node.transition().duration(1000).attr('r', radius);
        },

        selectFrame: function (frame) {
            this.set('frame', frame);
            var node = d3.select(".dotplot-nodes > svg").selectAll('circle.node').data(this.get('nodes'));
            this.set('node', node);
            node.transition().duration(1000)
                .attr('cx', function (d) {
                    return frame.get('nodes').findBy('id', d.id).x;
                })
                .attr('cy', function (d) {
                    return frame.get('nodes').findBy('id', d.id).y;
                });
        }
    }
});