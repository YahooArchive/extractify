'use strict'
//@asyccomponent
import React from 'react'
import Child1 from '../common/child1'

const Child5 = React.createClass({
    render: function() {
      return (
        <div className='child5'>
          {this.props.children}
          Child5 says I am a Lazy Module and render Child1 below
          <Child1 />
        </div>
      );
    }
});

export default Child5