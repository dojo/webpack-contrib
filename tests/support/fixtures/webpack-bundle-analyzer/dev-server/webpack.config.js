const BundleAnalyzerPlugin = require('../../../../../src/webpack-bundle-analyzer/BundleAnalyzerPlugin').default;

module.exports = {
  entry: `${__dirname}/src.js`,
  output: {
    path: `${__dirname}/output`,
    filename: 'bundle.js'
  },
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      reportFilename: 'report.html',
      openAnalyzer: false
    })
  ]
};
