import Ember from 'ember';

export default Ember.Route.extend({
    model: function () {
        return Ember.RSVP.hash({
            frames: this.store.findAll('frame'),
            columns: this.store.findAll('column')
        });
    }
});