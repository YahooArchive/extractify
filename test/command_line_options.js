/* Copyright 2016, Yahoo Inc.
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

var test = require('tap').test;

test('commandline options', function(t) {
    var processOptions = require('../lib/process_options');
    var opt1 = {
        '_': [],
        'lazy': {
            '_': [{
                '_': [],
                'entries': {
                    '_': ['foo1', 'bar1']
                },
                'outfile': 'oo1'
            }, {
                '_': [],
                'entries': {
                    '_': ['foo12', 'bar2']
                },
                'outfile': 'oo2'
            }]
        },
        'bundleMapOption': {
            '_': [],
            'dest': 'boo',
            'basedir': 'moo'
        }
    };
    var expected1 = {
        'lazy': [{
            'entries': ['foo1', 'bar1'],
            'outfile': 'oo1'
        }, {
            'entries': ['foo12', 'bar2'],
            'outfile': 'oo2'
        }],
        'bundleMapOption': {
            'dest': 'boo',
            'basedir': 'moo'
        }
    };
    var opt2 = {
        '_': [],
        'lazy': {
            '_': [{
                '_': [],
                'entries': {
                    '_': ['foo1', 'bar1']
                },
                'outfile': 'oo1'
            }]
        }
    };
    var expected2 = {
        'lazy': [{
            'entries': ['foo1', 'bar1'],
            'outfile': 'oo1'
        }]
    };
    var opt3 = {
        '_': [],
        'lazy': {
            '_': [{
                '_': [],
                'entries': {
                    '_': ['foo1', 'bar1']
                },
                'outfile': 'oo1'
            }]
        }
    };
    var expected3 = {
        'lazy': [{
            'entries': ['foo1', 'bar1'],
            'outfile': 'oo1'
        }]
    };
    var opt4 = {
        '_': [],
        'lazy': {
            '_': [],
            'entries': 'foo1',
            'output': 'oo1'
        }
    };
    var expected4 = {
        'lazy': [{
            'entries': ['foo1'],
            'output': 'oo1'
        }]
    };

    t.plan(5);
    t.same(processOptions(opt1), expected1);
    t.same(processOptions(opt2), expected2);
    t.same(processOptions(opt3), expected3);
    t.same(processOptions(opt4), expected4);
    t.throws(function() {
        processOptions({});
    });
});
