import { add } from '@dojo/framework/core/has';
import { isMainThread, parentPort, workerData } from 'worker_threads';
import * as tsnode from 'ts-node';

export type FeatureMap = { [feature: string]: boolean };

if (isMainThread) {
	throw new Error('block worker should never be executed in the main thread');
}

tsnode.register({ transpileOnly: true });

export interface WorkerData {
	basePath: string;
	modulePath: string;
	args: any[];
	features?: FeatureMap;
}

async function runBlock() {
	const { basePath, modulePath, args, features } = workerData as WorkerData;
	const blockModule = require(`${basePath}/${modulePath}`);
	if (blockModule && blockModule.default) {
		try {
			features && Object.keys(features).forEach((key) => add(key, features[key]));
			const promise = blockModule.default(...args);
			const result = await promise;
			parentPort && parentPort.postMessage({ result: result, error: null });
		} catch (e) {
			parentPort && parentPort.postMessage({ result: null, error: e.message });
		}
	}
}

runBlock();
