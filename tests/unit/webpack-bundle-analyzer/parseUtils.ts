const { describe, it } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');

import * as fs from 'fs';
import * as path from 'path';

import { parseBundle } from '../../../src/webpack-bundle-analyzer/parseUtils';

describe('webpack-bundle-analyzer - parseUtils', () => {
	it('parseBundle', () => {
		const result = parseBundle(path.join(__dirname, 'fixtures', 'sourceBundle.js'));
		const expectedResult = fs.readFileSync(path.join(__dirname, 'fixtures', 'parsedBundle.txt'), 'utf8');
		assert.strictEqual(JSON.stringify(result), expectedResult);
	});
	it('parseBundle - legacy', () => {
		const result = parseBundle(path.join(__dirname, 'fixtures', 'sourceLegacyBundle.js'));
		const expectedResult = fs.readFileSync(path.join(__dirname, 'fixtures', 'parsedLegacyBundle.txt'), 'utf8');
		assert.strictEqual(JSON.stringify(result), expectedResult);
	});
});
