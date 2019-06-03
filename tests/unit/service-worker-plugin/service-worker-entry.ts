import global from '@dojo/framework/shim/global';
import has, { add } from '@dojo/framework/core/has';
import { SinonStub, stub } from 'sinon';
import MockModule from '../../support/MockModule';

const { assert } = intern.getPlugin('chai');
const { describe, it, beforeEach, afterEach } = intern.getInterface('bdd');

let mockModule: MockModule;

describe('service worker entry', () => {
	let registerSpy: SinonStub;
	let addEventListenerSpy: SinonStub;

	beforeEach(() => {
		mockModule = new MockModule('../../../src/service-worker-plugin/service-worker-entry', require);
		mockModule.dependencies(['@dojo/framework/has/has']);
		mockModule.getMock('@dojo/framework/has/has').default = has;
		registerSpy = stub();
		addEventListenerSpy = stub().callsFake((event: string, callback: () => void) => callback());
		global.addEventListener = addEventListenerSpy;
	});

	afterEach(() => {
		mockModule.destroy();
		global.addEventListener = global.navigator = undefined;
		add('public-path', undefined, true);
	});

	it('should register the service worker', () => {
		global.navigator = {
			serviceWorker: {
				register: registerSpy
			}
		};
		mockModule.getModuleUnderTest();
		assert.strictEqual(addEventListenerSpy.callCount, 1);
		assert.isTrue(addEventListenerSpy.calledWith('load'));
		assert.isTrue(registerSpy.calledWith('service-worker.js'));
	});

	it('should register the service worker for the public path', () => {
		global.navigator = {
			serviceWorker: {
				register: registerSpy
			}
		};
		add('public-path', '/foo', true);
		mockModule.getModuleUnderTest();
		assert.strictEqual(addEventListenerSpy.callCount, 1);
		assert.isTrue(addEventListenerSpy.calledWith('load'));
		assert.isTrue(registerSpy.calledWith('/foo/service-worker.js'));
	});

	it('should register the service worker for the public path with trailing slash ', () => {
		global.navigator = {
			serviceWorker: {
				register: registerSpy
			}
		};
		add('public-path', '/foo/', true);
		mockModule.getModuleUnderTest();
		assert.strictEqual(addEventListenerSpy.callCount, 1);
		assert.isTrue(addEventListenerSpy.calledWith('load'));
		assert.isTrue(registerSpy.calledWith('/foo/service-worker.js'));
	});

	it('should not register the service worker without support', () => {
		global.navigator = {};
		mockModule.getModuleUnderTest();
		assert.isFalse(addEventListenerSpy.called);
	});
});
