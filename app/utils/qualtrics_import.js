//TODO Document that users must download the newer "Data Table" format as CSV
//and go into more options and choose "Split multi-value answers into columns".

import _ from 'lodash';
import { csv as requestCsv } from 'd3-request';

const QTYPES = {
  SINGLE: 1,
  MULTIPLE: 2,
  TEXT: 3,
  MULTITEXT: 4,
  MULTIPLE_MULTITEXT: 5
};

function isIdOfValidCol(id) {
  return id.indexOf('Q') === 0;
}

function parseQuestion(q) {
  const trimmed = q.replace(/[0-9]+(\.|\)) +/, '').replace(/ - (Selected Choice|Other:|Text)/, '')
  return trimmed.slice(0, trimmed.lastIndexOf('-'));
}

function parseChoice(q) {
  const matches = q.match(/- Selected Choice - (.*)$/);
  if (matches && matches[1]) {
    return matches[1];
  }
}

function parseQuestionId(colHeader) {
  const matches = colHeader.match(/(Q\d+)(\D|$)/);
  if (matches && matches.length > 1) {
    return matches[1];
  }
  return colHeader;
}

function uniqueValsInCol(col, csv) {
  let vals = {};
  csv.slice(2).forEach(row => {
    if (row[col]) {
      vals[row[col].trim()] = 1;
    }
  });
  return _.keys(vals);
}

function parseChoices(qId, csv) {
  let choices = {};
  const qType = getQuestionType(qId, csv);

  if (qType === QTYPES.MULTIPLE || qType === QTYPES.MULTIPLE_MULTITEXT) {
    _.toPairs(csv[1]).forEach(idBlob => {
      const colQId = parseQuestionId(idBlob[0]);
      if (colQId !== qId) { return; }

      const blob = JSON.parse(idBlob[1]);
      const choiceId = parseInt(blob['choiceId']);

      if (!choiceId) { return; }

      choices[choiceId] = uniqueValsInCol(idBlob[0], csv)[0];
      // There might be no one who selected this option, so instead try to
      // parse it from the question text.
      if (typeof choices[choiceId] === 'undefined') {
        choices[choiceId] = parseChoice(csv[0][qId + '_' + choiceId]);
      }
    });
  } else if (qType === QTYPES.SINGLE) {
      uniqueValsInCol(qId, csv).forEach((v, i) => choices[i + 1] = v);
  }

  return choices;
}

function getQuestionType(id, csv) {
  const relevantPairs = getQuestionMetadata(id, csv);

  // Has only a single col which also has "TEXT" in ImportId metadata.
  const hasSingleTextCol = (relevantPairs.length === 1 &&
      relevantPairs[0][1].ImportId.endsWith('_TEXT'));
  const hasMultipleTextCol = _.filter(relevantPairs, p => p[1].ImportId.endsWith('_TEXT')).length > 1;
  const hasChoiceCol = _.some(_.map(relevantPairs, p => p[1]), 'choiceId');

  if (hasSingleTextCol) {
    return QTYPES.TEXT;
  }

  // Has multiple cols where ImportId ends in "TEXT"
  if (hasMultipleTextCol) {
    if (hasChoiceCol) {
      return QTYPES.MULTIPLE_MULTITEXT;
    }
    return QTYPES.MULTITEXT;
  }

  // Has only a single col + maybe "Other", and no col has "choiceId" in its
  // metadata.
  if (relevantPairs.length < 3 && !hasChoiceCol) {
    return QTYPES.SINGLE;
  }

  return QTYPES.MULTIPLE;
}

function getQuestionMetadata(id, csv) {
  return _.flow([
      _.toPairs,
      pairs => _.map(pairs, p => [p[0], JSON.parse(p[1])]),
      pairs => _.filter(pairs, p => (p[0] === id || p[0].startsWith(id + '_')))
  ])(csv[1]);
}

function getOtherChoice(id, csv) {
  const relevantPairs = getQuestionMetadata(id, csv);
  const textCols = _.filter(relevantPairs, p => p[1].ImportId.endsWith('_TEXT'));

  // Has multiple columns and only one column ends in "_TEXT".
  if (relevantPairs.length > 1 && textCols.length === 1) {
    let q = csv[0][textCols[0][0]];
    q = q.replace(' - Text', '');
    return q.slice(q.lastIndexOf('-') + 2);
  }
}

