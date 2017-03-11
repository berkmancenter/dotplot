import Ember from 'ember';
import d3 from 'd3';
import _ from 'lodash';

export default Ember.Controller.extend({
    queryParams: ['id'],

    id: null,

    start: Ember.computed('id', function () {
        var projectId = this.get('id');

        if (projectId) {
            return projectId;
        } else {
            return 'boo';
        }
    }),

    init: function () {
        Ember.run.next(this, function () {
            var that = this;

            var file = '/api/project/' + this.get('id');

            Ember.$.get(file, function () {
                that.send('loadPorject', file);
            }).fail(function () {
                that.set('title', 'You have provided an invalid project id.');
            });
        });
    },

    actions: {
        loadPorject: function (file) {
            NProgress.start();

            var that = this;

            var first = true;

            d3.json(file, function (project) {
                // Update width and height according to window size.
                var height = Ember.$(window).height() - 140;

                var ratio = height / project.height;

                var width = project.width * ratio;

                that.set('width', width);

                that.set('height', height);

                that.set('scale', ratio);

                d3.select(".dotplot-view-main > svg")
                    .attr('width', width)
                    .attr('height', height);

                project.frames.forEach(function (frameData) {
                    // Create a new frame record.
                    var frame = that.get('store')
                        .createRecord('frame', frameData);

                    if (first) {
                        that.send('frameTransition', frame);
                        first = false;
                    }

                    NProgress.inc();
                });

                NProgress.done();
            });
        },

        changeFrame: function (type) {
            var that = this;
            this.get('store')
                .findAll('frame')
                .then(function (frames) {
                    var frameIndex = frames.indexOf(that.get('frame'));

                    if (type === 'next') {
                        var nextFrame = frames.objectAt(frameIndex + 1);

                        if (nextFrame) {
                            that.send('frameTransition', nextFrame);
                        } else {
                            // No More Frames
                        }
                    } else if (type === 'previous') {
                        var previousFrame = frames.objectAt(frameIndex - 1);

                        if (previousFrame) {
                            that.send('frameTransition', previousFrame);
                        } else {
                            // No More Frames
                        }
                    }
                });

        },

        frameTransition: function (frame) {
            NProgress.start();

            this.send('removeLabels');

            // Controller reference.
            var that = this;

            // Update node data.
            var node = d3.select(".dotplot-view-main > svg")
                .selectAll('circle.node')
                .data(frame.get('nodes'), function (d) {
                    return d.id;
                });

            // Remove nodes from the SVG that are not in the data.
            node.exit()
                .transition()
                .duration(500)
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
                    var nodeId = d.id.substr(0, d.id.indexOf('--'));

                    // Check if it's a duplicate node.
                    if (nodeId) {
                        var mainNode = that.get('frame')
                            .get('nodes')
                            .findBy("id", nodeId);

                        if (mainNode) {
                            return mainNode.x * that.get('scale');
                        } else {
                            return that.get('width') / 2;
                        }
                    } else {
                        return that.get('width') / 2;
                    }
                })
                .attr("cy", function (d) {
                    var nodeId = d.id.substr(0, d.id.indexOf('--'));

                    // Check if it's a duplicate node.
                    if (nodeId) {
                        var mainNode = that.get('frame')
                            .get('nodes')
                            .findBy("id", nodeId);

                        if (mainNode) {
                            return mainNode.y * that.get('scale');
                        } else {
                            return that.get('height') / 2;
                        }
                    } else {
                        return that.get('height') / 2;
                    }
                })
                .attr("r", frame.get('radius'))
                .style("fill", function (d) {
                    return d.fill;
                })
                .style("opacity", 0)
                .style("stroke", function (d) {
                    return d3.rgb(d.fill).darker(2);
                })
                .on('click', function (d) {
                    that.send('nodeClick', d, frame);
                });

            // Transition into the new node positions.
            node.transition().duration(1000)
                .style('opacity', 0.7)
                .attr("r", function (d) {
                    var nodeId = d.id;

                    // Check if it's a duplicate node.
                    if (d.id.indexOf('--') > 0) {
                        nodeId = d.id.substr(0, d.id.indexOf('--'));
                    }

                    // Check if the node is highlighted.
                    if (nodeId === that.get('node')) {
                        return frame.get('radius') + 3;
                    } else {
                        return frame.get('radius');
                    }
                })
                .attr('cx', function (d) {
                    return d.x * that.get('scale');
                })
                .attr('cy', function (d) {
                    return d.y * that.get('scale');
                })
                .each("end", _.once(function () {
                    that.send('showLabels', frame);
                    NProgress.done();
                }));

            this.set('frame', frame);
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

            // Change radius on node selection.
            d3.selectAll("[id^=" + nodeId + "]")
                .transition()
                .duration(500)
                .attr("r", frame.get('radius') + 3);

            // Set global node variable.
            this.set('node', nodeId);

            // Display node info.
            this.send('nodeInfo', nodeId);
        },

        nodeInfo: function (nodeId) {
            var info = [];

            this.get('store').findAll('frame').then(function (frames) {
                // Create node info object for each frame.
                frames.forEach(function (frame) {
                    var frameInfo = {
                        question: frame.get('title'),
                        answer: ""
                    };

                    // Get label values based on ids for each node.
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

            // Update info.
            this.set('info', info);

            // Fade-in node info.
            Ember.$("#nodeInfo").fadeIn();
        },

        hideNodeInfo: function () {
            var that = this;

            // Fade-out node info.
            Ember.$("#nodeInfo").fadeOut();

            // Reset node radius.
            d3.selectAll("[id^=" + this.get('node') + "]")
                .transition()
                .duration(500)
                .attr("r", that.get('frame').get('radius'));
        },

        showLabels: function (frame) {
            var that = this;

            // Update label data.
            var label = d3.select(".dotplot-view-main > svg")
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
                    return d.labelx * that.get('scale');
                })
                .attr("dy", function (d) {
                    return d.labely * that.get('scale');
                });

            // Fade-in effect.
            label.transition()
                .duration(500)
                .style("opacity", 0.7)
                .each("end", _.once(function () {
                    NProgress.done();
                }));
        },

        removeLabels: function () {
            d3.select(".dotplot-view-main > svg")
                .selectAll('text.label')
                .remove();
        }
    }
});
