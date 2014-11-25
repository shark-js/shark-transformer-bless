'use strict';

const chai      = require('chai');
const coMocha   = require('co-mocha');
const expect    = chai.expect;

const TransformerBless = require('../');
const Tree      = require('shark-tree');
const Logger    = require('shark-logger');
const cofse     = require('co-fs-extra');
const path      = require('path');
const sprintf   = require('extsprintf').sprintf;

describe('Initialization', function() {
	before(function *() {
		this.logger = Logger({
			name: 'TransformerBlessLogger'
		});

		this.files = {};
		this.src1 = path.join(__dirname, './fixtures/over-limit.css');
		this.dest1 = path.join(__dirname, './fixtures/test-1.dest.css');
		this.expectDest1 = path.join(__dirname, './fixtures/test-1.dest.expect.css');

		yield cofse.writeFile(this.dest1, '');

		this.files[this.dest1] = {
			files: [this.src1],
			options: {
				bless: {
					enabled: true
				}
			}
		};

		this.tree = yield Tree(this.files, this.logger);
	});

	it('should separate css and output valid result', function *() {
		try {
			var tree = yield TransformerBless.treeToTree(this.tree, this.logger);

			expect(tree.hasDest(this.dest1.replace('.css', '.part1.css'))).to.be.not.undefined();
			expect(tree.hasDest(this.dest1.replace('.css', '.part2.css'))).to.be.not.undefined();

		}
		catch (error) {
			console.error(sprintf('%r', error));
		}
	})
});
