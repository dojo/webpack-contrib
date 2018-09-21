const { describe, it } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');

import * as fs from 'fs';
import * as path from 'path';

import { getViewerData } from '../../../src/webpack-bundle-analyzer/analyzer';

describe('webpack-bundle-analyzer - analyzer', () => {
	it('getViewerData', () => {
		const bundleData = fs.readFileSync(path.join(__dirname, 'fixtures', 'bundleStats.json'), 'utf8');

		const viewerData = getViewerData(JSON.parse(bundleData), path.join(__dirname, 'fixtures'));
		const expectedViewerData = fs.readFileSync(path.join(__dirname, 'fixtures', 'viewerData.json'), 'utf8');
		assert.strictEqual(JSON.stringify(viewerData), expectedViewerData);
	});
});
