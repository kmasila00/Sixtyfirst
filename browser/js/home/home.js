app.config(function ($stateProvider) {
    $stateProvider.state('home', {
        url: '/',
        templateUrl: 'js/home/home.html',
        //setting controller for home
        controller: function($scope, topics, prereqs, TopicFactory){
        	$scope.topics = topics;
        	$scope.prereqs = prereqs;

        },
        //resolving list of topics and prereqs to solve Async issue
        //list of topics and prereqs available on home html
        resolve:{
        	topics: function(TopicFactory){
        		return TopicFactory.fetchAll();
        	},
        	prereqs: function(PrereqFactory){
        		return PrereqFactory.fetchAll();
        	}
        }
    });
});