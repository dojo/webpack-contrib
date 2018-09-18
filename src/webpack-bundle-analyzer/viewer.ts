import * as path from 'path';
import * as fs from 'fs';
import * as glob from 'glob';
const mkdir = require('mkdirp');
const analyzer = require('./analyzer');

export function generateReportData(bundleStats: any, opts: any) {
	const { reportFilename = 'report.html', bundleDir = null } = opts || {};

	const chartData: any[] = analyzer.getViewerData(bundleStats, bundleDir, {});
	let reportFilePath = reportFilename;

	if (!path.isAbsolute(reportFilePath)) {
		reportFilePath = path.resolve(bundleDir || process.cwd(), reportFilePath);
	}
	mkdir.sync(path.dirname(reportFilePath));
	const bundlesList: string[] = [];
	const bundleContent = chartData.reduce((bundleContent: any, data: any) => {
		const bundleFileName = data && data.label && data.label.split('/').slice(-1)[0];
		bundlesList.push(bundleFileName);
		bundleContent[bundleFileName] = data;
		return bundleContent;
	}, {});

	const reporterFiles = glob.sync(path.join(__dirname, 'reporter', '**', '*.*'));
	reporterFiles.forEach((file) => {
		fs.copyFileSync(
			file,
			path.join(path.dirname(reportFilePath), `${path.parse(file).name}${path.parse(file).ext}`)
		);
	});
	bundleContent;
	fs.writeFileSync(
		path.join(path.dirname(reportFilePath), `bundleContent.js`),
		`window.__bundleContent = ${JSON.stringify(bundleContent)}`
	);
	fs.writeFileSync(
		path.join(path.dirname(reportFilePath), `bundleList.js`),
		`window.__bundleList = ${JSON.stringify(bundlesList)}`
	);
}
