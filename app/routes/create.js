import Ember from 'ember';

export default Ember.Route.extend({
    model: function () {
        return Ember.RSVP.hash({
            frames: this.store.findAll('frame'),
            nodes: this.store.findAll('node')
        });
    }
});