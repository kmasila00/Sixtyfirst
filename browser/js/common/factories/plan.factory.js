app.factory('PlanFactory', function($http) {

  var baseUrl = '/api/plans/';

  return {

    addNewPlan: function(name, description, topicId){
      return $http.post(baseUrl, {name:name, description:description, topicId:topicId})
      .then(res => res.data);
    },

    fetchPlansByTopic: function(topicId){
    	return $http.get(baseUrl + 'topic/' + topicId)
    	.then(res => res.data);
    },

    addResourceToPlan: function(planId, resourceId){
    	return $http.post(baseUrl + planId + '/resource/' + resourceId)
    	.then(res => res.data);
    },

    fetchResourcesByPlan: function(planId){
    	return $http.get(baseUrl + planId + '/resources')
    	.then(res => res.data);
    },

    fetchPlanById: function(planId){
    	return $http.get(baseUrl + planId)
    	.then(res => res.data);
    },

    fetchPlansByUser: function(userid){
    	return $http.get(baseUrl + 'user/' + userid)
    	.then(res => res.data);
    },

    removeResourceFromPlan: function(planId, resourceId){
      return $http.delete(baseUrl + planId + '/resource/' + resourceId)
      .then(res => res.data);
    },

    removePlan: function(planId){
      return $http.delete(baseUrl + planId)
      .then(res => res.data);
    }

  }

});
