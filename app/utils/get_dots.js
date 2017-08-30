import _ from 'lodash';

function multipleChoiceDot(column, resp, choice, first) {
  let newDot = { id: resp.identifier };
  if (!first) { newDot.id += '--' + choice; }
  return newDot;
}

function multipleChoiceTypes(column, resp) {
  let dots = [];
  let first = true;
  column.choices.forEach(function(choice) {
    if (!resp.answers[choice]) { return; }
    const newDot = multipleChoiceDot(column, resp, choice, first);
    first = false;
    dots.push(newDot);
  });
  return dots;
}

function singleChoiceDot(column, resp, existingDots) {
  let newDot = {};
  if (!resp.answers[column.header]) { return; }

  const existing = _.find(existingDots, ['id', resp.identifier]);

  if (!existing) {
    newDot['id'] = resp.identifier;
    newDot[column.header] = resp.answers[column.header];
    return newDot;
  }

  existing[column.header] = resp.answers[column.header];
  return existing;
}

function processSingleChoice(column, survey, existingDots) {
  let dots = [];
  survey.get('responses').forEach(function(resp) {
    var newDot = singleChoiceDot(column, resp, existingDots);
    if (!newDot) { return; }
    dots.push(newDot);
  });
  return dots;
}

function processMultipleChoice(column, survey, existingDots) {
  let dots = [];
  survey.get('responses').forEach(function(resp) {
    var newDots = multipleChoiceTypes(column, resp, existingDots);
    if (!newDots.length) { return; }
    dots = dots.concat(newDots);
  });
  return dots;
}

export default function (column, survey, existingDots) {
  return new Promise(function (resolve, reject) {
    if (column.type === 'Single Choice') {
      resolve(processSingleChoice(column, survey, existingDots));
    } else if (column.type === 'Multiple Choice') {
      resolve(processMultipleChoice(column, survey, existingDots));
    } else {
      reject('Invalid FrameType: ' + column.type);
    }
  });
}
