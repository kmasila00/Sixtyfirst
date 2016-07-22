'use strict';
var express = require('express');
var router = express.Router();
var Resource = require('../../db/').model('resource');
var Plan = require('../../db/').model('plan');
var Topic = require('../../db/').model('topic');

module.exports = router;

//Creates a new plan
router.post('/', function(req, res, next){
	Plan.create({
		name: req.body.name,
		description: req.body.description,
		userId: req.user.dataValues.id,
		topicId: req.body.topicId
	})
	.then(newPlan => res.status(201).send(newPlan))
	.catch(next);
});

//Get a specific plan by Id
router.get('/:planId', function(req, res, next) {
	Plan.findById(req.params.planId, { include: [Resource] })
	.then(plan => res.send(plan))
	.catch(next);
})

//Gets all plans for a specific topic
router.get('/topic/:topicId', function(req, res, next){
	Plan.findAll({
		where:{
			topicId: req.params.topicId
		},
		include: [Resource]
	})
	.then(topics =>res.send(topics))
	.catch(next);
});

//Gets all plans for a specific user
router.get('/user/:userId', function(req, res, next){
	Plan.findAll({
		where:{
			userId: req.user.dataValues.id
		},
		include:[Resource, Topic]
	})
	.then(plans => res.send(plans))
	.catch(next);
});

//adds resource to a specific plan
router.post('/:planId/resource/:resourceId', function(req, res, next){
	Plan.findById(req.params.planId)
	.then(function(foundPlan){
		var plan = foundPlan;
		return plan.addResource(req.params.resourceId)
	})
	.then(() => res.status(201).send())
	.catch(next);
});

//delete a whole plan
router.delete('/:planId', function(req, res, next){
	Plan.destroy({
		where:{
			id: req.params.planId
		}
	})
	.then(() => res.status(200).send())
	.catch(next);
});

//remove a resource from a plan
router.delete('/:planId/resource/:resourceId', function(req, res, next){
	Plan.findById(req.params.planId)
	.then(function(plan){
		return plan.removeResource(req.params.resourceId);
	})
	.then(() => res.status(200).send())
	.catch(next);
});
