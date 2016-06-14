'use strict'
import React from 'react'
import Child1 from './common/child1'

const Child4 = React.createClass({
    render: function() {
      return (
        <div className='child4'>
          Child4 says I am only used in Child3 Lazy module, so should not be included in main bundle. I use Child1 below
          <Child1 />
        </div>
      );
    }
});

export default Child4