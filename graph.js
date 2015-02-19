// Place all the behaviors and hooks related to the matching controller here.
// All this logic will automatically be available in application.js.
var Graph = {
  config: {
    browserSpeed: 'fast',
    reorganizePercent: 0.09,
    subcatColorScaleFactor: 0.55,
    theta: 1.2,
    subcatColorsAreVeryDifferent: false,
    colorAttr: 'category',
    sortAttr: 'category',
    prevColorAttr: 'category',
    prevSortAttr: 'category',
    defaultWidth: 700,
    defaultHeight: 600,
    widthPercentage: 0.7,
    heightPercentage: 0.995,
    nodeRadius: 10,
    strokeWidth: 1.5,
    gravity: 0,
    charge: - 6,
  },
  data: {
    categories: {},
    subcategories: {},
    stakeholders: {},
    interventions: {},
    days: {}
  },
  hierarchy: {},
  width: 0,
  height: 0,
  id: 0,
  foci: {},
  colorFoci: {},
  catColorScale: d3.scale.category10(),
  dayColorScale: d3.scale.category10(),
  typeColorScale: d3.scale.category10(),
  subcatColorScale: d3.scale.category20(),
  forceLayout: {},
  tickCount: 0,
  totalTicks: 298,
  hiddenCount: 0,
  initialized: false,

  init: function() {
    if (Graph.config.browserSpeed == 'serverside') {
      Graph.config.reorganizePercent = 0.18;
      Graph.config.theta = 0.8;
    }

    $(document).on('ready', Graph.setup);
  },
  setup: function() {
    Graph.initDimensions();
    if (!Graph.initialized) {
      d3.select("#graph").append("svg:svg").attr("width", Graph.width).attr("height", Graph.height);
      d3.selectAll('body, #graph svg').attr('class', function() { return Graph.config.layout == 'tree' ? 'tree' : 'density'; });
    } else {
      d3.select("#graph").select("svg").transition().attr("width", Graph.width).attr("height", Graph.height);
      Graph.initialized = false;
    }
    Util.updateEventHandlers();
    Graph.getData();
  },
  getData: function() {

    var data = {};

    if (Graph.config.layout == 'tree') {
      data = {
        layout: 'tree'
      };
    } else {
      switch (Graph.config.browserSpeed) {
        case 'medium':
        case 'slow':
          data = {
            prerendered: true,
            sort_attr: Graph.config.sortAttr,
            color_attr: Graph.config.colorAttr
          };
          break;
        case 'tree':
      }
    }

    $.getJSON(Graph.id + '.json', data, Graph.update);
  },
  update: function(data) {
    if (Graph.config.layout == 'tree') {
      Graph.hierarchy = data.graph;
      Graph.createDendrogram();
      return;
    }
    Graph.data = data.graph;

    // These are here so plurals aren't an issue when switching sorting or colors
    Graph.data.category = data.graph.categories;
    Graph.data.subcategory = data.graph.subcategories;
    Graph.data.day = data.graph.days;
    if ($('#sortList').children().length == 0) {
      Graph.updateAdvanced();
      Graph.initColorScales();
    }

    switch (Graph.config.browserSpeed) {
      case 'serverside':
      case 'fast':
        if (!Graph.initialized) {
          Graph.createForceLayout();
        }
        break;
      case 'medium':
      case 'slow':
        Graph.updateLameCircles();
    }
  },
  createDendrogram: function() {
    var i = 0,
    duration = 500,
    root;

    var tree = d3.layout.tree()
      .size([Graph.height, Graph.width - 700]);

    var diagonal = d3.svg.diagonal()
      .projection(function(d) { return [d.y, d.x]; });

    var vis = d3.select("#graph").select("svg")
      .append("svg:g")
      .attr("transform", "translate(40,0)");

    Graph.hierarchy.x0 = 0;
    Graph.hierarchy.y0 = 0;
    Graph.updateLegend();
    update(root = Graph.hierarchy);

    function update(source) {

      // Compute the new tree layout.
      var nodes = tree.nodes(root).reverse();

      // Update the nodes…
      var node = vis.selectAll("g.node")
        .data(nodes, function(d) { return d.id || (d.id = ++i); })

        var nodeEnter = node.enter().append("svg:g")
        .attr("class", "node")
        .attr("transform", function(d) { return "translate(" + source.y0 + "," + source.x0 + ")"; });

      // Enter any new nodes at the parent's previous position.
      nodeEnter.append("svg:circle")
        .attr("r", function(d) { return d.children || d._children ? 8.5 : 3.5; })
        .style("fill", function(d) {
          if (d._children || d.children) {
            switch(d.className) {
              case 'category':
                return Graph.catColorScale(d.name).toString()
              case 'subcategory':
          return Util.getSubcatColor(d.name).toString()
              default:
          return '#ccc'
            }
          } else {
            return '#ccc';
          }
        })
      .on("click", click);

      nodeEnter.append("svg:text")
        .attr("x", function(d) { return d.children || d._children ? 12 : 10; })
        .attr("y", 3)
        .text(function(d) { return typeof d.name == 'undefined' ? d.title : d.name; })
        .on("click", click);

      // Transition nodes to their new position.
      nodeEnter.transition()
        .duration(duration)
        .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; })
        .style("opacity", 1)
        .select("circle")

        node.transition()
        .duration(duration)
        .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; })
        .style("opacity", 1);

      node.exit().transition()
        .duration(duration)
        .attr("transform", function(d) { return "translate(" + source.y + "," + source.x + ")"; })
        .style("opacity", 1e-6)
        .remove();

      node
        .classed('closed', function(d) { return d._children; })
        .classed('open', function(d) { return d.children; })
        .classed('intervention', function(d) { return !d.children && !d._children; });

      // Update the links…
      var link = vis.selectAll("path.link")
        .data(tree.links(nodes), function(d) { return d.target.id; });

      // Enter any new links at the parent's previous position.
      link.enter().insert("svg:path", "g")
        .attr("class", "link")
        .attr("d", function(d) {
          var o = {x: source.x0, y: source.y0};
          return diagonal({source: o, target: o});
        })
      .transition()
        .duration(duration)
        .attr("d", diagonal);

      // Transition links to their new position.
      link.transition()
        .duration(duration)
        .attr("d", diagonal);

      // Transition exiting nodes to the parent's new position.
      link.exit().transition()
        .duration(duration)
        .attr("d", function(d) {
          var o = {x: source.x, y: source.y};
          return diagonal({source: o, target: o});
        })
      .remove();

      // Stash the old positions for transition.
      nodes.forEach(function(d) {
        d.x0 = d.x;
        d.y0 = d.y;
      });
    }

    function hideChildren(d) {
      d._children = d.children;
      d.children = null;
      update(d);
    }

    tree.nodes(root).forEach(function(d) { hideChildren(d); });

    // Toggle children on click.
    function click(d) {
      tree.nodes(root).forEach(function(e) { if (d.depth == e.depth && e.children && e.id != d.id) { hideChildren(e); } }); 
      if (d.children) {
        d._children = d.children;
        d.children = null;
      } else {
        d.children = d._children;
        d._children = null;
      }
      update(d);
    }

    d3.select(self.frameElement).style("height", "2000px");
  },
  createForceLayout: function() {
    Graph.foci = Graph.getFoci();
    Graph.colorFoci = Graph.getColorFoci();
    d3.select('svg').selectAll("circle.node").data(Graph.data.interventions, function(d) {
      return d.uuid
    }).enter().append("svg:circle").attr("class", "node").attr("cx", function(d) {
      return Node.getX(Graph.foci, d, Graph.config.sortAttr);
    }).attr("cy", function(d) {
      return Node.getY(Graph.foci, d, Graph.config.sortAttr);
    }).attr("r", function(d) {
      return Graph.config.nodeRadius;
    }).style("fill", function(d, i) {
      return Node.getColor(d);
    }).style("stroke", function(d, i) {
      return d3.rgb(Node.getColor(d)).darker(2);
    }).style("stroke-width", Graph.config.strokeWidth);

    Graph.forceLayout = d3.layout.force().nodes(d3.selectAll('circle.node').data()).size([Graph.width, Graph.height]).gravity(Graph.config.gravity).theta(Graph.config.theta).charge(Graph.config.charge);
    Graph.forceLayout.on("tick", Graph.onTick);
    Graph.forceLayout.start();
    Graph.updateLabels();
    Graph.updateLegend();
    if (!Graph.initialized) {
      Util.updateGraphEventHandlers();
    }
    Graph.initialized = true;
  },
  updateLameCircles: function() {
    var nodes = d3.select('svg').selectAll("circle.node").data(Graph.data.interventions, function(d) {
      return d.uuid
    });
    nodes.enter().append("svg:circle").attr("class", "node").attr("r", Graph.config.nodeRadius).attr("stroke-width", Graph.config.strokeWidth).attr("cx", function(d) {
      return d.x;
    }).attr("cy", function(d) {
      return d.y;
    });

    switch (Graph.config.browserSpeed) {
      case 'medium':
        nodes.transition().duration(1200).attr("cx", function(d) {
          return d.x;
        }).attr("cy", function(d) {
          return d.y;
        }).style("fill", function(d) {
          return Node.getColor(d);
        }).style("stroke", function(d) {
          return d3.rgb(Node.getColor(d)).darker(2);
        });
        break;
      case 'slow':
        nodes.style("fill", function(d) {
          return Node.getColor(d);
        }).style("stroke", function(d) {
          return d3.rgb(Node.getColor(d)).darker(2);
        }).attr("cx", function(d) {
          return d.x;
        }).attr("cy", function(d) {
          return d.y;
        });
    }

    Graph.updateLabels();
    Graph.updateLegend();

    if (!Graph.initialized) {
      Util.updateGraphEventHandlers();
      Graph.initialized = true;
    }
  },
  initColorScales: function() {
    d3.map(Graph.data.interventions[0]).forEach(function(k, v) {
      //TODO: So stupid
      if ([
        'uuid',
        'id',
        'cluster_id',
        'title',
        'description',
        'required_innovations',
        'additional_info',
        'index',
        'px',
        'py',
        'x',
        'y',
        'fixed',
        'weight'
        ].indexOf(k) == -1) {
          var colorScale;
          if (Graph.data[k].length <= 10) {
            colorScale = d3.scale.category10();
          }
          else if (Graph.data[k].length <= 20) {
            colorScale = d3.scale.category20();
          }
          else if (Graph.data[k].length > 20) {
            colorScale = d3.scale.category30();
          }
          Graph[k + 'ColorScale'] = colorScale;
        }
    });
  },
  initDimensions: function() {
    if (Graph.config.layout == 'tree') {
      Graph.width = 1400;
      Graph.height = 630;
      return;
    }

    switch (Graph.config.browserSpeed) {
      case 'serverside':
      case 'fast':
      case 'medium':
      case 'slow':
        Graph.width = Graph.config.defaultWidth;
        Graph.height = Graph.config.defaultHeight;
        break;
        /*case 'fast':
          Graph.width = $('body').width() * Graph.config.widthPercentage;
          Graph.height = $(window).height() * Graph.config.heightPercentage;*/
    }
  },
  updateLegend: function() {
    $('#legend :not(:header)').remove();
    var $legend = $('<div />');
    if (Graph.config.layout != 'tree') {
      var entries = Graph.data[Graph.config.colorAttr];
      entries.forEach(function(u) {
        $legend.append(function() {
          return $('<div class="legendEntry" />').append(function() {
            return $('<span class="swatch"/>').css('backgroundColor', Util.stringToColor(u.name || u.toString())).add($('<span class="legendText" />').text(Util.groupNameToText(u.name || u.toString())));
          });
        });
      });
      $('#legend :header').after($legend.html());
    } 
    $('#colorText').text(Util.toTitle(Graph.config.colorAttr));
  },
  updateLabels: function() {
    var groups = Util.flattenData(Graph.config.sortAttr),
    hidden = $('#hideLabels').is(':checked'),
    position,
    groupText;
    $('.sortLabel').fadeOut(300, function() {
      $(this).remove();
    });
    switch (Graph.config.browserSpeed) {
      case 'serverside':
      case 'fast':
        groups.forEach(function(group) {
          $('<div class="sortLabel"/>').appendTo('body').text(Util.groupNameToText(group)).css({
            'left': Graph.foci[group][0] + $('#graph').offset().left,
            'top': Graph.foci[group][1] + $('#graph').offset().top
          });
        });
        break;
      case 'medium':
      case 'slow':
        groups.forEach(function(group) {
          nodes = d3.selectAll('circle.node').filter(function(n) {
            if (n[Graph.config.sortAttr] instanceof Array) {
              return n[Graph.config.sortAttr].map(function(d) {
                return d.name;
              }).indexOf(group) != - 1 && n[Graph.config.sortAttr].length == 1;
            }
            else {
              return n[Graph.config.sortAttr].name ? n[Graph.config.sortAttr].name == group : n[Graph.config.sortAttr].toString() == group;
            }
          });
          position = Graph.getNodesAvgPosition(nodes);
          $('<div class="sortLabel"/>').appendTo('body').text(Util.groupNameToText(group)).css({
            'left': position[0] + $('#graph').offset().left,
            'top': position[1] + $('#graph').offset().top
          });
        });
    }
    if (!hidden) {
      $('.sortLabel').fadeIn();
    }
    $('#sortText').text(Util.toTitle(Graph.config.sortAttr));
  },
  updateAdvanced: function() {
    d3.map(Graph.data.interventions[0]).forEach(function(k, v) {
      if (['uuid', 'id', 'cluster_id', 'title', 'description', 'required_innovations', 'additional_info'].indexOf(k) == -1) {
        $('#sortList').append('<li><input type="radio" name="sort" id="sort' + k + '" value="' + k + '" /><label for="sort' + k + '">' + Util.toTitle(k) + '</label></li>');
        $('#colorList').append('<li><input type="radio" name="color" id="color' + k + '" value="' + k + '" /><label for="color' + k + '">' + Util.toTitle(k) + '</label></li>');
      }
    });
    $('#sortList input[value="' + Graph.config.sortAttr + '"]').attr('checked', true);
    $('#colorList input[value="' + Graph.config.colorAttr + '"]').attr('checked', true);
  },
  outputNodes: function() {
    $('<span id="d3Nodes" />').text(JSON.stringify(Graph.forceLayout.nodes())).appendTo('body');
  },
  updateFoci: function() {
    Graph.foci = Graph.getFoci();
  },
  updateColorFoci: function() {
    Graph.colorFoci = Graph.getColorFoci();
  },
  getFoci: function() {
    return Util.getFociFromArray(Util.flattenData(Graph.config.sortAttr));
  },
  getColorFoci: function() {
    return Util.getFociFromArray(Util.flattenData(Graph.config.colorAttr));
  },
  getNodesAvgPosition: function(nodes) {
    var avg = [0, 0];
    nodes.each(function(node) {
      avg[0] += node.x;
      avg[1] += node.y;
    });
    avg[0] /= nodes[0].length;
    avg[1] /= nodes[0].length;
    return avg;
  },
  onTick: function(e) {
    var k = .05 * e.alpha,
    thisFoci = Graph.foci,
    nodeAttr = Graph.config.sortAttr;
    if (
        /*Graph.config.oldSortAttr != Graph.config.colorAttr &&*/
        Graph.config.sortAttr != Graph.config.colorAttr) {
          if (Graph.tickCount < Graph.totalTicks * Graph.config.reorganizePercent) {
            thisFoci = Graph.colorFoci;
            nodeAttr = Graph.config.colorAttr;
          }
          else if (Graph.tickCount == Math.floor(Graph.totalTicks * Graph.config.reorganizePercent) + 1) {
            Graph.forceLayout.start();
          }
        }
    if (Graph.tickCount == Graph.totalTicks - 120) {
      // TODO: Fix this
      //	Graph.correctLabelPositions();
    }
    if (Graph.tickCount == Graph.totalTicks - 1) {
      if (Graph.config.browserSpeed == 'serverside') {
        Graph.outputNodes();
      }
    }

    Graph.forceLayout.nodes().forEach(function(o, i) {
      if (!o.hidden) {
        o.y += (Node.getY(thisFoci, o, nodeAttr) - o.y) * k;
        o.x += (Node.getX(thisFoci, o, nodeAttr) - o.x) * k;
      }
    });
    Graph.tickCount++;


    d3.selectAll("circle.node").attr("cx", function(d) {
      return d.x;
    }).attr("cy", function(d) {
      return d.y;
    }).style("display", function(d) { return d.hidden ? 'none' : 'inline'; });
  },
  filterNodes: function() {
    Graph.hiddenCount = 0;
    Graph.forceLayout.nodes().forEach(function(o, i) {
      o.hidden = false;
      if (o[Graph.config.sortAttr].length == 0 || o[Graph.config.colorAttr].length == 0) {
        o.hidden = true;
        Graph.hiddenCount++;
      }
    });
    if (Graph.hiddenCount > 0) {
      $('#hiddenCount').text(function() { var output = Graph.hiddenCount + ' intervention'; if (Graph.hiddenCount > 1) { output += 's'; }; return output += ' hidden due to missing data'});
    }
  },
  correctLabelPositions: function() {
    var position, nodes;
    $('div.sortLabel').fadeOut(150, function() {
      $(this).each(function(label) {
        nodes = Graph.forceLayout.nodes().filter(function(d) {
          if (d[Graph.config.sortAttr] instanceof Object && d[Graph.config.sortAttr].name) {
            return d[Graph.config.sortAttr].name == $(label).text();
          }
          else {
            return d[Graph.config.sortAttr].toString() == $(label).text();
          }
        });
        position = Graph.getNodesAvgPosition(nodes);
        $(this).css({
          left: position[0] - 20,
          top: position[1] + 20
        });
      });
      $(this).fadeIn(150);
    });
  },
};
var Node = {

  getColor: function(node) {
    attr = Graph.config.colorAttr
      if (node[attr] instanceof Array) {
        var colors = [];
        node[attr].forEach(function(i) {
          colors.push(Util.stringToColor(i.name || i.toString()));
        });
        return colors.reduce(function(prev, curr) { return d3.interpolateRgb(prev, curr)(0.5); }, colors[0]);
      }
      else {
        return Util.stringToColor(Node.getAttrString(node, Graph.config.colorAttr));
      }
  },
  getX: function(foci, node, attr, index) {
    // I should do caching in here so it doesn't take any time
    index = index || 0;
    var xs;
    if (node[attr] instanceof Array) {
      xs = [];
      for (i in node[attr]) {
        xs.push(foci[node[attr][i].name][index]);
      }
      xs = d3.mean(xs);
    }
    else {
      xs = foci[Node.getAttrString(node, attr)][index];
    }
    return xs;
  },
  getY: function(foci, node, attr) {
    return Node.getX(foci, node, attr, 1);
  },
  getAttrString: function(node, attr) {
    if (node[attr] instanceof Object && node[attr].name) {
      return node[attr].name;
    } else {
      return node[attr].toString();
    }
  }
}
var Util = {
  updateGraphEventHandlers: function() {
    d3.selectAll("circle.node").on("click", function(c) {
      d3.select('circle.node.activated').classed('activated', false);
      d3.select(this).classed('activated', true);
      d3.select("#intervention").html('<p>' + c.title + '</p><a target="_blank" href="/clusters/' + c.cluster_id + '/interventions/' + c.id + '/edit">View / Edit</a>');
      $('#data').show();
    });

  },
  updateEventHandlers: function() {
    $("input[name=sort], input[name=color], input[name=speed], #hideLabels, #veryDiffSubcatColors").off("change");
    $('#dataClose, #controls h2, #changeLayout').off('click');

    $('#changeLayout').on('click', function() {
      $('body').toggleClass('tree');
      $('body').toggleClass('density');
      $('svg').remove();
      $('#dataClose').trigger('click');
      $('.sortLabel').remove();
      $(this).text(function() { return $(this).text() == 'Tree View' ? 'Density View' : 'Tree View'; });
      Graph.initialized = false;
      Graph.config.layout = Graph.config.layout == 'tree' ? 'density' : 'tree';
      Graph.setup();
    });

    $('#dataClose').on("click", function() {
      d3.select('circle.node.activated').classed('activated', false);
      $('#data').hide();
      return false;
    });

    $('#hideLabels').on("change", function(e) {
      if ($(this).is(':checked')) {
        $('.sortLabel').fadeOut();
      } else {
        $('.sortLabel').fadeIn();
      }
    });

    $('#veryDiffSubcatColors').on('change', function(e) {
      Graph.config.subcatColorsAreVeryDifferent = $(this).is(':checked');
    });

    $("#sortList").on("change", 'input[name=sort]', function(e) {
      Graph.config.oldSortAttr = Graph.config.sortAttr;
      Graph.config.sortAttr = $(this).val();
      $('#hiddenCount').text('');
      switch (Graph.config.browserSpeed) {
        case 'serverside':
        case 'fast':
          Graph.forceLayout.stop();
          Graph.tickCount = 0;
          Graph.updateFoci();
          Graph.updateLabels();
          Graph.filterNodes();
          Graph.forceLayout.start();
          break;
        case 'medium':
        case 'slow':
          Graph.getData();
      }
    });

    $('a.question').on('click', function(e) {
      $('#questions li').removeClass('selected');
      $(this).parent().addClass('selected');
      $('input[name=sort][value=' + $(this).attr('data-sort') + ']').attr('checked', true).trigger('change');
      $('input[name=color][value=' + $(this).attr('data-color') + ']').attr('checked', true).trigger('change');
      $('#hideLabels').attr('checked', function() { return $(e.target).attr('data-hide-labels') == 't' ? true : false; });
      return false;
      //$(this).attr('data-selected-intervention')
    });

    $('#colorList').on("change", 'input[name=color]', function(e) {
      Graph.config.oldColorAttr = Graph.config.colorAttr;
      Graph.config.colorAttr = $(e.target).val();
      switch (Graph.config.browserSpeed) {
        case 'serverside':
        case 'fast':
          Graph.tickCount = 0;
          Graph.updateColorFoci();
          Graph.updateLegend();
          Graph.filterNodes();
          d3.selectAll('circle.node').transition().duration(300).style("fill", function(d, i) {
            if (!d.hidden) {
              return Node.getColor(d);
            }
          }).style("stroke", function(d, i) {
            return d3.rgb(Node.getColor(d)).darker(2);
          });
          Graph.forceLayout.start();
          break;
        case 'medium':
        case 'slow':
          Graph.getData();
      }
    });

    $('input[name=color], input[name=sort]').on('click', function() { $('#questions li').removeClass('selected'); });

    $('input[name=speed][value=' + Graph.config.browserSpeed + ']').attr('checked', true);
    $('input[name=speed]').on('change', function() {
      Graph.config.browserSpeed = $(this).val();
      if (Graph.forceLayout.on) {
        Graph.forceLayout.on("tick", null);
      }
      Graph.setup();
    });
    $('#controls h2 ~ *').slideUp();
    $('#controls h2').on('click', function() {
      $(this).find('~ *').slideToggle();
    });
  },
  getSubcatColor: function(string) {
    // Evidently d3 has scales, which could probably do this for me
    if (Graph.config.subcatColorsAreVeryDifferent) {
      return d3.rgb(Graph.subcatColorScale(string));
    } else {
      var subcategory = Graph.data.subcategories.filter(function(subcat) {
        return subcat.name == string;
      })[0],
        category = Graph.data.categories.filter(function(cat) {
          return cat.uuid == subcategory.category_uuid;
        })[0],
                 colorDelta = category.subcategory_uuids.indexOf(subcategory.uuid);
      colorDelta = (colorDelta - Math.floor(category.subcategory_uuids.length / 2)) * Graph.config.subcatColorScaleFactor;
      return d3.rgb(Graph.catColorScale(category.name)).darker(colorDelta);
    }
  },
  stringToColor: function(string) {
    switch (Graph.config.colorAttr) {
      case 'subcategory':
        return Util.getSubcatColor(string);
      default:
        return d3.rgb(Graph[Graph.config.colorAttr + 'ColorScale'](string));
    }
  },
  toTitle: function(str) {
    return str.replace(/_/g, ' ').replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
  },
  flattenData: function(attr) {
    return Graph.data[attr].map(function(s) {
      if (s instanceof Object && s.name) {
        return s.name;
      } else {
        return s.toString();
      }
    });
  },
  groupNameToText: function(str) { 
    var groupText;
    if (str == 'true') { groupText = 'Yes'; }
    else if (str == 'false') { groupText = 'No'; }
    else { groupText = str; }
    return groupText;
  },
  getFociFromArray: function(groups) {
    // TODO: use d3 scales to do this
    var fociStack = [],
    foci = {},
    numGroups = groups.length,
    perRow = Math.ceil(Math.sqrt(numGroups)),
    numRows = Math.ceil(Math.sqrt(numGroups)),
    numInRow;

    for (i = 0; i < numRows; i++) {
      numInRow = Math.min(perRow, numGroups - (i * perRow));
      for (j = 0; j < numInRow; j++) {
        fociStack.push([(Graph.width / (numInRow + 1)) * (j + 1), (Graph.height / (numRows + 1)) * (i + 1)]);
      }
    }

    fociStack.reverse();

    for (i in groups) {
      foci[groups[i]] = fociStack.pop();
    }
    return foci;
  }
};
