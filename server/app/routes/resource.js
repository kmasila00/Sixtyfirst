'use strict';
var express = require('express');
var router = express.Router();
var db= require('../../db/');
var Resource = db.model('resource');
var Auth = require('../configure/auth-middleware');
var Topic = db.model('topic');

module.exports = router;

router.param('resourceId', function(req, res, next, id) {
  Resource.findById(id)
  .then(function(resource) {
    if (!resource) res.sendStatus(404);
    req.resource = resource;
    next();
  }).catch(next)
});

router.get('/', function(req, res, next) {
    Resource.findAll()
            .then(resources => res.send(resources))
            .catch(next);
});

router.get('/user/:userId', function(req, res, next) {
	Resource.findAll({ 
		where: { userId: req.params.userId },
		include: [Topic]
   	})
		.then(resources => res.send(resources))
        .catch(next);
});

router.post('/', function(req,res,next){

    var topicId = req.body.topicId;
    req.body.userId= req.user.dataValues.id;
    //create resource
    Resource.create(req.body)
    .tap(function(newResource){
        return newResource.addTopic(topicId);
    })
    .then(resource => res.status(201).send(resource))
    .catch(next);

});

router.get('/:resourceId', function(req, res){
	res.send(req.resource);
});



// ============================== ADMIN ROUTES ==============================


router.put('/:resourceId', function(req,res,next){
	// Resource may be editted by original user or admin
	if(req.user && (req.user.id === req.resource.userId || req.user.isAdmin )){
		req.resource.update(req.body)
		.then(updatedResource => res.status(200).send(updatedResource))
    .catch(next);
	} else {
		var err = new Error('To change this you must be the user who submitted this resource or an Admin');
		err.status = 401;
		throw err;
	}
});

router.delete('/:resourceId', Auth.assertAdmin, function(req,res, next){
	req.resource.destroy()
	.then(() => res.sendStatus(200))
	.catch(next);
});
