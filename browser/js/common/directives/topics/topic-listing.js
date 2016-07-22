app.directive('topicListing', function ($rootScope, PlanFactory) {
  return {
    restrict: 'E',
    scope: {
      topic: '='
    },
    templateUrl: 'js/common/directives/topics/topic-listing.html',
    link: function (scope) {
    }
  }
});
