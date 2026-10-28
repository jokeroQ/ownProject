process.env.THEME_SETTINGS_FOCUS = 'workspace-features';
process.env.THEME_SETTINGS_SCENARIO = require('node:path').join(__dirname, 'home-selection-scenarios.cjs');
require('./theme-browser.smoke.cjs');
