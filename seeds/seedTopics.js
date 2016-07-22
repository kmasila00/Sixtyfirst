'use strict';

const Promise = require('sequelize').Promise;
const Topic = require('../server/db').model('topic');

module.exports= function(){
	let topics= [
		{
			title: 'AngularJS',
			description: 'A framework that lets you extend HTML vocabulary for your application. The resulting environment is extraordinarily expressive, readable, and quick to develop.'
		},
		{
			title: 'Node.js',
			description: 'A JavaScript runtime built on Chrome\'s V8 JavaScript engine. Node.js uses an event-driven, non-blocking I/O model that makes it lightweight and efficient.'
		},
		{
			title: 'Express.js',
			description: 'A minimal and flexible Node.js web application framework that provides a robust set of features for web and mobile applications.'
		},
		{
			title: 'JavaScript',
			description: 'A high-level, dynamic, untyped, and interpreted programming language. It has been standardized in the ECMAScript language specification.'
		}
	]

	let creatingTopics = topics.map((topicObj) => {
	  return Topic.create(topicObj)
	})

	console.log('Creating topics...')
	return Promise.all(creatingTopics)
	.then( function(newTopics) {
		// create associations
		console.log('Adding topic associations...');
		return Promise.all([
			newTopics[1].addPrerequisite(newTopics[3]), // JS-->Node
			newTopics[2].addPrerequisite(newTopics[1]), // Node-->Express
			newTopics[0].addPrerequisite(newTopics[3]), // JS-->Angular
		]);
	});
}
