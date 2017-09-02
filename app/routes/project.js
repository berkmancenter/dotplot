import Ember from 'ember';

export default Ember.Route.extend({
  model (params) {
    return {
      project: this.get('store').findRecord('project', params.project_id),
      currentFrameIndex: 0,
    };
  }
});
