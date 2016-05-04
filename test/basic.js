var browserify = require('browserify');
var tap = require('tap');
var test = require('tap').test;
var vm = require('vm');
var fs = require('fs');
var path = require('path');

test('basic', function (t) {
    t.plan(3);

    // we should have at least one entry if we don't specify lazyBundleMapOption.dest
    // to inject lazyBundleMap
    var b = browserify(['./files/main.js'], {
        basedir:__dirname
    });

    // this is required to test the bundle
    b.require('./files/main.js',  { expose: 'main' });
    b.plugin(require('../'), {
        lazy: [
            {
                entries: [
                    './files/dep4.js'

                ],
                outfile: './lazy_bundle/lazy_bundle_dep4.js'
            }

        ]
    });
    b.bundle(function (err, src) {
        var c = vm.createContext({});
        vm.runInContext(src, c);
        // make sure the lazy bundle written
        setTimeout(function() {
            var lazyBundleContent = fs.readFileSync(path.resolve(__dirname, './lazy_bundle/lazy_bundle_dep4.js'), {
                encoding: 'utf8'
            });

            vm.runInContext(lazyBundleContent, c);
            t.equal(c.require("/files/dep1.js"), 'dep1');
            t.equal(c.require("/files/dep4.js"), 'dep5');
            t.equal(c.require('main').dep3().loadDep4(), 'dep5');
        }, 500);
    });
});
