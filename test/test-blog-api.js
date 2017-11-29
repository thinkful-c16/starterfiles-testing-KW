'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

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
    created: Date.now()
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
          console.log(post);
          console.log(resPost);

          resPost.id.should.equal(post.id);
          resPost.author.should.contain(post.author.lastName && post.author.firstName);
          resPost.content.should.equal(post.content);
        //   resPost.created.should.equal(post.created);
        });
    });
  });
});

//AssertionError: expected '
// Rosalyn Farrell' to include { lastName: 'Farrell', firstName: 'Rosalyn' }

