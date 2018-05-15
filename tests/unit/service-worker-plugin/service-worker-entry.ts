import MockModule from '../../support/MockModule';
import { SinonStub, stub } from 'sinon';

const { assert } = intern.getPlugin('chai');
const { describe, it, beforeEach, afterEach } = intern.getInterface('bdd');

let mockModule: MockModule;

describe('service worker entry', () => {
	let registerSpy: SinonStub;
	let addEventListenerSpy: SinonStub;

	beforeEach(() => {
		mockModule = new MockModule('../../../src/service-worker-plugin/service-worker-entry', require);
		registerSpy = stub();
		addEventListenerSpy = stub().callsFake((event: string, callback: () => void) => callback());
		(global as any).window = {
			addEventListener: addEventListenerSpy
		};
	});

	afterEach(() => {
		mockModule.destroy();
		(global as any).window = (global as any).navigator = undefined;
	});

	it('should register the service worker', () => {
		(global as any).navigator = {
			serviceWorker: {
				register: registerSpy
			}
		};
		mockModule.getModuleUnderTest();
		assert.strictEqual(addEventListenerSpy.callCount, 1);
		assert.isTrue(addEventListenerSpy.calledWith('load'));
		assert.isTrue(registerSpy.calledWith('./service-worker.js'));
	});

	it('should not register the service worker without support', () => {
		(global as any).navigator = {};
		mockModule.getModuleUnderTest();
		assert.isFalse(addEventListenerSpy.called);
	});
});
