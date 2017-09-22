import Ember from 'ember';

export default Ember.Route.extend({
  templateName: 'projects/view',
  controllerName: 'projects/view',
  model (params) {
    return this.get('store').findRecord('project', params.project_id);
  },
  setupController(controller, model) {
    this._super(controller, model);
    controller.setup();
  }
});
