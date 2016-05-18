function handleUnderScore(obj, prop) {
    if (!Array.isArray(obj[prop]) && obj[prop]._ && Array.isArray(obj[prop]._)) {
        if (obj[prop]._.length === 0) {
            obj[prop] = [obj[prop]];
        } else {
            obj[prop] = obj[prop]._;
        }
        delete obj[prop]._;
    }
    return obj;
}

module.exports = function processOptions(opts) {
    if (!(opts && opts.lazy)) {
        throw new Error('Please provide lazy option. Refer to extractify documentation for available options');
    }

    if (opts._) {
        //command line
        if (!opts._.length) {
            delete opts._;
        }
        if (opts.bundleMapOption && opts.bundleMapOption._) {
            delete opts.bundleMapOption._;
        }

    } else {
        // api or grunt
        return opts;
    }

    // process commandline options
    opts = handleUnderScore(opts, 'lazy');
    for (var i = 0; i < opts.lazy.length; i++) {
        if (opts.lazy[i].entries && typeof opts.lazy[i].entries === 'string') {
            // handle single entry
            opts.lazy[i].entries = [opts.lazy[i].entries];
        } else {
            // handle multiple entries
            opts.lazy[i] = handleUnderScore(opts.lazy[i], 'entries');
        }

        delete opts.lazy[i]._;
    }

    return opts;
};

