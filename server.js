'use strict';

const bodyParser = require('body-parser');
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const passport = require('passport');
const { Strategy: LocalStrategy } = require('passport-local');

const {DATABASE_URL, PORT} = require('./config');
const {BlogPost} = require('./models');
const { User } = require('./models');

const app = express();

app.use(morgan('common'));
app.use(bodyParser.json());

mongoose.Promise = global.Promise;

const localStrategy = new LocalStrategy((username, password, done) => {
  let user;
  User
    .findOne( {username} )
    .then(results => {
      user = results;

      if (!user) {
        return Promise.reject( {
          reason: 'Login Error',
          message: 'Incorrect username',
          location: username
        });
      }

      return user.validatePassword(password);
    })

    .then(results => {
      if (results === false) {
        return Promise.reject( {
          reason: 'Login Error',
          message: 'Incorrect password',
          location: password
        });
      }
      return done(null, user);
    })
    .catch(err => {
      console.log(err);
      if (err.reason === 'Login Error') {
        return done(null, false);
      }
      return done(err);
    });
});

passport.use(localStrategy);

app.get('/posts', (req, res) => {
  BlogPost
    .find()
    .then(posts => {
      res.json(posts.map(post => post.apiRepr()));
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({error: 'something went terribly wrong'});
    });
});

app.get('/posts/:id', (req, res) => {
  BlogPost
    .findById(req.params.id)
    .then(post => res.json(post.apiRepr()))
    .catch(err => {
      console.error(err);
      res.status(500).json({error: 'something went horribly awry'});
    });
});

app.post('/posts', (req, res) => {
  const requiredFields = ['title', 'content', 'author'];
  for (let i=0; i<requiredFields.length; i++) {
    const field = requiredFields[i];
    if (!(field in req.body)) {
      const message = `Missing \`${field}\` in request body`;
      console.error(message);
      return res.status(400).send(message);
    }
  }

  BlogPost
    .create({
      title: req.body.title,
      content: req.body.content,
      author: req.body.author
    })
    .then(blogPost => res.status(201).json(blogPost.apiRepr()))
    .catch(err => {
      console.error(err);
      res.status(500).json({error: 'Something went wrong'});
    });

});

app.post('/users', (req, res) => {

  const requiredFields = ['username', 'password'];
  const missingField = requiredFields.find(field => !(field in req.body));

  if (missingField) {
    return res.status(422).json({
      code: 422,
      reason: 'Validation Error',
      message: 'Missing field',
      location: missingField
    });
  }

  const stringFields = ['username', 'password', 'firstName', 'lastName'];
  const nonStringField = stringFields.find(field => field in req.body && typeof req.body[field] !== 'string');

  if (nonStringField) {
    return res.status(422).json({
      code: 422,
      reason: 'Validation Error',
      message: 'Incorrect field type: expected string',
      location: nonStringField
    });
  }

  const trimmedFields = ['username', 'password'];
  const nonTrimmedField = trimmedFields.find(field => req.body[field].trim() !== req.body[field]);

  if (nonTrimmedField) {
    return res.status(422).json({
      code: 422,
      reason: 'Validation Error',
      message: 'Cannot start or end with whitespace',
      location: nonTrimmedField
    });
  }


  let {username, password, firstName = '', lastName = ''} = req.body;

  firstName = firstName.trim();
  lastName = lastName.trim();

  return User.find({username})
    .count()
    .then(count => {
      if (count > 0) {
        return Promise.reject( {
          code: 400,
          reason: 'Validation Error',
          message: 'Username is taken',
          location: 'username'
        });
      }
      return User.hashPassword(password);
    })
    .then(digest => {
      return User.create({
        username,
        password: digest,
        firstName,
        lastName
      });
    })
    .then(user => {
      return res.status(201).location(`/api/users/${user.id}`).json(user.apiRepr());
    })
    .catch(err => {
      if (err.reason === 'Validation Error') {
        return res.status(err.code).json(err);
      }
      res.status(500).json({
        code: 500, 
        message: 'Internal server error.'
      });
    });

});

const localAuth = passport.authenticate('local', {session: false});

app.post('/login', localAuth, (req, res) => {
  console.log(req.params);
  return User.findById(req.params.id)
    .then(user => res.json(user.apiRepr()))
    .catch(err => {
      console.log(err);
      res.status(500).json({message: 'Internal server error'})
    });
});


app.delete('/posts/:id', (req, res) => {
  BlogPost
    .findByIdAndRemove(req.params.id)
    .then(() => {
      res.status(204).json({message: 'success'});
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({error: 'something went terribly wrong'});
    });
});


app.put('/posts/:id', (req, res) => {
  if (!(req.params.id && req.body.id && req.params.id === req.body.id)) {
    res.status(400).json({
      error: 'Request path id and request body id values must match'
    });
  }

  const updated = {};
  const updateableFields = ['title', 'content', 'author'];
  updateableFields.forEach(field => {
    if (field in req.body) {
      updated[field] = req.body[field];
    }
  });

  BlogPost
    .findByIdAndUpdate(req.params.id, {$set: updated}, {new: true})
    .then(updatedPost => res.status(204).end())
    .catch(err => res.status(500).json({message: 'Something went wrong'}));
});


app.delete('/:id', (req, res) => {
  BlogPost
    .findByIdAndRemove(req.params.id)
    .then(() => {
      console.log(`Deleted blog post with id \`${req.params.ID}\``);
      res.status(204).end();
    });
});


app.use('*', function(req, res) {
  res.status(404).json({message: 'Not Found'});
});

// closeServer needs access to a server object, but that only
// gets created when `runServer` runs, so we declare `server` here
// and then assign a value to it in run
let server;

// this function connects to our database, then starts the server
function runServer(databaseUrl=DATABASE_URL, port=PORT) {
  return new Promise((resolve, reject) => {
    mongoose.connect(databaseUrl, {useMongoClient: true}, err => {
      if (err) {
        return reject(err);
      }
      server = app.listen(port, () => {
        console.log(`Your app is listening on port ${port}`);
        resolve();
      })
        .on('error', err => {
          mongoose.disconnect();
          reject(err);
        });
    });
  });
}

// this function closes the server, and returns a promise. we'll
// use it in our integration tests later.
function closeServer() {
  return mongoose.disconnect().then(() => {
    return new Promise((resolve, reject) => {
      console.log('Closing server');
      server.close(err => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  });
}

// if server.js is called directly (aka, with `node server.js`), this block
// runs. but we also export the runServer command so other code (for instance, test code) can start the server as needed.
if (require.main === module) {
  runServer().catch(err => console.error(err));
}

module.exports = {runServer, app, closeServer};
