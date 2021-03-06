import { isMainThread, parentPort, workerData } from 'worker_threads';
import * as tsnode from 'ts-node';

if (isMainThread) {
	throw new Error('block worker should never be executed in the main thread');
}

tsnode.register({ transpileOnly: true });

async function runBlock() {
	const { basePath, modulePath, args } = workerData;
	const blockModule = require(`${basePath}/${modulePath}`);
	if (blockModule && blockModule.default) {
		try {
			const promise = blockModule.default(...args);
			const result = await promise;
			parentPort && parentPort.postMessage({ result: result, error: null });
		} catch (e) {
			parentPort && parentPort.postMessage({ result: null, error: e.message });
		}
	}
}

runBlock();
