import { SinonSandbox, sandbox as Sandbox, SinonStub, SinonSpy } from 'sinon';
import { SourceMapGenerator, RawSourceMap } from 'source-map';
import {
	disable as disableMockery,
	enable as enableMockery,
	registerAllowable,
	warnOnUnregistered,
	registerMock,
	deregisterMock
} from 'mockery';

const { after, before, beforeEach, describe, it } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');

function getSourceMap(webpackPaths = true) {
	const generator = new SourceMapGenerator({
		file: 'myFile.ts'
	});
	generator.addMapping({
		source: webpackPaths ? 'some/path!myFile1.ts' : 'myFile1.ts',
		generated: {
			line: 5,
			column: 20
		},
		original: {
			line: 10,
			column: 15
		}
	});
	generator.addMapping({
		source: 'myFile2.ts',
		generated: {
			line: 4,
			column: 19
		},
		original: {
			line: 9,
			column: 14
		}
	});
	return JSON.parse(generator.toString());
}

describe('istanbul-loader', () => {
	let loaderUnderTest: any;
	let instrumentMock: SinonStub;
	let sourceMapMock: SinonStub;
	let sandbox: SinonSandbox;
	let createInstrumenterSpy: SinonSpy;

	before(() => {
		sandbox = Sandbox.create();
		instrumentMock = sandbox.stub().callsArg(2);
		sourceMapMock = sandbox.stub().returns(getSourceMap(false));

		const createInstrumenter = () => {
			return {
				instrument: instrumentMock,
				lastSourceMap: sourceMapMock
			};
		};

		createInstrumenterSpy = sandbox.spy(createInstrumenter);

		enableMockery({ useCleanCache: true });
		registerMock('istanbul-lib-instrument', {
			createInstrumenter: createInstrumenterSpy
		});
		registerAllowable('../src/index');
		warnOnUnregistered(false);
		loaderUnderTest = require('../../../src/istanbul-loader/index').default;
	});

	after(() => {
		deregisterMock('istanbul-lib-instrument');
		disableMockery();
	});

	beforeEach(() => {
		sandbox.resetHistory();
	});

	function callLoader(sourceMap: RawSourceMap | null, config = {}) {
		return new Promise<{ source: string; sourceMap?: RawSourceMap }>((resolve, reject) => {
			loaderUnderTest.call(
				{
					query: config,
					async: () => (error: Error, source: string, sourceMap?: RawSourceMap) => {
						if (error) {
							reject(error);
						} else {
							resolve({ source, sourceMap });
						}
					}
				},
				'content',
				sourceMap
			);
		});
	}

	it('can take a config object', () => {
		return callLoader(getSourceMap(), { instrumenterOptions: { esModules: true } }).then(() => {
			createInstrumenterSpy.calledWith({ instrumenterOptions: { esModules: true } });
		});
	});

	it('should call istanbul to instrument files', () => {
		return callLoader(getSourceMap()).then(() => {
			assert.equal(instrumentMock.callCount, 1);
		});
	});

	it('handles no source map', () => {
		return callLoader(null).then(() => {
			assert.equal(instrumentMock.callCount, 1);
		});
	});

	it('handles a source map with no sources', () => {
		const sourceMap = getSourceMap();
		delete sourceMap.sources;
		return callLoader(sourceMap).then(() => {
			assert.equal(instrumentMock.callCount, 1);
		});
	});

	it('should fix source paths', () => {
		// Input source map has a source with a webpack path (e.g.,
		// something!path/to/file.js')
		return callLoader(getSourceMap()).then(({ sourceMap }) => {
			assert.sameMembers(sourceMap!.sources, ['myFile1.ts', 'myFile2.ts']);
		});
	});
});