function addColumns(csv, survey) {
  let cols = {};

  _.toPairs(csv[0]).forEach(idQuestion => {
    const id = parseQuestionId(idQuestion[0]),
          question = parseQuestion(idQuestion[1]);

    if (!isIdOfValidCol(id)) { return; }

    if (cols[id]) { return; }
    cols[id] = {
      id: id,
      question: question,
      choices: parseChoices(id, csv),
      type: getQuestionType(id, csv),
      otherChoice: getOtherChoice(id, csv)
    };
  });

  survey.columns = _.values(cols);
  return survey;
}

function createResponse(row) {
  let resp = { id: row.ResponseId, answers: {} };
  let fuzzyNode = {};

  _.forOwn(row, function(value, colHeader) {
    const qId = parseQuestionId(colHeader);
    if (_.isEmpty(value) || !qId || !isIdOfValidCol(qId)) return;

    if (!resp.answers[qId]) {
      resp.answers[qId] = [value.trim()];
    } else {
      resp.answers[qId].push(value.trim());
    }

    if (_.isNaN(parseInt(value))) {
      fuzzyNode[qId] = value;
    }
  });

  return { resp: resp, fuzzy: fuzzyNode };
}

function storeResponse(resp, survey) {
  survey.responses.push(resp.resp);
  //TODO do something with fuzzy
  return survey;

  /*
  var storedNode = controller.get('store')
    .createRecord('node', node.node);
  node.fuzzy['id'] = storedNode.get('id');
  controller.get('fuzzyNodes')
    .pushObject(node.fuzzy);
    */
}

function addResponses(csvRows, survey) {
  csvRows.forEach(function (row, index) {
    if (index === 0 || index === 1) return;

    if (row.Finished === 'True') {
      var resp = createResponse(row);
      storeResponse(resp, survey);
    }
  });
}

function removeMultitextNums(survey) {
  const multitextQs = _.flow([
      _.values,
      cols => _.filter(cols, c => c.type === QTYPES.MULTITEXT),
      cols => _.map(cols, 'id')
  ])(survey.columns);

  let cleanedResponses = [];
  survey.responses.forEach(resp => {
    if (_.values(resp.answers).length === 0) { return; }
    multitextQs.forEach(qId => {
      resp.answers[qId] = _.filter(resp.answers[qId], a => !a.match(/#\d+/))
    });
    cleanedResponses.push(resp);
  });
  survey.responses = cleanedResponses;
  return survey;
}

function addAnswerIds(survey) {
  const responses = survey.responses.map(resp => {
    _.keys(resp.answers).forEach(qId => {
      const col = _.find(survey.columns, c => c.id === qId);
      if (!col ||
          ![QTYPES.SINGLE, QTYPES.MULTIPLE, QTYPES.MULTIPLE_MULTITEXT].includes(col.type)) { return; }
      const ansToId = _.invert(col.choices);
      if (!resp.answerIds) { resp.answerIds = {}; }
      resp.answers[qId].forEach(ans => {
        if (!resp.answerIds[qId]) { resp.answerIds[qId] = []; }
        const id = parseInt(ansToId[ans]);
        if (id) {
          resp.answerIds[qId].push(id);
        } else if (col.otherChoice) {
          resp.answerIds[qId].push(parseInt(ansToId[col.otherChoice]));
        }
      });
      resp.answerIds[qId] = _.uniq(resp.answerIds[qId]);
    });
    return resp;
  });
  survey.responses = responses;
  return survey;
}

function cleanUp(survey) {
  survey = removeMultitextNums(survey);
  return addAnswerIds(survey);
}

function parseQualtrics(file) {
  let survey = { responses: [], columns: [] };

  return new Promise(function(resolve) {
    requestCsv(file, function(csv) {
      addColumns(csv, survey);
      addResponses(csv, survey);
      resolve(cleanUp(survey));
    });
  });
}

export { QTYPES, parseQualtrics };
