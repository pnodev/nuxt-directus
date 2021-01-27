import Middleware from '../middleware';

Middleware.auth = function ({ store, redirect, route, $cookies }) {
  const options = <%= JSON.stringify(options, null, 2) %>;

  if (store.state.auth.user && (!$cookies.get(options.refreshTokenCookieName) || !$cookies.get(options.accessTokenCookieName))) {
    $cookies.remove(options.accessTokenCookieName);
    $cookies.remove(options.refreshTokenCookieName);
    store.commit('auth/SET_USER', null);
    if (route.path !== options.loginRoute) {
      return redirect(options.loginRoute);
    }
  }

  if (options.hideLoginWhenAuthenticated && route.path === options.loginRoute && store.state.auth.user) {
    return redirect(options.homeRoute);
  }

  // If the user is not authenticated
  if (!store.state.auth.user && route.path !== options.loginRoute) {
    return redirect(options.loginRoute);
  }
};
