'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');
const moment = require('moment');

const should = chai.should();

const { BlogPost } = require('../models');
const { app, runServer, closeServer } = require('../server');
const { TEST_DATABASE_URL } = require('../config');

chai.use(chaiHttp);

function seedBlogPostData() {
  console.info('seeding blogpost data....');
  const seedData = [];

  for (let i=1; i <= 10; i++) {
    seedData.push(generateBlogPostData());
  }
  return BlogPost.insertMany(seedData);

}

function generateBlogPostData() {
  return {
    title: faker.lorem.sentence(),
    content: faker.lorem.paragraph(),
    author: {
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName()
    },
    created: faker.date.recent()
  };
}

function tearDownDb() {
  console.warn('Deleting database...');
  return mongoose.connection.dropDatabase();
}

describe('Blog Posts API resource', function() {


  before(function() {
    console.log('starting web server for tests...');

    return runServer(TEST_DATABASE_URL);
  });

  beforeEach(function() {
    return seedBlogPostData();
  });

  afterEach(function() {
    return tearDownDb();
  });

  after(function() {
    return closeServer();
  });
  describe('GET endpoint', function() {
    
    it('should return all existing blog entries', function() {
      let res;
      return chai.request(app)
    
        .get('/posts')
        .then(function(_res) {
          res = _res;
          res.should.have.status(200);
          res.body.should.have.lengthOf.at.least(1);
          return BlogPost.count();
        })
        .then(function(count){
          res.body.should.have.lengthOf(count);
        });
    });

    it('should return blog posts with the correct fields', function() {
      let resPost;
      return chai.request(app)
        .get('/posts')
        .then(function(res) {
          res.should.have.status(200);
          res.should.be.json;
          res.body.should.be.a('array');
          res.body.should.have.lengthOf.at.least(1);

          res.body.forEach(function(post) {
            post.should.be.a('object');
            post.should.include.keys(
              'id', 'title', 'content', 'author', 'created');
          });
          resPost = res.body[0];
          return BlogPost.findById(resPost.id);
        })
        .then(function(post) {
          resPost.id.should.equal(post.id);
          resPost.author.should.contain(post.author.lastName && post.author.firstName);
          resPost.content.should.equal(post.content);
          moment(resPost.created,moment.ISO_8601).toString().should.equal(moment(post.created,moment.ISO_8601).toString());
        //   resPost.created.should.equal(post.created);

        //   resPost.created.should.equal(moment(post.created, moment.ISO_8601)._i);
        });
    });
  });

  describe('POST endpoint', function() {

    it('should create a new blog post', function() {

      const newPost = generateBlogPostData();

      return chai.request(app)
        .post('/posts')
        .send(newPost)
        .then(function(res) {
          res.should.have.status(201);
          res.should.be.json;
          res.body.should.be.a('object');
          res.body.should.include.keys(
            'id', 'author', 'content', 'title', 'created'
          );
          res.body.id.should.not.be.null;
          res.body.author.should.equal(newPost.author.firstName + ' ' + newPost.author.lastName);
          res.body.content.should.equal(newPost.content);
          //   res.body.created.should.equal(newPost.created);
          return BlogPost.findById(res.body.id);
        })
        .then(function(post){
          post.title.should.equal(newPost.title);
          post.content.should.equal(newPost.content);
          post.author.firstName.should.equal(newPost.author.firstName);
          post.author.lastName.should.equal(newPost.author.lastName);
        });
    });
  });
  it('should update fields you send over', function() {
    const updateData = {
      title: 'foobarbizzbang',
      content: 'foobarbizzbang foo foo foo foo bar bar'
    };

    return BlogPost
      .findOne()
      .then(function(post) {
        updateData.id = post.id;

        return chai.request(app)
          .put(`/posts/${post.id}`)
          .send(updateData);
      })
      .then(function(res) {
        res.should.have.status(204);

        return BlogPost.findById(updateData.id);
      })
      .then(function(post) {
        post.title.should.equal(updateData.title);
        post.content.should.equal(updateData.content);
      });
  });

  describe('DELETE endpoint', function() {
    it('should delete a blog post by id', function() {

      let post;

      return BlogPost
        .findOne()
        .then(function(_post){
          post = _post;
          return chai.request(app).delete(`/posts/${post.id}`);
        })
        .then(function(res) {
          res.should.have.status(204);
          return BlogPost.findById(post.id);
        })
        .then(function(_post) {
          should.not.exist(_post);
        });
    });
  });
});

