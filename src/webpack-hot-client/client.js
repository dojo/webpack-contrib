var global = require('@dojo/framework/shim/global').default;
var strip = require('strip-ansi');

var overlay = require('webpack-hot-middleware/client-overlay')({
	ansiColors: {},
	overlayStyles: {}
});

var TIMEOUT = 20 * 1000;

connect();

function EventSourceWrapper() {
	var source;
	var lastActivity = Date.now();
	var listeners = [];

	init();
	var timer = setInterval(function () {
		if ((Date.now() - lastActivity) > TIMEOUT) {
			handleDisconnect();
		}
	}, TIMEOUT / 2);

	function init() {
		source = new global.EventSource('/__webpack_hmr');
		source.onopen = handleOnline;
		source.onerror = handleDisconnect;
		source.onmessage = handleMessage;
	}

	function handleOnline() {
		console.log('[HMR] connected');
		lastActivity = Date.now();
	}

	function handleMessage(event) {
		lastActivity = Date.now();
		for (var i = 0; i < listeners.length; i++) {
			listeners[i](event);
		}
	}

	function handleDisconnect() {
		clearInterval(timer);
		source.close();
		setTimeout(init, TIMEOUT);
	}

	return {
		addMessageListener: function(fn) {
			listeners.push(fn);
		},
		disconnect: function() {
			clearInterval(timer);
			source.close();
		}
	};
}

function getEventSourceWrapper() {
	if (!global.__whmEventSourceWrapper) {
		global.__whmEventSourceWrapper = {
			'/__webpack_hmr': EventSourceWrapper()
		};
	}
	return global.__whmEventSourceWrapper['/__webpack_hmr'];
}

function connect() {
	getEventSourceWrapper().addMessageListener(handleMessage);

	function handleMessage(event) {
		if (event.data === '\uD83D\uDC93') {
			return;
		}
		try {
			processMessage(JSON.parse(event.data));
		} catch (ex) {
			console.warn('Invalid HMR message: ' + event.data + '\n' + ex);
		}
	}
}

var styles = {
	errors: 'color: #ff0000;',
	warnings: 'color: #999933;'
};

var previousProblems = null;

function log(type, obj) {
	var newProblems = obj[type].map(function (msg) { return strip(msg); }).join('\n');
	if (previousProblems === newProblems) {
		return;
	}

	previousProblems = newProblems;

	var style = styles[type];
	var name = obj.name ? obj.name + ' ' : '';
	var title = '[HMR] bundle ' + name + 'has ' + obj[type].length + type;
	if (console.group && console.groupEnd) {
		console.group('%c' + title, style);
		console.log('%c' + newProblems, style);
		console.groupEnd();
	} else {
		console.log(
			'%c' + title + '\n\t%c' + newProblems.replace(/\n/g, '\n\t'),
			style + 'font-weight: bold;',
			style + 'font-weight: normal;'
		);
	}
}

var reporter = {
	cleanProblemsCache: function() {
		previousProblems = null;
	},
	problems: function(type, obj) {
		log(type, obj);
		if (type === 'errors') {
			overlay.showProblems(type, obj[type]);
		}
	},
	success: function() {
		if (overlay && previousProblems) {
			overlay.clear();
		}
	}
};

var buildHash = null;

function processMessage(obj) {
	if (obj.action === 'built' || obj.action === 'sync') {
		var applyUpdate = true;
		if (obj.errors.length > 0) {
			reporter.problems('errors', obj);
			applyUpdate = false;
		} else {
			if (obj.warnings.length > 0) {
				reporter.problems('warnings', obj);
			}
			reporter.success();
			reporter.cleanProblemsCache();
		}
		if (applyUpdate) {
			if (buildHash && buildHash !== obj.hash) {
				global.location.reload();
			}
		}
		buildHash = obj.hash;
	}
}
