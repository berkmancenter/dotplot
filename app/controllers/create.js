import Ember from 'ember';
import d3 from 'd3';
import _ from 'lodash/lodash';

export default Ember.Controller.extend({
    height: 530,
    width: 900,
    actions: {
        createFrame: function () {
            var title = this.columns[this.selectedColumn];
            var id = this.selectedColumn;
            this.store.createRecord('frame', {
                id: id,
                title: title,
                count: 102,
                type: "Single Choice",
                switch: "Click"
            });
            this.send('hideModel', 'createFrame');
            if (!this.d3Init) {
                this.send('d3Init');
            } else {
                this.send('d3Plot');
            }
        },

        deleteFrame: function (frame) {
            this.store.deleteRecord(frame);
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
            d3.csv(csvFile, function (d) {
                that.set('columns', d[0]);
                that.send('hideModel', 'fileUpload');
            });
        },

        selectColumn: function (columnId) {
            var nodes = [];
            var foci = [];
            var fociLocation = {};
            var that = this;

            this.set('selectedColumn', columnId);
            d3.csv(this.csvFile, function (d) {
                return {
                    value: d[columnId]
                };
            }, function (error, rows) {
                _.forEach(rows, function (row, index) {
                    if (index !== 0 && row.value) {
                        nodes.push({
                            id: index,
                            value: row.value
                        });
                    }
                });

                foci = _.uniq(nodes, function (node) {
                    return node.value;
                });

                var fociCount = foci.length;
                var perRow = Math.ceil(Math.sqrt(fociCount));
                var numRow = Math.ceil(Math.sqrt(fociCount));
                var facetIndex = 0;

                for (var i = 0; i < numRow; i++) {
                    var temp = Math.min(perRow, fociCount - (i * perRow));
                    for (var j = 0; j < temp; j++) {
                        fociLocation[foci[facetIndex].value] = {
                            x: Math.ceil((that.width / (temp + 1)) * (j + 1)),
                            y: Math.ceil((that.height / (numRow + 1)) * (i + 1))
                        };
                        facetIndex++;
                    }
                }

                console.log(fociLocation);

                that.set('nodes', nodes);
                that.set('nodeCount', nodes.length);
                that.set('fociCount', foci.length);
                that.set('fociLocation', fociLocation);
            });
        },

        d3Init: function () {
            this.set('d3Init', true);

            var svg = d3.select(".dotplot-nodes").append("svg")
                .attr("width", this.width)
                .attr("height", this.height);

            var fill = d3.scale.category10();

            var node = svg.selectAll(".node")
                .data(this.nodes)
                .enter().append("circle")
                .attr("class", "node")
                .attr("cx", function (d) {
                    return d.x;
                })
                .attr("cy", function (d) {
                    return d.y;
                })
                .attr("r", function (d) {
                    return 7;
                })
                .style("fill", function (d, i) {
                    return fill(d.value);
                })
                .style("stroke", function (d, i) {
                    return d3.rgb(fill(i)).darker(2);
                });

            this.set('node', node);
            this.send('d3Plot');
        },

        d3Plot: function () {

            var that = this;

            function drawNode(alpha) {
                return function (d) {
                    var center = that.fociLocation[d.value];
                    d.x += (center.x - d.x) * 0.09 * alpha;
                    d.y += (center.y - d.y) * 0.09 * alpha;
                };
            }

            function tick(e) {
                that.node.each(drawNode(e.alpha));
                that.node.attr("cx", function (d) {
                        return d.x;
                    })
                    .attr("cy", function (d) {
                        return d.y;
                    });
            }

            var force = d3.layout.force()
                .nodes(this.nodes)
                .size([this.width, this.height])
                .on("tick", tick)
                .start();
        },

        selectFrame: function (frame) {

        }
    }
});