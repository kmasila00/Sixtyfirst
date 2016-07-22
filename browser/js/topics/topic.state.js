app.config(function ($stateProvider) {

    $stateProvider.state('topic', {
        url: '/topic/:topicId',
        templateUrl: 'js/topics/topic.html',
        controller: 'TopicCtrl',
        resolve: {
          topic: function(TopicFactory, $stateParams) {
            return TopicFactory.fetchById($stateParams.topicId);
          },
          plans: function(PlanFactory, $stateParams) {
            return PlanFactory.fetchPlansByTopic($stateParams.topicId);
          },
          votes: function(VoteFactory, topic) {
            return VoteFactory.getProcessedVotes(topic);
          }
        }
    });

});
