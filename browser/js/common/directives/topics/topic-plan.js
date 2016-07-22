app.directive('topicPlan', function ($rootScope) {
  return {
    restrict: 'E',
    scope: {
      plan: '=',
      topicId: '='
    },
    templateUrl: 'js/common/directives/topics/topic-plan.html',
    link: function (scope) {

      var userId;
      if($rootScope.user) userId = $rootScope.user.id;

      //available on html
      scope.userId = userId;

      // isLoggedIn = true is user is logged in; i.e., there is a user on the $rootScope
      scope.isLoggedIn = userId >= 0;

      scope.copyPlan = function() {
        // to implement => copies this plan to the user's plan
      }

    }
  }
});
