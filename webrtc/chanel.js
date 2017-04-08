var Chanel = (function(){
   function _assert(desc, v) {
     if (v) {
       return;
     }
     else {
       let caller = _assert.caller || 'Top level';
       console.error('ASSERT in %s, %s is :', caller, desc, v);
     }
   }

  let peerConnections = [];
  let dataChannels = [];
  //let remoteStreams = [];
  const MAX_CONNECTION_COUNT = 4;
  let port = 3002;
  //let url = window.location.hostname;
  let url = "https://rtc-world-s.herokuapp.com";

  //let socket = io.connect('http://localhost:' + port + '/');
  //let socket = io.connect(url + ':' + port + '/');
  let socket; 
  let connected_callback;
  let get_msg_callback;
  let closed_callback;
  // connected_callback: 接続した際のコールバック関数, get_msg_callback, _closed_callback : データチャネル切断時のｃａｌｌｂａｃｋ
  var Chanel = function(_connected_callback, _get_msg_callback, _closed_callback, room = "_testroom"){
    connected_callback = _connected_callback;
    get_msg_callback = _get_msg_callback;
    closed_callback = _closed_callback;
    
    socket = io.connect(url +'/');

    // ---- for multi party -----
   
    // --- prefix -----
    navigator.getUserMedia  = navigator.getUserMedia    || navigator.webkitGetUserMedia ||
                              navigator.mozGetUserMedia || navigator.msGetUserMedia;
    RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
    RTCSessionDescription = window.RTCSessionDescription || window.webkitRTCSessionDescription || window.mozRTCSessionDescription;
    
    // ----- use socket.io ---
    
    //let room = getRoomName();
    socket.on('connect', function(evt) {
      console.log('socket.io connected. enter room=' + room );
      socket.emit('enter', room);
    });
    socket.on('message', function(message) {
  //    console.log('message:', message);
      let fromId = message.from;
      if (message.type === 'offer') {
        // -- got offer ---
  //      console.log('Received offer ...');
        let offer = new RTCSessionDescription(message);
        setOffer(fromId, offer);
      }
      else if (message.type === 'answer') {
        // --- got answer ---
  //      console.log('Received answer ...');
        let answer = new RTCSessionDescription(message);
        setAnswer(fromId, answer);
      }
      else if (message.type === 'candidate') {
        // --- got ICE candidate ---
  //      console.log('Received ICE candidate ...');
        let candidate = new RTCIceCandidate(message.ice);
  //      console.log(candidate);
        addIceCandidate(fromId, candidate);
      }
      else if (message.type === 'call me') {
        if (! canConnectMore()) {
          console.warn('TOO MANY connections, so ignore');
        }
        if (isConnectedWith(fromId)) {
          // already connnected, so skip
          console.log('already connected, so ignore');
        }
        else {
          // connect new party
          makeOffer(fromId);
        }
      }
      else if (message.type === 'bye') {
        if (isConnectedWith(fromId)) {
          stopConnection(fromId);
        }
      }
    });
    socket.on('user disconnected', function(evt) {
      console.log('====user disconnected==== evt:', evt);
      let id = evt.id;
      if (isConnectedWith(id)) {
        stopConnection(id);
      }
    });

    connect();
  }
    // --- broadcast message to all members in room
    function emitRoom(msg) {
      socket.emit('message', msg);
    }
    function emitTo(id, msg) {
      msg.sendto = id;
      socket.emit('message', msg);
    }
    // -- room名を取得 --
    /*
    function getRoomName() { // たとえば、 URLに  ?roomname  とする
      let url = document.location.href;
      let args = url.split('?');
      if (args.length > 1) {
        let room = args[1];
        if (room != '') {
          return room;
        }
      }
      return '_testroom';
    }
    */
    // --- RTCPeerConnections ---
    function getConnectionCount() {
      return Object.keys(peerConnections).length;
    }
    function canConnectMore() {
      return (getConnectionCount() < MAX_CONNECTION_COUNT);
    }
    function isConnectedWith(id) {
      if (peerConnections[id])  {
        return true;
      }
      else {
        return false;
      }
    }
    function addConnection(id, peer) {
      _assert('addConnection() peer', peer);
      _assert('addConnection() peer must NOT EXIST', (! peerConnections[id]));
      peerConnections[id] = peer;
    }
    function getConnection(id) {
      let peer = peerConnections[id];
      _assert('getConnection() peer must exist', peer);
      return peer;
    }
    function deleteConnection(id) {
      _assert('deleteConnection() peer must exist', peerConnections[id]);
      delete peerConnections[id];
    }
    function stopConnection(id) {
      if (isConnectedWith(id)) {
        let peer = getConnection(id);
        peer.close();
        deleteConnection(id);
        closed_callback(getConnectionCount());
      }
    }
    function stopAllConnection() {
      for (let id in peerConnections) {
        stopConnection(id);
      }
    }
   
    function sendSdp(id, sessionDescription) {
  //    console.log('---sending sdp ---');
      /*---
      textForSendSdp.value = sessionDescription.sdp;
      textForSendSdp.focus();
      textForSendSdp.select();
      ----*/
      let message = { type: sessionDescription.type, sdp: sessionDescription.sdp };
  //    console.log('sending SDP=' + message);
      //ws.send(message);
      emitTo(id, message);
    }
    function sendIceCandidate(id, candidate) {
 //     console.log('---sending ICE candidate ---');
      let obj = { type: 'candidate', ice: candidate };
      //let message = JSON.stringify(obj);
      //console.log('sending candidate=' + message);
      //ws.send(message);
      emitTo(id, obj);
    }
    // ---------------------- connection handling -----------------------
    function prepareNewConnection(id) {
      //let pc_config = {"iceServers":[]};
      let pc_config = {"iceServers":[
        {"urls": "stun:stun.l.google.com:19302"},
        {"urls": "stun:stun1.l.google.com:19302"},
        {"urls": "stun:stun2.l.google.com:19302"}
      ]};
      let peer = new RTCPeerConnection(pc_config);
     
      // --- on get local ICE candidate
      peer.onicecandidate = function (evt) {
        if (evt.candidate) {
   //       console.log(evt.candidate);
          // Trickle ICE の場合は、ICE candidateを相手に送る
          sendIceCandidate(id, evt.candidate);
          // Vanilla ICE の場合には、何もしない
        } else {
   //       console.log('empty ice event');
          // Trickle ICE の場合は、何もしない
          
          // Vanilla ICE の場合には、ICE candidateを含んだSDPを相手に送る
          //sendSdp(id, peer.localDescription);
        }
      };
      // --- when need to exchange SDP ---
      peer.onnegotiationneeded = function(evt) {
        console.log('-- onnegotiationneeded() ---');
      };
      // --- other events ----
      peer.onicecandidateerror = function (evt) {
        console.error('ICE candidate ERROR:', evt);
      };
      peer.onsignalingstatechange = function() {
        console.log('== signaling status=' + peer.signalingState);
      };
      peer.oniceconnectionstatechange = function() {
        console.log('== ice connection status=' + peer.iceConnectionState);
        if(peer.iceConnectionState === 'connected'){ // data chanel 接続はこれより遅いのでここではｃａｌｌｂａｃｋよばない
        }
        if (peer.iceConnectionState === 'disconnected') {
          console.log('-- disconnected --');
          //hangUp();
          stopConnection(id);
        }
      };
      peer.onicegatheringstatechange = function() {
        console.log('==***== ice gathering state=' + peer.iceGatheringState);
      };
      
      peer.onconnectionstatechange = function() {
        console.log('==***== connection state=' + peer.connectionState);
      };
     
      return peer;
    }
    function makeOffer(id) {
      _assert('makeOffer must not connected yet', (! isConnectedWith(id)) );
      peerConnection = prepareNewConnection(id);
      addConnection(id, peerConnection);
      createDataChanel(id); // data chanel

      peerConnection.createOffer()
      .then(function (sessionDescription) {
        console.log('createOffer() succsess in promise');
        return peerConnection.setLocalDescription(sessionDescription);
      }).then(function() {
        console.log('setLocalDescription() succsess in promise');
        // -- Trickle ICE の場合は、初期SDPを相手に送る -- 
        sendSdp(id, peerConnection.localDescription);
        // -- Vanilla ICE の場合には、まだSDPは送らない --
      }).catch(function(err) {
        console.error(err);
      });
    }
    function setOffer(id, sessionDescription) {
      /*
      if (peerConnection) {
        console.error('peerConnection alreay exist!');
      }
      */
      _assert('setOffer must not connected yet', (! isConnectedWith(id)) );    
      let peerConnection = prepareNewConnection(id);
      addConnection(id, peerConnection);
      
      peerConnection.setRemoteDescription(sessionDescription)
      .then(function() {
        console.log('setRemoteDescription(offer) succsess in promise');
        makeAnswer(id);
      }).catch(function(err) {
        console.error('setRemoteDescription(offer) ERROR: ', err);
      });
    }
    
    function makeAnswer(id) {
      console.log('sending Answer. Creating remote session description...' );
      let peerConnection = getConnection(id);
      if (! peerConnection) {
        console.error('peerConnection NOT exist!');
        return;
      }
      
      peerConnection.createAnswer()
      .then(function (sessionDescription) {
        console.log('createAnswer() succsess in promise');
        return peerConnection.setLocalDescription(sessionDescription);
      }).then(function() {
        console.log('setLocalDescription() succsess in promise');
        // -- Trickle ICE の場合は、初期SDPを相手に送る -- 
        sendSdp(id, peerConnection.localDescription);
        // -- Vanilla ICE の場合には、まだSDPは送らない --

        // DataChannelの接続を監視
        peerConnection.ondatachannel = function(evt) {
          // evt.channelにDataChannelが格納されているのでそれを使う
          setDataChanel(id, evt.channel);
        };
      }).catch(function(err) {
        console.error(err);
      });
    }
    function setAnswer(id, sessionDescription) {
      let peerConnection = getConnection(id);
      if (! peerConnection) {
        console.error('peerConnection NOT exist!');
        return;
      }
      peerConnection.setRemoteDescription(sessionDescription)
      .then(function() {
        console.log('setRemoteDescription(answer) succsess in promise');
      }).catch(function(err) {
        console.error('setRemoteDescription(answer) ERROR: ', err);
      });
    }
    // --- tricke ICE ---
    function addIceCandidate(id, candidate) {
      let peerConnection = getConnection(id);
      if (peerConnection) {
        peerConnection.addIceCandidate(candidate);
      }
      else {
        console.error('PeerConnection not exist!');
        return;
      }
    }
    
    // start PeerConnection
    function connect() {
      /*
      debugger; // SHOULD NOT COME HERE
      if (! peerConnection) {
        console.log('make Offer');
        makeOffer();
      }
      else {
        console.warn('peer already exist.');
      }
      */
      if (! canConnectMore()) {
        console.log('TOO MANY connections');
      }
      else {
        callMe();
      }
    }
    // close PeerConnection
    Chanel.prototype.hangUp = function() {
      /*
      if (peerConnection) {
        console.log('Hang up.');
        peerConnection.close();
        peerConnection = null;
        pauseVideo(remoteVideo);
      }
      else {
        console.warn('peer NOT exist.');
      }
      */
      emitRoom({ type: 'bye' });  
      stopAllConnection();
    }
    // ---- multi party --
    function callMe() {
      emitRoom({type: 'call me'});
    }

    function createDataChanel(id){
      if(id){
        if(peerConnections[id])
        _createDataChanel(id);
      }else{
        for (let id in peerConnections) {
          _createDataChanel(id);
        }
      }
    }

    function _createDataChanel(id){
      let peerConnection = peerConnections[id];
      var dataChannel = peerConnection.createDataChannel("myLabel");
      console.log("create data chanel " + id);
      setDataChanel(id, dataChannel);
    }

    function setDataChanel(id, dataChannel){
      dataChannels[id] = dataChannel;
      dataChannel.onmessage = function (event) {
        //console.log("データチャネルメッセージ取得:", event.data);
        get_msg_callback(event.data);
      };

      dataChannel.onopen = function () {
        connected_callback(getConnectionCount() );
      };

      dataChannel.onclose = function () {
        console.log("データチャネルのクローズ");
        //closed_callback(getConnectionCount());
      };
    }

    Chanel.prototype.sendAlongDataChanel = function(msg, id){
      if(id){
        if(dataChannels[id]){
          dataChannels[id].send(msg);
        }
      }else{
        for(let id in dataChannels){
          if(dataChannels[id].readyState === "open"){
            dataChannels[id].send(msg);
          }
        }
      }
    }
    return Chanel;
})();