const { afterEach, beforeEach, describe, it } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');
import MockModule from '../../support/MockModule';
import { stub } from 'sinon';

let mockModule: MockModule;

describe('hasBuildTimeRender', () => {
	beforeEach(() => {
		mockModule = new MockModule('../../../src/build-time-render/hasBuildTimeRender', require);
		mockModule.dependencies(['@dojo/framework/has/has']);
	});

	afterEach(() => {
		mockModule.destroy();
	});

	it('should set the build-time-render flag', () => {
		const has = mockModule.getMock('@dojo/framework/has/has');
		const existsMock = stub();
		const addMock = stub();
		existsMock.returns(false);
		has.exists = existsMock;
		has.add = addMock;
		mockModule.getModuleUnderTest();
		assert.isTrue(addMock.calledOnce);
	});

	it('should not set the build-time-render flag if already set', () => {
		const has = mockModule.getMock('@dojo/framework/has/has');
		const existsMock = stub();
		const addMock = stub();
		existsMock.returns(true);
		has.exists = existsMock;
		has.add = addMock;
		mockModule.getModuleUnderTest();
		assert.isTrue(addMock.notCalled);
	});
});
