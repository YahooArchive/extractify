'use strict'

import React from 'react'
import {lazyLoadModule} from '../lib/loader.js'

let Child3;
let Child5;

const Child2 = React.createClass({

	getInitialState: function(){
		return {
			child3Loaded: false,
			child5Loaded: false
		}
	},

	handleClick: function() {
		let that = this;
		if (!this.state.child3Loaded) {
			lazyLoadModule('./lazy/child3.js', function() {
					Child3 = require('./lazy/child3.js').default;
					that.setState({
						child3Loaded: true
					});
				}
			);
		}
		if (!this.state.child5Loaded) {
			lazyLoadModule('./lazy/child5.js', function() {
					Child5 = require('./lazy/child5.js').default;
					that.setState({
						child5Loaded: true
					});
				}
			);
		}
	},

	render: function() {
		return (
			<div className='child2' onClick={this.handleClick}>
				Child2 says <a href="#">click to load Child3 amd Child5 lazy modules</a>

				{ Child3 &&
					<Child3 className='foo' />
				}
				{ Child5 &&
					<Child5 className='foo' />
				}
			</div>
		);
	}
});

export default Child2