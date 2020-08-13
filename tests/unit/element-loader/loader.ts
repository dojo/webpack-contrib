import * as path from 'path';
import MockModule from '../../support/MockModule';
import { createSourceFile } from 'typescript';
import * as sinon from 'sinon';
import '../../../src/element-loader/loader';

// const { assert } = intern.getPlugin('chai');
const { afterEach, beforeEach, describe, it } = intern.getInterface('bdd');

describe('css-module-dts-loader', () => {
	let loaderUnderTest: any;
	let mockModule: MockModule;
	let mockUtils: any;
	let mockFs: any;
	let mockTs: any;
	let sandbox: sinon.SinonSandbox;
	const async = () => () => null;
	const loaderContextResolve = (context: string, loadPath: string, callback: (error: any, path?: string) => void) => {
		callback(null, path.join(context, loadPath));
	};
	const resourcePath = 'src/path';
	const defaultScope = { async, resourcePath, resolve: loaderContextResolve };

	const checker = {};
	let sourcesFiles: string[] = [];
	beforeEach(() => {
		sandbox = sinon.sandbox.create();
		sourcesFiles = ['', ''];
		mockModule = new MockModule('../../../src/element-loader/loader', require);
		mockModule.dependencies(['ts', 'path', 'loader-utils']);
		mockUtils = mockModule.getMock('loader-utils');
		mockUtils.getOptions = sandbox.stub();
		mockTs = mockModule.getMock('ts');
		mockTs.createProgram = sandbox.stub().returns({
			getSourceFile(file: string) {
				return createSourceFile(file, sourcesFiles.pop() || '', 0);
			},
			getTypeChecker() {
				return checker;
			}
		});

		loaderUnderTest = mockModule.getModuleUnderTest().default;
	});

	afterEach(() => {
		sandbox.restore();
		mockModule.destroy();
	});

	it('should modify sources', () => {
		mockUtils.getOptions.returns({
			widgets: [{ path: 'foo' }]
		});
		mockFs.statSync.resetHistory();

		loaderUnderTest.call(defaultScope, '');
	});
});
