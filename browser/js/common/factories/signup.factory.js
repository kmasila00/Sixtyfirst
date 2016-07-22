app.factory('SignupFactory', function ($http) {
  var SignupFactory = {};

  SignupFactory.createUser = function (newUser) {
    return $http.post('/api/users', newUser)
    .then(function (createdUser) {
      return createdUser.data;
    });
  };

  return SignupFactory;
})
