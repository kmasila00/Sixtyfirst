// State & Controller for all topics

app.config(function ($stateProvider) {

    $stateProvider.state('topics', {
        url: '/topics',
        templateUrl: 'js/topics/topics.html',
        controller: 'TopicsCtrl',
        params: { 'defaultSearch': null },
        resolve: {
          topics: function(TopicFactory) {
            return TopicFactory.fetchAll();
          }
        }
    });

});

app.controller('TopicsCtrl', function ($scope, TopicFactory, topics, $uibModal, $stateParams) {

  $scope.topics = topics;
  $scope.searchText = $stateParams.defaultSearch;

  // ADD TOPIC
  $scope.addTopic = function() {
    var addTopicModal = $uibModal.open({
      animation: true,
      templateUrl: './js/common/modals/views/addTopic.html',
      controller: 'AddTopicModalCtrl'
    });
    addTopicModal.result
    .then(function (newTopic) {
      $scope.topics.push(newTopic);
    });
  }

});
