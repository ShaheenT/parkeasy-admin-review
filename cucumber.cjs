module.exports = {
  default: {
    requireModule: ['ts-node/register'],
    require: ['tests/support/**/*.ts', 'tests/steps/**/*.ts'],
    paths: ['tests/features/**/*.feature'],
    format: ['progress-bar', 'html:reports/cucumber.html'],
  },
}
