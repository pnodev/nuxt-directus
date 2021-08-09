const { resolve, join } = require('path');

export default function (moduleOptions) {
  const options = Object.assign(
    {
      accessTokenCookieName: 'access_token',
      refreshTokenCookieName: 'refresh_token',
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
