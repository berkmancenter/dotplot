import _ from 'lodash';
import { scaleOrdinal, schemeCategory20 } from 'd3-scale';
import { rgb } from 'd3-color';
import { select } from 'd3-selection';
import { forceSimulation, forceX, forceY, forceCollide } from 'd3-force';
import 'd3-transition';

//import { drag as d3Drag } from 'd3-drag';
//import serverRender from './server-render';

//TODO - related to dragging
/*
function getNodeIds(controller, d) {
    controller.send('removeLabels');
    var frameId = controller.get('frame')
        .get('id');
    var nodes = controller.get('frame')
        .get('dots')
        .filterBy(
            frameId,
            d[frameId]
        );
    nodes = _.map(nodes, function (node) {
        return '#' + node.id;
    });
    nodeIds = _.toString(nodes);
}

function fociUpdate(controller, d) {
    controller.send('updateNodePosition', d);
    controller.send('showLabels', controller.get('frame'), true);
}
*/

//TODO
/*
function serverPlot(frame) {
  const foci = _.keyBy(frame.get('foci'), 'id');
  this.send('removeLabels');
  var serverObject = {
    frame: frame,
    foci: foci,
    charge: this.get('charge'),
    gravity: this.get('gravity'),
    width: this.get('width'),
    height: this.get('height')
  };

  function plotNodes(controller, nodes) {
    frame.set('dots', nodes);
    select('.dotplot-nodes > svg')
      .selectAll('circle.node')
      .data(nodes, function (d) {
        return d.id;
      })
    .transition()
      .attr('cx', function (d) {
        return d.x;
      })
    .attr('cy', function (d) {
      return d.y;

    });
    controller.send('showNotification', 'success',
        'Server render completed, you can now modify it.', true);
    NProgress.done();
    controller.set('frame', frame);
    if (!controller.get('labels')) {
      return;
    } else {
      controller.send('showLabels', frame, true);
    }
  }
  serverRender(serverObject)
    .then(
        plotNodes.bind(
          this,
          controller
          )
        );
}
*/


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

function d3Transition(canvasSelector, config, dotData, layoutFrame, colorFrame, onClick) {
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

  // Enter
  dots.enter()
    .append('circle')
    .attr('class', d => `dot foci-${d.layoutFocus} resp-${d.respId}`)
    .attr('r', layoutFrame.radius)
    .attr('cx', select(canvasSelector).attr('width') / 2)
    .attr('cy', select(canvasSelector).attr('height') / 2)
    .style('fill', d => getFill(colorFrame, d, config.missingColor))
    .style('stroke', d => rgb(getFill(colorFrame, d, config.missingColor)).darker(2))
    .on('click', onClick)
    .style('opacity', 0)
    .transition()
    .duration(config.transitionIn)
    .attr('cx', d => d.x)
    .attr('cy', d => d.y)
    .style('opacity', config.opacity);

  return new Promise(function(resolve) {
    // Resolve after all transitions have run. Note that the longest may not
    // run, so there might be a gap.
    setTimeout(() => resolve(dotData),
        Math.max(
          config.transitionIn,
          config.transition,
          config.transitionOut));
  });

    //TODO
    //.call(drag);
    /*
    let nodeIds = '';
    var drag = d3Drag()
      .on('start', getNodeIds.bind(this, controller))
      .on('drag', function () {
        controller.send('changeFoci', nodeIds, event);
      })
      .on('end', fociUpdate.bind(this, controller));

  if (renderOnServer) {
    serverPlot(frame);
  } else {
    d3Plot(frame, true);
  }
    */

  /*
     var drag = d3Drag()
     .on('start', getNodeIds.bind(this, controller))
     .on('drag', function () {
     controller.send('changeFoci', nodeIds, event);
     })
     .on('end', fociUpdate.bind(this, controller));
   */
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
