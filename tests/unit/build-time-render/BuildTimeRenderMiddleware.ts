import { stub, SinonStub } from 'sinon';
import MockModule from '../../support/MockModule';

const { beforeEach, describe, it } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');

let mockModule: MockModule;

describe('build-time-render middleware', () => {
	beforeEach(() => {
		mockModule = new MockModule('../../../src/build-time-render/BuildTimeRenderMiddleware', require);
		mockModule.dependencies(['./BuildTimeRender']);
	});

	it('test', () => {
		const compiler = {
			hooks: {
				invalid: {
					tap: stub()
				}
			}
		};
		const mockRequest = {
			accepts() {
				return true;
			},
			url: 'http://localhost/blog'
		};
		const runPathStub = stub();
		const BuildTimeRenderMock: SinonStub = mockModule
			.getMock('./BuildTimeRender')
			.default.returns({ runPath: runPathStub });
		const OnDemandBuildTimeRender = mockModule.getModuleUnderTest().default;
		const nextStub = stub();
		const onDemandBuildTimeRender = new OnDemandBuildTimeRender({
			buildTimeRenderOptions: {
				root: 'app',
				onDemand: true
			},
			scope: 'lib',
			outputPath: 'path',
			jsonpName: 'jsonpFunction',
			compiler,
			base: 'base',
			entries: ['main']
		});
		onDemandBuildTimeRender.middleware(mockRequest, {}, nextStub);
		assert.isTrue(BuildTimeRenderMock.notCalled);
		compiler.hooks.invalid.tap.firstCall.callArg(1);
		onDemandBuildTimeRender.middleware(mockRequest, {}, nextStub);
		assert.isTrue(BuildTimeRenderMock.calledOnce);
		assert.deepEqual(BuildTimeRenderMock.firstCall.args, [
			{
				basePath: process.cwd(),
				baseUrl: 'base',
				entries: ['main'],
				root: 'app',
				onDemand: true,
				scope: 'lib'
			}
		]);
		assert.isTrue(runPathStub.calledOnce);
		assert.deepEqual(runPathStub.firstCall.args, [nextStub, 'blog', 'path', 'jsonpFunction']);
		onDemandBuildTimeRender.middleware(mockRequest, {}, nextStub);
		assert.isTrue(BuildTimeRenderMock.calledOnce);
		assert.isTrue(runPathStub.calledOnce);
		onDemandBuildTimeRender.middleware(
			{
				url: 'http://localhost/blog.html',
				accepts() {
					return false;
				}
			},
			{},
			nextStub
		);
		assert.isTrue(BuildTimeRenderMock.calledOnce);
		assert.isTrue(runPathStub.calledOnce);
		onDemandBuildTimeRender.middleware({ ...mockRequest, url: 'http://localhost/other.js' }, {}, nextStub);
		assert.isTrue(BuildTimeRenderMock.calledOnce);
		assert.isTrue(runPathStub.calledOnce);
		compiler.hooks.invalid.tap.firstCall.callArg(1);
		onDemandBuildTimeRender.middleware(mockRequest, {}, nextStub);
		assert.isTrue(BuildTimeRenderMock.calledTwice);
		assert.deepEqual(BuildTimeRenderMock.secondCall.args, [
			{
				basePath: process.cwd(),
				baseUrl: 'base',
				entries: ['main'],
				root: 'app',
				onDemand: true,
				scope: 'lib'
			}
		]);
		assert.isTrue(runPathStub.calledTwice);
		assert.deepEqual(runPathStub.secondCall.args, [nextStub, 'blog', 'path', 'jsonpFunction']);
	});
});
