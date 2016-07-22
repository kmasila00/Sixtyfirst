app.directive('myPlan', function ($rootScope, PlanFactory) {
  return {
    restrict: 'E',
    scope: {
      plan: '='
    },
    templateUrl: 'js/common/directives/plans/my-plan.html',
    link: function (scope, element, attributes) {

      var userId;
      if($rootScope.user) userId = $rootScope.user.id;

      scope.moveUp = function(resourceId) {
        var idx = getResourceIdx(resourceId);
        swapResources(idx, idx-1);
      }

      scope.moveDown = function(resourceId) {
        var idx = getResourceIdx(resourceId);
        swapResources(idx, idx+1);
      }

      scope.removeFromPlan = function(resourceId) {
        var idx = getResourceIdx(resourceId);
        PlanFactory.removeResourceFromPlan(scope.plan.id, resourceId)
        .then(function(){
          scope.plan.resources.splice(idx, 1);
        });
      }

      scope.deletePlan = function(planId){
        $rootScope.$broadcast('delete-plan', {
          planId: planId
        })
        scope.plan = null;
      }

      function getResourceIdx(id) {
        for(var i=0; i<scope.plan.resources.length; i++) {
          if(scope.plan.resources[i].id === id) return i;
        }
      }

      function swapResources(idx1, idx2) {
        var temp = scope.plan.resources[idx1];
        scope.plan.resources[idx1] = scope.plan.resources[idx2];
        scope.plan.resources[idx2] = temp;
      }


    }
  }
});
