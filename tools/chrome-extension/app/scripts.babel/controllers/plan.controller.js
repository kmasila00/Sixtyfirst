app.controller('PlanCtrl', function($scope, plans) {

  $scope.plans = plans;
  if($scope.plans.length > 0) {
    $scope.selectedPlan = plans[0];
  }

  $scope.bubbleMessage = function() {
    if($scope.plans.length > 1) {
      return 'Ooooo looks like you\'ve got a few learning plans started. Grok is pleased.';
    } else if($scope.plans.length === 0) {
      return 'What?! No plans! Grok is hurt. You\'d better get one started. You wouldn\'t like to see a crying wizard, what with the fire and wrath and all.';
    } else {
      return 'Here\'s your learning plan:';
    }

  }

});
