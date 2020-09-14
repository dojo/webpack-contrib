import * as ora from 'ora';

export interface LiveLogger {
	(title: string): this;
	text(text: string): this;
	start(text?: string): this;
	stop(): this;
	restore(): this;
}

const spinner = ora();
export default function createLiveLogger(...title: string[]): LiveLogger {
	return createLogger(title);
}

function createLogger(title: string[], text?: string) {
	const logger = function(newTitle: string) {
		return createLiveLogger(...title, newTitle);
	};
	logger.text = function(text: string) {
		return createLogger(title, text);
	};
	logger.start = function(newText?: string): LiveLogger {
		if (typeof newText === 'string') {
			return createLogger(title, newText).start();
		}
		let displayTitle = title.join(' - ');
		const displayText = displayTitle ? (text ? ` - ${text}` : '') : text || '';
		spinner.start(`${displayTitle}${displayText}`);
		return this;
	};
	logger.stop = function() {
		spinner.stop();
		return this;
	};
	logger.restore = function() {
		const newTitles = [...title];
		newTitles.pop();
		const logger = createLiveLogger(...newTitles);
		return spinner.isSpinning ? logger.start() : logger;
	};

	return logger;
}
