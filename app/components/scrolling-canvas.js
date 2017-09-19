import Ember from 'ember';
import 'dotplot/utils/jquery.waypoints';
import config from '../config';
import { select } from 'd3-selection';
import 'd3-transition';

export default Ember.Component.extend({
  shift(toOffset) {
    select('#canvas-wrapper')
      .transition()
      .duration(config.viewer.transition)
      .style('top', toOffset + 'px');
  },

  didInsertElement() {
    const component = this;
    Ember.$('.scrolling-frame').waypoint(function(dir) {
      if (dir === 'down') {
        component.shift(this.element.offsetTop + component.get('dims').height);
        component.get('nextFrame')();
      } else if (dir === 'up') {
        component.shift(this.element.offsetTop);
        component.get('prevFrame')();
      }
    }, { offset: config.viewer.scrollOffset });
  },
});
