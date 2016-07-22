app.config(function ($stateProvider) {

    $stateProvider.state('admin', {
        url: '/admin',
        templateUrl: 'js/adminPanel/templates/admin.html',
        controller: function() {
        },
        resolve: {
            isAdmin: function($state, AuthService){
              return AuthService.getLoggedInUser()
              .then(function (user) {
                if(!user || user.isAdmin === false) $state.go('home')
              })
            }
        }
    });

    $stateProvider.state('admin.topics', {
        url: '/topics',
        templateUrl: 'js/adminPanel/templates/topics.html',
        controller: function($scope, topics, TopicFactory, FlagFactory, PrereqFactory, $uibModal){

           $scope.topics= topics;

           $scope.update= TopicFactory.updateTopic;

           $scope.delete= function(id){
            TopicFactory.deleteTopic(id)
            .then(updatedTopics => $scope.topics = updatedTopics)
           }

           //passing in topic id and prereq id 
           $scope.deletePrereq = function(topicId, prereqId){
              PrereqFactory.removeRelationship(topicId, prereqId)
              .then();
           }

           //passing ids in opposite orders to delete a subsequent relationship
           $scope.deleteSubseq = function(topicId, subseqId){
              PrereqFactory.removeRelationship(subseqId, topicId)
              .then();
           }

            $scope.openFlags = function (topicId) {

              FlagFactory.fetchTopicFlags(topicId)
              .then(topicFlags => $scope.flags= topicFlags);

               $uibModal.open({
                 animation: $scope.animationsEnabled,
                 scope: $scope,
                 templateUrl: './js/common/modals/views/topicFlagModal.html',
                 controller: 'ModalInstanceCtrl'
               });
             };

        },
        resolve: {
          topics: function(TopicFactory) {
            return TopicFactory.fetchAll()
              // returns topics with the prereqs and subseqs on it
              .then(function(allTopics){
                return Promise.all(allTopics.map(function(elem){
                  return TopicFactory.fetchById(elem.id)
                }))
              })
          }
        }
    });

    $stateProvider.state('admin.resources', {
        url: '/resources',
        templateUrl: 'js/adminPanel/templates/resources.html',
        controller: function($scope, resources, ResourceFactory, FlagFactory, $uibModal){

          $scope.resources= resources;

          $scope.update= ResourceFactory.updateResource;

          $scope.types= ['article', 'video', 'book', 'documentation', 'tutorial', 'other'];

          $scope.flagType= 'resource';

          $scope.delete= function(id){
            ResourceFactory.deleteResource(id)
            .then(updatedResources => $scope.resources= updatedResources)
          }

          $scope.openFlags = function (resourceId) {

            FlagFactory.fetchResourceFlags(resourceId)
            .then(updatedResourceFlags => $scope.flags= updatedResourceFlags);

             $uibModal.open({
               animation: $scope.animationsEnabled,
               scope: $scope,
               templateUrl: './js/common/modals/views/topicFlagModal.html',
               controller: 'ModalInstanceCtrl'
             });

           };

        },
        resolve: {
          resources: function(ResourceFactory){
            return ResourceFactory.fetchAll();
          }
        }

    });

});
