import _ from 'lodash';

export default function getFoci(choices, width, height) {
  var index = 0;

  var foci = [];

  let keys = _.keys(choices);

  // Number of foci required.
  var fociCount = keys.length;

  // Foci per row.
  var perRow = Math.ceil(Math.sqrt(fociCount));

  // Total number of rows.
  var numRow = Math.ceil(Math.sqrt(fociCount));

  for (var i = 0; i < numRow; i++) {
    var temp = Math.min(perRow, fociCount - (i * perRow));

    for (var j = 0; j < temp; j++) {
      // Caluclate foci X and Y coordinates.
      var point = {
        id: parseInt(keys[index]),
        text: choices[keys[index]],
        x: Math.ceil((width / (temp + 1)) * (j + 1)),
        y: Math.ceil((height / (numRow + 1)) * (i + 1))
      };

      index++;

      foci.pushObject(point);
    }
  }

  return foci;
}
