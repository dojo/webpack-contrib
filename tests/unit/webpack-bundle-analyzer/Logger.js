const Logger = require('../../../src/webpack-bundle-analyzer/Logger');
const { expect } = intern.getPlugin('chai');
const { describe, it, beforeEach } = intern.getInterface('bdd');

class TestLogger extends Logger {
	constructor(level) {
		super(level);
		this.logs = [];
	}

	clear() {
		this.logs = [];
	}

	_log(level, ...args) {
		this.logs.push([level, ...args]);
	}
}

let logger;

describe('Logger', function() {
	describe('level', function() {
		for (const testingLevel of Logger.levels) {
			describe(`"${testingLevel}"`, function() {
				beforeEach(function() {
					logger = new TestLogger(testingLevel);
				});

				for (const level of Logger.levels.filter((level) => level !== 'silent')) {
					if (Logger.levels.indexOf(level) >= Logger.levels.indexOf(testingLevel)) {
						it(`should log "${level}" message`, function() {
							logger[level]('msg1', 'msg2');
							expect(logger.logs).to.deep.equal([[level, 'msg1', 'msg2']]);
						});
					} else {
						it(`should not log "${level}" message`, function() {
							logger[level]('msg1', 'msg2');
							expect(logger.logs).to.be.empty;
						});
					}
				}
			});
		}

		it('should be set to "info" by default', function() {
			logger = new TestLogger();
			expectLoggerLevel(logger, 'info');
		});

		it('should allow to change level', function() {
			logger = new TestLogger('warn');
			expectLoggerLevel(logger, 'warn');
			logger.setLogLevel('info');
			expectLoggerLevel(logger, 'info');
			logger.setLogLevel('silent');
			expectLoggerLevel(logger, 'silent');
		});

		it('should throw if level is invalid on instance creation', function() {
			expect(() => new TestLogger('invalid')).to.throw(invalidLogLevelMessage('invalid'));
		});

		it('should throw if level is invalid on `setLogLevel`', function() {
			expect(() => new TestLogger().setLogLevel('invalid')).to.throw(invalidLogLevelMessage('invalid'));
		});
	});
});

function expectLoggerLevel(logger, level) {
	logger.clear();

	const levels = Logger.levels.filter((level) => level !== 'silent');

	for (const level of levels) {
		logger[level]('msg1', 'msg2');
	}

	const expectedLogs = levels
		.filter((testLevel) => Logger.levels.indexOf(testLevel) >= Logger.levels.indexOf(level))
		.map((testLevel) => [testLevel, 'msg1', 'msg2']);

	expect(logger.logs).to.deep.equal(expectedLogs);
}

function invalidLogLevelMessage(level) {
	return `Invalid log level "${level}". Use one of these: ${Logger.levels.join(', ')}`;
}
