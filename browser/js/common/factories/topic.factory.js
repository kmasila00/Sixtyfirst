app.factory('TopicFactory', function($http) {

  var baseUrl = '/api/topics/';

  var obj= {

    fetchAll: function() {
      return $http.get(baseUrl)
      .then(res => res.data);
    },

    fetchById: function(id) {
      return $http.get(baseUrl + id)
      .then(res => res.data);
    },

    addNewTopic: function(title, description){
      return $http.post(baseUrl, {title:title, description:description})
      .then(res => res.data);
    },

    updateTopic: function(topic){
      return $http.put(baseUrl + topic.id, topic)
      .then(res => res.data);
    },

    deleteTopic: function(id){
      return $http.delete(baseUrl + id)
      .then( ()=> obj.fetchAll());

    },

    suggestTopic: function(type, topicId, newTopicName) {
      // convert to route format
      if(type === 'prereq') type = 'prerequisite';
      else if(type === 'subseq') type = 'subsequent';

      return $http.post(baseUrl + topicId + '/' + type, { title: newTopicName });
    },

    // Sorts voted data arrays - i.e., prerequisites, subsequent topics, and resources
    // -- dataArr = data array to be sorted
    // -- votes = $scope.numVotes object value to sort by
    // -- idKey = idKey on dataArr corresponding to the key in votes
    sortData: function(dataArr, votes, idKey) {
      if(!votes) return dataArr; // if no votes found, do not sort

      function inOrder (index) {
        if (index === dataArr.length - 1) return true;
        var baseId = dataArr[index][idKey],
            nextId = dataArr[index + 1][idKey],
            numVotesBase = 0,
            numVotesNext = 0;
        if(votes[baseId]) numVotesBase = votes[baseId].length;
        if(votes[nextId]) numVotesNext = votes[nextId].length;
        return numVotesBase >= numVotesNext;
      }

      function swap (index) {
        var oldLeftValue = dataArr[index];
        dataArr[index] = dataArr[index + 1];
        dataArr[index + 1] = oldLeftValue;
      }

      var sorted = false;
      for (var end = dataArr.length; end > 0 && !sorted; end--) {
        sorted = true;
        for (var j = 0; j < end; j++) {
          if (!inOrder(j)) {
            swap(j);
            sorted = false;
          }
        }
      }
      return dataArr;
    }

  }
  return obj;

});
