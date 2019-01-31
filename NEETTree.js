
// global var to store NEET data
let NEETData;

// list for vars that are not barriers
let notInList = ['education', 'employment', 'training', 'Youth NEET']

// define dimensions
let margin = {top: 30, right: 10, bottom: 20, left: 180},
    width = 1200 - margin.right - margin.left,
    height = 750 - margin.top - margin.bottom;

// define counter, duration and root
let i = 0,
    duration = 750,
    root;

// scale for circles/ bubbles
let minRadius = 0;
let maxRadius = 20;

// define Scales
let radScale = d3.scaleSqrt().domain([0, 100]).range([minRadius, maxRadius]);
let lab2categ2Ord;
let colScale;

// define tree and diagonals;
let tree = d3.tree()
    .size([height, width]);

let diagonal = d3.linkHorizontal().x(d => d.y).y(d => d.x) // converts start and end point so we are going left to right instead of up and down

// define the SVG group that contains main visual
let svg = d3.select("#container")
    .append("svg")
    .attr("width", width + margin.right + margin.left)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

// appending title of all the layers
svg.selectAll('text.layerTitle')
  .data(["Youth NEET", "Youth not in ... ", "Reported barriers/ reasons"])
  .enter()
  .append('text')
  .attr('class', 'layerTitle')
  .text(d => d)
  .attr('x', (d, i) => i * 300)
  .attr('y', -10)
  .style('text-anchor', 'middle')
  .style('font-weight', 'bold');

// adding layer partitions
svg.selectAll('line.layerPartition')
    .data([150, 450])
    .enter()
    .append('line')
    .attr('class', 'layerPartition')
    .attr('x1', d => d)
    .attr('y1', '5%')
    .attr('x2', d => d)
    .attr('y2', '95%')
    .style('stroke', '#9E9E9E')
    .style('stroke-width', '1px')
    .style('stroke-opacity', .4)
    .style('stroke-dasharray', 3)


