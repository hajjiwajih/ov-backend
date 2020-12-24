// Copyright IBM Corp. 2016. All Rights Reserved.
// Node module: loopback-workspace
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

var loopback = require('loopback');
var boot = require('loopback-boot');
var app = module.exports = loopback();
const env = require('dotenv').config({
  path: "../.env"
});

app.start = function () {
  // start the web server
  return app.listen(function () {
    app.emit('started');
    var baseUrl = app.get('url').replace(/\/$/, '');
    console.log('Web server listening at: %s', baseUrl);
    if (app.get('loopback-component-explorer')) {
      var explorerPath = app.get('loopback-component-explorer').mountPath;
      console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
    }
  });
};

// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, function (err) {
  if (err) throw err;
  // start the server if `$ node server.js`
  if (require.main === module)
    app.start();
});

/**
 * This creates the module that we created in the step before.
 * In my case it is stored in the util folder.
 */
var Prometheus = require('./prometheus');  
...

/**
 * The below arguments start the counter functions
 */
App.use(Prometheus.requestCounters);  
App.use(Prometheus.responseCounters);

/**
 * Enable metrics endpoint
 */
Prometheus.injectMetricsRoute(App);

/**
 * Enable collection of default metrics
 */
Prometheus.startCollection();  
...
