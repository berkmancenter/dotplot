import Ember from 'ember';

export function shouldShowHelp([survey, frames]) {
  return typeof survey === 'undefined' ||
    typeof frames === 'undefined' ||
    frames.length === 0;
}

export default Ember.Helper.helper(shouldShowHelp);
