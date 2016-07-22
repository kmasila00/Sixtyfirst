'use strict';
var Sequelize = require('sequelize');

var db = require('../_db');

var voteResource = db.define('voteResource', {
	userId: Sequelize.INTEGER,
	resourceId: Sequelize.INTEGER
});
var votePlan = db.define('votePlan', {
	userId: Sequelize.INTEGER,
	planId: Sequelize.INTEGER
});
var voteRelationship = db.define('voteRelationship', {
	userId: Sequelize.INTEGER,
	topicId: Sequelize.INTEGER,
	prerequisiteId: Sequelize.INTEGER,
});

module.exports = {
	voteResource: voteResource,
	votePlan: votePlan,
	voteRelationship: voteRelationship
}