// async function that reads in data, preprocesses it and draws the visual
async function readAndDraw(){
  // reading and awaiting the async request for data
  let NEETData = await d3.csv('NEETBar.csv');
  let labelDict = await d3.csv('labelDict.csv');

  // filter the data to youth only
  let YouthNEETDat = NEETData.filter(d => d.ageGroup == "15-24");

  // scale for description to my categories
  lab2categ2Ord = d3.scaleOrdinal()
                        .domain(labelDict.map(d => d.description))
                        .range(labelDict.map(d => d.category2))

  // colorSCale that maps my categories to colors
  colScale = d3.scaleOrdinal(d3.schemeSet1)
            .domain(labelDict.map(d => d.category2));


  // function to compute indicators, used this to test the inds
  function computeInd(data, numFilter, denFilter){
    let numFiltered = data.filter(numFilter);
    let numWtsSum = d3.sum(numFiltered.map(d => +d.weights));
    let denFiltered = data.filter(denFilter);
    let denWtsSum = d3.sum(denFiltered.map(d => +d.weights));
    return (numWtsSum/ denWtsSum) * 100;
  }

  // some test compute indicators
  let nEdu = computeInd(YouthNEETDat, (d => d.notInEdu == "TRUE"| d.notInEdu == "NA"), (d => d));
  let nEmp = computeInd(YouthNEETDat, (d => d.notInEmp == "TRUE"), (d => d));
  let nTra = computeInd(YouthNEETDat, (d => d.notInTra == "TRUE"), (d => d));
  let neet = computeInd(YouthNEETDat, (d => d.neet == "TRUE"), (d => d));


  // function to hget the description across a label
  function getDesc(label, type, dictionary, what){
    let typeFilt = dictionary.filter(d => d.type == type);
    let desc = typeFilt.filter(d => d.label == label)[0][what];

    return desc;
  }

  // function that computes all barriers percentages
  function calcBarPerc(data, type, dictionary){
    let labels = dictionary.filter(d => d.type == type).map(d => d.label);

    let typeBarMapping = {
      'education': 'eduBarrier',
      'work': 'workBarrier',
      'training': 'trainBarrier'
    }

    let notInBarMapping = {
      'education': 'notInEduNotEnr',
      'work': 'notInEmp',
      'training': 'notInTra'
    }

    let typeLabelMapping = {
      'education': 'education',
      'work': 'employment',
      'training': 'training'
    }

    let barVar = typeBarMapping[type];

    let indArray = [];

    for (let i = 0; i < labels.length; i++){
      let label = labels[i];

      let filt = data.filter(d => d[barVar].includes(label) & d[notInBarMapping[type]] == "TRUE");
      let filtWtsSum = d3.sum(filt.map(d => d.weights));
      let denomFilt = data.filter(d => d[notInBarMapping[type]] == "TRUE")
      //let denomFilt = data.filter(d => d)
      let datWtsSum = d3.sum(denomFilt.map(d => d.weights));

      let ind = (filtWtsSum/ datWtsSum) * 100;
      indArray.push([
        typeLabelMapping[type]+'-'+getDesc(label, type, dictionary, 'description'), +ind
      ])
    }

    return indArray;
  }


  // compute education, employment and training barrier percentages
  let edu = calcBarPerc(YouthNEETDat, "education", labelDict);
  let emp = calcBarPerc(YouthNEETDat, "work", labelDict);
  let trai = calcBarPerc(YouthNEETDat, "training", labelDict);

  // combine all barrier percentages
  let combined = edu.concat(emp, trai);

  // make a tree like JSON  from the combined barriers
  let combinedJSON = buildHierarchy(combined, "Youth NEET");
  // feed that to hierarchy
  let combJSONHier = d3.hierarchy(combinedJSON);
  root = combJSONHier
  tree(root);
  root.x0 = height/ 2;
  root.y0 = 0;

  // collapse function to collapse a node
  function collapse(d) {
    if (d.children) {
      d._children = d.children;
      d._children.forEach(child => collapse(child));
      d.children = null;
    }
  }


  // assign values to all nodes
  root.descendants().forEach(d => {
    if (d.data.name == 'Youth NEET'){
      d.value = neet;
    }
    else if (d.data.name == 'education'){
      d.value = nEdu;
    }
    else if (d.data.name == 'employment') {
      d.value = nEmp;
    }
    else if (d.data.name == 'training') {
      d.value = nTra;
    }
    else {
      d.value = d.data.size;
    }
  })

  // sort the dataset
  root.descendants().filter(desc => notInList.includes(desc.data.name) ).forEach(desc => {
    desc.children = desc.children.sort(function(a,b) {
      return b.value - a.value;
    })
  })

  // default setting, just collapse education
  root.children.forEach(d => {
    if (d.data.name == "education"){
      collapse(d);
    }
    else {}
  });

  // draw the default tree
  update(root);

  // Array of unique categories that I defines
  let categsUniq = Array.from(new Set(labelDict.map(d => d.category2)));

  // an html legend for my categories
  let legDivs = d3.select('#categLegend .categs')
    .selectAll('div.categ')
    .data(categsUniq)
    .enter()
    .append('div')
    .classed('categ', true);

  legDivs.append('p')
    .html(d => {
      return `<span style="background:${colScale(d)}";></span>`
    });

  let legPs = legDivs.append('p');

  legPs.html(d => {
    return `${d}`
  });

  legDivs.selectAll('span')
      .style('height', '15px')
      .style('width', '15px')
      .style('display', 'inline-block')
      .style('border-radius', '50%')


  // a nested circle legend for percentages
  makeNestCircLegend(CSSSelect = 'svg', [50, 650], [10, 50, 100], radScale, "Percent Scale")

}

// call the main function
readAndDraw();


// update the tree function
function update(source) {
  // Compute the new tree layout.
  tree(root);

  // get latest nodes and links
  var nodes = root.descendants().reverse(),
      links = root.links();


  // Normalize for fixed-depth.
  nodes.forEach(function(d) { d.y = d.depth * 300; });


  // Update the nodes…
  var node = svg.selectAll("g.node")
      .data(nodes, function(d) {
        return d.id ? d.id : d.id = ++i;
      });


  // Enter any new nodes at the parent's previous position.
  var nodeEnter = node.enter().append("g")
      .attr("class", "node")
      .attr("transform", function(d) { return "translate(" + source.y0 + "," + source.x0 + ")"; })
      .on("click", click)
      .on('mouseover', mouseO(true))
      .on('mouseout', mouseO(false))

  nodeEnter.append("circle")
      .attr("r", 1)
      .style('fill', d => {
        let categ = lab2categ2Ord(d.data.name);
        return notInList.includes(d.data.name) ? '#8E24AA' : colScale(categ);
      })
      .style("fill-opacity", d => d.data.name != "Youth NEET" ? 0.75 : .75)
      .attr("r", function(d) {
        return radScale(d.value)
      })

  nodeEnter.append("text")
      .attr("x", function(d) { return d.children || d._children ? -20 : 20; })
      .attr("dy", ".35em")
      .attr("text-anchor", function(d) { return d.children || d._children ? "end" : "start"; })
      .attr("class", "text")
      .text(function(d) { return d.data.name; })
      .style("fill-opacity", 0)
      .style('font-size', d => `${18 - d.depth}px`);
  // Transition nodes to their new position.
  var nodeUpdate = node.merge(nodeEnter).transition()
      .duration(duration)
      .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; });

  nodeUpdate.select("circle")
      .attr("r", function(d) {
        return radScale(d.value)
      })
      .style("fill-opacity", d => d.data.name != "Youth NEET" ? 0.75 : 0.75);


  nodeUpdate.select("text")
      .style("fill-opacity", 1);

  // Transition exiting nodes to the parent's new position.
  var nodeExit = node.exit().transition()
      .duration(duration)
      .attr("transform", function(d) { return "translate(" + source.y + "," + source.x + ")"; })
      .remove();

  nodeExit.select("circle")
      .attr("r", 1e-6);

  nodeExit.select("text")
      .style("fill-opacity", 1e-6);

  // Update the links…
  var link = svg.selectAll("path.link")
      .data(links, function(d) { return d.target.id; });

  // Enter any new links at the parent's previous position.
  var linkEnter =  link.enter().insert("path", "g")
      .attr("d", function(d) {
        var o = {x: source.x0, y: source.y0};
        return diagonal({source: o, target: o});
      })
      .style('stroke-width', 20)
      .classed('link', true)
      .attr('id', d => `ID${d.target.id}`)
      .style('stroke', d => {
        let categ = lab2categ2Ord(d.target.data.name);
        return notInList.includes(d.target.data.name) ? '#8E24AA' : colScale(categ);
      });

  // Transition links to their new position.
  link.merge(linkEnter).transition()
      .duration(duration)
      .attr("d", diagonal)
      .style('stroke-width', d => (2*radScale(d.target.value)))


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

