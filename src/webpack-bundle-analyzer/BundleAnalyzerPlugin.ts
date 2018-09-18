const bfj = require('bfj-node4');
import * as path from 'path';
import * as mkdir from 'mkdirp';
import * as viewer from './viewer';

export default class BundleAnalyzerPlugin {
	private opts: any;
	private compiler: any;

	constructor(opts: any) {
		this.opts = {
			reportFilename: 'report.html',
			defaultSizes: 'parsed',
			generateStatsFile: false,
			statsFilename: 'stats.json',
			statsOptions: null,
			...opts
		};
	}

	apply(compiler: any) {
		this.compiler = compiler;
		const done = (stats: any) => {
			stats = stats.toJson(this.opts.statsOptions);
			if (this.opts.generateStatsFile) {
				this.generateStatsFile(stats);
			}
			this.generateStaticReport(stats);
		};

		if (compiler.hooks) {
			compiler.hooks.done.tap('webpack-bundle-analyzer', done);
		} else {
			compiler.plugin('done', done);
		}
	}

	async generateStatsFile(stats: any) {
		const statsFilepath = path.resolve(this.compiler.outputPath, this.opts.statsFilename);
		mkdir.sync(path.dirname(statsFilepath));

		try {
			await bfj.write(statsFilepath, stats, {
				promises: 'ignore',
				buffers: 'ignore',
				maps: 'ignore',
				iterables: 'ignore',
				circular: 'ignore'
			});
		} catch {}
	}

	generateStaticReport(stats: any) {
		viewer.generateReportData(stats, {
			reportFilename: path.resolve(this.compiler.outputPath, this.opts.reportFilename),
			bundleDir: this.getBundleDirFromCompiler()
		});
	}

	getBundleDirFromCompiler() {
		return this.compiler.outputFileSystem.constructor.name === 'MemoryFileSystem' ? null : this.compiler.outputPath;
	}
}
