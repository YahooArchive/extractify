'use strict'

import React from 'react'

const Child1 = React.createClass({
    render: function() {
      return (
        <div className='Child1'>
          Child1 says I am very common module and should be included in main bundle
        </div>
      );
    }
});

export default Child1