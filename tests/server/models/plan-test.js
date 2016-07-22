var expect = require('chai').expect;
var Sequelize = require('sequelize');
var db = require('../../../server/db');

var Plan = db.model('plan');
var Resource = db.model('resource');

describe('Plan Model', function(){

	beforeEach('Sync DB', function(){
		return db.sync({ force: true });
	});

	describe('creating plans', function(){

		it('can create a plan', function(done){
			var validPlan = {
				name: 'This awesome plan',
				description: 'The title says it all'
			};

			return Plan.create(validPlan)
			.then(function(plan){
				expect(plan.name).to.equal('This awesome plan');
				done();
			})
		});

		it('cannot create a plan with empty title', function(done){
			var noName = Plan.build({description:"where is my name?"});
			return noName.validate()
			.then(function(err){
				expect(err).to.be.an('object');
				expect(err.message).to.equal('notNull Violation: name cannot be null');
				done();
			})
		});

		it('cannot create a plan with empty description', function(done){
			var noDesc = Plan.build({name:"Um, im missing a description"});
			return noDesc.validate()
			.then(function(err){
				expect(err).to.be.an('object');
				expect(err.message).to.equal('notNull Violation: description cannot be null');
				done();
			})
		});
		
	});

	describe('Plan associations', function(){

		var thePlan;

		beforeEach('A plan is made', function(){
			var validPlan = {
				name:"This plan is dope",
				description:"There is no plan greater than this"
			};
			return Plan.create(validPlan)
			.then(function(plan){
				thePlan = plan;
				return plan;
			});
		});

		it('can add a resource', function(done){
			var resource = {
				name:"What kind of article is this?",
				url:"thisisnotarealurl.com",
				type:"other",
				status:"Pending"
			};
			return Resource.create(resource)
			.then(function(newRe){
				return thePlan.addResource(newRe);
			})
			.then(function(){
				return thePlan.getResources();
			})
			.then(function(allRes){
				expect(allRes.length).to.equal(1);
				expect(allRes[0].name).to.equal("What kind of article is this?");
				done();
			})
		});

		it('can add multiple resources', function(done){
			var resource1 = {
				name:"This is the first one",
				url:"firstone.com",
				type:"other",
				status:"Pending"
			};
			var resource2 = {
				name:"This is the second one",
				url:"secondone.com",
				type:"other",
				status:"Pending"
			};
			return Resource.create(resource1)
			.then(function(firstRe){
				return thePlan.addResource(firstRe);
			})
			.then(function(){
				return Resource.create(resource2);
			})
			.then(function(secondRe){
				return thePlan.addResource(secondRe);
			})
			.then(function(){
				return thePlan.getResources();
			})
			.then(function(allRes){
				expect(allRes.length).to.equal(2);
				expect(allRes[0].name).to.equal("This is the first one");
				expect(allRes[1].url).to.equal("secondone.com");
				done();
			})
		});

	});


});