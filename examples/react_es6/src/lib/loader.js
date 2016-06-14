'use strict'

let lazyBundles = [];

function loadJs(url, callback) {
    const script = document.createElement('script');

    if (script.readyState) { // IE
        script.onreadystatechange = function() {
            if (script.readyState === 'loaded' || script.readyState === 'complete') {
                    script.onreadystatechange = null;
                    callback();
            }
        };
    } else { // Others
        script.onload = function() {
            callback();
        };
    }

    script.type = 'text/javascript';
    script.setAttribute('data-origin', 'norrin');
    script.setAttribute('data-inserted-time', Date.now());
    script.src = url;
    document.getElementsByTagName('head')[0].appendChild(script);
}

export function lazyLoadBundle(bundleName, cb) {
    if (lazyBundles[bundleName]) {
        cb(true);
    } else {
        // TODO: show spinner
        loadJs(bundleName ,function(){
            lazyBundles[bundleName] = true;
            setTimeout(function(){
                cb(false);
                // TODO: close spinner
            }, 500); // simulating the network latency, no need for the setTimeout 
        });
    }
}

export function lazyLoadModule(module, cb) {
    let modBundleName = window._extractedModuleBundleMap[module];

    lazyLoadBundle(modBundleName, function(wasLoaded) {
        cb(wasLoaded);
    })
}
