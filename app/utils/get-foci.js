export default function getFoci(choices, width, height) {
  var that = this;

  var index = 0;

  var foci = [];

  // Number of foci required.
  var fociCount = choices.length;

  // Foci per row.
  var perRow = Math.ceil(Math.sqrt(fociCount));

  // Total number of rows.
  var numRow = Math.ceil(Math.sqrt(fociCount));

  for (var i = 0; i < numRow; i++) {
    var temp = Math.min(perRow, fociCount - (i * perRow));

    for (var j = 0; j < temp; j++) {
      // Caluclate foci X and Y coordinates.
      var point = {
        id: choices[index],
        text: choices[index],
        x: Math.ceil((width / (temp + 1)) * (j + 1)),
        y: Math.ceil((height / (numRow + 1)) * (i + 1))
      };

      index++;

      foci.pushObject(point);
    }
  }

  return foci;
}
