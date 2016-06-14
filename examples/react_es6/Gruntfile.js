var extractify = require('../../');

module.exports = function(grunt) {
  'use strict';

  // Load all the plugins in package.json
  require('load-grunt-tasks')(grunt);

  // Project configuration.
  grunt.initConfig({
    watch: {
      script: {
        files: ['src/**'],
        tasks: ['browserify:app']
      }
    },

    browserify: {
      options: {
          browserifyOptions: {
              debug: true
          },
          watch: true
      },
      app: {
          src: ['./src/app.js'],
          dest: './bundle/bundle_app.js',
          options: {
              external: ['react', 'react-dom'],
              transform: [
                  ["babelify", {
                    presets: ["es2015", "react"]
                  }]
              ],
              alias: {
                  ClientBootstrap: './src/lib/boot/bootstrap.js'
              },
              plugin: [
                  [extractify, {
                      lazy: [
                          {
                              entries: [
                                  './src/deps/lazy/child3.js'
                              ],
                              outfile: './bundle/bundle_app_child3.js'
                          },
                          {
                              entries: [
                                  './src/deps/lazy/child5.js'
                              ],
                              outfile: './bundle/bundle_app_child5.js'
                          }
                      ]
                  }]
              ]
          }
      },
      vendor: {
          src: [],
          dest: './bundle/vendor.js',
          options: {
            require: ['react', 'react-dom']
          }
      }
    },
    open: {
      dev: {
        path: 'http://localhost:3333'
      }
    },
    connect: {
      server: {
        options: {
          port: 3334,
          open: true
        }
      }
    }
  });

  grunt.registerTask('default', ['browserify:vendor','browserify:app', 'connect:server', 'watch']);
};