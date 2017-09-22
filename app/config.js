import ENV from 'dotplot/config/environment';

export default {
  fuzzy: {
    id: 'id',
    shouldSort: true,
    threshold: 0.3,
    location: 0,
    distance: 100,
    maxPatternLength: 32,
    minMatchCharLength: 3,
    keys: [
        "Q1",
        "Q2",
        "V1",
        "V2"
    ]
  },
  editor: {
    opacity: 0.7,
    transitionIn: 500,
    transition: 500,
    transitionOut: 100,
    notificationDuration: 2000,
    radius: 5,
    charge: 6,
    gravity: 8,
    scale: 1,
    collisionStrength: 0.8,
    missingColor: '#AAA',
    forceFociTransition: 0.45,
    dotExpansionOnSelect: 7,
    velocityDecay: 0.35,
    labelOffset: 10,
    margins: { height: 220, width: 333 },
    padding: { top: 10, right: 10, bottom: 10, left: 10 },
  },
  viewer: {
    opacity: 0.7,
    transitionIn: 1800,
    transition: 1800,
    transitionOut: 500,
    notificationDuration: 2000,
    radius: 5,
    charge: 6,
    gravity: 8,
    scale: 1,
    collisionStrength: 0.8,
    missingColor: '#AAA',
    forceFociTransition: 0.45,
    dotExpansionOnSelect: 7,
    labelOffset: 10,
    margins: { height: 220, width: 100 },
    padding: { top: 10, right: 10, bottom: 10, left: 10 },
    scrollOffset: '-25%',
  },
  endpoints: {
    server: {
      host: ENV.APP.host,
      namespace: 'api'
    }
  }
};


