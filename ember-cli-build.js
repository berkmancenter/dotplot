/*jshint node:true*/
/* global require, module */
var EmberApp = require('ember-cli/lib/broccoli/ember-app');
var mergeTrees = require('broccoli-merge-trees');
var Funnel = require('broccoli-funnel');

module.exports = function (defaults) {
    var app = new EmberApp(defaults, {
        // Add options here
        sassOptions: {
            includePaths: ['bower_components/material-design-lite/src']
        }
    });

    // Use `app.import` to add additional libraries to the generated
    // output files.
    //
    // If you need to use different assets in different
    // environments, specify an object as the first parameter. That
    // object's keys should be the environment name and the values
    // should be the asset to use in that environment.
    //
    // If the library that you are including contains AMD or ES6
    // modules that you would like to import into your application
    // please specify an object with the list of modules as keys
    // along with the exports of each module as its value.


    var materialSVG = new Funnel('bower_components/material-design-lite/src/images', {
        srcDir: '/',
        include: ['**/*.svg'],
        destDir: '/images'
    });


    app.import('vendor/material-design-icons.css');
    app.import('vendor/open-sans.css');
    app.import('bower_components/file-saver/FileSaver.js');
    app.import('bower_components/animate.css/animate.css');
    app.import('bower_components/fuse.js/dist/fuse.js');

    return mergeTrees([app.toTree(), materialSVG]);
};
