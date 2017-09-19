import DS from 'ember-data';
import Ember from 'ember';
import _ from 'lodash';


// This should be broken down.
function calcCenter(dots, focus) {
  if (focus) {
    dots = _.filter(dots, ['layoutFocus', focus.id]);
  }
  const x = _.meanBy(dots, 'x'),
        y = _.meanBy(dots, 'y');
  return { x, y };
}

function stretchLayout(canvasDims, padding, foci, dots) {
  // I want to spread out the foci such that they all fit on the screen, and
  // yet if there are only a few foci, they don't get pushed too far apart.
  //
  // I have the foci locations of the prerendered layout, and the current set
  // of dots. The current set of dot locations need not be related to the
  // prerendered foci locations.
  //
  // For each set of dots within each focus group, I need to figure out how
  // much to shift them.

  const optimalXDistance = 150; // pixels
  const optimalYDistance = Math.max(optimalXDistance * (canvasDims.height / canvasDims.width), 100); // pixels
  const scaleFactorMargin = 0.1;

  if (foci.length === 1) { return dots; }

  const fociZeroCenter = calcCenter(dots, foci[0]);
  const fociOneCenter = calcCenter(dots, foci[1]);

  const xDistBetweenFoci = fociOneCenter.x - fociZeroCenter.x;

  const firstRowY = foci[0].y;
  const nextRowFoci = _.find(foci, f => f.y !== firstRowY);

  let xScaleFactor = optimalXDistance / xDistBetweenFoci;
  let yScaleFactor = 1;
  if (nextRowFoci) {
    const nextRowCenter = calcCenter(dots, nextRowFoci);
    let yDistBetweenFoci = nextRowCenter.y - fociZeroCenter.y;
    yScaleFactor = optimalYDistance / yDistBetweenFoci;
  }

  if (1.0 - scaleFactorMargin < xScaleFactor && 1.0 + scaleFactorMargin > xScaleFactor &&
      1.0 - scaleFactorMargin < yScaleFactor && 1.0 + scaleFactorMargin > yScaleFactor) {
    xScaleFactor = 1;
    yScaleFactor = 1;
  }

  let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
  dots.forEach(d => {
    if (d.x < minX) { minX = d.x; }
    if (d.y < minY) { minY = d.y; }
    if (d.x > maxX) { maxX = d.x; }
    if (d.y > maxY) { maxY = d.y; }
  });

  const drawnWidth = maxX - minX,
        drawnHeight = maxY - minY;

  const oldCenterX = drawnWidth / 2 + minX,
        oldCenterY = drawnHeight / 2 + minY;
  const newCenterX = (canvasDims.width - padding.left - padding.right) / 2 + padding.left,
        newCenterY = (canvasDims.height - padding.top - padding.bottom) / 2 + padding.top;

  if (drawnWidth * xScaleFactor > canvasDims.width) {
    xScaleFactor = (canvasDims.width - padding.left - padding.right) / drawnWidth;
  }
  if (drawnHeight * yScaleFactor > canvasDims.height) {
    yScaleFactor = (canvasDims.height - padding.top - padding.bottom) / drawnHeight;
  }

  const xShift = newCenterX - oldCenterX * xScaleFactor,
        yShift = newCenterY - oldCenterY * yScaleFactor;

  const fociShifts = {};
  foci.forEach(focus => {
    const center = calcCenter(dots, focus);
    const newX = center.x * xScaleFactor + xShift,
          newY = center.y * yScaleFactor + yShift;
    fociShifts[focus.id] = {
      x: newX - center.x,
      y: newY - center.y
    };
  });


  const newDots = dots.map(d => {
    d.x += fociShifts[d.layoutFocus].x;
    d.y += fociShifts[d.layoutFocus].y;
    return d;
  });

  return newDots;
}

