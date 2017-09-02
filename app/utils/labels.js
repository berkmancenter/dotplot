import * as config from '../config';
import _ from 'lodash';
import { select } from 'd3-selection';

function calculateX(focus, elem, dots) {
  dots = _.filter(dots, ['layoutFocus', focus.id]);

  const minXDot = _.minBy(dots, d => d.x);
  const maxXDot = _.maxBy(dots, d => d.x);
  const focusWidth = maxXDot.x - minXDot.x;

  focus.labelx = minXDot.x + (focusWidth - elem.getBBox().width) / 2;
  if (_.isNaN(focus.labelx)) { return; }
  return focus.labelx;
}

function calculateY(focus, elem, dots) {
  dots = _.filter(dots, ['layoutFocus', focus.id]);

  const maxYDot = _.maxBy(dots, d => d.y);

  focus.labely = maxYDot.y + 25;
  if (_.isNaN(focus.labely)) { return; }
  return focus.labely;
}

function cleanUp(focus, elem, frame) {
  if (_.isNaN(focus.labelx) || _.isNaN(focus.labely)) {
    elem.remove();
    _.remove(frame.foci, { id: focus.id });
  }
}

function removeLabels(canvasSelector) {
  select(canvasSelector)
    .selectAll('.label')
    .remove();
}

function showLabels(canvasSelector, dots, frame, updatePosition) {
  const label = select(canvasSelector)
    .selectAll('.label')
    .data(frame.foci);

  label.enter()
    .append('text')
    .attr('class', 'label')
    .style('opacity', config.visualConf.opacity)
    .style('font-family', 'Open Sans')
    .text(d => d.text)
    .attr('dx', function(d) {
      if (updatePosition) { return calculateX(d, this, dots); }
      return d.labelx; })
    .attr('dy', function(d) {
      if (updatePosition) { return calculateY(d, this, dots); }
      return d.labely; })
    .each(function(d) { cleanUp(d, this, frame); });
}

export { showLabels, removeLabels };
