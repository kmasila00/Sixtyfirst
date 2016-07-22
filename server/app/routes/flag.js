var express = require('express');
var router = express.Router();
var db= require('../../db/');
var FlaggedTopic= db.model('flaggedTopic');

var FlaggedResource= db.model('flaggedResource');

module.exports = router;

function sendError(message, status) {
    var err = new Error(message);
    err.status = status;
    throw err;
}

//***********Topic flags******************//
router.get('/topic/:topicId', function(req, res, next){
  FlaggedTopic.findAll({
    where: {
      topicId: req.params.topicId
    }
  })
  .then(flaggedTopics => {
    res.status(200).send(flaggedTopics)
  })
  .catch(next);

});

router.post('/topic/:topicId', function(req, res, next){

  req.body.userId= req.user.dataValues.id;
  req.body.topicId= req.params.topicId;
  FlaggedTopic.findOrCreate({
    where: {
      userId: req.body.userId,
      topicId: req.body.topicId
    }
  })
  .spread(function(flaggedTopic, created){
    if(!created){
      //send the error
      sendError("You've already flagged this topic!", 400);
    }
    else{
      flaggedTopic.update({
        reason: req.body.reason,
        description: req.body.description
      })
      .then(updatedFlaggedTopic => res.send(updatedFlaggedTopic))
    }

  })
  .catch(next);

});

router.delete('/topic/:flagId', function(req, res, next){
  FlaggedTopic.destroy({
    where:{
      id: req.params.flagId
    }
  })
  .then( () => res.sendStatus(204))
  .catch(next);
})



// //***********Resource flags******************//


router.get('/resource/:resourceId', function(req, res, next){
  FlaggedResource.findAll({
    where: {
      resourceId: req.params.resourceId
    }
  })
  .then(flaggedResource => res.status(200).send(flaggedResource))
  .catch(next);

});

router.post('/resource/:resourceId', function(req, res, next){
  req.body.userId= req.user.dataValues.id;
  req.body.resourceId= req.params.resourceId

  FlaggedResource.findOrCreate({
    where: {
      userId: req.body.userId,
      resourceId: req.body.resourceId
    }
  })
  .spread(function(flaggedResource, created){
    if(!created){
      //send the error
      sendError("You've already flagged this resource!", 400);
    }
    else{
      flaggedResource.update({
        reason: req.body.reason,
        description: req.body.description
      })
      .then(updatedFlaggedResource => res.send(updatedFlaggedResource))
    }

  })
  .catch(next);

});

router.delete('/resource/:flagId', function(req, res, next){
  FlaggedResource.destroy({
    where:{
      id: req.params.flagId
    }
  })
  .then( () => res.sendStatus(204))
  .catch(next);
})
