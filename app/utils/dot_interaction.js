import { select } from 'd3-selection';

export function normalizeDots(canvasSelector, toSize) {
  select(canvasSelector).selectAll('.dot')
    .classed('selected', false)
    .transition()
    .attr('r', toSize);
}

export function growDots(canvasSelector, respId, toSize) {
  select(canvasSelector).selectAll('.dot.resp-' + respId)
    .classed('selected', true)
    .raise()
    .transition()
    .attr('r', toSize);
}
