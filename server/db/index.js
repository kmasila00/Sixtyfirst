'use strict';
var db = require('./_db');
module.exports = db;

var User = require('./models/user');
var Topic = require('./models/topic');
var Resource = require('./models/resource');
var Plan = require('./models/plan');
var Prerequisite = require('./models/prereq');
var Flag= require('./models/flag');
var Vote = require('./models/vote');

Topic.belongsToMany(Topic, {as:'prerequisite', through: Prerequisite});
Resource.belongsToMany(Topic, {through: 'ResourceTopic'});
Topic.belongsToMany(Resource, {through: 'ResourceTopic'});
User.hasMany(Resource);
User.hasMany(Plan);
Topic.hasMany(Plan);
Plan.belongsTo(Topic);
Plan.belongsToMany(Resource, {through: 'PlanResource'});
Topic.belongsToMany(User, {as: 'topicFlaggers', through: Flag.flaggedTopic});
Resource.belongsToMany(User, {as: 'ResourceFlaggers', through: Flag.flaggedResource});