function getDots(responses, layoutFrame, colorFrame) {
  // All the dots that are generated for the color frame should continue to
  // exist throughout all subsequent frames. This means that if the color frame
  // allows multiple answers for its question, there will continue to be
  // multiple dots per response for all frames. For other frames that also
  // allow multiple answers, the number of dots will be multiplicative.
  //
  // For example, response A for Q1 has answers "Maine" and "Vermont", for
  // Q2 has answers "Apple" and "Pear", and for Q3 has single answer "Left". If
  // Q1 is color frame and layout frame, response A has two dots ("Maine-Maine" and
  // "Vermont-Vermont") of two different colors in two different foci. If we now move
  // to Q2 as the layout frame, response A needs four dots: "Maine-Apple",
  // "Maine-Pear", "Vermont-Apple", "Vermont-Pair". Two dots are new. We'll
  // arbitrarily pick the first answer for Q2 to take the old dots and we'll
  // create the remaining two. Now if Q3 is the layout frame, we're back to two
  // dots: "Maine-Left" and "Vermont-Left".
  //
  // What the above shows is that there needs to be a distinction drawn between
  // the nodes that will transition on to each frame and those that will only
  // exist for the single frame. To do that, we need to make sure that those
  // dots that continue on have a consistent ID that depends on the color frame
  // but not the layout frame.

  let dots = [];
  const layoutCol = layoutFrame.columnId;
  const colorCol = colorFrame.columnId;

  responses.forEach(resp => {
    const layoutAns = resp.answerIds[layoutCol];
    const colorAns = resp.answerIds[colorCol];
    if (_.isEmpty(layoutAns)) { return; }

    layoutAns.forEach(layoutAnsId => {
      let dotTemplate = {
        id: resp.id,
        respId: resp.id,
        layoutFocus: layoutAnsId,
      };

      if (_.isEmpty(colorAns) || layoutCol === colorCol) {
        let dot = dotTemplate;
        dot.id += `:${layoutCol}_${layoutAnsId}`;
        if (layoutCol === colorCol) {
          dot.colorFocus = dot.layoutFocus;
        }
        dots.push(dot);
        return;
      }

      colorAns.forEach((colorAnsId, j) => {
        let dot = _.clone(dotTemplate);
        dot.colorFocus = colorAnsId;
        dot.id += `:${colorCol}_${colorAnsId}`;
        if (j > 0) {
          dot.id += `|${layoutCol}_${layoutAnsId}`;
        }
        dots.push(dot);
      });
    });
  });

  return dots;
}

export default DS.Model.extend({
  frames: DS.attr(),
  survey: DS.attr(),
  width: DS.attr('number'),
  height: DS.attr('number'),
  colorByFrameId: DS.attr(),
  currentFrameIndex: DS.attr(),
  layouts: DS.attr(),
  title: DS.attr(),
  showAsScroll: DS.attr('boolean'),

  layoutHasBeenSimulated(layoutFrame, colorFrame) {
    const layouts = this.get('layouts');
    const colorFrameId = colorFrame.columnId,
          layoutFrameId = layoutFrame.columnId;
    return layouts[colorFrameId] && layouts[colorFrameId][layoutFrameId] &&
      _.has(layouts[colorFrameId][layoutFrameId][0], 'vx');
  },

  updateLayouts(layoutFrame, colorFrame, dots) {
    let layouts = this.get('layouts');
    const colorFrameId = colorFrame.columnId,
          layoutFrameId = layoutFrame.columnId;
    if (!layouts[colorFrameId]) {
      layouts[colorFrameId] = {};
    }
    layouts[colorFrameId][layoutFrameId] = dots;
    this.set('layouts', layouts);
    return dots;
  },

  dots(layoutFrame, colorFrame, canvasDims, padding) {
    let layouts = this.get('layouts');
    const colorFrameId = colorFrame.columnId,
          layoutFrameId = layoutFrame.columnId;
    let dots;

    if (layouts[colorFrameId] && layouts[colorFrameId][layoutFrameId]) {
      dots = layouts[colorFrameId][layoutFrameId];
    } else {
      dots = getDots(this.get('survey').responses, layoutFrame, colorFrame);
      const normedLayout = stretchLayout({ width: 10000, height: 10000}, { top: 0, left: 0, bottom: 0, right: 0 }, layoutFrame.foci, dots);
      this.updateLayouts(layoutFrame, colorFrame, normedLayout);
    }

    dots = stretchLayout(canvasDims, padding, layoutFrame.foci, dots);
    return dots;
  },

  colorByFrame: Ember.computed('frames', 'colorByFrameId', function() {
    const frameId = this.get('colorByFrameId');
    return _.find(this.get('frames'), ['columnId', frameId]);
  }),

  currentFrame: Ember.computed('frames', 'currentFrameIndex', {
    get() {
      const frames = this.get('frames'),
            i = this.get('currentFrameIndex');
      if (frames.length <= i) { return; }
      return frames[i];
    },
    set(key, value) {
      const frames = this.get('frames'),
            frame = value;
      this.set('currentFrameIndex', frames.indexOf(frame));
      return value;
    }
  }),

  getDotInfo(dot) {
    let info = [];

    const resp = _.find(this.get('survey').responses, ['id', dot.respId]);
    this.get('survey').columns.forEach(col => {
      if (!resp.answers[col.id]) { return; }
      info.push({
        question: col.question,
        answer: resp.answers[col.id].join('; ')
      });
    });

    return info;
  },

  hasPreviousFrame: Ember.computed('currentFrameIndex', function() {
    return this.get('currentFrameIndex') > 0;
  }),

  hasNextFrame: Ember.computed('currentFrameIndex', 'frames', function() {
    return this.get('currentFrameIndex') < this.get('frames').length - 1;
  }),

  frameAt(i) {
    const frames = this.get('frames');
    if (frames.length <= i) { return; }
    return frames[i];
  }
});
