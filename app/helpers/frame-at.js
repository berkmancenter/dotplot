import Ember from 'ember';

export function frameAt(params/*, hash*/) {
  const project = params[0];
  const i = params[1];
  const frames = project.get('frames');
  if (frames.length <= i) { return; }
  return frames[i];
}

export default Ember.Helper.helper(frameAt);
