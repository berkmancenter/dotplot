import Ember from 'ember';
import config from '../../config';
import { d3Transition } from '../../utils/plotting';
import { showLabels, removeLabels } from '../../utils/labels';
import { normalizeDots, growDots } from '../../utils/dot_interaction';

const canvasSelector = '#canvas-wrapper > svg';
const labelsSelector = '#foci-labels';

function getCanvasArea() {
  const margins = config.viewer.margins;
  return {
    width: Ember.$(window).width() - margins.width,
    height: Ember.$(window).height() - margins.height
  };
}

function setCanvasDims(dims) {
  Ember.$(canvasSelector)
    .attr('width', dims.width)
    .attr('height', dims.height);
  Ember.$(labelsSelector)
    .css('width', dims.width)
    .css('height', dims.height);
}

export default Ember.Controller.extend({
  canShowDotInfo: true,

  init() {
    const controller = this;
    Ember.$(function() {
      setCanvasDims(getCanvasArea());
      Ember.$(labelsSelector).offset(Ember.$(canvasSelector).offset());
      Ember.$(document).on('keyup', function(e) {
        if (e.which == 37) {
          e.preventDefault();
          controller.send('changeFrame', 'previous');
        }
        if (e.which == 39) {
          controller.send('changeFrame', 'next');
          e.preventDefault();
        }
      });
    });

    this.addObserver('model', this, controller => {
      controller.model.project.then(project => {
        project.set('currentFrameIndex', 0);
        controller.send('selectFrame', project.get('currentFrame'));
      });
    });
  },

  actions: {
    changeFrame: function (type) {
      const controller = this;
      const project = controller.model.project;
      if (type === 'next' && project.get('currentFrameIndex') < project.get('frames').length - 1) {
        project.incrementProperty('currentFrameIndex');
        controller.send('selectFrame', project.get('currentFrame'));
      }
      if (type === 'previous' && project.get('currentFrameIndex') > 0) {
        project.decrementProperty('currentFrameIndex');
        controller.send('selectFrame', project.get('currentFrame'));
      }
    },

    selectFrame(frame) {
      const controller = this;
      const project = controller.model.project;
      project.set('currentFrame', frame);
      controller.send('d3Plot', frame);
    },

    d3Plot: function(frame) {
      const controller = this;
      const project = controller.model.project;

      project.then(project => {
        controller.send('removeLabels');
        function onDotClick(d) {
          if (controller.get('canShowDotInfo')) {
            controller.send('onDotClick', d, frame);
          }
        }

        function onEnd(dots) {
          controller.set('frame', frame);
          controller.send('showLabels', dots, frame, true);
        }

        const colorFrame = project.get('colorByFrame');
        const dots = project.dots(frame, colorFrame, getCanvasArea(), config.viewer.padding);
        d3Transition(canvasSelector, config.viewer, dots, frame, colorFrame, onDotClick)
          .then(onEnd);
      });
    },

    showLabels: function(dots, frame, updatePosition) {
      return showLabels(canvasSelector, labelsSelector, config.viewer, dots, frame, updatePosition); },
    removeLabels: function() { return removeLabels(labelsSelector); },

    onDotClick: function (dot) {
      const controller = this;
      controller.model.project.then(project => {
        const frame = project.get('currentFrame');
        normalizeDots(canvasSelector, frame.radius);
        controller.set('node', dot.id);
        growDots(canvasSelector, dot, frame.radius + config.viewer.dotExpansionOnSelect);
        controller.send('showDotInfo', dot);
      });
    },

    showDotInfo: function (dot) {
      const controller = this;
      controller.model.project.then(project => {
        const info = project.getDotInfo(dot);
        controller.set('info', info);
        Ember.$('#nodeInfo').fadeIn();
      });
    },

    hideDotInfo: function() {
      const controller = this;
      Ember.$('#nodeInfo').fadeOut();
      controller.model.project.then(project => {
        normalizeDots(canvasSelector, project.get('currentFrame').radius);
      });
    },

      /*
        frameTransition: function (frame) {
            NProgress.start();

            this.send('removeLabels');

            // Controller reference.
            var that = this;

            // Update node data.
            var node = select(".dotplot-view-main > svg")
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
                    return rgb(d.fill).darker(2);
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
                .on("end", _.once(function () {
                    that.send('showLabels', frame);
                    NProgress.done();
                }));

            this.set('frame', frame);
        },

        nodeClick: function (node, frame) {
            // Reset node radius.
            selectAll("[id^=" + this.get('node') + "]")
                .transition()
                .duration(500)
                .attr("r", frame.get('radius'));

            var nodeId = node.id;

            // Check if it's a duplicate node.
            if (node.id.indexOf('--') > 0) {
                nodeId = node.id.substr(0, node.id.indexOf('--'));
            }

            // Change radius on node selection.
            selectAll("[id^=" + nodeId + "]")
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
            selectAll("[id^=" + this.get('node') + "]")
                .transition()
                .duration(500)
                .attr("r", that.get('frame').get('radius'));
        },

        showLabels: function (frame) {
            var that = this;

            // Update label data.
            var label = select(".dotplot-view-main > svg")
                .selectAll(".label")
                .data(frame.get('foci'));

            // Create labels that are not already present on the SVG.
            label.enter()
                .append("text")
                .attr("class", "label")
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
            select(".dotplot-view-main > svg")
                .selectAll('text.label')
                .remove();
        }
    */
    }
});
