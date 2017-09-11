import Ember from 'ember';

export default Ember.Route.extend({
  templateName: 'projects/edit',
  controllerName: 'projects/edit',
  model(params) {
    return Ember.RSVP.hash({
      project: this.get('store').findRecord('project', params.project_id)
    });
  }
});
