app.factory('VoteFactory', function($http, $q) {

  const upvotePath = '/api/upvote/';

  var VoteFactory = {};

    // Returns array of existing votes for all resources
    // -- Takes an array of resource IDs to pull votes for
    // -- If omitted, pulls all votes
  VoteFactory.fetchResourceVotes = function(resourceIds) {
    return $http.get(upvotePath + 'resource', { params: {resourceIds} })
    .then(res => res.data );
  }

  // Returns array of existing votes for all prerequisites of a topic
  VoteFactory.fetchPrereqVotes = function(topicId) {
    return $http.get(upvotePath + 'relationship', { params: {topicId} })
    .then(res => res.data );
  }

  // Returns array of existing votes for all prerequisites of a topic
  VoteFactory.fetchSubseqVotes = function(topicId) {
    return $http.get(upvotePath + 'relationship', { params: { prerequisiteId: topicId } })
    .then(res => res.data );
  }

  VoteFactory.getProcessedVotes = function(topic) {
    return $q.all([
      VoteFactory.fetchResourceVotes(
        topic.resources.map( function(resource) {
          return resource.id;
      })),
      VoteFactory.fetchPrereqVotes(topic.id),
      VoteFactory.fetchSubseqVotes(topic.id)
    ])
    .then( function(dbVotes) {

      function processVotes(votes, idKey) {
        var processedVotes = {}, key;
        votes.forEach( function(vote) {
          key = vote[idKey];
          if(!processedVotes[ key ]) processedVotes[ key ] = [];
          processedVotes[ key ].push(vote.userId);
        });
        return processedVotes;
      }

      return {
        resources: processVotes(dbVotes[0], 'resourceId'),
        prereq: processVotes(dbVotes[1], 'prerequisiteId'),
        subseq: processVotes(dbVotes[2], 'topicId')
      };

    });
  }


  // Resolves to true if the vote was successfully added
  // -- topicId is optional; only used for relationship voting
  VoteFactory.addVote = function(type, id, topicId) {
    var idObj = {},
        path = upvotePath;
    if(type === 'prereq') {
      idObj = {
        topicId: topicId,
        prerequisiteId: id
      }
      path += 'relationship';
    } else if(type === 'subseq') {
      idObj = {
        topicId: id,
        prerequisiteId: topicId
      }
      path += 'relationship';
    } else {
      idObj[type + 'Id'] = id;
      path += type;
    }
    return $http.post(path, idObj)
    .then( function(res) {
      if(res.status === 201) return true;
      return false;
    })
  }

  // Resolves to true if the vote was successfully deleted
  // -- topicId is optional; only used for relationship voting
  VoteFactory.removeVote = function(type, id, topicId) {
    var path = upvotePath;
    if(type === 'prereq') {
      path += 'relationship/topic/' + topicId + '/prereq/' + id;
    } else if(type === 'subseq') {
      // the prereq of a subsequent topics = the current topic
      path += 'relationship/topic/' + id + '/prereq/' + topicId;
    } else {
      path += type + '/' + id;
    }
    return $http.delete(path)
    .then( function(res) {
      if(res.status === 204) return true;
      return false;
    })
  }


  return VoteFactory;

});
