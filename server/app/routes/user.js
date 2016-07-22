'use strict';
var express = require('express');
var router = express.Router();
var User = require('../../db/').model('user');

module.exports = router;

function sendError(message, status) {
    var err = new Error(message);
    err.status = status;
    throw err;
}

router.param('userId', function(req, res, next, id) {
    User.findById(id)
        .then(function(user) {
            req.targetUser = user;
            next();
        })
        .catch(next);
});

router.get('/:userId', function(req, res) {
    res.json(req.targetUser);
});

router.post('/', function(req, res, next) {
    if(!req.body.password || !req.body.email || !req.body.username) {
        sendError('Missing a required field!', 400);
    }
    else {
        User.findOrCreate({
            where: {
                firstname: req.body.firstname,
                lastname: req.body.lastname,
                username: req.body.username,
                email: req.body.email
            },
            defaults: { password: req.body.password }
            })
            .spread(function(user, created) {
                if (!created) {
                    sendError('This user already exists!', 400);

                } else {
                    res.json(user);
                }
            })
            .catch(next);
    }
});

router.put('/:userId', function(req, res, next) {
    req.targetUser.update(req.body)
        .then(function(updatedUser) {
            res.json(updatedUser);
        })
        .catch(next);
});

// ============================== ADMIN ROUTES ==============================
router.get('/', function(req, res, next) {
    if(req.user && req.user.isAdmin === true) {
        User.findAll()
            .then(users => res.json(users))
            .catch(next);
    } else {
        sendError('You must be an admin to get all users', 401);
    }
});

router.delete('/:userId', function(req, res, next) {
    if (req.user && req.user.isAdmin === true) {
        req.targetUser.destroy()
        .then(function() {
            res.sendStatus(204);
        })
        .catch(next);
    } else {
        sendError('You must be an admin to delete a user', 401);
    }
});
