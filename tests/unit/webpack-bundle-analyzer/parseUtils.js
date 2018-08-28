const fs = require('fs');

const _ = require('lodash');
const { parseBundle } = require('../../../src/webpack-bundle-analyzer/parseUtils');

const BUNDLES_DIR = `${__dirname}/../../support/fixtures/webpack-bundle-analyzer/bundles`;
const { expect } = intern.getPlugin('chai');
const { describe, it } = intern.getInterface('bdd');

describe('parseBundle', function() {
	const bundles = fs
		.readdirSync(BUNDLES_DIR)
		.filter((filename) => filename.endsWith('.js'))
		.map((filename) => filename.replace(/\.js$/, ''));

	bundles.filter((bundleName) => bundleName.startsWith('valid')).forEach((bundleName) => {
		it(`should parse ${_.lowerCase(bundleName)}`, function() {
			const modules = parseBundle(`${BUNDLES_DIR}/${bundleName}.js`);
			const expectedModules = JSON.parse(fs.readFileSync(`${BUNDLES_DIR}/${bundleName}.modules.json`));

			expect(_.omit(modules, 'src')).to.deep.equal(expectedModules);
		});
	});
});
