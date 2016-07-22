app.controller('SuggestTopicModalCtrl', function ($scope, $uibModalInstance, options, topics, TopicFactory) {

  $scope.topics = topics;
  $scope.formTitle = options.formTitle;
  $scope.suggestionType = options.suggestionType;
  var topicId = options.topicId;

  // type = type of topic relationship (prereq or subseq)
  $scope.suggestTopic = function(type, newTopicName) {
    return TopicFactory.suggestTopic(type, topicId, newTopicName)
    .then(function(res) {
      // returns to TopicCtrl with "fake" object representing the suggested topic object
      var returnObj = { title: newTopicName };
      if(type === 'prereq') {
        returnObj.prerequisiteId = res.data[0][0].prerequisiteId;
      } else if (type === 'subseq') {
        // subsequent topics are stored on a topics page where:
        // -- current topic = prereqTopic
        // -- prereqTopic = current topic's subsequent topic
        returnObj.topicId = res.data[0][0].topicId;
      }
      $uibModalInstance.close([type, returnObj]);
    });
  }

  $scope.submit = function () {
    $uibModalInstance.close();
  };

  $scope.close = function () {
    $uibModalInstance.dismiss('cancel');
  };

});
