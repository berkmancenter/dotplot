import Ember from 'ember';

export default Ember.Route.extend({
  templateName: 'projects/view',
  controllerName: 'projects/view',
  model (params) {
    return {
      project: this.get('store').findRecord('project', params.project_id)
    };
  }
});
