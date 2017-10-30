import Ember from 'ember';
import _ from 'lodash';
import NProgress from 'ember-cli-nprogress';
import dialogPolyfill from 'npm:dialog-polyfill';

import config from '../../config';

import getFoci from '../../utils/get-foci';
import { parseQualtrics } from '../../utils/qualtrics_import';
import importJSONData from '../../utils/json_import';
import fetchDots from '../../utils/get_dots';
import { d3Layout, d3Transition } from '../../utils/plotting';
import { showLabels, removeLabels } from '../../utils/labels';
import { normalizeDots, growDots } from '../../utils/dot_interaction';

const canvasSelector = '#canvas-wrapper > svg';
const labelsSelector = '#foci-labels';

function getCanvasArea() {
  const margins = config.editor.margins;
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
  charge: config.editor.charge,
  server: false,
  labels: true,
  canShowDotInfo: true,
  notifications: Ember.inject.service('notification-messages'),
  registeredDialogs: {},

  setup() {
    const controller = this;
    const selectFirstFrame = function() {
      const project = controller.model;
      if (project.get('frames').length > 0) {
        project.set('currentFrameIndex', 0);
        controller.send('selectFrame', project.get('currentFrame'));
      }
    }
    controller.addObserver('model', this, selectFirstFrame);
    controller.set('afterCanvasInsert', selectFirstFrame);
    Ember.$(function() {
      setCanvasDims(getCanvasArea());
    });
  },

  getDots: function(columnId, survey, existingDots) {
    return fetchDots(columnId, survey, existingDots);
  },

  getFoci: function(survey, column) {
    const choices = _.pickBy(column.choices, (choice, cId) => {
      return _.some(survey.responses, r => {
        return r.answerIds[column.id] && r.answerIds[column.id].includes(parseInt(cId));
      });
    });
    const dims = getCanvasArea();
    return getFoci(choices, dims.width, dims.height);
  },

  actions: {
    help: function() {
      const controller = this;
      const project = controller.model;
      project.set('showHelp', true);
    },

    onCreateFrame: function () {
      const controller = this;
      const project = controller.model;
      if (!project.get('survey')) {
        Ember.$('#createFrame').removeClass('zoomIn').addClass('shake');
        window.setTimeout(function () {
          Ember.$('#createFrame').removeClass('shake');
        }, 1000);
      } else {
        Ember.$('#createFrame').addClass('zoomIn');
        controller.send('createFrame');
        controller.send('hideModal', 'createFrame');
      }
    },

    createFrame: function() {
      NProgress.start();
      const controller = this;
      const project = controller.model;
      const column = controller.get('selectedColumn');

      const foci = controller.getFoci(project.get('survey'), column);
      const frame = {
        columnId: column.id,
        title: controller.get('frameTitle'),
        foci: foci,
        radius: config.editor.radius,
        type: column.type,
        switch: 'On Click'
      };
      project.get('frames').pushObject(frame);
      project.notifyPropertyChange('frames');
      if (!project.get('colorByFrameId')) {
        project.set('colorByFrameId', frame.columnId);
      }
      controller.send('selectFrame', frame);
      NProgress.done();
    },

    onNewFrame: function () {
      const controller = this;
      const project = controller.model;

      if (project.get('survey')) {
        controller.send('showModal', 'createFrame');
      } else {
        controller.send('showNotification', 'error',
          'Please add a CSV file to create frames.', true);
      }
    },

    deleteFrame: function (frame) {
      const controller = this;
      const project = controller.model;

      // Elect new frame to color by.
      if (frame.columnId === project.get('colorByFrameId')) {
        const newColorFrame = project.get('frames').find(f => f.columnId !== frame.columnId);
        if (newColorFrame) {
          project.set('colorByFrameId', newColorFrame.columnId);
        } else {
          project.set('colorByFrameId', null);
        }
      }

      project.set('frames', _.remove(project.get('frames'), frame));
      controller.send('showNotification', 'error',
        'Successfully deleted frame ' + frame.title + '.', true);
    },

    showModal: function (modalId) {
      const controller = this;
      const dialog = document.querySelector('#' + modalId);
      if (!controller.registeredDialogs[modalId]) {
        dialogPolyfill.registerDialog(dialog);
      }
      dialog.showModal();
    },

    hideModal: function (modalId) {
      document.querySelector('#' + modalId).close();
    },

    fileUpload: function (file, resetInput) {
      const controller = this;
      const project = controller.model;

      controller.send('hideModal', 'fileUpload');
      const uploadType = file[0].type;

      if (uploadType === 'text/csv') {
        const csvFile = URL.createObjectURL(file[0]);
        controller.set('csvFile', csvFile);
        NProgress.start();
        parseQualtrics(csvFile)
          .then(survey => {
            project.set('survey', survey);
            NProgress.done();
          });
      } else {
        this.send('showNotification', 'error',
          'Invalid file type of uploaded file.', true);
      }
      resetInput();
    },

    importJSONData: importJSONData,
    parseQualtrics: parseQualtrics,

    selectColumn: function (column) {
      Ember.$('#column_' + column.id)
        .addClass('active')
        .siblings()
        .removeClass('active');
      this.set('selectedColumn', column);
      this.set('frameTitle', column.question);
      Ember.$('#frameTitle').addClass('is-focused');
    },

    d3Plot: function(frame, relayout) {
      const controller = this;
      const project = controller.model;

      controller.send('removeLabels');

      const colorFrame = project.get('colorByFrame');
      const needsLayout = !project.layoutHasBeenSimulated(frame, colorFrame) || relayout;

      function onDotClick(d) {
        if (controller.get('canShowDotInfo')) {
          controller.send('onDotClick', d, frame);
        }
      }

      function onEnd(dots) {
        if (needsLayout) {
          NProgress.done();
          controller.send('showNotification', 'success',
            'Force layout completed, you can now modify it.', true);
        }
        controller.set('frame', frame);
        if (controller.get('labels')) {
          controller.send('showLabels', dots, frame, true);
        } else {
          return;
        }
      }

      function onTick(i, numTicks) {
        NProgress.set(i / numTicks);
      }

      const dots = project.dots(frame, colorFrame, getCanvasArea(), config.editor.padding);
      let promise;
      if (needsLayout) {
        NProgress.start();
        const survey = project.get('survey')
        const layoutFoci = controller.getFoci(survey, _.find(survey.columns, ['id', frame.columnId]));
        const colorFoci = controller.getFoci(survey, _.find(survey.columns, ['id', colorFrame.columnId]));
        promise = d3Layout(config.editor, dots, layoutFoci, colorFoci, controller.get('charge'), onTick)
          .then(newDots => project.updateLayouts(frame, colorFrame, newDots))
          .then(dots => d3Transition(canvasSelector, config.editor, dots,
            frame, colorFrame, controller.get('selectedResponse'),
            onDotClick));
      } else {
        promise = d3Transition(canvasSelector, config.editor, dots, frame,
          colorFrame, controller.get('selectedResponse'), onDotClick);
      }
      promise.then(onEnd);
    },

    showLabels: function(dots, frame, updatePosition) {
      return showLabels(canvasSelector, labelsSelector, config.editor, dots, frame, updatePosition); },
    removeLabels: function() { return removeLabels(labelsSelector); },
    updateLabels: function() {
      this.send('hideModal', 'editLabel');
      this.send('removeLabels');
      const project = this.model;
      const dots = project.dots(project.get('currentFrame'), project.get('colorByFrame'), getCanvasArea(), config.editor.padding);
      this.send('showLabels', dots, project.get('currentFrame'), true);
    },

    onDotClick: function (dot) {
      const controller = this;
      const project = controller.model;
      const frame = project.get('currentFrame');
      normalizeDots(canvasSelector, frame.radius);
      controller.set('selectedResponse', dot.respId);
      growDots(canvasSelector, dot.respId, frame.radius + config.editor.dotExpansionOnSelect);
      controller.send('showDotInfo', dot);
    },

    showDotInfo: function (dot) {
      const controller = this;
      const project = controller.model;
      const info = project.getDotInfo(dot);
      controller.set('info', info);
      Ember.$('#nodeInfo').fadeIn();
    },

    hideDotInfo: function() {
      const controller = this;
      const project = controller.model;
      Ember.$('#nodeInfo').fadeOut();
      normalizeDots(canvasSelector, project.get('currentFrame').radius);
    },

    selectFrame: function (frame, relayout) {
      const controller = this;
      const project = controller.model;
      project.set('currentFrame', frame);
      controller.send('d3Plot', frame, relayout);
    },

    selectColorFrame(frame) {
      const controller = this;
      const project = controller.model;
      project.set('colorByFrameId', frame.columnId);
      controller.send('selectFrame', frame);
    },

    moveFrame(frame, dir) {
      const controller = this;
      const project = controller.model;
      const frames = project.get('frames');
      let thisIndex = frames.indexOf(frame);
      if (dir === 'up') {
        if (thisIndex === 0) { return; }
        thisIndex -= 1;
      } else if (dir === 'down') {
        if (thisIndex === frames.length - 1) { return; }
        thisIndex += 1;
      }
      project.set('frames', frames.without(frame).insertAt(thisIndex, frame));
      controller.send('selectFrame', frame);
    },

    showNotification: function (type, message, clear) {
      switch (type) {
        case 'warning':
          this.get('notifications').warning(message, {
            autoClear: clear,
            clearDuration: config.editor.notificationDuration
          });
          break;
        case 'info':
          this.get('notifications').info(message, {
            autoClear: clear,
            htmlContent: true,
            clearDuration: config.editor.notificationDuration
          });
          break;
        case 'error':
          this.get('notifications').error(message, {
            autoClear: clear,
            clearDuration: config.editor.notificationDuration
          });
          break;
        case 'success':
          this.get('notifications').success(message, {
            autoClear: clear,
            clearDuration: config.editor.notificationDuration
          });
          break;
      }
    },

    publish() {
      const controller = this;
      const project = controller.model;
      project.save()
        .then(savedProject => {
          if (controller.get('target') !== 'projects.edit') {
            controller.replaceRoute('projects.edit', savedProject.id);
          } else {
            controller.send('showNotification', 'success',
              'Changes have been saved', true);
          }
        })
        .catch(err => {
          controller.send('showNotification', 'error',
            'Project could not be saved: ' + err, true);
        });
    },

    view() {
      const controller = this;
      const project = controller.model;
      if (project.id === 'sample') {
        controller.transitionToRoute('projects.view', project);
      } else {
        project.save().then(() => controller.transitionToRoute('projects.view', project));
      }
    },

    saveSettings() {
      const controller = this;
      const project = controller.model;
      project.save();
      controller.send('hideModal', 'settings');
    },

    toggleVisible(selector) {
      Ember.$(selector).slideToggle();
    }
  }
});
