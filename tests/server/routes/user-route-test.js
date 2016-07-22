// Instantiate all models
var expect = require('chai').expect;

var Sequelize = require('sequelize');

var db = require('../../../server/db');
var app = require('../../../server/app')(db);

var supertest = require('supertest');

var User = db.model('user');

describe('User Route', function () {

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

    beforeEach('Create user', function (done) {
        return User.create(user)
                   .then(function(newUser) {
                       done();
                   }).catch(done);
    });

    beforeEach('Create agents', function (done) {
        guestAgent = supertest.agent(app);
        adminAgent = supertest.agent(app);
        adminAgent.post('/login')
                  .send(user)
                  .end(done);
    });

    describe('testing user routes', function () {

        it('ordinary users cannot get all users', function (done) {
            guestAgent.get('/api/users')
                      .expect(401)
                      .end(done);
        });

        it('admin users can get all users', function (done) {
            adminAgent.get('/api/users')
                      .expect(200)
                      .end(function(err,response) {
                          if(err) return done(err);
                          expect(response.body).to.be.an('array');
                          expect(response.body).to.have.lengthOf(1);
                          expect(response.body[0].name).to.equal('grok');
                          done();
                      });
        });

        it('can add a User by ID', function (done) {
            guestAgent.get('/api/users/1')
                      .expect(200)
		      .end(function(err,response) {
                          if(err) return done(err);
                          expect(response.body).to.be.an('object');
                          expect(response.body.name).to.equal('grok');
                          expect(response.body.email).to.equal('grok@gmail.com');
                          done();
                      });
        });

        it('can add a User to db',function(done){
            guestAgent.post('/api/users')
                      .send({
                          name: 'Saitama',
                          email: 'saitama@fs.com',
                          password: '123',
                          isAdmin: true
                      })
                      .expect(200)
                      .end(function(err,response) {
                          if(err) return done(err);
                          expect(response.body).to.be.an('object');
                          expect(response.body).to.have.any.keys('name','email');
                          expect(response.body.name).to.equal('Saitama');
                          expect(response.body.email).to.equal('saitama@fs.com');
			  done();
                      })
        })

        it('can modify a User', function (done) {
            guestAgent.put('/api/users/1')
                      .send({ name: 'tacomaster' })
                      .expect(200)
		      .end(function(err,response) {
                          if(err) return done(err);
                          expect(response.body).to.be.an('object');
                          expect(response.body.name).to.equal('tacomaster');
                          expect(response.body.email).to.equal('grok@gmail.com');
                          done();
                      });
        });

        it('ordinary users cannot delete a User', function (done) {
          guestAgent.delete('/api/users/1')
          .expect(401)
          .end(done);
        });

        it('admins can delete a User', function (done) {
          adminAgent.delete('/api/users/1')
          .expect(204)
		      .end(function(err,response) {
            if(err) return done(err);
            done();
          });
        });

    });
});
