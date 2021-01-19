# nuxt-directus

A [Nuxt](https://nuxtjs.org/) module for integrating the [Directus](https://directus.io/) API (including an authentication middleware)

---

[![MIT license](https://img.shields.io/github/license/pnodev/nuxt-directus.svg)](https://github.com/pnodev/nuxt-directus/blob/master/LICENSE)
[![NPM version](https://img.shields.io/npm/v/@pnodev/nuxt-directus/latest.svg)](https://www.npmjs.com/package/@pnodev/nuxt-directus)
[![Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)

## Who is this for?

This module integrates the [Directus](https://directus.io/) API into your [Nuxt](https://nuxtjs.org/) project and exposes the [Directus JavaScript SDK](https://docs.directus.io/reference/sdk-js.html) under `$directus`. Furthermore, it comes with a complete, ready-to-use authentication middleware that requires minimal configuration. If you are looking for a ready-to-use solution for using Nuxt with Directus, this might be for you.

## Installation

> ⚠️ &nbsp;**Please note:**
> In order for this module to work, you also need to install [cookie-universal-nuxt](https://www.npmjs.com/package/cookie-universal-nuxt) and to have an activated [Vuex Store](https://nuxtjs.org/docs/2.x/directory-structure/store).

```bash
npm install --save @pnodev/nuxt-directus # or yarn add @pnodev/nuxt-directus
```

## Configuration

After installing the module, you need to add it to your module-array in `nuxt.config.js`. You have to make sure, that `@pnodev/nuxt-directus` is specified _before_ `'cookie-universal-nuxt'`.

```javascript
// nuxt.config.js

modules: [
  '@pnodev/nuxt-directus',
  'cookie-universal-nuxt',
],
```

To get started, you only need to specify your `apiUrl`:

```javascript
// nuxt.config.js

directus: {
  apiUrl: 'https://api.acme.net',
},
```

If you want to use the authentication-middleware, add it e.g. to your router like this:

```javascript
// nuxt.config.js

router: {
  middleware: ['auth'],
},
```

### Advanced Configuration Options

```javascript
// nuxt.config.js

directus: {
  apiUrl: 'https://api.acme.net', // your API URL
  accessTokenCookieName: 'directus_access_token', // the name of the cookie the access_token will be saved in
  refreshTokenCookieName: 'directus_refresh_token', // the name of the cookie the refresh_token will be saved in
  loginRoute: '/login', // the route containing your login-form
  homeRoute: '/', // the route the user will be redirected to after authentication
  hideLoginWhenAuthenticated: true, // when set to true, authenticated users will be redirected to homeRoute, when accessing loginRoute
}
```

## Usage

This module will expose two new APIs on your context object: `$directus` and `$auth`.

### `$directus`

You can directly access a pre-configured instance of the [Directus SDK](https://docs.directus.io/reference/sdk-js.html) through `this.$directus`.

### `$auth`

The `$auth`-object gives you access to a couple of methods that you can use to implement your authentication logic. Please note that all of these methods are `async` and will return a `Promise`.

#### `$auth.login(credentials)`

Call this method with your user's credentials. It will perform the login in against your API and store `access_token` and `refresh_token` for you. It will also take care of automatically requesting new tokens, before your `access_token` is about to expire. After a successful authentication, the user will be redirected to `homeRoute`.
If the authentication is not successful, the method will throw an error.

```javascript
// example login implementation

async login() {
  try {
    await this.$auth.login({
      email: this.email,
      password: this.password,
    });
  } catch (error) {
    if (error.message === 'Authentication Failure') {
      error.data.forEach((err) => {
        this.errorMessage += err.message;
      });
    }
  }
},
```

#### `$auth.logout()`

This method will invalidate your current tokens and delete the token-cookies.

#### `$auth.refresh()`

If for some reason you need to manually refresh the stored tokens, you can use this method to do so. It will request a new set of tokens and adjust the refresh-interval accordingly.

#### `$auth.user`

nuxt-directus retrieves the user-object after login and stores it in vuex. To get a reference to the current user, you can use this getter (will return null, if no user is logged in).

```Vue
<div v-if="$auth.user">
  <p>Some secret stuff</p>
</div>
<div v-else>
  <p>Public stuff</p>
</div>
```
