import _ from 'lodash';
import { scaleOrdinal, schemeCategory20 } from 'd3-scale';
import { rgb } from 'd3-color';
import { select } from 'd3-selection';
import { forceSimulation, forceX, forceY, forceCollide } from 'd3-force';
import 'd3-transition';

let fillScales = {};

function buildPositionForce(layoutFoci, colorFoci, config) {
  const layoutFociMap = _.keyBy(layoutFoci, 'id');
  const colorFociMap = _.keyBy(colorFoci, 'id');

  let fociXForce, fociYForce, colorXForce, colorYForce;

  function force(alpha) {
    if (alpha < config.forceFociTransition) {
      fociXForce(alpha);
      fociYForce(alpha);
    } else {
      colorXForce(alpha);
      colorYForce(alpha);
    }
  }

  force.initialize = function(nodes) {
    fociXForce = forceX(r => {
      return layoutFociMap[r.layoutFocus].x;
    });
    fociYForce = forceY(r => layoutFociMap[r.layoutFocus].y);
    colorXForce = forceX(r => {
      return r.colorFocus ? colorFociMap[r.colorFocus].x : 0;
    });
    colorYForce = forceY(r => {
      return r.colorFocus ? colorFociMap[r.colorFocus].y : 0;
    });

    fociXForce.initialize(nodes);
    fociYForce.initialize(nodes);
    colorXForce.initialize(nodes);
    colorYForce.initialize(nodes);
  }

  return force;
}

function getFill(colorFrame, d, missingColor) {
  if (!d.colorFocus) { return missingColor; }
  if (!fillScales[colorFrame.columnId]) {
    const fill = scaleOrdinal(schemeCategory20);
    fillScales[colorFrame.columnId] = fill;
  }
  return fillScales[colorFrame.columnId](d.colorFocus);
}

function d3Transition(canvasSelector, config, dotData, layoutFrame, colorFrame, selectedResponse, onClick) {
  const dots = select(canvasSelector)
    .selectAll('.dot')
    .data(dotData, d => d.id);

  // Update
  dots
    .transition()
    .duration(config.transition)
    .attr('cx', d => d.x)
    .attr('cy', d => d.y);

  // Exit
  dots.exit()
    .transition()
    .duration(config.transitionOut)
    .style('opacity', 0)
    .remove();

  const center = { x: select(canvasSelector).attr('width') / 2,
                   y: select(canvasSelector).attr('height') / 2 };

  // Enter
  dots.enter()
    .append('circle')
    .each(d => {
      const spawnFrom = select('.dot.resp-' + d.respId);
      if (spawnFrom.size() > 0) {
        d.spawnFrom = {
          x: spawnFrom.attr('cx'),
          y: spawnFrom.attr('cy')
        };
      } else {
        d.spawnFrom = center; }})
    .attr('class', d => `dot foci-${d.layoutFocus} resp-${d.respId}`)
    .classed('selected', d => d.respId === selectedResponse)
    .attr('r', d => {
      if (d.respId === selectedResponse) {
        return config.dotExpansionOnSelect + layoutFrame.radius;
      }
      return layoutFrame.radius; })
    .attr('cx', d => d.spawnFrom.x)
    .attr('cy', d => d.spawnFrom.y)
    .style('fill', d => getFill(colorFrame, d, config.missingColor))
    .style('stroke', d => rgb(getFill(colorFrame, d, config.missingColor)).darker(2))
    .on('click', onClick)
    .style('opacity', 0)
    .transition()
    .duration(config.transitionIn)
    .attr('cx', d => d.x)
    .attr('cy', d => d.y)
    .style('opacity', config.opacity);

  select(canvasSelector).selectAll('.dot.selected').raise();

  return new Promise(function(resolve) {
    // Resolve after all transitions have run. Note that the longest may not
    // run, so there might be a gap.
    setTimeout(() => resolve(dotData),
        Math.max(
          config.transitionIn,
          config.transition,
          config.transitionOut));
  });
}

function limitPrecision(dots) {
  return _.map(dots, d => {
    const attrs = ['x', 'y', 'vx', 'vy'];
    attrs.forEach(attr => {
      if (d[attr]) {
        d[attr] = Math.round(d[attr] * 100) / 100;
      }
    });
    return d;
  });
}

function d3Layout(config, dotData, layoutFoci, colorFoci, radius, onTick) {
  const collisionForce = forceCollide()
    .radius(radius)
    .strength(config.collisionStrength);
  const positionForce = buildPositionForce(layoutFoci, colorFoci, config);
  const force = forceSimulation()
    .nodes(dotData)
    .force('collision', collisionForce)
    .force('foci', positionForce)
    .velocityDecay(config.velocityDecay)
    .stop();
  const numTicks =
    Math.ceil(Math.log(force.alphaMin()) / Math.log(1 - force.alphaDecay()));

  return new Promise(function(resolve) {
    setTimeout(function() {
      for (var i = 0; i < numTicks; ++i) {
        force.tick();
        onTick(i, numTicks);
      }
      resolve(limitPrecision(force.nodes()));
    }, 0);
  });
}

export { d3Layout, d3Transition };
