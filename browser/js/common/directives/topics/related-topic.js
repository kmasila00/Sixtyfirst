app.directive('relatedTopic', function (VoteFactory, $rootScope) {
  return {
    restrict: 'E',
    scope: {
      type: '=',
      topic: '=',
      baseTopicId: '=',
      votes: '=',
    },
    templateUrl: 'js/common/directives/topics/related-topic.html',
    link: function (scope) {
      var userId;
      if($rootScope.user) userId = $rootScope.user.id;

      // this topic's ID is actually the 'prerequisite' ID on the topic passed to the directive
      // vote button should be on the left for subsequent; right for prerequisite voting
      if(scope.type === 'prereq') {
        scope.topicId = scope.topic.prerequisiteId;
        scope.buttonOnLeft = false;
      } else {
        scope.topicId = scope.topic.topicId;
        scope.buttonOnLeft = true;
      }

      // isLoggedIn = true is user is logged in; i.e., there is a user on the $rootScope
      scope.isLoggedIn = userId >= 0;

      // voted = true if user has voted on this resource
      if(scope.votes && scope.votes.indexOf(userId) >= 0) scope.voted = true;
      else scope.voted = false;

      // VOTING
      scope.upvote = function() {
        if(userId) { // user may upvote only if he/she is logged in
          VoteFactory.addVote(scope.type, scope.topicId, scope.baseTopicId)
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
          VoteFactory.removeVote(scope.type, scope.topicId, scope.baseTopicId)
          .then( function(success) {
            if(success) {
              scope.votes.splice(scope.votes.indexOf(userId));
              scope.voted = false;
              callForSort();
            }
          })
        }
      }

      function callForSort() {
        $rootScope.$broadcast('voted-need-resort', {
          type: scope.type,
          id: scope.topicId,
          votes: scope.votes
        });
      }

    }
  }
});
