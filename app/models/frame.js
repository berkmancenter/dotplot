import Model from 'ember-data/model';
import attr from 'ember-data/attr';
// import { belongsTo, hasMany } from 'ember-data/relationships';

export default Model.extend({
  title: attr(),
  columnId: attr(),
  radius: attr(),
  foci: attr(),
  type: attr(),
  switch: attr(),
});

