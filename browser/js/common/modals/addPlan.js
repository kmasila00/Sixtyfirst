app.controller('AddPlanModalCtrl', function ($scope, $uibModalInstance, options, PlanFactory, topics, resources, $q) {
  if(topics) $scope.topics = topics; // used for My Learning Plans => addTopic
  if(resources) $scope.resources = resources; // used for Topic => addPlan

  if(options.topicName) {
    $scope.formTitle = 'Add new plan for ' + options.topicName;
    var topicId = options.topicId;
    $scope.defaultName = 'My ' + options.topicName + ' learning plan';
    $scope.defaultDescription = 'I am learning ' + options.topicName + '.';
  } else {
    $scope.formTitle = 'Add new plan';
    $scope.defaultName = '';
    $scope.defaultDescription = '';
  }

  $scope.addPlan = function(plan) {
    if(!plan.topicId) plan.topicId = options.topicId;
    var newPlan;

    return PlanFactory.addNewPlan(plan.name, plan.description, plan.topicId)
    .then(function(newDbPlan) {
      newPlan = newDbPlan;
      var resourceIds = [];
      for(var key in plan.resources) {
        if(plan.resources[key]) resourceIds.push(+key);
      }
      return $q.all(resourceIds.map( function(resourceId) {
        return PlanFactory.addResourceToPlan(newDbPlan.id, resourceId);
      }))
      .then(function() {
        return PlanFactory.fetchPlanById(newDbPlan.id);
      });
    })
    .then(plan => $uibModalInstance.close(plan));
  };

  $scope.submit = function () {
    $uibModalInstance.close();
  };

  $scope.close = function () {
    $uibModalInstance.dismiss('cancel');
  };

});
