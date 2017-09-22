import Ember from 'ember';

export default Ember.Component.extend({
  didInsertElement() {
    if (this.afterInsert) {
      this.afterInsert();
    }
  }
});
