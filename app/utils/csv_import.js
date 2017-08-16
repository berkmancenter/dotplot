import NProgress from 'ember-cli-nprogress';
import _ from 'lodash';
import { csv as requestCsv } from 'd3-request';

var MULTIPLE = 'Multiple Choice';
var SINGLE = 'Single Choice';

function isValidQuestion(id) {
    var textValue = id.indexOf('TEXT');
    var questionValue = id.indexOf('Q');
    if (textValue === -1 && questionValue === 0) {
        return true;
    } else {
        return false;
    }
}

function isMultipleChoiceName(columnName) {
    return columnName.includes('_');
}

function storeColumn(column, controller) {
    if (_.isEmpty(column)) return;

    var recordExists = controller.get('store')
        .hasRecordForId('column', column.id);

    if (column.type === MULTIPLE && recordExists) {
        controller.get('store')
            .findRecord('column', column.id)
            .then(function (existingColumn) {
                existingColumn.get('choice').pushObject(column.choice[0]);
            });
    } else {
        controller.get('store')
            .createRecord('column', column);
    }
}

function parseColumnHeader(columnName, cellValue) {
    if (!isValidQuestion(columnName)) return;

    var column;

    if (isMultipleChoiceName(columnName)) {
        var id = columnName.substr(0, columnName.indexOf('_'));
        column = {
            id: id,
            text: cellValue.substr(0, cellValue.indexOf('-')),
            choice: [columnName],
            type: MULTIPLE
        };
    } else {
        column = {
            id: columnName,
            text: cellValue,
            type: SINGLE
        }
    }

    return column;
}

function parseColumns(csvRows, controller) {
    var columns = _.toPairs(csvRows[0]).map(pair => parseColumnHeader(pair[0], pair[1]));
    columns.forEach(function(col) { storeColumn(col, controller); });

    NProgress.done();
}

function createNode(row) {
    var node = { id: row.V1 };
    var fuzzyNode = {};

    _.forOwn(row, function (value, key) {
        if (_.isEmpty(value)) return;
        node[key] = value;

        if (_.isNaN(parseInt(value))) {
            fuzzyNode[key] = value;
        }
    });

    return { node: node, fuzzy: fuzzyNode };
}

function storeNode(node, controller) {
    var storedNode = controller.get('store')
        .createRecord('node', node.node);
    node.fuzzy['id'] = storedNode.get('id');
    controller.get('fuzzyNodes')
        .pushObject(node.fuzzy);
}

function createNodes(csvRows, controller) {
    csvRows.forEach(function (row, index) {
        // Ignore the first row of column headers.
        if (index === 0) return;

        controller.get('nodes').pushObject({ id: row.V1 });

        // The second row does not contain node data, so don't make nodes out
        // of it.
        if (index === 1) return;

        var node = createNode(row);
        storeNode(node, controller);
    });
}

export default function (file) {
    NProgress.start();
    var controller = this;

    requestCsv(file, function(csv) {
        parseColumns(csv, controller)
    });

    requestCsv(file, function(csv) {
        createNodes(csv, controller);
    });
}
