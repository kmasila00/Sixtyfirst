'use strict';
var Sequelize = require('sequelize');

var db = require('../_db');

var flaggedResource = db.define('flaggedResource', {
	id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true
	},
	reason: {
		type: Sequelize.ENUM("Rude or Abusive", "Spam", "Duplicate", "Off-Topic")
	},
	description: {
		type: Sequelize.STRING
	}
});

var flaggedTopic = db.define('flaggedTopic', {
	id: {
			type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true
	},
	reason: {
		type: Sequelize.ENUM("Rude or Abusive", "Spam", "Duplicate")
	},
	description: {
		type: Sequelize.STRING
	}
});

module.exports = {
	flaggedResource: flaggedResource,
	flaggedTopic: flaggedTopic
}
