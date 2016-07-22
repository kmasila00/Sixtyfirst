
app.config(function ($stateProvider) {

  $stateProvider.state('admin.users', {
    url: '/users',
    templateUrl: 'js/users/templates/users.html',
    controller: function($scope, users, UsersFactory){
      $scope.users= users;

      $scope.deleteUser= function(user){
        UsersFactory.deleteUser(user)
        .then(function(updatedUsers){
          $scope.users=updatedUsers;
        });
      }

      $scope.triggerPasswordReset= function(user){
        user.passwordReset= true;
        UsersFactory.updateUser(user);

      };

      $scope.update= UsersFactory.updateUser;
    },
    resolve: {
      users: UsersFactory => UsersFactory.getAllUsers(),
    }

  })

});
