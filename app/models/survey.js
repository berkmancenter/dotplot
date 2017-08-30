import DS from 'ember-data';

export default DS.Model.extend({
  // These are stored as attrs because we don't need to do much with them other
  // than create them. Their attributes are documented in their respective
  // models, which we can still create from these JSON objects if there are
  // computed attributes we'd like to access.
  responses: DS.attr(),
  columns: DS.attr(),
});
