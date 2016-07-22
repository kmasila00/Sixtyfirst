'use strict';
var Sequelize = require('sequelize');

var db = require('../_db');

module.exports = db.define('plan', {

	name: {
		type: Sequelize.STRING,
		allowNull: false,
		validate: {
			notEmpty: true
		}
	},
	description:{
		type: Sequelize.TEXT,
		allowNull:false,
		validate: {
			notEmpty: true
		}
	}

});
