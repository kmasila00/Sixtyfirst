app.factory('PrereqFactory', function($http){

	var baseUrl = '/api/prerequisites/';

	return {

		fetchAll: function(){
			return $http.get(baseUrl)
			.then(res => res.data);
		},

		removeRelationship: function(topicId, relationId){
			return $http.delete(baseUrl + '/topic/' + topicId + '/prereq/' + relationId)
			.then(res => res.data);
		}

	}

})