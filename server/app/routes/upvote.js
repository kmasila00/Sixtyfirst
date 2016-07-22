var router = require('express').Router();

var Vote = require('../../db/models/vote');
var VoteRelationship = Vote.voteRelationship;
var VoteResource = Vote.voteResource;
var VotePlan = Vote.votePlan;
var Auth = require('../configure/auth-middleware');


module.exports = router;


// Vote Resource
// -- Get all votes for a list of Resources, or all votes for all Resources by default
router.get('/resource', function(req, res, next) {
	var whereCondition = {};
	if(req.query && req.query.resourceIds) {
		if(!Array.isArray(req.query.resourceIds)) {
			req.query.resourceIds = [ req.query.resourceIds ];
		}
		whereCondition = { where: { resourceId: { $in: req.query.resourceIds } } };
	}
	VoteResource.findAll(whereCondition)
	.then(votes => res.send(votes))
	.catch(next);
});

router.post('/resource', Auth.assertAuthenticated, function(req, res, next){
	VoteResource.findOrCreate({ where: {
		userId: req.user.id,
		resourceId: req.body.resourceId
	}})
	.then(() => res.sendStatus(201))
  .catch(next);
});

router.delete('/resource/:resourceId', Auth.assertAuthenticated, function(req, res, next){
	VoteResource.destroy({ where: {
		userId: req.user.id,
		resourceId: req.params.resourceId
	}})
	.then(() => res.sendStatus(204))
  .catch(next);
});

// Vote Plan
router.get('/plan', function(req, res, next) {
	var whereCondition = {};
	if(req.query && req.query.topicId) {
		whereCondition = { where: { topicId: req.query.topicId } };
	}
	VoteRelationship.findAll(whereCondition)
	.then(votes => res.send(votes))
	.catch(next);
});

router.post('/plan', function(req, res, next){
	VotePlan.findOrCreate({ where: {
		userId: req.user.id,
		planId: req.body.planId
	}})
	.then(() => res.sendStatus(201))
  .catch(next);
});

router.delete('/plan/:planId', function(req, res, next){
	VotePlan.destroy({ where: {
		userId: req.user.id,
		planId: req.params.planId
	}})
	.then(() => res.sendStatus(204))
  .catch(next);
});

// Vote Relationship
// -- Get all votes for prerequisites of a topic
router.get('/relationship', function(req, res, next) {
	var whereCondition = {};
	if(req.query) {
		if(req.query.topicId) {
			whereCondition = { where: { topicId: req.query.topicId } };
		} else if(req.query.prerequisiteId) {
			whereCondition = { where: { prerequisiteId: req.query.prerequisiteId } };
		}
	}
	VoteRelationship.findAll(whereCondition)
	.then(votes => res.send(votes))
	.catch(next);
});

router.post('/relationship', Auth.assertAuthenticated, function(req, res, next){
	VoteRelationship.findOrCreate({ where: {
		userId: req.user.id,
		topicId: req.body.topicId,
		prerequisiteId: req.body.prerequisiteId
	}})
	.then(() => res.sendStatus(201))
  .catch(next);
})

router.delete('/relationship/topic/:topicId/prereq/:prerequisiteId', Auth.assertAuthenticated, function(req, res, next){
	VoteRelationship.destroy({ where: {
		userId: req.user.id,
		prerequisiteId: req.params.prerequisiteId,
		topicId: req.params.topicId
	}})
	.then(() => res.sendStatus(204))
  .catch(next);
});
