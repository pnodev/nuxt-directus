import Vue from 'vue';
import jwtDecode from 'jwt-decode';
import createAuthRefreshInterceptor from 'axios-auth-refresh';
import { Directus, BaseStorage } from '@directus/sdk';

export default async (ctx, inject) => {
  const options = <%= JSON.stringify(options, null, 2) %>;

  const authModule = {
    namespaced: true,
    state: () => ({
      user: null,
    }),
    mutations: {
      SET_USER(state, user) {
        Vue.set(state, 'user', user);
      },
    },
  };

  const opts = {};
  if (ctx.isClient) {
    opts.preserveState = true;
  }
  ctx.store.registerModule('auth', authModule, opts);

  const storage = new PluginStorage(null, ctx, options);
  const directus = new Directus(options.apiUrl, {
    storage,
  });
  inject('directus', directus);
  inject('auth', new PluginAuth(ctx, options));

  const storedToken = ctx.$cookies.get(options.accessTokenCookieName);
  if (storedToken) {
    const tokenData = jwtDecode(storedToken);
    const validFor = tokenData.exp * 1000 - Date.now();
    if (validFor < 300000) {
      const { data } = await directus.auth.refresh();
      storage.auth_token = data[options.accessTokenCookieName];
    } else {
      directus.auth_token = storedToken;
      await directus.auth.refresh();
    }
    if (process.client) {
      setTimeout(() => {
        ctx.$auth.refresh();
      }, ctx.$auth._getTimeUntilRefreshNeeded(directus.auth.token));
    }
    try {
      const data = await directus.users.me.read();
      ctx.store.commit('auth/SET_USER', data);
    } catch (error) {
      ctx.$cookies.remove(options.accessTokenCookieName);
      ctx.$cookies.remove(options.refreshTokenCookieName);
    }
  }
};

class PluginAuth {
  constructor(ctx, options) {
    this.options = options;
    this.$directus = ctx.$directus;
    this.$store = ctx.store;
    this.$cookies = ctx.$cookies;
    this.refreshTimer = null;

    createAuthRefreshInterceptor(this.$directus.transport.axios, failedRequest => {
      if (process.client && this.$cookies.get(this.options.refreshTokenCookieName)) {
        console.log(456);
        return this.refresh().then((newToken) => {
            failedRequest.response.config.headers['Authorization'] = `Bearer ${newToken}`;
            return Promise.resolve();
        });
      } else {
        return Promise.reject(failedRequest);
      }
    });
  }

  get user() {
    return this.$store.state.auth.user;
  }

  async login(credentials) {
    const loginData = await this.$directus.auth.login(credentials);
    this.$cookies.set(this.options.accessTokenCookieName, loginData.access_token);
    const data = await this.$directus.users.me.read();
    await this.$store.commit('auth/SET_USER', data);
    this.refreshTimer = setTimeout(() => {
      this.refresh();
    }, this._getTimeUntilRefreshNeeded(loginData.access_token));

    return data;
  }

  async logout() {
    await this.$directus.auth.logout();
    if (process.client) {
      this.refreshTimer = clearTimeout(this.refreshTimer);
    }
    this.$cookies.remove(this.options.accessTokenCookieName);
    this.$cookies.remove(this.options.refreshTokenCookieName);
    await this.$store.commit('auth/SET_USER', null);
  }

  async refresh() {
    this.refreshTimer = clearTimeout(this.refreshTimer);
    const response = await this.$directus.transport.axios.post('/auth/refresh', {
        refresh_token: this.$cookies.get(this.options.refreshTokenCookieName),
      },
      {
        skipAuthRefresh: true,
        headers: {
          Authorization: '',
        },
      }
    );

    this.$cookies.set(this.options.refreshTokenCookieName, response.data.data.refresh_token);
    this.$cookies.set(this.options.accessTokenCookieName, response.data.data.access_token);
    this.$directus.auth.token = response.data.data.access_token;
    this.refreshTimer = setTimeout(() => {
      this.refresh();
    }, this._getTimeUntilRefreshNeeded(response.data.data.access_token));
    return response.data.data.access_token;
  }

  _getTimeUntilRefreshNeeded(token) {
    const validUntil = jwtDecode(token).exp;
    return validUntil * 1000 - Date.now() - 300000;
  }
}

class PluginStorage extends BaseStorage {
  constructor(prefix = '', ctx, options) {
    super();
    this.prefix = prefix;
    this.options = options;
    this.ctx = ctx;
  }

  get(key) {
    const data = this.ctx.$cookies.get(key);
    if (data !== null) {
      return data;
    }
    return null;
  }

  set(key, value) {
    this.ctx.$cookies.set(key, value);
    return value;
  }

  delete(key) {
    const value = this.get(key);
    this.ctx.$cookies.remove(key);
    return value;
  }

  get auth_token() {
    return this.get(this.options.accessTokenCookieName);
  }

  set auth_token(value) {
    if (value === null) {
      this.delete(this.options.accessTokenCookieName);
    } else {
      this.set(this.options.accessTokenCookieName, value);
    }
  }

  get auth_expires() {
    const value = this.get('auth_expires');
    if (value === null) {
      return null;
    }
    return parseInt(value);
  }

  set auth_expires(value) {
    if (value === null) {
      this.delete('auth_expires');
    } else {
      this.set('auth_expires', value.toString());
    }
  }

  get auth_refresh_token() {
    return this.get(this.options.refreshTokenCookieName);
  }

  set auth_refresh_token(value) {
    if (value === null) {
      this.delete(this.options.refreshTokenCookieName);
    } else {
      this.set(this.options.refreshTokenCookieName, value);
    }
  }
}
