app.config(function ($stateProvider) {

    $stateProvider.state('admin', {
        url: '/admin',
        templateUrl: 'js/adminPanel/admin.html',
        controller: function() {
        },
        resolve: {
            isAdmin: function($state, AuthService){
              return AuthService.getLoggedInUser()
              .then(function (user) {
                if(!user || user.isAdmin === false) $state.go('home')
              })
            }
        }
    });

});
