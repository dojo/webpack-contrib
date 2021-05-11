import { Worker } from 'worker_threads';
import { join } from 'path';
import { FeatureMap } from '../../../src/static-build-loader/getFeatures';

const { describe, it } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');

describe('block-worker', () => {
	const testBlock = async (
		{
			modulePath,
			args,
			features
		}: {
			modulePath: string;
			args?: any[];
			features?: FeatureMap;
		},
		expectedResult: { result: any; error: any }
	) => {
		const promise = new Promise<any>((resolve, reject) => {
			const worker = new Worker(join(__dirname, '../../../src/build-time-render/block-worker.js'), {
				workerData: {
					basePath: join(__dirname, '../../../tests/support/fixtures/build-time-render/block-worker'),
					modulePath,
					args,
					features
				}
			});

			worker.on('message', resolve);
			worker.on('error', reject);
			worker.on('exit', (code) => {
				if (code !== 0) {
					reject(new Error(`Worker stopped with exit code ${code}`));
				}
			});
		});
		let result;
		try {
			result = await promise;
		} catch (_e) {}
		assert.deepEqual(result, expectedResult);
	};

	it('should render block', async () => {
		await testBlock(
			{
				modulePath: 'success.js',
				args: ['a']
			},
			{
				result: 'hello world a',
				error: null
			}
		);
	});

	it('should render has block with feature flag off', async () => {
		await testBlock(
			{
				modulePath: 'has.js',
				args: ['b']
			},
			{
				result: 'hello world b',
				error: null
			}
		);
	});

	it('should render has block with feature flag on', async () => {
		await testBlock(
			{
				modulePath: 'has.js',
				args: ['b'],
				features: { foo: true }
			},
			{
				result: 'hello foo world b',
				error: null
			}
		);
	});

	it('should return error thrown in block', async () => {
		await testBlock(
			{
				modulePath: 'error.js',
				args: ['c']
			},
			{
				result: null,
				error: 'error foo'
			}
		);
	});
});
