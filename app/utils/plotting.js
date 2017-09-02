import _ from 'lodash';
import { scaleOrdinal, schemeCategory20 } from 'd3-scale';
import { rgb } from 'd3-color';
import { select } from 'd3-selection';
import { forceSimulation, forceX, forceY, forceCollide } from 'd3-force';
import * as config from '../config';
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

function d3Init(canvasSelector, frame, width, height) {
  const fill = scaleOrdinal(schemeCategory20);
  fillScales[frame.columnId] = fill;
  select(canvasSelector)
    .attr('width', width)
    .attr('height', height);
}

function buildPositionForce(frame, colorFrame) {
  const foci = _.keyBy(frame.foci, 'id');
  const colorFoci = _.keyBy(colorFrame.foci, 'id');

  let fociXForce, fociYForce, colorXForce, colorYForce;

  function force(alpha) {
    if (alpha < config.visualConf.forceFociTransition) {
      fociXForce(alpha);
      fociYForce(alpha);
    } else {
      colorXForce(alpha);
      colorYForce(alpha);
    }
  }

  force.initialize = function(nodes) {
    fociXForce = forceX(r => {
      return foci[r.layoutFocus].x;
    });
    fociYForce = forceY(r => foci[r.layoutFocus].y);
    colorXForce = forceX(r => {
      return r.colorFocus ? colorFoci[r.colorFocus].x : 0;
    });
    colorYForce = forceY(r => {
      return r.colorFocus ? colorFoci[r.colorFocus].y : 0;
    });

    fociXForce.initialize(nodes);
    fociYForce.initialize(nodes);
    colorXForce.initialize(nodes);
    colorYForce.initialize(nodes);
  }

  return force;
}

function getFill(colorFrame, d) {
  return d.colorFocus ? fillScales[colorFrame.columnId](d.colorFocus) : config.visualConf.missingColor;
}

function d3Transition(canvasSelector, dotData, layoutFrame, colorFrame, onClick) {
  const dots = select(canvasSelector)
    .selectAll('.dot')
    .data(dotData, d => d.id);

  // Update
  dots
    .transition()
    .duration(config.visualConf.transition)
    .attr('cx', d => d.x)
    .attr('cy', d => d.y);

  // Exit
  dots.exit()
    .transition()
    .duration(config.visualConf.transitionOut)
    .style('opacity', 0)
    .remove();

  // Enter
  dots.enter()
    .append('circle')
    .attr('class', d => `dot foci-${d.layoutFocus} resp-${d.respId}`)
    .attr('r', layoutFrame.radius)
    .attr('cx', select(canvasSelector).attr('width') / 2)
    .attr('cy', select(canvasSelector).attr('height') / 2)
    .style('fill', d => getFill(colorFrame, d))
    .style('stroke', d => rgb(getFill(colorFrame, d)).darker(2))
    .on('click', onClick)
    .transition()
    .duration(config.visualConf.transitionIn)
    .attr('cx', d => d.x)
    .attr('cy', d => d.y)
    .style('opacity', config.visualConf.opacity);

  return new Promise(function(resolve) {
    // Resolve after all transitions have run. Note that the longest may not
    // run, so there might be a gap.
    setTimeout(() => resolve(dotData),
        Math.max(
          config.visualConf.transitionIn,
          config.visualConf.transition,
          config.visualConf.transitionOut));
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

function d3Layout(canvasSelector, dotData, layoutFrame, colorFrame, radius, onTick) {
  const collisionForce = forceCollide()
    .radius(radius)
    .strength(config.visualConf.collisionStrength);
  const positionForce = buildPositionForce(layoutFrame, colorFrame);
  const force = forceSimulation()
    .nodes(dotData)
    .force('collision', collisionForce)
    .force('foci', positionForce)
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

export { d3Init, d3Layout, d3Transition };
