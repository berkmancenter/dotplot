import Ember from 'ember';

export function isStepCompleted([survey, step]) {
  if (step === 1 && survey) {
    return true;
  }
  return false;
}

export default Ember.Helper.helper(isStepCompleted);
