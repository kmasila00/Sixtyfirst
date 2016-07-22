'use strict'

var router = require('express').Router();
var db = require('../../db');
var Topic = db.model('topic');
var Resource = db.model('resource');
var Sequelize = require('sequelize');
var Promise = require('bluebird');
var Auth = require('../configure/auth-middleware');


module.exports = router;

function sendError(message, status) {
	var err = new Error(message);
	err.status = status;
	throw err;
}

router.param('topicId', function(req, res, next, id) {
  Topic.findById(id)
  .then( function(topic) {
    if (!topic) res.sendStatus(404)
    req.topic = topic;
    next();
  }).catch(next)
})

// Fetches all topics
router.get('/', function(req, res, next) {
  Topic.findAll({ include: [Resource] })
  .then(topics => res.status(200).send(topics))
  .catch(next);
});

router.post('/', function(req, res, next) {
  Topic.create(req.body)
  .then(topic => res.status(201).send(topic))
  .catch(next);
});

// Get a single topic, with all its prequisites and subsequent topics
// Raw SQL queries are helpful to simplify pulling prereq/subseq topics
router.get('/:topicId', function(req, res, next) {

  var baseQuery = Topic.findById(req.params.topicId, {
                  include: [ Resource ]
                }),
      prereqQuery = 'SELECT * FROM topics INNER JOIN prerequisites AS p ON topics.id = p."prerequisiteId" WHERE p."topicId" = ' + req.params.topicId,
      subseqQuery = 'SELECT * FROM topics INNER JOIN prerequisites AS p ON topics.id = p."topicId" WHERE p."prerequisiteId" = ' + req.params.topicId;

  Promise.all([
    baseQuery,
    db.query(prereqQuery, { type: Sequelize.QueryTypes.SELECT }),
    db.query(subseqQuery, { type: Sequelize.QueryTypes.SELECT })
  ])
  .spread( function(topic, prereqTopics, subseqTopics) {
    topic.dataValues.prereqTopics = prereqTopics;
    topic.dataValues.subseqTopics = subseqTopics;
    res.json(topic);
  })
  .catch(next);

});


// Add a prerequisite to a given topic
router.post('/:topicId/prerequisite', Auth.assertAuthenticated, function(req, res, next) {
  var prereqName = req.body.title;
  Topic.findOrCreate({ where: { title: prereqName }})
  .then( function(prereq) {
    return req.topic.addPrerequisite(prereq[0]);
  })
  .then(topic => res.status(200).send(topic))
  .catch(next);
});

// Add a subsequent topic to a given topic
router.post('/:topicId/subsequent', Auth.assertAuthenticated, function(req, res, next) {
  var subseqName = req.body.title,
      thisTopic = req.topic;
  Topic.findOrCreate({ where: { title: subseqName }})
  .then( function(subseq) {
    return subseq[0].addPrerequisite(thisTopic);
  })
  .then(topic => res.status(200).send(topic))
  .catch(next);
});



// ============================== ADMIN ROUTES ==============================

router.put('/:topicId', function(req, res, next) {
  if(req.user && req.user.isAdmin === true){
    req.topic.update(req.body)
    .then(topic => res.status(200).json(topic))
    .catch(next);
  } else {
	  sendError('You must be an admin to update a topic', 401);
  }
});

router.delete('/:topicId', function(req, res, next) {
  if(req.user && req.user.isAdmin === true){
    req.topic.destroy()
    .then(function(){
		res.sendStatus(204);
    })
    .catch(next);
  } else {
	  sendError('You must be an admin to delete a topic', 401);
  }
});
