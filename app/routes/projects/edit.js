import Ember from 'ember';

export default Ember.Route.extend({
  templateName: 'projects/edit',
  controllerName: 'projects/edit',
  model(params) {
    return this.get('store').findRecord('project', params.project_id);
  },
  setupController(controller, model) {
    this._super(controller, model);
    controller.setup();
  }
});
