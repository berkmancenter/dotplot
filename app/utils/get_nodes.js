export default function (columnId, survey) {
    NProgress.start();
    var controller = this;
    const column = _.find(survey.get('columns'), ['header', columnId]);

    /*  FUNCTION

        Name:       Multiple Choice Node.
        Run:        When called.
        Task:       Creates node object.
        Accepts:
            nodeObject: Original node (object)
            type:       Foci type (string)
            first:      Loop start (boolean)
        Returns:    Node copy (object)

    */
    function multipleChoiceNode(nodeObject, type, first) {
        var newNode = {};
        if (first) {
            newNode = {
                id: nodeObject.id,
                x: nodeObject.x,
                y: nodeObject.y,
                fill: nodeObject.fill
            };
        } else {
            newNode = {
                id: nodeObject.id + '--' + type,
                x: nodeObject.x,
                y: nodeObject.y,
                fill: nodeObject.fill
            };
        }
        newNode[column] = type;
        return newNode;
    }


    /*  FUNCTION

        Name:       Multiple Choice Types.
        Run:        When called.
        Task:       Processes individual node.
        Accepts:
            controller: Parent controller (scope)
            node:       Original node (string)
        Returns:    Nodes collection for type (array)

    */
    function multipleChoiceTypes(controller, node) {
        var nodeArr = [];
        var first = true;
        var nodeObject = controller.get('nodes')
            .findBy('id', node.get('id'));
        controller.get('selectedColumn').choice
            .forEach(function (type) {
                if (!node.get(type)) {
                    return;
                } else {
                    var newNode = multipleChoiceNode(
                        nodeObject,
                        type,
                        first
                    );
                    first = false;
                    nodeArr.push(newNode);
                }
            });
        return nodeArr;
    }


    /*  FUNCTION

        Name:       Multiple Choice Nodes.
        Run:        When called.
        Task:       Processes nodes collection.
        Accepts:
            controller: Parent controller (scope)
            nodes:      Nodes collection (array)
        Returns:    Nodes collection (array)

    */
    function multipleChoiceNodes(controller, nodes) {
        var nodeArr = [];
        nodes.forEach(function (node) {
            var newNodes = multipleChoiceTypes(
                controller,
                node
            );
            if(newNodes.length) {
                nodeArr = nodeArr.concat(newNodes);
            } else {
                return;
            }
        });
        return nodeArr;
    }


    /*  FUNCTION

        Name:       Single Choice Node.
        Run:        When called.
        Task:       Creates node object.
        Accepts:
            controller: Parent controller (scope)
            createNew:  Use existing (boolean)
            node:       Original Node (object)
        Returns:    Node copy (object)

    */
    function singleChoiceNode(controller, shouldCreateNew, node) {
        var newNode = {};
        if (!node[column]) { return; }

        if (shouldCreateNew) {
            newNode = {
                id: node.get('id')
            };
            newNode[column] = node[column];
            return newNode;
        } else {
            var nodeObject = controller.get('nodes')
                .findBy('id', node.get('id'));

            if (!nodeObject) { return; }
            newNode = {
              id: nodeObject.id,
              x: nodeObject.x,
              y: nodeObject.y,
              fill: nodeObject.fill
            };
            newNode[column] = node[column];
            return newNode;
        }
    }


    /*  FUNCTION

        Name:       Single Choice Nodes.
        Run:        When called.
        Task:       Processes nodes collection.
        Accepts:
            controller: Parent controller (scope)
            createNew:  Use existing (boolean)
            nodes:      Nodes collection (array)
        Returns:    Nodes collection (array)

    */
    function singleChoiceNodes(controller, createNew, nodes) {
    }


    /*  FUNCTION

        Name:       Pricess Single Choice.
        Run:        When called.
        Task:       Processes single choice frame.
        Accepts:
            controller: Parent controller (scope)
            createNew:  Use existing (boolean)
        Returns:    Nodes collection (array)

    */
    function processSingleChoice(column, survey, shouldCreateNew) {
        var nodesArr = [];
        survey.get('nodes').forEach(function (node) {
            var newNode = singleChoiceNode(
                controller,
                shouldCreateNew,
                node
            );
            if (!newNode) {
                return;
            } else {
                nodesArr.push(newNode);
            }
        });
        controller.set('nodes', nodesArr);
        return nodesArr;

        var nodes = controller.get('store')
            .findAll('node')
            .then(
                singleChoiceNodes.bind(
                    this,
                    controller,
                    createNew
                )
            );
        return nodes;
    }


    /*  FUNCTION

        Name:       Process Multiple Choice.
        Run:        When called.
        Task:       Processes multiple choice frame.
        Accepts:
            controller: Parent controller (scope)
        Returns:    Nodes collection (array)

    */
    function processMultipleChoice(controller) {
        var nodes = controller.get('store')
            .findAll('survey')
            .then(surveys => {
              const survey = surveys.objectAt(0);
              console.log(survey);
              return multipleChoiceNodes(controller, survey.get('nodes'));
            });
        return nodes;
    }

    return new Ember.RSVP.Promise(function (resolve, reject) {
        if (column.type === 'Single Choice') {
            const shouldCreateNew = !controller.get('d3Init');
            resolve(processSingleChoice(column, survey, shouldCreateNew));
        } else if (column.type === 'Multiple Choice') {
            processMultipleChoice(controller).then(function (nodes) {
                resolve(nodes);
            });
        } else {
            reject('Invalid FrameType: ' + frameType);
        }
    });
}
