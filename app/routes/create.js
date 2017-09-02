import Ember from 'ember';

export default Ember.Route.extend({
  model () {
    const width = (Ember.$(window).width() - 333) * 85 / 100;
    const height = Ember.$(window).height() * 65 / 100;

    return Ember.RSVP.hash({
      project: this.get('store').createRecord('project', {
        width: width,
        height: height,
        frames: [],
        layouts: {},
        currentFrameIndex: 0
      })
    });
  }
});
