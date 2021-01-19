import DirectusSDK from '@directus/sdk-js';
import Vue from 'vue';
import jwtDecode from 'jwt-decode';

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

  const directus = new DirectusSDK(options.apiUrl, {
    auth: {
      storage: {
        getItem: ctx.$cookies.get,
        setItem: ctx.$cookies.set,
      },
      mode: 'json',
      autoRefresh: false,
    },
  });

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
    this.store.commit('auth/SET_USER', null);
    this.$router.push(this.options.loginRoute);
  }

  async refresh() {
    this.refreshTimer = clearTimeout(this.refreshTimer);
    const { data } = await this.$directus.auth.refresh();
    this.$directus.auth.token = data.access_token;
    this.refreshTimer = setTimeout(() => {
      this.refresh();
    }, this._getTimeUntilRefreshNeeded(data.access_token));
  }

  _getTimeUntilRefreshNeeded(token) {
    const validUntil = jwtDecode(token).exp;
    return validUntil * 1000 - Date.now() - 300000;
  }
}
