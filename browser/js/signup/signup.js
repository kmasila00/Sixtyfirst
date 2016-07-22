app.config(function ($stateProvider) {

    $stateProvider.state('signup', {
        url: '/signup',
        templateUrl: 'js/signup/signup.html',
        controller: 'SignupCtrl'
    });

});

app.controller('SignupCtrl', function ($scope, SignupFactory, $state) {
  $scope.error = null;
  $scope.signup = function() {
    SignupFactory.createUser($scope.newUser)
    .then(function() {
        $state.go('home');
    })
    .catch(function(err) {
        $scope.error = err.data;
    });
  }
});
