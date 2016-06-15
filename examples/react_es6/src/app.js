/* global fetch */
'use strict'

import React from 'react'
import { render } from 'react-dom'
import Child1 from './deps/common/child1'
import Child2 from './deps/child2'
import {bootstrap} from 'ClientBootstrap';

bootstrap();

const App = React.createClass({
  render: function() {
    return (
      <div className='comment-box'>
        <h1>App</h1>
        <Child1 />
        <Child2 />
      </div>
    )
  }
});

render (
  <App />,
  document.getElementById('content')
)