//Toggle children on click.
function click(d) {
  if (d.children) {
    d._children = d.children;
    d.children = null;
  } else {
    d.children = d._children;
    d._children = null;
  }
  update(d);
}

function mouseO(over) {

  return function(d){
    let arrIDNames = d.ancestors().map(d => d.id);

    let classCSS = arrIDNames.map(d => `#ID${d}`).join(", ")
    let selection = d3.selectAll(classCSS);
    let textSelect = d3.select(this).select('text')

    if (over == true){
      selection.style('stroke-opacity', .8);
      textSelect.transition().duration(180).style('font-size', d => `${(18 - d.depth) * 1.4}px`);
    }
    else {
      selection.style('stroke-opacity', .2);
      textSelect.transition().duration(180).style('font-size', d => `${18 - d.depth}px`);
    }
  }
}

function buildHierarchy(csv, rootName) {
    var root = {"name": rootName, "children": []};
    for (var i = 0; i < csv.length; i++) {
      var sequence = csv[i][0];
      var size = +csv[i][1];
      if (isNaN(size)) { // e.g. if this is a header row
        continue;
      }
      var parts = sequence.split("-");
      var currentNode = root;
      for (var j = 0; j < parts.length; j++) {
        var children = currentNode["children"];
        var nodeName = parts[j];
        var childNode;
        if (j + 1 < parts.length) {
          // Not yet at the end of the sequence; move down the tree.
          var foundChild = false;
          for (var k = 0; k < children.length; k++) {
            if (children[k]["name"] == nodeName) {
              childNode = children[k];
              foundChild = true;
              break;
            }
          }
          // If we don't already have a child node for this branch, create it.
          if (!foundChild) {
            childNode = {"name": nodeName, "children": []};
            children.push(childNode);
          }
          currentNode = childNode;
        } else {
          // Reached the end of the sequence; create a leaf node.
          childNode = {"name": nodeName, "size": size};
          children.push(childNode);
        }
      }
    }

    return root;
};

function makeNestCircLegend(CSSSelect = 'svg', transformArray, bubArray, bubScale, legendTitle){
    // appending a legendgroup
    let legendGroup = d3.select('svg')
                     .append('g')
                     .classed('legendGroup', true)
                     .attr('transform', `translate(${transformArray[0]}, ${transformArray[1]})`)

    //console.log(legendGroup);

    legendGroup.append('text')
             .text(legendTitle)
             .classed('legendTitle', true)
             .attr('dx', 40)
             .style('font-size', '12px')
             .style('text-anchor', 'start');

    let radius = bubScale(d3.max(bubArray));
    // hard code params such as Padding and font size for now
    let legLabelPadding = 5;
    let legLabFontSize = 10;

    const circGroups = legendGroup.selectAll('circle')
             .data(bubArray)
             .enter()
             .append('g')
             .classed('circLegendGroup', true)
             .attr('transform', d => `translate(0, ${radius - bubScale(d)})`);

    circGroups.append('circle')
             .attr('r', d => radScale(d))
             .style('fill', 'none')
             .style('stroke', 'black')
             .style('stroke-width', '1px');

    circGroups.append('text')
             .text(d => d)
             .attr('dx', radius + legLabelPadding)
             .attr('dy', d => - (bubScale(d) - legLabFontSize/2))
             .style('fill', 'black')
             .style('font-family', 'Roboto Condensed')
             .style('font-size', `${legLabFontSize}px`)
  }
