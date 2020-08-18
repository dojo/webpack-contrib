import * as path from 'path';
import MockModule from '../../support/MockModule';
import * as sinon from 'sinon';
import '../../../src/css-module-dts-loader/loader';

const { assert } = intern.getPlugin('chai');
const { afterEach, beforeEach, describe, it } = intern.getInterface('bdd');

const cssFilePath = './file.m.css';
const cssFilePath2 = 'path/to/file2.m.css';
const cssFilePath3 = '/path/to/file3.m.css';

const cssContent = `
	.foo: {
		color: red;
	}
`;

const tsContentWithCss = `
	import thing from 'place';
	import * as css from '${cssFilePath}';
`;

const tsContentWithMultipleCss = `
	import thing from 'place';
	import * as css from '${cssFilePath}';
	import this from 'that';
	import * as css2 from '${cssFilePath2}';
	import * as css3 from '${cssFilePath3}';
`;

const tsContentWithoutCss = `
	import thing from 'place';
	import this from 'that';
	import other from 'somemoduleendingwithcss';
`;

describe('css-module-dts-loader', () => {
	let loaderUnderTest: any;
	let mockModule: MockModule;
	let mockDTSGenerator: any;
	let mockUtils: any;
	let mockFs: any;
	let mockInstances: any;
	let sandbox: sinon.SinonSandbox;
	const async = () => () => null;
	const loaderContextResolve = (context: string, loadPath: string, callback: (error: any, path?: string) => void) => {
		callback(null, path.join(context, loadPath));
	};
	let writeFile: sinon.SinonStub;
	let create: sinon.SinonStub;
	const resourcePath = 'src/path';
	const dateNow = new Date();
	let instance: any;
	const defaultScope = { async, resourcePath, resolve: loaderContextResolve };
	let createResult: any;

	function getInstance() {
		return {
			files: {
				[resourcePath]: true
			}
		};
	}

	beforeEach(() => {
		sandbox = sinon.sandbox.create();
		writeFile = sandbox.stub();
		createResult = {
			writeFile,
			formatted: 'formatted css'
		};
		create = sandbox.stub().returns(Promise.resolve(createResult));
		mockModule = new MockModule('../../../src/css-module-dts-loader/loader', require);
		mockModule.dependencies(['typed-css-modules', 'ts-loader/dist/instances', 'loader-utils', 'fs']);
		mockDTSGenerator = mockModule.getMock('typed-css-modules');
		mockDTSGenerator.default = sandbox.stub().returns({ create });
		mockUtils = mockModule.getMock('loader-utils');
		mockUtils.getOptions = sandbox.stub();
		mockFs = mockModule.getMock('fs');
		mockFs.statSync = sandbox.stub().returns({ mtime: dateNow });
		mockFs.existsSync = sandbox.stub();
		mockFs.existsSync.returns(true);
		mockFs.writeFileSync = sandbox.stub();
		mockFs.readFileSync = sandbox.stub();
		mockFs.readFileSync.withArgs('src/file.css').returns(cssContent);
		mockInstances = mockModule.getMock('ts-loader/dist/instances');
		instance = getInstance();
		mockInstances.getTypeScriptInstance = sandbox.stub().returns({ instance });
		loaderUnderTest = mockModule.getModuleUnderTest().default;
	});

	afterEach(() => {
		sandbox.restore();
		mockModule.destroy();
	});

	it('should not generate a dts file when css mtime has not changed', () => {
		mockUtils.getOptions.returns({});
		mockFs.statSync.resetHistory();

		return new Promise((resolve, reject) => {
			loaderUnderTest.call(defaultScope, tsContentWithCss);
			loaderUnderTest.call(
				{
					async() {
						return () => resolve();
					},
					resourcePath,
					resolve: loaderContextResolve
				},
				tsContentWithCss
			);
		}).then(() => {
			assert.isTrue(mockFs.statSync.calledTwice);
			assert.isTrue(create.calledOnce);
			assert.isTrue(writeFile.calledOnce);
			assert.isTrue(mockFs.writeFileSync.notCalled);
		});
	});

	it('should generate a dts file when css mtime has changed', () => {
		mockUtils.getOptions.returns({});
		mockFs.statSync.resetHistory();
		mockFs.statSync.onSecondCall().returns({ mtime: new Date() });

		return new Promise((resolve, reject) => {
			loaderUnderTest.call(defaultScope, tsContentWithCss);
			loaderUnderTest.call(
				{
					async() {
						return () => resolve();
					},
					resourcePath,
					resolve: loaderContextResolve
				},
				tsContentWithCss
			);
		}).then(() => {
			assert.isTrue(mockFs.statSync.calledTwice);
			assert.isTrue(create.calledTwice);
			assert.isTrue(mockDTSGenerator.default.calledOnce);
			assert.isTrue(mockDTSGenerator.default.firstCall.calledWith({ EOL: '\n' }));
			assert.isTrue(writeFile.calledTwice);
			assert.isTrue(mockFs.writeFileSync.notCalled);
		});
	});

	it('should find css import declarations in ts files and generate dts', () => {
		mockUtils.getOptions.returns({});
		const resolvePath = path.resolve;
		return new Promise((resolve, reject) => {
			loaderUnderTest.call(
				{
					async() {
						return () => resolve();
					},
					resolve(context: string, path: string, callback: (error: any, path?: string) => void) {
						callback(null, resolvePath(context, path));
					},
					resourcePath
				},
				tsContentWithCss
			);
		}).then(() => {
			assert.isTrue(create.calledOnce);
			assert.isTrue(create.firstCall.calledWith(path.resolve('src', cssFilePath)));
			assert.isTrue(writeFile.calledOnce);
			assert.isTrue(mockFs.writeFileSync.notCalled);
		});
	});

	it('should find multiple css import declarations in ts files and generate dts files for relative paths', () => {
		mockUtils.getOptions.returns({});
		const resolvePath = path.resolve;
		return new Promise((resolve, reject) => {
			loaderUnderTest.call(
				{
					async() {
						return () => resolve();
					},
					resolve(context: string, path: string, callback: (error: any, path?: string) => void) {
						callback(null, resolvePath(context, path));
					},
					resourcePath
				},
				tsContentWithMultipleCss
			);
		}).then(() => {
			assert.isTrue(create.calledOnce);
			assert.isTrue(create.firstCall.calledWith(path.resolve('src', cssFilePath)));
			assert.isTrue(writeFile.calledOnce);
			assert.isTrue(mockFs.writeFileSync.notCalled);
		});
	});

	it('should remove file from ts-loader cache if instance name is passed', () => {
		mockUtils.getOptions.returns({
			instanceName: 'src'
		});

		return new Promise((resolve, reject) => {
			loaderUnderTest.call(
				{
					async() {
						return () => resolve();
					},
					resourcePath,
					resolve(context: string, path: string, callback: (error: any, path?: string) => void) {
						callback(null, path);
					}
				},
				tsContentWithCss
			);
		}).then(() => {
			assert.isUndefined(instance.files[resourcePath]);
		});
	});

	it('should handle the case that no instance is found', () => {
		mockInstances.getTypeScriptInstance.returns({});
		mockUtils.getOptions.returns({
			instanceName: 'src'
		});

		return new Promise((resolve, reject) => {
			loaderUnderTest.call(
				{
					async() {
						return () => resolve();
					},
					resourcePath,
					resolve(context: string, path: string, callback: (error: any, path?: string) => void) {
						callback(null, path);
					}
				},
				tsContentWithCss
			);
		}).then(() => {
			assert.isTrue(instance.files[resourcePath]);
		});
	});

	it('should not generate dts files if no css imports are found', () => {
		mockUtils.getOptions.returns({
			instanceName: 'src'
		});

		return new Promise((resolve, reject) => {
			mockFs.statSync.resetHistory();
			loaderUnderTest.call(
				{
					async() {
						return () => resolve();
					},
					resolve(context: string, path: string, callback: (error: any, path?: string) => void) {
						callback(null, path);
					},
					resourcePath
				},
				tsContentWithoutCss
			);
		}).then(() => {
			assert.isFalse(mockInstances.getTypeScriptInstance.called);
			assert.isFalse(mockFs.statSync.called);
			assert.isFalse(create.called);
			assert.isTrue(mockFs.writeFileSync.notCalled);
		});
	});

	it('should report an error if there is an error resolving a path', () => {
		mockUtils.getOptions.returns({});
		return Promise.all([
			new Promise((resolve) => {
				loaderUnderTest.call(
					{
						async() {
							return (error: any) => resolve(error);
						},
						resourcePath,
						resolve(context: string, path: string, callback: (error: any, path?: string) => void) {
							callback('error');
						}
					},
					tsContentWithMultipleCss
				);
			}),
			new Promise((resolve) => {
				loaderUnderTest.call(
					{
						async() {
							return (error: any) => resolve(error);
						},
						resourcePath,
						resolve(context: string, path: string, callback: (error: any, path?: string) => void) {
							callback(null, '');
						}
					},
					tsContentWithMultipleCss
				);
			})
		]).then((errors: any[]) => {
			assert.equal(errors[0], 'error');
			assert.equal(errors[1].message, 'Unable to resolve path to css file');
		});
	});
});
