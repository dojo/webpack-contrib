const { afterEach, before, describe, it, after } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');
import MockModule from '../../support/MockModule';
import global from '@dojo/framework/shim/global';
import * as sinon from 'sinon';

let mockModule: MockModule;
let source: EventSource;
let consoleStub: sinon.SinonStub;
let consoleWarnStub: sinon.SinonStub;

class EventSource {
	public onopen: any;
	public onerror: any;
	public onmessage: any;
	public close: any = sinon.stub();

	constructor() {
		source = this;
	}
}

global.EventSource = EventSource;
global.location = {
	reload: sinon.stub()
};
global.addEventListener = sinon.stub();

describe('client', () => {
	const overlayMock = {
		showProblems: sinon.stub(),
		clear: sinon.stub()
	};

	before(() => {
		consoleStub = sinon.stub(console, 'log');
		consoleWarnStub = sinon.stub(console, 'warn');
		mockModule = new MockModule('../../../src/webpack-hot-client/client', require);
		mockModule.proxy('webpack-hot-middleware/client-overlay', () => {
			return overlayMock;
		});
		mockModule.getModuleUnderTest();
	});

	afterEach(() => {
		global.location.reload.reset();
		global.addEventListener.reset();
		consoleStub.reset();
		consoleWarnStub.reset();
		overlayMock.clear.reset();
		overlayMock.showProblems.reset();
	});

	after(() => {
		global.__whmEventSourceWrapper['/__webpack_hmr'].disconnect();
		consoleStub.restore();
		consoleWarnStub.restore();
	});

	it('Warns for an invalid message', () => {
		source.onmessage({ data: '{ kjnaskjnakjdn": ' });
		assert.isTrue(
			consoleWarnStub.calledWith(
				'Invalid HMR message: { kjnaskjnakjdn": \nSyntaxError: Unexpected token k in JSON at position 2'
			)
		);
	});

	it('Reloads window when built with no errors', () => {
		source.onmessage({
			data: JSON.stringify({
				action: 'sync',
				errors: [],
				warnings: [],
				hash: 'first'
			})
		});

		source.onmessage({
			data: JSON.stringify({
				action: 'built',
				errors: [],
				warnings: [],
				hash: 'hash'
			})
		});

		assert.isTrue(global.location.reload.calledOnce);

		source.onmessage({
			data: JSON.stringify({
				action: 'built',
				errors: [],
				warnings: [],
				hash: 'hash'
			})
		});

		assert.isTrue(global.location.reload.calledTwice);

		source.onmessage({
			data: JSON.stringify({
				action: 'sync',
				errors: [],
				warnings: [],
				hash: 'hash-1'
			})
		});

		assert.isTrue(global.location.reload.calledThrice);

		source.onmessage({
			data: JSON.stringify({
				action: 'sync',
				errors: [],
				warnings: [],
				hash: 'hash-1'
			})
		});

		assert.isTrue(global.location.reload.calledThrice);

		source.onmessage({
			data: JSON.stringify({
				action: 'sync',
				errors: ['error'],
				warnings: [],
				hash: 'hash-1'
			})
		});

		assert.isTrue(global.location.reload.calledThrice);
		assert.isTrue(overlayMock.showProblems.calledOnce);
		assert.isTrue(overlayMock.clear.notCalled);

		source.onmessage({
			data: JSON.stringify({
				action: 'sync',
				errors: ['error'],
				warnings: [],
				hash: 'hash-1'
			})
		});

		assert.isTrue(global.location.reload.calledThrice);
		assert.isTrue(overlayMock.showProblems.calledTwice);
		assert.isTrue(overlayMock.clear.notCalled);

		source.onmessage({
			data: JSON.stringify({
				action: 'sync',
				errors: [],
				warnings: [],
				hash: 'hash-2'
			})
		});

		assert.strictEqual(global.location.reload.callCount, 4);
		assert.isTrue(overlayMock.showProblems.calledTwice);
		assert.isTrue(overlayMock.clear.calledOnce);

		source.onmessage({
			data: JSON.stringify({
				action: 'other',
				errors: [],
				warnings: [],
				hash: 'hash-3'
			})
		});

		assert.strictEqual(global.location.reload.callCount, 4);
		assert.isTrue(overlayMock.showProblems.calledTwice);
		assert.isTrue(overlayMock.clear.calledOnce);

		source.onmessage({
			data: JSON.stringify({
				action: 'sync',
				errors: [],
				warnings: ['warning'],
				hash: 'hash-3'
			})
		});

		assert.strictEqual(global.location.reload.callCount, 5);
		assert.isTrue(overlayMock.showProblems.calledTwice);
		assert.isTrue(overlayMock.clear.calledTwice);
	});

	it('supports multiple compilations', () => {
		source.onmessage({
			data: JSON.stringify({
				name: 'main',
				action: 'sync',
				errors: [],
				warnings: [],
				hash: 'first'
			})
		});

		source.onmessage({
			data: JSON.stringify({
				name: 'another',
				action: 'sync',
				errors: [],
				warnings: [],
				hash: 'another-first'
			})
		});

		source.onmessage({
			data: JSON.stringify({
				name: 'main',
				action: 'built',
				errors: [],
				warnings: [],
				hash: 'hash'
			})
		});

		assert.isTrue(global.location.reload.calledOnce);

		source.onmessage({
			data: JSON.stringify({
				name: 'another',
				action: 'built',
				errors: [],
				warnings: [],
				hash: 'hash'
			})
		});

		assert.isTrue(global.location.reload.calledTwice);
	});
});
