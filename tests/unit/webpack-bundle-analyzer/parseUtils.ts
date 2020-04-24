const { describe, it } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');

import * as fs from 'fs';
import * as path from 'path';

import { findLargestPackage, parseBundle } from '../../../src/webpack-bundle-analyzer/parseUtils';

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

	it('finds the largest package dependency', () => {
		assert.deepEqual(
			findLargestPackage({
				groups: [
					{
						label: 'node_modules',
						groups: [
							{
								label: 'foo-1',
								statSize: 5000,
								parsedSize: 4000,
								groups: [
									{
										label: 'foo-3',
										path: 'node_modules/@dojo/foo/foo-3',
										statSize: 8000,
										parsedSize: 7000
									},
									{ label: 'foo-4', path: 'node_modules/foo', statSize: 2000, parsedSize: 1000 }
								]
							},
							{
								label: 'foo-2',
								path: 'node_modules/@dojo/foo/node_modules/@dojo/foo/bar/foo-2',
								statSize: 6000
							}
						]
					},
					{
						label: 'bar',
						groups: [{ label: 'bar-1', statSize: 10000 }, { label: 'bar-2', statSize: 20000 }]
					}
				]
			}),
			{ size: 13000, name: '@dojo/foo' }
		);
	});
});
