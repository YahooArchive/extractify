var browserify = require('browserify');
var tap = require('tap');
var test = require('tap').test;
var vm = require('vm');
var path = require('path');

test('basic', function (t) {
    t.plan(3);

    // we should have at least one entry if we don't specify lazyBundleMapOption.dest
    // to inject lazyBundleMap
    var b = browserify(['./files/main.js'], {
        basedir:__dirname
    });
    var c = vm.createContext({});
    var mainBundleSrc = "";
    var lazyBundleSrc = {};
    var pending = 2;

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

    b.on('lazyStream', function(src) {
        src.on('data', function(chunk) {
            if (lazyBundleSrc[src.file] === undefined) {
                lazyBundleSrc[src.file] = [];
            }
            lazyBundleSrc[src.file].push(chunk);
        }).on('end', function() {
            pending--;
            done();
        });
    });

    b.bundle(function (err, src) {
        mainBundleSrc = src;
        pending--;
        done();
    });

    function done () {
        if (pending !== 0) {
            return;
        }

        vm.runInContext(mainBundleSrc, c);
        Object.keys(lazyBundleSrc).forEach(function(key) {
            vm.runInContext(lazyBundleSrc[key].join(''), c);
        });

        t.equal(c.require("/files/dep1.js"), 'dep1');
        t.equal(c.require("/files/dep4.js"), 'dep5');
        t.equal(c.require('main').dep3().loadDep4(), 'dep5');
    }
});
