app.controller('LoginCtrl', function ($scope, AuthService, $state, SERVER) {

  $scope.login = {};
  $scope.error = null;
  $scope.signupPath = SERVER + '/signup';

  $scope.sendLogin = function (loginInfo) {
      $scope.error = null;

      AuthService.login(loginInfo).then(function () {
          $state.go('home');
      }).catch(function () {
          $scope.error = 'Invalid login credentials.';
      });

  };

});
