'use strict'
var db = require('../_db');
const Sequelize = require('sequelize')

module.exports = db.define('topic', {
    title: {
      type: Sequelize.STRING,
  		unique: true,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    description: {
      type: Sequelize.TEXT
    }
  });
