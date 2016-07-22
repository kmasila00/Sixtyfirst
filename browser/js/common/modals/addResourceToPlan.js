app.controller('AddResourceToPlanModalCtrl', function ($scope, $uibModal, $uibModalInstance, plans, resource, options, ResourceFactory, PlanFactory, topicId) {
  $scope.formTitle = 'Add \'' + resource.name + '\' to my learning plan';
  $scope.plans = plans.concat([{ name: '- create a new plan -', id: 0 }]); // adds a dummy plan to accomodate creation of a new one
  $scope.resource = resource;


  // newPlanName should only exist if 'create a new plan' was selected for selectedPlan
  $scope.addResourceToPlan = function(selectedPlan) {
    if(selectedPlan.new) {
      var description = 'My new learning plan.';
      return PlanFactory.addNewPlan(selectedPlan.new, description, topicId)
      .then( function(newPlan) {
        return PlanFactory.addResourceToPlan(newPlan.id, $scope.resource.id);
      })
      .then(function(newResource) {
        $uibModalInstance.close(newResource);
      });
    } else {
      return PlanFactory.addResourceToPlan(selectedPlan.existing.id, $scope.resource.id)
      .then(function(newResource) {
        $uibModalInstance.close(newResource);
      });
    }
  };

  $scope.submit = function () {
    $uibModalInstance.close();
  };

  $scope.close = function () {
    $uibModalInstance.dismiss('cancel');
  };

});
