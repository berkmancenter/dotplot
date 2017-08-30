import Ember from 'ember';
import { QTYPES } from '../utils/qualtrics_import';

const typeToText = {};
typeToText[QTYPES.SINGLE] = 'Single Choice';
typeToText[QTYPES.MULTIPLE] = 'Multiple Choice';
typeToText[QTYPES.TEXT] = 'Text';
typeToText[QTYPES.MULTITEXT] = 'Multiple Text';

export function questionType(params/*, hash*/) {
  return typeToText[params[0]];
}

export default Ember.Helper.helper(questionType);
