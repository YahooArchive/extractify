var browserify = require('browserify');
var tap = require('tap');
var test = require('tap').test;
var vm = require('vm');
var fs = require('fs');
var path = require('path');

test('bundle map soft inject', function (t) {
    t.plan(4);

    var b = browserify([], {
        basedir:__dirname
    });

    // this is required to test the bundle
    b.require('./files/main.js',  { expose: 'main' });
    b.plugin(require('../'), {
        bundleMapOption: {
            dest: 'files/dep2.js'
        },
        lazy: [
            {
                entries: [
                    './files/dep4.js'

                ],
                outfile: './lazy_bundle/lazy_bundle_dep4_map.js'
            }

        ]
    });
    b.bundle(function (err, src) {
        var c = vm.createContext({});
        vm.runInContext(src, c);
        // make sure the lazy bundle written
        setTimeout(function() {
            var lazyBundleContent = fs.readFileSync(path.resolve(__dirname, './lazy_bundle/lazy_bundle_dep4_map.js'), {
                encoding: 'utf8'
            });

            vm.runInContext(lazyBundleContent, c);
            t.equal(c.require('main').dep3().loadDep4(), 'dep5');
            t.equal(c.require('main').dep2['dep2'], 'dep2');
            t.equal(c.require('main').dep2['./dep4'], '/lazy_bundle/lazy_bundle_dep4_map.js');
            t.equal(c.require('main').dep2['/files/dep4.js'], '/lazy_bundle/lazy_bundle_dep4_map.js');
        }, 500);
    });
});

test('bundle map hard inject', function (t) {
    t.plan(3);

    var b = browserify([], {
        basedir:__dirname
    });

    // this is required to test the bundle
    b.require('./files/main.js',  { expose: 'main' });
    b.plugin(require('../'), {
        bundleMapOption: {
            injectSoft: false,
            dest: 'lazy_bundle/map.json'
        },
        lazy: [
            {
                entries: [
                    './files/dep4.js'

                ],
                outfile: './lazy_bundle/lazy_bundle_dep4_map.js'
            }

        ]
    });
    b.bundle(function (err, src) {
        var c = vm.createContext({});
        vm.runInContext(src, c);
        // make sure the lazy bundle written
        setTimeout(function() {
            var lazyBundleContent = fs.readFileSync(path.resolve(__dirname, './lazy_bundle/lazy_bundle_dep4_map.js'), {
                encoding: 'utf8'
            });

            vm.runInContext(lazyBundleContent, c);
            t.equal(c.require('main').dep3().loadDep4(), 'dep5');
            t.equal(require('./lazy_bundle/map.json')['./dep4'], '/lazy_bundle/lazy_bundle_dep4_map.js');
            t.equal(require('./lazy_bundle/map.json')['/files/dep4.js'], '/lazy_bundle/lazy_bundle_dep4_map.js');
        }, 500);
    });
});
