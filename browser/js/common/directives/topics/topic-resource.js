app.directive('topicResource', function (AuthService, TopicFactory, VoteFactory, $rootScope, $uibModal, PlanFactory) {
  return {
    restrict: 'E',
    scope: {
      resource: '=',
      topicId: '=',
      votes: '=',
    },
    templateUrl: 'js/common/directives/topics/topic-resource.html',
    link: function (scope) {

      var userId;
      if($rootScope.user) userId = $rootScope.user.id;

      // isLoggedIn = true is user is logged in; i.e., there is a user on the $rootScope
      scope.isLoggedIn = userId >= 0;

      // voted = true if user has voted on this resource
      if(scope.votes && scope.votes.indexOf(userId) >= 0) scope.voted = true;
      else scope.voted = false;

      // VOTING
      scope.upvote = function() {
        if(userId) { // user may upvote only if he/she is logged in
          VoteFactory.addVote('resource', scope.resource.id, scope.topicId)
          .then( function(success) {
            if(success) {
              if(!scope.votes) scope.votes = []; // if there are no existing votes
              scope.votes.push(userId);
              scope.voted = true;
              callForSort();
            }
          })
        }
      }

      scope.devote = function() {
        if(userId) { // user may upvote only if he/she is logged in
          VoteFactory.removeVote('resource', scope.resource.id, scope.topicId)
          .then( function(success) {
            if(success) {
              scope.votes.splice(scope.votes.indexOf(userId));
              scope.voted = false;
              callForSort();
            }
          })
        }

      }

      // PLANS
      // add existing resource to plan
      scope.addResourceToPlan = function() {
        $uibModal.open({
          animation: true,
          templateUrl: './js/common/modals/views/addResourceToPlan.html',
          controller: 'AddResourceToPlanModalCtrl',
          resolve: {
            topicId: scope.topicId,
            plans: PlanFactory.fetchPlansByUser(userId),
            resource: scope.resource,
            options: { topicId: scope.topicId }
          }
        });
      }

      // FLAGGING
      scope.flagResource = function(id) {
        $uibModal.open({
          animation: true,
          templateUrl: './js/common/modals/views/addFlagModal.html',
          controller: 'AddFlagModalInstanceCtrl',
          resolve: {
            options: { type: 'resource', id: id }
          }
        });
      }

      function callForSort() {
        $rootScope.$broadcast('voted-need-resort', {
          type: 'resources',
          id: scope.resource.id,
          votes: scope.votes
        });
      }

    }
  }
});
