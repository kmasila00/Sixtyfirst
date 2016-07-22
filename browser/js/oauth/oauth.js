'use strict';

app.directive('oauthButton', function () {
  return {
      scope: {
            providerName: '@'
          },
      restrict: 'E',
      templateUrl: '/js/oauth/oauth-button.html'
    }
});

app.directive('oauth', function () {
  return {
      restrict: 'E',
      templateUrl: '/js/oauth/oauth.html'
    }
});