'use strict';

exports.DATABASE_URL = process.env.DATABASE_URL ||
                       global.DATABASE_URL ||
                      'mongodb://localhost/blog-app';

exports.TEST_DATABASE_URL = process.env.DATABASE_URL ||
                            'mongodb://localhost/starter-test-blog-db';


exports.PORT = process.env.PORT || 8080;