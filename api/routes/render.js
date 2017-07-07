var renderRouter = require('express').Router();
var d3 = require('d3');
var jsdom = require('jsdom/lib/old-api');

renderRouter.post('/', function (req, res) {
    var nodes = JSON.parse(req.body.nodes);
    var foci = JSON.parse(req.body.foci);
    var width = parseFloat(req.body.width);
    var height = parseFloat(req.body.height);
    var gravity = parseInt(req.body.gravity);
    var charge = parseInt(req.body.charge);
    var id = req.body.id;

    new jsdom.env({
        html: '<html><body><div class="dotplot-nodes"><svg></svg></div></body></html>',
        features:{ QuerySelector: true },
        done: function (errors, window) {
            window.d3 = d3.select(window.document)

            var node = window.d3.select(".dotplot-nodes > svg")
                .attr({
			        width: width,
			        height: height
			    })
                .selectAll(".node")
                .data(nodes, function (d) {
                    return d.id;
                });

            function drawNode(alpha) {
                return function (d) {
                    var center = foci[d[id]];

                    d.x += (center.x - d.x) * 0.06 * alpha;
                    d.y += (center.y - d.y) * 0.06 * alpha;
                };
            }

            node.enter()
                .append("circle")
                .attr("class", "node")
                .attr("id", function (d) {
                    return d.id;
                })
                .attr("cx", function (d) {
                    return d.x;
                })
                .attr("cy", function (d) {
                    return d.y;
                });
            
            // Update node position with every tick.
            function tick(e) {
                node.each(drawNode(e.alpha));

                node.attr("cx", function (d) {
                        return d.x;
                    })
                    .attr("cy", function (d) {
                        return d.y;
                    });
            }

            function end() {
                res.json(nodes);
            }

            // Define force properties.
            var force = d3.layout
                .force()
                .nodes(nodes)
                .size([width, height])
                .on("tick", tick)
                .on('end', end)
                .charge(-1 * charge)
                .gravity((10 - gravity) / 100);

            force.start();
        }
    });
});

module.exports = renderRouter;