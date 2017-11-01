import _ from 'lodash';
import $ from 'jquery'
import { select } from 'd3-selection';

function calculateX(focus, elem, dots, offset) {
  dots = _.filter(dots, ['layoutFocus', focus.id]);

  const minXDot = _.minBy(dots, d => d.x);
  const maxXDot = _.maxBy(dots, d => d.x);
  const focusWidth = maxXDot.x - minXDot.x;

  focus.labelx = minXDot.x + (focusWidth - $(elem).outerWidth()) / 2 + offset;
  if (_.isNaN(focus.labelx)) { return; }
  return focus.labelx;
}

function calculateY(focus, elem, dots, offset) {
  dots = _.filter(dots, ['layoutFocus', focus.id]);

  const maxYDot = _.maxBy(dots, d => d.y);

  focus.labely = maxYDot.y + offset;
  if (_.isNaN(focus.labely)) { return; }
  return focus.labely;
}

function cleanUp(focus, elem, frame) {
  if (_.isNaN(focus.labelx) || _.isNaN(focus.labely)) {
    elem.remove();
    _.remove(frame.foci, { id: focus.id });
  }
}

function removeLabels(labelsSelector) {
  select(labelsSelector)
    .selectAll('.label')
    .remove();
}


function showLabels(canvasSelector, labelsSelector, config, dots, frame, updatePosition, delay) {
  const label = select(labelsSelector)
    .selectAll('.label')
    .data(frame.foci);

  delay = delay || 0;

  // We use setTimeout instead of transition delay because dot positions can
  // change during the transition, and we use dot positions to calculate label
  // positions.
  label.enter()
    .append('div')
    .attr('class', 'label')
    .text(d => d.text)
    .style('font-family', 'Open Sans')
    .style('opacity', 0)
    .style('left', function(d) {
      if (updatePosition) { return calculateX(d, this, dots, 0) + 'px'; }
      return d.labelx + 'px'; })
    .style('top', function(d) {
      if (updatePosition) { return calculateY(d, this, dots, config.labelOffset) + 'px'; }
      return d.labely + 'px'; })
    .each(function(d) { cleanUp(d, this, frame); })
    .transition()
    .delay(Math.max(0, delay - 200))
    .duration(200)
    .style('opacity', 1);
}

export { showLabels, removeLabels };
