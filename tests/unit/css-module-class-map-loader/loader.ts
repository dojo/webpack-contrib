import loader, { classesMap } from '../../../src/css-module-class-map-loader/loader';

const { assert } = intern.getPlugin('chai');
const { describe, it } = intern.getInterface('bdd');

describe('css-module-class-map-loader', () => {
	it('Should transform module locals based on the classes map', () => {
		const content = `exports.locals = {
			"world": "world",
			"bar": "bar"
		};`;
		classesMap.set('blah', {
			foo: 'bar world'
		});

		const result = loader.call({ resourcePath: 'blah' }, content);
		assert.equal(result, 'exports.locals = {"foo":"bar world"};');
	});

	it('Should return the original content if no matches are found in the class map', () => {
		const content = `exports.locals = {
			"hello": "world",
			"foo": "bar"
		};`;

		const result = loader.call({ resourcePath: 'other' }, content);
		assert.equal(
			result,
			`exports.locals = {
			"hello": "world",
			"foo": "bar"
		};`
		);
	});
});
