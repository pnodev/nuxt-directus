import Middleware from '../middleware';

Middleware.auth = function ({ store, redirect, route }) {
  const options = <%= JSON.stringify(options, null, 2) %>;

  if (options.hideLoginWhenAuthenticated && route.path === options.loginRoute && store.state.auth.user) {
    return redirect(options.homeRoute);
  }

  // If the user is not authenticated
  if (!store.state.auth.user && route.path !== options.loginRoute) {
    return redirect(options.loginRoute);
  }
};
