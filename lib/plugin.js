import { Directus } from '@directus/sdk';
import Vue from 'vue';
import jwtDecode from 'jwt-decode';
import createAuthRefreshInterceptor from 'axios-auth-refresh';

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

  const directus = new Directus(options.apiUrl);
  inject('directus', directus);
  inject('auth', new Auth(ctx, options));

  const storedToken = ctx.$cookies.get(options.accessTokenCookieName);
  if (storedToken) {
    const tokenData = jwtDecode(storedToken);
    const validFor = tokenData.exp * 1000 - Date.now();
    if (validFor < 300000) {
      const { data } = await directus.auth.refresh();
      directus.auth.token = data.access_token;
    } else {
      directus.auth.token = storedToken;
    }
    if (process.client) {
      setTimeout(() => {
        ctx.$auth.refresh();
      }, ctx.$auth._getTimeUntilRefreshNeeded(directus.auth.token));
    }
    try {
      const { data } = await directus.users.me.read();
      ctx.store.commit('auth/SET_USER', data);
    } catch (error) {
      ctx.$cookies.remove(options.accessTokenCookieName);
      ctx.$cookies.remove(options.refreshTokenCookieName);
    }
  }
};

class Auth {
  constructor(ctx, options) {
    this.options = options;
    this.$directus = ctx.$directus;
    this.$store = ctx.store;
    this.$router = ctx.app.router;
    this.$cookies = ctx.$cookies;
    this.refreshTimer = null;

    createAuthRefreshInterceptor(this.$directus.transport.axios, failedRequest => {
      if (process.client && this.$cookies.get('directus_refresh_token')) {
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
    try {
      const loginData = await this.$directus.auth.login(credentials);
      this.$cookies.set(this.options.accessTokenCookieName, loginData.data.access_token);
      const { data } = await this.$directus.users.me.read();
      await this.$store.commit('auth/SET_USER', data);
      this.refreshTimer = setTimeout(() => {
        this.refresh();
      }, this._getTimeUntilRefreshNeeded(loginData.data.access_token));
      this.$router.push(this.options.homeRoute);
    } catch (error) {
      console.error(error);
      const authError = new Error('AuthError');
      authError.message = 'Authentication Failure';
      authError.data = error.response.data.errors;
      throw authError;
    }
  }

  async logout() {
    await this.$directus.axios.post('/auth/logout', {
      refresh_token: this.$cookies.get(this.options.refreshTokenCookieName),
    });
    if (process.client) {
      this.refreshTimer = clearTimeout(this.refreshTimer);
    }
    this.$cookies.remove(this.options.accessTokenCookieName);
    this.$cookies.remove(this.options.refreshTokenCookieName);
    await this.$store.commit('auth/SET_USER', null);
    this.$router.push(this.options.loginRoute);
  }

  async refresh() {
    this.refreshTimer = clearTimeout(this.refreshTimer);
    const response = await this.$directus.axios.post('/auth/refresh', {
      refresh_token: this.$cookies.get('directus_refresh_token')
    },
    {
      skipAuthRefresh: true,
      headers: {
        Authorization: ''
      }
    });

    this.$cookies.set('directus_refresh_token', response.data.data.refresh_token);
    this.$cookies.set('directus_access_token', response.data.data.access_token);
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
