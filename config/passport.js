const cfenv = require('cfenv');
const appEnv = cfenv.getAppEnv();

// GitHub Passport Configs
let clientID = 'not_set';
let clientSecret  = 'not_set';
let callbackURL = 'not_set';

const fedCreds = appEnv.getServiceCreds(`federalist-${process.env.APP_ENV}-env`);
if (fedCreds) {
  clientID = fedCreds.GITHUB_CLIENT_ID;
  clientSecret = fedCreds.GITHUB_CLIENT_SECRET;
  callbackURL = fedCreds.GITHUB_CLIENT_CALLBACK_URL;
}

module.exports = {
  github: {
    options: { clientID, clientSecret, callbackURL, scope: ['user', 'repo', 'write:repo_hook'], },
    organizations: [
      6233994,  // 18f
      14109682, // federalist-users
    ],
  },
};
