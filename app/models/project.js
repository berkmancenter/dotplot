import DS from 'ember-data';
import Ember from 'ember';
import _ from 'lodash';

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
  const layoutCol = layoutFrame.get('columnId');
  const colorCol = colorFrame.get('columnId');

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
  frames: DS.hasMany('frame'),
  survey: DS.attr(),
  width: DS.attr('number'),
  height: DS.attr('number'),
  colorByFrameId: DS.attr(),
  layouts: DS.attr(),

  updateLayouts(layoutFrame, colorFrame, dots) {
    let layouts = this.get('layouts');
    if (!layouts) { layouts = {}; }
    const colorFrameId = colorFrame.get('columnId'),
          layoutFrameId = layoutFrame.get('columnId');
    if (!layouts[colorFrameId]) {
      layouts[colorFrameId] = {};
    }
    layouts[colorFrameId][layoutFrameId] = dots;
    this.set('layouts', layouts);
    return dots;
  },

  dots(layoutFrame, colorFrame) {
    let layouts = this.get('layouts');
    if (!layouts) { layouts = {}; }
    const colorFrameId = colorFrame.get('columnId'),
          layoutFrameId = layoutFrame.get('columnId');

    if (layouts[colorFrameId] && layouts[colorFrameId][layoutFrameId]) {
      return layouts[colorFrameId][layoutFrameId];
    }

    const dots = getDots(this.get('survey').responses, layoutFrame, colorFrame);
    this.updateLayouts(layoutFrame, colorFrame, dots);
    return dots;
  },

  colorByFrame: Ember.computed('frames', 'colorByFrameId', function() {
    const frameId = this.get('colorByFrameId');
    return this.get('frames').then(frames => frames.find(f => f.get('columnId') === frameId));
  })
});
