app.factory('ResourceFactory', function($http){
	var baseUrl = '/api/resources/';
	var ResourceFactory = {};

	ResourceFactory.fetchAll = function(){
		return $http.get(baseUrl)
		.then(res => res.data);
	}

	ResourceFactory.fetchById = function(id){
		return $http.get(baseUrl+id)
		.then(res => res.data);
	}

  ResourceFactory.fetchByUser = function(id) {
    return $http.get(baseUrl + 'user/' + id)
    .then(res => res.data);
  }

	ResourceFactory.updateResource = function(resource){
		return $http.put(baseUrl + resource.id, resource)
		.then(res => res.data);
	}

	ResourceFactory.deleteResource =function(id){
		return $http.delete(baseUrl+id)
		.then(() => { return ResourceFactory.fetchAll() });
	}

	ResourceFactory.addTag = function(resourceId, tag) {
		return $http.post(baseUrl + resourceId + '/tag', { tagName: tag });
	}

	ResourceFactory.addNewResource = function(name, url, type, topicId){
    return $http.post(baseUrl, {name:name, url:url, type:type, topicId: topicId})
    .then(res => res.data);
  }

	return ResourceFactory;

});
