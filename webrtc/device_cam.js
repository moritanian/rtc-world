var camera_controller = (function(){
	var cameraData = [];
	var cam_id = 1;
	var cameraData = [];
	var localStream;
	var video;
  var resolution;
  var recorder, chunks;
	var camera_controller = function(videoElement, _resolution){
		video = videoElement;
    if(_resolution in camera_controller.RESOLUTION)
      resolution = _resolution;
	   else
      resolution = "";
  };

  camera_controller.RESOLUTION = {
    VGA: "VGA",
    HD: "HD" 
  };

  let RESOLUTION_HASH = {};
  RESOLUTION_HASH[camera_controller.RESOLUTION.VGA] = [640, 480];
  RESOLUTION_HASH[camera_controller.RESOLUTION.HD] = [1280, 720];

	camera_controller.prototype.startCamera = function(_cam_id = 1){
		cam_id = _cam_id;
		if(!!MediaStreamTrack.getSources){
			MediaStreamTrack.getSources(function(data){
        //カメラ情報を取得して、出力する
        var strCamera = "";
        var len = data.length;
        for( var i = 0 ; i < len ; i ++ ){
          strCamera += "<p>種類："+ data[i].kind+"<br/>ID："+ data[i].id+"</p>";
          if( data[i].kind == "video" ){
            cameraData.push(data[i]);
          }
        }
        if( cameraData.length === 0 ){
          alert("カメラが見つかりません");
          return;
        }
        //カメラを取得・切り替える
        setCamera();
      });
    }else if(!!navigator.mediaDevices.enumerateDevices){
      navigator.mediaDevices.enumerateDevices()
    	.then(function(devices) {
      	devices.forEach(function(device) {
          // console.log(device.kind + ": " + device.label +
          //  " id = " + device.deviceId);
          if(device.kind === "videoinput"){
            cameraData.push({id:device.deviceId});
          }
        });
        setCamera();
      })
    	.catch(function(err) {
     		console.log(err.name + ": " + err.message);
    	});
    }else{
  	 //カメラを取得・切り替える
  	 setCamera();   
    }
	};

	camera_controller.prototype.convertCamera = function(){
		cam_id++;
		if(cam_id == cameraData.length){
			cam_id = 0;
		}
		setCamera();
	};

  camera_controller.prototype.addLoadedEventListener = function(loadedFunc){
     function wrappedLoadedFunc(){
        video.removeEventListener('loadeddata', wrappedLoadedFunc);
        loadedFunc(video.videoWidth, video.videoHeight);
      }
      video.addEventListener("loadeddata", wrappedLoadedFunc);
  };

  // 録画開始
  camera_controller.prototype.startRecording = function(){
    const option = {
      videoBitsPerSecond : 5120000, // 512kbits / sec
      mimeType : 'video/webm; codecs=vp9'
    };

    recorder = new MediaRecorder(localStream, option);
    chunks = []; // 録画データを保持する

    // 一定間隔で録画が区切られて、データが渡される
    recorder.ondataavailable = function(evt) {
      chunks.push(evt.data);
    };

    // 録画開始
    recorder.start(1000); // 1000ms 毎に録画データを区切る
    
    // 録画停止時に呼ばれる
    recorder.onstop = function(evt) {
      recorder = null;
    };

  };

  camera_controller.prototype.stopRecording = function(){
    // 録画停止（の要求）  
    recorder.stop();
  };

  camera_controller.prototype.getRecordedBlobUrl = function(){

    const videoBlob = new Blob(chunks, { type: "video/webm" });
    let blobUrl = window.URL.createObjectURL(videoBlob);
    return blobUrl;

  };

	var setCamera = function(){
		navigator.getUserMedia = navigator.getUserMedia ||
      navigator.webkitGetUserMedia || 
      window.navigator.mozGetUserMedia;
    window.URL = window.URL ||
      window.webkitURL;

    var constraints;
		
    //カメラ再生中の場合は切り替えのため、一旦停止する
    if( localStream ){
      localStream.getTracks().forEach(function (track) { track.stop()});
    }

    if(cameraData.length > 0){
      if(cam_id > cameraData.length-1){
        cam_id = 0;
      }
      constraints = {
        video: {
    			optional: [{sourceId: cameraData[cam_id].id }], //カメラIDを直接指定する
    		},
    		audio: false
      	};
      if(resolution !== ""){
        constraints.video.mandatory = {
          "minWidth": RESOLUTION_HASH[resolution][0],
          "minHeight": RESOLUTION_HASH[resolution][1]
        };
      }
    }else{
    	constraints = {video: true, audio: false};
    }
    //カメラをIDを使用して取得する
    navigator.getUserMedia(
      constraints,
      function(stream) {
        //切り替え時にカメラを停止するため、情報を保存しておく
        localStream = stream;
        //カメラをvideoに結びつける
        video.srcObject = stream;
      },
      function(err) {
        //エラー処理
      }
    );
	};
	return camera_controller; 
})();