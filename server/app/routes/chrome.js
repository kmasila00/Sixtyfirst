'use strict';
var express = require('express');
var router = express.Router();
var Promise = require('bluebird');
var Resource = require('../../db/').model('resource');
var Topic = require('../../db/').model('topic');
var Plan = require('../../db/').model('plan');
var Auth = require('../configure/auth-middleware');

module.exports = router;

// Sends list of topic titles
router.get('/topics', function(req, res, next){
  Topic.findAll()
  .then(topics => res.json(topics))
  .catch(next);
});

router.post('/resource', Auth.assertAuthenticated, function(req, res, next){
  req.body.userId = req.user.dataValues.id;
  var createdResource, topicId;
  Promise.all([
    Resource.create(req.body),
    Topic.findOrCreate({ where: { title: req.body.topicName }})
  ])
  .spread(function(newResource, topic){
    createdResource = newResource;
    topicId = topic[0].id;
    return newResource.addTopic(topicId);
  })
  .then(function() {
    // add the resource to a plan if the user elected to do so
    // plan for a given topic is created if it does not already exist
    if(req.body.addToPlan) {
      return Plan.findOrCreate({
        where: {
          userId: req.body.userId,
          topicId: topicId
        },
        defaults: {
          name: 'My ' + req.body.topicName + ' learning plan',
          description: 'I am learning ' + req.body.topicName + '.'
        }
      })
      .then(function(plan) {
        // add a resource to the first plan returned
        return plan[0].addResource(createdResource.id);
      })
    } else return;
  })
  .then(() => res.status(201).end())
  .catch(next);
});

router.get('/plans/user/:userId', function(req, res, next){
	Plan.findAll({ where: {
			userId: req.params.userId
		}, include: [ Resource ]
	})
	.then(plans => res.send(plans))
  .catch(next);
});
