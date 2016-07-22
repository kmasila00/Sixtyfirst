// for users to flag a modal
app.controller('AddFlagModalInstanceCtrl', function($scope, $window, options, $uibModalInstance, FlagFactory){
  $scope.reasons= ['Rude or Abusive', 'Spam', 'Duplicate'];

  if(options.type === 'resource'){
    $scope.reasons.push('Off-Topic');
    $scope.addFlag = "addResourceFlag";
    $scope.heading = 'Resource';
  }
  else {
    $scope.addFlag = "addTopicFlag";
    $scope.heading = 'Topic';
  }
  $scope.id = options.id;

  $scope.flagIt= function(flag){

    FlagFactory[$scope.addFlag]($scope.id, flag)
    .then(function(res){
      if(res[0]=== "Y") $window.alert(res);
      $uibModalInstance.close();
    })
  }


  $scope.cancel = function () {
    $uibModalInstance.dismiss('cancel');
  };
});


// for admins to view submitted flags for an associated resource/topic
app.controller('ModalInstanceCtrl', function ($scope, $uibModalInstance, FlagFactory) {

  $scope.heading= $scope.flagType ? 'Resource Flags' : 'Topic Flags';

  $scope.ok = function () {
    $uibModalInstance.close();
  };

  $scope.close = function () {
    $uibModalInstance.dismiss('cancel');
  };

  $scope.delete= function(flag){
    var deleteFlag= $scope.flagType ? FlagFactory.deleteResourceFlag : FlagFactory.deleteTopicFlag;
    var modelId= $scope.flagType ? 'resourceId' : 'topicId';
    deleteFlag(flag.id, flag[modelId])
    .then(function(flags){
      $scope.flags= flags;
    });
  };

});
