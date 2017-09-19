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
        } else if (e.which == 39) {
          controller.send('changeFrame', 'next');
          e.preventDefault();
        }
      });
    });

    this.addObserver('model', this, controller => {
      controller.model.project.then(project => {
        project.set('currentFrameIndex', 0);
        controller.send('selectFrame', project.get('currentFrame'));
        controller.set('dims', getCanvasArea());
      });
    });
  },

  actions: {
    prevFrame() {
      this.send('changeFrame', 'previous');
    },
    nextFrame() {
      this.send('changeFrame', 'next');
    },
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

        function onEnd() {
          controller.set('frame', frame);
        }

        const colorFrame = project.get('colorByFrame');
        const dots = project.dots(frame, colorFrame, getCanvasArea(), config.viewer.padding);
        d3Transition(canvasSelector, config.viewer, dots, frame, colorFrame, onDotClick)
          .then(onEnd);
        controller.send('showLabels', dots, frame, true, config.viewer.transition);
      });
    },

    showLabels: function(dots, frame, updatePosition, delay) {
      return showLabels(canvasSelector, labelsSelector, config.viewer, dots, frame, updatePosition, delay); },
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
  }
});
