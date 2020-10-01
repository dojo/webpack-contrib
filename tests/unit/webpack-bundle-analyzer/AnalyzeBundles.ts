const { afterEach, beforeEach, describe, it } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');
import * as path from 'path';
import MockModule from '../../support/MockModule';
import { stub } from 'sinon';

let mockModule: MockModule;
describe('webpack-bundle-analyzer - AnalyzeBundles', () => {
	beforeEach(() => {
		mockModule = new MockModule('../../../src/webpack-bundle-analyzer/AnalyzeBundles', require);
		mockModule.dependencies(['fs', 'mkdirp', './viewer', './analyzer', 'glob', 'bfj']);
	});
	afterEach(() => {
		mockModule.destroy();
	});
	it('updateStatsHash', () => {
		const fs = mockModule.getMock('fs');

		fs.readFileSync = stub()
			.onFirstCall()
			.returns(JSON.stringify({ foo: 'new', bar: 'baz' }))
			.onSecondCall()
			.returns(JSON.stringify({ foo: 'old' }));

		const updateStatsHash = mockModule.getModuleUnderTest().updateStatsHash;
		assert.deepEqual(updateStatsHash({ key: 'old' }, '..', '../..'), { key: 'new' });
		assert.isTrue(fs.readFileSync.calledWith('../manifest.json', 'utf8'));
		assert.isTrue(fs.readFileSync.calledWith('../../manifest.original.json', 'utf8'));
	});

	it('generateStatsFile', () => {
		const mkdirp = mockModule.getMock('mkdirp').ctor;
		mkdirp.sync = stub().returns(null);
		const bfj = mockModule.getMock('bfj');
		bfj.write = stub().returns(null);

		const generateStatsFile = mockModule.getModuleUnderTest().generateStatsFile;
		generateStatsFile('stats', 'outputDirectory', 'outputPath');

		assert.isTrue(mkdirp.sync.calledWith('outputDirectory'));
		assert.isTrue(
			bfj.write.calledWith('outputPath', 'stats', {
				promises: 'ignore',
				buffers: 'ignore',
				maps: 'ignore',
				iterables: 'ignore',
				circular: 'ignore'
			})
		);
	});

	it('generateStaticReport', () => {
		const viewer = mockModule.getMock('./viewer');
		viewer.generateReportData = stub().returns('report data');

		const generateStaticReport = mockModule.getModuleUnderTest().generateStaticReport;

		assert.equal(generateStaticReport('stats', 'outputPath', 'filename', true), 'report data');
		assert.isTrue(
			viewer.generateReportData.calledWith('stats', {
				reportFilename: path.resolve('outputPath', 'filename'),
				bundleDir: 'outputPath',
				excludeBundle: true
			})
		);
	});
});
