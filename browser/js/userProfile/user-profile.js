app.config(function ($stateProvider) {

    $stateProvider.state('userProfile', {
        url: '/user',
        templateUrl: 'js/userProfile/user-profile.html',
        controller: 'UserProfileCtrl',
        resolve: {
            currentUser: function(AuthService) {
                return AuthService.getLoggedInUser();
            },
            resources: ['currentUser', 'ResourceFactory', function(currentUser, ResourceFactory) { 
                    return ResourceFactory.fetchByUser(currentUser.id)
                        .then(resources => resources);
            }]
        }
    });
});

app.controller('UserProfileCtrl', function ($scope, UsersFactory, PlanFactory, currentUser, resources) {

    function cloneObj(obj) { return Object.assign({}, obj) };

	$scope.error = null;
	$scope.pwUpdate = null;
	$scope.pwCheck = null;
    $scope.userUpdate = cloneObj(currentUser);
        $scope.resources = resources;
	$scope.updateUser = function(updatedInfo) {
		if($scope.pwUpdate !== $scope.pwCheck) {
			$scope.error = "Password does not match confirmation!";
		}
		else {
			$scope.error = null;
			if($scope.pwUpdate !== null) updatedInfo.password = $scope.pwUpdate;
			UsersFactory.updateUser(updatedInfo);
		}
	}

	$scope.reset = function() { 
		$scope.userUpdate = cloneObj(currentUser);
		$scope.error = null;
		$scope.pwUpdate = null;
		$scope.pwCheck = null;
	};

});
