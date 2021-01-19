const { resolve, join } = require('path');

export default function (moduleOptions) {
  const options = Object.assign(
    {
      accessTokenCookieName: 'directus_access_token',
      refreshTokenCookieName: 'directus_refresh_token',
      loginRoute: '/login',
      homeRoute: '/',
      hideLoginWhenAuthenticated: true,
    },
    this.options.directus,
    moduleOptions
  );

  const pluginsToSync = ['plugin.js', 'middleware.js'];
  for (const pathString of pluginsToSync) {
    this.addPlugin({
      src: resolve(__dirname, pathString),
      fileName: join('directus', pathString),
      options,
    });
  }
}
module.exports.meta = require('../package.json');
