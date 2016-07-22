'use strict';
var express = require('express');
var router = express.Router();
var Prereq = require('../../db/').model('prerequisites');


module.exports = router;

router.get('/', function(req, res, next){
	Prereq.findAll()
	.then(function(data){
		res.send(data);
	})
	.catch(next);
});

router.delete('/topic/:topicId/prereq/:prereqId', function(req, res, next){
	Prereq.destroy({
		where:{
			topicId: req.params.topicId,
			prerequisiteId: req.params.prereqId
		}
	})
	.then(() => res.status(200).send())
	.catch(next);
});