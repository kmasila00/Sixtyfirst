// var sinon = require('sinon');
var expect = require('chai').expect;

var Sequelize = require('sequelize');

var db = require('../../../server/db');

var Topic = db.model('topic');
var PrerequisiteTopic = db.model('PrerequisiteTopic');

describe('Topic model', function () {

    beforeEach('Sync DB', function () {
      return db.sync({ force: true });
    });

    describe('creating topics', function () {

      it('can create a topic with a title and description', function() {
        var validTopic = {
          title: 'JavaScript',
          description: 'Greatest programming language ever, or greatest language ever?'
        };
        return Topic.create(validTopic)
        .then( function(newTopic) {
          expect(newTopic.title).to.equal(validTopic.title);
        });
      });

      it('cannot create a topic with a blank title', function() {
        var invalidTopic = Topic.build({ description: 'Description of something' });
        return invalidTopic.validate()
        .then( function (err) {
          expect(err).to.be.an('object');
          expect(err.message).to.equal('notNull Violation: title cannot be null');
        });
      });

      it('cannot create a topic with a blank description', function() {
        var invalidTopic = Topic.build({ title: 'A title' });
        return invalidTopic.validate()
        .then( function (err) {
          expect(err).to.be.an('object');
          expect(err.message).to.equal('notNull Violation: description cannot be null');
        });
      });
    });

    describe('topic associations', function () {

      var baseTopic;

      beforeEach('Add a base topic', function() {
        var validTopic = {
          title: 'Node',
          description: 'Master of the serveriverse?'
        };
        return Topic.create(validTopic)
        .then(function(newTopic) {
          baseTopic = newTopic;
          return newTopic;
        });
      });

      it('can add a prerequisite topic', function() {
        var topic = {
          title: 'JavaScript',
          description: 'Greatest programming language ever, or greatest language ever?'
        };
        return Topic.create(topic)
        .then( function(newTopic) {
          return baseTopic.addPrerequisite(newTopic);
        })
        .then( function() {
          return baseTopic.getPrerequisite();
        })
        .then( function(prerequisites) {
          expect(prerequisites.length).to.equal(1);
          expect(prerequisites[0].title).to.equal(topic.title);
        });
      });

      it('can add a subsequent topic', function() {
        var topic = {
          title: 'Express',
          description: 'Runs your server more expressly.'
        }
        return Topic.create(topic)
        .tap( function(newTopic) {
          return newTopic.addPrerequisite(baseTopic);
        })
        .then( function(newTopic) {
          return newTopic.getPrerequisite();
        })
        .then( function(prerequisites) {
          expect(prerequisites.length).to.equal(1);
          expect(prerequisites[0].title).to.equal(baseTopic.title);
        });
      })
    });

});
