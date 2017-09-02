import { select } from 'd3-selection';

export function normalizeDots(canvasSelector, toSize) {
  select(canvasSelector).selectAll('.dot')
    .transition()
    .attr('r', toSize);
}

export function growDots(canvasSelector, dot, toSize) {
  select(canvasSelector).selectAll('.dot.resp-' + dot.respId)
    .transition()
    .attr('r', toSize);
}
