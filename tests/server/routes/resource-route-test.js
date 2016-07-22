var expect= require('chai').expect;

var Sequelize= require('sequelize');

var db= require('../../../server/db');
var app= require('../../../server/app')(db);

var supertest= require('supertest');

var Resource= db.model('resource');

var User = db.model('user');


describe('Resource Route', function(){

	beforeEach('Sync DB', function () {
	   return db.sync({ force: true });
	});

	var guestAgent, adminAgent;
	var user = {
	    name: 'grok',
	    email: 'grok@gmail.com',
	    password: 'grok',
	    isAdmin: true
	};
	var resources= [
	{
		name: 'AngularJS Intro',
		url: 'http://www.w3schools.com/angular/angular_intro.asp',
		type: 'tutorial',
		status: 'Approved'

	},
	{
		name: 'ExpressJS Intro',
		url: 'https://www.upwork.com/hiring/development/express-js-a-server-side-javascript-framework/',
		type: 'article',
		status: 'Pending'
	},
	{
		name: 'ReactJS',
		url: 'https://www.youtube.com/watch?v=8HkVHbJZeWY',
		type: 'video',
		status: 'Approved'
	}]

	beforeEach('Create user', function (done) {
	    return User.create(user)
	               .then(function(newUser) {
	                   done();
	               }).catch(done);
	});

	beforeEach('Create resources', function(done){
		var createdResources= resources.map(resource => Resource.create(resource));
		return Promise.all(createdResources)
		.then(() => done())
	})

	beforeEach('Create agents', function (done) {
	    guestAgent = supertest.agent(app);
	    adminAgent = supertest.agent(app);
	    adminAgent.post('/login')
	              .send(user)
	              .end(done);
	});


	describe('Retrieve resources', function(){
		it('all users can see all approved resources', function(done){
			return guestAgent.get('/api/resources')
			.expect(200)
			.end(function(err, res){
				if (err) return done(err);
				expect(res.body).to.be.instanceof(Array);
				expect(res.body).to.have.length(2);
				done();
			})
			});

		it('all users can retrieve one approved resource', function(done){
			return guestAgent.get('/api/resources/1/')
			.expect(200)
			.end(function(err, res){
				if(err) return done(err)
				expect(res.body.name).to.equal('AngularJS Intro');
				done();
			})
		});

		it('admin users can see all resources', function(done){
			return adminAgent.get('/api/resources/')
			.expect(200)
			.end(function(err, res){
				if(err) return done(err)
					expect(res.body).to.be.instanceof(Array);
					expect(res.body).to.have.length(3);
					done();
			})
		})
	})

	describe('Editing and retrieving resources', function(){
		it('non-admin users can not edit a resource', function(done){
			return guestAgent.put('/api/resources/1')
			.send({name: 'Some name'})
			.expect(401)
			.end(done);
		})

		it('admins can edit a resource', function(done){
			return adminAgent.put('/api/resources/1')
			.send({name: 'Some name'})
			.expect(200)
			.end(done)
		})
	})

	describe('Deleting Resources', function(){
	  it('non-admin cannot delete resources', function(done) {
	        guestAgent.delete('/api/resources/1')
	        .expect(401)
	        .end(done);
      });

      it('admins can delete resources', function(done) {
	        adminAgent.delete('/api/resources/1')
	        .expect(200)
	        .end(done);
      });
	})

	});







