import Model from 'ember-data/model';
import attr from 'ember-data/attr';
import Ember from 'ember';
// import { belongsTo, hasMany } from 'ember-data/relationships';

export default Model.extend({
    title: attr(),
    column: attr(),
    foci: attr(),
    nodes: attr(),
    type: attr(),
    switch: attr(),
    nodeCount: function () {
        if (Ember.isEmpty(this.get('nodes'))){
            return "...";   
        } else {
            return this.get('nodes').length;
        }
    }.property('nodes.[]'),
    fociCount: function () {
        return Object.keys(this.get('foci')).length;
    }.property('foci')
});