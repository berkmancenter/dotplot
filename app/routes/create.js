import Ember from 'ember';

export default Ember.Route.extend({
  model () {
    return Ember.RSVP.hash({
      project: this.get('store').createRecord('project')
    });
  }
});
