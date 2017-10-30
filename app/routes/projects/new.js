import Ember from 'ember';

export default Ember.Route.extend({
  templateName: 'projects/edit',
  controllerName: 'projects/edit',
  model () {
    const width = (Ember.$(window).width() - 333) * 85 / 100;
    const height = Ember.$(window).height() * 65 / 100;

    return this.get('store').createRecord('project', {
      width: width,
      height: height,
      frames: [],
      layouts: {},
      currentFrameIndex: 0,
      showAsScroll: true,
    });
  },
  setupController(controller, model) {
    this._super(controller, model);
    controller.setup();
  }
});
