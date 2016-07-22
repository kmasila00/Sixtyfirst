'use strict';

app.directive('searchBox', function(TopicFactory) {
    return {
        restrict: 'AEC',
        scope: {
            items: '=',
            prompt: '@',
            title: '@',
            description: '@',
            model: '='
        },
        templateUrl: '/js/common/directives/search-box/search-box.html',
        link: function(scope) {
            TopicFactory.fetchAll().then(topics => scope.topics = topics);
        }
    };
});
