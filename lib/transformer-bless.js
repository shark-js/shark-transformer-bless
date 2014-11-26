'use strict';

const Transformer   = require('shark-transformer');
const bless         = require('bless4');
const extend        = require('node.extend');
const co            = require('co');
const VError        = require('verror');
const path          = require('path');
const Tree          = require('shark-tree');

const loggerOpName = 'bless';


module.exports = Transformer.extend({
	init: function() {
		this.options = extend({}, this.optionsDefault, this.options);
		this.blessResults = {};
	},

	parseBless: function(css, destPath) {
		var time = this.logger.time();
		try {
			if (!this.logger.inPipe()) {
				this.logger.info({
					opName: loggerOpName,
					opType: this.logger.OP_TYPE.STARTED
				}, path.basename(destPath));
			}

			var result = bless(css, 4079);
			var partsInfo = result.data.length > 1 ?
				'parts: ' + result.data.length :
				'no parts';

			this.logger.info({
				opName: loggerOpName,
				opType: this.logger.OP_TYPE.FINISHED_SUCCESS,
				duration: time.delta()
			}, this.logger.inPipe() ? '' : path.basename(destPath), partsInfo);

			return result;
		}
		catch (error) {
			this.logger.warn({
				opName: loggerOpName,
				opType: this.logger.OP_TYPE.FINISHED_ERROR,
				duration: time.delta()
			}, path.basename(destPath), error.message);
			throw new VError(error, 'Bless error');
		}
	},

	transformTree: function *() {
		try {
			var _tree = this.tree.getTree();
			for (var destPath in _tree) {
				if (_tree.hasOwnProperty(destPath)) {
					yield this.transformTreeConcreteDest(destPath, _tree[destPath]);
				}
			}
		}
		catch (error) {
			throw new VError(error, 'TransformerBless#transformTree');
		}
	},

	transformTreeConcreteDest: function *(destPath, srcCollection) {
		return srcCollection.forEachSeries(co.wrap(function *(srcFile, index, done) {
			try {
				var options = extend({}, this.options, srcCollection.getOptions().bless);

				if (options.enabled !== true) {
					this.logger.info('%s disabled, passing...', loggerOpName);
					done();
					return;
				}

				var blessData = this.parseBless(
					srcFile.getContent(),
					destPath
				);

				if (blessData.data.length > 1) {
					this.blessResults[destPath] = blessData;
				}

				done();
			}
			catch (error) {
				done(new VError(error, 'Bless#transformTreeConcreteDest error'));
			}
		}.bind(this)));
	},

	transformTreeWithBlessResults: function *() {
		var blessResults = this.blessResults;
		if (Object.keys(blessResults).length === 0) {
			return;
		}

		for (var destPath in blessResults) {
			if (!blessResults.hasOwnProperty(destPath)) {
				continue;
			}

			var blessResult = blessResults[destPath].data;
			var newTreeCreated = false;

			for (var i = 0, part = 1, len = blessResult.length; i < len; i += 1, part += 1) {
				var blessContent = blessResult[i];

				if (blessContent.length === 0) {
					part -= 1;
					continue;
				}

				var ext = path.extname(destPath);
				var basename = path.basename(destPath, ext);
				var dirname = path.dirname(destPath);

				var newDestPath = path.join(dirname, basename + '.part' + part + ext);
				var newFiles = {};
				newFiles[newDestPath] = {
					files: [],
					options: this.tree.getSrcCollectionByDest(destPath).getOptions()
				};

				var newTree = yield Tree(newFiles, this.logger);

				newTree.getSrcCollectionByDest(newDestPath).setContent(blessContent);

				this.tree.merge(newTree);
				newTreeCreated = true;
			}

			if (newTreeCreated) {
				var _tree = this.tree.getTree();
				delete _tree[destPath];
			}
			else {
				this.logger.warn('something wrong with bless, because all blessContent.length equals 0');
			}
		}
	},

	treeToTree: function *() {
		try {
			yield this.tree.fillContent();

			yield this.transformTree();
			yield this.transformTreeWithBlessResults();

			return this.tree;
		}
		catch (error) {
			throw new VError(error, 'TransformerBless#treeToTree');
		}
	}
});