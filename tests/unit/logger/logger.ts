import MockModule from '../../support/MockModule';
import * as sinon from 'sinon';

const { describe, it, beforeEach, afterEach } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');

describe('logger', () => {
	let mockModule: MockModule;
	let mockOra: any;
	let sandbox: sinon.SinonSandbox;
	const oraMock = {
		start: sinon.stub(),
		stop: sinon.stub(),
		isSpinning: false
	};

	beforeEach(() => {
		sandbox = sinon.createSandbox();
		oraMock.start = sandbox.stub();
		oraMock.stop = sandbox.stub();
		mockModule = new MockModule('../../../src/logger/logger', require);
		mockModule.dependencies(['ora']);

		mockOra = mockModule.getMock('ora');
		mockOra.ctor.returns(oraMock);
	});

	it('should create an ora logger and start and stop with specified text', () => {
		const createLogger = mockModule.getModuleUnderTest().default;
		let logger = createLogger();
		assert.isTrue(mockOra.ctor.calledOnce);

		logger = logger
			.text('1')
			.start()
			.stop();
		assert.isTrue(oraMock.start.calledOnce);
		assert.isTrue(oraMock.start.calledWith('1'));
		assert.isTrue(oraMock.stop.calledOnce);

		oraMock.start.resetHistory();
		oraMock.stop.resetHistory();

		logger.start('2').stop();

		assert.isTrue(oraMock.start.calledOnce);
		assert.isTrue(oraMock.start.calledWith('2'));
		assert.isTrue(oraMock.stop.calledOnce);

		oraMock.start.resetHistory();
		oraMock.stop.resetHistory();

		// Calls don't mutate state of existing logger
		logger.start();
		assert.isTrue(oraMock.start.calledOnce);
		assert.isTrue(oraMock.start.calledWith('1'));
	});

	it('should add and remove titles', () => {
		const createLogger = mockModule.getModuleUnderTest().default;
		let logger = createLogger('foo', 'bar');

		assert.isTrue(mockOra.ctor.calledOnce);

		logger = logger
			.text('1')
			.start()
			.stop();
		assert.isTrue(oraMock.start.calledOnce);
		assert.isTrue(oraMock.start.calledWith('foo - bar - 1'));
		assert.isTrue(oraMock.stop.calledOnce);

		oraMock.start.resetHistory();
		oraMock.stop.resetHistory();

		logger = logger('baz')
			.start('2')
			.stop();

		assert.isTrue(oraMock.start.calledOnce);
		assert.isTrue(oraMock.start.calledWith('foo - bar - baz - 2'));
		assert.isTrue(oraMock.stop.calledOnce);
		oraMock.start.resetHistory();
		oraMock.stop.resetHistory();

		logger
			.restore()
			.restore()
			.stop();

		// Should not start when restoring if not already spinning
		assert.isTrue(oraMock.start.notCalled);
		assert.isTrue(oraMock.stop.calledOnce);

		oraMock.isSpinning = true;
		logger.restore().restore();
		assert.isTrue(oraMock.start.calledTwice);
		assert.isTrue(oraMock.start.calledWith('foo - bar'));
		assert.isTrue(oraMock.start.calledWith('foo'));
	});

	afterEach(() => {
		mockModule.destroy();
	});
});
