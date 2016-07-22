'use strict';
var router = require('express').Router();

module.exports = router;

router.use('/users', require('./user'));
router.use('/topics', require('./topic'));
router.use('/resources', require('./resource'));
router.use('/plans', require('./plan'));
router.use('/upvote', require('./upvote'));
router.use('/flags', require('./flag'));
router.use('/prerequisites', require('./prereq'));
router.use('/chrome', require('./chrome')); // routes for Chrome extension

// Make sure this is after all of
// the registered routes!
router.use(function (req, res) {
    res.status(404).end();
});
