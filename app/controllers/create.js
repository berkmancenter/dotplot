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
                foci[choices[index][columnId]] = {
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
            var that = this;

            d3.csv(this.csvFile, function (d) {
                return {
                    id: d.V1,
                    value: d[that.get('selectedColumn')]
                };
            }, function (error, rows) {
                rows.forEach(function (row, index) {
                    if (index !== 0) {
                        var nodeObject = that.get('nodes').findBy('id', row.id);
                        _.set(nodeObject, that.get('selectedColumn'), row.value);
                    }
                });

                var choices = _.uniq(that.get('nodes'), function (node) {
                    return node[that.get('selectedColumn')];
                });

                var foci = that.getFoci(choices, that.get('selectedColumn'));

                var frame = that.get('store').createRecord('frame', {
                    id: that.get('selectedColumn'),
                    title: that.frameTitle,
                    nodeCount: that.get('nodes').length,
                    column: that.get('selectedColumn'),
                    foci: foci,
                    type: "Single Choice",
                    switch: "Click"
                });

                that.set('frame', frame);
                that.send('hideModel', 'createFrame');
                
                if (!that.d3Init) {
                    that.send('d3Init', frame);
                } else {
                    that.send('d3Plot', frame);
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

            d3.csv(csvFile, function (d) {
                that.set('columns', d[0]);
                that.send('hideModel', 'fileUpload');
            });

            d3.csv(csvFile, function (rows) {
                rows.forEach(function(row, index) {
                    if (index !== 0) {
                        nodes.push({
                            id: row.V1
                        });
                    }
                });
            });
            this.set('nodes', nodes);
        },

        selectColumn: function (columnId) {
            this.set('selectedColumn', columnId);
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
                .attr("cx", function (d) {
                    return d.x;
                })
                .attr("cy", function (d) {
                    return d.y;
                })
                .attr("r", 7)
                .style("fill", function (d) {
                    return fill(d[frame.get('column')]);
                })
                .style("stroke", function (d, i) {
                    return d3.rgb(fill(i)).darker(2);
                });

            this.set('node', node);
            this.send('d3Plot', frame);
        },

        d3Plot: function (frame) {
            var that = this;
            var foci = frame.get('foci');
            var nodes = this.get('nodes');

            function drawNode(alpha) {
                return function (d) {
                    var center = foci[d[frame.get('column')]];
                    d.x += (center.x - d.x) * 0.09 * alpha;
                    d.y += (center.y - d.y) * 0.09 * alpha;
                };
            }

            function tick(e) {
                that.get('node').each(drawNode(e.alpha));
                that.node.attr("cx", function (d) {
                        return d.x;
                    })
                    .attr("cy", function (d) {
                        return d.y;
                    });
            }

            d3.layout.force()
                .nodes(nodes)
                .size([that.get('width'), that.get('height')])
                .on("tick", tick)
                .start();
        },

        selectFrame: function (frame) {
            this.send('d3Plot', frame);
        }
    }
});