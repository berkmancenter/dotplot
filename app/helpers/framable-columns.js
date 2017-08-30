import Ember from 'ember';
import { QTYPES } from '../utils/qualtrics_import';

export function framableColumns(params/*, hash*/) {
  if (params.length === 0 || !params[0]) { return; }
  return params[0].filter(c => [QTYPES.SINGLE, QTYPES.MULTIPLE].includes(c.type));
}

export default Ember.Helper.helper(framableColumns);
