app.factory('FlagFactory', function($http){
	var baseUrl = '/api/flags/';
	var obj= {
		fetchTopicFlags: function(id){
			return $http.get(baseUrl + 'topic/'+ id )
			.then( res => res.data);
		},
		addTopicFlag: function(id, flag){
			return $http.post(baseUrl + 'topic/'+ id, flag)
			.then( res => res.data)
			.catch(err => err.data);
		},
		deleteTopicFlag: function(flagId, topicId){
			return $http.delete(baseUrl + 'topic/'+ flagId)
			.then( () => obj.fetchTopicFlags(topicId));
		},
		fetchResourceFlags: function(id){
			return $http.get(baseUrl + 'resource/'+ id )
			.then( res => res.data);
		},
		addResourceFlag: function(id, flag){
			return $http.post(baseUrl + 'resource/'+ id, flag)
			.then( res => res.data)
			.catch(err => err.data);
		},
		deleteResourceFlag: function(flagId, resourceId){
			return $http.delete(baseUrl + 'resource/'+ flagId)
			.then( () => obj.fetchResourceFlags(resourceId));
		}

	}
	return obj;

});
