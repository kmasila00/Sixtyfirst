app.directive('landing', function(){

	return{
		restrict: 'E',
		templateUrl: 'js/common/directives/landing/landing.html',
		scope:{
			topics: "=",
			prereqs: "="
		},
		controller: function($scope, $state, TopicFactory){

			var width = window.innerWidth,
			    height = window.innerHeight;

			//Initialize the color scale

			var color = d3.scale.category20();


			//Initialize the node size scale
			//Here we are mapping all resource lengths to node sizes:

			var nodeSize= d3.scale.linear();

			nodeSize.domain(d3.extent($scope.topics, function(d){ return d.resources.length}));
			nodeSize.range([15,50]);


			//Initialize the svg element, which will act as a container for our data visualization
			//.call(d3.behavior.zoom())- calling d3's zooming functionality
			//.on('zoom')- redrawing our graph when the zoom events happen
			//.append()- appending a (group) element, not sure why this is needed?

			var svg = d3.select("#home")
						.append("div")
						// .classed("svg-container", true)
					    .append("svg")
					    //responsive SVG needs these 2 attributes and no width and height attr
					    // .attr("preserveAspectRatio", "xMinYMin meet")
					    // .attr("viewBox", "0 0 2000 1700")
					    //class to make it responsive
					    // .classed("svg-content-responsive", true)
					    .attr("width", width)
					    .attr("height", height)
					    //ZOOM DISABLED
		    		    .call(d3.behavior.zoom()
		    		    .on("zoom", redraw))
		    		    .append('g');


            function redraw() {
              svg.attr("transform", "translate(" + d3.event.translate + ")" + " scale(" + d3.event.scale + ")");
            }


            //----------------Force Layout Configuration-----------------//

			//Initialize d3's force layout
			//.charge()- negative values indicate repulsion, + values indicate attraction
			//.linkDistance()- the distance we desire between connected nodes.
			//.size()- size of the graph, need to make it responsive

			var force = d3.layout
						  .force()
						  .charge(-600)
						  .linkDistance(200)
						  .size([width, height]);


            // Prevent pan functionality from overriding node drag functionality

            var drag = force.stop()
				            .drag()
				            .on("dragstart", function(d) { d3.event.sourceEvent.stopPropagation();
            });



            //Data set up for force graph links/nodes
			var data = {}; //used to reference the topics
			var dataLinks = []; //to store links("relationships")

		    //creating key value pairs where the key is topic id, value is the whole topic object
		    $scope.topics.forEach(function(elem){
		  		data[elem.id] = elem;
		    })

		    //creating the array of links by pushing objects with a source, target and value(weight of lines)
		    $scope.prereqs.forEach(function(elem){
		  		dataLinks.push({source: data[elem.topicId], target: data[elem.prerequisiteId], value:1});
		    })


		    //Setting up topics as the force graph nodes, and dataLinks as the links
			 force
			 .nodes($scope.topics)
			 .links(dataLinks)
			 .start();



			 //------------Setting up the actual visual node and link elements------//

			  var link = svg.selectAll(".link")
						    .data(dataLinks)
						    .enter().append("line") // creates lines
						    .attr("class", "link") //gives links class so it can be selected
						    .style("stroke", "black") //stroke color
						      //thickness of links                        //scales line-widths
						    .style("stroke-width", function(d) { return Math.sqrt(d.value); });



			  var node = svg.selectAll("g.node")
					        .data($scope.topics)
					        .enter()
					        .append("g") //svg group element that will contain circle and text elements
					        .attr("class", "node")// give it a class of node
					        .call(force.drag) //lets you drag nodes around screen
					        .on('dblclick', function(d){ $state.go('topic', {topicId: d.id})}) //event handler for going to that topic node's state
					        .on('click', connectedNodes); //event handler added for highlighting connected nodes


			  node.append("circle") //appending a circle to each group element
				  .attr("r", function(d){ return nodeSize(d.resources.length)})
				  .attr("id", function(d){ return d.title; })
				  .style("fill", function(d){ return color(d.title); })


			   node.append("text")//appending text to each group element
				   .attr("text-anchor", "middle")
				   .attr("x", function(d){ return d.x})
				   .attr("y", function(d){ return d.y})
				   .text(function(d) { return d.title; });


			  //------------Handle the tick/force-simulation event and update each nodes location---------//
			  force.on("tick", function() {

			    link
			    .attr("x1", function(d) { return d.source.x; })
			    .attr("y1", function(d) { return d.source.y; })
			    .attr("x2", function(d) { return d.target.x; })
			    .attr("y2", function(d) { return d.target.y; });


			    var circle= d3.selectAll("circle")
						      .attr("cx", function(d) { return d.x; })
						      .attr("cy", function(d) {return d.y; });


		        d3.selectAll("text")
		          .attr("x", function(d) { return d.x; })
		          .attr("y", function(d) { return d.y; });

			  });


			  //-----------------Highlighting connected nodes------------//

			  //Toggle stores whether the highlighting is on
			  var toggle = 0;

			  //Create an array logging what is connected to what
			  var linkedByIndex = {};
			  for ( var i = 0; i < $scope.topics.length; i++) {
			      linkedByIndex[i + "," + i] = 1;
			  };
			  dataLinks.forEach(function (d) {
			      linkedByIndex[d.source.index + "," + d.target.index] = 1;
			  });

			  //This function looks up whether a pair are neighbours
			  function neighboring(a, b) {
			      return linkedByIndex[a.index + "," + b.index];
			  }

			  function connectedNodes() {

			      if (toggle == 0) {
			          //Reduce the opacity of all but the neighbouring nodes
			           var d = d3.select(this).node().__data__;
			          node.style("opacity", function (o) {
			              return neighboring(d, o) | neighboring(o, d) ? 1 : 0.1;
			          });

			          link.style("opacity", function (o) {
			              return d.index==o.source.index | d.index==o.target.index ? 1 : 0.1;
			          });

			          //Reduce the op

			          toggle = 1;
			      } else {
			          //Put them back to opacity=1
			          node.style("opacity", 1);
			          link.style("opacity", 1);
			          toggle = 0;
			      }

			  }





		}
	}

})
