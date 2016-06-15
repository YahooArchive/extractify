'use strict'
//@asyccomponent
import React from 'react'
import Child1 from '../common/child1'
import Child4 from '../child4'

const Child3 = React.createClass({
    render: function() {
      return (
        <div className='child3'>
          {this.props.children}
          Child3 says I am a lazy module and render following Child1 and Child4 modules:
          <Child1 />
          <Child4 />
        </div>
      );
    }
});

export default Child3