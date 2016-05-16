module.exports = function() {
    return {
        loadDep4: function loadDep4(){
            return require('./dep4');
        },
        loadDep6: function loadDep6(){
            return require('./dep6');
        }
    }
};
